import { useEffect, useMemo, useState } from "react"
import { linkProps, navigate } from "../lib/router.js"
import { computeBriefing } from "../lib/briefing.js"
import {
  PageHeader,
  Card,
  Button,
  Pill,
  SectionTitle,
  EmptyState,
  Eyebrow,
  GradientText,
  StatTile,
  AccountAvatar,
  ScoreBadge,
} from "../components/ui.jsx"
import { ChevronRightIcon } from "../components/icons.jsx"
import AccountBlock from "../components/AccountBlock.jsx"
import Checkbox from "../components/Checkbox.jsx"

// Same staleness bar SyncStatus.jsx uses in the top nav, kept local here
// (that component doesn't export it) rather than pulled into a shared
// constant for one number both files already agree on by convention.
const STALE_AFTER_HOURS = 36

function relativeTime(iso) {
  if (!iso) return null
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMins = Math.round(diffMs / 60000)
  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.round(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.round(diffHours / 24)}d ago`
}

function useIngestStatus() {
  const [state, setState] = useState({ phase: "loading" })

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/ingest-status", { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => null)
        if (!res.ok) {
          setState({ phase: "error", message: body?.error ?? `Server responded ${res.status}` })
          return
        }
        if (!body) {
          setState({ phase: "empty" })
          return
        }
        setState({ phase: "loaded", data: body })
      })
      .catch((err) => {
        if (err.name === "AbortError") return
        setState({ phase: "error", message: err.message || "Request failed" })
      })
    return () => controller.abort()
  }, [])

  return state
}

function SyncBanner({ status }) {
  if (status.phase === "loading") return null

  if (status.phase === "error") {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-rose-500" aria-hidden="true" />
          <p className="text-dense font-semibold text-rose-700 dark:text-rose-400">Sync status unavailable</p>
        </div>
        <p className="mt-1 text-xs text-rose-700/80 dark:text-rose-400/80">
          <span className="font-mono">GET /api/ingest-status</span> returned an error just now: &ldquo;{status.message}
          &rdquo;. The signal feed below loaded fine &mdash; only the last-run health check is affected.
        </p>
      </div>
    )
  }

  if (status.phase === "empty") {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        <p className="text-dense font-medium text-body-600 dark:text-zinc-300">No ingest runs recorded yet.</p>
      </div>
    )
  }

  const { data } = status
  const runFailed = data.status === "error"
  const hoursSinceRun = (Date.now() - new Date(data.runAt).getTime()) / 3_600_000
  const isStale = hoursSinceRun >= STALE_AFTER_HOURS
  const budgetExceeded = data.summary?.budgetExceeded

  const isHealthy = !runFailed && !isStale && !budgetExceeded
  const tone = isHealthy
    ? { border: "border-emerald-500/30", bg: "bg-emerald-500/5", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" }
    : { border: "border-amber-500/30", bg: "bg-amber-500/5", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" }

  return (
    <div className={`rounded-xl border px-4 py-3 ${tone.border} ${tone.bg}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
        <p className={`text-dense font-semibold ${tone.text}`}>
          {runFailed ? "Last ingest run failed" : `Last sync ${relativeTime(data.runAt)}`}
        </p>
        {isStale && !runFailed && <Pill tone="amber">No run in {Math.round(hoursSinceRun)}h &mdash; check the cron</Pill>}
        {budgetExceeded && <Pill tone="amber">Monthly Claude budget reached</Pill>}
      </div>
      {runFailed && data.errorMessage && (
        <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-400/80">{data.errorMessage}</p>
      )}
    </div>
  )
}

