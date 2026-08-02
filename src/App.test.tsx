import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { useLibraryStore } from './features/library/libraryStore'
import { usePlayStore } from './features/play/playStore'

const originalLibrary = useLibraryStore.getState()
const originalPlay = usePlayStore.getState()

describe('App', () => {
  beforeEach(() => {
    useLibraryStore.setState({
      games: [],
      loading: false,
      error: null,
      refresh: vi.fn(async () => {}),
      importFiles: vi.fn(async () => {}),
      removeGame: vi.fn(async () => {}),
      updateMeta: vi.fn(async () => {}),
      setCover: vi.fn(async () => {}),
      clearError: vi.fn(),
    })
    usePlayStore.setState({
      screen: 'library',
      session: null,
      adapter: null,
      error: null,
      pendingInsert: null,
      pendingInsertId: 0,
      openGame: vi.fn(async () => {}),
      submit: vi.fn(async () => {}),
      saveToSlot: vi.fn(async () => {}),
      flushAutosave: vi.fn(async () => {}),
      returnToLibrary: vi.fn(),
      selectMapRoom: vi.fn(),
      queueInsert: vi.fn(),
      clearPendingInsert: vi.fn(),
      clearError: vi.fn(),
    })
  })

  afterEach(() => {
    useLibraryStore.setState({
      games: originalLibrary.games,
      loading: originalLibrary.loading,
      error: originalLibrary.error,
      refresh: originalLibrary.refresh,
      importFiles: originalLibrary.importFiles,
      removeGame: originalLibrary.removeGame,
      updateMeta: originalLibrary.updateMeta,
      setCover: originalLibrary.setCover,
      clearError: originalLibrary.clearError,
    })
    usePlayStore.setState({
      screen: originalPlay.screen,
      session: originalPlay.session,
      adapter: originalPlay.adapter,
      error: originalPlay.error,
      pendingInsert: originalPlay.pendingInsert,
      pendingInsertId: originalPlay.pendingInsertId,
      openGame: originalPlay.openGame,
      submit: originalPlay.submit,
      saveToSlot: originalPlay.saveToSlot,
      flushAutosave: originalPlay.flushAutosave,
      returnToLibrary: originalPlay.returnToLibrary,
      selectMapRoom: originalPlay.selectMapRoom,
      queueInsert: originalPlay.queueInsert,
      clearPendingInsert: originalPlay.clearPendingInsert,
      clearError: originalPlay.clearError,
    })
  })

  it('renders library when playStore.screen is library', () => {
    render(<App />)
    expect(screen.getByText(/infocom workbench/i)).toBeInTheDocument()
    expect(screen.getByTestId('library-screen')).toBeInTheDocument()
  })

  it('shows PlayWorkbench when screen is play', () => {
    usePlayStore.setState({ screen: 'play', session: null })
    render(<App />)
    expect(screen.getByTestId('play-workbench')).toBeInTheDocument()
    expect(screen.queryByTestId('play-placeholder')).not.toBeInTheDocument()
  })

  it('surfaces libraryStore.error in ErrorBanner with dismiss', async () => {
    const user = userEvent.setup()
    const clearError = vi.fn()
    useLibraryStore.setState({
      error: 'Import failed: empty file',
      clearError,
    })
    render(<App />)
    expect(screen.getByTestId('error-banner')).toHaveTextContent(
      'Import failed: empty file',
    )
    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(clearError).toHaveBeenCalled()
  })

  it('surfaces playStore.error with Return to library on play screen', async () => {
    const user = userEvent.setup()
    const returnToLibrary = vi.fn()
    usePlayStore.setState({
      screen: 'play',
      session: null,
      error: 'Interpreter error: boom',
      returnToLibrary,
    })
    render(<App />)
    expect(screen.getByTestId('error-banner')).toHaveTextContent(
      'Interpreter error: boom',
    )
    await user.click(
      screen.getByRole('button', { name: /return to library/i }),
    )
    expect(returnToLibrary).toHaveBeenCalled()
  })
})
