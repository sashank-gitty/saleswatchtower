import { useEffect, useMemo, useState } from "react"
import { linkProps } from "../lib/router.js"
import { deriveAccounts } from "../lib/accountModel.js"
import {
  SIGNAL_GROUPS,
  countByGroup,
  filterByGroup,
  groupForSignal,
  toneClassesForGroup,
} from "../lib/signalGroups.js"
import { HIGH_RELEVANCE_THRESHOLD } from "../lib/relevance.js"
import {
  PageHeader,
  Card,
  Button,
  Pill,
  ScoreBadge,
  AccountAvatar,
  TabStrip,
  FilterSelect,
  SearchInput,
  Pagination,
  EmptyState,
  SectionTitle,
} from "../components/ui.jsx"
import { DownloadIcon, ChevronDownIcon } from "../components/icons.jsx"
import SkeletonRow from "../components/SkeletonRow.jsx"
import SignalRow from "../components/SignalRow.jsx"
import Checkbox from "../components/Checkbox.jsx"

const RANGE_OPTIONS = [
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
]

function withinRange(signal, days) {
  if (!days) return true
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - Number(days))
  return new Date(`${signal.date}T00:00:00`) >= cutoff
}

// The three quick filters the Briefing page's stat tiles deep-link into
// (?reviewed=unreviewed, ?relevance=high, ?matched=1), also exposed here
// as toggle chips so they're adjustable on this page too, not just a
// hidden side-effect of arriving from a link.
function matchesQuickFilters(signal, { unreviewedOnly, highRelevanceOnly, matchedOnly }) {
  if (unreviewedOnly && signal.reviewed) return false
  if (highRelevanceOnly && (signal.outreachRelevance ?? 0) < HIGH_RELEVANCE_THRESHOLD) return false
  if (matchedOnly && (signal.matchedCompanies ?? []).length === 0) return false
  return true
}

function QuickFilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3.5 py-1.5 text-dense font-semibold transition-colors ${
        active
          ? "border-transparent bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
          : "border-slate-200 text-body-600 hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
      }`}
    >
      {children}
    </button>
  )
}

// One account block: a header row carrying the account's identity and
// rollup, then its individual signals nested beneath as dense compact
// rows. The nesting is what makes this different from a flat feed — it
// answers "what is happening at each account" rather than "what happened
// most recently".
function AccountBlock({ account, signals, companies, onOpenSignal, onToggleReviewed, selectedIds, onToggleSelect }) {
  const [expanded, setExpanded] = useState(true)
  const visible = expanded ? signals : signals.slice(0, 3)

  return (
    <div className="border-b border-slate-200 last:border-b-0 dark:border-zinc-800">
      <div className="flex items-start gap-3 bg-section px-4 py-3 dark:bg-zinc-900/40">
        <AccountAvatar name={account.name} logoUrl={account.logoUrl} size="sm" />
        <div className="min-w-0 flex-1">
          {/* Identity on its own line, status pill on the line beneath it
              — kept apart rather than run together so the account name is
              the thing a scan lands on first. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <a
              {...linkProps(`/accounts/${encodeURIComponent(account.key)}`)}
              className="truncate text-dense font-bold text-ink-900 hover:text-brand-600 dark:text-zinc-50 dark:hover:text-brand-400"
            >
              {account.name}
            </a>
            {account.status && (
              <Pill tone={account.status === "customer" ? "emerald" : "brand"}>
                {account.status === "customer" ? "Customer" : "Prospect"}
              </Pill>
            )}
            {!account.managed && <Pill tone="slate">Not tracked</Pill>}
          </div>
          {/* The terse per-account reason to look, not the fuller
              category tally — that's one hover away via the title
              attribute, same "detail on demand" pattern SectionTitle's
              hint icon already uses elsewhere in this app. */}
          <p className="mt-0.5 truncate text-xs text-body-500 dark:text-zinc-400" title={account.rollup}>
            {account.whyNow}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <ScoreBadge score={account.score} size="sm" />
          <Pill tone="slate">
            {signals.length} {signals.length === 1 ? "Signal" : "Signals"}
          </Pill>
        </div>
      </div>

      <div className="flex flex-col gap-1 p-1.5">
        {visible.map((signal) => (
          <SignalRow
            key={signal.id}
            item={signal}
            companies={companies}
            reviewed={signal.reviewed}
            onToggleReviewed={onToggleReviewed}
            onOpen={onOpenSignal}
            selected={selectedIds.has(signal.id)}
            onToggleSelect={onToggleSelect}
            showCheckbox
            compact
          />
        ))}
      </div>

      {signals.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-center gap-1 px-4 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-ink-900 dark:text-zinc-400 dark:hover:bg-zinc-800/40 dark:hover:text-zinc-100"
        >
          <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          {expanded ? "Show fewer" : `Show all ${signals.length} signals`}
        </button>
      )}
    </div>
  )
}

function GlobalFeed({ signals, companies = [], logoByKey = new Map(), loading, onOpenSignal, onToggleReviewed, onMarkManyReviewed }) {
  const [search, setSearch] = useState("")
  // Type, Priority, and the quick-filter chips collapse behind this by
  // default — search and date range are the two controls worth seeing
  // on first load, everything else is one click away instead of six
  // controls competing for attention up front.
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [type, setType] = useState(null)
  const [priority, setPriority] = useState(null)
  // Seeded once from the URL so a deep link (e.g. from a Briefing stat
  // tile) lands pre-filtered; freely adjustable afterward like every
  // other filter on this page.
  const [range, setRange] = useState(() => new URLSearchParams(window.location.search).get("range") ?? "30")
  const [unreviewedOnly, setUnreviewedOnly] = useState(
    () => new URLSearchParams(window.location.search).get("reviewed") === "unreviewed",
  )
  const [highRelevanceOnly, setHighRelevanceOnly] = useState(
    () => new URLSearchParams(window.location.search).get("relevance") === "high",
  )
  const [matchedOnly, setMatchedOnly] = useState(
    () => new URLSearchParams(window.location.search).get("matched") === "1",
  )
  const [group, setGroup] = useState("all")
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  const quickFilters = { unreviewedOnly, highRelevanceOnly, matchedOnly }
  const anyQuickFilterActive = unreviewedOnly || highRelevanceOnly || matchedOnly

  const scoped = useMemo(() => signals.filter((s) => withinRange(s, range)), [signals, range])

  const accounts = useMemo(() => deriveAccounts(scoped, companies, logoByKey), [scoped, companies, logoByKey])

  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLowerCase()
    return accounts.filter((account) => {
      if (priority && account.priority.id !== priority) return false
      if (type === "customer" && account.status !== "customer") return false
      if (type === "prospect" && account.status !== "prospect") return false
      if (type === "untracked" && account.managed) return false
      if (query) {
        const haystack = `${account.name} ${account.signals.map((s) => s.headline).join(" ")}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      // A group filter narrows to accounts that have at least one signal
      // in that group — an account whose every signal is filtered out
      // shouldn't render as an empty block. Quick filters work the same way.
      if (group !== "all" && !account.signals.some((s) => groupForSignal(s) === group)) return false
      if (anyQuickFilterActive && !account.signals.some((s) => matchesQuickFilters(s, quickFilters))) return false
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, priority, type, search, group, unreviewedOnly, highRelevanceOnly, matchedOnly])

  // "What do I own" and "what's out there" are two different questions —
  // a tracked prospect ranking below an untracked company purely on score
  // (with nothing on the row itself marking the difference) was the most
  // confusing thing about this list. Tracked accounts always lead, each
  // group otherwise keeping the incoming score order.
  const sortedAccounts = useMemo(
    () => [...filteredAccounts].sort((a, b) => (b.managed ? 1 : 0) - (a.managed ? 1 : 0)),
    [filteredAccounts],
  )

  const groupCounts = useMemo(() => countByGroup(scoped), [scoped])

  const tabs = useMemo(
    () => [
      { id: "all", label: "All", count: groupCounts.all },
      ...SIGNAL_GROUPS.map((g) => ({
        id: g.id,
        label: g.label,
        count: groupCounts[g.id] ?? 0,
        Icon: g.Icon,
        tone: toneClassesForGroup(g.id).badge,
      })),
    ],
    [groupCounts],
  )

  const pageAccounts = sortedAccounts.slice(page * pageSize, (page + 1) * pageSize)

  const [selectedIds, setSelectedIds] = useState(() => new Set())

  const visibleSignalIds = useMemo(
    () =>
      pageAccounts.flatMap((account) =>
        filterByGroup(account.signals, group)
          .filter((s) => matchesQuickFilters(s, quickFilters))
          .map((s) => s.id),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageAccounts, group, unreviewedOnly, highRelevanceOnly, matchedOnly],
  )

  // Selection is scoped to what's currently visible on this page/filter —
  // stale picks from a previous filter or page shouldn't silently linger
  // in the bulk-action count.
  useEffect(() => {
    setSelectedIds((prev) => {
      const visibleSet = new Set(visibleSignalIds)
      const next = new Set([...prev].filter((id) => visibleSet.has(id)))
      return next.size === prev.size ? prev : next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleSignalIds.join(",")])

  const allVisibleSelected = visibleSignalIds.length > 0 && visibleSignalIds.every((id) => selectedIds.has(id))
  const someVisibleSelected = visibleSignalIds.some((id) => selectedIds.has(id))

  const toggleSelectAll = () => {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(visibleSignalIds))
  }

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkMarkReviewed = () => {
    onMarkManyReviewed([...selectedIds])
    setSelectedIds(new Set())
  }

  const handleExport = () => {
    const header = ["Account", "Status", "Score", "Priority", "Signals", "Last signal"]
    const rows = filteredAccounts.map((a) => [
      a.name,
      a.status ?? "not tracked",
      a.score,
      a.priority.label,
      a.signalCount,
      a.lastSignalDate ?? "",
    ])
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `accounts-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageHeader
        title="Global Feed"
        actions={
          <Button variant="outline" onClick={handleExport} disabled={!filteredAccounts.length}>
            <DownloadIcon className="h-4 w-4" />
            Export Accounts
          </Button>
        }
      >
        <Card className="p-3.5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search..." className="col-span-2 sm:col-span-1" />
            <FilterSelect label="Date range" value={range} onChange={(v) => setRange(v ?? "30")} options={RANGE_OPTIONS} />
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              className="flex items-center justify-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-dense font-semibold text-body-600 transition-colors hover:border-slate-300 hover:text-ink-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
            >
              Filters
              {(type || priority || anyQuickFilterActive) && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-100 px-1 text-3xs font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                  {[type, priority, unreviewedOnly, highRelevanceOnly, matchedOnly].filter(Boolean).length}
                </span>
              )}
              <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
            </button>
          </div>

          {filtersOpen && (
            <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 dark:border-zinc-800/70">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <FilterSelect
                  label="Type"
                  value={type}
                  onChange={setType}
                  options={[
                    { value: "customer", label: "Customer" },
                    { value: "prospect", label: "Prospect" },
                    { value: "untracked", label: "Not tracked" },
                  ]}
                />
                <FilterSelect
                  label="Priority"
                  value={priority}
                  onChange={setPriority}
                  options={[
                    { value: "p1", label: "P1" },
                    { value: "p2", label: "P2" },
                    { value: "p3", label: "P3" },
                    { value: "none", label: "No Priority" },
                  ]}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <QuickFilterChip active={unreviewedOnly} onClick={() => setUnreviewedOnly((v) => !v)}>
                  Unreviewed only
                </QuickFilterChip>
                <QuickFilterChip active={highRelevanceOnly} onClick={() => setHighRelevanceOnly((v) => !v)}>
                  High relevance only
                </QuickFilterChip>
                <QuickFilterChip active={matchedOnly} onClick={() => setMatchedOnly((v) => !v)}>
                  Account-matched only
                </QuickFilterChip>
                {anyQuickFilterActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setUnreviewedOnly(false)
                      setHighRelevanceOnly(false)
                      setMatchedOnly(false)
                    }}
                    className="text-xs font-medium text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200"
                  >
                    Clear quick filters
                  </button>
                )}
              </div>
            </div>
          )}
        </Card>
      </PageHeader>

      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <SectionTitle hint="Signals grouped by the account they name. No match on your tracked list shows as Not tracked.">
          Recent Account Signals
        </SectionTitle>
        {visibleSignalIds.length > 0 && (
          <div className="flex items-center gap-2">
            <div
              onClick={toggleSelectAll}
              className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <Checkbox
                checked={allVisibleSelected}
                indeterminate={!allVisibleSelected && someVisibleSelected}
                onChange={toggleSelectAll}
                label="Select all visible signals"
              />
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
            </div>
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={handleBulkMarkReviewed}
                className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
              >
                Mark {selectedIds.size} Reviewed
              </button>
            )}
          </div>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 pt-2">
          <TabStrip
            tabs={tabs}
            active={group}
            onChange={(id) => {
              setGroup(id)
              setPage(0)
            }}
          />
        </div>

        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : pageAccounts.length === 0 ? (
          <EmptyState
            title="No accounts match these filters"
            description="Try widening the date range or clearing a filter — macro-scope market signals name no company, so they never produce an account row."
          />
        ) : (
          <div>
            {pageAccounts.map((account, i) => {
              // Tracked accounts always sort first (see sortedAccounts
              // above); mark the one spot on this page where the list
              // switches from "yours" to "everything else" so the two
              // never look like one blended ranking.
              const isFirstUntracked = !account.managed && (i === 0 || pageAccounts[i - 1].managed)
              const isFirstTracked = i === 0 && account.managed
              return (
                <div key={account.key}>
                  {isFirstTracked && (
                    <p className="bg-slate-50 px-4 py-2 text-3xs font-semibold uppercase tracking-wider text-slate-400 dark:bg-zinc-900/60 dark:text-zinc-500">
                      Your Accounts
                    </p>
                  )}
                  {isFirstUntracked && (
                    <p className="bg-slate-50 px-4 py-2 text-3xs font-semibold uppercase tracking-wider text-slate-400 dark:bg-zinc-900/60 dark:text-zinc-500">
                      Market Discovery — not on your tracked list
                    </p>
                  )}
                  <AccountBlock
                    account={account}
                    signals={filterByGroup(account.signals, group).filter((s) => matchesQuickFilters(s, quickFilters))}
                    companies={companies}
                    onOpenSignal={onOpenSignal}
                    onToggleReviewed={onToggleReviewed}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelectOne}
                  />
                </div>
              )
            })}
          </div>
        )}

        {filteredAccounts.length > 0 && (
          <div className="border-t border-slate-200 dark:border-zinc-800">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={filteredAccounts.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(0)
              }}
            />
          </div>
        )}
      </Card>
    </>
  )
}

export default GlobalFeed
