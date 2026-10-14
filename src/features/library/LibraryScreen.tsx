import { useEffect, useId, useState, type ChangeEvent } from 'react'
import { PhosphorThemeControl } from '../../app/PhosphorThemeControl'
import { UiScaleControl } from '../../app/UiScaleControl'
import type { LibraryGame } from '../../domain/types'
import { getCover } from '../../persistence/libraryRepo'
import { getLatestAutosave } from '../../persistence/saveRepo'
import { FeeliesStrip } from '../feelies/FeeliesStrip'
import { usePlayStore } from '../play/playStore'
import { CoverPlaceholder } from './CoverPlaceholder'
import { useLibraryStore } from './libraryStore'
import styles from './LibraryScreen.module.css'

const COVER_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif'

function GameCover({
  gameId,
  title,
  hasCover,
  className,
}: {
  gameId: string
  title: string
  hasCover: boolean
  className?: string
}) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!hasCover) {
      setUrl(null)
      return
    }

    let cancelled = false
    let objectUrl: string | null = null

    void (async () => {
      try {
        const blob = await getCover(gameId)
        if (cancelled || !blob) return
        objectUrl = URL.createObjectURL(blob)
        if (cancelled) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        setUrl(objectUrl)
      } catch {
        if (!cancelled) setUrl(null)
      }
    })()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [gameId, hasCover])

  if (url) {
    return (
      <img
        className={className}
        src={url}
        alt={`${title} cover`}
        data-testid="game-cover"
      />
    )
  }

  return <CoverPlaceholder title={title} className={className} />
}

const STORY_ACCEPT = '.z3,.z4,.z5,.z6,.z7,.z8,application/octet-stream'

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
  const refresh = useLibraryStore((s) => s.refresh)
  const importFiles = useLibraryStore((s) => s.importFiles)
  const removeGame = useLibraryStore((s) => s.removeGame)
  const updateMeta = useLibraryStore((s) => s.updateMeta)
  const setCover = useLibraryStore((s) => s.setCover)

  const openGame = usePlayStore((s) => s.openGame)

  const [pendingDelete, setPendingDelete] = useState<LibraryGame | null>(null)
  const [pendingNewGame, setPendingNewGame] = useState<LibraryGame | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [openingId, setOpeningId] = useState<string | null>(null)
  /** gameId → has latest autosave (Continue available) */
  const [autosaveByGame, setAutosaveByGame] = useState<Record<string, boolean>>(
    {},
  )

  const titleId = useId()
  const dialogTitleId = useId()
  const newGameTitleId = useId()

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Resolve which games have an autosave for Continue
  useEffect(() => {
    let cancelled = false
    async function loadFlags() {
      const flags: Record<string, boolean> = {}
      await Promise.all(
        games.map(async (g) => {
          try {
            const save = await getLatestAutosave(g.gameId)
            flags[g.gameId] = !!save
          } catch {
            flags[g.gameId] = false
          }
        }),
      )
      if (!cancelled) setAutosaveByGame(flags)
    }
    void loadFlags()
    return () => {
      cancelled = true
    }
  }, [games])

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

  function requestNewGame(game: LibraryGame) {
    if (autosaveByGame[game.gameId]) {
      setPendingNewGame(game)
      return
    }
    void handleOpen(game.gameId, 'new')
  }

  async function confirmNewGame() {
    if (!pendingNewGame) return
    const id = pendingNewGame.gameId
    setPendingNewGame(null)
    await handleOpen(id, 'new')
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

  async function handleCoverChange(
    gameId: string,
    e: ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    await setCover(gameId, file)
  }

  return (
    <div className={styles.screen} data-testid="library-screen">
      <header className={styles.header}>
        <h1 className={styles.title} id={titleId}>
          Infocom Workbench
        </h1>
        <div className={styles.headerActions}>
          <PhosphorThemeControl />
          <UiScaleControl />
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
        {loading ? (
          <p className={styles.loading} aria-live="polite">
            Loading…
          </p>
        ) : null}

        {!loading && games.length === 0 ? (
          <div className={styles.empty} data-testid="library-empty">
            <p className={styles.emptyTitle}>No games</p>
            <p className={styles.emptyHint}>
              Add a raw Z-machine story file (.z3–.z8) to your local library.
              Blorb containers (.zblorb / .blorb) are not unwrapped yet.
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
                  <GameCover
                    gameId={game.gameId}
                    title={game.metadata.title}
                    hasCover={game.hasCover}
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
                        {autosaveByGame[game.gameId] ? (
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            disabled={busy || loading}
                            onClick={() =>
                              void handleOpen(game.gameId, 'continue')
                            }
                          >
                            Continue
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={
                            autosaveByGame[game.gameId]
                              ? styles.btn
                              : `${styles.btn} ${styles.btnPrimary}`
                          }
                          disabled={busy || loading}
                          onClick={() => requestNewGame(game)}
                        >
                          New Game
                        </button>
                        <label className={styles.coverUploadLabel}>
                          Cover
                          <input
                            className={styles.fileInput}
                            type="file"
                            accept={COVER_ACCEPT}
                            disabled={busy || loading}
                            onChange={(e) =>
                              void handleCoverChange(game.gameId, e)
                            }
                            aria-label={`Upload cover for ${game.metadata.title}`}
                            data-testid={`cover-upload-${game.gameId}`}
                          />
                        </label>
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

                    <div
                      className={styles.feeliesManage}
                      data-testid={`feelies-manage-${game.gameId}`}
                    >
                      <FeeliesStrip
                        gameId={game.gameId}
                        allowDelete
                        variant="panel"
                      />
                    </div>
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

      {pendingNewGame ? (
        <div
          className={styles.overlay}
          role="presentation"
          onClick={() => setPendingNewGame(null)}
        >
          <div
            className={styles.dialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={newGameTitleId}
            onClick={(e) => e.stopPropagation()}
            data-testid="new-game-confirm"
          >
            <h2 className={styles.dialogTitle} id={newGameTitleId}>
              Start new game?
            </h2>
            <p className={styles.dialogBody}>
              An autosave exists for &ldquo;{pendingNewGame.metadata.title}
              &rdquo;. Starting a new game will leave that save in place but
              begin a fresh run (map and progress start over). Continue only
              if you want a clean start.
            </p>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.btn}
                onClick={() => setPendingNewGame(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => void confirmNewGame()}
              >
                New Game
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default LibraryScreen
