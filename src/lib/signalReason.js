import { REGULATORY_SIGNAL_TYPES, HIGH_RELEVANCE_THRESHOLD } from "./relevance.js"
import { matchesAccountCoverage } from "./accountCoverage.js"

// One concise line answering "why is this worth acting on, and why here?" —
// rather than leaving the reader to infer it from a coloured bar. Draws
// only on fields already present on a signal, and its priority order
// deliberately mirrors the card's left accent border (severity → tracked
// company → whitespace → general relevance) so the written reason and the
// colour can never contradict each other.
//
// `tone` maps to the same governed accent families used everywhere else
// (see lib/colors.js): rose = highest urgency, emerald/amber = a tracked
// customer/prospect, accent blue = relevance or claimable whitespace,
// slate = background context.
export function buildSignalReason(item) {
  const rel = item.outreachRelevance ?? 0
  const matched = item.matchedCompanies ?? []
  const extra = matched.length > 1 ? ` +${matched.length - 1}` : ""

  // A company you're tracking being in the news today is the whole point
  // of this dashboard, so it outranks every other reason.
  if (matched.length > 0) {
    return { label: `Tracked company in the news — ${matched[0]}${extra}`, tone: "prospect" }
  }

  if (REGULATORY_SIGNAL_TYPES.has(item.signalType)) {
    return { label: "Regulatory / pain-point pressure — fastest path to a timely angle", tone: "urgent" }
  }

  // The inverse of a tracked match, and just as worth acting on: a named
  // company in the news that you aren't tracking yet.
  if (matchesAccountCoverage(item, "unassigned")) {
    return { label: "Named company, not yet tracked — worth adding", tone: "whitespace" }
  }

  if (rel >= HIGH_RELEVANCE_THRESHOLD) {
    return { label: "Strong, specific outreach trigger", tone: "relevant" }
  }
  if (rel === 3) {
    return { label: "Supporting context for a conversation already underway", tone: "neutral" }
  }
  return { label: "Background market intelligence", tone: "neutral" }
}

// The natural next step for each reason tone — same priority order as
// buildSignalReason, so "why this is here" and "what to do about it"
// never disagree. Deterministic, built only from fields already on the
// row: no extra AI call, no invented advice.
export function actionForReason(reason) {
  switch (reason.tone) {
    case "customer":
      return "Bring this into your next check-in — a live reason to talk expansion, not a cold open."
    case "prospect":
      return "Use this as the outreach pretext — it's fresh enough to reference directly."
    case "urgent":
      return "Lead with the compliance/pain-point angle — this is a timely, specific reason to reach out, tracked or not."
    case "whitespace":
      return "Not on your list yet — add it before the news goes stale."
    case "relevant":
      return "Strong enough to open with even without a tracked match — worth a standalone outreach touch."
    default:
      return "Background context — use it to sharpen a talk track, not as a standalone reason to reach out."
  }
}

// Leading-dot / text colour per tone. Kept here rather than in the row so
// the reason line and any other consumer stay in lockstep.
export const REASON_TONE_STYLES = {
  urgent: { dot: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" },
  customer: { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  prospect: { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  whitespace: { dot: "bg-brand-500", text: "text-brand-600 dark:text-brand-400" },
  relevant: { dot: "bg-brand-500", text: "text-brand-600 dark:text-brand-400" },
  neutral: { dot: "bg-slate-400 dark:bg-zinc-600", text: "text-slate-500 dark:text-zinc-400" },
}
