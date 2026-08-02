import { createMockAdapter } from './mockAdapter'
import { createZvmAdapter } from './engines/zvmAdapter'
import type { AdapterKind, ZMachineAdapter } from './types'

/**
 * Factory for Z-machine adapters.
 * - `mock`: deterministic in-memory engine for tests/UI without story files
 * - `zvm`: real engine via the `zmachine` package
 */
export function createAdapter(kind: AdapterKind = 'mock'): ZMachineAdapter {
  switch (kind) {
    case 'mock':
      return createMockAdapter()
    case 'zvm':
      return createZvmAdapter()
    default: {
      const _exhaustive: never = kind
      throw new Error(`Unknown adapter kind: ${_exhaustive}`)
    }
  }
}
