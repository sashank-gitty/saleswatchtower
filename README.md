# Sales Watchtower

A free, self-hosted account-intelligence dashboard: type in the names of
companies you want to track, and it watches the news for you. Every article
about a company on your list gets read by an AI, scored for how likely it
is to be worth a sales outreach, and shown to you in a clean feed — no
CRM, no manual searching, no spreadsheets.

Built with React, Vite, and Tailwind CSS v4. Works for any industry, any
region, any product you sell — there's nothing hardcoded to one company,
one vertical, or one country.

## What it actually does

1. **You add a company** — type a name into "Track a Company" (on the My
   Accounts page). That's the entire setup. Optionally mark it as a
   customer, a prospect, or a competitor, and jot down a note on why
   you're tracking it.
2. **It watches the news for that company**, on a schedule (daily by
   default, hourly if you self-host).
3. **An AI reads every new article** about it, summarizes it, and scores
   it 1–5 on how strong an outreach trigger it is — a new executive hire,
   a funding round, an expansion into a new market, a public complaint, a
   regulatory issue, and so on.
4. **You see it in the dashboard** — a feed, grouped by company, with a
   plain-English "why this matters" explanation and a suggested angle for
   reaching out.

Nothing is invented about a real company: every synthesized line traces
back to a real, cited news article. Contacts, tech stack, and financial
data are deliberately not guessed at — those panels say what real data
source would be needed to fill them in, rather than making something up.

## Structure

A top nav of destinations, with signals opening in a slide-over drawer
from anywhere.

