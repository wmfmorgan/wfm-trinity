import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
      openGame: vi.fn(async () => {}),
      submit: vi.fn(async () => {}),
      returnToLibrary: vi.fn(),
      selectMapRoom: vi.fn(),
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
      openGame: originalPlay.openGame,
      submit: originalPlay.submit,
      returnToLibrary: originalPlay.returnToLibrary,
      selectMapRoom: originalPlay.selectMapRoom,
      clearError: originalPlay.clearError,
    })
  })

  it('renders library when playStore.screen is library', () => {
    render(<App />)
    expect(screen.getByText(/infocom workbench/i)).toBeInTheDocument()
    expect(screen.getByTestId('library-screen')).toBeInTheDocument()
  })

  it('shows play placeholder when screen is play', () => {
    usePlayStore.setState({ screen: 'play' })
    render(<App />)
    expect(screen.getByTestId('play-placeholder')).toBeInTheDocument()
  })
})
