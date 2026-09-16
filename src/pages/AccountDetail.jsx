import { useEffect, useMemo, useRef, useState } from "react"
import { linkProps, navigate } from "../lib/router.js"
import { pillClassForSignalType } from "../lib/colors.js"
import { HIGH_RELEVANCE_THRESHOLD } from "../lib/relevance.js"
import {
  SIGNAL_GROUPS,
  countByGroup,
  filterByGroup,
  groupForSignal,
  groupLabel,
  iconForSignal,
  toneClassesForGroup,
  toneClassesForSignal,
} from "../lib/signalGroups.js"
import {
  bucketByRecency,
  keyInsights,
  peopleUpdates,
  topNews,
  valuePyramid,
  discoveryQuestionsFor,
  groupDistribution,
} from "../lib/accountBrief.js"
import { accountImpact, outreachAngles } from "../lib/signalInsights.js"
import { useOrgChart } from "../lib/useOrgChart.js"
import { useMyCompany } from "../lib/useMyCompany.js"
import { strategicAngles } from "../lib/strategicAngles.js"
import { Citations } from "../components/Citation.jsx"
import AccountChat from "../components/AccountChat.jsx"
import OrgChartPanel from "../components/OrgChartPanel.jsx"
import MeddpiccPanel from "../components/MeddpiccPanel.jsx"
import {
  Card,
  Button,
  Pill,
  ScoreBadge,
  PriorityPill,
  GradientBanner,
  IconBadge,
  SubNav,
  TabStrip,
  SectionTitle,
  EmptyState,
  NotIngested,
  Modal,
  Field,
  TextInput,
  Textarea,
  Radio,
  Toggle,
} from "../components/ui.jsx"
import {
  TrendUpIcon,
  RefreshIcon,
  ChevronLeftIcon,
  LightbulbIcon,
  UsersIcon,
  NewspaperIcon,
  ExternalLinkIcon,
  MapPinIcon,
  BuildingIcon,
  PinIcon,
  ScaleIcon,
  QuoteIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PencilIcon,
} from "../components/icons.jsx"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function formatDate(dateString) {
  if (!dateString) return "—"
  const [year, month, day] = dateString.split("-").map(Number)
  return `${String(day).padStart(2, "0")} ${MONTHS[month - 1]} ${year}`
}

const OPPORTUNITY_GROUPS = new Set(["earnings", "funding", "transformation"])

// Merged from 9 tabs to 4 fixed + up to 3 conditional: Fast Facts and
// Summary were both "orient me" content (signal timeline/account info
// alongside key insights/opportunities), so they're one Overview tab
// now; Custom (discovery questions) and Research (score breakdown) were
// both "get ready for the call" material, now one Prep tab. Sentiment/
// Contacts/Tech are filtered out of the visible strip entirely below
// when there's nothing behind them (see visibleTabs) instead of always
// showing a tab that says "nothing here."
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "signals", label: "Signals" },
  { id: "value", label: "Value" },
  { id: "prep", label: "Prep" },
  { id: "orgchart", label: "Org Chart" },
  { id: "meddpicc", label: "MEDDPICC" },
  { id: "sentiment", label: "Sentiment" },
  { id: "contacts", label: "Contacts" },
  { id: "tech", label: "Tech" },
]

// Checked against colors.js's stated rule — color reserved for genuine
// "look here first" signals, not decoration on every metadata field.
// This one holds: overall sentiment is the single most important fact on
// this tab, exactly the kind of thing that rule carves out an exception
// for (see REGULATORY_PILL there for the same reasoning). "Neutral"
// stays the shared NEUTRAL_PILL slate rather than getting its own tint,
// so only a real positive/mixed/negative reading draws the eye.
const SENTIMENT_TONE = {
  positive: "emerald",
  mixed: "amber",
  negative: "rose",
  neutral: "slate",
}

const EVIDENCE_SOURCE_LABEL = {
  news: "News",
  reddit: "Reddit",
  social: "Social",
  web: "Web",
}

// A monogram for the banner's white tile. Same derivation the avatar
// component uses, minus the colour — on a navy gradient the tile is
// always white with navy type.
function initialsFor(name) {
  return (
    name
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  )
}

// The subsection pattern the whole Summary tab is built from: a tinted
// icon badge, a heading, and a list. Colour comes from the shared group
// palette, so "amber = insight, green = opportunity, red = challenge"
// holds here exactly as it does on a feed row.
function BriefSection({ icon, tone, title, count, children, className = "" }) {
  return (
    <section className={className}>
      <div className="mb-3 flex items-center gap-2.5">
        <IconBadge icon={icon} tone={tone.badge} size="sm" />
        <h3 className="text-[15px] font-bold text-ink-900 dark:text-zinc-50">{title}</h3>
        {count !== undefined && count > 0 && (
          <span className="text-2xs font-semibold tabular-nums text-slate-400 dark:text-zinc-500">{count}</span>
        )}
      </div>
      {children}
    </section>
  )
}

function EmptyLine({ children }) {
  return <p className="text-dense leading-relaxed text-body-500 dark:text-zinc-400">{children}</p>
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      {Icon && <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400 dark:text-zinc-500" />}
      <span className="text-dense text-body-500 dark:text-zinc-400">{label}</span>
      <span className="ml-auto text-right text-dense font-semibold text-ink-900 dark:text-zinc-100">{value}</span>
    </div>
  )
}

