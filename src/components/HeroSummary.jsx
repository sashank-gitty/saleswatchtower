import { buildSignalReason, REASON_TONE_STYLES } from "../lib/signalReason.js"

// The one thing the top of the page should answer before any KPI grid or
// chart: "how many signals this week are actually worth acting on, and which
// one do I open first?" (the Linear/Stripe move of leading with a single
// question, and the Rhythm/6sense move of pointing at a next best action).
// It also hosts the Focus / All switch, because "here's what to act on" is
// exactly the curated view the toggle turns on.
function ViewToggle({ view, onViewChange }) {
  const options = [
    { id: "focus", label: "Focus" },
    { id: "all", label: "All" },
  ]
  return (
    <div className="flex flex-shrink-0 overflow-hidden rounded-md border border-slate-200 dark:border-zinc-800">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onViewChange(option.id)}
          aria-pressed={view === option.id}
          title={
            option.id === "focus"
              ? "Only signals worth acting on this week"
              : "Every signal matching the current filters"
          }
          className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
            view === option.id
              ? "bg-brand-500/10 text-brand-600 dark:text-brand-400"
              : "text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function HeroSummary({ metrics, view, onViewChange, onOpenSignal }) {
  const count = metrics.actWorthyThisWeekCount
  const top = metrics.topPrioritySignal
  const reason = top ? buildSignalReason(top) : null
  const toneStyles = reason ? REASON_TONE_STYLES[reason.tone] ?? REASON_TONE_STYLES.neutral : null

  return (
    <section className="mb-5 rounded-xl border border-slate-200 bg-white/60 p-5 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-body-500 dark:text-zinc-400">
            This week
          </p>
          <p className="mt-1 text-lg font-semibold leading-tight text-ink-900 dark:text-zinc-50 sm:text-xl">
            <span className="font-mono text-3xl tabular-nums text-brand-600 dark:text-brand-400 sm:text-4xl">
              {count}
            </span>{" "}
            signal{count === 1 ? "" : "s"} worth acting on
          </p>
          <p className="mt-1 text-xs text-body-500 dark:text-zinc-400">
            High-relevance triggers in the last 7 days
            {metrics.riskThisWeekCount > 0
              ? ` · ${metrics.riskThisWeekCount} regulatory / pain-point`
              : ""}
          </p>
        </div>
        <ViewToggle view={view} onViewChange={onViewChange} />
      </div>

      {top ? (
        <button
          type="button"
          onClick={() => onOpenSignal(top.id)}
          className="group mt-4 flex w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-left transition-colors hover:border-brand-500/30 hover:bg-brand-500/5 dark:border-zinc-800 dark:bg-zinc-950/40"
        >
          <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            Start here
          </span>
          <span className={`h-2 w-2 flex-shrink-0 rounded-full ${toneStyles.dot}`} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-body-600 dark:text-zinc-200">
            <span className="font-semibold text-ink-900 dark:text-zinc-50">{top.entity}</span>
            {" — "}
            {top.headline}
          </span>
          <span className="flex-shrink-0 text-xs font-medium text-brand-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-brand-400">
            Open &rarr;
          </span>
        </button>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm text-slate-400 dark:border-zinc-700 dark:text-zinc-500">
          No act-worthy signals in the last 7 days &mdash; switch to{" "}
          <button
            type="button"
            onClick={() => onViewChange("all")}
            className="font-semibold text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
          >
            All
          </button>{" "}
          to browse everything.
        </p>
      )}
    </section>
  )
}

export default HeroSummary
