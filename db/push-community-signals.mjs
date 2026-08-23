// Pushes last30days-derived findings into the signals table as
// origin='community' rows (Issue 5). Run locally, never on Vercel —
// this is part of the local automation pipeline documented in
// scripts/local/README.md.
//
//   node --env-file=.env.local db/push-community-signals.mjs path/to/findings.json
//
// Expects a JSON array of objects shaped like:
//   {
//     "entity": "string",
//     "headline": "string",         // short, specific — not just the entity name
//     "scope": "macro" | "micro",
//     "signalType": "string",       // e.g. "community insight" — doesn't
//                                    // need to match the news taxonomy;
//                                    // origin='community' is what drives
//                                    // the visually distinct badge
//     "summary": "string",
//     "sourceUrl": "string",        // the actual cited URL from the report
//     "date": "YYYY-MM-DD"          // optional, defaults to today
//   }
//
// Requires DATABASE_URL — same as seed.mjs / backfill-relevance.mjs.
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { sql } from "../api/_lib/db.js"

const SCOPES = new Set(["macro", "micro"])

function idFor(dedupeKey) {
  return `community-${createHash("sha1").update(dedupeKey).digest("hex").slice(0, 16)}`
}

function isValid(item) {
  return (
    typeof item.entity === "string" &&
    item.entity.length > 0 &&
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
    console.error("Usage: node db/push-community-signals.mjs path/to/findings.json")
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
      INSERT INTO signals (id, headline, summary, source_url, date, scope, entity, signal_type, origin, dedupe_key)
      VALUES (
        ${idFor(dedupeKey)},
        ${item.headline},
        ${item.summary},
        ${item.sourceUrl},
        ${date},
        ${item.scope},
        ${item.entity},
        ${item.signalType},
        'community',
        ${dedupeKey}
      )
      ON CONFLICT (dedupe_key) DO NOTHING
    `
    pushed += 1
  }

  console.log(`Pushed ${pushed} community signal(s), skipped ${skipped} invalid.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
