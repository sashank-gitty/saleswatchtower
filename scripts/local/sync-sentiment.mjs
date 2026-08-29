// Local orchestrator for public-sentiment research — run by launchd on
// your own machine, never deployed to Vercel. Sibling of
// sync-hiring-signals.mjs, same reasoning for why this is a local script
// and not a cloud routine (see that file, or scripts/local/README.md):
// a cloud routine's sandbox cannot call back into this app at all, tested
// and confirmed the hard way. Also reuses that script's two fixes to the
// `claude -p` invocation (stdio, subprocess env allowlist) — both real
// bugs, found by actually running it, not guessed.
//
// On each run:
//   1. Pick up to MAX_COMPANIES_PER_RUN tracked companies straight from
//      the database — whichever have gone longest without a sentiment
//      research pass (or never had one).
//   2. For each, invoke `claude -p` headless to run last30days + agent-reach
//      and synthesize one sentiment snapshot to a temp JSON file
//      (sentiment-prompt.mjs).
//   3. Push that JSON into the database directly from THIS script — the
//      unattended agent gets research tools and nothing that touches the
//      database.
//
// UNTESTED end-to-end at the time of writing (unlike sync-hiring-signals.mjs,
// which WAS run for real while building it) — the prompt and push script
// follow the exact same proven shape, but a real run against a real
// company hasn't happened yet. Test manually before scheduling it:
//   node --env-file=.env.local scripts/local/sync-sentiment.mjs
//
// Requires DATABASE_URL in the environment and a working `claude` CLI on
// PATH, already logged in.

import { spawn } from "node:child_process"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir, homedir } from "node:os"
import path from "node:path"
import { sql } from "../../api/_lib/db.js"
import { buildSentimentPrompt } from "./sentiment-prompt.mjs"

// Smaller than the hiring-signal sync's default (5) — this pass runs two
// skills per company (last30days + agent-reach), so it costs roughly
// double per company.
const MAX_COMPANIES_PER_RUN = Number(process.env.MAX_COMPANIES_PER_RUN || 3)
const CLAUDE_TIMEOUT_MS = Number(process.env.CLAUDE_TIMEOUT_MS || 15 * 60 * 1000) // 15 min — two skills, more headroom than the 10 min hiring-signal default
const STATE_PATH = process.env.SENTIMENT_STATE_PATH || path.join(homedir(), ".sdr-dashboard-sentiment-state.json")

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args)
}

async function loadState() {
  try {
    return JSON.parse(await readFile(STATE_PATH, "utf-8"))
  } catch {
    return { lastCovered: {} } // { [companyKey]: "YYYY-MM-DD last researched" }
  }
}

async function saveState(state) {
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2))
}

async function pickCompaniesToResearch(state) {
  const rows = await sql`SELECT company_key, company_name FROM tracked_companies`
  return rows
    .map((row) => ({
      companyKey: row.company_key,
      companyName: row.company_name,
      lastCovered: state.lastCovered[row.company_key] ?? null,
    }))
    .sort((a, b) => {
      if (!a.lastCovered && !b.lastCovered) return 0
      if (!a.lastCovered) return -1
      if (!b.lastCovered) return 1
      return a.lastCovered < b.lastCovered ? -1 : 1
    })
    .slice(0, MAX_COMPANIES_PER_RUN)
}

// Deliberately restricted environment for the claude subprocess — see
// sync-hiring-signals.mjs for why SHELL/USER/LOGNAME are required
// alongside PATH/HOME (confirmed by testing, not assumed). Explicitly
// NOT including DATABASE_URL — the database write happens in this
// script, after the subprocess exits.
function claudeSubprocessEnv() {
  const allow = [
    "PATH",
    "HOME",
    "SHELL",
    "USER",
    "LOGNAME",
    "AUTH_TOKEN",
    "CT0",
    "XAI_API_KEY",
    "BSKY_HANDLE",
    "BSKY_APP_PASSWORD",
    "SCRAPECREATORS_API_KEY",
  ]
  const env = {}
  for (const key of allow) {
    if (process.env[key]) env[key] = process.env[key]
  }
  return env
}

function runClaudeHeadless(prompt) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "claude",
      ["-p", prompt, "--allowedTools", "Skill,WebSearch,WebFetch,Bash,Read,Write"],
      { env: claudeSubprocessEnv(), stdio: ["ignore", "pipe", "pipe"] },
    )

    const timer = setTimeout(() => {
      child.kill("SIGTERM")
      reject(new Error("claude -p timed out"))
    }, CLAUDE_TIMEOUT_MS)

    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (d) => (stdout += d))
    child.stderr.on("data", (d) => (stderr += d))

    child.on("close", (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(stdout)
      else reject(new Error(`claude -p exited ${code}: ${stderr.slice(0, 500)}`))
    })
  })
}

function runPushScript(jsonFilePath) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(import.meta.dirname, "..", "..", "db", "push-sentiment.mjs")
    const child = spawn("node", [scriptPath, jsonFilePath], { env: process.env })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (d) => (stdout += d))
    child.stderr.on("data", (d) => (stderr += d))
    child.on("close", (code) => {
      if (code === 0) resolve(stdout)
      else reject(new Error(`push script exited ${code}: ${stderr.slice(0, 500)}`))
    })
  })
}

async function main() {
  if (!process.env.DATABASE_URL) {
    log("DATABASE_URL not set — this script needs it to read tracked companies and push results. Aborting.")
    process.exit(1)
  }

  const state = await loadState()
  const companies = await pickCompaniesToResearch(state)

  log(`${companies.length} compan${companies.length === 1 ? "y" : "ies"} to research this run:`, companies.map((c) => c.companyName))

  const workDir = await mkdtemp(path.join(tmpdir(), "sentiment-sync-"))

  for (const company of companies) {
    const outputPath = path.join(workDir, `${company.companyKey.replace(/[^a-z0-9]+/gi, "-")}.json`)
    log(`Researching "${company.companyName}"...`)

    try {
      await runClaudeHeadless(buildSentimentPrompt(company.companyKey, company.companyName, outputPath))
      const pushOutput = await runPushScript(outputPath)
      log(`  ${pushOutput.trim()}`)

      state.lastCovered[company.companyKey] = new Date().toISOString().slice(0, 10)
      await saveState(state)
    } catch (err) {
      log(`  FAILED for "${company.companyName}": ${err.message}`)
      // Deliberately do not update state on failure — retry next run.
    }
  }

  log("Run complete.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
