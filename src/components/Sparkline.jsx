import { useId } from "react"

// A minimal inline trend line for KPI tiles — the Stripe move of putting a
// KPI's own trajectory inside the tile (value + delta + sparkline) instead
// of only in a separate full-width chart. Monochrome, no axes or labels: it
// reads as direction-of-travel at a glance, and inherits `currentColor` so a
// tile can tint it to match its own accent (brand blue for volume, rose
// for regulatory pressure). The fill under the line is a fade to
// transparent rather than a flat tint, matching the full-size charts.
function Sparkline({ values, width = 120, height = 28, className = "" }) {
  // The fill gradient inherits `currentColor`, so two sparklines tinted
  // differently must not share a gradient id — whichever <defs> rendered
  // last would win for both. useId gives each instance its own.
  const gradientId = useId()

  if (!values || values.length === 0) return null

  const max = Math.max(...values, 1)
  const stepX = width / Math.max(values.length - 1, 1)
  const points = values.map((v, i) => [i * stepX, height - (v / max) * (height - 2) - 1])
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
  const area = `${line} L${width},${height} L0,${height} Z`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`w-full ${className}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="30-day trend"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} stroke="none" />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export default Sparkline
