import { useId, useRef, useState } from 'react'
import type { InventoryItem } from '../../domain/types'
import styles from './panels.module.css'

export interface InventoryPanelProps {
  items: InventoryItem[]
  onInsert: (name: string) => void
  onExamine: (name: string) => void
  /** Controlled collapse; when omitted, panel manages its own open state. */
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  /** Initial open state for uncontrolled mode (default: expanded). */
  defaultCollapsed?: boolean
}

const CLICK_DELAY_MS = 280
export const INVENTORY_COLLAPSED_STORAGE_KEY =
  'infocom-workbench.inventoryCollapsed'

export function readStoredInventoryCollapsed(fallback = false): boolean {
  try {
    const raw = localStorage.getItem(INVENTORY_COLLAPSED_STORAGE_KEY)
    if (raw === '1') return true
    if (raw === '0') return false
  } catch {
    /* private mode */
  }
  return fallback
}

function writeStoredCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(INVENTORY_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function InventoryPanel({
  items,
  onInsert,
  onExamine,
  collapsed: collapsedProp,
  onCollapsedChange,
  defaultCollapsed = false,
}: InventoryPanelProps) {
  const bodyId = useId()
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [internalCollapsed, setInternalCollapsed] = useState(() =>
    collapsedProp === undefined
      ? readStoredInventoryCollapsed(defaultCollapsed)
      : defaultCollapsed,
  )

  const collapsed =
    collapsedProp !== undefined ? collapsedProp : internalCollapsed

  function setCollapsed(next: boolean) {
    if (collapsedProp === undefined) {
      setInternalCollapsed(next)
    }
    writeStoredCollapsed(next)
    onCollapsedChange?.(next)
  }

  function clearClickTimer() {
    if (clickTimer.current != null) {
      clearTimeout(clickTimer.current)
      clickTimer.current = null
    }
  }

  function handleClick(name: string) {
    clearClickTimer()
    // Defer insert so a double-click only examines (no insert burst).
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null
      onInsert(name)
    }, CLICK_DELAY_MS)
  }

  function handleDoubleClick(name: string) {
    clearClickTimer()
    onExamine(name)
  }

  const countLabel = items.length > 0 ? ` (${items.length})` : ''

  return (
    <section
      className={`${styles.panel}${collapsed ? ` ${styles.panelCollapsed}` : ''}`}
      aria-label="Inventory"
      data-collapsed={collapsed ? 'true' : 'false'}
      data-testid="inventory-panel"
    >
      <header className={styles.panelHeader}>
        <button
          type="button"
          className={styles.panelHeaderToggle}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={() => setCollapsed(!collapsed)}
          data-testid="inventory-toggle"
        >
          <span className={styles.panelHeaderTitle}>
            {collapsed ? `Inv${countLabel}` : `Inventory${countLabel}`}
          </span>
          <span className={styles.panelChevron} aria-hidden>
            {collapsed ? '▸' : '▾'}
          </span>
        </button>
      </header>
      {!collapsed ? (
        <div className={styles.panelBody} id={bodyId}>
          {items.length === 0 ? (
            <p className={styles.inventoryEmpty}>You are empty-handed.</p>
          ) : (
            <ul className={styles.inventoryList}>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={styles.inventoryItem}
                    title={item.name}
                    onClick={() => handleClick(item.name)}
                    onDoubleClick={() => handleDoubleClick(item.name)}
                  >
                    {item.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  )
}
