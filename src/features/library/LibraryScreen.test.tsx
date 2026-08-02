import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { LibraryGame } from '../../domain/types'
import { LibraryScreen } from './LibraryScreen'
import { monogramFromTitle } from './CoverPlaceholder'
import { useLibraryStore } from './libraryStore'
import { usePlayStore } from '../play/playStore'

const sampleGame: LibraryGame = {
  gameId: 'abc123',
  fileName: 'zork1.z5',
  importedAt: 1_700_000_000_000,
  metadata: { title: 'Zork I' },
  hasCover: false,
}

const originalLibrary = useLibraryStore.getState()
const originalPlay = usePlayStore.getState()

function resetStores() {
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
    returnToLibrary: vi.fn(),
    selectMapRoom: vi.fn(),
    queueInsert: vi.fn(),
    clearPendingInsert: vi.fn(),
    clearError: vi.fn(),
  })
}

describe('monogramFromTitle', () => {
  it('uses first letters of two words', () => {
    expect(monogramFromTitle('Zork I')).toBe('ZI')
  })

  it('uses up to two letters of a single word', () => {
    expect(monogramFromTitle('Trinity')).toBe('TR')
  })

  it('returns ? for empty title', () => {
    expect(monogramFromTitle('   ')).toBe('?')
  })
})

describe('LibraryScreen', () => {
  beforeEach(() => {
    resetStores()
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
      returnToLibrary: originalPlay.returnToLibrary,
      selectMapRoom: originalPlay.selectMapRoom,
      queueInsert: originalPlay.queueInsert,
      clearPendingInsert: originalPlay.clearPendingInsert,
      clearError: originalPlay.clearError,
    })
  })

  it('shows empty library message and import control', async () => {
    render(<LibraryScreen />)

    expect(screen.getByText(/import/i)).toBeInTheDocument()
    expect(screen.getByText(/no games/i)).toBeInTheDocument()
    expect(useLibraryStore.getState().refresh).toHaveBeenCalled()
  })

  it('file input accepts story extensions', () => {
    render(<LibraryScreen />)
    const input = screen.getByLabelText(/import story files/i)
    expect(input).toHaveAttribute(
      'accept',
      '.z3,.z4,.z5,.z6,.z7,.z8,.zblorb,.blorb,application/octet-stream',
    )
  })

  it('imports files when user selects them', async () => {
    const user = userEvent.setup()
    const importFiles = vi.fn(async (_files: FileList | File[]) => {})
    useLibraryStore.setState({ importFiles })

    render(<LibraryScreen />)
    const file = new File(['bytes'], 'advent.z5', {
      type: 'application/octet-stream',
    })
    const input = screen.getByLabelText(/import story files/i)
    await user.upload(input, file)

    expect(importFiles).toHaveBeenCalled()
    const arg = importFiles.mock.calls[0]?.[0] as FileList | File[]
    expect(Array.from(arg)[0]?.name).toBe('advent.z5')
  })

  it('renders game cards with Continue and New', () => {
    useLibraryStore.setState({ games: [sampleGame], loading: false })
    render(<LibraryScreen />)

    expect(screen.getByText('Zork I')).toBeInTheDocument()
    expect(screen.getByText('zork1.z5')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^new$/i })).toBeInTheDocument()
    expect(screen.getByTestId('cover-placeholder')).toHaveTextContent('ZI')
  })

  it('Continue and New call openGame with mode', async () => {
    const user = userEvent.setup()
    const openGame = vi.fn(async () => {})
    useLibraryStore.setState({ games: [sampleGame], loading: false })
    usePlayStore.setState({ openGame })

    render(<LibraryScreen />)

    await user.click(screen.getByRole('button', { name: /^continue$/i }))
    expect(openGame).toHaveBeenCalledWith('abc123', 'continue')

    await user.click(screen.getByRole('button', { name: /^new$/i }))
    expect(openGame).toHaveBeenCalledWith('abc123', 'new')
  })

  it('requires delete confirmation before removeGame', async () => {
    const user = userEvent.setup()
    const removeGame = vi.fn(async () => {})
    useLibraryStore.setState({ games: [sampleGame], loading: false, removeGame })

    render(<LibraryScreen />)

    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(removeGame).not.toHaveBeenCalled()

    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText(/delete game/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/Zork I/)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }))
    expect(removeGame).toHaveBeenCalledWith('abc123')
  })

  it('cancels delete confirm without removing', async () => {
    const user = userEvent.setup()
    const removeGame = vi.fn(async () => {})
    useLibraryStore.setState({ games: [sampleGame], loading: false, removeGame })

    render(<LibraryScreen />)
    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(removeGame).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('edits title metadata', async () => {
    const user = userEvent.setup()
    const updateMeta = vi.fn(async () => {})
    useLibraryStore.setState({ games: [sampleGame], loading: false, updateMeta })

    render(<LibraryScreen />)
    await user.click(screen.getByRole('button', { name: /edit title/i }))

    const input = screen.getByLabelText(/edit title/i)
    await user.clear(input)
    await user.type(input, 'Zork the Great')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(updateMeta).toHaveBeenCalledWith('abc123', {
        title: 'Zork the Great',
      })
    })
  })

  it('shows library or play error banner', () => {
    useLibraryStore.setState({
      games: [],
      loading: false,
      error: 'Import failed',
    })
    render(<LibraryScreen />)
    expect(screen.getByRole('alert')).toHaveTextContent('Import failed')
  })
})
