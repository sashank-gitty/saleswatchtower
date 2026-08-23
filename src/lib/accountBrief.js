import { groupForSignal, groupLabel, SIGNAL_GROUPS } from "./signalGroups.js"
import { HIGH_RELEVANCE_THRESHOLD } from "./relevance.js"

// Derives the account brief — the "What You Need to Know" surface — from
// an account's own signals.
//
// A hard rule runs through this whole module: **nothing here invents a
// fact about a real company.** Every string that reaches the screen is
// either (a) copied verbatim from an ingested signal, or (b) a count,
// date or grouping computed from those signals. There is no generated
// prose about what a company "is focused on", no synthesized executive
// quotes, and no firmographics.
//
// That constraint is why this file produces *themes with citations*
// rather than paragraphs. The reference product fills these panels with
// LLM-written narrative over earnings calls, SEC filings and job posts —
// sources this pipeline does not ingest. Writing that narrative anyway,
// from news headlines alone, would produce confident sentences about
// real companies that nothing in the data supports, and you'd repeat
// them on a call. Grouping the real signals under the same
// headings keeps the layout and the scan-ability while every claim stays
// clickable back to its source.
//
// If the pipeline later ingests earnings transcripts or filings, this is
// the one module that changes: the panels and citation plumbing already
// exist.

const DAY_MS = 24 * 60 * 60 * 1000

function daysSince(dateString, now) {
  return Math.floor((now - new Date(`${dateString}T00:00:00`).getTime()) / DAY_MS)
}

// Recency buckets, mirroring how the reference product stacks an
// account's activity as Last 7 / 30 / 180 days rather than as one flat
// chronological list. Bucketing answers "is this account warming up or
// cooling off" at a glance, which a date-sorted list does not.
export const TIMELINE_BUCKETS = [
  { id: "7", label: "Last 7 days", maxDays: 7 },
  { id: "30", label: "Last 30 days", maxDays: 30 },
  { id: "180", label: "Last 180 days", maxDays: 180 },
  { id: "older", label: "Older", maxDays: Infinity },
]

export function bucketByRecency(signals, now = Date.now()) {
  const buckets = TIMELINE_BUCKETS.map((bucket) => ({ ...bucket, signals: [] }))
  for (const signal of signals) {
    const age = daysSince(signal.date, now)
    const bucket = buckets.find((b) => age < b.maxDays) ?? buckets[buckets.length - 1]
    bucket.signals.push(signal)
  }
  return buckets.filter((bucket) => bucket.signals.length > 0)
}

// Key insights: the account's signals collapsed into one line per theme,
// ordered by how much evidence sits behind each. The line itself names
// the theme and the count — the substance lives in the citations, which
// carry the real headlines.
export function keyInsights(signals) {
  const byGroup = new Map()
  for (const signal of signals) {
    const id = groupForSignal(signal)
    if (!byGroup.has(id)) byGroup.set(id, [])
    byGroup.get(id).push(signal)
  }

  return [...byGroup.entries()]
    .map(([id, groupSignals]) => {
      const sorted = [...groupSignals].sort(
        (a, b) => (b.outreachRelevance ?? 0) - (a.outreachRelevance ?? 0) || (a.date < b.date ? 1 : -1),
      )
      const highCount = sorted.filter((s) => (s.outreachRelevance ?? 0) >= HIGH_RELEVANCE_THRESHOLD).length
      return {
        id,
        label: groupLabel(id),
        // The lead headline is quoted, not paraphrased — it is the one
        // piece of real language available about this theme.
        lead: sorted[0].headline,
        count: sorted.length,
        highCount,
        signals: sorted,
        newest: sorted.reduce((max, s) => (s.date > max ? s.date : max), sorted[0].date),
      }
    })
    .sort((a, b) => b.highCount - a.highCount || b.count - a.count)
}

