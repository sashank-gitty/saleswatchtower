import { neon } from "@neondatabase/serverless"

// @vercel/postgres is deprecated as of this writing — Vercel's own
// guidance is to connect Postgres via the native Neon integration and use
// @neondatabase/serverless directly. DATABASE_URL is the env var Neon's
// Vercel integration injects; if you connect a different Postgres
// provider, update this to match whatever it names the connection string.
//
// neon() throws synchronously on a missing/malformed connection string, so
// construction is deferred until first use — an unset DATABASE_URL should
// surface as a clean 500 from the route's try/catch, not a cold-start crash.
let _sql = null

export function sql(...args) {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set — connect the Postgres integration in Vercel project settings.")
    }
    _sql = neon(process.env.DATABASE_URL)
  }
  return _sql(...args)
}
