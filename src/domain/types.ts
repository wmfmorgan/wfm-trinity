export type Direction =
  | 'north'
  | 'south'
  | 'east'
  | 'west'
  | 'northeast'
  | 'northwest'
  | 'southeast'
  | 'southwest'
  | 'up'
  | 'down'
  | 'in'
  | 'out'

export interface InventoryItem {
  id: string
  name: string
}

export interface ExitInfo {
  dir: Direction
  label?: string
  toId?: string
}

export interface StatusInfo {
  score?: number
  moves?: number
  hours?: number
  minutes?: number
  locationName?: string
}

export type WaitingFor = 'line' | 'char' | 'finished'

export interface TurnSnapshot {
  transcriptDelta: string
  location: { id: string; name: string }
  inventory: InventoryItem[]
  exits: ExitInfo[]
  status: StatusInfo
  waitingFor: WaitingFor
}

export interface RoomNode {
  id: string
  name: string
  firstVisitTurn: number
  lastVisitTurn: number
  x: number
  y: number
}

export interface MapEdge {
  fromId: string
  toId: string
  dir: Direction | null
  bidirectional: boolean
}

export interface MapGraphState {
  gameId: string
  nodes: Record<string, RoomNode>
  edges: MapEdge[]
}

export interface GameMetadata {
  title: string
  author?: string
  year?: string
  ifid?: string
  series?: string
  notes?: string
}

export interface LibraryGame {
  gameId: string
  fileName: string
  importedAt: number
  lastPlayedAt?: number
  metadata: GameMetadata
  hasCover: boolean
}

export interface SaveSlotMeta {
  gameId: string
  /** 'autosave' | 'autosave-1'.. or user id */
  slotId: string
  name: string
  updatedAt: number
  locationName?: string
}
