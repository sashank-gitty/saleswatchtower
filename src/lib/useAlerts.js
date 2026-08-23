import { useLocalStorageState } from "./useLocalStorageState.js"
import { groupForSignal } from "./signalGroups.js"
import { matchesQuery } from "./textMatch.js"

// Saved search alerts.
//
// Stored in localStorage, not Postgres — and that is a real limitation
// worth being plain about rather than hiding: an alert saved here lives
// in one browser, and nothing actually sends the email it promises.
// Delivery needs a scheduled job with a mail transport, which is a
// server-side change (see the hosting notes in HOSTING.md — the cron
// that would run this is the same one that runs ingest).
//
// What this does give you today is the saved *query*: a named, re-runnable
// filter set with a live match count, which is the half of the feature
// that works without any backend at all. The UI says so explicitly rather
// than implying mail is going out.

export function useAlerts() {
  const [alerts, setAlerts] = useLocalStorageState("sdr-dashboard-alerts", [])

  const createAlert = (alert) => {
    setAlerts((prev) => [
      {
        id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString().slice(0, 10),
        active: true,
        ...alert,
      },
      ...prev,
    ])
  }

  const updateAlert = (id, patch) => {
    setAlerts((prev) => prev.map((alert) => (alert.id === id ? { ...alert, ...patch } : alert)))
  }

  const deleteAlert = (id) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id))
  }

  return { alerts, createAlert, updateAlert, deleteAlert }
}

// Re-runs a saved alert's query against the current signal set, so the
// alerts page can show "what would this have caught" instead of a static
// row.
export function matchAlert(alert, signals) {
  const query = alert.query ?? ""
  return signals.filter((signal) => {
    if (alert.group && alert.group !== "all" && groupForSignal(signal) !== alert.group) return false
    if (alert.days) {
      const cutoff = new Date()
      cutoff.setHours(0, 0, 0, 0)
      cutoff.setDate(cutoff.getDate() - Number(alert.days))
      if (new Date(`${signal.date}T00:00:00`) < cutoff) return false
    }
    if (query) {
      const haystack = `${signal.headline} ${signal.summary} ${signal.entity} ${(signal.matchedCompanies ?? []).join(" ")}`
      if (!matchesQuery(haystack, query)) return false
    }
    return true
  })
}
