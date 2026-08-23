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
  // (customer/prospect/null), isCompetitor, and note (why you're tracking
  // it — what makes the pin icon on an existing row double as the "+ Add
  // Company" flow: same call, just with a note and possibly no live
  // signals yet).
  const setCompany = (companyKey, companyName, tracked, options = {}) => {
    const { status = null, isCompetitor: competitor = false, note = null } = options
    const optimisticRow = { companyKey, companyName, status, isCompetitor: competitor, note, createdAt: new Date().toISOString() }

    setCompanies((prev) =>
      tracked ? [optimisticRow, ...prev.filter((c) => c.companyKey !== companyKey)] : prev.filter((c) => c.companyKey !== companyKey),
    )

    const request = tracked
      ? fetch("/api/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyKey, companyName, status, isCompetitor: competitor, note }),
        })
      : fetch("/api/companies", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyKey }),
        })

    request
      .then((res) => {
        if (!res.ok) throw new Error(`Server responded ${res.status}`)
      })
      .catch((err) => {
        console.error("Failed to update tracked company:", err)
        setCompanies((prev) => (tracked ? prev.filter((c) => c.companyKey !== companyKey) : [optimisticRow, ...prev]))
      })
  }

  return { companies, loading, isTracked, trackedAt, noteFor, statusFor, isCompetitor, setCompany }
}
