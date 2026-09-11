import { useEffect, useState } from "react"

// Manually-entered org chart for one account. Refetch-after-mutation
// rather than useCompanies.js's optimistic-update-with-rollback shape —
// this is low-frequency manual data entry (adding/editing a handful of
// people), not worth the extra state-reconciliation complexity for.
export function useOrgChart(companyKey) {
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = () => {
    if (!companyKey) return
    fetch(`/api/org-chart?companyKey=${encodeURIComponent(companyKey)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPeople(Array.isArray(data) ? data : []))
      .catch(() => {})
  }

  useEffect(() => {
    if (!companyKey) {
      setPeople([])
      setLoading(false)
      return
    }
    setLoading(true)
    const controller = new AbortController()
    fetch(`/api/org-chart?companyKey=${encodeURIComponent(companyKey)}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setPeople(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch((err) => {
        if (err.name === "AbortError") return
        setLoading(false)
      })
    return () => controller.abort()
  }, [companyKey])

  const addPerson = (person) =>
    fetch("/api/org-chart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyKey, ...person }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Server responded ${res.status}`))))
      .then(() => refetch())

  const updatePerson = (id, person) =>
    fetch("/api/org-chart", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...person }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Server responded ${res.status}`))))
      .then(() => refetch())

  const removePerson = (id) =>
    fetch(`/api/org-chart?id=${id}`, { method: "DELETE" })
      .then((res) => (res.ok ? null : Promise.reject(new Error(`Server responded ${res.status}`))))
      .then(() => refetch())

  return { people, loading, addPerson, updatePerson, removePerson }
}
