/**
 * Persist workbench column sizes (map share of the terminal+map row).
 */

export const MAP_SHARE_STORAGE_KEY = 'infocom-workbench.mapShare'
export const RAIL_WIDTH_STORAGE_KEY = 'infocom-workbench.railWidthPx'

/** Map column as fraction of (terminal + map) width, 0–1. */
export const DEFAULT_MAP_SHARE = 0.34
export const MIN_MAP_SHARE = 0.18
export const MAX_MAP_SHARE = 0.58

export const DEFAULT_RAIL_WIDTH_PX = 220
export const MIN_RAIL_WIDTH_PX = 140
export const MAX_RAIL_WIDTH_PX = 360

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

export function readMapShare(): number {
  try {
    const raw = localStorage.getItem(MAP_SHARE_STORAGE_KEY)
    if (raw == null) return DEFAULT_MAP_SHARE
    const n = Number(raw)
    if (Number.isFinite(n)) return clamp(n, MIN_MAP_SHARE, MAX_MAP_SHARE)
  } catch {
    /* private mode */
  }
  return DEFAULT_MAP_SHARE
}

export function writeMapShare(share: number): void {
  try {
    localStorage.setItem(
      MAP_SHARE_STORAGE_KEY,
      String(clamp(share, MIN_MAP_SHARE, MAX_MAP_SHARE)),
    )
  } catch {
    /* ignore */
  }
}

export function readRailWidthPx(): number {
  try {
    const raw = localStorage.getItem(RAIL_WIDTH_STORAGE_KEY)
    if (raw == null) return DEFAULT_RAIL_WIDTH_PX
    const n = Number(raw)
    if (Number.isFinite(n))
      return clamp(n, MIN_RAIL_WIDTH_PX, MAX_RAIL_WIDTH_PX)
  } catch {
    /* private mode */
  }
  return DEFAULT_RAIL_WIDTH_PX
}

export function writeRailWidthPx(px: number): void {
  try {
    localStorage.setItem(
      RAIL_WIDTH_STORAGE_KEY,
      String(clamp(px, MIN_RAIL_WIDTH_PX, MAX_RAIL_WIDTH_PX)),
    )
  } catch {
    /* ignore */
  }
}
