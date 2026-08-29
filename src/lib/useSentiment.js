import { useEffect, useState } from "react"

// Latest public-sentiment snapshot per company (api/sentiment.js). Same
// fetch-on-mount shape as useCompanies.js — read-only, no mutations, so
// there's nothing here beyond the initial load.
export function useSentiment() {
  const [sentiment, setSentiment] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/sentiment", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setSentiment(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch((err) => {
        if (err.name === "AbortError") return
        // Best-effort, like useCompanies: a missing /api/sentiment
        // shouldn't block the rest of the app, it just means no
        // sentiment tab data shows yet.
        setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const sentimentFor = (companyKey) => sentiment.find((s) => s.companyKey === companyKey) ?? null

  return { sentiment, loading, sentimentFor }
}
