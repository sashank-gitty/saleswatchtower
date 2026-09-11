import { useEffect, useRef, useState } from "react"
import { linkProps } from "../lib/router.js"
import { ORG_NAME } from "../config.js"
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
} from "./icons.jsx"

const NAV_ITEMS = [
  // Still the "briefing" page internally (App.jsx, router.js) — only the
  // nav label changed. Radar's job (pointing at what matters) moved
  // inside this page as its own section instead of a separate
  // destination; /radar still resolves, just isn't linked from the nav
  // anymore, same pattern as the older "My Accounts" removal below.
  { page: "briefing", href: "/briefing", label: "Home", Icon: SunriseIcon },
  { page: "feed", href: "/feed", label: "Global Feed", Icon: FeedIcon },
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
// solid navy tile, next to "Personal Dashboard" split navy/brand the way
// the rest of the app uses a two-tone treatment for a compound name. No
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
        Personal <span className="text-brand-600 dark:text-brand-400">Dashboard</span>
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

  // Close the mobile sheet on route change, so tapping a destination
  // doesn't leave the overlay covering the page you just navigated to.
  useEffect(() => {
    setMobileOpen(false)
  }, [page])

  useEffect(() => {
    if (!mobileOpen) return
    function onKey(e) {
      if (e.key === "Escape") setMobileOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [mobileOpen])

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
          {/* Search is a button, not an input: the real search surface is
              the /search page and the ⌘K palette, and a second always-live
              input in the chrome would compete with both. */}
          <button
            type="button"
            onClick={onOpenPalette}
            className="inline-flex items-center gap-2 rounded-full border border-transparent px-3 py-1.5 text-dense font-semibold text-body-500 transition-colors hover:bg-slate-100 hover:text-ink-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
          >
            <SearchIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-3xs font-semibold text-slate-500 lg:inline dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
              &#8984;K
            </kbd>
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

          {/* Just the company name — this app has no login system and
              is single-user, so there's no "SDR Team" persona to name.
              Change ORG_NAME in src/config.js when you move employers
              and this updates everywhere it's shown. */}
          <div className="ml-1 flex items-center gap-2">
            <p className="hidden whitespace-nowrap text-dense font-bold text-ink-900 2xl:block dark:text-zinc-50">
              {orgName}
            </p>
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-navy-900 text-dense font-bold text-white">
              {orgInitials(orgName)}
            </div>
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
