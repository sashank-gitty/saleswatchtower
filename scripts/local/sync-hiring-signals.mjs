// Local orchestrator for hiring-signal research — run by launchd on your
// own machine, never deployed to Vercel. Sibling of sync-last30days.mjs;
// exists as a separate script (not a flag on that one) because it started
// life as a cloud scheduled routine and had to move here once real
// testing showed a cloud routine's sandbox cannot reach this app's API at
// all (a hard network-egress policy, not a bug — confirmed by testing
// both Bash/curl and WebFetch against the live deployment, both got an
// identical EGRESS_BLOCKED denial). A local script has normal internet
// access and can hold DATABASE_URL directly, so it doesn't hit that wall.
//
// On each run:
//   1. Pick up to MAX_COMPANIES_PER_RUN tracked companies straight from
//      the database — whichever have gone longest without a hiring-signal
//      research pass (or never had one), so a big list gets rotated
//      through over several runs instead of always hitting the same few.
//   2. For each, invoke `claude -p` headless to research real hiring/team-
//      growth signals and write JSON to a temp file (hiring-signal-prompt.mjs).
//   3. Push that JSON into the database directly from THIS script — not
//      from inside the claude subprocess, same boundary sync-last30days.mjs
//      already uses: the unattended agent gets research tools and nothing
//      that touches the database.
//
// UNTESTED end-to-end, same honest caveat as sync-last30days.mjs: written
// without a real macOS machine, launchd, or local Claude Code CLI to run
// it against in this environment. Verify the claude-invocation flags
// against your installed CLI (`claude -p --help`) before trusting it.
//
// Usage: node scripts/local/sync-hiring-signals.mjs
// Requires DATABASE_URL in the environment (e.g. via --env-file=.env.local)
// and a working `claude` CLI on PATH, already logged in.

import { spawn } from "node:child_process"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir, homedir } from "node:os"
import path from "node:path"
import { sql } from "../../api/_lib/db.js"
import { buildHiringSignalPrompt } from "./hiring-signal-prompt.mjs"

const MAX_COMPANIES_PER_RUN = Number(process.env.MAX_COMPANIES_PER_RUN || 5)
const CLAUDE_TIMEOUT_MS = Number(process.env.CLAUDE_TIMEOUT_MS || 10 * 60 * 1000) // 10 min
const STATE_PATH = process.env.HIRING_SIGNAL_STATE_PATH || path.join(homedir(), ".sdr-dashboard-hiring-signal-state.json")

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
      // Never-covered companies first, then oldest-covered first.
      if (!a.lastCovered && !b.lastCovered) return 0
      if (!a.lastCovered) return -1
      if (!b.lastCovered) return 1
      return a.lastCovered < b.lastCovered ? -1 : 1
    })
    .slice(0, MAX_COMPANIES_PER_RUN)
}

// Deliberately restricted environment for the claude subprocess — PATH/HOME
// plus whatever the agent-reach skill itself needs (per-platform auth, if
// you've set it up locally), explicitly NOT including DATABASE_URL. The
// database write happens in this script, after the subprocess exits.
function claudeSubprocessEnv() {
  const allow = ["PATH", "HOME", "AUTH_TOKEN", "CT0", "XAI_API_KEY", "BSKY_HANDLE", "BSKY_APP_PASSWORD", "SCRAPECREATORS_API_KEY"]
  const env = {}
  for (const key of allow) {
    if (process.env[key]) env[key] = process.env[key]
  }
  return env
}

function runClaudeHeadless(prompt) {
  return new Promise((resolve, reject) => {
    // --allowedTools syntax/flag name may not match your installed CLI
    // version exactly — verify with `claude -p --help` and adjust if
    // needed, same caveat as sync-last30days.mjs.
    const child = spawn(
      "claude",
      ["-p", prompt, "--allowedTools", "Skill,WebSearch,Bash,Read,Write"],
      { env: claudeSubprocessEnv() },
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
    const scriptPath = path.join(import.meta.dirname, "..", "..", "db", "push-hiring-signals.mjs")
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

  const workDir = await mkdtemp(path.join(tmpdir(), "hiring-signal-sync-"))

  for (const company of companies) {
    const outputPath = path.join(workDir, `${company.companyKey.replace(/[^a-z0-9]+/gi, "-")}.json`)
    log(`Researching "${company.companyName}"...`)

    try {
      await runClaudeHeadless(buildHiringSignalPrompt(company.companyName, outputPath))
      const raw = await readFile(outputPath, "utf-8")
      const findings = JSON.parse(raw)

      if (!Array.isArray(findings) || findings.length === 0) {
        log(`  No findings for "${company.companyName}".`)
      } else {
        const pushOutput = await runPushScript(outputPath)
        log(`  ${pushOutput.trim()}`)
      }

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
