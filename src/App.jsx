import { useEffect, useMemo, useState } from "react"
import TopNav from "./components/TopNav.jsx"
import SignalDetailPanel from "./components/SignalDetailPanel.jsx"
import CommandPalette from "./components/CommandPalette.jsx"
import ErrorState from "./components/ErrorState.jsx"
import Briefing from "./pages/Briefing.jsx"
import GlobalFeed from "./pages/GlobalFeed.jsx"
import Accounts from "./pages/Accounts.jsx"
import AccountDetail from "./pages/AccountDetail.jsx"
import SearchPage from "./pages/Search.jsx"
import Alerts from "./pages/Alerts.jsx"
import Radar from "./pages/Radar.jsx"
import Competitors from "./pages/Competitors.jsx"
import Settings from "./pages/Settings.jsx"
import { useTheme } from "./lib/useTheme.js"
import { useRoute, navigate } from "./lib/router.js"
import { useUrlState } from "./lib/useUrlState.js"
import { deriveAccounts, findAccount, accountKey } from "./lib/accountModel.js"
import { useAlerts, matchAlert } from "./lib/useAlerts.js"
import { useCompanies } from "./lib/useCompanies.js"
import { useSentiment } from "./lib/useSentiment.js"
import { useMarketData } from "./lib/useMarketData.js"
import { Button } from "./components/ui.jsx"

