import { useCallback, useEffect, useId, useState } from 'react'
import type { SaveSlotMeta } from '../../domain/types'
import { listSaves } from '../../persistence/saveRepo'
import styles from './SaveModal.module.css'

function isAutosaveSlot(slotId: string): boolean {
  return slotId === 'autosave' || slotId.startsWith('autosave-')
}

function formatWhen(ts: number): string {
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return String(ts)
  }
}

/** Generate a unique manual slot id. */
export function newManualSlotId(): string {
  return `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export interface SaveModalProps {
  open: boolean
  gameId: string
  /** When true, show Save new / Overwrite (active play session). */
  canSave?: boolean
  onClose: () => void
  onLoad: (slotId: string) => void | Promise<void>
  onSaveNew?: (slotId: string, name: string) => void | Promise<void>
  onOverwrite?: (slotId: string, name: string) => void | Promise<void>
}

export function SaveModal({
  open,
  gameId,
  canSave = false,
  onClose,
  onLoad,
  onSaveNew,
  onOverwrite,
}: SaveModalProps) {
  const titleId = useId()
  const nameFieldId = useId()
  const [slots, setSlots] = useState<SaveSlotMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [confirmOverwrite, setConfirmOverwrite] = useState<SaveSlotMeta | null>(
    null,
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await listSaves(gameId)
      list.sort((a, b) => b.updatedAt - a.updatedAt)
      setSlots(list)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to list saves'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [gameId])

  useEffect(() => {
    if (!open) return
    setNewName('')
    setConfirmOverwrite(null)
    setError(null)
    void refresh()
  }, [open, refresh])

  if (!open) return null

  async function handleLoad(slotId: string) {
    setBusy(true)
    setError(null)
    try {
      await onLoad(slotId)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load'
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveNew() {
    const name = newName.trim()
    if (!name || !onSaveNew) return
    setBusy(true)
    setError(null)
    try {
      const slotId = newManualSlotId()
      await onSaveNew(slotId, name)
      setNewName('')
      await refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  async function handleOverwriteConfirm() {
    if (!confirmOverwrite || !onOverwrite) return
    setBusy(true)
    setError(null)
    try {
      await onOverwrite(confirmOverwrite.slotId, confirmOverwrite.name)
      setConfirmOverwrite(null)
      await refresh()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to overwrite'
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={() => {
        if (!busy) onClose()
      }}
      data-testid="save-modal"
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title} id={titleId}>
            Saves
          </h2>
          <button
            type="button"
            className={styles.btn}
            onClick={onClose}
            disabled={busy}
            aria-label="Close saves"
          >
            Close
          </button>
        </header>

        {error ? (
          <div className={styles.error} role="alert">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className={styles.hint} aria-live="polite">
            Loading…
          </p>
        ) : null}

        {!loading && slots.length === 0 ? (
          <p className={styles.empty} data-testid="save-modal-empty">
            No save slots yet.
          </p>
        ) : null}

        {!loading && slots.length > 0 ? (
          <ul className={styles.list} aria-label="Save slots">
            {slots.map((slot) => {
              const auto = isAutosaveSlot(slot.slotId)
              return (
                <li key={slot.slotId} className={styles.slot}>
                  <div className={styles.slotMeta}>
                    <span className={styles.slotName}>
                      {slot.name}
                      {auto ? (
                        <span className={styles.badge}>autosave</span>
                      ) : null}
                    </span>
                    <span className={styles.slotDetail}>
                      {slot.locationName ? `${slot.locationName} · ` : ''}
                      {formatWhen(slot.updatedAt)}
                    </span>
                  </div>
                  <div className={styles.slotActions}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      disabled={busy}
                      onClick={() => void handleLoad(slot.slotId)}
                    >
                      Load
                    </button>
                    {canSave && !auto ? (
                      <button
                        type="button"
                        className={styles.btn}
                        disabled={busy}
                        onClick={() => setConfirmOverwrite(slot)}
                      >
                        Overwrite
                      </button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}

        {canSave ? (
          <div className={styles.saveNew} data-testid="save-new-form">
            <label className={styles.label} htmlFor={nameFieldId}>
              New save name
            </label>
            <div className={styles.saveNewRow}>
              <input
                id={nameFieldId}
                className={styles.input}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Checkpoint"
                disabled={busy}
                aria-label="New save name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleSaveNew()
                  }
                }}
              />
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={busy || !newName.trim()}
                onClick={() => void handleSaveNew()}
              >
                Save new
              </button>
            </div>
          </div>
        ) : null}

        {confirmOverwrite ? (
          <div
            className={styles.confirm}
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirm overwrite"
          >
            <p className={styles.confirmBody}>
              Overwrite &ldquo;{confirmOverwrite.name}&rdquo; with the current
              game state?
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.btn}
                disabled={busy}
                onClick={() => setConfirmOverwrite(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                disabled={busy}
                onClick={() => void handleOverwriteConfirm()}
              >
                Overwrite
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default SaveModal
