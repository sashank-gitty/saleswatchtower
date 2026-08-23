function LegendRow({ swatch, label, examples }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${swatch}`} />
      <p className="text-xs leading-snug text-slate-600 dark:text-zinc-400">
        <span className="font-semibold text-slate-800 dark:text-zinc-200">{label}</span>
        {" "}&mdash; {examples}
      </p>
    </div>
  )
}

// Only two things in the feed carry a meaningful color (see the note at
// the top of lib/colors.js) — everything else is the same neutral chip on
// purpose, so this legend only has two rows to explain.
const LEGEND_ENTRIES = [
  { swatch: "bg-rose-500", label: "Regulatory / Pain Point", examples: "the highest-urgency signal types — usually the fastest path to a timely outreach angle" },
  { swatch: "bg-emerald-500", label: "Customer", examples: "a signal naming a company you've flagged as a customer" },
  { swatch: "bg-amber-500", label: "Prospect", examples: "a signal naming a company you're tracking as a prospect" },
]

function TagLegend() {
  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-white/60 p-3 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/60">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
        Colors
      </p>
      {LEGEND_ENTRIES.map((entry) => (
        <LegendRow key={entry.label} {...entry} />
      ))}
    </div>
  )
}

export default TagLegend
