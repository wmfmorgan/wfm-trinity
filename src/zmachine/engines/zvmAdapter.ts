/**
 * Real Z-machine adapter backed by the `zmachine` npm package.
 *
 * Uses a custom BridgeIO so the engine can pause on readLine and resume when
 * submit() provides a command — suitable for browser + vitest.
 */

import {
  ZMachine,
  type IOAdapter,
  type ReadLineResult,
  type ZVersion,
} from 'zmachine'
import type {
  ExitInfo,
  InventoryItem,
  TurnSnapshot,
  WaitingFor,
} from '../../domain/types'
import type { ZMachineAdapter } from '../types'
import {
  decodeSaveBlob,
  encodeIwz2,
  type StackPayload,
} from '../saveCodec'
import {
  StoryValidationError,
  validateStoryBytes,
} from '../storyValidate'

/** Player object short-name heuristics (Infocom / Inform). */
const PLAYER_NAME_RE = /^(you|cretin|yourself|player)$/i

/** Max object number we will ask the engine for (V3/V4/V5 tables). */
const MAX_OBJECT_NUM = 65_535

interface BridgeStatus {
  location: string
  score: number
  turns: number
  isTime: boolean
}

/**
 * Headless I/O bridge: captures print output and parks on line/char input
 * until the adapter supplies a value.
 */
class BridgeIO implements IOAdapter {
  private lower = ''
  private upper = ''
  private currentWindow = 0
  lastStatus: BridgeStatus | undefined
  hasQuit = false
  /** Set when the VM run() rejects so waiters can fail instead of hang. */
  private engineError: Error | null = null

  private lineResolve: ((r: ReadLineResult) => void) | null = null
  private charResolve: ((code: number) => void) | null = null
  private waitingNotify: ((err?: Error) => void) | null = null
  private waitingKind: 'line' | 'char' | null = null

  initialize(_version: ZVersion): void {
    this.currentWindow = 0
  }

  print(text: string): void {
    if (this.currentWindow === 0) this.lower += text
    else this.upper += text
  }

  printLine(text: string): void {
    this.print(text + '\n')
  }

  newLine(): void {
    this.print('\n')
  }

  quit(): void {
    this.hasQuit = true
  }

  restart(): void {
    this.lower = ''
    this.upper = ''
    this.currentWindow = 0
    this.hasQuit = false
  }

  showStatusLine(
    location: string,
    score: number,
    turns: number,
    isTime: boolean,
  ): void {
    this.lastStatus = { location, score, turns, isTime }
  }

  setWindow(window: number): void {
    this.currentWindow = window
  }

  splitWindow(_lines: number): void {
    /* no-op for headless */
  }

  eraseWindow(window: number): void {
    if (window === -1 || window === -2) {
      this.lower = ''
      this.upper = ''
      this.currentWindow = 0
    } else if (window === 0) {
      this.lower = ''
    } else if (window === 1) {
      this.upper = ''
    }
  }

  setTextStyle(_style: number): void {}
  setBufferMode(_mode: boolean): void {}
  getBufferMode(): boolean {
    return true
  }
  setCursor(_line: number, _column: number): void {}
  eraseLine(): void {}
  setForegroundColor(_color: number): void {}
  setBackgroundColor(_color: number): void {}
  soundEffect(_n: number, _e: number, _v: number): void {}

  async readLine(maxLength: number, _timeout?: number): Promise<ReadLineResult> {
    this.waitingKind = 'line'
    this.notifyWaiting()
    return new Promise<ReadLineResult>((resolve) => {
      this.lineResolve = (r) => {
        resolve({
          text: r.text.slice(0, maxLength),
          terminator: r.terminator,
        })
      }
    })
  }

  async readChar(_timeout?: number): Promise<number> {
    this.waitingKind = 'char'
    this.notifyWaiting()
    return new Promise<number>((resolve) => {
      this.charResolve = resolve
    })
  }

  /** Resolves when the engine next requests line or char input. */
  waitUntilInputRequested(): Promise<void> {
    if (this.engineError) {
      return Promise.reject(this.engineError)
    }
    if (this.lineResolve || this.charResolve) {
      return Promise.resolve()
    }
    return new Promise<void>((resolve, reject) => {
      this.waitingNotify = (err?: Error) => {
        if (err) reject(err)
        else resolve()
      }
    })
  }

  /**
   * Fail any pending waiters (used when machine.run() throws).
   * Surfaces engine crashes as open/submit failures instead of hanging forever.
   */
  failPending(err: Error): void {
    this.engineError = err
    const n = this.waitingNotify
    this.waitingNotify = null
    n?.(err)
    // Drop hanging input resolvers — run is dead
    this.lineResolve = null
    this.charResolve = null
    this.waitingKind = null
  }

