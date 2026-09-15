import { useEffect, useState } from "react"

// Your own company profile — the seed for "type in your company,
// everything adapts." Module-level shared state, not per-component: a
// real bug found live (TopNav's badge stayed on your own name after
// research succeeded in Settings, until a full page reload) came from
// every useMyCompany() call site holding its own independent copy.
// Every consumer (TopNav's badge, Settings' form, the account-page
// panels) now reads the same singleton and re-renders together the
// moment any one of them saves — no reload needed.
//
// `researching` is shared too, not per-call-site — a company switch can
// be kicked off from TopNav's quick-switch dropdown just as easily as
// from Settings, and the app-wide loading overlay (App.jsx) needs to
// know regardless of which one started it. There's only ever one real
// research call in flight at a time (this is a singleton profile), so
// one shared flag is the honest model, not an approximation.
let sharedProfile = null
let sharedLoading = true
let sharedResearching = false
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

  useEffect(() => {
    const listener = () => setTick((n) => n + 1)
    listeners.add(listener)
    ensureFetched()
    return () => listeners.delete(listener)
  }, [])

  const research = (companyName) => {
    sharedResearching = true
    notify()
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
      .finally(() => {
        sharedResearching = false
        notify()
      })
  }

  const save = ({ valueProp, competitors, strategicPriorities }) =>
    fetch("/api/deal-tools?resource=my-company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valueProp, competitors, strategicPriorities }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Server responded ${res.status}`))))
      .then((data) => setShared(data))

  return { profile: sharedProfile, loading: sharedLoading, researching: sharedResearching, research, save }
}
