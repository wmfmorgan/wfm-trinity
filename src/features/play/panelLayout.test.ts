import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MAP_SHARE,
  MAX_MAP_SHARE,
  MIN_MAP_SHARE,
  MIN_RAIL_WIDTH_PX,
  MAX_RAIL_WIDTH_PX,
} from './panelLayout'

describe('panelLayout bounds', () => {
  it('exports sensible clamp ranges', () => {
    expect(MIN_MAP_SHARE).toBeLessThan(DEFAULT_MAP_SHARE)
    expect(DEFAULT_MAP_SHARE).toBeLessThan(MAX_MAP_SHARE)
    expect(MIN_RAIL_WIDTH_PX).toBeLessThan(MAX_RAIL_WIDTH_PX)
  })
})