// People updates — leadership moves only. This is the closest this
// pipeline gets to the reference product's org-change panel, and it is
// populated exclusively from signals the normalizer typed as leadership
// changes, so nothing here is guessed at.
export function peopleUpdates(signals) {
  return signals
    .filter((s) => s.signalType === "leadership change")
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function topNews(signals, limit = 6) {
  return [...signals]
    .sort((a, b) => (b.outreachRelevance ?? 0) - (a.outreachRelevance ?? 0) || (a.date < b.date ? 1 : -1))
    .slice(0, limit)
}

// The value pyramid. Each tier is defined by which signal groups map onto
// it, so a tier is present only when the account actually has signals of
// that kind — an empty tier is dropped rather than rendered as a
// heading with nothing under it.
//
// The tier *descriptions* are static, generic explanations of what the
// tier means (identical for every account, and true by construction).
// The account-specific content is entirely the cited signals.
export const VALUE_TIERS = [
  {
    id: "goals",
    label: "Company Goals",
    blurb: "Performance and growth signals — what this account is publicly being measured on.",
    groups: ["earnings", "funding"],
  },
  {
    id: "strategy",
    label: "Business Strategy",
    blurb: "Direction-of-travel signals — where the account is choosing to invest.",
    groups: ["transformation", "news"],
  },
  {
    id: "challenges",
    label: "Challenges and Obstacles",
    blurb: "Pressure signals — regulatory exposure and stated pain, the strongest openings for outreach.",
    groups: ["regulatory"],
  },
  {
    id: "paths",
    label: "Value Paths",
    blurb: "People and research signals — who changed, and what the market is saying about them.",
    groups: ["leadership", "research", "community"],
  },
]

export function valuePyramid(signals) {
  const byGroup = new Map()
  for (const signal of signals) {
    const id = groupForSignal(signal)
    if (!byGroup.has(id)) byGroup.set(id, [])
    byGroup.get(id).push(signal)
  }

  return VALUE_TIERS.map((tier) => {
    const items = tier.groups
      .map((groupId) => ({ groupId, signals: byGroup.get(groupId) ?? [] }))
      .filter((entry) => entry.signals.length > 0)
      .map((entry) => ({
        ...entry,
        label: groupLabel(entry.groupId),
        signals: entry.signals.sort(
          (a, b) => (b.outreachRelevance ?? 0) - (a.outreachRelevance ?? 0) || (a.date < b.date ? 1 : -1),
        ),
      }))
    return { ...tier, items }
  }).filter((tier) => tier.items.length > 0)
}

// Discovery questions. Generic prompts keyed by signal group (see
// signalGroups.js) rather than any product-specific practice area — the
// same question set works whatever you sell, since the account-specific
// part is which kinds of signal this account has actually produced.
// Presenting them per-account is a convenience, not a claim about the
// account.
export const DISCOVERY_QUESTIONS = {
  leadership: [
    {
      persona: "New leader's direct report",
      question: "What's changed in your team's priorities since the new leader started?",
      uncovers: "Whether a real strategy review is underway or it's still business as usual.",
    },
  ],
  regulatory: [
    {
      persona: "Compliance / Ops lead",
      question: "Who inside the business owns the response to this, and what's the timeline?",
      uncovers: "Whether there's a named budget and owner yet, or it's still informal.",
    },
  ],
  earnings: [
    {
      persona: "Finance / Strategy lead",
      question: "What's the one initiative this quarter's numbers are supposed to justify?",
      uncovers: "Where the real budget and attention is actually going, versus the official narrative.",
    },
  ],
  funding: [
    {
      persona: "Leadership / Corp Dev",
      question: "What's the new capability or team you're building out because of this?",
      uncovers: "Whether the raise or deal changes what they need from vendors in the next 6–12 months.",
    },
  ],
  research: [
    {
      persona: "Strategy / Comms lead",
      question: "How are you responding internally to how you're being covered right now?",
      uncovers: "Whether the coverage has actually triggered a strategy conversation or been ignored.",
    },
  ],
  transformation: [
    {
      persona: "Ops / Transformation lead",
      question: "What's the one thing this reorg is meant to fix that the old structure couldn't?",
      uncovers: "The real driver behind the change, and what's up for re-evaluation because of it.",
    },
  ],
}

export function discoveryQuestionsFor(signals) {
  const groups = [...new Set(signals.map((s) => groupForSignal(s)))]
  return groups.flatMap((group) => (DISCOVERY_QUESTIONS[group] ?? []).map((q) => ({ ...q, group })))
}

// Signal-group distribution, used for the small bar breakdown on the
// Fast Facts tab.
export function groupDistribution(signals) {
  const counts = new Map()
  for (const signal of signals) {
    const id = groupForSignal(signal)
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return SIGNAL_GROUPS.filter((group) => counts.has(group.id)).map((group) => ({
    id: group.id,
    label: group.label,
    count: counts.get(group.id),
    share: counts.get(group.id) / signals.length,
  }))
}
