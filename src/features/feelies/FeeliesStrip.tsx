import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import {
  deleteFeelie,
  listFeelies,
  putFeelie,
  type FeelieMeta,
} from '../../persistence/feeliesRepo'
import { FeelieViewer } from './FeelieViewer'
import styles from './FeeliesStrip.module.css'

const FEELIE_ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.markdown,image/*,application/pdf,text/plain,text/markdown'

export interface FeeliesStripProps {
  gameId: string
  /** Trailing actions (e.g. Saves on the play workbench). */
  actions?: ReactNode
  /** Show remove control next to each feelie (library management). */
  allowDelete?: boolean
  /** Visual density. */
  variant?: 'strip' | 'panel'
}

function newFeelieId(): string {
  return `feelie-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function FeeliesStrip({
  gameId,
  actions,
  allowDelete = false,
  variant = 'strip',
}: FeeliesStripProps) {
  const [items, setItems] = useState<FeelieMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<FeelieMeta | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await listFeelies(gameId)
      list.sort((a, b) => a.addedAt - b.addedAt)
      setItems(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list feelies')
    } finally {
      setLoading(false)
    }
  }, [gameId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function handleAdd(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    e.target.value = ''
    if (!files || files.length === 0) return

    setBusy(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        const meta: FeelieMeta = {
          id: newFeelieId(),
          gameId,
          name: file.name,
          mime: file.type || '',
          addedAt: Date.now(),
        }
        await putFeelie(meta, file)
      }
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add feelie')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    setBusy(true)
    setError(null)
    try {
      await deleteFeelie(id)
      if (viewing?.id === id) setViewing(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove feelie')
    } finally {
      setBusy(false)
    }
  }

  const rootClass =
    variant === 'panel'
      ? `${styles.root} ${styles.panel}`
      : styles.root

  return (
    <>
      <div
        className={rootClass}
        data-testid="feelies-strip"
        aria-label="Feelies"
      >
        <div className={styles.listRow}>
          {loading && items.length === 0 ? (
            <span className={styles.hint}>…</span>
          ) : null}

          {!loading && items.length === 0 ? (
            <span className={styles.hint} data-testid="feelies-empty">
              No feelies
            </span>
          ) : null}

          <ul className={styles.list} aria-label="Feelie attachments">
            {items.map((item) => (
              <li key={item.id} className={styles.item}>
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() => setViewing(item)}
                  disabled={busy}
                  title={item.name}
                >
                  {item.name}
                </button>
                {allowDelete ? (
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => void handleDelete(item.id)}
                    disabled={busy}
                    aria-label={`Remove ${item.name}`}
                  >
                    ×
                  </button>
                ) : null}
              </li>
            ))}
          </ul>

          <label className={styles.addLabel}>
            Add
            <input
              className={styles.fileInput}
              type="file"
              accept={FEELIE_ACCEPT}
              multiple
              disabled={busy}
              onChange={(e) => void handleAdd(e)}
              aria-label="Add feelie"
              data-testid="feelies-add-input"
            />
          </label>
        </div>

        {actions ? <div className={styles.actions}>{actions}</div> : null}

        {error ? (
          <div className={styles.error} role="alert">
            {error}
          </div>
        ) : null}
      </div>

      <FeelieViewer
        open={viewing != null}
        meta={viewing}
        onClose={() => setViewing(null)}
      />
    </>
  )
}
