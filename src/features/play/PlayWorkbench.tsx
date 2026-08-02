import { useCallback, useEffect, useMemo, useState } from 'react'
import { commandForDir } from '../../domain/directions'
import type { Direction } from '../../domain/types'
import { COMMON_VERBS } from '../../domain/verbs'
import { FeeliesStrip } from '../feelies/FeeliesStrip'
import { useLibraryStore } from '../library/libraryStore'
import { MapView } from '../map/MapView'
import { SaveModal } from '../saves/SaveModal'
import { Compass } from './Compass'
import { InventoryPanel } from './InventoryPanel'
import { usePlayStore } from './playStore'
import { StatusBar } from './StatusBar'
import { Terminal } from './Terminal'
import styles from './PlayWorkbench.module.css'

function focusCommandInput() {
  const el = document.getElementById('command-input')
  if (el instanceof HTMLInputElement) {
    el.focus()
  }
}

export function PlayWorkbench() {
  const session = usePlayStore((s) => s.session)
  const error = usePlayStore((s) => s.error)
  const pendingInsert = usePlayStore((s) => s.pendingInsert)
  const pendingInsertId = usePlayStore((s) => s.pendingInsertId)
  const submit = usePlayStore((s) => s.submit)
  const selectMapRoom = usePlayStore((s) => s.selectMapRoom)
  const queueInsert = usePlayStore((s) => s.queueInsert)
  const clearPendingInsert = usePlayStore((s) => s.clearPendingInsert)
  const returnToLibrary = usePlayStore((s) => s.returnToLibrary)
  const clearError = usePlayStore((s) => s.clearError)
  const openGame = usePlayStore((s) => s.openGame)
  const saveToSlot = usePlayStore((s) => s.saveToSlot)
  const flushAutosave = usePlayStore((s) => s.flushAutosave)

  const games = useLibraryStore((s) => s.games)
  const [savesOpen, setSavesOpen] = useState(false)

  const title = useMemo(() => {
    if (!session) return 'Adventure'
    const game = games.find((g) => g.gameId === session.gameId)
    return game?.metadata.title || game?.fileName || 'Adventure'
  }, [session, games])

  const candidates = useMemo(() => {
    if (!session) return [...COMMON_VERBS]
    const inv = session.snapshot.inventory.map((i) => i.name)
    const exits = session.snapshot.exits.map((e) => commandForDir(e.dir))
    return [...COMMON_VERBS, ...inv, ...exits]
  }, [session])

  // Best-effort autosave on page hide / tab background
  useEffect(() => {
    if (!session) return

    const onPageHide = () => {
      void flushAutosave()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void flushAutosave()
      }
    }

    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [session, flushAutosave])

  const onSubmit = useCallback(
    (line: string) => {
      void submit(line)
    },
    [submit],
  )

  const onMove = useCallback(
    (dir: Direction) => {
      void submit(commandForDir(dir))
      focusCommandInput()
    },
    [submit],
  )

  const onInsert = useCallback(
    (name: string) => {
      queueInsert(name)
      focusCommandInput()
    },
    [queueInsert],
  )

  const onExamine = useCallback(
    (name: string) => {
      void submit(`examine ${name}`)
      focusCommandInput()
    },
    [submit],
  )

  const onLoadSlot = useCallback(
    async (slotId: string) => {
      if (!session) return
      await openGame(session.gameId, { slotId })
      const err = usePlayStore.getState().error
      // openGame soft-fails into store.error; surface to SaveModal
      if (err) throw new Error(err)
    },
    [session, openGame],
  )

  const onSaveNew = useCallback(
    async (slotId: string, name: string) => {
      await saveToSlot(slotId, name)
    },
    [saveToSlot],
  )

  const onOverwrite = useCallback(
    async (slotId: string, name: string) => {
      await saveToSlot(slotId, name)
    },
    [saveToSlot],
  )

  if (!session) {
    return (
      <div className={styles.root} data-testid="play-workbench">
        <div className={styles.emptySession}>
          <p>No active session.</p>
          <button type="button" className={styles.linkBtn} onClick={returnToLibrary}>
            Library
          </button>
        </div>
      </div>
    )
  }

  const { snapshot, fullTranscript, map } = session
  const disabled = snapshot.waitingFor === 'finished'

  return (
    <div className={styles.root} data-testid="play-workbench">
      <header className={styles.status}>
        <button
          type="button"
          className={styles.libraryBtn}
          onClick={returnToLibrary}
        >
          Library
        </button>
        <div className={styles.statusMain}>
          <StatusBar title={title} status={snapshot.status} />
        </div>
      </header>

      <aside className={styles.left} aria-label="Inventory and compass">
        <div className={styles.inventory}>
          <InventoryPanel
            items={snapshot.inventory}
            onInsert={onInsert}
            onExamine={onExamine}
          />
        </div>
        <div className={styles.compass}>
          <Compass exits={snapshot.exits} onMove={onMove} />
        </div>
      </aside>

      <main className={styles.terminal}>
        <Terminal
          transcript={fullTranscript}
          disabled={disabled}
          onSubmit={onSubmit}
          candidates={candidates}
          insertText={pendingInsert}
          insertId={pendingInsertId}
          onInsertApplied={clearPendingInsert}
        />
      </main>

      <aside className={styles.map} aria-label="Map pane">
        <MapView
          graph={map}
          currentRoomId={snapshot.location.id}
          selectedRoomId={session.selectedRoomId ?? null}
          exits={snapshot.exits}
          onSelectRoom={selectMapRoom}
        />
      </aside>

      <footer className={styles.feelies}>
        <FeeliesStrip
          gameId={session.gameId}
          actions={
            <button
              type="button"
              className={styles.savesBtn}
              onClick={() => setSavesOpen(true)}
              data-testid="saves-button"
            >
              Saves
            </button>
          }
        />
      </footer>

      <SaveModal
        open={savesOpen}
        gameId={session.gameId}
        canSave
        onClose={() => setSavesOpen(false)}
        onLoad={onLoadSlot}
        onSaveNew={onSaveNew}
        onOverwrite={onOverwrite}
      />

      {error != null && error !== '' && (
        <div className={styles.errorBanner} role="alert">
          <span>{error}</span>
          <button type="button" className={styles.linkBtn} onClick={clearError}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
