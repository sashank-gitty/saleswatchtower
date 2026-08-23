// Shared search matching, used by the Search page and by saved alerts
// re-running their query (useAlerts.js) so the two never disagree about
// what a query matches.
//
// The old behaviour was a single `haystack.includes(query)` — the whole
// typed phrase had to appear verbatim and in order. That's brittle for
// how people actually search: "nab leadership" would miss a headline
// like "NAB names new Chief Experience Officer, its first leadership
// hire in the role" even though every word is right there. Splitting the
// query into whitespace-separated tokens and requiring each token to
// appear somewhere (AND, not exact phrase) matches how word order works
// in a headline without requiring it to match the query's order.
export function queryTokens(query) {
  return String(query ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

export function matchesTokens(haystack, tokens) {
  if (!tokens.length) return true
  const hay = String(haystack ?? "").toLowerCase()
  return tokens.every((token) => hay.includes(token))
}

export function matchesQuery(haystack, query) {
  return matchesTokens(haystack, queryTokens(query))
}
