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
]

export const SCOPES = ["macro", "micro"]
