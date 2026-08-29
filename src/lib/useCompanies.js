import { useEffect, useState } from "react"

// The tracked-companies list — the single thing this app asks you to set
// up. Typing a company name in and saving it here (api/companies.js) is
// what makes the next news-check start watching it; there's no separate
// "sync" step. Persisted server-side rather than localStorage, so the
// list is the same wherever the dashboard is opened.
//
// Same optimistic-update-with-rollback shape as handleToggleReviewed in
// App.jsx: flip local state immediately, then reconcile with the server,
// undoing the flip (via a functional update, so it never reads a stale
// closure of `companies`) if the write fails.
export function useCompanies() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)

  // Also called after a successful company-profile enrichment (see
  // setCompany below) — a plain re-fetch, not merged in piecemeal, so
  // the new logo/industry/HQ/etc. fields land in state without a manual
  // page reload. Best-effort like the mount-time load below: if this one
  // fails, the account page just goes on not showing a snapshot rather
  // than surfacing an error over a background refresh.
  const refetch = () => {
    fetch("/api/companies")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data)) setCompanies(data)
      })
      .catch(() => {})
  }

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/companies", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setCompanies(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch((err) => {
        if (err.name === "AbortError") return
        // Best-effort, like the sync-status fetch: a missing /api/companies
        // (e.g. `npm run dev` without `vercel dev`) shouldn't block the
        // rest of the app, it just means nothing shows as tracked yet.
        setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const isTracked = (key) => companies.some((c) => c.companyKey === key)
  const trackedAt = (key) => companies.find((c) => c.companyKey === key)?.createdAt ?? null
  const noteFor = (key) => companies.find((c) => c.companyKey === key)?.note ?? null
  const statusFor = (key) => companies.find((c) => c.companyKey === key)?.status ?? null
  const isCompetitor = (key) => companies.find((c) => c.companyKey === key)?.isCompetitor ?? false

  // `options` carries the fields beyond the boolean: status
  // (customer/prospect/null), isCompetitor, note (why you're tracking it),
  // and asxTicker (ASX code, only used by the ASX-filings ingest source —
  // see api/_lib/fetchAsxFilings.js) — what makes the pin icon on an
  // existing row double as the "+ Add Company" flow: same call, just with
  // a note and possibly no live signals yet.
  const setCompany = (companyKey, companyName, tracked, options = {}) => {
    const { status = null, isCompetitor: competitor = false, note = null, asxTicker = null } = options
    const optimisticRow = { companyKey, companyName, status, isCompetitor: competitor, note, asxTicker, createdAt: new Date().toISOString() }

    setCompanies((prev) =>
      tracked ? [optimisticRow, ...prev.filter((c) => c.companyKey !== companyKey)] : prev.filter((c) => c.companyKey !== companyKey),
    )

    const request = tracked
      ? fetch("/api/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyKey, companyName, status, isCompetitor: competitor, note, asxTicker }),
        })
      : fetch("/api/companies", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyKey }),
        })

    request
      .then((res) => {
        if (!res.ok) throw new Error(`Server responded ${res.status}`)

        // Fire the company-snapshot enrichment as its own request — not
        // awaited, not blocking this flow — right after tracking
        // succeeds. Split into its own route (api/company-profile.js)
        // after confirming directly that real web-search research
        // regularly takes 35-50+ seconds, which needs its own generous
        // slice of Vercel's 60s hard per-request ceiling rather than
        // sharing it with this POST's own work. Safe to fire on every
        // track (not just brand-new ones): the route is a fast no-op for
        // a company that already has a profile. Errors are swallowed
        // here on purpose — a failed enrichment already logs
        // server-side, and the account page simply doesn't show a
        // snapshot until it succeeds; the user tracking a company
        // shouldn't see an error over this.
        if (tracked) {
          fetch("/api/company-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyKey, companyName }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((result) => {
              // Only re-fetch when there's actually something new to
              // show — "found: true" is the one outcome that changed the
              // database; "skipped"/"found: false" leave it exactly as
              // it was, so re-fetching then would just be wasted work.
              if (result?.found) refetch()
            })
            .catch(() => {})
        }
      })
      .catch((err) => {
        console.error("Failed to update tracked company:", err)
        setCompanies((prev) => (tracked ? prev.filter((c) => c.companyKey !== companyKey) : [optimisticRow, ...prev]))
      })
  }

  return { companies, loading, isTracked, trackedAt, noteFor, statusFor, isCompetitor, setCompany }
}
