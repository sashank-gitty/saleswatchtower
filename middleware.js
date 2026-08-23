// Edge middleware: HTTP Basic Auth in front of the entire deployment.
//
// Why this exists: HOSTING.md has always said the app has no
// authentication and that this "is not defensible on a domain someone
// might find". It recommends basic auth at a reverse proxy — but on
// Vercel there is no proxy layer to put it in, so this is that layer.
// It runs at the edge, before any static asset or /api/* function.
//
// What it protects: the signals themselves carry AE names, territory
// patches and account attribution, and /api/territory serves named-
// customer spend. None of that should be one URL guess away from public.
//
// FAILS CLOSED. With DASHBOARD_PASSWORD unset, every request gets a 503
// explaining what to set rather than being waved through — an
// unconfigured deployment being briefly unreachable is a far better
// outcome than one that is silently wide open.

export const config = {
  // Everything except the cron entry point. /api/ingest authenticates
  // itself with CRON_SECRET (a Bearer token Vercel Cron sends), and
  // running Basic auth in front of it would reject that header before
  // the route ever saw it.
  matcher: ["/((?!api/ingest).*)"],
}

// Length-independent, constant-time-ish comparison. The edge runtime has
// no node:crypto timingSafeEqual, so compare every character and
// accumulate rather than returning early on the first mismatch.
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false
  let diff = a.length ^ b.length
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i += 1) {
    diff |= a.charCodeAt(i % a.length || 0) ^ b.charCodeAt(i % b.length || 0)
  }
  return diff === 0
}

function unauthorized() {
  return new Response("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="SDR Dashboard", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}

export default function middleware(request) {
  // Belt and braces with the matcher above. The matcher is the documented
  // Vercel exclusion pattern and is anchored when Vercel compiles it, but
  // the cron route staying reachable is load-bearing — if it 401s, ingest
  // silently stops and the feed just goes quiet. So check the path here
  // too rather than depending on matcher semantics alone.
  const { pathname } = new URL(request.url)
  if (pathname === "/api/ingest") return undefined

  const expectedPassword = process.env.DASHBOARD_PASSWORD
  const expectedUser = process.env.DASHBOARD_USER || "sdr"

  if (!expectedPassword) {
    return new Response(
      "Dashboard is not configured.\n\n" +
        "Set DASHBOARD_PASSWORD (and optionally DASHBOARD_USER, default \"sdr\")\n" +
        "in the Vercel project's Environment Variables, then redeploy.\n\n" +
        "This deployment serves named-customer commercial data and refuses\n" +
        "to run without a password rather than defaulting to public.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } },
    )
  }

  const header = request.headers.get("authorization") || ""
  if (!header.toLowerCase().startsWith("basic ")) return unauthorized()

  let decoded
  try {
    decoded = atob(header.slice(6).trim())
  } catch {
    return unauthorized()
  }

  // Split on the FIRST colon only — a password may legitimately contain one.
  const separator = decoded.indexOf(":")
  if (separator === -1) return unauthorized()
  const user = decoded.slice(0, separator)
  const password = decoded.slice(separator + 1)

  // Both compared unconditionally so the response time doesn't reveal
  // which half was wrong.
  const userOk = safeEqual(user, expectedUser)
  const passwordOk = safeEqual(password, expectedPassword)
  if (!userOk || !passwordOk) return unauthorized()

  // Authenticated — fall through to the static asset or API function.
  return undefined
}
