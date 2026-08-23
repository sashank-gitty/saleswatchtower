import { useEffect, useState } from "react"
import { navigate } from "../lib/router.js"
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
} from "../components/ui.jsx"
import SignalRow from "../components/SignalRow.jsx"

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
          <p className="text-[13px] font-semibold text-rose-700 dark:text-rose-400">Sync status unavailable</p>
        </div>
        <p className="mt-1 text-[12px] text-rose-700/80 dark:text-rose-400/80">
          <span className="font-mono">GET /api/ingest-status</span> returned an error just now: &ldquo;{status.message}
          &rdquo;. The signal feed below loaded fine &mdash; only the last-run health check is affected.
        </p>
      </div>
    )
  }

  if (status.phase === "empty") {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        <p className="text-[13px] font-medium text-body-600 dark:text-zinc-300">No ingest runs recorded yet.</p>
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
        <p className={`text-[13px] font-semibold ${tone.text}`}>
          {runFailed ? "Last ingest run failed" : `Last sync ${relativeTime(data.runAt)}`}
        </p>
        {isStale && !runFailed && <Pill tone="amber">No run in {Math.round(hoursSinceRun)}h &mdash; check the cron</Pill>}
        {budgetExceeded && <Pill tone="amber">Monthly Claude budget reached</Pill>}
      </div>
      {runFailed && data.errorMessage && (
        <p className="mt-1 text-[12px] text-amber-700/80 dark:text-amber-400/80">{data.errorMessage}</p>
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
      <p className="mb-4 text-[12px] text-body-500 dark:text-zinc-400">
        Signal types across all {typeCounts.reduce((sum, t) => sum + t.count, 0)} signals.
      </p>
      <div className="space-y-3">
        {typeCounts.map(({ signalType, count, swatch }) => (
          <div key={signalType} className="flex items-center gap-3">
            <span className="w-32 flex-shrink-0 truncate text-[13px] font-medium capitalize text-body-600 dark:text-zinc-300">
              {signalType}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
              <div
                className={`h-full rounded-full ${swatch}`}
                style={{ width: `${Math.max((count / max) * 100, 4)}%` }}
              />
            </div>
            <span className="w-6 flex-shrink-0 text-right text-[13px] font-semibold tabular-nums text-body-500 dark:text-zinc-400">
              {count}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function Briefing({ signals, loading, onOpenSignal, onToggleReviewed }) {
  const ingestStatus = useIngestStatus()
  const briefing = computeBriefing(signals)

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

          <SectionTitle hint="Every signal ingested in the last 24 hours, newest first.">
            New Since Yesterday
          </SectionTitle>
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
              {briefing.newSinceYesterday.slice(0, 10).map((signal) => (
                <SignalRow
                  key={signal.id}
                  item={signal}
                  reviewed={signal.reviewed}
                  onToggleReviewed={onToggleReviewed}
                  onOpen={onOpenSignal}
                  selected={false}
                  onToggleSelect={() => {}}
                  showCheckbox={false}
                  compact
                />
              ))}
            </div>
          )}

          <SectionTitle hint="What kind of signal is showing up most, across the whole feed.">
            Where The Signals Are Landing
          </SectionTitle>
          <TypeBreakdown typeCounts={briefing.typeCounts} />

          <p className="mt-8 text-[11px] text-body-500 dark:text-zinc-500">
            {briefing.total} signals in the feed
            {briefing.anchor ? ` · latest ingested ${briefing.anchor.toLocaleString()}` : ""}
          </p>
        </>
      )}
    </>
  )
}

export default Briefing
