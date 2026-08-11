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

  it('delta stacks up above and down below', () => {
    expect(deltaForDir('up')).toEqual({ dx: 0, dy: -1 })
    expect(deltaForDir('down')).toEqual({ dx: 0, dy: 1 })
  })

  it('delta leaves in/out with no planar offset', () => {
    expect(deltaForDir('in')).toEqual({ dx: 0, dy: 0 })
    expect(deltaForDir('out')).toEqual({ dx: 0, dy: 0 })
  })

  it('command is lowercase word', () => {
    expect(commandForDir('northwest')).toBe('northwest')
  })
})
