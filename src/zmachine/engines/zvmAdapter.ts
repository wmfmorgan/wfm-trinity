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

/** Magic header for workbench-local save blobs (not Quetzal). */
const SAVE_MAGIC = 'IWZ1'

/** Player object short-name heuristics (Infocom / Inform). */
const PLAYER_NAME_RE = /^(you|cretin|yourself|player)$/i

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

  private lineResolve: ((r: ReadLineResult) => void) | null = null
  private charResolve: ((code: number) => void) | null = null
  private waitingNotify: (() => void) | null = null
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
    if (this.lineResolve || this.charResolve) {
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => {
      this.waitingNotify = resolve
    })
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

interface SerializedSave {
  magic: typeof SAVE_MAGIC
  pc: number
  staticBase: number
  dynamic: number[]
  stack: {
    data: number[]
    framePointers: number[]
  }
  storyBytes: number[]
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
function findPlayerObject(zm: ZMachine, locationObj: number): number {
  if (locationObj <= 0) return 0
  const matches: number[] = []
  let child = zm.objectTable.getChild(locationObj)
  while (child) {
    const name = zm.getObjectName(child).trim()
    if (PLAYER_NAME_RE.test(name)) {
      matches.push(child)
    }
    child = zm.objectTable.getSibling(child)
  }
  if (matches.length === 1) return matches[0]!
  if (matches.length > 1) return matches[0]!
  // Fallback: first child of location (often the player in Infocom V3)
  return zm.objectTable.getChild(locationObj) || 0
}

function inventoryOf(zm: ZMachine, playerObj: number): InventoryItem[] {
  if (playerObj <= 0) return []
  const items: InventoryItem[] = []
  let child = zm.objectTable.getChild(playerObj)
  while (child) {
    const name = zm.getObjectName(child).trim() || `object-${child}`
    items.push({ id: String(child), name })
    child = zm.objectTable.getSibling(child)
  }
  return items
}

function buildWorld(zm: ZMachine, io: BridgeIO): {
  location: { id: string; name: string }
  inventory: InventoryItem[]
  exits: ExitInfo[]
  status: TurnSnapshot['status']
} {
  // Global 0 / var 16 = location object (Infocom convention)
  const locationObj = zm.variables.read(16)
  let locationName =
    locationObj > 0 ? zm.getObjectName(locationObj).trim() : ''
  if (!locationName && io.lastStatus?.location) {
    locationName = io.lastStatus.location
  }
  if (!locationName) locationName = 'Unknown'

  const scoreRaw = zm.variables.read(17)
  const movesRaw = zm.variables.read(18)
  const score = signed16(scoreRaw)
  const moves = movesRaw

  const status: TurnSnapshot['status'] = {
    locationName,
  }
  // Time games use hours/minutes in globals 1/2
  const isTime =
    io.lastStatus?.isTime ?? (zm.header.flags1 & 0x02) !== 0
  if (isTime) {
    status.hours = score
    status.minutes = moves
  } else {
    status.score = score
    status.moves = moves
  }

  const playerObj = findPlayerObject(zm, locationObj)
  const inventory = inventoryOf(zm, playerObj)

  // Exits: not reliably available from the object tree without game-specific
  // knowledge; leave empty and let UI map learn from movement (Task 7+).
  const exits: ExitInfo[] = []

  return {
    location: {
      id: locationObj > 0 ? String(locationObj) : 'unknown',
      name: locationName,
    },
    inventory,
    exits,
    status,
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

  async function settleAfterInput(): Promise<TurnSnapshot> {
    const { io: bridge, zm: machine } = assertReady()
    const gen = generation
    await bridge.waitUntilInputRequested()
    if (gen !== generation) {
      // Restored / reloaded while waiting — return current snapshot
      return lastSnapshot
    }
    // Tiny yield so any trailing print after the input request is flushed
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

  function startRun(machine: ZMachine): void {
    void machine.run().catch((err: unknown) => {
      // Abandoning a machine (restore/reload) may leave a rejected run; ignore.
      if (generation === 0) return
      console.error('[zvmAdapter] engine run error', err)
    })
  }

  function bootMachine(data: Uint8Array): void {
    generation += 1
    storyBytes = data.slice()
    io = new BridgeIO()
    zm = ZMachine.load(data, io)
    startRun(zm)
  }

  return {
    async load(story: ArrayBuffer): Promise<TurnSnapshot> {
      const data = new Uint8Array(story)
      if (data.byteLength < 64) {
        throw new Error('Story file too small to be valid Z-code')
      }
      bootMachine(data)
      return settleAfterInput()
    },

    async submit(line: string): Promise<TurnSnapshot> {
      const { io: bridge } = assertReady()
      // Discard any buffered output so transcriptDelta is this turn only
      bridge.takeLowerOutput()
      const kind = bridge.getWaitingKind()
      if (kind === 'char') {
        // For single-char prompts (e.g. "Quit? (Y/N)"), use first character
        const ch = line.trim().charAt(0) || '\n'
        bridge.provideChar(ch === '\n' ? 13 : ch.charCodeAt(0))
      } else {
        bridge.provideLine(line)
      }
      return settleAfterInput()
    },

    async save(): Promise<ArrayBuffer> {
      const { zm: machine } = assertReady()
      if (!storyBytes) throw new Error('No story loaded')
      const staticBase = machine.header.staticMemoryBase
      const dynamic = machine.memory.readBytes(0, staticBase)
      const payload: SerializedSave = {
        magic: SAVE_MAGIC,
        pc: machine.pc,
        staticBase,
        dynamic: Array.from(dynamic),
        stack: machine.stack.serialize(),
        storyBytes: Array.from(storyBytes),
      }
      return new TextEncoder().encode(JSON.stringify(payload)).buffer
    },

    async restore(data: ArrayBuffer): Promise<TurnSnapshot> {
      const json = new TextDecoder().decode(data)
      let payload: SerializedSave
      try {
        payload = JSON.parse(json) as SerializedSave
      } catch {
        throw new Error('Invalid save data')
      }
      if (payload.magic !== SAVE_MAGIC) {
        throw new Error('Unrecognized save format (expected IWZ1)')
      }

      // Build a fresh VM, apply dynamic RAM + stack + PC, then run from the
      // saved PC (typically the mid-turn sread). No intro boot needed.
      generation += 1
      const story = new Uint8Array(payload.storyBytes)
      storyBytes = story.slice()
      io = new BridgeIO()
      zm = ZMachine.load(story, io)

      const staticBase = Math.min(
        payload.staticBase,
        zm.header.staticMemoryBase,
        payload.dynamic.length,
      )
      for (let i = 0; i < staticBase; i++) {
        zm.memory.writeByte(i, payload.dynamic[i]!)
      }
      zm.stack.deserialize(payload.stack)
      ;(zm as unknown as { _pc: number })._pc = payload.pc

      startRun(zm)
      return settleAfterInput()
    },

    getSnapshot(): TurnSnapshot {
      return lastSnapshot
    },
  }
}
