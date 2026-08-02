import { describe, it, expect } from 'vitest'
import { hashStoryBytes } from './gameId'

describe('hashStoryBytes', () => {
  it('hashes deterministically', async () => {
    const a = await hashStoryBytes(new TextEncoder().encode('trinity').buffer)
    const b = await hashStoryBytes(new TextEncoder().encode('trinity').buffer)
    const c = await hashStoryBytes(new TextEncoder().encode('zork').buffer)
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).toMatch(/^[a-f0-9]{64}$/)
  })
})
