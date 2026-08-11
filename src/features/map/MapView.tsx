import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { deltaForDir, reverseDir } from '../../domain/directions'
import type {
  Direction,
  ExitInfo,
  MapEdge,
  MapGraphState,
  RoomNode,
} from '../../domain/types'
import {
  getRoomNote,
  listNotedRoomIds,
  putRoomNote,
} from '../../persistence/roomNotesRepo'
import { CompassRose } from './CompassRose'
import { isLayoutDir, isVerticalDir } from './mapLayout'
import styles from './MapView.module.css'

export interface MapViewProps {
  graph: MapGraphState
  currentRoomId: string
  selectedRoomId?: string | null
  exits: ExitInfo[]
  onSelectRoom: (id: string | null) => void
  onRecenter?: () => void
  /** When set, room notes load/save under this game id. */
  gameId?: string
  /** User finished dragging a room to a new world position. */
  onRoomMove?: (roomId: string, x: number, y: number) => void
}

interface Camera {
  /** World-space center of the viewport */
  x: number
  y: number
  /** Zoom scale (higher = zoomed in) */
  k: number
}

/** Zoom range — wide enough for pan/explore and reading long room names. */
export const MIN_K = 0.35
export const MAX_K = 5
const ZOOM_STEP = 1.25

/** Room box size in world units (fits 2-line labels without spill). */
export const NODE_W = 96
export const NODE_H = 44
const STUB_LEN = 32
const EDGE_PAD = 4

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/** Unit vector for exit stubs; non-planar dirs get fixed offsets. */
function stubVector(dir: Direction): { dx: number; dy: number } {
  const d = deltaForDir(dir)
  if (d.dx !== 0 || d.dy !== 0) return d
  switch (dir) {
    case 'up':
      return { dx: 0, dy: -1 }
    case 'down':
      return { dx: 0, dy: 1 }
    case 'in':
      return { dx: 0.5, dy: -0.5 }
    case 'out':
      return { dx: -0.5, dy: 0.5 }
    default:
      return { dx: 0, dy: -1 }
  }
}

function hasKnownEdgeTarget(
  edges: MapEdge[],
  nodes: Record<string, RoomNode>,
  currentRoomId: string,
  dir: Direction,
): boolean {
  for (const e of edges) {
    if (
      e.fromId === currentRoomId &&
      e.dir === dir &&
      nodes[e.toId] != null
    ) {
      return true
    }
    if (
      e.bidirectional &&
      e.toId === currentRoomId &&
      e.dir != null &&
      reverseDir(e.dir) === dir &&
      nodes[e.fromId] != null
    ) {
      return true
    }
  }
  return false
}

function edgeKey(e: MapEdge, i: number): string {
  return `${e.fromId}->${e.toId}:${e.dir ?? '?'}:${i}`
}

/**
 * Zoom camera by a multiplicative factor, keeping a screen-fraction point fixed
 * in world space (sx/sy in 0..1 of the viewport).
 */
function zoomCamera(
  c: Camera,
  size: { w: number; h: number },
  factor: number,
  sx = 0.5,
  sy = 0.5,
): Camera {
  const curVbW = size.w / c.k
  const curVbH = size.h / c.k
  const worldX = c.x - curVbW / 2 + sx * curVbW
  const worldY = c.y - curVbH / 2 + sy * curVbH
  const newK = clamp(c.k * factor, MIN_K, MAX_K)
  if (newK === c.k) return c
  const newVbW = size.w / newK
  const newVbH = size.h / newK
  return {
    x: worldX - sx * newVbW + newVbW / 2,
    y: worldY - sy * newVbH + newVbH / 2,
    k: newK,
  }
}

