import { useCallback, useEffect, useRef, useState } from "react"

const ARRAY_KEYS = new Set(["scope", "type", "entity"])

function parseSearch(search) {
  const params = new URLSearchParams(search)
  const state = {}
  for (const key of params.keys()) {
    if (state[key] !== undefined) continue
    const raw = params.get(key)
    state[key] = ARRAY_KEYS.has(key) ? raw.split(",").filter(Boolean) : raw
  }
  return state
}

function serializeState(state) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(state)) {
    if (value === undefined || value === null || value === "") continue
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(","))
    } else {
      params.set(key, String(value))
    }
  }
  return params.toString()
}

// URL-backed replacement for useLocalStorageState/useState for anything
// that should be shareable — filters, search, the open detail signal.
// Nothing here was bookmarkable or linkable before: state lived only in
// component state or localStorage, invisible outside the browser that set
// it. The actual pushState/replaceState call happens in an effect (not
// inside the setState updater) so React 18/19 Strict Mode's dev-time
// double-invoke of updaters can't fire a history write twice.
export function useUrlState() {
  const [state, setState] = useState(() => parseSearch(window.location.search))
  const pendingMode = useRef("replace")

  useEffect(() => {
    function handlePopState() {
      setState(parseSearch(window.location.search))
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  useEffect(() => {
    const query = serializeState(state)
    const url = `${window.location.pathname}${query ? `?${query}` : ""}`
    const current = `${window.location.pathname}${window.location.search}`
    if (url !== current) {
      if (pendingMode.current === "push") window.history.pushState(null, "", url)
      else window.history.replaceState(null, "", url)
    }
    pendingMode.current = "replace"
  }, [state])

  // Fine-grained changes (checkbox toggles, typing, quick-filter clicks)
  // default to `replace` so exploring filters doesn't flood browser
  // history with one entry per click. `push: true` is for the one action
  // where a real back-button entry is worth it: opening a signal's detail
  // panel — closing it (Escape, the X, or plain Back) should return you to
  // exactly where you were.
  const updateUrl = useCallback((patch, { push = false } = {}) => {
    pendingMode.current = push ? "push" : "replace"
    setState((prev) => ({ ...prev, ...patch }))
  }, [])

  return [state, updateUrl]
}
