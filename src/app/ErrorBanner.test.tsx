import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBanner } from './ErrorBanner'

describe('ErrorBanner', () => {
  it('renders message with alert role', () => {
    render(<ErrorBanner message="Something broke" onDismiss={() => {}} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Something broke')
    expect(screen.getByTestId('error-banner')).toBe(alert)
  })

  it('returns null for empty message', () => {
    const { container } = render(
      <ErrorBanner message="" onDismiss={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('calls onDismiss when Dismiss is clicked', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<ErrorBanner message="err" onDismiss={onDismiss} />)
    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('renders secondary action and fires its handler', async () => {
    const user = userEvent.setup()
    const onSecondary = vi.fn()
    render(
      <ErrorBanner
        message="Interpreter error: boom"
        onDismiss={() => {}}
        secondaryAction={{
          label: 'Return to library',
          onClick: onSecondary,
        }}
      />,
    )
    await user.click(
      screen.getByRole('button', { name: /return to library/i }),
    )
    expect(onSecondary).toHaveBeenCalledTimes(1)
  })
})
