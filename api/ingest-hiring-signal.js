import { createHash } from "node:crypto"
import { sql } from "./_lib/db.js"

// Write-back door for the hiring-signal scheduled cloud routine (see
// scripts/local/README.md's cloud-routine section and shared/signalTypes.js's
// "hiring surge" type). A cloud routine can't reach DATABASE_URL — it runs
// in an isolated sandbox with no access to this app's local secrets — so
// this is a small, separately-secured endpoint it can call instead.
//
// Deliberately its own secret (HIRING_SIGNAL_SECRET), not a reuse of
// CRON_SECRET: CRON_SECRET authorizes a full ingest run against Google
// News/ASX; this only ever inserts hiring-surge findings. Keeping them
// separate means this secret being embedded in a cloud routine's prompt
// (necessary — the routine has no other way to hold it) can't be used for
// anything beyond that one narrow action if it ever leaked.
const MAX_FINDINGS_PER_REQUEST = 50

function idFor(dedupeKey) {
  return `hiring-${createHash("sha1").update(dedupeKey).digest("hex").slice(0, 16)}`
}

function isValid(item) {
  return (
    typeof item.companyName === "string" &&
    item.companyName.length > 0 &&
    typeof item.headline === "string" &&
    item.headline.length > 0 &&
    (item.scope === "macro" || item.scope === "micro") &&
    typeof item.signalType === "string" &&
    item.signalType.length > 0 &&
    typeof item.summary === "string" &&
    item.summary.length > 0 &&
    typeof item.sourceUrl === "string" &&
    item.sourceUrl.length > 0
  )
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  const authHeader = req.headers.authorization
  if (!process.env.HIRING_SIGNAL_SECRET || authHeader !== `Bearer ${process.env.HIRING_SIGNAL_SECRET}`) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  // GET: the routine's starting point each run — who to research. Kept on
  // this same route/secret rather than opening up the already-Basic-Auth-
  // protected /api/companies (see middleware.js) to a second exemption;
  // one narrow door, one narrow secret, same shape as /api/ingest already
  // reading tracked_companies itself under CRON_SECRET.
  if (req.method === "GET") {
    try {
      const rows = await sql`
        SELECT company_key, company_name, note, is_competitor
        FROM tracked_companies
        ORDER BY created_at DESC
      `
      res.status(200).json(
        rows.map((row) => ({
          companyKey: row.company_key,
          companyName: row.company_name,
          note: row.note,
          isCompetitor: row.is_competitor,
        })),
      )
    } catch (err) {
      console.error("GET /api/ingest-hiring-signal failed:", err)
      res.status(500).json({ error: "Failed to load tracked companies" })
    }
    return
  }

  const findings = req.body?.findings
  if (!Array.isArray(findings)) {
    res.status(400).json({ error: "Expected { findings: [...] }" })
    return
  }
  if (findings.length > MAX_FINDINGS_PER_REQUEST) {
    res.status(400).json({ error: `At most ${MAX_FINDINGS_PER_REQUEST} findings per request` })
    return
  }

  let inserted = 0
  let skipped = 0

  for (const item of findings) {
    if (!isValid(item)) {
      skipped += 1
      continue
    }

    const date = item.date || new Date().toISOString().slice(0, 10)
    const dedupeKey = item.sourceUrl

    try {
      await sql`
        INSERT INTO signals (id, headline, summary, source_url, date, scope, entity, signal_type, origin, dedupe_key, matched_companies)
        VALUES (
          ${idFor(dedupeKey)},
          ${item.headline},
          ${item.summary},
          ${item.sourceUrl},
          ${date},
          ${item.scope},
          ${item.companyName},
          ${item.signalType},
          'hiring_signal',
          ${dedupeKey},
          ${[item.companyName]}
        )
        ON CONFLICT (dedupe_key) DO NOTHING
      `
      inserted += 1
    } catch (err) {
      console.error("ingest-hiring-signal: failed on item", dedupeKey, err)
      skipped += 1
    }
  }

  res.status(200).json({ inserted, skipped })
}