function App() {
  const { theme, toggleTheme } = useTheme()
  const route = useRoute()
  const [urlState, updateUrl] = useUrlState()

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [signals, setSignals] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [syncStatus, setSyncStatus] = useState(null)

  // The open signal stays in the query string rather than the path: the
  // drawer is an overlay on whatever page is underneath, and any page can
  // open it. Keeping it in `?signal=` means a link to a signal also
  // carries the page it was opened from.
  const openSignalId = urlState.signal ?? null

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setFetchError(null)

    fetch("/api/signals", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Server responded ${res.status}`)
        return res.json()
      })
      .then((data) => {
        setSignals(data)
        setLoading(false)
      })
      .catch(async (err) => {
        if (err.name === "AbortError") return

        // `npm run dev` runs Vite alone, so /api/* isn't served at all —
        // every route 404s and the whole app would be an error screen
        // locally. Fall back to the committed seed fixture so the UI is
        // workable without `vercel dev` and a database.
        //
        // Strictly DEV-only: in a real deployment a failing /api/signals
        // means something is actually broken, and quietly rendering stale
        // bundled data instead of surfacing that would be worse than the
        // error screen.
        if (import.meta.env.DEV) {
          try {
            const { default: fixture } = await import("./data/data.json")
            setSignals(fixture)
            setLoading(false)
            console.warn("[dev] /api/signals unavailable — using src/data/data.json fixture")
            return
          } catch {
            // fall through to the error state
          }
        }

        setFetchError(err.message || "Failed to load signals")
        setLoading(false)
      })

    return () => controller.abort()
  }, [reloadToken])

  useEffect(() => {
    const controller = new AbortController()
    // Best-effort and silent: a broken sync indicator shouldn't ever block
    // or error out the actual feed, so failures here just leave it hidden.
    fetch("/api/ingest-status", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSyncStatus(data))
      .catch(() => {})

    return () => controller.abort()
  }, [reloadToken])

  useEffect(() => {
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [])

  // Scroll to top on page change. Without this, moving from a scrolled
  // feed into an account detail lands you halfway down the new page.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route.page, route.accountId])

  const { companies, isTracked, trackedAt, setCompany } = useCompanies()
  const { sentimentFor } = useSentiment()
  const { marketDataFor } = useMarketData()
  const accounts = useMemo(() => deriveAccounts(signals, companies), [signals, companies])

  const openItem = useMemo(() => signals.find((s) => s.id === openSignalId) ?? null, [signals, openSignalId])
  // Same-entity signals are the strongest "related" match — same company,
  // unambiguous. When there aren't enough of those to be useful, widen to
  // signals sharing a signal type, so a thin-history entity still surfaces
  // something rather than an empty panel. Each tier is still
  // recency-sorted and the total stays capped at 5.
  const relatedItems = useMemo(() => {
    if (!openItem) return []
    const others = signals.filter((s) => s.id !== openItem.id)
    const byDateDesc = (a, b) => (a.date < b.date ? 1 : -1)

    const sameEntity = others.filter((s) => s.entity === openItem.entity).sort(byDateDesc)
    if (sameEntity.length >= 3) return sameEntity.slice(0, 5)

    const seen = new Set(sameEntity.map((s) => s.id))
    const widened = others
      .filter((s) => !seen.has(s.id) && s.signalType === openItem.signalType)
      .sort(byDateDesc)

    return [...sameEntity, ...widened].slice(0, 5)
  }, [signals, openItem])

  // Real hiring-signal rows (scripts/local/sync-hiring-signals.mjs) for
  // the account the open signal belongs to — same "which account does
  // this name" derivation SignalDetailPanel itself uses
  // (matchedCompanies[0] ?? entity), computed once here rather than
  // duplicated inside that component.
  const hiringSignalsForOpenAccount = useMemo(() => {
    if (!openItem) return []
    const account = (openItem.matchedCompanies ?? [])[0] ?? openItem.entity
    return signals
      .filter((s) => s.origin === "hiring_signal")
      .filter((s) => (s.matchedCompanies ?? []).includes(account) || s.entity === account)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [signals, openItem])

  const openSignal = (id) => updateUrl({ signal: id }, { push: true })
  const closeSignal = () => updateUrl({ signal: undefined })

  // Unread count on the bell: how many signals the active alerts would
  // have caught that haven't been reviewed yet. A number that means
  // something, rather than a decorative badge.
  const { alerts } = useAlerts()
  const unreadCount = useMemo(() => {
    if (!alerts.length || !signals.length) return 0
    const ids = new Set()
    for (const alert of alerts) {
      if (!alert.active) continue
      for (const signal of matchAlert(alert, signals)) {
        if (!signal.reviewed) ids.add(signal.id)
      }
    }
    return ids.size
  }, [alerts, signals])

  const postReview = async (ids, reviewed) => {
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, reviewed }),
    })
    if (!res.ok) throw new Error(`Server responded ${res.status}`)
  }

  // Optimistic, with a per-item rollback to whatever it actually was
  // before if the write fails.
  const handleToggleReviewed = (id) => {
    const current = signals.find((s) => s.id === id)
    if (!current) return
    const next = !current.reviewed

    setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, reviewed: next } : s)))

    postReview([id], next).catch((err) => {
      console.error("Failed to update review state:", err)
      setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, reviewed: !next } : s)))
    })
  }

  if (fetchError) {
    return <ErrorState message={fetchError} onRetry={() => setReloadToken((t) => t + 1)} />
  }

  const activeAccount = route.accountId
    ? findAccount(accounts, decodeURIComponent(route.accountId))
    : null

  return (
    <div className="min-h-screen bg-page dark:bg-zinc-950">
      <TopNav
        page={route.page}
        onOpenPalette={() => setPaletteOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        syncStatus={syncStatus}
        unreadCount={unreadCount}
      />

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        {route.page === "briefing" && (
          <Briefing
            signals={signals}
            loading={loading}
            onOpenSignal={openSignal}
            onToggleReviewed={handleToggleReviewed}
          />
        )}

        {route.page === "radar" && (
          <Radar signals={signals} companies={companies} syncStatus={syncStatus} onOpenSignal={openSignal} loading={loading} />
        )}

        {route.page === "feed" && (
          <GlobalFeed
            signals={signals}
            companies={companies}
            loading={loading}
            onOpenSignal={openSignal}
            onToggleReviewed={handleToggleReviewed}
          />
        )}

        {route.page === "competitors" && (
          <Competitors
            signals={signals}
            companies={companies}
            loading={loading}
            onOpenSignal={openSignal}
            onToggleReviewed={handleToggleReviewed}
          />
        )}

        {route.page === "accounts" && !route.accountId && (
          <Accounts
            signals={signals}
            companies={companies}
            loading={loading}
            isClaimed={isTracked}
            onToggleClaim={setCompany}
          />
        )}

        {route.page === "accounts" && route.accountId && (
          <AccountDetail
            account={activeAccount}
            onOpenSignal={openSignal}
            loading={loading}
            isClaimed={isTracked}
            claimedAt={trackedAt}
            onToggleClaim={setCompany}
            sentiment={sentimentFor(activeAccount?.key)}
          />
        )}

        {/* My Accounts used to be its own page — a second nav item right
            next to "Accounts" that looked like it might mean something
            different, and didn't. It's the "Tracked" filter on Accounts
            now. This route stays only so an old bookmark or link to
            /my-accounts still lands somewhere useful instead of 404ing. */}
        {route.page === "my-accounts" && (
          <Accounts
            signals={signals}
            companies={companies}
            loading={loading}
            isClaimed={isTracked}
            onToggleClaim={setCompany}
            initialType="mine"
          />
        )}

        {route.page === "search" && <SearchPage signals={signals} companies={companies} onOpenSignal={openSignal} />}

        {route.page === "alerts" && <Alerts signals={signals} onOpenSignal={openSignal} />}

        {route.page === "settings" && (
          <Settings theme={theme} onToggleTheme={toggleTheme} signals={signals} />
        )}

        {route.page === "not-found" && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-sm font-semibold text-ink-900 dark:text-zinc-100">Page not found</p>
            <p className="mt-1 text-dense text-body-500 dark:text-zinc-400">
              {window.location.pathname} doesn&rsquo;t match any route.
            </p>
            <Button variant="primary" className="mt-4" onClick={() => navigate("/feed")}>
              Go to Global Feed
            </Button>
          </div>
        )}
      </main>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={signals}
        accounts={accounts}
        onSelectItem={(item) => openSignal(item.id)}
        onClearFilters={() => navigate("/feed")}
        onToggleTheme={toggleTheme}
      />

      <SignalDetailPanel
        item={openItem}
        open={Boolean(openItem)}
        onClose={closeSignal}
        onToggleReviewed={handleToggleReviewed}
        relatedItems={relatedItems}
        onSelectRelated={(id) => openSignal(id)}
        companies={companies}
        hiringSignals={hiringSignalsForOpenAccount}
        marketData={
          openItem
            ? marketDataFor(accountKey((openItem.matchedCompanies ?? [])[0] ?? openItem.entity))
            : null
        }
      />
    </div>
  )
}

export default App