// A tiny inline sparkline, same path-building technique as
// VolumeChart.jsx (this app has no charting library and stays that
// way) at a fraction of the size — no gridlines, no axis labels, just
// the shape of 8 weeks of signal volume next to the "up/down/flat" stat
// it accompanies.
function TrendSparkline({ weeklyCounts, direction }) {
  const width = 72
  const height = 22
  const max = Math.max(...weeklyCounts, 1)
  const stepX = width / Math.max(weeklyCounts.length - 1, 1)
  const path = weeklyCounts
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * stepX).toFixed(2)},${(height - (v / max) * height).toFixed(2)}`)
    .join(" ")

  const strokeClass =
    direction === "up"
      ? "stroke-emerald-500"
      : direction === "down"
        ? "stroke-rose-500"
        : "stroke-slate-400 dark:stroke-zinc-500"

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="Signal volume, last 8 weeks">
      <path d={path} fill="none" className={strokeClass} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

// "+40% this month" / "cooling off" — the trend stat that sits beside
// the sparkline above. changePct is null for a brand-new account (no
// prior-period signals to compare against) or a long-dormant one; both
// get a plain word instead of a fabricated percentage.
function TrendStat({ trend }) {
  if (trend.direction === "new") {
    return <span className="text-2xs font-semibold text-emerald-600 dark:text-emerald-400">New activity</span>
  }
  if (trend.changePct === null) {
    return <span className="text-2xs font-medium text-slate-400 dark:text-zinc-500">No recent activity</span>
  }
  const Icon = trend.direction === "up" ? ArrowUpIcon : trend.direction === "down" ? ArrowDownIcon : null
  const toneClass =
    trend.direction === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : trend.direction === "down"
        ? "text-rose-600 dark:text-rose-400"
        : "text-slate-500 dark:text-zinc-400"
  return (
    <span className={`inline-flex items-center gap-0.5 text-2xs font-semibold tabular-nums ${toneClass}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {trend.changePct > 0 ? "+" : ""}
      {trend.changePct}% this month
    </span>
  )
}

// Same fields as Accounts.jsx's "Track a Company" form (AddCompanyModal),
// prefilled from the account already being tracked — that form only ever
// runs once, at the moment you first track a company, so there was no way
// to go back and add a ticker or change the note afterward. Submits
// through the same onToggleClaim (useCompanies.js's setCompany), which
// already upserts, so editing an already-tracked company just overwrites
// its row instead of needing a separate update path.
function EditCompanyModal({ open, onClose, account, onSave }) {
  const [status, setStatus] = useState(account.status)
  const [isCompetitor, setIsCompetitor] = useState(account.isCompetitor)
  const [asxTicker, setAsxTicker] = useState(account.asxTicker ?? "")
  const [stockTicker, setStockTicker] = useState(account.stockTicker ?? "")
  const [note, setNote] = useState(account.note ?? "")

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      status,
      isCompetitor,
      note: note.trim() || null,
      asxTicker: asxTicker.trim() || null,
      stockTicker: stockTicker.trim() || null,
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={`Edit ${account.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Status">
          <div className="flex flex-wrap gap-4">
            <Radio name="edit-status" value="prospect" checked={status === "prospect"} onChange={() => setStatus("prospect")} label="Prospect" />
            <Radio name="edit-status" value="customer" checked={status === "customer"} onChange={() => setStatus("customer")} label="Customer" />
            <Radio name="edit-status" value="" checked={status === null} onChange={() => setStatus(null)} label="Not set" />
          </div>
        </Field>
        <Toggle
          checked={isCompetitor}
          onChange={setIsCompetitor}
          label="This is a competitor, not a prospect (track for positioning, not outreach)"
        />
        <Field label="ASX ticker (optional)" hint="Only if this company is listed on the Australian Securities Exchange.">
          <TextInput value={asxTicker} onChange={(e) => setAsxTicker(e.target.value)} placeholder="e.g. CBA" />
        </Field>
        <Field
          label="Stock ticker (optional)"
          hint="US-listed companies only (e.g. CVX for Chevron) — pulls a real stock price, market cap, and next earnings date. We also try to fill this in automatically when research finds one; set it here to override or add it sooner."
        >
          <TextInput value={stockTicker} onChange={(e) => setStockTicker(e.target.value)} placeholder="e.g. CVX" />
        </Field>
        <Field label="Why you're tracking this (optional)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </Field>
        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" variant="primary">
            Save
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// Per-contact LinkedIn role research (api/account-contacts.js's
// resource=role-research) — Bright Data's scrape is an async job, so
// this owns its own poll loop: trigger, then re-check every 4s until
// ready. Checks once on mount (a plain GET, no trigger) so a brief
// cached from an earlier visit shows immediately without a click.
function ContactRoleBrief({ linkedinUrl }) {
  const [state, setState] = useState({ status: "idle" })
  const pollRef = useRef(null)

  const checkStatus = () => {
    fetch(`/api/account-contacts?resource=role-research&linkedinUrl=${encodeURIComponent(linkedinUrl)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "ready" || data.status === "error") {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
        setState(data)
      })
      .catch(() => {
        clearInterval(pollRef.current)
        pollRef.current = null
      })
  }

  useEffect(() => {
    checkStatus()
    return () => pollRef.current && clearInterval(pollRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedinUrl])

  const startResearch = () => {
    setState({ status: "pending" })
    fetch("/api/account-contacts?resource=role-research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkedinUrl }),
    })
      .then((res) => res.json())
      .then((data) => {
        setState(data)
        if (data.status === "pending" && !pollRef.current) {
          pollRef.current = setInterval(checkStatus, 4000)
        }
      })
      .catch(() => setState({ status: "error", errorMessage: "Couldn't start role research" }))
  }

  if (state.status === "idle" || state.status === "not_started") {
    return (
      <button
        type="button"
        onClick={startResearch}
        className="mt-1.5 text-2xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
      >
        Research role
      </button>
    )
  }

  if (state.status === "pending") {
    return <p className="mt-1.5 text-2xs text-body-500 dark:text-zinc-500">Researching role…</p>
  }

  if (state.status === "error") {
    return (
      <p className="mt-1.5 text-2xs text-rose-600 dark:text-rose-400">
        {state.errorMessage ?? "Research failed"} —{" "}
        <button type="button" onClick={startResearch} className="font-semibold hover:underline">
          Retry
        </button>
      </p>
    )
  }

  const brief = state.brief
  if (!brief) return null

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-2xs dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="font-bold text-ink-900 dark:text-zinc-50">{brief.vertical}</p>
      <p className="mt-1 text-body-600 dark:text-zinc-300">{brief.roleSummary}</p>
      {brief.kpis?.length > 0 && (
        <p className="mt-1.5">
          <span className="font-semibold text-body-500 dark:text-zinc-400">KPIs: </span>
          {brief.kpis.join(", ")}
        </p>
      )}
      {brief.focus?.length > 0 && (
        <p className="mt-1">
          <span className="font-semibold text-body-500 dark:text-zinc-400">Focus: </span>
          {brief.focus.join(", ")}
        </p>
      )}
      {brief.outreachAngle && <p className="mt-1.5 italic text-body-600 dark:text-zinc-300">&ldquo;{brief.outreachAngle}&rdquo;</p>}
    </div>
  )
}

