import { useMemo, useState } from "react"
import { deriveCompetitors } from "../lib/competitorModel.js"
import {
  PageHeader,
  Card,
  Pill,
  StatTile,
  SectionTitle,
  FilterSelect,
  SearchInput,
  EmptyState,
  Eyebrow,
} from "../components/ui.jsx"
import { ChevronDownIcon, TargetIcon } from "../components/icons.jsx"
import SkeletonRow from "../components/SkeletonRow.jsx"
import SignalRow from "../components/SignalRow.jsx"

const RANGE_OPTIONS = [
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

// One competitor's block: identity, a plain-English rollup, and its
// signals nested underneath — same nesting pattern as Global Feed's
// AccountBlock, so the two surfaces feel like the same product. The
// content inside is what's different: opening one of these signals shows
// a positioning read in the drawer, not an outreach angle, because
// there's no outreach to be had with a competitor.
function CompetitorBlock({ competitor, onOpenSignal, onToggleReviewed }) {
  const [expanded, setExpanded] = useState(true)
  const visible = expanded ? competitor.signals : competitor.signals.slice(0, 3)

  return (
    <div className="border-b border-slate-200 last:border-b-0 dark:border-zinc-800">
      <div className="flex items-start gap-3 bg-section px-4 py-2.5 dark:bg-zinc-900/40">
        <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
          {competitor.name
            .replace(/[^a-zA-Z0-9 ]/g, "")
            .split(/\s+/)
            .filter(Boolean)
            .map((w) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <span className="truncate text-dense font-bold text-ink-900 dark:text-zinc-50">{competitor.name}</span>
          <p className="mt-0.5 text-2xs text-body-500 dark:text-zinc-500">{competitor.rollup}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <Pill tone="slate">
            {competitor.signalCount} {competitor.signalCount === 1 ? "Signal" : "Signals"}
          </Pill>
        </div>
      </div>

      <div className="flex flex-col gap-1 p-1.5">
        {visible.map((signal) => (
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

      {competitor.signals.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-center gap-1 px-4 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-ink-900 dark:text-zinc-400 dark:hover:bg-zinc-800/40 dark:hover:text-zinc-100"
        >
          <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          {expanded ? "Show fewer" : `Show all ${competitor.signals.length} signals`}
        </button>
      )}
    </div>
  )
}

function Competitors({ signals, companies = [], loading, onOpenSignal, onToggleReviewed }) {
  const [search, setSearch] = useState("")
  const [range, setRange] = useState("30")

  const scoped = useMemo(() => signals.filter((s) => withinRange(s, range)), [signals, range])
  const competitors = useMemo(() => deriveCompetitors(scoped, companies), [scoped, companies])
  const hasAnyCompetitor = companies.some((c) => c.isCompetitor)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return competitors.filter((c) => {
      if (query && !c.name.toLowerCase().includes(query)) return false
      return true
    })
  }, [competitors, search])

  const active = filtered.filter((c) => c.signalCount > 0)
  const quiet = filtered.filter((c) => c.signalCount === 0)

  const totalSignals = active.reduce((sum, c) => sum + c.signalCount, 0)
  const mostActive = active[0]?.name ?? "—"
  const unreviewed = active.reduce((sum, c) => sum + c.signals.filter((s) => !s.reviewed).length, 0)

  return (
    <>
      <PageHeader
        eyebrow={
          <Eyebrow tone="slate">
            <TargetIcon className="h-3 w-3" />
            Not accounts — vendors
          </Eyebrow>
        }
        title="Competitor Intelligence"
        subtitle="What competitors have been up to — for positioning, not prospecting."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search competitors..." className="col-span-2 sm:col-span-1" />
          <FilterSelect label="Date range" value={range} onChange={(v) => setRange(v ?? "30")} options={RANGE_OPTIONS} />
        </div>
      </PageHeader>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatTile label="Competitor signals" value={totalSignals} tone="ink" sub={`In the last ${range} days`} />
        <StatTile label="Most active right now" value={mostActive} tone="brand" />
        <StatTile label="Unreviewed" value={unreviewed} tone="ink" />
      </div>

      <SectionTitle hint="Grouped by competitor. Open a signal to see how it should update your positioning, not an outreach angle — you can't prospect a competitor.">
        Competitor Activity
      </SectionTitle>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : !hasAnyCompetitor ? (
          <EmptyState
            title="No competitors tracked yet"
            description='Track a company from the Accounts page with "This is a competitor" checked to start tracking its news here.'
          />
        ) : active.length === 0 ? (
          <EmptyState
            title="No competitor activity in this window"
            description="Try widening the date range or clearing the search."
          />
        ) : (
          <div>
            {active.map((competitor) => (
              <CompetitorBlock
                key={competitor.key}
                competitor={competitor}
                onOpenSignal={onOpenSignal}
                onToggleReviewed={onToggleReviewed}
              />
            ))}
          </div>
        )}
      </Card>

      {quiet.length > 0 && (
        <>
          <SectionTitle hint="Tracked competitors with nothing new in this window — still worth knowing there's nothing to update.">
            Also Tracked, Nothing New
          </SectionTitle>
          <Card className="flex flex-wrap gap-2 p-4">
            {quiet.map((c) => (
              <span
                key={c.key}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-body-600 dark:border-zinc-700 dark:text-zinc-300"
              >
                {c.name}
              </span>
            ))}
          </Card>
        </>
      )}
    </>
  )
}

export default Competitors
