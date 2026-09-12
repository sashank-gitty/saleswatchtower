import { useEffect, useState } from "react"

// Real-time company search via Clearbit's autocomplete endpoint — free,
// no API key, CORS-open, called directly from the browser (verified
// live before this was first built into MyCompanySection.jsx). Shared
// between that Settings form and TopNav's quick-switch dropdown so the
// debounce/fetch logic lives in exactly one place. Fails completely
// silently on any error — no suggestions just means whatever UI is
// using this falls back to plain typing.
export function useCompanySuggestions(query, enabled = true) {
  const [suggestions, setSuggestions] = useState([])

  useEffect(() => {
    const trimmed = query.trim()
    if (!enabled || trimmed.length < 2) {
      setSuggestions([])
      return
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setSuggestions(Array.isArray(data) ? data.slice(0, 6) : []))
        .catch(() => {})
    }, 250)
    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [query, enabled])

  return suggestions
}