  provideLine(text: string): void {
    const resolve = this.lineResolve
    if (!resolve) {
      throw new Error('Z-machine is not waiting for line input')
    }
    this.lineResolve = null
    this.waitingKind = null
    resolve({ text, terminator: 13 })
  }

  provideChar(code: number): void {
    const resolve = this.charResolve
    if (!resolve) {
      throw new Error('Z-machine is not waiting for character input')
    }
    this.charResolve = null
    this.waitingKind = null
    resolve(code)
  }

  takeLowerOutput(): string {
    const out = this.lower
    this.lower = ''
    return out
  }

  getWaitingKind(): 'line' | 'char' | null {
    return this.waitingKind
  }

  private notifyWaiting(): void {
    const n = this.waitingNotify
    this.waitingNotify = null
    n?.()
  }
}

function formatEngineError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err)
  if (/out of bounds/i.test(raw)) {
    return new Error(
      `${raw}. This usually means the story file is truncated, corrupt, or not raw Z-code ` +
        `(e.g. a partial download or a Blorb/zip renamed to .z5). ` +
        'Re-import a complete raw .z3–.z8 file, or start a New Game if Continue used a bad save.',
    )
  }
  return err instanceof Error ? err : new Error(raw)
}

function emptySnapshot(): TurnSnapshot {
  return {
    transcriptDelta: '',
    location: { id: 'unknown', name: 'Unknown' },
    inventory: [],
    exits: [],
    status: {},
    waitingFor: 'line',
  }
}

function signed16(n: number): number {
  return n > 0x7fff ? n - 0x10000 : n
}

/**
 * Find the player object among children of the current location.
 * Heuristic: short name matches you/cretin/yourself/player; fallback first child.
 */
function safeObjectName(zm: ZMachine, obj: number): string {
  if (!Number.isFinite(obj) || obj <= 0 || obj > MAX_OBJECT_NUM) return ''
  try {
    return zm.getObjectName(obj).trim()
  } catch {
    // Invalid object numbers must not crash a turn (e.g. garbage in globals).
    return ''
  }
}

/** True when obj looks like a real object table entry with a readable name. */
function isReadableObject(zm: ZMachine, obj: number): boolean {
  return safeObjectName(zm, obj).length > 0
}

/**
 * Scan the object table for the player. Prefer names like "yourself"/"cretin".
 * Cap the scan so huge V5/V8 tables stay cheap.
 */
function findPlayerObject(zm: ZMachine): number {
  const maxScan = zm.header.version <= 3 ? 255 : 2000
  let fallback = 0
  for (let n = 1; n <= maxScan; n++) {
    const name = safeObjectName(zm, n)
    if (!name) continue
    if (PLAYER_NAME_RE.test(name)) {
      // Prefer a player that currently has a parent (in-world), not a prototype.
      try {
        const parent = zm.objectTable.getParent(n)
        if (parent > 0 && isReadableObject(zm, parent)) return n
      } catch {
        /* keep scanning */
      }
      if (!fallback) fallback = n
    }
  }
  return fallback
}

function inventoryOf(zm: ZMachine, playerObj: number): InventoryItem[] {
  if (playerObj <= 0) return []
  const items: InventoryItem[] = []
  try {
    let child = zm.objectTable.getChild(playerObj)
    let guard = 0
    while (child && guard++ < 512) {
      const name = safeObjectName(zm, child) || `object-${child}`
      items.push({ id: String(child), name })
      child = zm.objectTable.getSibling(child)
    }
  } catch {
    /* leave empty */
  }
  return items
}

/**
 * Resolve current location.
 *
 * Prefer parent-of-player (works for Trinity and most Infocom titles).
 * Fall back to Infocom G00 (var 16) only when it is a readable object number —
 * some games leave non-object values in that global and getObjectName OOB-crashes.
 */
function resolveLocation(
  zm: ZMachine,
  io: BridgeIO,
  playerObj: number,
): { id: string; name: string } {
  // 1) Parent of player
  if (playerObj > 0) {
    try {
      const parent = zm.objectTable.getParent(playerObj)
      const name = safeObjectName(zm, parent)
      if (parent > 0 && name) {
        return { id: String(parent), name }
      }
    } catch {
      /* try next strategy */
    }
  }

  // 2) Classic Infocom global 0 / variable 16 — only if it names a real object
  try {
    const g0 = zm.variables.read(16)
    const name = safeObjectName(zm, g0)
    if (g0 > 0 && name) {
      return { id: String(g0), name }
    }
  } catch {
    /* try next */
  }

  // 3) Status line from @show_status if the game called it
  if (io.lastStatus?.location) {
    return { id: 'status', name: io.lastStatus.location }
  }

  return { id: 'unknown', name: 'Unknown' }
}

