// How a signal relates to your tracked-companies list.
//
// The two interesting modes are opposites, and both are real workflows:
//
//   "named"      Only signals naming a company you're already tracking.
//                Cuts macro and general noise down to "a company on my
//                list is in the news today".
//
//   "unassigned" The inverse: a specific named company in the news that
//                matches nothing on your tracked list yet. This is
//                whitespace — a company you haven't added, found via a
//                news signal rather than by typing it in yourself.
export const ACCOUNT_COVERAGE_MODES = ["all", "named", "unassigned"]

export const ACCOUNT_COVERAGE_LABELS = {
  all: "All signals",
  named: "Tracked companies only",
  unassigned: "Not yet tracked",
}

// Short forms for the three-way selector, where the full labels don't fit.
export const ACCOUNT_COVERAGE_SHORT_LABELS = {
  all: "All",
  named: "Tracked",
  unassigned: "New",
}

export const ACCOUNT_COVERAGE_HINTS = {
  all: "No filter.",
  named: "Only signals naming a company you're tracking.",
  unassigned: "Named companies you aren't tracking yet.",
}

export function matchesAccountCoverage(item, mode) {
  const matched = (item.matchedCompanies ?? []).length > 0
  if (mode === "named") return matched
  if (mode === "unassigned") return !matched && item.scope === "micro" && Boolean(item.entity)
  return true
}
