const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function formatShortDate(dateString) {
  const [, month, day] = dateString.split("-").map(Number)
  return `${MONTHS[month - 1]} ${day}`
}

function buildPath(values, width, height, max) {
  const stepX = width / Math.max(values.length - 1, 1)
  return values
    .map((v, i) => {
      const x = i * stepX
      const y = height - (v / max) * height
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(" ")
}

// Four evenly-spaced horizontal rules and nothing else. Vertical gridlines
// would box the plot in; the dashes keep the rules from competing with the
// series for attention, which is the whole reason they're dotted rather
// than solid.
const GRIDLINES = [0, 0.25, 0.5, 0.75, 1]

function VolumeChart({ buckets }) {
  const width = 640
  const height = 160
  const macro = buckets.map((b) => b.macro)
  const micro = buckets.map((b) => b.micro)
  const max = Math.max(...macro, ...micro, 1)

  const macroPath = buildPath(macro, width, height, max)
  const microPath = buildPath(micro, width, height, max)
  const macroArea = `${macroPath} L${width},${height} L0,${height} Z`
  const microArea = `${microPath} L${width},${height} L0,${height} Z`

  const first = buckets[0]
  const mid = buckets[Math.floor(buckets.length / 2)]
  const last = buckets[buckets.length - 1]

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Signal volume, macro vs micro, last 30 days"
      >
        <defs>
          {/* A fill that fades out toward the axis rather than a flat
              tint — the area then reads as volume under the line instead
              of as a second solid shape fighting the line for attention. */}
          <linearGradient id="volume-micro-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="volume-macro-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.12" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g className="text-slate-300 dark:text-zinc-700">
          {GRIDLINES.map((ratio) => (
            <line
              key={ratio}
              x1="0"
              x2={width}
              y1={height * ratio}
              y2={height * ratio}
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="2 5"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>

        <g className="text-slate-400 dark:text-zinc-500">
          <path d={macroArea} fill="url(#volume-macro-fill)" stroke="none" />
          <path
            d={macroPath}
            stroke="currentColor"
            fill="none"
            strokeWidth="2"
            strokeDasharray="4 3"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>

        <path d={microArea} fill="url(#volume-micro-fill)" stroke="none" />
        <path
          d={microPath}
          className="stroke-brand-600 dark:stroke-brand-400"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="mt-1 flex justify-between text-[11px] font-medium tabular-nums text-slate-400 dark:text-zinc-500">
        <span>{formatShortDate(first.date)}</span>
        <span>{formatShortDate(mid.date)}</span>
        <span>{formatShortDate(last.date)}</span>
      </div>

      {/* Colour-coded labels rather than a boxed legend — the swatch and
          the words sit together, so nothing has to be matched back to a
          key in a corner. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-semibold">
        <span className="inline-flex items-center gap-1.5 text-brand-600 dark:text-brand-400">
          <span className="h-0.5 w-4 rounded-full bg-brand-600 dark:bg-brand-400" />
          Micro (account-level)
        </span>
        <span className="inline-flex items-center gap-1.5 text-body-500 dark:text-zinc-400">
          <span
            className="h-0.5 w-4 rounded-full bg-slate-400 dark:bg-zinc-500"
            style={{ backgroundImage: "repeating-linear-gradient(90deg, currentColor 0 4px, transparent 4px 7px)" }}
          />
          Macro (market-level)
        </span>
      </div>
    </div>
  )
}

export default VolumeChart