function buildWorld(zm: ZMachine, io: BridgeIO): {
  location: { id: string; name: string }
  inventory: InventoryItem[]
  exits: ExitInfo[]
  status: TurnSnapshot['status']
} {
  try {
    const playerObj = findPlayerObject(zm)
    const location = resolveLocation(zm, io, playerObj)
    const inventory = inventoryOf(zm, playerObj)

    let scoreRaw = 0
    let movesRaw = 0
    try {
      scoreRaw = zm.variables.read(17)
      movesRaw = zm.variables.read(18)
    } catch {
      /* keep zeros */
    }
    const score = signed16(scoreRaw)
    const moves = movesRaw

    const status: TurnSnapshot['status'] = {
      locationName: location.name,
    }
    let isTime = false
    try {
      isTime = io.lastStatus?.isTime ?? (zm.header.flags1 & 0x02) !== 0
    } catch {
      isTime = Boolean(io.lastStatus?.isTime)
    }
    if (isTime) {
      status.hours = score
      status.minutes = moves
    } else {
      status.score = score
      status.moves = moves
    }

    // Exits not portable from object tree; map learns from movement.
    const exits: ExitInfo[] = []

    return {
      location,
      inventory,
      exits,
      status,
    }
  } catch {
    // Never let world-view extraction kill a playable turn.
    return {
      location: {
        id: 'unknown',
        name: io.lastStatus?.location || 'Unknown',
      },
      inventory: [],
      exits: [],
      status: {
        locationName: io.lastStatus?.location || 'Unknown',
        score: io.lastStatus && !io.lastStatus.isTime ? io.lastStatus.score : undefined,
        moves: io.lastStatus && !io.lastStatus.isTime ? io.lastStatus.turns : undefined,
        hours: io.lastStatus?.isTime ? io.lastStatus.score : undefined,
        minutes: io.lastStatus?.isTime ? io.lastStatus.turns : undefined,
      },
    }
  }
}

function waitingForFrom(io: BridgeIO, zm: ZMachine): WaitingFor {
  if (io.hasQuit || zm.state === 'halted') return 'finished'
  if (io.getWaitingKind() === 'char') return 'char'
  return 'line'
}

/**
 * Create a ZMachineAdapter backed by the real `zmachine` engine.
 */
