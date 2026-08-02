export interface CommandAssistState {
  history: string[]
  /** `history.length` means "editing new" line */
  historyIndex: number
  draft: string
}

export function emptyAssist(): CommandAssistState {
  return {
    history: [],
    historyIndex: 0,
    draft: '',
  }
}

export function pushHistory(
  state: CommandAssistState,
  line: string,
): CommandAssistState {
  const trimmed = line.trim()
  if (!trimmed) return state

  const last = state.history[state.history.length - 1]
  if (last === trimmed) {
    return {
      ...state,
      historyIndex: state.history.length,
      draft: '',
    }
  }

  const history = [...state.history, trimmed]
  return {
    history,
    historyIndex: history.length,
    draft: '',
  }
}

export function historyUp(state: CommandAssistState): CommandAssistState {
  if (state.history.length === 0 || state.historyIndex <= 0) {
    return state
  }
  const historyIndex = state.historyIndex - 1
  return {
    ...state,
    historyIndex,
    draft: state.history[historyIndex] ?? '',
  }
}

export function historyDown(state: CommandAssistState): CommandAssistState {
  if (state.historyIndex >= state.history.length) {
    return state
  }
  const historyIndex = state.historyIndex + 1
  if (historyIndex >= state.history.length) {
    return {
      ...state,
      historyIndex: state.history.length,
      draft: '',
    }
  }
  return {
    ...state,
    historyIndex,
    draft: state.history[historyIndex] ?? '',
  }
}

/**
 * Complete the last whitespace-separated token against `candidates`
 * (case-insensitive prefix). Caller cycles Tab by reordering candidates
 * so the next preferred match is first among matches.
 */
export function autocomplete(
  input: string,
  candidates: string[],
): { completed: string; matches: string[] } {
  const lastSpace = input.lastIndexOf(' ')
  const prefix = lastSpace === -1 ? '' : input.slice(0, lastSpace + 1)
  const token = lastSpace === -1 ? input : input.slice(lastSpace + 1)
  const lower = token.toLowerCase()

  const matches = candidates.filter((c) =>
    c.toLowerCase().startsWith(lower),
  )

  if (matches.length === 0) {
    return { completed: input, matches }
  }

  return {
    completed: prefix + matches[0],
    matches,
  }
}
