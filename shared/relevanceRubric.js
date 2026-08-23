// Single source of truth for outreach-relevance scoring, shared between
// ingest-time normalization (api/_lib/normalize.js) and the backfill pass
// over historical rows (api/_lib/scoreRelevance.js), so a signal scored
// today and one scored six months from now are held to the same bar.
//
// Deliberately one axis, not several: the actual question is "would a
// salesperson tracking this company act on this," and a fragmented score
// doesn't serve that any better while being harder to reason about.
//
// This describes how to score, and deliberately says nothing about
// response format — each caller wraps it differently. Keep format
// instructions at the call site, not here.
//
// Written to work for anyone tracking any company, regardless of what
// they sell or where they sell it — nothing below assumes an industry,
// a product category, or a region.
export const RELEVANCE_RUBRIC = `Score how strongly this signal justifies a salesperson reaching out — by call, email, or LinkedIn — referencing this specific event. This is not a general "how interesting is this" score; it is specifically about outreach timing and pretext.

5 — Immediate, specific outreach trigger. A named company has a fresh, concrete reason to talk right now: a new executive hire in a role relevant to buying decisions, a disclosed customer or employee pain point, a compliance or service failure, a public complaint spike, an earnings or survey result signaling internal pressure, expansion into a new market or region with no local incumbent yet, a funding round or acquisition that changes what they need next. You could open an email with "Saw that..." and it would land.
4 — Strong but slightly less direct trigger: regulatory or compliance pressure hitting a whole sector, a notable competitor move affecting companies you track, a restructure or layoff round at a named company, a funding or leadership event one step removed from a clean pretext.
3 — Useful as supporting context in a conversation already underway, but not itself a cold-outreach pretext: a macro economic indicator, a routine earnings report, a competitor's routine product update, an industry benchmark report release.
2 — Background competitive or market intelligence. Informs strategy and talk tracks but has no natural tie to any specific company or immediate ask.
1 — Minimal relevance: broad macro/market noise with only a loose thematic connection to any company you might sell into.`
