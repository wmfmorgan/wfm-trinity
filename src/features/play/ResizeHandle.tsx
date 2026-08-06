import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import styles from './ResizeHandle.module.css'

export interface ResizeHandleProps {
  /** Accessible name for the splitter */
  label: string
  orientation?: 'vertical'
  onDrag: (deltaPx: number) => void
  onDragEnd?: () => void
  'data-testid'?: string
}

/**
 * Vertical drag handle between workbench columns.
 * Reports pointer movement in CSS pixels (positive = drag right).
 */
export function ResizeHandle({
  label,
  onDrag,
  onDragEnd,
  'data-testid': testId,
}: ResizeHandleProps) {
  const dragging = useRef<{
    pointerId: number
    lastX: number
  } | null>(null)

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    dragging.current = { pointerId: e.pointerId, lastX: e.clientX }
    e.currentTarget.setPointerCapture(e.pointerId)
    document.body.classList.add('infocom-resizing')
  }, [])

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = dragging.current
      if (!d || d.pointerId !== e.pointerId) return
      const delta = e.clientX - d.lastX
      d.lastX = e.clientX
      if (delta !== 0) onDrag(delta)
    },
    [onDrag],
  )

  const endDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = dragging.current
      if (!d || d.pointerId !== e.pointerId) return
      dragging.current = null
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
      document.body.classList.remove('infocom-resizing')
      onDragEnd?.()
    },
    [onDragEnd],
  )

  return (
    <div
      className={styles.handle}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      tabIndex={0}
      data-testid={testId}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    />
  )
}
