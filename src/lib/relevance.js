// Shared between the feed's quick filters (SignalQueue) and each card's
// persistent accent marker (SignalRow), so the filters and the always-on
// visual cues agree on the same definitions instead of drifting apart.
export const REGULATORY_SIGNAL_TYPES = new Set(["regulation", "pain point"])
export const HIGH_RELEVANCE_THRESHOLD = 4
