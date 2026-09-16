// Canonical signal types — single source of truth shared between the
// frontend's badge color mapping (src/lib/colors.js) and the ingest
// pipeline's LLM normalization prompt (api/_lib/normalize.js), so the two
// can't silently drift apart. New types can still appear (colors.js has a
// deterministic fallback palette for anything not listed here), but the
// ingest prompt is instructed to prefer these first.
export const SIGNAL_TYPES = [
  "funding",
  "earnings",
  "partnership",
  "product launch",
  "research shift",
  "analyst report",
  "market shift",
  "brand move",
  "leadership change",
  "digital transformation",
  "new entrant",
  "restructure",
  "regulation",
  "pain point",
  "hiring surge",
]

export const SCOPES = ["macro", "micro"]

// Where a signal is geographically relevant — set by normalize.js
// alongside the other fields. "anz" = specifically about ANZ operations,
// leadership, market, or regulation. "global" = matters regardless of
// region (major M&A, top-level CEO change, funding, earnings). "other" =
// tied to a different region with no clear ANZ angle (e.g. a UK-only
// leadership change at a global company).
export const REGIONS = ["anz", "global", "other"]
