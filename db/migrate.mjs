// Runs the SQL files in db/migrations/ against DATABASE_URL, in order.
//
//   node --env-file=.env.local db/migrate.mjs
//   node --env-file=.env.local db/migrate.mjs --dry-run
//
// Every migration in this directory is written to be idempotent (ADD
// COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS), so running the
// whole set is safe whether the database is empty or fully up to date.
// That's deliberate: it means there's no migration-state table to keep
// in sync and no way to apply them in the wrong order by mistake.
//
// The alternative is pasting each file into the Neon query editor in
// the browser, which works fine but is easy to get half-right when a
// file is forty lines long.
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { neon } from "@neondatabase/serverless"

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "migrations")
const dryRun = process.argv.includes("--dry-run")

// Neon's HTTP driver sends one statement per request, so a multi-statement
// file has to be split. Strip `--` line comments first, then split on
// semicolons. Safe for these files specifically: none of them contain a
// semicolon inside a string literal or a dollar-quoted block. If a future
// migration needs either (a trigger, a plpgsql function), run that one
// through the Neon editor instead of teaching this a real SQL parser.
function statementsIn(sqlText) {
  return sqlText
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
}

async function main() {
  // --dry-run only parses local files, so it deliberately doesn't need
  // a connection string — it's the way to check what would run before
  // pointing this at a real database.
  if (!dryRun && !process.env.DATABASE_URL) {
    console.error(
      "DATABASE_URL is not set. Run `vercel env pull .env.local` first, then\n" +
        "pass it through: node --env-file=.env.local db/migrate.mjs",
    )
    process.exit(1)
  }

  const sql = dryRun ? null : neon(process.env.DATABASE_URL)
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()

  console.log(`${dryRun ? "Would run" : "Running"} ${files.length} migration file(s)\n`)

  for (const file of files) {
    const statements = statementsIn(readFileSync(join(MIGRATIONS_DIR, file), "utf8"))
    console.log(`${file}  (${statements.length} statement${statements.length === 1 ? "" : "s"})`)

    for (const statement of statements) {
      const preview = statement.replace(/\s+/g, " ").slice(0, 88)
      if (dryRun) {
        console.log(`   · ${preview}`)
        continue
      }
      try {
        await sql.query(statement)
        console.log(`   ✓ ${preview}`)
      } catch (err) {
        console.error(`   ✗ ${preview}\n     ${err.message}`)
        throw err
      }
    }
    console.log()
  }

  console.log(dryRun ? "Dry run complete — nothing was changed." : "All migrations applied.")
}

main().catch((err) => {
  console.error("\nMigration failed:", err.message)
  process.exit(1)
})
