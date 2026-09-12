// The classic strategic framings for approaching any account — revenue,
// retention, cost, risk, innovation — same deterministic/templated
// approach as signalInsights.js's GROUP_ANGLES rather than an LLM guess:
// these are generic, true-of-any-account framings, not a claim about
// this specific account. What personalizes the list is real: if
// leadership's stated priorities (Settings' "My Company" ->
// strategicPriorities, never researched, only what you typed) name one
// of these, that one moves to the top with your own words attached.
const STRATEGIC_FRAMINGS = [
  {
    id: "revenue",
    label: "Revenue growth",
    rationale: "Lead with net-new spend or expansion potential — the angle that gets budget released fastest when growth is the stated mandate.",
  },
  {
    id: "retention",
    label: "Customer retention",
    rationale: "Frame around reducing churn risk or deepening an existing relationship — stronger when the account is already a customer, not a cold prospect.",
  },
  {
    id: "cost",
    label: "Cost efficiency",
    rationale: "Position as consolidation or reducing existing spend — resonates most right after a cost-discipline signal (a miss, a restructure, layoffs).",
  },
  {
    id: "risk",
    label: "Risk & compliance",
    rationale: "Lead with the regulatory or operational exposure angle — moves fastest when there's a real mandate and deadline behind it, not discretionary budget.",
  },
  {
    id: "innovation",
    label: "Innovation / differentiation",
    rationale: "Frame as staying ahead of the market or a named competitor — the angle that lands best alongside a funding, product, or competitive-pressure signal.",
  },
]

// Matches leadership's own words against the framing labels/ids by
// simple keyword overlap — good enough to reorder the list, not
// pretending to be real language understanding. Never invents a
// framing that isn't in the fixed list above.
function matchesPriorities(framing, prioritiesLower) {
  if (framing.id === "revenue" && /revenue|growth|new logo|net-new|pipeline/.test(prioritiesLower)) return true
  if (framing.id === "retention" && /retention|renewal|churn|expansion|upsell/.test(prioritiesLower)) return true
  if (framing.id === "cost" && /cost|efficien|consolidat|budget cut|discipline/.test(prioritiesLower)) return true
  if (framing.id === "risk" && /risk|complian|regulat|security|audit/.test(prioritiesLower)) return true
  if (framing.id === "innovation" && /innovat|differentiat|competit|market share/.test(prioritiesLower)) return true
  return false
}

export function strategicAngles(myCompany) {
  const priorities = myCompany?.strategicPriorities?.trim()
  if (!priorities) return STRATEGIC_FRAMINGS

  const prioritiesLower = priorities.toLowerCase()
  const matched = STRATEGIC_FRAMINGS.filter((f) => matchesPriorities(f, prioritiesLower))
  const rest = STRATEGIC_FRAMINGS.filter((f) => !matched.includes(f))

  if (matched.length === 0) return STRATEGIC_FRAMINGS

  return [
    ...matched.map((f) => ({
      ...f,
      rationale: `Leadership's current priority — "${priorities}" — points here. ${f.rationale}`,
    })),
    ...rest,
  ]
}
