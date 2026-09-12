import { useEffect, useState } from "react"

// Your own company profile — the seed for "type in your company,
// everything adapts." Module-level shared state, not per-component: a
// real bug found live (TopNav's badge stayed on your own name after
// research succeeded in Settings, until a full page reload) came from
// every useMyCompany() call site holding its own independent copy.
// Every consumer (TopNav's badge, Settings' form, the account-page
// panels) now reads the same singleton and re-renders together the
// moment any one of them saves — no reload needed. `researching` stays
// per-call-site on purpose: that's "is *my* button showing a spinner,"
// not shared data.
let sharedProfile = null
let sharedLoading = true
let fetchStarted = false
const listeners = new Set()

function notify() {
  listeners.forEach((fn) => fn())
}

function setShared(profile) {
  sharedProfile = profile
  sharedLoading = false
  notify()
}

function ensureFetched() {
  if (fetchStarted) return
  fetchStarted = true
  fetch("/api/deal-tools?resource=my-company")
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => setShared(data))
    .catch(() => {
      sharedLoading = false
      notify()
    })
}

export function useMyCompany() {
  const [, setTick] = useState(0)
  const [researching, setResearching] = useState(false)

  useEffect(() => {
    const listener = () => setTick((n) => n + 1)
    listeners.add(listener)
    ensureFetched()
    return () => listeners.delete(listener)
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
        if (data.found) setShared(data.profile)
        return data
      })
      .finally(() => setResearching(false))
  }

  const save = ({ valueProp, competitors, strategicPriorities }) =>
    fetch("/api/deal-tools?resource=my-company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valueProp, competitors, strategicPriorities }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Server responded ${res.status}`))))
      .then((data) => setShared(data))

  return { profile: sharedProfile, loading: sharedLoading, researching, research, save }
}
