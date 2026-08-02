import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type UIEvent,
} from 'react'
import {
  autocomplete,
  emptyAssist,
  historyDown,
  historyUp,
  pushHistory,
  type CommandAssistState,
} from '../command/commandAssist'
import styles from './Terminal.module.css'

export interface TerminalProps {
  transcript: string
  disabled?: boolean
  onSubmit: (line: string) => void
  candidates: string[]
  /** When set (with a new insertId), appends to draft then notifies onInsertApplied. */
  insertText?: string | null
  /** Monotonic id from playStore so Strict Mode remount does not double-insert. */
  insertId?: number
  onInsertApplied?: () => void
}

/** Append object/word to the command draft, spacing as needed. */
export function applyInsertText(draft: string, text: string): string {
  const t = text.trim()
  if (!t) return draft
  if (!draft) return t
  if (draft.endsWith(' ')) return draft + t
  return `${draft} ${t}`
}

/**
 * Module-level insert bookkeeping survives Strict Mode remount so we can
 * re-seed draft after remount without double-appending on the same mount.
 */
let lastConsumedInsertId = 0
let lastInsertResultDraft: string | null = null

interface AcCycle {
  linePrefix: string
  matches: string[]
  index: number
}

function linePrefixOf(input: string): string {
  const lastSpace = input.lastIndexOf(' ')
  return lastSpace === -1 ? '' : input.slice(0, lastSpace + 1)
}

export function Terminal({
  transcript,
  disabled = false,
  onSubmit,
  candidates,
  insertText = null,
  insertId = 0,
  onInsertApplied,
}: TerminalProps) {
  const [assist, setAssist] = useState<CommandAssistState>(() => {
    // Remount after insert: seed draft from last applied result.
    if (
      insertText &&
      insertId > 0 &&
      insertId === lastConsumedInsertId &&
      lastInsertResultDraft != null
    ) {
      return { ...emptyAssist(), draft: lastInsertResultDraft }
    }
    return emptyAssist()
  })
  const [acMatches, setAcMatches] = useState<string[]>([])
  const [acActiveIndex, setAcActiveIndex] = useState(0)

  const scrollRef = useRef<HTMLPreElement>(null)
  const userScrolledUp = useRef(false)
  const acCycleRef = useRef<AcCycle | null>(null)
  const onInsertAppliedRef = useRef(onInsertApplied)
  onInsertAppliedRef.current = onInsertApplied

  useEffect(() => {
    const el = scrollRef.current
    if (!el || userScrolledUp.current) return
    el.scrollTop = el.scrollHeight
  }, [transcript])

  // Consume external insert (inventory click → draft)
  useEffect(() => {
    if (insertText == null || insertText === '' || insertId <= 0) return
    if (insertId === lastConsumedInsertId) {
      // Already applied (Strict Mode remount) — restore draft + clear parent.
      const restored = lastInsertResultDraft
      if (restored != null) {
        setAssist((s) =>
          s.draft === restored ? s : { ...s, draft: restored },
        )
      }
      onInsertAppliedRef.current?.()
      return
    }
    lastConsumedInsertId = insertId
    setAssist((s) => {
      const draft = applyInsertText(s.draft, insertText)
      lastInsertResultDraft = draft
      return { ...s, draft }
    })
    acCycleRef.current = null
    setAcMatches([])
    setAcActiveIndex(0)
    onInsertAppliedRef.current?.()
  }, [insertText, insertId])

  const handleScroll = useCallback((e: UIEvent<HTMLPreElement>) => {
    const el = e.currentTarget
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight
    userScrolledUp.current = distanceFromBottom > 24
  }, [])

  function setDraft(draft: string) {
    setAssist((s) => ({ ...s, draft }))
  }

  function clearAutocomplete() {
    acCycleRef.current = null
    setAcMatches([])
    setAcActiveIndex(0)
  }

  function submitLine(raw: string) {
    const line = raw.trim()
    if (!line || disabled) return
    onSubmit(line)
    setAssist((s) => pushHistory(s, line))
    clearAutocomplete()
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    submitLine(assist.draft)
  }

  function handleTab() {
    if (disabled) return

    const draft = assist.draft
    const cycle = acCycleRef.current

    if (
      cycle &&
      cycle.matches.length > 0 &&
      draft === cycle.linePrefix + cycle.matches[cycle.index]
    ) {
      const nextIndex = (cycle.index + 1) % cycle.matches.length
      const next: AcCycle = { ...cycle, index: nextIndex }
      acCycleRef.current = next
      setDraft(next.linePrefix + next.matches[nextIndex])
      setAcMatches(next.matches)
      setAcActiveIndex(nextIndex)
      return
    }

    const { completed, matches } = autocomplete(draft, candidates)
    if (matches.length === 0) {
      clearAutocomplete()
      return
    }

    const linePrefix = linePrefixOf(draft)
    const next: AcCycle = { linePrefix, matches, index: 0 }
    acCycleRef.current = next
    setDraft(completed)
    setAcMatches(matches)
    setAcActiveIndex(0)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Tab') {
      e.preventDefault()
      handleTab()
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      clearAutocomplete()
      setAssist((s) => historyUp(s))
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      clearAutocomplete()
      setAssist((s) => historyDown(s))
      return
    }

    if (e.key === 'Escape') {
      clearAutocomplete()
      return
    }

    if (e.key === 'Enter') {
      // form onSubmit handles; clear cycle
      return
    }
  }

  return (
    <div className={styles.bezel} data-testid="terminal">
      <div className={styles.scanlines} aria-hidden="true" />
      <div className={styles.inner}>
        <pre
          ref={scrollRef}
          className={styles.transcript}
          onScroll={handleScroll}
          tabIndex={0}
          aria-label="Game transcript"
        >
          {transcript}
        </pre>

        <form className={styles.promptRow} onSubmit={handleSubmit}>
          <span className={styles.prompt} aria-hidden="true">
            &gt;
          </span>
          <div className={styles.inputWrap}>
            <input
              id="command-input"
              className={styles.input}
              type="text"
              role="textbox"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={disabled}
              value={assist.draft}
              aria-label="Command"
              aria-autocomplete="list"
              aria-controls={acMatches.length > 0 ? 'command-candidates' : undefined}
              aria-activedescendant={
                acMatches.length > 0
                  ? `command-candidate-${acActiveIndex}`
                  : undefined
              }
              onChange={(e) => {
                clearAutocomplete()
                setDraft(e.target.value)
              }}
              onKeyDown={handleKeyDown}
            />
            {acMatches.length > 0 && (
              <ul
                id="command-candidates"
                className={styles.candidates}
                role="listbox"
                aria-label="Autocomplete candidates"
              >
                {acMatches.map((m, i) => (
                  <li
                    key={m}
                    id={`command-candidate-${i}`}
                    role="option"
                    aria-selected={i === acActiveIndex}
                    className={
                      i === acActiveIndex
                        ? styles.candidateActive
                        : styles.candidate
                    }
                  >
                    {m}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
