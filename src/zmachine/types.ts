import type { TurnSnapshot } from '../domain/types'

export interface ZMachineAdapter {
  load(story: ArrayBuffer): Promise<TurnSnapshot>
  submit(line: string): Promise<TurnSnapshot>
  save(): Promise<ArrayBuffer>
  /**
   * Restore engine state from a save blob.
   * @param story Optional library story bytes required for IWZ2 (story not embedded).
   *              Legacy IWZ1 embeds the story and may omit this.
   */
  restore(data: ArrayBuffer, story?: ArrayBuffer): Promise<TurnSnapshot>
  getSnapshot(): TurnSnapshot
}

export type AdapterKind = 'mock' | 'zvm'
