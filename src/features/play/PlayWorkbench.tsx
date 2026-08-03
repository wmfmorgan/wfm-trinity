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
import { useMediaQuery } from './useMediaQuery'
import styles from './PlayWorkbench.module.css'

export type WorkbenchPane = 'play' | 'map' | 'inv' | 'more'

function focusCommandInput() {
  const el = document.getElementById('command-input')
  if (el instanceof HTMLInputElement) {
    el.focus()
  }
}

export function PlayWorkbench() {
  const session = usePlayStore((s) => s.session)
  const busy = usePlayStore((s) => s.busy)
  const pendingInsert = usePlayStore((s) => s.pendingInsert)
  const pendingInsertId = usePlayStore((s) => s.pendingInsertId)
  const submit = usePlayStore((s) => s.submit)
  const selectMapRoom = usePlayStore((s) => s.selectMapRoom)
  const queueInsert = usePlayStore((s) => s.queueInsert)
  const clearPendingInsert = usePlayStore((s) => s.clearPendingInsert)
  const returnToLibrary = usePlayStore((s) => s.returnToLibrary)
  const openGame = usePlayStore((s) => s.openGame)
  const saveToSlot = usePlayStore((s) => s.saveToSlot)
  const flushAutosave = usePlayStore((s) => s.flushAutosave)

  const games = useLibraryStore((s) => s.games)
  const [savesOpen, setSavesOpen] = useState(false)
  /** Local responsive tab state (medium: play|map; narrow: play|map|inv|more). */
  const [pane, setPane] = useState<WorkbenchPane>('play')

  const isNarrow = useMediaQuery('(max-width: 720px)')
  const isMedium = useMediaQuery('(max-width: 1100px)')
  const breakpoint: 'wide' | 'medium' | 'narrow' = isNarrow
    ? 'narrow'
    : isMedium
      ? 'medium'
      : 'wide'

  // Medium only supports play|map tabs — drop inv/more when leaving narrow
  useEffect(() => {
    if (breakpoint !== 'narrow' && (pane === 'inv' || pane === 'more')) {
      setPane('play')
    }
  }, [breakpoint, pane])

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
      <div
        className={styles.root}
        data-testid="play-workbench"
        data-breakpoint={breakpoint}
      >
        <div className={styles.scanlines} aria-hidden="true" />
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
  const disabled = snapshot.waitingFor === 'finished' || busy

  // Visibility by breakpoint + local pane
  const showLeft =
    breakpoint === 'wide' ||
    breakpoint === 'medium' ||
    (breakpoint === 'narrow' && pane === 'inv')
  const showTerminal =
    breakpoint === 'wide' ||
    (breakpoint === 'medium' && pane !== 'map') ||
    (breakpoint === 'narrow' && pane === 'play')
  const showMap =
    breakpoint === 'wide' ||
    (breakpoint === 'medium' && pane === 'map') ||
    (breakpoint === 'narrow' && pane === 'map')
  const showFeelies =
    breakpoint === 'wide' ||
    breakpoint === 'medium' ||
    (breakpoint === 'narrow' && pane === 'more')

  const showMediumTabs = breakpoint === 'medium'
  const showNarrowTabs = breakpoint === 'narrow'

  const savesAction = (
    <button
      type="button"
      className={styles.savesBtn}
      onClick={() => setSavesOpen(true)}
      data-testid="saves-button"
    >
      Saves
    </button>
  )

  return (
    <div
      className={styles.root}
      data-testid="play-workbench"
      data-breakpoint={breakpoint}
      data-pane={pane}
    >
      <div className={styles.scanlines} aria-hidden="true" />

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

      {showMediumTabs && (
        <nav
          className={styles.tabs}
          role="tablist"
          aria-label="Workbench views"
          data-testid="workbench-tabs-medium"
        >
          <TabButton
            id="play"
            label="Play"
            selected={pane !== 'map'}
            onSelect={() => setPane('play')}
          />
          <TabButton
            id="map"
            label="Map"
            selected={pane === 'map'}
            onSelect={() => setPane('map')}
          />
        </nav>
      )}

      {showNarrowTabs && (
        <nav
          className={styles.tabs}
          role="tablist"
          aria-label="Workbench views"
          data-testid="workbench-tabs-narrow"
        >
          <TabButton
            id="play"
            label="Play"
            selected={pane === 'play'}
            onSelect={() => setPane('play')}
          />
          <TabButton
            id="map"
            label="Map"
            selected={pane === 'map'}
            onSelect={() => setPane('map')}
          />
          <TabButton
            id="inv"
            label="Inv"
            selected={pane === 'inv'}
            onSelect={() => setPane('inv')}
          />
          <TabButton
            id="more"
            label="More"
            selected={pane === 'more'}
            onSelect={() => setPane('more')}
          />
        </nav>
      )}

      <aside
        className={`${styles.left}${showLeft ? '' : ` ${styles.paneHidden}`}`}
        aria-label="Inventory and compass"
        aria-hidden={!showLeft}
        data-testid="workbench-left"
      >
        <div className={styles.inventory}>
          <InventoryPanel
            items={snapshot.inventory}
            onInsert={onInsert}
            onExamine={onExamine}
          />
        </div>
        <div className={styles.compass}>
          <Compass exits={snapshot.exits} onMove={onMove} disabled={disabled} />
        </div>
      </aside>

      <main
        className={`${styles.terminal}${showTerminal ? '' : ` ${styles.paneHidden}`}`}
        aria-hidden={!showTerminal}
        data-testid="workbench-terminal"
      >
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

      <aside
        className={`${styles.map}${showMap ? '' : ` ${styles.paneHidden}`}`}
        aria-label="Map pane"
        aria-hidden={!showMap}
        data-testid="workbench-map"
      >
        <MapView
          graph={map}
          currentRoomId={snapshot.location.id}
          selectedRoomId={session.selectedRoomId ?? null}
          exits={snapshot.exits}
          onSelectRoom={selectMapRoom}
        />
      </aside>

      <footer
        className={`${styles.feelies}${showFeelies ? '' : ` ${styles.paneHidden}`}`}
        aria-hidden={!showFeelies}
        data-testid="workbench-feelies"
      >
        <FeeliesStrip gameId={session.gameId} actions={savesAction} />
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
    </div>
  )
}

function TabButton({
  id,
  label,
  selected,
  onSelect,
}: {
  id: string
  label: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`workbench-tab-${id}`}
      aria-selected={selected}
      className={selected ? styles.tabActive : styles.tab}
      onClick={onSelect}
      data-testid={`workbench-tab-${id}`}
    >
      {label}
    </button>
  )
}
