import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteDB } from 'idb'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DB_NAME, closeDb } from '../../persistence/db'
import { putGame } from '../../persistence/libraryRepo'
import { hashStoryBytes } from '../../domain/gameId'
import {
  getPlayAdapterKind,
  setPlayAdapterKind,
  usePlayStore,
} from './playStore'
import { PlayWorkbench } from './PlayWorkbench'
import App from '../../App'

async function resetDb() {
  await closeDb()
  await deleteDB(DB_NAME)
}

function resetStore() {
  usePlayStore.setState({
    screen: 'library',
    session: null,
    adapter: null,
    error: null,
    busy: false,
    pendingInsert: null,
    pendingInsertId: 0,
  })
}

async function seedGame(
  contents: string,
  fileName = 'mock-zork.z5',
): Promise<string> {
  const bytes = new TextEncoder().encode(contents).buffer
  const gameId = await hashStoryBytes(bytes)
  await putGame(
    {
      gameId,
      fileName,
      importedAt: Date.now(),
      metadata: { title: 'Mock Zorkian' },
      hasCover: false,
    },
    bytes,
  )
  return gameId
}

describe('PlayWorkbench', () => {
  const previousKind = getPlayAdapterKind()

  beforeEach(async () => {
    await resetDb()
    resetStore()
    setPlayAdapterKind('mock')
  })

  afterEach(() => {
    setPlayAdapterKind(previousKind)
    vi.restoreAllMocks()
  })

  it('open game + type north moves to woods (mock adapter)', async () => {
    const user = userEvent.setup()
    const gameId = await seedGame('workbench-north')
    await usePlayStore.getState().openGame(gameId, 'new')

    expect(usePlayStore.getState().session!.snapshot.location.id).toBe(
      'meadow',
    )

    render(<PlayWorkbench />)

    expect(screen.getByTestId('play-workbench')).toBeInTheDocument()
    expect(screen.getByTestId('terminal')).toBeInTheDocument()
    expect(screen.getByTestId('inventory-panel')).toBeInTheDocument()
    expect(screen.queryByLabelText('Compass')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Map')).toBeInTheDocument()
    expect(screen.getByTestId('feelies-strip')).toBeInTheDocument()

    const input = document.getElementById('command-input') as HTMLInputElement
    await user.type(input, 'north{enter}')

    await waitFor(() => {
      expect(usePlayStore.getState().session!.snapshot.location.id).toBe(
        'woods',
      )
    })

    expect(screen.getByText(/You are in the Woods/i)).toBeInTheDocument()
  })

  it('collapsing inventory marks workbench so layout can reclaim rail width', async () => {
    const user = userEvent.setup()
    const gameId = await seedGame('workbench-inv-collapse')
    await usePlayStore.getState().openGame(gameId, 'new')

    render(<PlayWorkbench />)
    const root = screen.getByTestId('play-workbench')
    expect(root).toHaveAttribute('data-inventory-collapsed', 'false')

    await user.click(screen.getByTestId('inventory-toggle'))
    expect(root).toHaveAttribute('data-inventory-collapsed', 'true')

    await user.click(screen.getByTestId('inventory-toggle'))
    expect(root).toHaveAttribute('data-inventory-collapsed', 'false')
  })

  it('exposes resize handles between inventory, terminal, and map on wide layout', async () => {
    const gameId = await seedGame('workbench-resize')
    await usePlayStore.getState().openGame(gameId, 'new')
    // Force wide breakpoint
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    render(<PlayWorkbench />)
    expect(screen.getByTestId('resize-rail')).toBeInTheDocument()
    expect(screen.getByTestId('resize-map')).toBeInTheDocument()
  })

  it('map room select only updates selectedRoomId (does not walk)', async () => {
    const user = userEvent.setup()
    const gameId = await seedGame('workbench-map-select')
    await usePlayStore.getState().openGame(gameId, 'new')
    await usePlayStore.getState().submit('north')

    const before = usePlayStore.getState().session!
    expect(before.snapshot.location.id).toBe('woods')

    render(<PlayWorkbench />)

    const meadow = screen.getByRole('button', { name: /Room: Meadow/i })
    await user.click(meadow)

    await waitFor(() => {
      const s = usePlayStore.getState().session!
      expect(s.selectedRoomId).toBe('meadow')
      // Still in woods — select is not a walk
      expect(s.snapshot.location.id).toBe('woods')
    })
  })

  it('Escape refocuses the command line when it is not focused', async () => {
    const user = userEvent.setup()
    const gameId = await seedGame('workbench-escape-focus')
    await usePlayStore.getState().openGame(gameId, 'new')

    render(<PlayWorkbench />)

    const input = document.getElementById('command-input') as HTMLInputElement
    expect(input).toBeTruthy()

    // Move focus off the command line (e.g. user clicked the map / transcript)
    const map = screen.getByLabelText('Map')
    map.focus()
    expect(input).not.toHaveFocus()

    await user.keyboard('{Escape}')

    expect(input).toHaveFocus()
  })

  it('Escape does not steal focus while Saves modal is open', async () => {
    const user = userEvent.setup()
    const gameId = await seedGame('workbench-escape-saves')
    await usePlayStore.getState().openGame(gameId, 'new')

    render(<PlayWorkbench />)

    await user.click(screen.getByTestId('saves-button'))
    expect(screen.getByTestId('save-modal')).toBeInTheDocument()

    const input = document.getElementById('command-input') as HTMLInputElement
    input.blur()
    expect(input).not.toHaveFocus()

    await user.keyboard('{Escape}')

    // Listener is disabled while modal is open — command stays unfocused
    expect(input).not.toHaveFocus()
  })

  it('inventory insert queues pendingInsert into terminal draft', async () => {
    const user = userEvent.setup()
    const gameId = await seedGame('workbench-insert')
    await usePlayStore.getState().openGame(gameId, 'new')
    // Put lamp in inventory via mock: go north, take lamp
    await usePlayStore.getState().submit('north')
    await usePlayStore.getState().submit('take lamp')

    render(<PlayWorkbench />)

    const lamp = screen.getByRole('button', { name: 'brass lamp' })
    await user.click(lamp)

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Command' })).toHaveValue(
        'brass lamp',
      )
    })
    expect(usePlayStore.getState().pendingInsert).toBeNull()
    expect(document.getElementById('command-input')).toHaveFocus()
  })

  it('App shows PlayWorkbench when screen is play', async () => {
    const gameId = await seedGame('app-play-screen')
    await usePlayStore.getState().openGame(gameId, 'new')

    render(<App />)
    expect(screen.getByTestId('play-workbench')).toBeInTheDocument()
    expect(screen.queryByTestId('play-placeholder')).not.toBeInTheDocument()
  })

  it('Saves button opens SaveModal', async () => {
    const user = userEvent.setup()
    const gameId = await seedGame('saves-btn')
    await usePlayStore.getState().openGame(gameId, 'new')

    render(<PlayWorkbench />)

    expect(screen.queryByTestId('save-modal')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('saves-button'))
    expect(screen.getByTestId('save-modal')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^saves$/i })).toBeInTheDocument()
  })

  it('pagehide triggers best-effort flushAutosave', async () => {
    const gameId = await seedGame('pagehide-auto')
    await usePlayStore.getState().openGame(gameId, 'new')

    const flushSpy = vi.fn(async () => {})
    usePlayStore.setState({ flushAutosave: flushSpy })

    render(<PlayWorkbench />)

    window.dispatchEvent(new Event('pagehide'))
    expect(flushSpy).toHaveBeenCalled()
  })
})
