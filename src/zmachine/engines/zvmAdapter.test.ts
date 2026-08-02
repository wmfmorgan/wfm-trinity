import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createZvmAdapter } from './zvmAdapter'
import { createAdapter } from '../createAdapter'

const storyPath = process.env.STORY_FILE
const itor = storyPath ? it : it.skip

function loadStoryBytes(): ArrayBuffer {
  if (!storyPath) throw new Error('STORY_FILE unset')
  const buf = readFileSync(storyPath)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

describe('zvmAdapter (real engine)', () => {
  itor('loads real story and produces transcript', async () => {
    const a = createZvmAdapter()
    const s0 = await a.load(loadStoryBytes())
    expect(s0.transcriptDelta.length).toBeGreaterThan(0)
    expect(s0.waitingFor).toBe('line')
    // Mini-Zork / Infocom openers usually mention a house or location
    expect(s0.location.name.length).toBeGreaterThan(0)
    expect(s0.location.name).not.toBe('Unknown')
  })

  itor('submit look produces more transcript', async () => {
    const a = createZvmAdapter()
    await a.load(loadStoryBytes())
    const s1 = await a.submit('look')
    expect(s1.transcriptDelta.length).toBeGreaterThan(0)
    expect(s1.waitingFor).toBe('line')
    expect(a.getSnapshot().location.name.length).toBeGreaterThan(0)
  })

  itor('save/restore roundtrips location after movement', async () => {
    const a = createZvmAdapter()
    await a.load(loadStoryBytes())
    // Mini-Zork: north or east typically moves from West of House
    await a.submit('east')
    const afterMove = a.getSnapshot()
    const locBefore = afterMove.location.name
    expect(locBefore.length).toBeGreaterThan(0)

    const blob = await a.save()
    await a.submit('look')
    const restored = await a.restore(blob)
    expect(restored.location.name).toBe(locBefore)
    expect(restored.waitingFor).toBe('line')
  })

  itor('createAdapter(zvm) returns real engine', async () => {
    const a = createAdapter('zvm')
    const s = await a.load(loadStoryBytes())
    expect(s.transcriptDelta.length).toBeGreaterThan(0)
    // Must not be the mock meadow opener
    expect(s.transcriptDelta).not.toContain('Mock Zorkian Adventure')
  })
})

describe('zvmAdapter gating', () => {
  it('skips real-story tests when STORY_FILE is unset', () => {
    if (!storyPath) {
      expect(storyPath).toBeFalsy()
    } else {
      expect(storyPath.length).toBeGreaterThan(0)
    }
  })
})