function AccountDetail({ account, onOpenSignal, loading, isClaimed, claimedAt, onToggleClaim, sentiment, contacts = [], onFindContacts }) {
  const [tab, setTab] = useState("overview")
  const [group, setGroup] = useState("all")
  const [editOpen, setEditOpen] = useState(false)
  const [findState, setFindState] = useState({ status: "idle" })

  const handleFindContacts = () => {
    setFindState({ status: "pending" })
    onFindContacts(account.key)
      .then(() => setFindState({ status: "idle" }))
      .catch((err) => setFindState({ status: "error", message: err.message }))
  }
  const orgChart = useOrgChart(account?.key)
  const { profile: myCompany } = useMyCompany()
  const approachAngles = useMemo(() => strategicAngles(myCompany), [myCompany])

  // Citation numbering is assigned once, over the account's signals in
  // display order, so a given signal carries the same number in every
  // panel on the page.
  const indexById = useMemo(() => {
    const map = new Map()
    account?.signals.forEach((signal, i) => map.set(signal.id, i + 1))
    return map
  }, [account])

  const indexOf = (signal) => indexById.get(signal.id) ?? 0

  const insights = useMemo(() => (account ? keyInsights(account.signals) : []), [account])
  const people = useMemo(() => (account ? peopleUpdates(account.signals) : []), [account])
  const news = useMemo(() => (account ? topNews(account.signals) : []), [account])
  const pyramid = useMemo(() => (account ? valuePyramid(account.signals) : []), [account])
  const buckets = useMemo(() => (account ? bucketByRecency(account.signals) : []), [account])
  const [expandedBucketIds, setExpandedBucketIds] = useState(() => new Set())
  const toggleBucketExpanded = (bucketId) => {
    setExpandedBucketIds((prev) => {
      const next = new Set(prev)
      if (next.has(bucketId)) next.delete(bucketId)
      else next.add(bucketId)
      return next
    })
  }
  const distribution = useMemo(() => (account ? groupDistribution(account.signals) : []), [account])
  const questions = useMemo(() => (account ? discoveryQuestionsFor(account.signals) : []), [account])
  const groupCounts = useMemo(() => (account ? countByGroup(account.signals) : {}), [account])

  // "Opportunity" and "Challenge" are a presentational split of the same
  // signals the rest of the page already shows, keyed off the group each
  // one is filed under — the earnings/funding/transformation categories
  // read as an opening, the regulatory one reads as pressure. Nothing is
  // inferred here that the taxonomy didn't already assert.
  const opportunities = useMemo(
    () =>
      (account?.signals ?? [])
        .filter((signal) => OPPORTUNITY_GROUPS.has(groupForSignal(signal)))
        .slice(0, 5),
    [account],
  )
  const challenges = useMemo(
    () => (account?.signals ?? []).filter((signal) => groupForSignal(signal) === "regulatory").slice(0, 5),
    [account],
  )

  // Overview/Signals/Value/Prep always show, even at zero signals — a
  // freshly tracked account with nothing yet is a normal state, not one
  // worth hiding a tab over. Sentiment/Contacts/Tech are different: they
  // depend on a pipeline that may not be connected for this account at
  // all, so an empty one is filtered out of the strip entirely below
  // rather than shown as a tab that says "nothing here" — one fewer
  // thing to click into and immediately bounce off.
  const tabsWithData = TABS.map((t) => {
    if (t.id === "sentiment") return { ...t, hasData: Boolean(sentiment) }
    // Visible for any tracked account (even at zero contacts, so "Find
    // ANZ contacts" is reachable) and for any account that already has
    // contacts regardless of tracked status.
    if (t.id === "contacts") return { ...t, hasData: account.managed || contacts.length > 0 }
    if (t.id === "tech") return { ...t, hasData: false }
    return t
  })
  const visibleTabs = tabsWithData.filter((t) => t.hasData !== false)

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-zinc-800/60" />
        <div className="h-64 animate-pulse rounded-xl bg-slate-100 dark:bg-zinc-800/60" />
      </div>
    )
  }

  if (!account) {
    return (
      <Card>
        <EmptyState
          title="Account not found"
          description="This account has no signals in the current dataset — it may have been renamed, or its signals may predate the ingest window."
          action={
            <Button variant="primary" onClick={() => navigate("/accounts")}>
              Back to Accounts
            </Button>
          }
        />
      </Card>
    )
  }

  return (
    <>
      <a
        {...linkProps("/accounts")}
        className="mb-3 inline-flex items-center gap-1 text-dense font-medium text-slate-500 transition-colors hover:text-ink-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Accounts
      </a>

      {/* Gradient identity banner, then the pills, then the sticky tab
          rail. Splitting the three means the banner can be as loud as it
          likes (it only renders once, at the top) while the rail that
          actually has to stay put while you scroll stays quiet and thin. */}
      <GradientBanner
        tile={
          account.logoUrl ? (
            <img
              src={account.logoUrl}
              alt=""
              className="h-full w-full rounded-xl object-contain p-1.5"
              // A logo that fails to load (a domain unavatar.io can't
              // resolve, a transient network blip) falls back to the
              // initials tile rather than a broken-image icon — done by
              // hiding the <img> itself, so the parent's white tile
              // background still shows through underneath.
              onError={(e) => {
                e.currentTarget.style.display = "none"
              }}
            />
          ) : (
            initialsFor(account.name)
          )
        }
        title={account.name}
        subtitle={account.managed ? (account.status ? `${account.status[0].toUpperCase()}${account.status.slice(1)}` : "Tracked") : "Not tracked"}
        aside={
          account.managed
            ? `On your tracked list — ${account.signalCount} ${
                account.signalCount === 1 ? "signal" : "signals"
              }, ${account.highRelevanceCount} high relevance.`
            : `Not on your tracked list yet. Derived from ${account.signalCount} ${
                account.signalCount === 1 ? "signal" : "signals"
              } that named this company.`
        }
      >
        <div className="flex flex-shrink-0 flex-col items-center rounded-xl bg-white/15 px-4 py-2.5 text-white backdrop-blur-sm">
          <span className="text-2xl font-bold leading-none tabular-nums">{account.score}</span>
          <span className="mt-1 text-3xs font-semibold uppercase tracking-wider text-white/70">Score</span>
        </div>
      </GradientBanner>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        {account.status ? (
          <Pill tone={account.status === "customer" ? "emerald" : "brand"}>
            {account.status === "customer" ? "Customer" : "Prospect"}
          </Pill>
        ) : (
          <Pill tone="slate">Not tracked</Pill>
        )}
        <PriorityPill priority={account.priority} />
        {isClaimed?.(account.key) && <Pill tone="navy">Mine</Pill>}

        <div className="ml-auto flex items-center gap-2">
          {onToggleClaim && (
            <Button
              variant={isClaimed?.(account.key) ? "primary" : "outline"}
              onClick={() => onToggleClaim(account.key, account.name, !isClaimed?.(account.key))}
            >
              <PinIcon filled={isClaimed?.(account.key)} className="h-4 w-4" />
              {isClaimed?.(account.key) ? "Tracked" : "Track this account"}
            </Button>
          )}
          <Button variant="secondary" onClick={() => window.location.reload()}>
            <RefreshIcon className="h-4 w-4" />
            Refresh
          </Button>
          {isClaimed?.(account.key) && onToggleClaim && (
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <PencilIcon className="h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Company snapshot — real firmographics from api/_lib/companyProfile.js,
          shown right after the banner rather than in a tab, so it's the
          first thing you see when you open an account, not something you
          have to go find. Renders nothing at all when there's no profile
          yet (not tracked, or research hasn't landed) — no placeholder
          clutter for a fact that just isn't available. */}
      {account.industry || account.description || account.headquarters || account.employeeCount ? (
        <Card className="mb-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionTitle>Company Snapshot</SectionTitle>
            {account.industry && <Pill tone="brand">{account.industry}</Pill>}
          </div>

          {account.description && (
            <p className="text-dense leading-relaxed text-body-600 dark:text-zinc-300">{account.description}</p>
          )}
          {account.businessModel && (
            <p className="mt-2 text-xs leading-relaxed text-body-500 dark:text-zinc-400">
              <span className="font-semibold">How they make money:</span> {account.businessModel}
            </p>
          )}

          {account.offerings?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {account.offerings.map((offering) => (
                <Pill key={offering} tone="slate">
                  {offering}
                </Pill>
              ))}
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-x-6 divide-y divide-slate-100 border-t border-slate-100 sm:grid-cols-2 sm:divide-y-0 dark:divide-zinc-800 dark:border-zinc-800">
            {account.headquarters && <InfoRow icon={MapPinIcon} label="Headquarters" value={account.headquarters} />}
            {(account.employeeCount || account.employeeGrowth) && (
              <InfoRow
                icon={UsersIcon}
                label="Employees"
                value={[account.employeeCount, account.employeeGrowth].filter(Boolean).join(" · ")}
              />
            )}
            {account.foundedYear && <InfoRow icon={BuildingIcon} label="Founded" value={account.foundedYear} />}
            {account.domain && (
              <InfoRow
                label="Website"
                value={
                  <a
                    href={`https://${account.domain}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-brand-600 hover:underline dark:text-brand-400"
                  >
                    {account.domain}
                  </a>
                }
              />
            )}
          </div>
        </Card>
      ) : null}

      {/* Persistently visible regardless of which tab is open below —
          matches how Gong/Nooks keep their account chat reachable at
          all times rather than buried in a sub-tab. Only shown once
          there's something to ground an answer in. */}
      {account.signals.length > 0 && <AccountChat companyName={account.name} signals={account.signals} />}

      <div className="sticky top-14 z-20 -mx-4 mb-5 mt-3 border-b border-slate-200 bg-page/90 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 dark:border-zinc-800 dark:bg-zinc-950/90">
        <SubNav tabs={visibleTabs} active={tab} onChange={setTab} />
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <Card className="p-5">
              <SectionTitle hint="Signals bucketed by how recently they landed, so a warming account reads differently from a cooling one.">
                Signal Timeline
              </SectionTitle>
              <div className="space-y-4">
                {buckets.map((bucket) => {
                  // Highest-relevance signals first within the bucket, capped
                  // to 5 by default with an expand — an account with 31
                  // signals in one bucket used to render all 31 here.
                  const sorted = [...bucket.signals].sort(
                    (a, b) => (b.outreachRelevance ?? 0) - (a.outreachRelevance ?? 0),
                  )
                  const isExpanded = expandedBucketIds.has(bucket.id)
                  const visible = isExpanded ? sorted : sorted.slice(0, 5)
                  const hiddenCount = sorted.length - visible.length
                  return (
                    <div key={bucket.id}>
                      <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        {bucket.label}
                      </p>
                      <ul className="space-y-1">
                        {visible.map((signal) => (
                          <li key={signal.id}>
                            <button
                              type="button"
                              onClick={() => onOpenSignal(signal.id)}
                              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs text-body-600 transition-colors hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800/40"
                            >
                              <IconBadge
                                icon={iconForSignal(signal)}
                                tone={toneClassesForSignal(signal).badge}
                                size="sm"
                              />
                              <span className="min-w-0 flex-1 truncate">{signal.headline}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                      {hiddenCount > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleBucketExpanded(bucket.id)}
                          className="mt-1 px-2 text-2xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                        >
                          Show all {sorted.length}
                        </button>
                      )}
                      {isExpanded && sorted.length > 5 && (
                        <button
                          type="button"
                          onClick={() => toggleBucketExpanded(bucket.id)}
                          className="mt-1 px-2 text-2xs font-semibold text-slate-500 hover:underline dark:text-zinc-400"
                        >
                          Show less
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card className="p-5">
              <SectionTitle>Signal Mix</SectionTitle>
              <div className="space-y-2">
                {distribution.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3">
                    <span className="w-40 flex-shrink-0 truncate text-xs text-body-600 dark:text-zinc-300">
                      {entry.label}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                      <div
                        className={`h-full rounded-full ${toneClassesForGroup(entry.id).dot}`}
                        style={{ width: `${Math.max(4, entry.share * 100)}%` }}
                      />
                    </div>
                    <span className="w-8 flex-shrink-0 text-right text-xs tabular-nums text-body-500 dark:text-zinc-400">
                      {entry.count}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="h-fit p-5">
            <SectionTitle>Account Information</SectionTitle>
            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              <InfoRow icon={BuildingIcon} label="Coverage" value={account.managed ? "Tracked" : "Not tracked"} />
              {account.note && <InfoRow icon={MapPinIcon} label="Note" value={account.note} />}
              <InfoRow label="Signals" value={account.signalCount} />
              <InfoRow label="High relevance" value={account.highRelevanceCount} />
              <InfoRow label="Unreviewed" value={account.unreviewedCount} />
              <InfoRow label="First seen" value={formatDate(account.firstSeen)} />
              <InfoRow label="Last signal" value={formatDate(account.lastSignalDate)} />
              {isClaimed?.(account.key) && (
                <InfoRow icon={PinIcon} label="Claimed on" value={formatDate(claimedAt?.(account.key)?.slice(0, 10))} />
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === "overview" && (
        <>
          <SectionTitle hint="Every line below is grouped from this account's own signals. Click any citation badge to open the source signal.">
            What You Need to Know
          </SectionTitle>

          {/* Two columns: what the account is doing on the left (insight →
              opportunity → challenge, the order a rep actually reasons in),
              who and what is being said about it on the right. Both are
              relayouts of signals already on the page — nothing here is
              synthesized that wasn't before. */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card className="divide-y divide-slate-100 p-5 dark:divide-zinc-800">
              <BriefSection
                icon={LightbulbIcon}
                tone={toneClassesForGroup("research")}
                title="Key Insights"
                count={insights.length}
                className="pb-5"
              >
                {insights.length === 0 ? (
                  <EmptyLine>No signals yet for this account.</EmptyLine>
                ) : (
                  <ul className="space-y-4">
                    {insights.map((insight) => {
                      const angle = outreachAngles(insight.signals[0], account.status)[0]
                      return (
                        <li key={insight.id} className="min-w-0">
                          <p className="text-dense leading-relaxed text-body-600 dark:text-zinc-300">
                            <span className="font-semibold text-ink-900 dark:text-zinc-100">{insight.label}:</span>{" "}
                            {insight.count} {insight.count === 1 ? "signal" : "signals"}
                            {insight.highCount > 0 && (
                              <span className="font-semibold text-brand-600 dark:text-brand-400">
                                {" "}
                                ({insight.highCount} high-relevance)
                              </span>
                            )}
                            , most recent {formatDate(insight.newest)}. Lead: &ldquo;{insight.lead}&rdquo;
                            <Citations signals={insight.signals} indexOf={indexOf} onOpen={onOpenSignal} />
                          </p>
                          <p className="mt-1.5 text-xs leading-relaxed text-body-500 dark:text-zinc-400">
                            {accountImpact(insight.signals[0])}
                          </p>
                          {angle && (
                            <p className="mt-1.5 text-xs leading-relaxed text-body-500 dark:text-zinc-400">
                              <span className="font-semibold text-body-600 dark:text-zinc-300">
                                Angle &mdash; {angle.label}:
                              </span>{" "}
                              {angle.angle}
                            </p>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </BriefSection>

              <BriefSection
                icon={TrendUpIcon}
                tone={toneClassesForGroup("earnings")}
                title="Opportunities"
                count={opportunities.length}
                className="py-5"
              >
                {opportunities.length === 0 ? (
                  <EmptyLine>
                    Nothing in the earnings, funding or transformation categories yet &mdash; those are the signals that
                    read as an opening.
                  </EmptyLine>
                ) : (
                  <ul className="space-y-2.5">
                    {opportunities.map((signal) => (
                      <li key={signal.id} className="text-dense leading-relaxed text-body-600 dark:text-zinc-300">
                        {signal.headline}
                        <Citations signals={[signal]} indexOf={indexOf} onOpen={onOpenSignal} />
                      </li>
                    ))}
                  </ul>
                )}
              </BriefSection>

              <BriefSection
                icon={ScaleIcon}
                tone={toneClassesForGroup("regulatory")}
                title="Challenges"
                count={challenges.length}
                className="pt-5"
              >
                {challenges.length === 0 ? (
                  <EmptyLine>No regulatory or pain-point signals against this account.</EmptyLine>
                ) : (
                  <ul className="space-y-2.5">
                    {challenges.map((signal) => (
                      <li key={signal.id} className="text-dense leading-relaxed text-body-600 dark:text-zinc-300">
                        {signal.headline}
                        <Citations signals={[signal]} indexOf={indexOf} onOpen={onOpenSignal} />
                      </li>
                    ))}
                  </ul>
                )}
              </BriefSection>
            </Card>

            <Card className="divide-y divide-slate-100 p-5 dark:divide-zinc-800">
              {/* The reference layout opens this column with an attributed
                  executive quote. This pipeline ingests Google News RSS —
                  headlines and summaries, no transcripts — so the panel says
                  what it would need rather than putting invented words in a
                  named executive's mouth. */}
              <BriefSection
                icon={QuoteIcon}
                tone={toneClassesForGroup("transformation")}
                title="Executive Perspective"
                className="pb-5"
              >
                <EmptyLine>
                  Attributed quotes need earnings-call transcripts or investor-relations feeds. Neither is wired into
                  ingest, and writing a quote from a headline would put words in a named executive&rsquo;s mouth.
                </EmptyLine>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {["Earnings call transcripts", "Investor relations feeds", "SEC / ASX filings"].map((source) => (
                    <Pill key={source} tone="slate">
                      {source}
                    </Pill>
                  ))}
                </div>
              </BriefSection>

              <BriefSection
                icon={UsersIcon}
                tone={toneClassesForGroup("leadership")}
                title="People Updates"
                count={people.length}
                className="py-5"
              >
                {people.length === 0 ? (
                  <EmptyLine>No leadership changes detected for this account.</EmptyLine>
                ) : (
                  <ul className="space-y-2.5">
                    {people.map((signal) => (
                      <li key={signal.id} className="text-dense leading-relaxed text-body-600 dark:text-zinc-300">
                        {signal.headline}
                        <Citations signals={[signal]} indexOf={indexOf} onOpen={onOpenSignal} />
                      </li>
                    ))}
                  </ul>
                )}
              </BriefSection>

              <BriefSection
                icon={NewspaperIcon}
                tone={toneClassesForGroup("news")}
                title="Top News"
                count={news.length}
                className="pt-5"
              >
                {news.length === 0 ? (
                  <EmptyLine>Nothing in the news categories for this account yet.</EmptyLine>
                ) : (
                  <ul className="space-y-2.5">
                    {news.map((signal) => (
                      <li key={signal.id} className="text-dense leading-relaxed text-body-600 dark:text-zinc-300">
                        {signal.headline}
                        {(signal.outreachRelevance ?? 0) >= HIGH_RELEVANCE_THRESHOLD && (
                          <span className="ml-1.5 align-middle">
                            <Pill tone="brand">High</Pill>
                          </span>
                        )}
                        <Citations signals={[signal]} indexOf={indexOf} onOpen={onOpenSignal} />
                      </li>
                    ))}
                  </ul>
                )}
              </BriefSection>
            </Card>
          </div>
        </>
      )}

      {tab === "signals" && (
        <Card className="overflow-hidden">
          <div className="px-4 pt-2">
            <TabStrip
              tabs={[
                { id: "all", label: "All", count: groupCounts.all },
                ...SIGNAL_GROUPS.map((g) => ({
        id: g.id,
        label: g.label,
        count: groupCounts[g.id] ?? 0,
        Icon: g.Icon,
        tone: toneClassesForGroup(g.id).badge,
      })),
              ]}
              active={group}
              onChange={setGroup}
            />
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-zinc-800/70">
            {filterByGroup(account.signals, group).map((signal) => (
              <li key={signal.id}>
                <button
                  type="button"
                  onClick={() => onOpenSignal(signal.id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/40"
                >
                  <IconBadge icon={iconForSignal(signal)} tone={toneClassesForSignal(signal).badge} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-dense font-semibold text-ink-900 dark:text-zinc-100">
                      {signal.headline}
                    </span>
                    <span className="mt-0.5 block line-clamp-2 text-xs text-body-500 dark:text-zinc-400">
                      {signal.summary}
                    </span>
                    <span className="mt-1.5 inline-flex">
                      <span
                        className={`rounded-full px-2 py-0.5 text-2xs font-semibold capitalize ${pillClassForSignalType(signal.signalType)}`}
                      >
                        {signal.signalType}
                      </span>
                    </span>
                  </span>
                  <span className="flex-shrink-0 text-xs tabular-nums text-slate-400 dark:text-zinc-500">
                    {formatDate(signal.date)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === "value" && (
        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle hint="From the research pipeline that runs once an account is tracked — what they do, how they make money, their product, and how they stack up against named competitors.">
              Company Snapshot
            </SectionTitle>
            {!account.description && !account.businessModel && account.offerings.length === 0 && !account.competitivePosition ? (
              <NotIngested
                title="No company snapshot yet"
                note={
                  account.managed
                    ? "The research pipeline runs once when a company is first tracked — this can take up to a minute. Check back shortly, or hit Refresh above."
                    : "This account isn't tracked yet — the research pipeline only runs for tracked companies. Track this account to get one."
                }
                sources={["What they do", "Revenue stream", "Product", "Competitive position"]}
              />
            ) : (
              <dl className="space-y-4">
                {account.description && (
                  <div>
                    <dt className="text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">What they do</dt>
                    <dd className="mt-0.5 text-dense text-body-600 dark:text-zinc-300">{account.description}</dd>
                  </div>
                )}
                {account.businessModel && (
                  <div>
                    <dt className="text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Revenue stream</dt>
                    <dd className="mt-0.5 text-dense text-body-600 dark:text-zinc-300">{account.businessModel}</dd>
                  </div>
                )}
                {account.offerings.length > 0 && (
                  <div>
                    <dt className="text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Product</dt>
                    <dd className="mt-1.5 flex flex-wrap gap-1.5">
                      {account.offerings.map((o) => (
                        <Pill key={o} tone="slate">{o}</Pill>
                      ))}
                    </dd>
                  </div>
                )}
                {account.competitivePosition && (
                  <div>
                    <dt className="text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Competitive position</dt>
                    <dd className="mt-0.5 text-dense text-body-600 dark:text-zinc-300">{account.competitivePosition}</dd>
                  </div>
                )}
              </dl>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle hint="Generic strategic framings, not a claim about this specific account — reordered to match leadership's stated priorities (Settings' My Company) when you've set one.">
              Suggested Approach
            </SectionTitle>
            <div className="space-y-3">
              {approachAngles.map((a, i) => (
                <div key={a.id} className={`rounded-lg border p-3 ${i === 0 && myCompany?.strategicPriorities ? "border-brand-300 bg-brand-50/50 dark:border-brand-500/30 dark:bg-brand-500/5" : "border-slate-200 dark:border-zinc-800"}`}>
                  <p className="text-dense font-bold text-ink-900 dark:text-zinc-50">{a.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-body-600 dark:text-zinc-300">{a.rationale}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
          <SectionTitle hint="Signals mapped onto a value framework. Tiers with no matching signals are omitted rather than shown empty.">
            Value Pyramid
          </SectionTitle>
          {pyramid.length === 0 ? (
            <p className="text-dense text-body-500 dark:text-zinc-400">
              Not enough signal variety yet to build a value view for this account.
            </p>
          ) : (
            <div className="space-y-6">
              {pyramid.map((tier) => (
                <section key={tier.id} className="border-l-2 border-brand-500 pl-4">
                  <h3 className="text-[15px] font-semibold text-brand-600 dark:text-brand-400">{tier.label}</h3>
                  <p className="mt-0.5 text-xs text-body-500 dark:text-zinc-400">{tier.blurb}</p>
                  <ul className="mt-2.5 space-y-2">
                    {tier.items.map((item) => (
                      <li key={item.groupId} className="text-dense leading-relaxed text-body-600 dark:text-zinc-300">
                        <span className="font-medium text-ink-900 dark:text-zinc-100">{item.label}</span> —{" "}
                        {item.signals.length} {item.signals.length === 1 ? "signal" : "signals"}, led by &ldquo;
                        {item.signals[0].headline}&rdquo;
                        <Citations signals={item.signals} indexOf={indexOf} onOpen={onOpenSignal} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          </Card>
        </div>
      )}

      {tab === "prep" && (
        <Card className="overflow-hidden">
          <div className="p-5 pb-3">
            <SectionTitle hint="Generic discovery prompts keyed off the kinds of signal this account's news has actually produced. Identical across accounts by design — the account-specific part is which kinds appear.">
              Discovery Questions
            </SectionTitle>
          </div>
          {questions.length === 0 ? (
            <EmptyState
              title="Not enough signal variety yet"
              description="Discovery questions key off the kind of signal this account's news has produced so far."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-dense">
                <thead className="border-y border-slate-200 bg-slate-50 text-2xs uppercase tracking-wider text-slate-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 text-left font-medium">Persona</th>
                    <th scope="col" className="px-4 py-2.5 text-left font-medium">Discovery question</th>
                    <th scope="col" className="px-4 py-2.5 text-left font-medium">What this uncovers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/70">
                  {questions.map((q, i) => (
                    <tr key={i} className="align-top">
                      <td className="px-4 py-3">
                        <span className="font-medium text-ink-900 dark:text-zinc-100">{q.persona}</span>
                        <span className="mt-1 block">
                          <Pill tone="sky">{groupLabel(q.group)}</Pill>
                        </span>
                      </td>
                      <td className="px-4 py-3 italic text-body-600 dark:text-zinc-300">&ldquo;{q.question}&rdquo;</td>
                      <td className="px-4 py-3 text-body-500 dark:text-zinc-400">{q.uncovers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "prep" && (
        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle hint="How this account's score was calculated. Shown rather than hidden so a low score can be argued with.">
              Score Breakdown
            </SectionTitle>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <ScoreBadge score={account.score} size="lg" />
              <div>
                <p className="text-dense font-medium text-ink-900 dark:text-zinc-100">
                  {account.score} / 100 &middot; {account.priority.label}
                </p>
                <p className="text-xs text-body-500 dark:text-zinc-400">
                  Weighted: relevance 55%, recency 30%, volume 15%
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2.5">
                <TrendSparkline weeklyCounts={account.trend.weeklyCounts} direction={account.trend.direction} />
                <TrendStat trend={account.trend} />
              </div>
            </div>
            <div className="space-y-2.5">
              {[
                { label: "Best outreach trigger (relevance)", value: account.scoreBreakdown.relevance, weight: "55%" },
                { label: "How warm right now (recency)", value: account.scoreBreakdown.recency, weight: "30%" },
                { label: "Sustained activity (volume)", value: account.scoreBreakdown.volume, weight: "15%" },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="w-56 flex-shrink-0 text-xs text-body-600 dark:text-zinc-300">{row.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${Math.max(2, row.value * 100)}%` }}
                    />
                  </div>
                  <span className="w-16 flex-shrink-0 text-right text-xs tabular-nums text-body-500 dark:text-zinc-400">
                    {Math.round(row.value * 100)}% &times; {row.weight}
                  </span>
                </div>
              ))}
            </div>

            {(account.reasons.elevators.length > 0 || account.reasons.reductors.length > 0) && (
              <div className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 dark:border-zinc-800">
                {account.reasons.elevators.length > 0 && (
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      <ArrowUpIcon className="h-3 w-3" />
                      Elevators
                    </p>
                    <ul className="space-y-1">
                      {account.reasons.elevators.map((line) => (
                        <li key={line} className="text-xs leading-relaxed text-body-600 dark:text-zinc-300">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {account.reasons.reductors.length > 0 && (
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                      <ArrowDownIcon className="h-3 w-3" />
                      Reductors
                    </p>
                    <ul className="space-y-1">
                      {account.reasons.reductors.map((line) => (
                        <li key={line} className="text-xs leading-relaxed text-body-600 dark:text-zinc-300">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle>All Sources</SectionTitle>
            <ul className="space-y-1.5">
              {account.signals.map((signal) => (
                <li key={signal.id} className="flex items-baseline gap-2 text-dense">
                  <span className="w-6 flex-shrink-0 text-right text-2xs font-semibold tabular-nums text-slate-400 dark:text-zinc-500">
                    {indexOf(signal)}
                  </span>
                  <a
                    href={signal.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="group inline-flex min-w-0 items-baseline gap-1 text-slate-700 hover:text-brand-600 dark:text-zinc-300 dark:hover:text-brand-400"
                  >
                    <span className="truncate">{signal.headline}</span>
                    <ExternalLinkIcon className="h-3 w-3 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                  </a>
                  <span className="ml-auto flex-shrink-0 text-2xs tabular-nums text-slate-400 dark:text-zinc-500">
                    {formatDate(signal.date)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {tab === "orgchart" && (
        <OrgChartPanel
          people={orgChart.people}
          loading={orgChart.loading}
          onAdd={orgChart.addPerson}
          onUpdate={orgChart.updatePerson}
          onRemove={orgChart.removePerson}
        />
      )}

      {tab === "meddpicc" && (
        <MeddpiccPanel companyKey={account?.key} companyName={account?.name} orgChartPeople={orgChart.people} />
      )}

      {tab === "sentiment" && (
        <div className="space-y-5">
          {!sentiment ? (
            <Card>
              <EmptyState
                title="No sentiment research yet"
                description="What people are saying about this company across news, Reddit, and social media isn't connected yet — that needs a one-time setup on my end, so just ask if you want it turned on."
              />
            </Card>
          ) : (
            <>
              <Card className="p-5">
                <div className="flex items-center gap-2">
                  <Pill tone={SENTIMENT_TONE[sentiment.overallSentiment] ?? "slate"} className="text-xs px-2.5 py-1">
                    {sentiment.overallSentiment[0].toUpperCase() + sentiment.overallSentiment.slice(1)}
                  </Pill>
                  <span className="text-2xs text-slate-400 dark:text-zinc-500">
                    Last researched {formatDate(sentiment.researchedAt?.slice(0, 10))}
                  </span>
                </div>
                <p className="mt-3 text-dense leading-relaxed text-body-600 dark:text-zinc-200">{sentiment.summary}</p>
                {sentiment.themes?.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {sentiment.themes.map((theme) => (
                      <Pill key={theme} tone="slate">
                        {theme}
                      </Pill>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-5">
                <SectionTitle hint="The real, cited items this read was drawn from — news coverage, Reddit, and social media.">
                  Evidence
                </SectionTitle>
                {!sentiment.evidence || sentiment.evidence.length === 0 ? (
                  <p className="text-dense text-body-500 dark:text-zinc-400">No specific evidence items were cited for this pass.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {sentiment.evidence.map((item, i) => (
                      <li key={`${item.url}-${i}`} className="flex items-baseline gap-2 text-dense">
                        <Pill tone="slate" className="flex-shrink-0">
                          {EVIDENCE_SOURCE_LABEL[item.source] ?? item.source}
                        </Pill>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="group inline-flex min-w-0 items-baseline gap-1 text-slate-700 hover:text-brand-600 dark:text-zinc-300 dark:hover:text-brand-400"
                        >
                          <span className="truncate">{item.headline}</span>
                          <ExternalLinkIcon className="h-3 w-3 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                        </a>
                        {item.date && (
                          <span className="ml-auto flex-shrink-0 text-2xs tabular-nums text-slate-400 dark:text-zinc-500">
                            {formatDate(item.date)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )}
        </div>
      )}

      {tab === "contacts" && (
        <>
          {onFindContacts && (
            <div className="mb-3 flex items-center gap-2">
              <Button variant="secondary" onClick={handleFindContacts} disabled={findState.status === "pending"}>
                {findState.status === "pending" ? "Finding contacts…" : "Find ANZ contacts"}
              </Button>
              {findState.status === "error" && (
                <span className="text-2xs text-rose-600 dark:text-rose-400">{findState.message}</span>
              )}
            </div>
          )}

          {contacts.length > 0 ? (
            <Card className="divide-y divide-slate-100 dark:divide-zinc-800">
              {contacts.map((contact) => (
                <div key={`${contact.fullName}-${contact.email ?? contact.linkedinUrl}`} className="flex items-start gap-3 p-4">
                  <IconBadge icon={UsersIcon} tone="bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-dense font-bold text-ink-900 dark:text-zinc-50">{contact.fullName}</p>
                    {contact.title && (
                      <p className="text-xs text-body-500 dark:text-zinc-400">{contact.title}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      {contact.email && (
                        <span className="text-body-600 dark:text-zinc-300">{contact.email}</span>
                      )}
                      {contact.linkedinUrl && (
                        <a
                          href={contact.linkedinUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-600 hover:underline dark:text-brand-400"
                        >
                          LinkedIn
                        </a>
                      )}
                    </div>
                    {contact.linkedinUrl && <ContactRoleBrief linkedinUrl={contact.linkedinUrl} />}
                  </div>
                  <Pill tone="slate">
                    {contact.source === "apollo" ? "Apollo" : contact.source === "zoominfo" ? "ZoomInfo" : "Lusha"}
                  </Pill>
                </div>
              ))}
            </Card>
          ) : (
            <NotIngested
              title="No contacts yet"
              note='Click "Find ANZ contacts" above to pull real people at this company from Apollo, filtered to Australia/New Zealand.'
              sources={["Apollo people search", "Bright Data LinkedIn enrichment"]}
            />
          )}
        </>
      )}

      {tab === "tech" && (
        <NotIngested
          title="Account Technologies — not available from this pipeline"
          note="The reference product infers an account's tech stack from job postings that name tools. This pipeline ingests no job postings, so there is no evidence base to build a stack from. Inferring one from news headlines would be guesswork presented as fact about a real company's infrastructure."
          sources={["Job posting feeds", "BuiltWith / HG Insights", "ZoomInfo technographics"]}
        />
      )}

      {editOpen && (
        <EditCompanyModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          account={account}
          onSave={(options) => onToggleClaim(account.key, account.name, true, options)}
        />
      )}
    </>
  )
}

export default AccountDetail
