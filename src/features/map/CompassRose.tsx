import styles from './CompassRose.module.css'

/**
 * Fixed screen-space compass rose for the map panel.
 * North is up to match map layout (dy −1 = north).
 */
export function CompassRose() {
  return (
    <div
      className={styles.root}
      data-testid="map-compass-rose"
      role="img"
      aria-label="Compass: north up, east right, south down, west left"
    >
      <svg
        className={styles.svg}
        viewBox="0 0 72 72"
        width="72"
        height="72"
        aria-hidden="true"
      >
        {/* Outer ring */}
        <circle className={styles.ring} cx="36" cy="36" r="33" />
        <circle className={styles.ringInner} cx="36" cy="36" r="28" />

        {/* Cross ticks */}
        <line className={styles.tick} x1="36" y1="5" x2="36" y2="12" />
        <line className={styles.tick} x1="36" y1="60" x2="36" y2="67" />
        <line className={styles.tick} x1="5" y1="36" x2="12" y2="36" />
        <line className={styles.tick} x1="60" y1="36" x2="67" y2="36" />

        {/* Diagonal tick marks (NE/SE/SW/NW) */}
        <line className={styles.tickDiag} x1="14.5" y1="14.5" x2="19" y2="19" />
        <line className={styles.tickDiag} x1="57.5" y1="14.5" x2="53" y2="19" />
        <line className={styles.tickDiag} x1="14.5" y1="57.5" x2="19" y2="53" />
        <line className={styles.tickDiag} x1="57.5" y1="57.5" x2="53" y2="53" />

        {/* Cardinal needles: north is pointed / filled brighter */}
        <polygon
          className={styles.needleNorth}
          points="36,10 41,36 36,32 31,36"
        />
        <polygon
          className={styles.needleSouth}
          points="36,62 41,36 36,40 31,36"
        />
        <polygon
          className={styles.needleEast}
          points="62,36 36,31 40,36 36,41"
        />
        <polygon
          className={styles.needleWest}
          points="10,36 36,31 32,36 36,41"
        />

        {/* Center hub */}
        <circle className={styles.hub} cx="36" cy="36" r="3.5" />

        {/* Labels (inside viewBox padding so they never clip) */}
        <text
          className={styles.labelN}
          x="36"
          y="11"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          N
        </text>
        <text
          className={styles.labelS}
          x="36"
          y="63"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          S
        </text>
        <text
          className={styles.labelE}
          x="63"
          y="37"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          E
        </text>
        <text
          className={styles.labelW}
          x="9"
          y="37"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          W
        </text>
      </svg>
    </div>
  )
}
