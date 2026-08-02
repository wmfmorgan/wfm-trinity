import { useEffect, useId, useState, type ChangeEvent } from 'react'
import type { LibraryGame } from '../../domain/types'
import { usePlayStore } from '../play/playStore'
import { CoverPlaceholder } from './CoverPlaceholder'
import { useLibraryStore } from './libraryStore'
import styles from './LibraryScreen.module.css'

const STORY_ACCEPT =
  '.z3,.z4,.z5,.z6,.z7,.z8,.zblorb,.blorb,application/octet-stream'

function formatWhen(ts: number | undefined): string | null {
  if (ts == null) return null
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return null
  }
}

export function LibraryScreen() {
  const games = useLibraryStore((s) => s.games)
  const loading = useLibraryStore((s) => s.loading)
  const libraryError = useLibraryStore((s) => s.error)
  const refresh = useLibraryStore((s) => s.refresh)
  const importFiles = useLibraryStore((s) => s.importFiles)
  const removeGame = useLibraryStore((s) => s.removeGame)
  const updateMeta = useLibraryStore((s) => s.updateMeta)
  const clearLibraryError = useLibraryStore((s) => s.clearError)

  const openGame = usePlayStore((s) => s.openGame)
  const playError = usePlayStore((s) => s.error)
  const clearPlayError = usePlayStore((s) => s.clearError)

  const [pendingDelete, setPendingDelete] = useState<LibraryGame | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [openingId, setOpeningId] = useState<string | null>(null)

  const titleId = useId()
  const dialogTitleId = useId()

  useEffect(() => {
    void refresh()
  }, [refresh])

  const error = libraryError ?? playError

  async function handleImportChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files && files.length > 0) {
      await importFiles(files)
    }
    // Allow re-selecting the same file
    e.target.value = ''
  }

  async function handleOpen(gameId: string, mode: 'new' | 'continue') {
    setOpeningId(gameId)
    try {
      await openGame(gameId, mode)
    } finally {
      setOpeningId(null)
    }
  }

  function startEdit(game: LibraryGame) {
    setEditingId(game.gameId)
    setEditTitle(game.metadata.title)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditTitle('')
  }

  async function saveEdit(game: LibraryGame) {
    const title = editTitle.trim()
    if (!title) return
    await updateMeta(game.gameId, { ...game.metadata, title })
    setEditingId(null)
    setEditTitle('')
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const id = pendingDelete.gameId
    setPendingDelete(null)
    await removeGame(id)
  }

  function dismissError() {
    clearLibraryError()
    clearPlayError()
  }

  return (
    <div className={styles.screen} data-testid="library-screen">
      <header className={styles.header}>
        <h1 className={styles.title} id={titleId}>
          Infocom Workbench
        </h1>
        <div className={styles.headerActions}>
          <label className={styles.importLabel}>
            Import
            <input
              className={styles.fileInput}
              type="file"
              accept={STORY_ACCEPT}
              multiple
              onChange={handleImportChange}
              aria-label="Import story files"
            />
          </label>
        </div>
      </header>

      <main className={styles.main} aria-labelledby={titleId}>
        {error ? (
          <div className={styles.banner} role="alert">
            {error}
            <button
              type="button"
              className={styles.bannerDismiss}
              onClick={dismissError}
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {loading ? (
          <p className={styles.loading} aria-live="polite">
            Loading…
          </p>
        ) : null}

        {!loading && games.length === 0 ? (
          <div className={styles.empty} data-testid="library-empty">
            <p className={styles.emptyTitle}>No games</p>
            <p className={styles.emptyHint}>
              Add a Z-machine story file (.z3–.z8, .zblorb, .blorb) to your local
              library.
            </p>
          </div>
        ) : null}

        {games.length > 0 ? (
          <ul className={styles.grid} aria-label="Game library">
            {games.map((game) => {
              const busy = openingId === game.gameId
              const lastPlayed = formatWhen(game.lastPlayedAt)
              const isEditing = editingId === game.gameId

              return (
                <li key={game.gameId} className={styles.card}>
                  <CoverPlaceholder
                    title={game.metadata.title}
                    className={styles.cover}
                  />
                  <div className={styles.cardBody}>
                    {isEditing ? (
                      <div className={styles.titleEdit}>
                        <label className="visually-hidden" htmlFor={`title-${game.gameId}`}>
                          Title
                        </label>
                        <input
                          id={`title-${game.gameId}`}
                          className={styles.titleInput}
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          aria-label="Edit title"
                          autoFocus
                        />
                        <div className={styles.editActions}>
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            onClick={() => void saveEdit(game)}
                            disabled={!editTitle.trim()}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className={styles.btn}
                            onClick={cancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <h2 className={styles.cardTitle}>{game.metadata.title}</h2>
                    )}

                    <p className={styles.fileName} title={game.fileName}>
                      {game.fileName}
                    </p>
                    <div className={styles.metaRow}>
                      {lastPlayed ? (
                        <span>Last played {lastPlayed}</span>
                      ) : (
                        <span>Never played</span>
                      )}
                    </div>

                    {!isEditing ? (
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnPrimary}`}
                          disabled={busy || loading}
                          onClick={() => void handleOpen(game.gameId, 'continue')}
                        >
                          Continue
                        </button>
                        <button
                          type="button"
                          className={styles.btn}
                          disabled={busy || loading}
                          onClick={() => void handleOpen(game.gameId, 'new')}
                        >
                          New
                        </button>
                        <button
                          type="button"
                          className={styles.btn}
                          disabled={busy || loading}
                          onClick={() => startEdit(game)}
                        >
                          Edit title
                        </button>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnDanger}`}
                          disabled={busy || loading}
                          onClick={() => setPendingDelete(game)}
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}
      </main>

      {pendingDelete ? (
        <div
          className={styles.overlay}
          role="presentation"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className={styles.dialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={styles.dialogTitle} id={dialogTitleId}>
              Delete game?
            </h2>
            <p className={styles.dialogBody}>
              Remove &ldquo;{pendingDelete.metadata.title}&rdquo; and all of its
              saves, map data, and feelies from this device? This cannot be
              undone.
            </p>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.btn}
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={() => void confirmDelete()}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default LibraryScreen
