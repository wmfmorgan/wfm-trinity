import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { InventoryItem } from '../../domain/types'
import { InventoryPanel } from './InventoryPanel'

const LAMP: InventoryItem = { id: 'lamp', name: 'brass lamp' }
const SWORD: InventoryItem = { id: 'sword', name: 'elven sword' }

describe('InventoryPanel', () => {
  it('calls onInsert when an item is clicked', async () => {
    const user = userEvent.setup()
    const onInsert = vi.fn()
    const onExamine = vi.fn()

    render(
      <InventoryPanel
        items={[LAMP, SWORD]}
        onInsert={onInsert}
        onExamine={onExamine}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'brass lamp' }))

    // Insert is deferred so double-click can cancel it.
    await waitFor(() => {
      expect(onInsert).toHaveBeenCalledWith('brass lamp')
    })
    expect(onExamine).not.toHaveBeenCalled()
  })

  it('calls onExamine on double-click without insert', async () => {
    const user = userEvent.setup()
    const onInsert = vi.fn()
    const onExamine = vi.fn()

    render(
      <InventoryPanel
        items={[LAMP]}
        onInsert={onInsert}
        onExamine={onExamine}
      />,
    )

    await user.dblClick(screen.getByRole('button', { name: 'brass lamp' }))

    expect(onExamine).toHaveBeenCalledWith('brass lamp')
    // Allow deferred-insert window to elapse; must stay empty.
    await new Promise((r) => setTimeout(r, 350))
    expect(onInsert).not.toHaveBeenCalled()
  })

  it('shows empty-handed copy when inventory is empty', () => {
    render(
      <InventoryPanel items={[]} onInsert={vi.fn()} onExamine={vi.fn()} />,
    )
    expect(screen.getByText(/empty-handed/i)).toBeInTheDocument()
  })
})