export function createZvmAdapter(): ZMachineAdapter {
  let storyBytes: Uint8Array | null = null
  let io: BridgeIO | null = null
  let zm: ZMachine | null = null
  let lastSnapshot: TurnSnapshot = emptySnapshot()
  let generation = 0

  function assertReady(): { io: BridgeIO; zm: ZMachine } {
    if (!io || !zm) {
      throw new Error('No story loaded')
    }
    return { io, zm }
  }

  async function settleOnce(): Promise<TurnSnapshot> {
    const { io: bridge, zm: machine } = assertReady()
    const gen = generation
    await bridge.waitUntilInputRequested()
    if (gen !== generation) {
      return lastSnapshot
    }
    await Promise.resolve()
    const transcriptDelta = bridge.takeLowerOutput()
    const world = buildWorld(machine, bridge)
    lastSnapshot = {
      transcriptDelta,
      ...world,
      waitingFor: waitingForFrom(bridge, machine),
    }
    return lastSnapshot
  }

  /**
   * Wait for input and build a snapshot. On load, Infocom titles like Trinity
   * first ask "[Press any key to begin.]" — auto-dismiss a few char prompts
   * so the player lands on a normal line prompt with a real location.
   */
  async function settleAfterInput(opts?: {
    autoSkipCharPrompts?: boolean
  }): Promise<TurnSnapshot> {
    const autoSkip = opts?.autoSkipCharPrompts === true
    let snapshot = await settleOnce()
    if (!autoSkip) return snapshot

    // Auto-dismiss up to a few char-input splash prompts (key to begin, etc.)
    for (let i = 0; i < 4 && snapshot.waitingFor === 'char'; i++) {
      const { io: bridge } = assertReady()
      bridge.takeLowerOutput()
      bridge.provideChar(13) // Return / any key
      const next = await settleOnce()
      // Accumulate splash text into the opening transcript
      next.transcriptDelta = snapshot.transcriptDelta + next.transcriptDelta
      snapshot = next
      lastSnapshot = snapshot
    }
    return snapshot
  }

  function startRun(machine: ZMachine, bridge: BridgeIO, bootGen: number): void {
    void machine.run().catch((err: unknown) => {
      // Abandoning a machine (restore/reload) may leave a rejected run; ignore.
      if (bootGen !== generation) return
      const formatted = formatEngineError(err)
      console.error('[zvmAdapter] engine run error', formatted)
      bridge.failPending(formatted)
    })
  }

  function bootMachine(data: Uint8Array): void {
    generation += 1
    const bootGen = generation
    storyBytes = data.slice()
    io = new BridgeIO()
    try {
      zm = ZMachine.load(data, io)
    } catch (err) {
      throw formatEngineError(err)
    }
    startRun(zm, io, bootGen)
  }

  return {
    async load(story: ArrayBuffer): Promise<TurnSnapshot> {
      const data = new Uint8Array(story)
      try {
        validateStoryBytes(data)
      } catch (err) {
        if (err instanceof StoryValidationError) throw err
        throw err
      }
      bootMachine(data)
      try {
        return await settleAfterInput({ autoSkipCharPrompts: true })
      } catch (err) {
        throw formatEngineError(err)
      }
    },

    async submit(line: string): Promise<TurnSnapshot> {
      const { io: bridge } = assertReady()
      // Discard any buffered output so transcriptDelta is this turn only
      bridge.takeLowerOutput()
      const kind = bridge.getWaitingKind()
      if (kind === 'char') {
        // Char prompts: "[Press any key]", "Quit? (Y/N)". Enter alone = Return.
        const trimmed = line.trim()
        const ch = trimmed.charAt(0) || '\n'
        bridge.provideChar(ch === '\n' ? 13 : ch.charCodeAt(0))
      } else {
        bridge.provideLine(line)
      }
      try {
        return await settleAfterInput()
      } catch (err) {
        throw formatEngineError(err)
      }
    },

    async save(): Promise<ArrayBuffer> {
      const { zm: machine } = assertReady()
      if (!storyBytes) throw new Error('No story loaded')
      const staticBase = machine.header.staticMemoryBase
      const dynamic = machine.memory.readBytes(0, staticBase)
      const stack = machine.stack.serialize() as StackPayload
      // IWZ2: do not embed the story (library already has it). Much smaller
      // and avoids JSON ArrayBuffer .buffer padding bugs in IWZ1.
      return encodeIwz2({
        pc: machine.pc,
        staticBase,
        dynamic,
        stack,
      })
    },

    async restore(
      data: ArrayBuffer,
      storyFromLibrary?: ArrayBuffer,
    ): Promise<TurnSnapshot> {
      let decoded
      try {
        decoded = decodeSaveBlob(data)
      } catch (err) {
        throw new Error(
          err instanceof Error ? err.message : 'Invalid save data',
        )
      }

      let story: Uint8Array
      if (decoded.storyBytes && decoded.storyBytes.byteLength > 0) {
        story = decoded.storyBytes
      } else if (storyFromLibrary && storyFromLibrary.byteLength > 0) {
        story = new Uint8Array(storyFromLibrary)
      } else if (storyBytes) {
        story = storyBytes
      } else {
        throw new Error(
          'Save has no embedded story and no library story was provided',
        )
      }

      try {
        validateStoryBytes(story)
      } catch (err) {
        if (err instanceof StoryValidationError) {
          throw new Error(`Cannot restore: ${err.message}`)
        }
        throw err
      }

      // Fresh VM, apply dynamic RAM + stack + PC, run from saved PC (mid-sread).
      generation += 1
      const bootGen = generation
      storyBytes = story.slice()
      io = new BridgeIO()
      try {
        zm = ZMachine.load(story, io)
      } catch (err) {
        throw formatEngineError(err)
      }

      const staticBase = Math.min(
        decoded.staticBase,
        zm.header.staticMemoryBase,
        decoded.dynamic.byteLength,
      )
      for (let i = 0; i < staticBase; i++) {
        zm.memory.writeByte(i, decoded.dynamic[i]!)
      }
      zm.stack.deserialize(decoded.stack)
      ;(zm as unknown as { _pc: number })._pc = decoded.pc

      startRun(zm, io, bootGen)
      try {
        // Restores land mid-turn at a line prompt — do not auto-skip.
        return await settleAfterInput({ autoSkipCharPrompts: false })
      } catch (err) {
        throw formatEngineError(err)
      }
    },

    getSnapshot(): TurnSnapshot {
      return lastSnapshot
    },
  }
}
