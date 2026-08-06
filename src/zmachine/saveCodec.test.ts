import { describe, it, expect } from 'vitest'
import {
  decodeSaveBlob,
  encodeIwz2,
  encodeJsonArrayBuffer,
  SAVE_MAGIC_IWZ1,
} from './saveCodec'

describe('saveCodec', () => {
  it('roundtrips IWZ2 binary without embedding story', () => {
    const dynamic = new Uint8Array([1, 2, 3, 4, 5])
    const stack = { data: [10, 20], framePointers: [0] }
    const blob = encodeIwz2({
      pc: 0x1234,
      staticBase: 100,
      dynamic,
      stack,
    })
    const decoded = decodeSaveBlob(blob)
    expect(decoded.format).toBe('IWZ2')
    expect(decoded.pc).toBe(0x1234)
    expect(decoded.staticBase).toBe(100)
    expect(Array.from(decoded.dynamic)).toEqual([1, 2, 3, 4, 5])
    expect(decoded.stack).toEqual(stack)
    expect(decoded.storyBytes).toBeUndefined()
  })

  it('reads legacy IWZ1 JSON including padded ArrayBuffer', () => {
    const payload = {
      magic: SAVE_MAGIC_IWZ1,
      pc: 99,
      staticBase: 4,
      dynamic: [9, 8, 7, 6],
      stack: { data: [1], framePointers: [0] },
      storyBytes: [4, 0, 0, 1],
    }
    const tight = encodeJsonArrayBuffer(payload)
    // Simulate old bug: oversized buffer with trailing nulls
    const padded = new Uint8Array(tight.byteLength + 8)
    padded.set(new Uint8Array(tight))
    const decoded = decodeSaveBlob(padded.buffer)
    expect(decoded.format).toBe('IWZ1')
    expect(decoded.pc).toBe(99)
    expect(Array.from(decoded.dynamic)).toEqual([9, 8, 7, 6])
    expect(decoded.storyBytes).toBeDefined()
  })
})
