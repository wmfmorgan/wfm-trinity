import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { UiScaleControl } from '../../app/UiScaleControl'
import { commandForDir } from '../../domain/directions'
import { COMMON_VERBS } from '../../domain/verbs'
import { FeeliesStrip } from '../feelies/FeeliesStrip'
import { useLibraryStore } from '../library/libraryStore'
import { MapView } from '../map/MapView'
import { SaveModal } from '../saves/SaveModal'
import {
  InventoryPanel,
  readStoredInventoryCollapsed,
} from './InventoryPanel'
import {
  MAX_MAP_SHARE,
  MAX_RAIL_WIDTH_PX,
  MIN_MAP_SHARE,
  MIN_RAIL_WIDTH_PX,
  readMapShare,
  readRailWidthPx,
  writeMapShare,
  writeRailWidthPx,
} from './panelLayout'
import { ResizeHandle } from './ResizeHandle'
import { usePlayStore } from './playStore'
import { StatusBar } from './StatusBar'
import { Terminal } from './Terminal'
import { useMediaQuery } from './useMediaQuery'
import styles from './PlayWorkbench.module.css'

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

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
  /** Drives grid column width so terminal/map reclaim space when inventory folds. */
  const [inventoryCollapsed, setInventoryCollapsed] = useState(() =>
    readStoredInventoryCollapsed(false),
  )
  const [mapShare, setMapShare] = useState(() => readMapShare())
  const [railWidthPx, setRailWidthPx] = useState(() => readRailWidthPx())
  const mapShareRef = useRef(mapShare)
  const railWidthRef = useRef(railWidthPx)
  mapShareRef.current = mapShare
  railWidthRef.current = railWidthPx
  const rootRef = useRef<HTMLDivElement>(null)

  const isNarrow = useMediaQuery('(max-width: 720px)')
  const isMedium = useMediaQuery('(max-width: 1100px)')
  const breakpoint: 'wide' | 'medium' | 'narrow' = isNarrow
    ? 'narrow'
    : isMedium
      ? 'medium'
      : 'wide'

  const onRailResize = useCallback((deltaPx: number) => {
    setRailWidthPx((prev) =>
      clamp(prev + deltaPx, MIN_RAIL_WIDTH_PX, MAX_RAIL_WIDTH_PX),
    )
  }, [])

  const onMapResize = useCallback((deltaPx: number) => {
    const root = rootRef.current
    if (!root) return
    // Available width for terminal+map (approx: root minus rail, gaps, handles)
    const rail =
      root.dataset.inventoryCollapsed === 'true'
        ? 44
        : railWidthRef.current
    const chrome = rail + 8 * 4 + 12 // padding + gaps + splitters
    const available = Math.max(200, root.clientWidth - chrome)
    setMapShare((prev) => {
      // Dragging the map handle right shrinks the map
      const next = prev - deltaPx / available
      return clamp(next, MIN_MAP_SHARE, MAX_MAP_SHARE)
    })
  }, [])

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
  // Game over truly disables input. Busy must NOT disable the command field —
  // HTML disabled inputs drop focus, so every turn would kick the player out.
  const gameOver = snapshot.waitingFor === 'finished'

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

  const layoutStyle = {
    ['--rail-col' as string]: inventoryCollapsed
      ? 'var(--rail-collapsed-width)'
      : `${railWidthPx}px`,
    ['--map-col' as string]: `${Math.round(mapShare * 1000) / 10}%`,
  }

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-testid="play-workbench"
      data-breakpoint={breakpoint}
      data-pane={pane}
      data-inventory-collapsed={inventoryCollapsed ? 'true' : 'false'}
      style={layoutStyle}
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
        <UiScaleControl />
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
        aria-label="Inventory"
        aria-hidden={!showLeft}
        data-testid="workbench-left"
      >
        <div className={styles.inventory}>
          <InventoryPanel
            items={snapshot.inventory}
            onInsert={onInsert}
            onExamine={onExamine}
            collapsed={inventoryCollapsed}
            onCollapsedChange={setInventoryCollapsed}
          />
        </div>
      </aside>

      {showLeft && !inventoryCollapsed && breakpoint !== 'narrow' ? (
        <div className={styles.railSplit}>
          <ResizeHandle
            label="Resize inventory panel"
            data-testid="resize-rail"
            onDrag={onRailResize}
            onDragEnd={() => writeRailWidthPx(railWidthRef.current)}
          />
        </div>
      ) : (
        <div className={styles.railSplitSpacer} aria-hidden />
      )}

      <main
        className={`${styles.terminal}${showTerminal ? '' : ` ${styles.paneHidden}`}`}
        aria-hidden={!showTerminal}
        data-testid="workbench-terminal"
      >
        <Terminal
          transcript={fullTranscript}
          disabled={gameOver}
          busy={busy}
          onSubmit={onSubmit}
          candidates={candidates}
          insertText={pendingInsert}
          insertId={pendingInsertId}
          onInsertApplied={clearPendingInsert}
        />
      </main>

      {breakpoint === 'wide' && showTerminal && showMap ? (
        <div className={styles.mapSplit}>
          <ResizeHandle
            label="Resize map panel"
            data-testid="resize-map"
            onDrag={onMapResize}
            onDragEnd={() => writeMapShare(mapShareRef.current)}
          />
        </div>
      ) : (
        <div className={styles.mapSplitSpacer} aria-hidden />
      )}

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
          gameId={session.gameId}
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
