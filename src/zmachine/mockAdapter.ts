import type { ExitInfo, InventoryItem, TurnSnapshot } from '../domain/types'
import type { ZMachineAdapter } from './types'

type RoomId = 'meadow' | 'woods'

interface RoomDef {
  id: RoomId
  name: string
  description: string
  exits: ExitInfo[]
  items: InventoryItem[]
}

interface MockState {
  locationId: RoomId
  inventory: InventoryItem[]
  roomItems: Record<RoomId, InventoryItem[]>
  score: number
  moves: number
  lastSnapshot: TurnSnapshot
}

const ROOMS: Record<RoomId, Omit<RoomDef, 'items'>> = {
  meadow: {
    id: 'meadow',
    name: 'Meadow',
    description: 'You are in the Meadow. A path leads north into the Woods.',
    exits: [{ dir: 'north', toId: 'woods', label: 'north' }],
  },
  woods: {
    id: 'woods',
    name: 'Woods',
    description:
      'You are in the Woods. Sunlight filters through the canopy. A path leads south to the Meadow.',
    exits: [{ dir: 'south', toId: 'meadow', label: 'south' }],
  },
}

const LAMP: InventoryItem = { id: 'lamp', name: 'brass lamp' }

function emptySnapshot(): TurnSnapshot {
  return {
    transcriptDelta: '',
    location: { id: 'meadow', name: 'Meadow' },
    inventory: [],
    exits: [],
    status: { score: 0, moves: 0 },
    waitingFor: 'line',
  }
}

function snapshotFrom(
  state: MockState,
  transcriptDelta: string,
): TurnSnapshot {
  const room = ROOMS[state.locationId]
  return {
    transcriptDelta,
    location: { id: room.id, name: room.name },
    inventory: state.inventory.map((i) => ({ ...i })),
    exits: room.exits.map((e) => ({ ...e })),
    status: {
      score: state.score,
      moves: state.moves,
      locationName: room.name,
    },
    waitingFor: 'line',
  }
}

function encodeState(state: MockState): ArrayBuffer {
  const payload = {
    locationId: state.locationId,
    inventory: state.inventory,
    roomItems: state.roomItems,
    score: state.score,
    moves: state.moves,
  }
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  )
}

function decodeState(data: ArrayBuffer): Omit<MockState, 'lastSnapshot'> {
  const bytes = new Uint8Array(data)
  let end = bytes.byteLength
  while (end > 0 && bytes[end - 1] === 0) end--
  const json = new TextDecoder().decode(bytes.subarray(0, end))
  const parsed = JSON.parse(json) as {
    locationId: RoomId
    inventory: InventoryItem[]
    roomItems: Record<RoomId, InventoryItem[]>
    score: number
    moves: number
  }
  return {
    locationId: parsed.locationId,
    inventory: parsed.inventory ?? [],
    roomItems: parsed.roomItems ?? { meadow: [], woods: [LAMP] },
    score: parsed.score ?? 0,
    moves: parsed.moves ?? 0,
  }
}

function normalize(line: string): string {
  return line.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function createMockAdapter(): ZMachineAdapter {
  let state: MockState = {
    locationId: 'meadow',
    inventory: [],
    roomItems: { meadow: [], woods: [{ ...LAMP }] },
    score: 0,
    moves: 0,
    lastSnapshot: emptySnapshot(),
  }

  function commit(transcriptDelta: string): TurnSnapshot {
    const snap = snapshotFrom(state, transcriptDelta)
    state.lastSnapshot = snap
    return snap
  }

  function tryMove(dir: string): TurnSnapshot | null {
    const room = ROOMS[state.locationId]
    const exit = room.exits.find((e) => e.dir === dir)
    if (!exit?.toId) return null
    const dest = exit.toId as RoomId
    if (!(dest in ROOMS)) return null
    state.locationId = dest
    state.moves += 1
    const destRoom = ROOMS[dest]
    return commit(`${destRoom.description}\n>`)
  }

  return {
    async load(_story: ArrayBuffer): Promise<TurnSnapshot> {
      state = {
        locationId: 'meadow',
        inventory: [],
        roomItems: { meadow: [], woods: [{ ...LAMP }] },
        score: 0,
        moves: 0,
        lastSnapshot: emptySnapshot(),
      }
      return commit(
        'Mock Zorkian Adventure\nYou are in the Meadow.\n>',
      )
    },

    async submit(line: string): Promise<TurnSnapshot> {
      const cmd = normalize(line)
      if (!cmd) {
        return commit('>')
      }

      // Movement
      const dirs = [
        'north',
        'south',
        'east',
        'west',
        'northeast',
        'northwest',
        'southeast',
        'southwest',
        'up',
        'down',
        'in',
        'out',
      ] as const
      if ((dirs as readonly string[]).includes(cmd)) {
        const moved = tryMove(cmd)
        if (moved) return moved
        return commit("You can't go that way.\n>")
      }

      if (cmd === 'look' || cmd === 'l') {
        const room = ROOMS[state.locationId]
        const here = state.roomItems[state.locationId]
        const itemText =
          here.length > 0
            ? `\nYou can see: ${here.map((i) => i.name).join(', ')}.`
            : ''
        return commit(`${room.description}${itemText}\n>`)
      }

      if (cmd === 'inventory' || cmd === 'i' || cmd === 'inv') {
        if (state.inventory.length === 0) {
          return commit('You are empty-handed.\n>')
        }
        const list = state.inventory.map((i) => i.name).join(', ')
        return commit(`You are carrying: ${list}.\n>`)
      }

      if (cmd === 'take lamp' || cmd === 'get lamp' || cmd === 'take brass lamp') {
        const here = state.roomItems[state.locationId]
        const idx = here.findIndex((i) => i.id === 'lamp')
        if (idx === -1) {
          if (state.inventory.some((i) => i.id === 'lamp')) {
            return commit('You already have the brass lamp.\n>')
          }
          return commit("You don't see that here.\n>")
        }
        const [item] = here.splice(idx, 1)
        state.inventory.push(item)
        state.moves += 1
        return commit('Taken.\n>')
      }

      state.moves += 1
      return commit("I don't understand that.\n>")
    },

    async save(): Promise<ArrayBuffer> {
      return encodeState(state)
    },

    async restore(data: ArrayBuffer, _story?: ArrayBuffer): Promise<TurnSnapshot> {
      const restored = decodeState(data)
      state = {
        ...restored,
        inventory: restored.inventory.map((i) => ({ ...i })),
        roomItems: {
          meadow: (restored.roomItems.meadow ?? []).map((i) => ({ ...i })),
          woods: (restored.roomItems.woods ?? []).map((i) => ({ ...i })),
        },
        lastSnapshot: emptySnapshot(),
      }
      const room = ROOMS[state.locationId]
      return commit(`[Restored]\n${room.description}\n>`)
    },

    getSnapshot(): TurnSnapshot {
      return state.lastSnapshot
    },
  }
}
