import { REGULATORY_ACCENT } from "../lib/colors.js"
import Sparkline from "./Sparkline.jsx"

function TrendBadge({ pct, delta, positiveIsGood = true, invert = false }) {
  if (pct === null) {
    return <span className="text-xs font-medium text-slate-400 dark:text-zinc-500">no prior data</span>
  }

  const isFlat = delta === 0
  const isUp = delta > 0
  const isGood = invert ? !isUp : isUp
  const colorClass = isFlat
    ? "text-slate-400 dark:text-zinc-500"
    : (positiveIsGood ? isGood : !isGood)
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400"

  const arrow = isFlat ? "→" : isUp ? "↑" : "↓"

  return (
    <span
      title={`${Math.abs(pct)}% ${isUp ? "increase" : isFlat ? "no change" : "decrease"} vs last week`}
      className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${colorClass}`}
    >
      {arrow} {Math.abs(pct)}%<span className="font-normal text-slate-400 dark:text-zinc-500">vs last week</span>
    </span>
  )
}

// Two prominence tiers: "featured" tiles (the ones with a real weekly delta
// worth reacting to) render their number much larger, with an accent color
// that doubles as the severity read — rose for the highest-urgency tile,
// accent blue for the merely-important one. Static count tiles (no delta) stay
// small and neutral so the hierarchy is unambiguous at a glance.
const ACCENT_STYLES = {
  brand: {
    border: "border-brand-300 hover:border-brand-400 dark:border-brand-500/30 dark:hover:border-brand-500/50",
    value: "text-brand-600 dark:text-brand-400",
  },
  rose: {
    border: REGULATORY_ACCENT.border,
    value: REGULATORY_ACCENT.text,
  },
}

function KpiCard({ label, value, sub, children, featured = false, accent = "brand", spark = null }) {
  const accentStyles = ACCENT_STYLES[accent] ?? ACCENT_STYLES.brand

  return (
    <div
      className={`group flex flex-col rounded-xl border bg-white p-5 shadow-[0_1px_2px_rgba(9,23,43,0.04)] transition-all duration-200 ease-spring hover:-translate-y-0.5 hover:shadow-md dark:bg-zinc-900/60 dark:shadow-none ${
        featured
          ? accentStyles.border
          : "border-slate-200 hover:border-slate-300 dark:border-zinc-800 dark:hover:border-zinc-700"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-body-500 dark:text-zinc-400">{label}</p>
      <p
        className={`mt-2 font-bold leading-none tabular-nums ${
          featured ? `text-5xl ${accentStyles.value}` : "text-4xl text-ink-900 dark:text-zinc-50"
        }`}
      >
        {value}
      </p>
      <div className="mt-2">{sub ?? children}</div>
      {spark && (
        <div className={`mt-auto pt-3 ${spark.className}`}>
          <Sparkline values={spark.values} height={24} />
        </div>
      )}
    </div>
  )
}

function KpiGrid({ metrics }) {
  const riskDelta = metrics.riskThisWeekCount - metrics.riskLastWeekCount
  const totalSpark = metrics.dailyBuckets?.map((b) => b.total) ?? []
  const riskSpark = metrics.dailyBuckets?.map((b) => b.risk) ?? []

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Total Signals Tracked"
        value={metrics.totalSignals}
        sub={<span className="text-xs text-body-500 dark:text-zinc-500">last 30 days of activity</span>}
      />

      <KpiCard
        featured
        accent="brand"
        label="Signals This Week"
        value={metrics.thisWeekCount}
        sub={<TrendBadge pct={metrics.weekOverWeekPct} delta={metrics.weekOverWeekDelta} />}
        spark={{ values: totalSpark, className: "text-brand-600 dark:text-brand-400" }}
      />

      <KpiCard
        featured
        accent="rose"
        label="Regulatory &amp; Pain-Point Signals"
        value={metrics.riskThisWeekCount}
        sub={
          <span
            title="Signals tagged regulation or pain point — the highest-urgency category, usually the fastest path to a relevant, timely outreach angle"
            className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${REGULATORY_ACCENT.text}`}
          >
            {riskDelta === 0 ? "→" : riskDelta > 0 ? "↑" : "↓"} {Math.abs(riskDelta)}
            <span className="font-normal text-slate-400 dark:text-zinc-500">vs last week</span>
          </span>
        }
        spark={{ values: riskSpark, className: REGULATORY_ACCENT.text }}
      />

      <KpiCard
        label="Entities Tracked"
        value={metrics.entitiesTracked}
        sub={
          <span className="text-xs font-medium text-body-500 dark:text-zinc-400">
            <span className="font-semibold tabular-nums text-body-600 dark:text-zinc-300">{metrics.entitiesThisWeek}</span>{" "}
            active this week
          </span>
        }
      />
    </div>
  )
}

export default KpiGrid
