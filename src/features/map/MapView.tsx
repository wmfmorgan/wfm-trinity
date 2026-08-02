import {
  useCallback,
  useEffect,
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
import styles from './MapView.module.css'

export interface MapViewProps {
  graph: MapGraphState
  currentRoomId: string
  selectedRoomId?: string | null
  exits: ExitInfo[]
  onSelectRoom: (id: string | null) => void
  onRecenter?: () => void
}

interface Camera {
  /** World-space center of the viewport */
  x: number
  y: number
  /** Zoom scale (1 = 1 world unit per CSS pixel) */
  k: number
}

const MIN_K = 0.4
const MAX_K = 2.5
const NODE_W = 56
const NODE_H = 28
const STUB_LEN = 28
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

function truncateLabel(name: string, max = 12): string {
  if (name.length <= max) return name
  return name.slice(0, max - 1) + '…'
}

export function MapView({
  graph,
  currentRoomId,
  selectedRoomId = null,
  exits,
  onSelectRoom,
  onRecenter,
}: MapViewProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ w: 320, h: 240 })
  const [camera, setCamera] = useState<Camera>(() => {
    const node = graph.nodes[currentRoomId]
    return { x: node?.x ?? 0, y: node?.y ?? 0, k: 1 }
  })

  const dragRef = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    startCamX: number
    startCamY: number
    moved: boolean
  } | null>(null)

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
      setCamera((c) => {
        const curVbW = size.w / c.k
        const curVbH = size.h / c.k
        const worldX = c.x - curVbW / 2 + sx * curVbW
        const worldY = c.y - curVbH / 2 + sy * curVbH
        const factor = Math.exp(-e.deltaY * 0.0015)
        const newK = clamp(c.k * factor, MIN_K, MAX_K)
        if (newK === c.k) return c
        const newVbW = size.w / newK
        const newVbH = size.h / newK
        return {
          x: worldX - sx * newVbW + newVbW / 2,
          y: worldY - sy * newVbH + newVbH / 2,
          k: newK,
        }
      })
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

  const vbW = size.w / camera.k
  const vbH = size.h / camera.k
  const viewBox = `${camera.x - vbW / 2} ${camera.y - vbH / 2} ${vbW} ${vbH}`

  const nodes = Object.values(graph.nodes)
  const isEmpty = nodes.length === 0

  function onPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    // Only primary button; ignore node/button interactions via stopPropagation there
    if (e.button !== 0) return
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
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    const dx = e.clientX - d.startClientX
    const dy = e.clientY - d.startClientY
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) d.moved = true
    // Screen drag right → world moves left relative to camera center
    setCamera((c) => ({
      ...c,
      x: d.startCamX - dx / c.k,
      y: d.startCamY - dy / c.k,
    }))
  }

  function onPointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    if (!d.moved) {
      // Click empty background → clear selection
      onSelectRoom(null)
    }
    dragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }

  function onRoomClick(e: ReactPointerEvent, id: string) {
    e.stopPropagation()
    onSelectRoom(id)
  }

  const stubs = exits.filter(
    (ex) =>
      !hasKnownEdgeTarget(graph.edges, graph.nodes, currentRoomId, ex.dir),
  )

  const currentNode = graph.nodes[currentRoomId]

  return (
    <section className={styles.root} aria-label="Map">
      <header className={styles.header}>
        <span className={styles.title}>Map</span>
        <button
          type="button"
          className={styles.recenterBtn}
          onClick={recenter}
          aria-label="Recenter map on current room"
        >
          Recenter
        </button>
      </header>
      <div className={styles.viewport}>
        {isEmpty ? (
          <p className={styles.empty} role="status">
            Explore to chart the map.
          </p>
        ) : null}
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
          {/* Edges */}
          <g className={styles.edges} aria-hidden>
            {graph.edges.map((e, i) => {
              const a = graph.nodes[e.fromId]
              const b = graph.nodes[e.toId]
              if (!a || !b) return null
              return (
                <line
                  key={edgeKey(e, i)}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className={styles.edge}
                />
              )
            })}
          </g>

          {/* Exit stubs from current room */}
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

          {/* Room nodes */}
          <g className={styles.nodes}>
            {nodes.map((node) => {
              const isCurrent = node.id === currentRoomId
              const isSelected = node.id === selectedRoomId
              const classNames = [
                styles.node,
                isCurrent ? styles.current : '',
                isSelected ? styles.selected : '',
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
                  onPointerDown={(e) => onRoomClick(e, node.id)}
                  role="button"
                  tabIndex={0}
                  aria-label={
                    isCurrent
                      ? `Current room: ${node.name}`
                      : `Room: ${node.name}`
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectRoom(node.id)
                    }
                  }}
                >
                  <rect
                    x={-NODE_W / 2}
                    y={-NODE_H / 2}
                    width={NODE_W}
                    height={NODE_H}
                    rx={4}
                    ry={4}
                    className={styles.nodeRect}
                  />
                  <text
                    className={styles.nodeLabel}
                    textAnchor="middle"
                    dominantBaseline="central"
                    y={1}
                  >
                    {truncateLabel(node.name || node.id)}
                  </text>
                  <title>{node.name || node.id}</title>
                </g>
              )
            })}
          </g>
        </svg>
      </div>
    </section>
  )
}
