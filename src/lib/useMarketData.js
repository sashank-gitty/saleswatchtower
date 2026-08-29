import { useEffect, useState } from "react"

// Latest market data (price, market cap, next earnings date) per company
// (api/market-data.js). Same fetch-on-mount shape as useSentiment.js —
// read-only, no mutations, nothing beyond the initial load.
export function useMarketData() {
  const [marketData, setMarketData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/market-data", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setMarketData(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch((err) => {
        if (err.name === "AbortError") return
        // Best-effort, like useSentiment: a missing /api/market-data
        // shouldn't block the rest of the app, it just means no market
        // data shows yet.
        setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const marketDataFor = (companyKey) => marketData.find((m) => m.companyKey === companyKey) ?? null

  return { marketData, loading, marketDataFor }
}
