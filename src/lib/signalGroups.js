import {
  NewspaperIcon,
  PersonPlusIcon,
  ChartIcon,
  ScaleIcon,
  DocumentIcon,
  MicIcon,
  SparklesIcon,
  BriefcaseIcon,
} from "../components/icons.jsx"

// Signal-type groups, the taxonomy behind the tab strip that sits above
// every signal list (feed, search, account detail).
//
// These are deliberately NOT a 1:1 copy of the reference product's tabs
// (News & Press / Podcasts / Hiring / Documents & Reports / Earnings /
// M&A / Funding / Clinical Trials). That set is built for a US-tech
// account book fed by SEC filings and clinical-trial registries; this
// pipeline ingests Google News RSS only, with no clinical trials and no
// hiring feed at all. Copying the labels verbatim would have shipped
// three tabs permanently reading 0 — an empty tab is worse than an absent
// one, because it reads as broken ingest rather than as a category that
// doesn't apply.
//
// What is preserved is the *pattern*: a small set of stable, mutually
// exclusive groups with live counts, so the same tab strip works on every
// surface. Every canonical type in shared/signalTypes.js appears in
// exactly one group; anything unrecognized falls through to "other" so a
// new type from the normalizer is never silently invisible.
//
// Each group is told apart by its icon shape, not its colour — every
// group is neutral slate except regulatory, which stays rose as the
// one real urgency signal. Colour used to be one-per-group here, but
// with 8 categories that meant 8 competing hues on every row; the icon
// still reads consistently everywhere the group appears (feed row,
// account tab strip, citation pill), just without a second colour axis
// duplicating what the shape already says.
export const SIGNAL_GROUPS = [
  {
    id: "news",
    tone: "slate",
    label: "News & Press",
    Icon: NewspaperIcon,
    types: ["market shift", "brand move", "product launch", "new entrant"],
  },
  {
    id: "leadership",
    tone: "slate",
    label: "Leadership",
    Icon: PersonPlusIcon,
    types: ["leadership change"],
  },
  {
    id: "earnings",
    tone: "slate",
    label: "Earnings",
    Icon: ChartIcon,
    types: ["earnings"],
  },
  {
    id: "funding",
    tone: "slate",
    label: "Funding & M&A",
    Icon: BriefcaseIcon,
    types: ["funding", "partnership"],
  },
  {
    id: "research",
    tone: "slate",
    label: "Research & Reports",
    Icon: DocumentIcon,
    types: ["analyst report", "research shift"],
  },
  {
    id: "regulatory",
    tone: "rose",
    label: "Regulatory",
    Icon: ScaleIcon,
    types: ["regulation", "pain point"],
  },
  {
    id: "transformation",
    tone: "slate",
    label: "Transformation",
    Icon: SparklesIcon,
    types: ["digital transformation", "restructure"],
  },
  {
    id: "community",
    tone: "slate",
    label: "Community",
    Icon: MicIcon,
    // The one group keyed off origin rather than signal type: community
    // rows carry signalType "community insight", which belongs to no
    // news category.
    types: ["community insight"],
  },
]

const TYPE_TO_GROUP = new Map()
for (const group of SIGNAL_GROUPS) {
  for (const type of group.types) TYPE_TO_GROUP.set(type, group.id)
}

export function groupForSignal(signal) {
  if (signal.origin === "community") return "community"
  return TYPE_TO_GROUP.get(signal.signalType) ?? "other"
}

export function groupLabel(id) {
  return SIGNAL_GROUPS.find((g) => g.id === id)?.label ?? "Other"
}

export function iconForSignal(signal) {
  const id = groupForSignal(signal)
  return SIGNAL_GROUPS.find((g) => g.id === id)?.Icon ?? DocumentIcon
}

// Counts for the tab strip. Every group gets a key even at zero so the
// tabs don't reflow as filters change, and "other" is only included when
// something actually landed there.
export function countByGroup(signals) {
  const counts = { all: signals.length, other: 0 }
  for (const group of SIGNAL_GROUPS) counts[group.id] = 0
  for (const signal of signals) {
    const id = groupForSignal(signal)
    counts[id] = (counts[id] ?? 0) + 1
  }
  return counts
}

export function filterByGroup(signals, groupId) {
  if (!groupId || groupId === "all") return signals
  return signals.filter((s) => groupForSignal(s) === groupId)
}

// The one place a group's colour is spelled out. Every class is a full
// literal string rather than built by concatenation, because Tailwind
// scans source text and never sees a name assembled at runtime.
//
// `badge` is the rounded-square icon container (light tint, darker
// glyph), `pill` the rounded-full label chip, `dot` a solid swatch for
// legends and bars, `text` for a bare tinted glyph or number.
export const GROUP_TONE_CLASSES = {
  sky: {
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    pill: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    dot: "bg-sky-500",
    text: "text-sky-600 dark:text-sky-400",
  },
  violet: {
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    pill: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    dot: "bg-violet-500",
    text: "text-violet-600 dark:text-violet-400",
  },
  emerald: {
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  teal: {
    badge: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
    pill: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
    dot: "bg-teal-500",
    text: "text-teal-600 dark:text-teal-400",
  },
  amber: {
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  rose: {
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    pill: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    dot: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
  },
  indigo: {
    badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
    pill: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
    dot: "bg-indigo-500",
    text: "text-indigo-600 dark:text-indigo-400",
  },
  pink: {
    badge: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
    pill: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
    dot: "bg-pink-500",
    text: "text-pink-600 dark:text-pink-400",
  },
  slate: {
    badge: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400",
    pill: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400",
    dot: "bg-slate-400",
    text: "text-slate-500 dark:text-zinc-400",
  },
}

export function toneForGroup(groupId) {
  return SIGNAL_GROUPS.find((g) => g.id === groupId)?.tone ?? "slate"
}

export function toneClassesForGroup(groupId) {
  return GROUP_TONE_CLASSES[toneForGroup(groupId)] ?? GROUP_TONE_CLASSES.slate
}

export function toneClassesForSignal(signal) {
  return toneClassesForGroup(groupForSignal(signal))
}
