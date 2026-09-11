import { useEffect, useState } from "react"

// Your own company profile — the seed for "type in your company,
// everything adapts." Fetched once (this is a singleton, unlike every
// other hook in this app which fetches a list), refetched after
// research or a manual save.
export function useMyCompany() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [researching, setResearching] = useState(false)

  const refetch = () =>
    fetch("/api/deal-tools?resource=my-company")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setProfile(data))
      .catch(() => {})

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/deal-tools?resource=my-company", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setProfile(data)
        setLoading(false)
      })
      .catch((err) => {
        if (err.name === "AbortError") return
        setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const research = (companyName) => {
    setResearching(true)
    return fetch("/api/deal-tools?resource=my-company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Server responded ${res.status}`))))
      .then((data) => {
        if (data.found) setProfile(data.profile)
        return data
      })
      .finally(() => setResearching(false))
  }

  const save = ({ valueProp, competitors }) =>
    fetch("/api/deal-tools?resource=my-company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valueProp, competitors }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Server responded ${res.status}`))))
      .then(() => refetch())

  return { profile, loading, researching, research, save }
}
