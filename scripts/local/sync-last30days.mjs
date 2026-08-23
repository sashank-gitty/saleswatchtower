// Local orchestrator for Issue 5's "semi-scheduled" option — run by
// launchd on your own machine, never deployed to Vercel. On each run:
//   1. Fetch the live dashboard's signals, find entities with fresh
//      'news'-origin signals not yet covered by a community-research pass.
//   2. For each (capped per run), invoke `claude -p` headless to run
//      last30days + transform its output into our schema, writing JSON
//      to a temp file.
//   3. Push that JSON into the database directly from THIS script — not
//      from inside the claude subprocess, which never receives DATABASE_URL.
//      That boundary is deliberate: the unattended LLM agent gets exactly
//      the tools it needs (WebSearch, Bash, Read, Write) and nothing that
//      touches the database.
//
// UNTESTED end-to-end — written without access to a real macOS machine,
// launchd, or a local Claude Code CLI to run it against. Expect to debug
// the claude-invocation flags (see runClaudeHeadless below) against
// whatever your installed CLI version actually supports; check
// `claude -p --help` locally before relying on this.
//
// Usage: node scripts/local/sync-last30days.mjs
// Requires DATABASE_URL in the environment (e.g. via --env-file=.env.local)
// and a working `claude` CLI on PATH, already logged in.

import { spawn } from "node:child_process"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir, homedir } from "node:os"
import path from "node:path"
import { buildLast30DaysPrompt } from "./last30days-prompt.mjs"

const DASHBOARD_URL = process.env.DASHBOARD_URL || "https://sdr-dashboard-nu.vercel.app"
const MAX_ENTITIES_PER_RUN = Number(process.env.MAX_ENTITIES_PER_RUN || 5)
const CLAUDE_TIMEOUT_MS = Number(process.env.CLAUDE_TIMEOUT_MS || 10 * 60 * 1000) // 10 min
const STATE_PATH = process.env.LAST30DAYS_STATE_PATH || path.join(homedir(), ".sdr-dashboard-last30days-state.json")

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args)
}

async function loadState() {
  try {
    return JSON.parse(await readFile(STATE_PATH, "utf-8"))
  } catch {
    return { coveredEntities: {} } // { [entity]: "YYYY-MM-DD last covered" }
  }
}

async function saveState(state) {
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2))
}

async function fetchNewsSignals() {
  const res = await fetch(`${DASHBOARD_URL}/api/signals`)
  if (!res.ok) throw new Error(`Dashboard responded ${res.status}`)
  const signals = await res.json()
  return signals.filter((s) => s.origin === "news")
}

function pickEntitiesToResearch(newsSignals, state) {
  const latestByEntity = new Map()
  for (const s of newsSignals) {
    const prev = latestByEntity.get(s.entity)
    if (!prev || s.date > prev) latestByEntity.set(s.entity, s.date)
  }

  const candidates = [...latestByEntity.entries()]
    .filter(([entity, latestDate]) => {
      const lastCovered = state.coveredEntities[entity]
      return !lastCovered || latestDate > lastCovered
    })
    .map(([entity, latestDate]) => ({ entity, latestDate }))

  // Prioritize by highest outreach_relevance seen for that entity, so a
  // capped run spends its budget on what's actually worth researching.
  const relevanceByEntity = new Map()
  for (const s of newsSignals) {
    const current = relevanceByEntity.get(s.entity) ?? 0
    relevanceByEntity.set(s.entity, Math.max(current, s.outreachRelevance ?? 0))
  }
  candidates.sort((a, b) => (relevanceByEntity.get(b.entity) ?? 0) - (relevanceByEntity.get(a.entity) ?? 0))

  return candidates.slice(0, MAX_ENTITIES_PER_RUN).map((c) => c.entity)
}

// Deliberately restricted environment for the claude subprocess — PATH/HOME
// plus whatever last30days itself needs (X/Bluesky auth if you've set it up
// locally), explicitly NOT including DATABASE_URL or CRON_SECRET. The
// database write happens in this script, after the subprocess exits, not
// inside it.
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
    // version exactly — verify with `claude -p --help` and adjust if needed.
    const child = spawn(
      "claude",
      ["-p", prompt, "--allowedTools", "WebSearch,Bash,Read,Write"],
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
    const scriptPath = path.join(import.meta.dirname, "..", "..", "db", "push-community-signals.mjs")
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
    log("DATABASE_URL not set — this script needs it to push results. Aborting.")
    process.exit(1)
  }

  const state = await loadState()
  const newsSignals = await fetchNewsSignals()
  const entities = pickEntitiesToResearch(newsSignals, state)

  log(`${entities.length} entit${entities.length === 1 ? "y" : "ies"} to research this run:`, entities)

  const workDir = await mkdtemp(path.join(tmpdir(), "last30days-sync-"))

  for (const entity of entities) {
    const outputPath = path.join(workDir, `${entity.replace(/[^a-z0-9]+/gi, "-")}.json`)
    log(`Researching "${entity}"...`)

    try {
      await runClaudeHeadless(buildLast30DaysPrompt(entity, outputPath))
      const raw = await readFile(outputPath, "utf-8")
      const findings = JSON.parse(raw)

      if (!Array.isArray(findings) || findings.length === 0) {
        log(`  No findings for "${entity}".`)
      } else {
        const pushOutput = await runPushScript(outputPath)
        log(`  ${pushOutput.trim()}`)
      }

      state.coveredEntities[entity] = new Date().toISOString().slice(0, 10)
      await saveState(state)
    } catch (err) {
      log(`  FAILED for "${entity}": ${err.message}`)
      // Deliberately do not update state on failure — retry next run.
    }
  }

  log("Run complete.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
