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
    pendingInsert: null,
    pendingInsertId: 0,
  })
}

async function seedGame(contents: string): Promise<string> {
  const bytes = new TextEncoder().encode(contents).buffer
  const gameId = await hashStoryBytes(bytes)
  await putGame(
    {
      gameId,
      fileName: 'mock-zork.z5',
      importedAt: Date.now(),
      metadata: { title: 'Responsive Mock' },
      hasCover: false,
    },
    bytes,
  )
  return gameId
}

/** Mock matchMedia so max-width queries match when viewport ≤ width. */
function mockMatchMedia(viewportWidth: number) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    const max = query.match(/max-width:\s*(\d+)px/)
    const min = query.match(/min-width:\s*(\d+)px/)
    let matches = false
    if (max) matches = viewportWidth <= Number(max[1])
    if (min) matches = viewportWidth >= Number(min[1])
    return {
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }
  })
}

describe('PlayWorkbench responsive tabs', () => {
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

  it('wide layout: no tab strip; all panes present', async () => {
    mockMatchMedia(1280)
    const gameId = await seedGame('responsive-wide')
    await usePlayStore.getState().openGame(gameId, 'new')

    render(<PlayWorkbench />)

    const root = screen.getByTestId('play-workbench')
    expect(root).toHaveAttribute('data-breakpoint', 'wide')
    expect(screen.queryByTestId('workbench-tabs-medium')).not.toBeInTheDocument()
    expect(screen.queryByTestId('workbench-tabs-narrow')).not.toBeInTheDocument()
    expect(screen.getByTestId('workbench-left')).not.toHaveClass(/paneHidden/)
    expect(screen.getByTestId('workbench-terminal')).not.toHaveClass(/paneHidden/)
    expect(screen.getByTestId('workbench-map')).not.toHaveClass(/paneHidden/)
    expect(screen.getByTestId('workbench-feelies')).not.toHaveClass(/paneHidden/)
  })

  it('medium (≤1100): Play|Map tabs; map hidden until Map selected', async () => {
    mockMatchMedia(900)
    const user = userEvent.setup()
    const gameId = await seedGame('responsive-medium')
    await usePlayStore.getState().openGame(gameId, 'new')

    render(<PlayWorkbench />)

    const root = screen.getByTestId('play-workbench')
    expect(root).toHaveAttribute('data-breakpoint', 'medium')
    expect(screen.getByTestId('workbench-tabs-medium')).toBeInTheDocument()
    expect(screen.queryByTestId('workbench-tabs-narrow')).not.toBeInTheDocument()
    expect(screen.getByTestId('workbench-tab-play')).toBeInTheDocument()
    expect(screen.getByTestId('workbench-tab-map')).toBeInTheDocument()
    expect(screen.queryByTestId('workbench-tab-inv')).not.toBeInTheDocument()

    // Left rail stays; map pane hidden by default
    expect(screen.getByTestId('workbench-left').className).not.toMatch(/paneHidden/)
    expect(screen.getByTestId('workbench-map').className).toMatch(/paneHidden/)
    expect(screen.getByTestId('workbench-terminal').className).not.toMatch(
      /paneHidden/,
    )

    await user.click(screen.getByTestId('workbench-tab-map'))
    await waitFor(() => {
      expect(screen.getByTestId('workbench-map').className).not.toMatch(
        /paneHidden/,
      )
    })
    expect(screen.getByTestId('workbench-terminal').className).toMatch(
      /paneHidden/,
    )
    expect(root).toHaveAttribute('data-pane', 'map')
  })

  it('narrow (≤720): Play|Map|Inv|More tabs switch panes', async () => {
    mockMatchMedia(375)
    const user = userEvent.setup()
    const gameId = await seedGame('responsive-narrow')
    await usePlayStore.getState().openGame(gameId, 'new')

    render(<PlayWorkbench />)

    const root = screen.getByTestId('play-workbench')
    expect(root).toHaveAttribute('data-breakpoint', 'narrow')
    expect(screen.getByTestId('workbench-tabs-narrow')).toBeInTheDocument()
    expect(screen.queryByTestId('workbench-tabs-medium')).not.toBeInTheDocument()

    for (const id of ['play', 'map', 'inv', 'more'] as const) {
      expect(screen.getByTestId(`workbench-tab-${id}`)).toBeInTheDocument()
    }

    // Default: play only
    expect(screen.getByTestId('workbench-terminal').className).not.toMatch(
      /paneHidden/,
    )
    expect(screen.getByTestId('workbench-map').className).toMatch(/paneHidden/)
    expect(screen.getByTestId('workbench-left').className).toMatch(/paneHidden/)
    expect(screen.getByTestId('workbench-feelies').className).toMatch(
      /paneHidden/,
    )

    await user.click(screen.getByTestId('workbench-tab-inv'))
    expect(root).toHaveAttribute('data-pane', 'inv')
    expect(screen.getByTestId('workbench-left').className).not.toMatch(
      /paneHidden/,
    )
    expect(screen.getByTestId('workbench-terminal').className).toMatch(
      /paneHidden/,
    )

    await user.click(screen.getByTestId('workbench-tab-more'))
    expect(root).toHaveAttribute('data-pane', 'more')
    expect(screen.getByTestId('workbench-feelies').className).not.toMatch(
      /paneHidden/,
    )
    expect(screen.getByTestId('saves-button')).toBeInTheDocument()
  })
})
