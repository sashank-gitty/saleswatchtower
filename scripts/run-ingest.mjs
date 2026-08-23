// Runs one ingest pass from the command line, for deployments that have
// no Vercel cron behind them.
//
// This calls the handler in-process rather than curl-ing the running
// server, which means the ingest can be scheduled independently of the
// web process — a system crontab entry, a Kubernetes CronJob, a Fly
// machine on a schedule — without the web process needing to be reachable
// or even running. It also keeps a long ingest from occupying a request
// slot on the server that's serving the dashboard.
//
// Usage:
//   node --env-file=.env.local scripts/run-ingest.mjs
//   npm run ingest
//
// Exits non-zero when the run fails, so cron and CI report it.

import handler from "../api/ingest.js"

const secret = process.env.CRON_SECRET

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.")
  process.exit(1)
}

// Minimal stand-ins for the Vercel req/res pair. The handler only reaches
// for the method, the authorization header, and the response helpers.
const req = {
  method: "POST",
  headers: secret ? { authorization: `Bearer ${secret}` } : {},
  query: {},
  body: undefined,
}

let statusCode = 200

const res = {
  status(code) {
    statusCode = code
    return this
  },
  json(payload) {
    const output = JSON.stringify(payload, null, 2)
    if (statusCode >= 400) console.error(output)
    else console.log(output)
    return this
  },
  setHeader() {
    return this
  },
  end() {
    return this
  },
}

try {
  await handler(req, res)
} catch (err) {
  console.error("Ingest threw:", err)
  process.exit(1)
}

if (statusCode >= 400) {
  console.error(`Ingest failed with status ${statusCode}`)
  process.exit(1)
}

console.log("Ingest completed.")
