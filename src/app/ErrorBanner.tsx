import styles from './ErrorBanner.module.css'

export interface ErrorBannerAction {
  label: string
  onClick: () => void
}

export interface ErrorBannerProps {
  message: string
  onDismiss: () => void
  /** Optional secondary action (e.g. Return to library after interpreter failure). */
  secondaryAction?: ErrorBannerAction
}

/**
 * Global dismissible error banner for libraryStore / playStore errors.
 */
export function ErrorBanner({
  message,
  onDismiss,
  secondaryAction,
}: ErrorBannerProps) {
  if (!message) return null

  return (
    <div
      className={styles.banner}
      role="alert"
      data-testid="error-banner"
    >
      <span className={styles.message}>{message}</span>
      <div className={styles.actions}>
        {secondaryAction ? (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={secondaryAction.onClick}
          >
            {secondaryAction.label}
          </button>
        ) : null}
        <button type="button" className={styles.btn} onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  )
}
