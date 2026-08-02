import { useRef } from 'react'
import type { InventoryItem } from '../../domain/types'
import styles from './panels.module.css'

export interface InventoryPanelProps {
  items: InventoryItem[]
  onInsert: (name: string) => void
  onExamine: (name: string) => void
}

const CLICK_DELAY_MS = 280

export function InventoryPanel({
  items,
  onInsert,
  onExamine,
}: InventoryPanelProps) {
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  return (
    <section className={styles.panel} aria-label="Inventory">
      <header className={styles.panelHeader}>Inventory</header>
      <div className={styles.panelBody}>
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
    </section>
  )
}
