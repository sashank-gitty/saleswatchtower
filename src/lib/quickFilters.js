// One-click shortcuts that set a combination of underlying URL-state
// facets, replacing the old mutually-exclusive "pill" which was its own
// parallel filtering axis — it could disagree with the sidebar's Signal
// Type checkboxes over the same field, and only one shortcut could ever be
// active at once even though "high relevance" + "this week" is a perfectly
// normal combination to want. These just set/clear real facet keys, so
// they compose with everything else and with each other.
export const QUICK_FILTERS = [
  { id: "high-relevance", label: "High Relevance", patch: { relevance: "high" } },
  { id: "this-week", label: "This Week", patch: { range: "7" } },
  { id: "unreviewed", label: "Unreviewed", patch: { reviewed: "false" } },
  { id: "regulatory", label: "Regulatory & Pain Points", patch: { type: ["regulation", "pain point"] } },
  { id: "leadership", label: "Leadership Moves", patch: { type: ["leadership change"] } },
  { id: "competitor", label: "Competitor Moves", patch: { type: ["product launch", "new entrant", "brand move"] } },
]

function valuesEqual(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    const arrA = Array.isArray(a) ? a : []
    const arrB = Array.isArray(b) ? b : []
    return arrA.length === arrB.length && arrA.every((v) => arrB.includes(v))
  }
  return (a ?? undefined) === (b ?? undefined)
}

export function isQuickFilterActive(quickFilter, urlState) {
  return Object.entries(quickFilter.patch).every(([key, value]) => valuesEqual(urlState[key], value))
}

export function clearPatchFor(quickFilter) {
  return Object.fromEntries(Object.keys(quickFilter.patch).map((key) => [key, undefined]))
}
