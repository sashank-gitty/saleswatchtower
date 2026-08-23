import { HIGH_RELEVANCE_THRESHOLD } from "./relevance.js"

// A small cycling palette for the signal-type breakdown bars — there's no
// fixed, finite list of signal types (the ingest prompt can produce a
// novel short label when nothing in shared/signalTypes.js fits), so this
// can't be a lookup table keyed by name the way the old patch swatches
// were. Cycling through a handful of distinct hues keeps adjacent bars
// visually distinguishable without needing to know the label in advance.
const SWATCH_CYCLE = ["bg-emerald-500", "bg-sky-500", "bg-amber-500", "bg-teal-500", "bg-fuchsia-500", "bg-slate-400", "bg-rose-500", "bg-violet-500"]

function latestCreatedAt(signals) {
  return signals.reduce((max, s) => {
    if (!s.createdAt) return max
    const t = new Date(s.createdAt).getTime()
    return t > max ? t : max
  }, 0)
}

// Anchored to the feed's own most recent createdAt rather than the
// browser clock — the same trick lib/metrics.js uses for "today", so
// "new since yesterday" still reads sensibly if the cron missed a night
// or the page is opened well after a run, instead of silently going to
// zero.
export function computeBriefing(signals) {
  const anchor = latestCreatedAt(signals)
  const cutoff = anchor - 24 * 3600 * 1000

  const newSinceYesterday = signals
    .filter((s) => s.createdAt && new Date(s.createdAt).getTime() >= cutoff)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const highRelevance = signals.filter((s) => (s.outreachRelevance ?? 0) >= HIGH_RELEVANCE_THRESHOLD)
  const accountMatched = signals.filter((s) => (s.matchedCompanies ?? []).length > 0)
  const unreviewed = signals.filter((s) => !s.reviewed)

  const typeTally = new Map()
  for (const signal of signals) {
    typeTally.set(signal.signalType, (typeTally.get(signal.signalType) ?? 0) + 1)
  }
  const typeCounts = [...typeTally.entries()]
    .map(([signalType, count], i) => ({ signalType, count, swatch: SWATCH_CYCLE[i % SWATCH_CYCLE.length] }))
    .sort((a, b) => b.count - a.count)

  return {
    total: signals.length,
    newSinceYesterday,
    highRelevance,
    accountMatched,
    unreviewed,
    typeCounts,
    anchor: anchor ? new Date(anchor) : null,
  }
}
