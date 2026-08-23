import { REGULATORY_SIGNAL_TYPES } from "./relevance.js"

// Colour is reserved for the few things that are genuinely a "look here
// first" signal — regulatory/pain-point urgency (rose) and a matched
// account's customer/prospect status (emerald/amber). Everything else
// that used to be its own tinted pill (signal type, practice area,
// patch, scope) is the same neutral chip: with every metadata field
// independently coloured, no single colour meant anything.
//
// The category colours in lib/signalGroups.js are the deliberate
// exception, and they don't contradict this. They ride on the icon badge
// that fronts a row — one tinted glyph tile per row, learned once — not
// on the metadata pills trailing it. One coloured mark plus neutral
// chips stays scannable; eight coloured chips does not.
//
// Every class is a full literal string (never built by concatenation) so
// Tailwind's scanner picks it up. Pills are borderless light-tint chips
// to match the shared Pill component — shape is uniform system-wide, so
// tint is free to carry meaning.
const NEUTRAL_PILL = "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
const REGULATORY_PILL = "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"

// A signal that names an account someone actually owns is the strongest
// thing in the feed, so it gets emerald (an existing relationship, a
// renewal or expansion angle) or amber (a named prospect, a net-new
// angle) rather than another neutral grey pill. Kept colored deliberately
// — this is one of the few pills that's a real priority signal, not
// decoration.
const ACCOUNT_STATUS_STYLES = {
  customer: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  prospect: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
}

export function pillClassForAccountStatus(status) {
  return ACCOUNT_STATUS_STYLES[status] ?? ACCOUNT_STATUS_STYLES.prospect
}

// The one signal-type distinction worth a color: regulation / pain point
// is the highest-urgency category, and rose is reserved for it alone
// (see REGULATORY_ACCENT below, the same rose used for the feed card's
// left accent and reason-line dot). Every other signal type is neutral.
export function pillClassForSignalType(signalType) {
  if (REGULATORY_SIGNAL_TYPES.has(signalType)) return REGULATORY_PILL
  return NEUTRAL_PILL
}

export function pillClassForScope() {
  return NEUTRAL_PILL
}

// Used for chart strokes / dots where a hex value is required instead of
// a class (VolumeChart's macro/micro lines) — unrelated to the pill
// palette above, kept as its own two-color scale.
export const SCOPE_HEX = {
  macro: "#64748b",
  micro: "#0989e5",
}

// Single accent used everywhere Regulatory & Pain-Point needs to read as
// the highest-urgency category — the KPI tile, the highlights rail dot,
// and each feed card's persistent left accent all pull from this one
// object instead of hardcoding the color independently in three places.
export const REGULATORY_ACCENT = {
  swatch: "bg-rose-500",
  text: "text-rose-600 dark:text-rose-400",
  border: "border-rose-500/30 hover:border-rose-500/50 dark:border-rose-500/30 dark:hover:border-rose-500/50",
  badge: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  borderLeft: "border-l-rose-500",
}
