import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import { extname, join, normalize, resolve } from "node:path"
import { fileURLToPath } from "node:url"

// A self-hosted replacement for the Vercel runtime.
//
// Vercel provides three things this app depends on: static hosting for
// dist/, a serverless function per file in api/, and a cron trigger. This
// server provides all three in one long-running Node process, with no
// dependencies beyond what's already installed — nothing here imports
// Express or a router, because the routing surface is four endpoints and
// a static directory.
//
// The api/*.js handlers are used unmodified. They're written against
// Vercel's req/res shape, which is the Node http req/res plus a few
// helpers (res.status().json(), a pre-parsed req.body, req.query), so
// this file supplies exactly those helpers and nothing else.

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)))
const DIST = join(ROOT, "dist")
const PORT = Number(process.env.PORT ?? 3000)
const HOST = process.env.HOST ?? "0.0.0.0"

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
}

// Vercel's response helpers, added onto the raw Node response so the
// existing handlers work untouched.
function decorate(res) {
  res.status = (code) => {
    res.statusCode = code
    return res
  }
  res.json = (payload) => {
    const body = JSON.stringify(payload)
    res.setHeader("Content-Type", "application/json; charset=utf-8")
    res.end(body)
    return res
  }
  res.send = (payload) => {
    if (typeof payload === "object" && payload !== null) return res.json(payload)
    res.end(String(payload ?? ""))
    return res
  }
  return res
}

// Vercel pre-parses JSON bodies. A malformed body leaves req.body
// undefined rather than throwing, matching how the handlers already guard
// (`req.body ?? {}`).
async function readBody(req) {
  if (req.method === "GET" || req.method === "HEAD") return undefined
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    // The only POST body this app takes is an array of signal ids. A
    // megabyte is already far past that, and refusing beyond it keeps an
    // unauthenticated endpoint from being a memory sink.
    if (size > 1_000_000) {
      const error = new Error("Request body too large")
      error.statusCode = 413
      throw error
    }
    chunks.push(chunk)
  }
  if (!chunks.length) return undefined
  const raw = Buffer.concat(chunks).toString("utf8")
  const type = req.headers["content-type"] ?? ""
  if (!type.includes("application/json")) return raw
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

// An allow-list rather than a directory scan: api/_lib/* holds the
// database client and the ingest internals, and a path-derived import
// would happily serve any of them to anyone who guessed the filename.
// Kept in sync with the real files in api/ — "territory" was removed
// (no api/territory.js exists, a stale entry from before tracked_companies
// replaced it), "companies" and "sentiment" added (both real routes that
// were missing here, silently 404ing under self-hosting only).
const ROUTES = new Set(["signals", "reviews", "ingest", "ingest-status", "companies", "sentiment", "company-profile", "account-chat", "market-data"])
const handlerCache = new Map()

async function loadHandler(name) {
  if (!handlerCache.has(name)) {
    const module = await import(join(ROOT, "api", `${name}.js`))
    handlerCache.set(name, module.default)
  }
  return handlerCache.get(name)
}

async function serveStatic(req, res, pathname) {
  // Resolve inside DIST and verify containment before touching the disk,
  // so an encoded traversal ("/../../etc/passwd") can't escape the
  // served directory.
  const unsafe = join(DIST, normalize(decodeURIComponent(pathname)))
  const filePath = resolve(unsafe)
  if (filePath !== DIST && !filePath.startsWith(DIST + "/")) {
    res.statusCode = 403
    res.end("Forbidden")
    return true
  }

  try {
    const info = await stat(filePath)
    if (!info.isFile()) return false
    const body = await readFile(filePath)
    res.setHeader("Content-Type", MIME[extname(filePath)] ?? "application/octet-stream")
    // Vite fingerprints everything under /assets/, so those are immutable.
    // index.html must never be cached or a deploy won't reach anyone.
    res.setHeader(
      "Cache-Control",
      pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
    )
    res.end(body)
    return true
  } catch {
    return false
  }
}

const server = createServer(async (req, res) => {
  decorate(res)

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`)
  const pathname = url.pathname

  try {
    if (pathname.startsWith("/api/")) {
      const name = pathname.slice(5).replace(/\/$/, "")
      if (!ROUTES.has(name)) {
        res.status(404).json({ error: "Not found" })
        return
      }

      req.query = Object.fromEntries(url.searchParams)
      req.body = await readBody(req)

      const handler = await loadHandler(name)
      await handler(req, res)
      return
    }

    if (await serveStatic(req, res, pathname)) return

    // SPA fallback: every non-file path is a client route
    // (/accounts/:key and friends), so it gets index.html and the router
    // resolves it in the browser. This is the self-hosted equivalent of
    // the rewrite rule in vercel.json.
    const html = await readFile(join(DIST, "index.html"))
    res.setHeader("Content-Type", MIME[".html"])
    res.setHeader("Cache-Control", "no-cache")
    res.end(html)
  } catch (err) {
    console.error(`${req.method} ${pathname} failed:`, err)
    if (res.headersSent) return
    res.status(err.statusCode ?? 500).json({ error: "Internal server error" })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`Listening on http://${HOST}:${PORT}`)
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL is not set — /api/signals will return 500 until it is.")
  }
})

// Graceful shutdown so a container restart doesn't sever in-flight
// requests: stop accepting new connections, let open ones finish, and
// hard-exit if something is still hanging after 10s.
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    console.log(`${signal} received, closing`)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(1), 10_000).unref()
  })
}
