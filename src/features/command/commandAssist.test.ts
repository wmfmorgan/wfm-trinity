import { describe, it, expect } from 'vitest'
import {
  emptyAssist,
  pushHistory,
  historyUp,
  historyDown,
  autocomplete,
} from './commandAssist'

describe('emptyAssist', () => {
  it('starts with empty history and draft at "editing new" index', () => {
    expect(emptyAssist()).toEqual({
      history: [],
      historyIndex: 0,
      draft: '',
    })
  })
})

describe('pushHistory', () => {
  it('appends non-empty lines and resets index to editing new', () => {
    let s = emptyAssist()
    s = pushHistory(s, 'look')
    expect(s.history).toEqual(['look'])
    expect(s.historyIndex).toBe(1)
    expect(s.draft).toBe('')

    s = pushHistory(s, 'take lamp')
    expect(s.history).toEqual(['look', 'take lamp'])
    expect(s.historyIndex).toBe(2)
  })

  it('ignores empty and whitespace-only lines', () => {
    let s = emptyAssist()
    s = pushHistory(s, '')
    s = pushHistory(s, '   ')
    s = pushHistory(s, '\t')
    expect(s.history).toEqual([])
    expect(s.historyIndex).toBe(0)
  })

  it('does not push consecutive duplicates', () => {
    let s = emptyAssist()
    s = pushHistory(s, 'north')
    s = pushHistory(s, 'north')
    expect(s.history).toEqual(['north'])
    expect(s.historyIndex).toBe(1)
  })

  it('allows non-consecutive duplicates', () => {
    let s = emptyAssist()
    s = pushHistory(s, 'north')
    s = pushHistory(s, 'look')
    s = pushHistory(s, 'north')
    expect(s.history).toEqual(['north', 'look', 'north'])
  })

  it('trims whitespace when storing', () => {
    let s = emptyAssist()
    s = pushHistory(s, '  look  ')
    expect(s.history).toEqual(['look'])
  })
})

describe('historyUp / historyDown', () => {
  function withHistory(...lines: string[]) {
    let s = emptyAssist()
    for (const line of lines) s = pushHistory(s, line)
    return s
  }

  it('↑ moves index back and sets draft to that entry', () => {
    let s = withHistory('a', 'b', 'c')
    expect(s.historyIndex).toBe(3)

    s = historyUp(s)
    expect(s.historyIndex).toBe(2)
    expect(s.draft).toBe('c')

    s = historyUp(s)
    expect(s.historyIndex).toBe(1)
    expect(s.draft).toBe('b')

    s = historyUp(s)
    expect(s.historyIndex).toBe(0)
    expect(s.draft).toBe('a')
  })

  it('↑ at oldest entry is a no-op', () => {
    let s = withHistory('only')
    s = historyUp(s)
    expect(s.historyIndex).toBe(0)
    expect(s.draft).toBe('only')
    const again = historyUp(s)
    expect(again).toEqual(s)
  })

  it('↑ with empty history is a no-op', () => {
    const s = emptyAssist()
    expect(historyUp(s)).toEqual(s)
  })

  it('↓ moves index forward through history', () => {
    let s = withHistory('a', 'b', 'c')
    s = historyUp(s)
    s = historyUp(s)
    expect(s.draft).toBe('b')

    s = historyDown(s)
    expect(s.historyIndex).toBe(2)
    expect(s.draft).toBe('c')
  })

  it('↓ from last entry returns to editing new with empty draft', () => {
    let s = withHistory('a', 'b')
    s = historyUp(s)
    expect(s.historyIndex).toBe(1)
    expect(s.draft).toBe('b')

    s = historyDown(s)
    expect(s.historyIndex).toBe(2)
    expect(s.draft).toBe('')
  })

  it('↓ when already editing new is a no-op', () => {
    let s = withHistory('a')
    expect(s.historyIndex).toBe(1)
    const again = historyDown(s)
    expect(again).toEqual(s)
  })
})

describe('autocomplete', () => {
  const candidates = ['look', 'lamp', 'lantern', 'take', 'sword']

  it('completes last token with case-insensitive prefix', () => {
    const r = autocomplete('take la', candidates)
    expect(r.matches).toEqual(['lamp', 'lantern'])
    expect(r.completed).toBe('take lamp')
  })

  it('matches full input as single token', () => {
    const r = autocomplete('lo', candidates)
    expect(r.matches).toEqual(['look'])
    expect(r.completed).toBe('look')
  })

  it('is case-insensitive on input prefix', () => {
    const r = autocomplete('TAKE LA', candidates)
    expect(r.matches).toEqual(['lamp', 'lantern'])
    expect(r.completed).toBe('TAKE lamp')
  })

  it('returns input unchanged when no matches', () => {
    const r = autocomplete('take xyz', candidates)
    expect(r.matches).toEqual([])
    expect(r.completed).toBe('take xyz')
  })

  it('matches all candidates when last token is empty after space', () => {
    const r = autocomplete('take ', ['lamp', 'sword'])
    expect(r.matches).toEqual(['lamp', 'sword'])
    expect(r.completed).toBe('take lamp')
  })

  it('supports Tab cycling by caller rotating candidates', () => {
    const first = autocomplete('la', ['lamp', 'lantern'])
    expect(first.completed).toBe('lamp')
    expect(first.matches).toEqual(['lamp', 'lantern'])

    // Caller rotates so next match is preferred first among filtered set
    const second = autocomplete('la', ['lantern', 'lamp'])
    expect(second.completed).toBe('lantern')
    expect(second.matches).toEqual(['lantern', 'lamp'])
  })

  it('preserves leading whitespace before last token', () => {
    const r = autocomplete('  take la', ['lamp'])
    expect(r.completed).toBe('  take lamp')
  })
})