function TypeBreakdown({ typeCounts }) {
  const max = Math.max(...typeCounts.map((t) => t.count), 1)

  if (typeCounts.length === 0) {
    return (
      <EmptyState
        title="No signals yet"
        description="This breaks down the feed by signal type once there's something to show."
      />
    )
  }

  return (
    <Card className="p-5">
      <p className="mb-4 text-xs text-body-500 dark:text-zinc-400">
        Signal types across all {typeCounts.reduce((sum, t) => sum + t.count, 0)} signals.
      </p>
      <div className="space-y-3">
        {typeCounts.map(({ signalType, count, swatch }) => (
          <div key={signalType} className="flex items-center gap-3">
            <span className="w-32 flex-shrink-0 truncate text-dense font-medium capitalize text-body-600 dark:text-zinc-300">
              {signalType}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
              <div
                className={`h-full rounded-full ${swatch}`}
                style={{ width: `${Math.max((count / max) * 100, 4)}%` }}
              />
            </div>
            <span className="w-6 flex-shrink-0 text-right text-dense font-semibold tabular-nums text-body-500 dark:text-zinc-400">
              {count}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function Briefing({ signals, companies = [], accounts = [], loading, onOpenSignal, onToggleReviewed, onMarkManyReviewed }) {
  const ingestStatus = useIngestStatus()
  const briefing = computeBriefing(signals)

  // The one thing to look at first. accounts is already sorted highest
  // score first (accountModel.js), so the first match in each fallback
  // tier is the right one: a tracked account with something genuinely
  // worth acting on, then any tracked account, then whatever's on top
  // overall if nothing is tracked yet.
  const topPriority = useMemo(
    () =>
      accounts.find((a) => a.managed && a.highRelevanceCount > 0) ??
      accounts.find((a) => a.managed) ??
      accounts[0] ??
      null,
    [accounts],
  )
  // Grouped by account instead of a flat list — same "what changed at
  // each account" shape as Global Feed's AccountBlock, so "New Since
  // Yesterday" doesn't turn into an endless scroll of individual
  // headlines the moment a handful of accounts each get a few signals.
  // Tracked accounts first, same "what's mine" vs "what's out there"
  // split as Global Feed.
  const newAccountGroups = useMemo(() => {
    const newIds = new Set(briefing.newSinceYesterday.map((s) => s.id))
    return accounts
      .map((account) => ({ account, signals: account.signals.filter((s) => newIds.has(s.id)) }))
      .filter((g) => g.signals.length > 0)
      .sort((a, b) => (b.account.managed ? 1 : 0) - (a.account.managed ? 1 : 0))
  }, [accounts, briefing.newSinceYesterday])

  // Flat list of every signal actually visible above, purely so
  // select-all / bulk-mark-reviewed still operate over the real set —
  // the grouping above is a display concern, not a data one.
  const visibleSignals = useMemo(() => newAccountGroups.flatMap((g) => g.signals), [newAccountGroups])

  const [selectedIds, setSelectedIds] = useState(() => new Set())

  useEffect(() => {
    setSelectedIds((prev) => {
      const visibleIds = new Set(visibleSignals.map((s) => s.id))
      const next = new Set([...prev].filter((id) => visibleIds.has(id)))
      return next.size === prev.size ? prev : next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleSignals.map((s) => s.id).join(",")])

  const allVisibleSelected = visibleSignals.length > 0 && visibleSignals.every((s) => selectedIds.has(s.id))
  const someVisibleSelected = visibleSignals.some((s) => selectedIds.has(s.id))

  const toggleSelectAll = () => {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(visibleSignals.map((s) => s.id)))
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

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow>Start of day</Eyebrow>}
        title={
          <>
            Morning <GradientText>Briefing</GradientText>
          </>
        }
        actions={
          <Button variant="outline" onClick={() => navigate("/feed")}>
            Browse full feed
          </Button>
        }
      >
        <p className="text-sm text-body-600 dark:text-zinc-400">{today}</p>
        <div className="mt-3">
          <SyncBanner status={ingestStatus} />
        </div>
      </PageHeader>

      {loading ? (
        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded-xl bg-slate-100 dark:bg-zinc-800/60" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-[92px] animate-pulse rounded-xl bg-slate-100 dark:bg-zinc-800/60" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {topPriority && (
            <a
              {...linkProps(`/accounts/${encodeURIComponent(topPriority.key)}`)}
              className="mb-6 flex flex-wrap items-center gap-5 rounded-xl border border-slate-200 bg-white p-7 transition-colors hover:border-brand-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-500/40"
            >
              <AccountAvatar name={topPriority.name} logoUrl={topPriority.logoUrl} size="xl" />
              <div className="min-w-0 flex-1">
                <p className="text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  Look here first
                </p>
                <p className="mt-1 truncate text-2xl font-bold tracking-tight text-ink-900 dark:text-zinc-50">
                  {topPriority.name}
                </p>
                <p className="mt-1 text-sm text-body-600 dark:text-zinc-300">{topPriority.whyNow}</p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-3">
                <ScoreBadge score={topPriority.score} size="lg" />
                <ChevronRightIcon className="h-5 w-5 text-slate-400 dark:text-zinc-500" />
              </div>
            </a>
          )}

          <div className="mb-8 grid grid-cols-2 gap-4">
            <StatTile
              label="New since yesterday"
              value={briefing.newSinceYesterday.length}
              sub="signals in the last 24h"
              tone="ink"
              onClick={() => navigate("/feed?range=1")}
            />
            <StatTile
              label="Unreviewed"
              value={briefing.unreviewed.length}
              sub={`${briefing.total ? Math.round((briefing.unreviewed.length / briefing.total) * 100) : 0}% of the feed`}
              tone="ink"
              onClick={() => navigate("/feed?reviewed=unreviewed")}
            />
          </div>

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <SectionTitle hint="Every signal ingested in the last 24 hours, newest first.">
              New Since Yesterday
            </SectionTitle>
            {visibleSignals.length > 0 && (
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
          {briefing.newSinceYesterday.length === 0 ? (
            <Card className="mb-8">
              <EmptyState
                title="Nothing new in the last 24 hours"
                description="The overnight run either found nothing new or hasn't fired yet. The full feed is still worth a scan."
                action={
                  <Button variant="primary" onClick={() => navigate("/feed")}>
                    Open Global Feed
                  </Button>
                }
              />
            </Card>
          ) : (
            <Card className="mb-8 overflow-hidden">
              {newAccountGroups.map(({ account, signals: accountSignals }, i) => {
                const isFirstTracked = i === 0 && account.managed
                const isFirstUntracked = !account.managed && (i === 0 || newAccountGroups[i - 1].account.managed)
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
                      signals={accountSignals}
                      companies={companies}
                      onOpenSignal={onOpenSignal}
                      onToggleReviewed={onToggleReviewed}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelectOne}
                    />
                  </div>
                )
              })}
            </Card>
          )}

          <SectionTitle hint="What kind of signal is showing up most, across the whole feed.">
            Where The Signals Are Landing
          </SectionTitle>
          <TypeBreakdown typeCounts={briefing.typeCounts} />

          <p className="mt-8 text-2xs text-body-500 dark:text-zinc-500">
            {briefing.total} signals in the feed
            {briefing.anchor ? ` · latest ingested ${briefing.anchor.toLocaleString()}` : ""}
          </p>
        </>
      )}
    </>
  )
}

export default Briefing
