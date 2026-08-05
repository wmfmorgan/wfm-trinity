import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  headerFileLengthBytes,
  looksLikeBlorb,
  validateStoryBytes,
  StoryValidationError,
} from './storyValidate'

const storyPath = process.env.STORY_FILE
const itor = storyPath ? it : it.skip

describe('storyValidate', () => {
  it('rejects empty / tiny buffers', () => {
    expect(() => validateStoryBytes(new Uint8Array(10))).toThrow(
      StoryValidationError,
    )
  })

  it('rejects Blorb FORM/IFRS containers', () => {
    const buf = new Uint8Array(64)
    // FORM....IFRS
    buf[0] = 0x46
    buf[1] = 0x4f
    buf[2] = 0x52
    buf[3] = 0x4d
    buf[8] = 0x49
    buf[9] = 0x46
    buf[10] = 0x52
    buf[11] = 0x53
    expect(looksLikeBlorb(buf)).toBe(true)
    expect(() => validateStoryBytes(buf)).toThrow(/Blorb/i)
  })

  it('rejects ZIP signatures', () => {
    const buf = new Uint8Array(64)
    buf[0] = 0x50
    buf[1] = 0x4b
    buf[2] = 0x03
    buf[3] = 0x04
    expect(() => validateStoryBytes(buf)).toThrow(/ZIP/i)
  })

  it('rejects truncated stories (header length > file size)', () => {
    const buf = new Uint8Array(128)
    buf[0] = 3 // V3
    // static base
    buf[14] = 0
    buf[15] = 64
    // initial PC
    buf[6] = 0
    buf[7] = 64
    // file length word = 10000 → 20000 bytes claimed for V3
    buf[26] = 0x27
    buf[27] = 0x10
    expect(headerFileLengthBytes(buf)).toBe(0x2710 * 2)
    expect(() => validateStoryBytes(buf)).toThrow(/truncated/i)
  })

  itor('accepts a real Mini-Zork / story file', () => {
    const buf = readFileSync(storyPath!)
    const data = new Uint8Array(
      buf.buffer,
      buf.byteOffset,
      buf.byteLength,
    )
    const info = validateStoryBytes(data)
    expect(info.version).toBeGreaterThanOrEqual(3)
    expect(info.actualLength).toBe(data.byteLength)
  })
})
