import { useEffect, useMemo, useState } from "react"

export const PILLARS = [
  { id: "metrics", label: "Metrics" },
  { id: "economic_buyer", label: "Economic Buyer" },
  { id: "decision_criteria", label: "Decision Criteria" },
  { id: "decision_process", label: "Decision Process" },
  { id: "paper_process", label: "Paper Process" },
  { id: "identify_pain", label: "Identify Pain" },
  { id: "champion", label: "Champion" },
  { id: "competition", label: "Competition" },
]

function emptyEntry(pillar) {
  return { pillar, freeText: "", checklistDone: false, aiScore: null, aiFeedback: null }
}

export function useMeddpicc(companyKey) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = () => {
    if (!companyKey) return
    fetch(`/api/deal-tools?resource=meddpicc&companyKey=${encodeURIComponent(companyKey)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => {})
  }

  useEffect(() => {
    if (!companyKey) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    const controller = new AbortController()
    fetch(`/api/deal-tools?resource=meddpicc&companyKey=${encodeURIComponent(companyKey)}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setRows(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch((err) => {
        if (err.name === "AbortError") return
        setLoading(false)
      })
    return () => controller.abort()
  }, [companyKey])

  // Every pillar always has a slot, whether or not it has a saved row
  // yet — the panel always shows all 8, blank ones included, rather than
  // only showing pillars someone has already touched.
  const entries = useMemo(
    () => PILLARS.map(({ id }) => rows.find((r) => r.pillar === id) ?? emptyEntry(id)),
    [rows],
  )

  const overallScore = useMemo(() => {
    const scored = entries.filter((e) => e.aiScore != null)
    if (scored.length === 0) return null
    // Unscored pillars count as 0 toward the average — a real gap should
    // pull the overall confidence down, not be excluded from it.
    const sum = entries.reduce((total, e) => total + (e.aiScore ?? 0), 0)
    return Math.round(sum / entries.length)
  }, [entries])

  const saveEntry = (pillar, { freeText, checklistDone }) =>
    fetch("/api/deal-tools?resource=meddpicc", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyKey, pillar, freeText, checklistDone }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Server responded ${res.status}`))))
      .then(() => refetch())

  const scoreEntry = (pillar, freeText) =>
    fetch("/api/deal-tools?resource=meddpicc-score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyKey, pillar, freeText }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Server responded ${res.status}`))))
      .then((data) => {
        refetch()
        return data
      })

  return { entries, overallScore, loading, saveEntry, scoreEntry }
}
