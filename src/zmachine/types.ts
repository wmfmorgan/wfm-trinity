import type { TurnSnapshot } from '../domain/types'

export interface ZMachineAdapter {
  load(story: ArrayBuffer): Promise<TurnSnapshot>
  submit(line: string): Promise<TurnSnapshot>
  save(): Promise<ArrayBuffer>
  restore(data: ArrayBuffer): Promise<TurnSnapshot>
  getSnapshot(): TurnSnapshot
}

export type AdapterKind = 'mock' | 'zvm'
