// Pushes hiring-signal findings into the signals table as
// origin='hiring_signal' rows. Run locally, never on Vercel — part of the
// local automation pipeline documented in scripts/local/README.md.
// Sibling of push-community-signals.mjs; kept as a separate script rather
// than a shared flag because the two differ in one meaningful way: this
// one always knows exactly which tracked company it researched, so it
// fills in matched_companies (community's free-text entity can't).
//
//   node --env-file=.env.local db/push-hiring-signals.mjs path/to/findings.json
//
// Expects a JSON array of objects shaped like:
//   {
//     "companyName": "string",      // exact tracked_companies.company_name
//     "headline": "string",
//     "scope": "macro" | "micro",
//     "signalType": "string",       // e.g. "hiring surge"
//     "summary": "string",
//     "sourceUrl": "string",        // the actual cited URL
//     "date": "YYYY-MM-DD"          // optional, defaults to today
//   }
//
// Requires DATABASE_URL — same as seed.mjs / backfill-relevance.mjs.
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { sql } from "../api/_lib/db.js"

const SCOPES = new Set(["macro", "micro"])

function idFor(dedupeKey) {
  return `hiring-${createHash("sha1").update(dedupeKey).digest("hex").slice(0, 16)}`
}

function isValid(item) {
  return (
    typeof item.companyName === "string" &&
    item.companyName.length > 0 &&
    typeof item.headline === "string" &&
    item.headline.length > 0 &&
    SCOPES.has(item.scope) &&
    typeof item.signalType === "string" &&
    item.signalType.length > 0 &&
    typeof item.summary === "string" &&
    item.summary.length > 0 &&
    typeof item.sourceUrl === "string" &&
    item.sourceUrl.length > 0
  )
}

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error("Usage: node db/push-hiring-signals.mjs path/to/findings.json")
    process.exit(1)
  }

  const raw = await readFile(filePath, "utf-8")
  const items = JSON.parse(raw)
  if (!Array.isArray(items)) {
    console.error("Expected a JSON array of findings.")
    process.exit(1)
  }

  let pushed = 0
  let skipped = 0

  for (const item of items) {
    if (!isValid(item)) {
      console.warn("Skipping invalid item (missing/bad fields):", JSON.stringify(item).slice(0, 200))
      skipped += 1
      continue
    }

    const date = item.date || new Date().toISOString().slice(0, 10)
    const dedupeKey = item.sourceUrl

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
    pushed += 1
  }

  console.log(`Pushed ${pushed} hiring signal(s), skipped ${skipped} invalid.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