**Radar** — the landing screen: what the pipeline found this week, the
stages behind it (explained honestly — what's live vs. not yet built),
and your top-priority accounts.

**Global Feed** — signals nested under the account they name, rather than
a flat chronological list. Filter by type, priority, and date range; tab
across signal categories; export the filtered set as CSV.

**Competitors** — companies you've flagged as competitors (not prospects)
get their own page, read for a different purpose: not "how do I sell into
this," but "what does this mean for how I position against them."

**Accounts** — the full derived account table: every company that's shown
up in the news, whether you're tracking it yet or not. Sortable, with a
0–100 score and a P1–P3 priority tier.

**My Accounts** — your tracked companies, plus the "Track a Company" flow
that's the whole point of this app: a name and (optionally) a note on why
you're tracking it. A company you add here starts being watched by the
next scheduled run — no signal has to exist yet.

**Account detail** — signal timeline, a "what you need to know" summary,
the full signal list, a value pyramid, discovery-question prompts, and the
score breakdown shown in the open (not hidden), plus every source.

**Search** — full-text across headlines, summaries, entities and company
names, with saved alerts that re-run live against the current signal set.

Throughout: a `Cmd/Ctrl+K` command palette, dark/light theme, and a "synced
Xh ago" indicator that turns amber if a scheduled run goes quiet or fails.

### Account scoring

Accounts are **derived from signals**, not stored separately: every signal
already carries `matchedCompanies` and `entity`, which is everything a
rollup needs. A signal naming a company on your tracked list makes that
account "tracked"; a signal naming an unrecognized company still produces
a row — that's the whitespace view, a company worth adding that you
haven't yet.

The score weights the best outreach trigger (55%), how warm the account is
right now (30%), and sustained activity (15%).

### What is deliberately not generated

Contacts and Tech Stack panels are empty by choice. Filling them would
mean inventing contacts and technology for real companies from news
headlines, and you'd repeat that on a call. Each panel names the real data
source (e.g. ZoomInfo, Lusha, BuiltWith) that would populate it instead of
guessing.

## Hosting

Runs on Vercel by default. `server/index.mjs` (zero-dependency), the
`Dockerfile`, and `npm run ingest` are everything needed to run it
anywhere else — see **[HOSTING.md](./HOSTING.md)** for self-hosting and
TLS. There's no login screen: anyone with the URL can open the dashboard,
by design — this is a single-user tool with no sensitive data behind it.

## Data pipeline

Signal data lives in Postgres (Neon, connected via Vercel's native
integration), not in the JS bundle.

- **`GET /api/signals`** — the frontend fetches this at runtime.
- **`POST /api/ingest`** — pulls Google News RSS for every company on your
  tracked list (`api/_lib/watchlist.js`), dedupes against existing rows,
  normalizes new items via a Claude API call (`api/_lib/normalize.js`),
  matches them against your tracked companies (`api/_lib/matchCompanies.js`),
  and inserts them. Triggered on a daily cron (`vercel.json`), protected
  by `CRON_SECRET`.
- **`db/migrations/`** — schema, applied in order.
- **`db/backfill-relevance.mjs`** — one-time/re-run relevance scoring pass,
  useful after editing the rubric.
- **`POST /api/reviews`** — durable "Mark Reviewed" state.
- **`GET /api/ingest-status`** — the most recent ingest run's outcome, so
  the frontend can show "last synced" honestly.
- **`GET/POST/DELETE /api/companies`** — the tracked-companies list: add,
  update, or stop tracking a company. This is the entire configuration
  surface of the app.

Row shape (camelCase over the wire, snake_case in Postgres):

```json
{
  "id": "string",
  "headline": "string",
  "summary": "string, 2-3 sentences",
  "sourceUrl": "https://...",
  "date": "YYYY-MM-DD",
  "scope": "macro | micro",
  "entity": "string",
  "signalType": "see shared/signalTypes.js for the canonical list, or 'community insight' for last30days-derived rows",
  "origin": "seed | news | community",
  "outreachRelevance": "integer 1-5, or null if not yet scored",
  "reviewed": "boolean",
  "matchedCompanies": ["companies on your tracked list this signal names"]
}
```

Tracked companies (the thing that drives everything):

```json
{
  "companyKey": "string, normalized",
  "companyName": "string",
  "status": "customer | prospect | null",
  "isCompetitor": "boolean",
  "note": "string or null"
}
```

### One-time setup (required before this works)

1. **Fork or clone this repo**, and deploy it to [Vercel](https://vercel.com)
   (connect your GitHub account, import the repo, deploy — Vercel's free
   tier covers this comfortably).
2. **Connect Postgres**: Vercel dashboard → your project → Storage →
   Connect Database → choose Neon (or Vercel Marketplace → Neon) → Connect
   to Project. This injects `DATABASE_URL` automatically.
3. **Set environment variables** (Vercel dashboard → Project → Settings →
   Environment Variables):
   - `ANTHROPIC_API_KEY` — get one at [console.anthropic.com](https://console.anthropic.com).
     Used by the ingest pipeline's normalization step; capped at $10/month
     (see below), so this can't run away on you.
   - `CRON_SECRET` — any random string you generate; Vercel automatically
     sends it as `Authorization: Bearer $CRON_SECRET` when invoking the
     cron job.
4. **Run the migrations**: open the Neon/Postgres query editor in the
   Vercel dashboard and run each file in `db/migrations/` in order.
5. **Add your first company**: open the deployed app, go to My Accounts,
   click "Track a Company." The next scheduled ingest run will pick it up
   automatically.
6. **Verify ingestion manually before trusting the cron**:
   `curl -H "Authorization: Bearer $CRON_SECRET" https://<your-deploy>/api/ingest`
   and check the response summary (`queried`, `rawItems`, `afterDedupe`,
   `normalized`, `inserted`, `companyMatched`, `errors`, `fetchErrors`).
   A non-empty `fetchErrors` means one of your search terms couldn't be
   searched at all (network issue) — worth a look if `rawItems` stays at
   0 for a company you know is in the news.

On watchlist size: each run queries the news once per company you're
tracking, plus anything you've added to `STANDING_WATCHLIST` in
`api/_lib/watchlist.js` (empty by default — add your own industry/region
searches there if you want them). `api/_lib/fetchNews.js`'s fetch
concurrency is 10. A very large tracked list (100+ companies) is capped
per run — see the comment in `watchlist.js`.

### Monthly Claude API budget guardrail

`api/_lib/budget.js` enforces a hard **$10/calendar-month** ceiling on
Claude API spend from the ingest normalizer, independent of how often
`/api/ingest` runs. Every normalization call's real token usage is logged
to the `llm_spend` table immediately after the call; before each call,
`normalizeItem` sums this month's spend and stops calling the API once at
or above the cap, reporting `summary.budgetExceeded: true` instead of
silently truncating the feed. To change the cap, edit
`MONTHLY_BUDGET_USD` in `api/_lib/budget.js`.

## Community signals (optional, advanced)

A third data source beyond the news pipeline: the `last30days` Claude
Code skill run locally against tracked entities, transformed into the same
schema, and pushed in as `origin: 'community'` rows. This cannot run on
Vercel — it needs a real Claude Code session with genuine internet access,
which a serverless function doesn't have. See `scripts/local/README.md`
for setup. Entirely optional; skip it if you just want the news pipeline.

## Development

```
npm install
npm run dev
```

`npm run dev` only runs the Vite frontend — `/api/*` routes need
`vercel dev` (or a deployed environment) to actually execute. Without
that, the UI falls back to a small fixture of clearly-fake example data
(`src/data/data.json`) so you can see the layout before connecting a real
database.

## Build

```
npm run build
```

Outputs a static site to `dist/`, ready to deploy on Vercel.

## License

MIT — see [LICENSE](./LICENSE). Free to use, modify, and redistribute.
