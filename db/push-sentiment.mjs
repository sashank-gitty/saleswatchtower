// Pushes one company-sentiment snapshot into company_sentiment. Run
// locally, never on Vercel — part of the local automation pipeline
// documented in scripts/local/README.md. Sibling of push-hiring-signals.mjs,
// but this table is append-only snapshots, not discrete signal rows, so
// the shape (and the insert itself, one row not many) is different enough
// to be its own script rather than a shared flag.
//
//   node --env-file=.env.local db/push-sentiment.mjs path/to/sentiment.json
//
// Expects a single JSON object shaped like:
//   {
//     "companyKey": "string",       // tracked_companies.company_key
//     "companyName": "string",
//     "overallSentiment": "positive" | "mixed" | "neutral" | "negative",
//     "summary": "string",
//     "themes": ["string", ...],                 // may be empty
//     "evidence": [{ "source": "news"|"reddit"|"social"|"web", "headline": "string", "url": "string", "date": "YYYY-MM-DD"? }, ...]  // may be empty
//   }
//
// Requires DATABASE_URL — same as seed.mjs / backfill-relevance.mjs.
import { readFile } from "node:fs/promises"
import { sql } from "../api/_lib/db.js"

const SENTIMENTS = new Set(["positive", "mixed", "neutral", "negative"])
const EVIDENCE_SOURCES = new Set(["news", "reddit", "social", "web"])

function isValidEvidence(item) {
  return (
    item &&
    typeof item === "object" &&
    EVIDENCE_SOURCES.has(item.source) &&
    typeof item.headline === "string" &&
    item.headline.length > 0 &&
    typeof item.url === "string" &&
    item.url.length > 0
  )
}

function isValid(item) {
  return (
    item &&
    typeof item.companyKey === "string" &&
    item.companyKey.length > 0 &&
    typeof item.companyName === "string" &&
    item.companyName.length > 0 &&
    SENTIMENTS.has(item.overallSentiment) &&
    typeof item.summary === "string" &&
    item.summary.length > 0 &&
    Array.isArray(item.themes) &&
    item.themes.every((t) => typeof t === "string") &&
    Array.isArray(item.evidence) &&
    item.evidence.every(isValidEvidence)
  )
}

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error("Usage: node db/push-sentiment.mjs path/to/sentiment.json")
    process.exit(1)
  }

  const raw = await readFile(filePath, "utf-8")
  const item = JSON.parse(raw)

  if (!isValid(item)) {
    console.error("Invalid sentiment payload (missing/bad fields):", JSON.stringify(item).slice(0, 300))
    process.exit(1)
  }

  await sql`
    INSERT INTO company_sentiment (company_key, company_name, overall_sentiment, summary, themes, evidence)
    VALUES (
      ${item.companyKey},
      ${item.companyName},
      ${item.overallSentiment},
      ${item.summary},
      ${JSON.stringify(item.themes)},
      ${JSON.stringify(item.evidence)}
    )
  `

  console.log(`Pushed sentiment snapshot for "${item.companyName}" (${item.overallSentiment}, ${item.evidence.length} evidence item(s)).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
