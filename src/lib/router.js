import { useEffect, useState } from "react"

// A ~40-line History-API router, deliberately not react-router. The app
// only has six top-level destinations and one dynamic segment
// (/accounts/:id), and useUrlState already owns the query string — a
// router library would duplicate that ownership and add a dependency for
// pattern matching we can do with two string splits.
//
// navigate() dispatches a synthetic popstate after writing history so
// useUrlState (which listens for popstate and re-parses
// window.location.search) stays in sync. Without that, the two hooks
// would disagree about the current URL: the router would change the path
// while useUrlState kept re-appending the *previous* page's filters.

export function navigate(to, { replace = false } = {}) {
  const current = `${window.location.pathname}${window.location.search}`
  if (to === current) return
  if (replace) window.history.replaceState(null, "", to)
  else window.history.pushState(null, "", to)
  window.dispatchEvent(new PopStateEvent("popstate"))
}

function parsePath(pathname) {
  const segments = pathname.split("/").filter(Boolean)

  // A bare domain shouldn't 404 — it lands on Home (still the "briefing"
  // page id internally; only the nav label changed).
  if (segments.length === 0) return { page: "briefing", accountId: null }

  const [first, second] = segments
  if (first === "accounts") return { page: "accounts", accountId: second ?? null }
  if (["feed", "radar", "briefing", "alerts", "settings", "search", "my-accounts", "competitors"].includes(first)) {
    return { page: first, accountId: null }
  }
  return { page: "not-found", accountId: null }
}

export function useRoute() {
  const [route, setRoute] = useState(() => parsePath(window.location.pathname))

  useEffect(() => {
    function sync() {
      setRoute(parsePath(window.location.pathname))
    }
    window.addEventListener("popstate", sync)
    return () => window.removeEventListener("popstate", sync)
  }, [])

  return route
}

// Anchor handler for in-app links: keeps real <a href> semantics
// (middle-click, cmd-click, "open in new tab", and a visible URL in the
// status bar) while intercepting the plain left-click into a client-side
// navigation.
export function linkProps(to) {
  return {
    href: to,
    onClick(event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
      event.preventDefault()
      navigate(to)
    },
  }
}
