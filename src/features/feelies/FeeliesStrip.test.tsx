import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteDB } from 'idb'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DB_NAME, closeDb } from '../../persistence/db'
import { listFeelies, putFeelie } from '../../persistence/feeliesRepo'
import { FeeliesStrip } from './FeeliesStrip'

async function resetDb() {
  await closeDb()
  await deleteDB(DB_NAME)
}

describe('FeeliesStrip', () => {
  beforeEach(async () => {
    await resetDb()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('empty strip shows add control', async () => {
    render(<FeeliesStrip gameId="game-a" />)

    expect(screen.getByTestId('feelies-strip')).toBeInTheDocument()
    expect(screen.getByTestId('feelies-add-input')).toBeInTheDocument()
    expect(screen.getByLabelText(/add feelie/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByTestId('feelies-empty')).toBeInTheDocument()
    })
    expect(screen.getByText(/no feelies/i)).toBeInTheDocument()
  })

  it('adds a feelie via file input and lists it', async () => {
    const user = userEvent.setup()
    render(<FeeliesStrip gameId="game-a" />)

    await waitFor(() => {
      expect(screen.getByTestId('feelies-empty')).toBeInTheDocument()
    })

    const file = new File(['hello feelie'], 'manual.txt', {
      type: 'text/plain',
    })
    await user.upload(screen.getByTestId('feelies-add-input'), file)

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'manual.txt' }),
      ).toBeInTheDocument()
    })
    expect(screen.queryByTestId('feelies-empty')).not.toBeInTheDocument()

    const stored = await listFeelies('game-a')
    expect(stored).toHaveLength(1)
    expect(stored[0]?.name).toBe('manual.txt')
  })

  it('click opens viewer for text feelie', async () => {
    const user = userEvent.setup()
    await putFeelie(
      {
        id: 'f1',
        gameId: 'game-a',
        name: 'notes.txt',
        mime: 'text/plain',
        addedAt: 1,
      },
      new Blob(['line one\nline two'], { type: 'text/plain' }),
    )

    render(<FeeliesStrip gameId="game-a" />)

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'notes.txt' }),
      ).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'notes.txt' }))

    const viewer = await screen.findByTestId('feelie-viewer')
    expect(within(viewer).getByRole('heading', { name: 'notes.txt' })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('feelie-text')).toHaveTextContent('line one')
    })
  })

  it('click opens image viewer', async () => {
    const user = userEvent.setup()
    await putFeelie(
      {
        id: 'img1',
        gameId: 'game-a',
        name: 'map.png',
        mime: 'image/png',
        addedAt: 1,
      },
      new Blob(['fake-png'], { type: 'image/png' }),
    )

    // jsdom may lack createObjectURL
    const createUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock-image')
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    render(<FeeliesStrip gameId="game-a" />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'map.png' })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'map.png' }))

    await waitFor(() => {
      expect(screen.getByTestId('feelie-image')).toHaveAttribute(
        'src',
        'blob:mock-image',
      )
    })
    expect(createUrl).toHaveBeenCalled()

    await user.click(screen.getByLabelText(/close feelie viewer/i))
    expect(screen.queryByTestId('feelie-viewer')).not.toBeInTheDocument()
    expect(revokeUrl).toHaveBeenCalled()
  })

  it('click opens pdf viewer', async () => {
    const user = userEvent.setup()
    await putFeelie(
      {
        id: 'pdf1',
        gameId: 'game-a',
        name: 'brochure.pdf',
        mime: 'application/pdf',
        addedAt: 1,
      },
      new Blob(['%PDF'], { type: 'application/pdf' }),
    )

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-pdf')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    render(<FeeliesStrip gameId="game-a" />)

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'brochure.pdf' }),
      ).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'brochure.pdf' }))

    await waitFor(() => {
      expect(screen.getByTestId('feelie-pdf')).toHaveAttribute(
        'src',
        'blob:mock-pdf',
      )
    })
  })

  it('allowDelete removes a feelie', async () => {
    const user = userEvent.setup()
    await putFeelie(
      {
        id: 'del1',
        gameId: 'game-a',
        name: 'junk.txt',
        mime: 'text/plain',
        addedAt: 1,
      },
      new Blob(['x'], { type: 'text/plain' }),
    )

    render(<FeeliesStrip gameId="game-a" allowDelete />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'junk.txt' })).toBeInTheDocument()
    })

    await user.click(screen.getByLabelText(/remove junk\.txt/i))

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'junk.txt' }),
      ).not.toBeInTheDocument()
    })
    expect(await listFeelies('game-a')).toHaveLength(0)
  })

  it('renders trailing actions slot', () => {
    render(
      <FeeliesStrip
        gameId="game-a"
        actions={<button type="button">Saves</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'Saves' })).toBeInTheDocument()
  })
})
