import ThemeToggle from "./ThemeToggle.jsx"
import SyncStatus from "./SyncStatus.jsx"

function SearchIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function XIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

function SidebarIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </svg>
  )
}

function FilterIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  )
}

function Header({
  search,
  onSearchChange,
  searchInputRef,
  onOpenPalette,
  theme,
  onToggleTheme,
  sidebarOpen,
  onToggleSidebar,
  activeFilterCount = 0,
  onOpenMobileFilters,
  syncStatus,
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-pressed={sidebarOpen}
          aria-label={sidebarOpen ? "Hide filters" : "Show filters"}
          title={sidebarOpen ? "Hide filters" : "Show filters"}
          className={`hidden h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border transition-colors lg:inline-flex ${
            sidebarOpen
              ? "border-brand-500/30 bg-brand-500/10 text-brand-600 dark:text-brand-400"
              : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-ink-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
          }`}
        >
          <SidebarIcon className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white">
            SC
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-ink-900 dark:text-zinc-50">Personal Dashboard</p>
          </div>
        </div>

        {/* Ordered last and forced full-width below `lg` so it drops to its
            own row instead of fighting the logo/filter/theme buttons for
            space on row one — at 375px that left only ~90px for typing,
            barely enough to see what you'd typed. The break is `lg`, matching
            the sidebar toggle and mobile Filters button below: those already
            swap at `lg`, so this is the one width where the header's total
            content changes, rather than a second cutover with its own
            squeeze (which is what happened when this used to flip at `sm`,
            then at `md` — both still had the mobile Filters button AND the
            desktop-only Jump-to/sync pills competing for space at once). */}
        <div className="order-last flex w-full items-center gap-2 lg:order-none lg:ml-6 lg:w-auto lg:flex-1">
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && search) {
                  e.preventDefault()
                  onSearchChange("")
                  e.currentTarget.blur()
                }
              }}
              placeholder="Search headlines, summaries, entities..."
              className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-16 text-sm text-ink-900 outline-none transition-all placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-500 dark:focus:bg-zinc-950"
            />
            {search ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-400 sm:inline dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                /
              </kbd>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenPalette}
            className="hidden shrink-0 items-center gap-2 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-all hover:border-slate-300 hover:text-ink-900 lg:inline-flex dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
          >
            Jump to
            <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
              &#8984;K
            </kbd>
          </button>
        </div>

        <SyncStatus status={syncStatus} />

        <button
          type="button"
          onClick={onOpenMobileFilters}
          aria-label={`Open filters${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ""}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-ink-900 lg:hidden dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
        >
          <FilterIcon className="h-3.5 w-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500/10 px-1 text-[10px] font-semibold text-brand-600 dark:text-brand-400">
              {activeFilterCount}
            </span>
          )}
        </button>

        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </header>
  )
}

export default Header
