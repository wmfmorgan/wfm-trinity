/** Derive 1–2 letter monogram from a game title. */
export function monogramFromTitle(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) {
    const w = words[0]
    return w.slice(0, Math.min(2, w.length)).toUpperCase()
  }
  const a = words[0][0] ?? ''
  const b = words[1][0] ?? ''
  return (a + b).toUpperCase() || '?'
}

export interface CoverPlaceholderProps {
  title: string
  className?: string
}

/** CRT monogram tile used when a game has no cover image. */
export function CoverPlaceholder({ title, className }: CoverPlaceholderProps) {
  const monogram = monogramFromTitle(title)
  return (
    <div
      className={className}
      role="img"
      aria-label={`${title} cover placeholder`}
      data-testid="cover-placeholder"
    >
      <span aria-hidden="true">{monogram}</span>
    </div>
  )
}