export function MapView({
  graph,
  currentRoomId,
  selectedRoomId = null,
  exits,
  onSelectRoom,
  onRecenter,
  gameId,
  onRoomMove,
}: MapViewProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ w: 320, h: 240 })
  const [camera, setCamera] = useState<Camera>(() => {
    const node = graph.nodes[currentRoomId]
    return { x: node?.x ?? 0, y: node?.y ?? 0, k: 1 }
  })
  const [notedRoomIds, setNotedRoomIds] = useState<Set<string>>(() => new Set())
  const [noteText, setNoteText] = useState('')
  const [noteStatus, setNoteStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  )
  /** Live drag overrides so rooms move under the cursor without waiting for parent. */
  const [dragPos, setDragPos] = useState<Record<string, { x: number; y: number }>>(
    {},
  )
  const noteSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noteLoadGen = useRef(0)

  const dragRef = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    startCamX: number
    startCamY: number
    moved: boolean
  } | null>(null)

  const roomDragRef = useRef<{
    pointerId: number
    roomId: string
    grabDx: number
    grabDy: number
    startX: number
    startY: number
    lastX: number
    lastY: number
    moved: boolean
  } | null>(null)

  // Load which rooms have notes (for map markers)
  useEffect(() => {
    if (!gameId) {
      setNotedRoomIds(new Set())
      return
    }
    let cancelled = false
    void listNotedRoomIds(gameId)
      .then((ids) => {
        if (!cancelled) setNotedRoomIds(new Set(ids))
      })
      .catch(() => {
        /* unmount / idb teardown in tests */
      })
    return () => {
      cancelled = true
    }
  }, [gameId])

  // Load note when selection changes
  useEffect(() => {
    if (!gameId || !selectedRoomId) {
      setNoteText('')
      setNoteStatus('idle')
      return
    }
    const gen = ++noteLoadGen.current
    setNoteStatus('idle')
    void getRoomNote(gameId, selectedRoomId)
      .then((rec) => {
        if (noteLoadGen.current !== gen) return
        setNoteText(rec?.text ?? '')
      })
      .catch(() => {
        /* unmount / idb teardown in tests */
      })
  }, [gameId, selectedRoomId])

  const scheduleNoteSave = useCallback(
    (roomId: string, text: string) => {
      if (!gameId) return
      if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current)
      setNoteStatus('saving')
      noteSaveTimer.current = setTimeout(() => {
        void putRoomNote(gameId, roomId, text)
          .then(() => {
            setNoteStatus('saved')
            setNotedRoomIds((prev) => {
              const next = new Set(prev)
              if (text.trim()) next.add(roomId)
              else next.delete(roomId)
              return next
            })
            window.setTimeout(() => {
              setNoteStatus((s) => (s === 'saved' ? 'idle' : s))
            }, 1200)
          })
          .catch(() => setNoteStatus('error'))
      }, 400)
    },
    [gameId],
  )

  useEffect(() => {
    return () => {
      if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current)
    }
  }, [])

  // Track SVG client size for viewBox + wheel math
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) {
        setSize({ w: r.width, h: r.height })
      }
    }
    update()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update)
      return () => window.removeEventListener('resize', update)
    }
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Non-passive wheel so preventDefault can stop page scroll while zooming
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const sx = r.width > 0 ? (e.clientX - r.left) / r.width : 0.5
      const sy = r.height > 0 ? (e.clientY - r.top) / r.height : 0.5
      // Trackpad pinch often reports ctrlKey; still treat as zoom
      const factor = Math.exp(-e.deltaY * 0.002)
      setCamera((c) => zoomCamera(c, size, factor, sx, sy))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [size.w, size.h])

  const recenter = useCallback(() => {
    const node = graph.nodes[currentRoomId]
    setCamera((c) => ({
      ...c,
      x: node?.x ?? 0,
      y: node?.y ?? 0,
    }))
    onRecenter?.()
  }, [graph.nodes, currentRoomId, onRecenter])

  const zoomBy = useCallback(
    (factor: number) => {
      setCamera((c) => zoomCamera(c, size, factor, 0.5, 0.5))
    },
    [size],
  )

  const vbW = size.w / camera.k
  const vbH = size.h / camera.k
  const viewBox = `${camera.x - vbW / 2} ${camera.y - vbH / 2} ${vbW} ${vbH}`

  function clientToWorld(
    clientX: number,
    clientY: number,
  ): { x: number; y: number } {
    const el = svgRef.current
    if (!el) return { x: camera.x, y: camera.y }
    const r = el.getBoundingClientRect()
    const sx = r.width > 0 ? (clientX - r.left) / r.width : 0.5
    const sy = r.height > 0 ? (clientY - r.top) / r.height : 0.5
    return {
      x: camera.x - vbW / 2 + sx * vbW,
      y: camera.y - vbH / 2 + sy * vbH,
    }
  }

  const nodes = Object.values(graph.nodes).map((n) => {
    const d = dragPos[n.id]
    return d ? { ...n, x: d.x, y: d.y } : n
  })
  const isEmpty = nodes.length === 0
  const zoomPct = Math.round(camera.k * 100)
  const canZoomIn = camera.k < MAX_K - 1e-6
  const canZoomOut = camera.k > MIN_K + 1e-6
  const selectedNode =
    selectedRoomId != null
      ? nodes.find((n) => n.id === selectedRoomId) ??
        graph.nodes[selectedRoomId]
      : undefined
  const selectedLabel = selectedNode?.name || selectedRoomId || ''

  function onPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return
    if (roomDragRef.current) return
    const target = e.target as Element
    if (target.closest('[data-room-id]')) return
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCamX: camera.x,
      startCamY: camera.y,
      moved: false,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    const rd = roomDragRef.current
    if (rd && rd.pointerId === e.pointerId) {
      const w = clientToWorld(e.clientX, e.clientY)
      const x = w.x - rd.grabDx
      const y = w.y - rd.grabDy
      if (
        Math.hypot(x - rd.startX, y - rd.startY) > 4 / Math.max(camera.k, 0.01)
      ) {
        rd.moved = true
      }
      rd.lastX = x
      rd.lastY = y
      setDragPos((prev) => ({ ...prev, [rd.roomId]: { x, y } }))
      return
    }
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    const dx = e.clientX - d.startClientX
    const dy = e.clientY - d.startClientY
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) d.moved = true
    setCamera((c) => ({
      ...c,
      x: d.startCamX - dx / c.k,
      y: d.startCamY - dy / c.k,
    }))
  }

  function onPointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    const rd = roomDragRef.current
    if (rd && rd.pointerId === e.pointerId) {
      roomDragRef.current = null
      if (rd.moved && onRoomMove) {
        onRoomMove(rd.roomId, rd.lastX, rd.lastY)
      } else if (!rd.moved) {
        onSelectRoom(rd.roomId)
      }
      setDragPos((prev) => {
        const next = { ...prev }
        delete next[rd.roomId]
        return next
      })
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
      return
    }

    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    if (!d.moved) {
      onSelectRoom(null)
    }
    dragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }

  function onRoomPointerDown(e: ReactPointerEvent, id: string) {
    e.stopPropagation()
    if (e.button !== 0) return
    const node = graph.nodes[id]
    if (!node) return
    const w = clientToWorld(e.clientX, e.clientY)
    roomDragRef.current = {
      pointerId: e.pointerId,
      roomId: id,
      grabDx: w.x - node.x,
      grabDy: w.y - node.y,
      startX: node.x,
      startY: node.y,
      lastX: node.x,
      lastY: node.y,
      moved: false,
    }
    setDragPos((prev) => ({ ...prev, [id]: { x: node.x, y: node.y } }))
    const svg = svgRef.current
    if (svg && typeof svg.setPointerCapture === 'function') {
      try {
        svg.setPointerCapture(e.pointerId)
      } catch {
        /* jsdom / unsupported */
      }
    }
  }

  const stubs = exits.filter(
    (ex) =>
      !hasKnownEdgeTarget(graph.edges, graph.nodes, currentRoomId, ex.dir),
  )

  const currentNode =
    nodes.find((n) => n.id === currentRoomId) ?? graph.nodes[currentRoomId]

  // Edges use live drag positions
  const nodeById = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>()
    for (const n of nodes) m.set(n.id, n)
    return m
  }, [nodes])

  return (
    <section className={styles.root} aria-label="Map">
      <header className={styles.header}>
        <span className={styles.title}>Map</span>
        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => zoomBy(1 / ZOOM_STEP)}
            disabled={!canZoomOut}
            aria-label="Zoom out"
            data-testid="map-zoom-out"
          >
            −
          </button>
          <span className={styles.zoomLabel} data-testid="map-zoom-label">
            {zoomPct}%
          </span>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => zoomBy(ZOOM_STEP)}
            disabled={!canZoomIn}
            aria-label="Zoom in"
            data-testid="map-zoom-in"
          >
            +
          </button>
          <button
            type="button"
            className={styles.recenterBtn}
            onClick={recenter}
            aria-label="Recenter map on current room"
          >
            Recenter
          </button>
        </div>
      </header>
      <div className={styles.viewport}>
        {isEmpty ? (
          <p className={styles.empty} role="status">
            Explore to chart the map.
          </p>
        ) : null}
        <CompassRose />
        <svg
          ref={svgRef}
          className={styles.svg}
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="img"
          aria-label="Game map"
          data-zoom={camera.k.toFixed(2)}
        >
          <g className={styles.edges} aria-hidden>
            {graph.edges.map((e, i) => {
              // Only draw layout edges (cardinals/diagonals/up/down).
              // Legacy null/in/out edges (teleports) stay unconnected.
              if (!isLayoutDir(e.dir)) return null
              const a = nodeById.get(e.fromId)
              const b = nodeById.get(e.toId)
              if (!a || !b) return null
              const vertical = isVerticalDir(e.dir)
              const midX = (a.x + b.x) / 2
              const midY = (a.y + b.y) / 2
              const label =
                e.dir === 'up' ? '↑' : e.dir === 'down' ? '↓' : null
              return (
                <g key={edgeKey(e, i)}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className={vertical ? styles.edgeVertical : styles.edge}
                    data-edge-dir={e.dir ?? undefined}
                  />
                  {label ? (
                    <text
                      x={midX}
                      y={midY}
                      className={styles.edgeLabel}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {label}
                    </text>
                  ) : null}
                </g>
              )
            })}
          </g>

          {currentNode && stubs.length > 0 ? (
            <g className={styles.stubs} aria-hidden>
              {stubs.map((ex) => {
                const v = stubVector(ex.dir)
                const len = Math.hypot(v.dx, v.dy) || 1
                const nx = v.dx / len
                const ny = v.dy / len
                const x1 = currentNode.x + nx * (NODE_W / 2 + EDGE_PAD)
                const y1 = currentNode.y + ny * (NODE_H / 2 + EDGE_PAD)
                const x2 = x1 + nx * STUB_LEN
                const y2 = y1 + ny * STUB_LEN
                return (
                  <line
                    key={`stub-${ex.dir}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    className={styles.stub}
                    data-stub-dir={ex.dir}
                  />
                )
              })}
            </g>
          ) : null}

          <g className={styles.nodes}>
            {nodes.map((node) => {
              const isCurrent = node.id === currentRoomId
              const isSelected = node.id === selectedRoomId
              const hasNote = notedRoomIds.has(node.id)
              const label = node.name || node.id
              const classNames = [
                styles.node,
                isCurrent ? styles.current : '',
                isSelected ? styles.selected : '',
                hasNote ? styles.hasNote : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <g
                  key={node.id}
                  className={classNames}
                  transform={`translate(${node.x}, ${node.y})`}
                  data-room-id={node.id}
                  data-current={isCurrent ? 'true' : undefined}
                  data-selected={isSelected ? 'true' : undefined}
                  data-has-note={hasNote ? 'true' : undefined}
                  data-manual={node.manual ? 'true' : undefined}
                  onPointerDown={(e) => onRoomPointerDown(e, node.id)}
                  role="button"
                  tabIndex={0}
                  style={{ cursor: onRoomMove ? 'grab' : 'pointer' }}
                  aria-label={
                    isCurrent
                      ? `Current room: ${label}${hasNote ? ' (has notes)' : ''}${node.manual ? ' (pinned)' : ''}`
                      : `Room: ${label}${hasNote ? ' (has notes)' : ''}${node.manual ? ' (pinned)' : ''}`
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectRoom(node.id)
                    }
                  }}
                >
                  <title>
                    {label}
                    {hasNote ? ' — has notes' : ''}
                  </title>
                  <rect
                    x={-NODE_W / 2}
                    y={-NODE_H / 2}
                    width={NODE_W}
                    height={NODE_H}
                    rx={5}
                    ry={5}
                    className={styles.nodeRect}
                  />
                  {/*
                    foreignObject + CSS clamps long names inside the box.
                    Full name remains in <title> and aria-label.
                  */}
                  <foreignObject
                    x={-NODE_W / 2}
                    y={-NODE_H / 2}
                    width={NODE_W}
                    height={NODE_H}
                    className={styles.labelForeign}
                  >
                    <div
                      // Required for HTML inside SVG foreignObject (React typing omits xmlns on div)
                      {...{ xmlns: 'http://www.w3.org/1999/xhtml' }}
                      className={styles.labelBox}
                      title={label}
                    >
                      <span className={styles.labelText}>{label}</span>
                    </div>
                  </foreignObject>
                  {hasNote ? (
                    <circle
                      className={styles.noteDot}
                      cx={NODE_W / 2 - 6}
                      cy={-NODE_H / 2 + 6}
                      r={4}
                      aria-hidden
                    />
                  ) : null}
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      {gameId && selectedRoomId && selectedNode ? (
        <div className={styles.notesPanel} data-testid="room-notes-panel">
          <div className={styles.notesHeader}>
            <span className={styles.notesTitle}>
              Notes — {selectedLabel}
            </span>
            <span className={styles.notesStatus} data-testid="room-notes-status">
              {noteStatus === 'saving'
                ? 'Saving…'
                : noteStatus === 'saved'
                  ? 'Saved'
                  : noteStatus === 'error'
                    ? 'Save failed'
                    : ''}
            </span>
            <button
              type="button"
              className={styles.notesClose}
              aria-label="Close notes"
              onClick={() => onSelectRoom(null)}
            >
              ×
            </button>
          </div>
          <textarea
            className={styles.notesInput}
            data-testid="room-notes-input"
            value={noteText}
            placeholder="Notes for this room (saved automatically)…"
            rows={4}
            onChange={(e) => {
              const text = e.target.value
              setNoteText(text)
              scheduleNoteSave(selectedRoomId, text)
            }}
            onPointerDown={(e) => e.stopPropagation()}
          />
        </div>
      ) : gameId ? (
        <p className={styles.notesHint} data-testid="room-notes-hint">
          Click a room to select it and add notes.
        </p>
      ) : null}
    </section>
  )
}
