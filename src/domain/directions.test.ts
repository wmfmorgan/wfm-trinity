import { describe, it, expect } from 'vitest'
import { reverseDir, deltaForDir, commandForDir } from './directions'

describe('directions', () => {
  it('reverses cardinals', () => {
    expect(reverseDir('north')).toBe('south')
    expect(reverseDir('up')).toBe('down')
    expect(reverseDir('in')).toBe('out')
  })

  it('delta places north at -y', () => {
    expect(deltaForDir('north')).toEqual({ dx: 0, dy: -1 })
    expect(deltaForDir('east')).toEqual({ dx: 1, dy: 0 })
  })

  it('command is lowercase word', () => {
    expect(commandForDir('northwest')).toBe('northwest')
  })
})
