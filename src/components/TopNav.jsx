import { useEffect, useRef, useState } from "react"
import { linkProps } from "../lib/router.js"
import { ORG_NAME } from "../config.js"
import { useMyCompany } from "../lib/useMyCompany.js"
import { useCompanySuggestions } from "../lib/useCompanySuggestions.js"
import ThemeToggle from "./ThemeToggle.jsx"
import SyncStatus from "./SyncStatus.jsx"
import {
  RadarIcon,
  TargetIcon,
  SunriseIcon,
  FeedIcon,
  BriefcaseIcon,
  AlertIcon,
  SlidersIcon,
  SearchIcon,
  HelpIcon,
  BellIcon,
  MenuIcon,
  XIcon,
  ChevronDownIcon,
} from "./icons.jsx"

const NAV_ITEMS = [
  // Still the "briefing" page internally (App.jsx, router.js) — only the
  // nav label changed. Radar's job (pointing at what matters) moved
  // inside this page as its own section instead of a separate
  // destination; /radar still resolves, just isn't linked from the nav
  // anymore, same pattern as the older "My Accounts" removal below.
  { page: "briefing", href: "/briefing", label: "Home", Icon: SunriseIcon },
  { page: "feed", href: "/feed", label: "Market Pulse", Icon: FeedIcon },
  { page: "competitors", href: "/competitors", label: "Competitors", Icon: TargetIcon },
  // "My Accounts" used to be its own item here, right next to this one —
  // two nearly-identical nav labels that looked like they might mean
  // different things and didn't. It's the "Tracked" filter on this page
  // now (src/pages/Accounts.jsx); /my-accounts still resolves (App.jsx),
  // just isn't linked from the nav anymore.
  { page: "accounts", href: "/accounts", label: "Accounts", Icon: BriefcaseIcon },
  { page: "alerts", href: "/alerts", label: "Saved Searches", Icon: AlertIcon },
  { page: "settings", href: "/settings", label: "Settings", Icon: SlidersIcon },
]

// The wordmark: an original radar-sweep mark (see icons.jsx) inside a
// solid navy tile, next to "Watchtower" — the same name the site's own
// <title> and repo already use, so the in-app name finally matches
// everywhere else it appears instead of a generic placeholder. No
// element here is borrowed from another product — the mark is a glyph
// this app doesn't share with anything else, not a stylised wordplay on
// a name.
function Wordmark() {
  return (
    <a
      {...linkProps("/feed")}
      className="flex flex-shrink-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
    >
      <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-navy-900 text-white dark:bg-brand-600">
        <RadarIcon className="h-[18px] w-[18px]" />
      </span>
      <span className="hidden text-[15px] font-bold leading-none tracking-tight text-ink-900 sm:inline dark:text-zinc-50">
        Watchtower
      </span>
    </a>
  )
}

