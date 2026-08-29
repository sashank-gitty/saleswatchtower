import { useEffect, useMemo, useState } from "react"
import { navigate } from "../lib/router.js"
import { computeBriefing } from "../lib/briefing.js"
import { buildSignalReason } from "../lib/signalReason.js"
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
} from "../components/ui.jsx"
import SignalRow from "../components/SignalRow.jsx"
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

function Briefing({ signals, companies = [], loading, onOpenSignal, onToggleReviewed, onMarkManyReviewed }) {
  const ingestStatus = useIngestStatus()
  const briefing = computeBriefing(signals)
  // Tracked-account signals first, same "what's mine" vs "what's out
  // there" split as Global Feed — a real prospect's own news shouldn't
  // sit below a company you've never heard of just because it's newer.
  const visibleSignals = useMemo(
    () =>
      [...briefing.newSinceYesterday]
        .sort((a, b) => {
          const aTracked = buildSignalReason(a, companies).tone === "prospect" ? 1 : 0
          const bTracked = buildSignalReason(b, companies).tone === "prospect" ? 1 : 0
          return bTracked - aTracked
        })
        .slice(0, 10),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [briefing.newSinceYesterday, companies],
  )

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
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[124px] animate-pulse rounded-xl bg-slate-100 dark:bg-zinc-800/60" />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="New since yesterday"
              value={briefing.newSinceYesterday.length}
              sub="signals in the last 24h"
              tone="ink"
              onClick={() => navigate("/feed?range=1")}
            />
            <StatTile
              label="High relevance"
              value={briefing.highRelevance.length}
              sub="rated 4–5 of 5"
              onClick={() => navigate("/feed?relevance=high")}
            />
            <StatTile
              label="Account-matched"
              value={briefing.accountMatched.length}
              sub="named a tracked company"
              tone="ink"
              onClick={() => navigate("/feed?matched=1")}
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
            <div className="mb-8 space-y-2">
              {visibleSignals.map((signal, i) => {
                const isTracked = buildSignalReason(signal, companies).tone === "prospect"
                const prevTracked =
                  i > 0 ? buildSignalReason(visibleSignals[i - 1], companies).tone === "prospect" : null
                const isFirstTracked = i === 0 && isTracked
                const isFirstUntracked = !isTracked && (i === 0 || prevTracked)
                return (
                  <div key={signal.id}>
                    {isFirstTracked && (
                      <p className="px-1 pb-1 text-3xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        Your Accounts
                      </p>
                    )}
                    {isFirstUntracked && (
                      <p className="px-1 pb-1 pt-2 text-3xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        Market Discovery — not on your tracked list
                      </p>
                    )}
                    <SignalRow
                      item={signal}
                      companies={companies}
                      reviewed={signal.reviewed}
                      onToggleReviewed={onToggleReviewed}
                      onOpen={onOpenSignal}
                      selected={selectedIds.has(signal.id)}
                      onToggleSelect={toggleSelectOne}
                      showCheckbox
                      compact
                    />
                  </div>
                )
              })}
            </div>
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
