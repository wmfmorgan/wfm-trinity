import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { deleteDB } from 'idb'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DB_NAME, closeDb } from '../../persistence/db'
import { putSave } from '../../persistence/saveRepo'
import { SaveModal, newManualSlotId } from './SaveModal'

async function resetDb() {
  await closeDb()
  await deleteDB(DB_NAME)
}

async function seedSlot(
  gameId: string,
  slotId: string,
  opts: { name: string; updatedAt: number; locationName?: string },
) {
  await putSave({
    gameId,
    slotId,
    name: opts.name,
    updatedAt: opts.updatedAt,
    locationName: opts.locationName,
    zmachineSave: new TextEncoder().encode(`save-${slotId}`).buffer,
    shell: { map: { gameId, nodes: {}, edges: [] }, history: [] },
  })
}

describe('newManualSlotId', () => {
  it('returns unique slot ids', () => {
    const a = newManualSlotId()
    const b = newManualSlotId()
    expect(a).toMatch(/^slot-/)
    expect(a).not.toBe(b)
  })
})

describe('SaveModal', () => {
  beforeEach(async () => {
    await resetDb()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('lists save slots for the game', async () => {
    await seedSlot('g1', 'autosave', {
      name: 'Autosave',
      updatedAt: 100,
      locationName: 'Meadow',
    })
    await seedSlot('g1', 'slot-a', {
      name: 'Before woods',
      updatedAt: 200,
      locationName: 'Woods',
    })
    await seedSlot('g2', 'slot-other', {
      name: 'Other game',
      updatedAt: 300,
    })

    render(
      <SaveModal
        open
        gameId="g1"
        onClose={() => {}}
        onLoad={async () => {}}
      />,
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Save slots')).toBeInTheDocument()
    })

    const list = screen.getByLabelText('Save slots')
    expect(within(list).getByText('Autosave')).toBeInTheDocument()
    expect(within(list).getByText('Before woods')).toBeInTheDocument()
    expect(within(list).queryByText('Other game')).not.toBeInTheDocument()
    // Newest first
    const items = within(list).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Before woods')
    expect(items[1]).toHaveTextContent('Autosave')
  })

  it('shows empty state when no slots', async () => {
    render(
      <SaveModal
        open
        gameId="empty"
        onClose={() => {}}
        onLoad={async () => {}}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId('save-modal-empty')).toHaveTextContent(
        /no save slots/i,
      )
    })
  })

  it('Load calls onLoad with slotId', async () => {
    const user = userEvent.setup()
    const onLoad = vi.fn(async () => {})
    await seedSlot('g1', 'slot-a', {
      name: 'Checkpoint',
      updatedAt: 10,
      locationName: 'Meadow',
    })

    render(
      <SaveModal open gameId="g1" onClose={() => {}} onLoad={onLoad} />,
    )

    await waitFor(() => {
      expect(screen.getByText('Checkpoint')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /^load$/i }))
    expect(onLoad).toHaveBeenCalledWith('slot-a')
  })

  it('Save new calls onSaveNew with name when canSave', async () => {
    const user = userEvent.setup()
    const onSaveNew = vi.fn(async () => {})
    const onClose = vi.fn()

    render(
      <SaveModal
        open
        gameId="g1"
        canSave
        onClose={onClose}
        onLoad={async () => {}}
        onSaveNew={onSaveNew}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId('save-new-form')).toBeInTheDocument()
    })

    const input = screen.getByLabelText(/new save name/i)
    await user.type(input, 'My checkpoint')
    await user.click(screen.getByRole('button', { name: /save new/i }))

    await waitFor(() => {
      expect(onSaveNew).toHaveBeenCalled()
    })
    expect(onSaveNew).toHaveBeenCalledWith(
      expect.stringMatching(/^slot-/),
      'My checkpoint',
    )
  })

  it('does not show Save new form when canSave is false', async () => {
    render(
      <SaveModal
        open
        gameId="g1"
        canSave={false}
        onClose={() => {}}
        onLoad={async () => {}}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId('save-modal')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('save-new-form')).not.toBeInTheDocument()
  })

  it('Overwrite confirms then calls onOverwrite', async () => {
    const user = userEvent.setup()
    const onOverwrite = vi.fn(async () => {})
    await seedSlot('g1', 'slot-a', {
      name: 'Checkpoint',
      updatedAt: 10,
    })

    render(
      <SaveModal
        open
        gameId="g1"
        canSave
        onClose={() => {}}
        onLoad={async () => {}}
        onOverwrite={onOverwrite}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Checkpoint')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /^overwrite$/i }))
    expect(onOverwrite).not.toHaveBeenCalled()

    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText(/current game state/i)).toBeInTheDocument()
    await user.click(
      within(dialog).getByRole('button', { name: /^overwrite$/i }),
    )

    await waitFor(() => {
      expect(onOverwrite).toHaveBeenCalledWith('slot-a', 'Checkpoint')
    })
  })

  it('does not show Overwrite for autosave slots', async () => {
    await seedSlot('g1', 'autosave', {
      name: 'Autosave',
      updatedAt: 10,
    })

    render(
      <SaveModal
        open
        gameId="g1"
        canSave
        onClose={() => {}}
        onLoad={async () => {}}
        onOverwrite={async () => {}}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Autosave')).toBeInTheDocument()
    })

    expect(
      screen.queryByRole('button', { name: /^overwrite$/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^load$/i })).toBeInTheDocument()
  })
})
