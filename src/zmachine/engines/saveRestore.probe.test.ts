import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { isIwz2Magic } from '../saveCodec'
import { createZvmAdapter } from './zvmAdapter'

const storyPath =
  process.env.STORY_FILE || '/Users/jabroni/infocom/trinity-r12-s860926.z4'
const hasStory = (() => {
  try {
    readFileSync(storyPath)
    return true
  } catch {
    return false
  }
})()
const itor = hasStory ? it : it.skip

function loadStory(): ArrayBuffer {
  const buf = readFileSync(storyPath)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

describe('save/restore probe (real story)', () => {
  itor(
    'IWZ2 save is compact and restores location with library story',
    async () => {
      const story = loadStory()
      const a = createZvmAdapter()
      await a.load(story)
      await a.submit('look')
      const loc = a.getSnapshot().location.name
      const blob = await a.save()
      expect(isIwz2Magic(blob)).toBe(true)
      // Must not re-embed a full 256KB story as JSON (~1MB)
      expect(blob.byteLength).toBeLessThan(200_000)

      await a.submit('north')
      expect(a.getSnapshot().location.name).not.toBe(loc)

      const restored = await a.restore(blob, story)
      expect(restored.waitingFor).toBe('line')
      expect(restored.location.name).toBe(loc)

      const after = await a.submit('look')
      expect(after.waitingFor).toBe('line')
      expect(after.location.name).toBe(loc)
    },
    30_000,
  )
})
