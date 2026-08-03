import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Terminal, type TerminalProps } from './Terminal'

function setup(props: Partial<TerminalProps> = {}) {
  const onSubmit = props.onSubmit ?? vi.fn()
  const result = render(
    <Terminal
      transcript={props.transcript ?? 'You are in a meadow.'}
      disabled={props.disabled}
      busy={props.busy}
      onSubmit={onSubmit}
      candidates={props.candidates ?? ['look', 'lamp', 'lantern', 'take', 'north']}
      insertText={props.insertText}
      insertId={props.insertId}
      onInsertApplied={props.onInsertApplied}
    />,
  )
  const input = screen.getByRole('textbox')
  return { ...result, onSubmit, input }
}

describe('Terminal', () => {
  it('renders transcript text', () => {
    setup({ transcript: 'Hello phosphor' })
    expect(screen.getByText('Hello phosphor')).toBeInTheDocument()
  })

  it('exposes #command-input on the textbox', () => {
    const { input } = setup()
    expect(input).toHaveAttribute('id', 'command-input')
  })

  it('submits typed command', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const { input } = setup({ onSubmit, candidates: ['look'] })

    await user.type(input, 'look{enter}')

    expect(onSubmit).toHaveBeenCalledWith('look')
  })

  it('clears the input after submit', async () => {
    const user = userEvent.setup()
    const { input } = setup()

    await user.type(input, 'look{enter}')

    expect(input).toHaveValue('')
  })

  it('does not submit empty or whitespace-only lines', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const { input } = setup({ onSubmit })

    await user.type(input, '{enter}')
    await user.type(input, '   {enter}')

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('navigates history with ArrowUp and ArrowDown', async () => {
    const user = userEvent.setup()
    const { input } = setup()

    await user.type(input, 'look{enter}')
    await user.type(input, 'north{enter}')

    await user.keyboard('{ArrowUp}')
    expect(input).toHaveValue('north')

    await user.keyboard('{ArrowUp}')
    expect(input).toHaveValue('look')

    await user.keyboard('{ArrowDown}')
    expect(input).toHaveValue('north')

    await user.keyboard('{ArrowDown}')
    expect(input).toHaveValue('')
  })

  it('autocompletes last token on Tab', async () => {
    const user = userEvent.setup()
    const { input } = setup({
      candidates: ['look', 'lamp', 'lantern', 'take'],
    })

    await user.type(input, 'take la')
    await user.keyboard('{Tab}')

    expect(input).toHaveValue('take lamp')
  })

  it('cycles autocomplete matches on repeated Tab', async () => {
    const user = userEvent.setup()
    const { input } = setup({
      candidates: ['look', 'lamp', 'lantern', 'take'],
    })

    await user.type(input, 'la')
    await user.keyboard('{Tab}')
    expect(input).toHaveValue('lamp')

    await user.keyboard('{Tab}')
    expect(input).toHaveValue('lantern')

    await user.keyboard('{Tab}')
    expect(input).toHaveValue('lamp')
  })

  it('shows candidate popover with matches after Tab', async () => {
    const user = userEvent.setup()
    const { input } = setup({
      candidates: ['lamp', 'lantern'],
    })

    await user.type(input, 'la')
    await user.keyboard('{Tab}')

    const list = screen.getByRole('listbox')
    expect(within(list).getByText('lamp')).toBeInTheDocument()
    expect(within(list).getByText('lantern')).toBeInTheDocument()
  })

  it('disables input when disabled', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const { input } = setup({ disabled: true, onSubmit })

    expect(input).toBeDisabled()
    await user.type(input, 'look{enter}')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('keeps input enabled while busy so focus is not stolen', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const { input } = setup({ busy: true, onSubmit })

    expect(input).not.toBeDisabled()
    expect(input).toHaveAttribute('aria-busy', 'true')
    input.focus()
    expect(input).toHaveFocus()
    await user.type(input, 'look{enter}')
    // Submit blocked while busy; draft retained and focus stays
    expect(onSubmit).not.toHaveBeenCalled()
    expect(input).toHaveValue('look')
    expect(input).toHaveFocus()
  })

  it('applies insertText into the draft and calls onInsertApplied', async () => {
    const onInsertApplied = vi.fn()
    const { rerender, input } = setup()

    rerender(
      <Terminal
        transcript="You are in a meadow."
        onSubmit={vi.fn()}
        candidates={['look', 'lamp']}
        insertText="brass lamp"
        insertId={1}
        onInsertApplied={onInsertApplied}
      />,
    )

    expect(input).toHaveValue('brass lamp')
    expect(onInsertApplied).toHaveBeenCalled()
  })
})
