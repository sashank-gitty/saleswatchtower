import Parser from "rss-parser"

// A generic non-browser User-Agent (the default one node-fetch/rss-parser
// sends) sometimes gets a thinner or empty response from Google News —
// a real browser UA is more reliable. This is the single most common
// reason a query for a real, newsworthy company can silently come back
// with zero items.
const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  },
})

// Locale for Google News results — affects language and which country's
// coverage gets weighted higher. Defaults to US English; override with
// NEWS_LOCALE (e.g. "en-AU:AU:AU" for Australia, "en-GB:GB:GB" for the
// UK) if you're tracking companies mostly local to somewhere else.
const [NEWS_HL, NEWS_GL, NEWS_CEID_COUNTRY] = (process.env.NEWS_LOCALE || "en-US:US:US").split(":")

function googleNewsRssUrl(query) {
  const params = new URLSearchParams({ q: query, hl: NEWS_HL, gl: NEWS_GL, ceid: `${NEWS_CEID_COUNTRY}:${NEWS_HL.split("-")[0]}` })
  return `https://news.google.com/rss/search?${params.toString()}`
}

// Google News RSS links are Google-hosted redirect/decoy URLs, not the
// publisher's real article URL — following the HTTP redirect recovers the
// real one in most cases, which matters for trust (Issue 2: cards should
// link somewhere real and show the actual publisher domain, not
// news.google.com). This isn't 100% reliable — some of Google's newer
// encoded links resolve via client-side JS rather than a plain HTTP
// redirect, so callers should treat a still-news.google.com result as
// "best effort, not guaranteed" rather than a bug.
async function resolveCanonicalUrl(googleNewsLink) {
  try {
    const res = await fetch(googleNewsLink, { redirect: "follow", signal: AbortSignal.timeout(8000) })
    return res.url || googleNewsLink
  } catch {
    return googleNewsLink
  }
}

export async function fetchQuery(query) {
  const feed = await parser.parseURL(googleNewsRssUrl(query))

  const items = await Promise.all(
    (feed.items ?? []).slice(0, 10).map(async (item) => ({
      title: item.title ?? "",
      snippet: item.contentSnippet ?? item.content ?? "",
      pubDate: item.pubDate ? new Date(item.pubDate) : null,
      sourceUrl: await resolveCanonicalUrl(item.link),
      matchedQuery: query,
    })),
  )

  return items.filter((item) => item.title && item.sourceUrl)
}

// Runs queries with bounded concurrency rather than one-at-a-time — a
// plain sequential loop over the watchlist (each doing an RSS fetch plus
// up to 10 redirect-resolution fetches) is slow enough to risk tripping
// Vercel's function timeout. Concurrency is capped, not unbounded, to
// avoid hammering Google News from a single IP. Raised from 5 to 10 when
// the watchlist grew to cover EX and market research alongside CX
// (~39 -> ~70 queries) — still bounded, just enough to keep total wall
// time roughly where it was before the watchlist expanded.
const CONCURRENCY = 10

export async function fetchWatchlist(watchlist) {
  const results = []
  // Collected and returned (not just console.error'd) so a run's
  // response can actually say "these N queries failed and why" instead
  // of a silent, indistinguishable rawItems:0 — the failure would
  // otherwise only be visible in Vercel's function logs.
  const errors = []
  const queue = [...watchlist]

  async function worker() {
    while (queue.length) {
      const query = queue.shift()
      try {
        const items = await fetchQuery(query)
        results.push(...items)
      } catch (err) {
        console.error(`RSS fetch failed for query "${query}":`, err.message)
        errors.push({ query, message: err.message })
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return { items: results, errors }
}
