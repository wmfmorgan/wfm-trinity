import { createMockAdapter } from './mockAdapter'
import type { AdapterKind, ZMachineAdapter } from './types'

/**
 * Factory for Z-machine adapters.
 * Real `zvm` engine is wired in Task 5; until then both kinds use the mock.
 */
export function createAdapter(kind: AdapterKind = 'mock'): ZMachineAdapter {
  switch (kind) {
    case 'mock':
      return createMockAdapter()
    case 'zvm':
      // Real engine lands in Task 5; fall back to mock for now.
      return createMockAdapter()
    default: {
      const _exhaustive: never = kind
      throw new Error(`Unknown adapter kind: ${_exhaustive}`)
    }
  }
}