function NavLink({ item, active }) {
  const { Icon, label, href } = item
  return (
    <a
      {...linkProps(href)}
      aria-current={active ? "page" : undefined}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-dense font-semibold transition-colors ${
        active
          ? "bg-navy-900/8 text-navy-900 dark:bg-white/10 dark:text-white"
          : "text-body-600 hover:bg-slate-100 hover:text-ink-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </a>
  )
}

// Initials for the org badge: two letters, either the first letter of the
// first two words of a multi-word name ("Culture Amp" -> "CA") or the
// first two letters of a single-word one ("Acme" -> "AC").
function orgInitials(name) {
  const words = String(name ?? "").trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return (words[0] ?? "").slice(0, 2).toUpperCase()
}

function TopNav({
  page,
  onOpenPalette,
  theme,
  onToggleTheme,
  syncStatus,
  unreadCount = 0,
  orgName = ORG_NAME,
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const mobileRef = useRef(null)
  // Once "My Company" is set up (Settings), the badge shows your
  // company instead of your own name — the dashboard's identity
  // follows whichever org it's actually adapted to.
  const { profile: myCompany, research } = useMyCompany()
  const displayName = myCompany?.companyName || orgName

  // The badge doubles as a small control panel now — dark mode and a
  // company quick-switch, so neither requires a trip to Settings.
  const [panelOpen, setPanelOpen] = useState(false)
  const [switchName, setSwitchName] = useState("")
  const [switchError, setSwitchError] = useState(null)
  const panelRef = useRef(null)
  const suggestions = useCompanySuggestions(switchName, panelOpen)

  // Deliberately no "Research" button here — picking a suggestion or
  // pressing Enter fires immediately (per direct instruction: "no need
  // to press research or anything"). The app-wide ResearchOverlay
  // (rendered once in App.jsx, reading the same shared `researching`
  // flag this call sets) is what tells you it's working. A failure
  // still needs to surface *somewhere* even though the panel that
  // started it already closed — same silent-failure class of bug
  // MyCompanySection.jsx had, fixed there, and caught here live before
  // it shipped unnoticed a second time.
  const runSwitch = (name) => {
    if (!name.trim()) return
    setPanelOpen(false)
    setSwitchName("")
    setSwitchError(null)
    research(name.trim())
      .then((data) => {
        if (data.budgetExceeded) setSwitchError("This month's Claude API budget has been reached.")
        else if (!data.found) setSwitchError(`Couldn't find a real company matching "${name}".`)
      })
      .catch(() => setSwitchError(`Couldn't switch to "${name}" — the server had a problem. Try again.`))
  }

  // Close the mobile sheet on route change, so tapping a destination
  // doesn't leave the overlay covering the page you just navigated to.
  useEffect(() => {
    setMobileOpen(false)
    setPanelOpen(false)
  }, [page])

  useEffect(() => {
    if (!mobileOpen) return
    function onKey(e) {
      if (e.key === "Escape") setMobileOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [mobileOpen])

  useEffect(() => {
    if (!panelOpen) return
    function onKey(e) {
      if (e.key === "Escape") setPanelOpen(false)
    }
    function onClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setPanelOpen(false)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("mousedown", onClickOutside)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("mousedown", onClickOutside)
    }
  }, [panelOpen])

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/85">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-ink-900 md:hidden dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          {mobileOpen ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
        </button>

        <Wordmark />

        <nav aria-label="Primary" className="ml-3 hidden items-center gap-0.5 md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.page} item={item} active={page === item.page} />
          ))}
        </nav>

        <div className="ml-auto flex flex-shrink-0 items-center gap-1.5">
          {/* Icon-only, matching Help/Bell beside it — the pill-with-
              placeholder-text-and-kbd-badge shape was the single most
              generic-SaaS-template element in the whole header. The real
              search surface is Home's own search bar and the ⌘K palette
              (still opens from here, just without announcing itself as
              loudly). */}
          <button
            type="button"
            onClick={onOpenPalette}
            aria-label="Search (⌘K)"
            title="Search (⌘K)"
            className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <SearchIcon className="h-[18px] w-[18px]" />
          </button>

          <SyncStatus status={syncStatus} />

          <a
            {...linkProps("/settings")}
            aria-label="Help and settings"
            className="hidden h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 sm:inline-flex dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <HelpIcon className="h-[18px] w-[18px]" />
          </a>

          <a
            {...linkProps("/alerts")}
            aria-label={`Unreviewed matches from your saved searches${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
            className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <BellIcon className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-3xs font-bold text-white ring-2 ring-white dark:ring-zinc-950">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </a>

          <ThemeToggle theme={theme} onToggle={onToggleTheme} />

          {/* Shows your company name once Settings' "My Company" is set
              up; falls back to ORG_NAME (src/config.js) until then. Now
              a control-panel trigger, not just a static label — dark
              mode + company switch live in the dropdown below without a
              trip to Settings. */}
          <div ref={panelRef} className="relative ml-1">
            <button
              type="button"
              onClick={() => setPanelOpen((v) => !v)}
              aria-label="Dashboard controls"
              aria-expanded={panelOpen}
              className="flex items-center gap-2 rounded-full py-1 pl-2 pr-1 transition-colors hover:bg-slate-100 dark:hover:bg-zinc-800/60"
            >
              <p className="hidden whitespace-nowrap text-dense font-bold text-ink-900 2xl:block dark:text-zinc-50">
                {displayName}
              </p>
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-navy-900 text-dense font-bold text-white">
                {orgInitials(displayName)}
              </div>
              <ChevronDownIcon className={`hidden h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-transform sm:block dark:text-zinc-500 ${panelOpen ? "rotate-180" : ""}`} />
            </button>

            {panelOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between px-1 py-1.5">
                  <span className="text-dense font-medium text-body-600 dark:text-zinc-300">Dark mode</span>
                  <ThemeToggle theme={theme} onToggle={onToggleTheme} />
                </div>

                <div className="my-2 border-t border-slate-100 dark:border-zinc-800" />

                <div className="px-1">
                  <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                    Switch company
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={switchName}
                      onChange={(e) => setSwitchName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") runSwitch(switchName)
                      }}
                      placeholder={displayName}
                      autoComplete="off"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-dense text-ink-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                    />
                    {suggestions.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                        {suggestions.map((s) => (
                          <button
                            key={s.domain || s.name}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => runSwitch(s.name)}
                            className="flex w-full items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800"
                          >
                            <span className="text-dense font-medium text-ink-900 dark:text-zinc-100">{s.name}</span>
                            {s.domain && <span className="text-3xs text-body-500 dark:text-zinc-400">{s.domain}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="my-2 border-t border-slate-100 dark:border-zinc-800" />

                <a
                  {...linkProps("/settings")}
                  onClick={() => setPanelOpen(false)}
                  className="block rounded-lg px-1 py-1.5 text-dense font-medium text-body-600 transition-colors hover:bg-slate-100 hover:text-ink-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  Settings
                </a>
              </div>
            )}

            {switchError && (
              <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-rose-200 bg-rose-50 p-3 text-dense text-rose-700 shadow-xl dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                <div className="flex items-start justify-between gap-2">
                  <p>{switchError}</p>
                  <button
                    type="button"
                    onClick={() => setSwitchError(null)}
                    aria-label="Dismiss"
                    className="flex-shrink-0 text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-200"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div ref={mobileRef} className="border-t border-slate-200 bg-white px-3 py-2 md:hidden dark:border-zinc-800 dark:bg-zinc-950">
          <nav aria-label="Primary mobile" className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => {
              const { Icon, label, href, page: itemPage } = item
              const active = page === itemPage
              return (
                <a
                  key={itemPage}
                  {...linkProps(href)}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center gap-2.5 rounded-full px-3 py-2.5 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-navy-900/8 text-navy-900 dark:bg-white/10 dark:text-white"
                      : "text-body-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                  {label}
                </a>
              )
            })}
          </nav>
        </div>
      )}
    </header>
  )
}

export default TopNav
