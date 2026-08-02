import { useEffect, useId, useState } from 'react'
import { blobToText } from '../../persistence/blobUtil'
import type { FeelieMeta } from '../../persistence/feeliesRepo'
import { getFeelieBlob } from '../../persistence/feeliesRepo'
import styles from './FeelieViewer.module.css'

export interface FeelieViewerProps {
  open: boolean
  meta: FeelieMeta | null
  onClose: () => void
}

function isImageMime(mime: string, name: string): boolean {
  if (mime.startsWith('image/')) return true
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)
}

function isPdfMime(mime: string, name: string): boolean {
  if (mime === 'application/pdf' || mime === 'application/x-pdf') return true
  return /\.pdf$/i.test(name)
}

function isTextMime(mime: string, name: string): boolean {
  if (mime.startsWith('text/')) return true
  if (mime === 'application/json' || mime === 'application/xml') return true
  return /\.(txt|md|markdown|json|xml|csv|log)$/i.test(name)
}

export function FeelieViewer({ open, meta, onClose }: FeelieViewerProps) {
  const titleId = useId()
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !meta) {
      setObjectUrl(null)
      setTextContent(null)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    let createdUrl: string | null = null

    async function load() {
      setLoading(true)
      setError(null)
      setObjectUrl(null)
      setTextContent(null)
      try {
        const blob = await getFeelieBlob(meta!.id)
        if (cancelled) return
        if (!blob) {
          setError('Feelie not found.')
          return
        }
        const mime = meta!.mime || blob.type || ''
        if (isTextMime(mime, meta!.name)) {
          const text = await blobToText(blob)
          if (!cancelled) setTextContent(text)
        } else {
          createdUrl = URL.createObjectURL(blob)
          if (cancelled) {
            URL.revokeObjectURL(createdUrl)
            return
          }
          setObjectUrl(createdUrl)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to open feelie')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [open, meta])

  if (!open || !meta) return null

  const mime = meta.mime || ''
  const image = isImageMime(mime, meta.name)
  const pdf = isPdfMime(mime, meta.name)
  const text = isTextMime(mime, meta.name)

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={onClose}
      data-testid="feelie-viewer"
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
            {meta.name}
          </h2>
          <button
            type="button"
            className={styles.btn}
            onClick={onClose}
            aria-label="Close feelie viewer"
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

        {!loading && !error && text && textContent != null ? (
          <pre className={styles.text} data-testid="feelie-text">
            {textContent}
          </pre>
        ) : null}

        {!loading && !error && image && objectUrl ? (
          <img
            className={styles.image}
            src={objectUrl}
            alt={meta.name}
            data-testid="feelie-image"
          />
        ) : null}

        {!loading && !error && pdf && objectUrl ? (
          <iframe
            className={styles.pdf}
            src={objectUrl}
            title={meta.name}
            data-testid="feelie-pdf"
          />
        ) : null}

        {!loading &&
        !error &&
        !text &&
        !image &&
        !pdf &&
        objectUrl ? (
          <div className={styles.fallback}>
            <p className={styles.hint}>Preview not available for this type.</p>
            <a className={styles.link} href={objectUrl} download={meta.name}>
              Download {meta.name}
            </a>
          </div>
        ) : null}
      </div>
    </div>
  )
}
