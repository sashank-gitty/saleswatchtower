import { pillClassForScope, REGULATORY_ACCENT } from "../lib/colors.js"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function formatShortDate(dateString) {
  const [, month, day] = dateString.split("-").map(Number)
  return `${MONTHS[month - 1]} ${day}`
}

function HighlightRow({ label, value, sub, accentClass }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-white/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
      <span className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${accentClass}`} />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-body-500 dark:text-zinc-400">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-ink-900 dark:text-zinc-50">{value}</p>
        {sub && <p className="text-xs text-slate-400 dark:text-zinc-500">{sub}</p>}
      </div>
    </div>
  )
}

function ActivityPanel({ recentItems, metrics }) {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-body-500 dark:text-zinc-400">
          This Week's Highlights
        </h2>
        <div className="flex flex-col gap-2">
          {metrics.topEntity && (
            <HighlightRow
              label="Most Active Entity"
              value={metrics.topEntity[0]}
              sub={`${metrics.topEntity[1]} signal${metrics.topEntity[1] === 1 ? "" : "s"} this week`}
              accentClass="bg-brand-500"
            />
          )}
          {metrics.topSignalType && (
            <HighlightRow
              label="Leading Signal Type"
              value={metrics.topSignalType[0]}
              sub={`${metrics.topSignalType[1]} occurrence${metrics.topSignalType[1] === 1 ? "" : "s"} this week`}
              accentClass="bg-teal-500"
            />
          )}
          <HighlightRow
            label="Regulatory Pressure"
            value={metrics.riskThisWeekCount > 0 ? `${metrics.riskThisWeekCount} open signal${metrics.riskThisWeekCount === 1 ? "" : "s"}` : "None this week"}
            sub={metrics.riskThisWeekCount > 0 ? "Regulation & pain-point signals worth a proactive touch" : "No compliance or pain-point signals logged"}
            accentClass={metrics.riskThisWeekCount > 0 ? REGULATORY_ACCENT.swatch : "bg-slate-300 dark:bg-zinc-700"}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-body-500 dark:text-zinc-400">
          Recent Activity
        </h2>
        <ol className="relative flex flex-col gap-4 border-l border-slate-200 pl-4 dark:border-zinc-800">
          {recentItems.map((item) => (
            <li key={item.id} className="relative">
              <span
                className={`absolute -left-[21px] top-1 h-2 w-2 rounded-full ring-4 ring-slate-50 dark:ring-zinc-950 ${
                  item.scope === "micro" ? "bg-brand-500" : "bg-slate-400 dark:bg-zinc-600"
                }`}
              />
              <div className="flex items-center gap-2">
                <time className="font-mono text-[11px] font-semibold tabular-nums text-slate-400 dark:text-zinc-500">
                  {formatShortDate(item.date)}
                </time>
                <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold capitalize ${pillClassForScope(item.scope)}`}>
                  {item.scope}
                </span>
              </div>
              <p className="mt-0.5 text-sm font-medium leading-snug text-body-600 dark:text-zinc-300">
                <span className="font-semibold text-ink-900 dark:text-zinc-50">{item.entity}</span> &mdash; {item.headline}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

export default ActivityPanel
