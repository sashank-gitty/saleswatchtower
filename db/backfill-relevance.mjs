// Backfill: scores every existing signal that predates ingest-time
// relevance scoring (Issue 3). Safe to re-run — by default it only
// targets rows where outreach_relevance IS NULL, so it's a no-op once
// everything has a score.
//
//   node --env-file=.env.local db/backfill-relevance.mjs
//   node --env-file=.env.local db/backfill-relevance.mjs --all
//
// Pass --all to rescore every row instead. That's what you want after
// editing shared/relevanceRubric.js: the rubric defines the bar, so
// rows scored under the old wording aren't comparable to rows scored
// under the new one, and the feed's ranking silently mixes the two.
// Without --all this script cannot fix that, because those rows already
// have a (stale) score and the default filter skips them.
//
// Requires DATABASE_URL and ANTHROPIC_API_KEY (same env pull as seeding).
import { sql } from "../api/_lib/db.js"
import { scoreRelevance } from "../api/_lib/scoreRelevance.js"

const CONCURRENCY = 4
const rescoreAll = process.argv.includes("--all")

async function main() {
  const rows = rescoreAll
    ? await sql`SELECT id, headline, summary, entity, scope, signal_type AS "signalType" FROM signals`
    : await sql`SELECT id, headline, summary, entity, scope, signal_type AS "signalType" FROM signals WHERE outreach_relevance IS NULL`

  console.log(
    rescoreAll
      ? `Rescoring all ${rows.length} signal(s) against the current rubric...`
      : `Scoring ${rows.length} signal(s) with no outreach_relevance yet...`,
  )

  let scored = 0
  let failed = 0
  const queue = [...rows]

  async function worker() {
    while (queue.length) {
      const row = queue.shift()
      try {
        const relevance = await scoreRelevance(row)
        if (relevance === null) {
          failed += 1
          continue
        }
        await sql`UPDATE signals SET outreach_relevance = ${relevance} WHERE id = ${row.id}`
        scored += 1
      } catch (err) {
        console.error(`Failed on ${row.id}:`, err.message)
        failed += 1
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  console.log(`Done. Scored: ${scored}, failed: ${failed}.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
