import { useEffect, useMemo, useRef, useState } from "react"
import { pillClassForScope } from "../lib/colors.js"
import { linkProps } from "../lib/router.js"
import { relevanceTierText } from "../lib/relevanceTiers.js"
import { buildSignalReason, actionForReason, REASON_TONE_STYLES } from "../lib/signalReason.js"
import { accountImpact, whoThisAffects, outreachAngles, scoreMeaning } from "../lib/signalInsights.js"
import { positioningRead, competitiveWatch, differentiationAngles } from "../lib/competitorInsights.js"
import { accountKey } from "../lib/accountModel.js"
import { useMyCompany } from "../lib/useMyCompany.js"
import { iconForSignal, groupLabel, groupForSignal, toneClassesForSignal } from "../lib/signalGroups.js"
import { AccountAvatar, Pill, IconBadge, Collapsible, NotIngested } from "./ui.jsx"
import {
  XIcon,
  CopyIcon,
  ExternalLinkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowUpIcon,
  SearchIcon,
  LightbulbIcon,
  UsersIcon,
  TargetIcon,
} from "./icons.jsx"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function formatDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number)
  return `${String(day).padStart(2, "0")} ${MONTHS[month - 1]} ${year}`
}

function domainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

// Splits text on a term and tags each match with a global index, so the
// find bar can scroll between them. A running counter is threaded through
// rather than restarted per-block, because the drawer highlights across
// several separate blocks (headline, summary, rubric text) and the match
// numbering has to be continuous across all of them.
function markMatches(text, term, counter) {
  if (!term || !text) return text ?? null
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const parts = String(text).split(new RegExp(`(${escaped})`, "gi"))
  return parts.map((part, i) => {
    if (part.toLowerCase() !== term.toLowerCase()) return part
    const index = counter.next++
    return (
      <mark
        key={i}
        data-find-index={index}
        className="rounded-sm bg-brand-500/25 px-0.5 font-medium text-brand-800 dark:bg-brand-500/35 dark:text-brand-100"
      >
        {part}
      </mark>
    )
  })
}

// The relevance figure as a graded pill, on the same green/amber/red
// scale the account score badge uses — so "is this worth acting on"
// reads identically whether you're looking at a signal or an account.
function relevanceTone(score) {
  if ((score ?? 0) >= 4) return "rose"
  if ((score ?? 0) === 3) return "amber"
  return "slate"
}

const RELEVANCE_LABELS = {
  5: "Extremely relevant",
  4: "Highly relevant",
  3: "Moderately relevant",
  2: "Low relevance",
  1: "Background only",
}

function CopyButton({ value, label = "Copy" }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          // Clipboard access can be denied by the browser; fail silently.
        }
      }}
      className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-ink-900 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      {copied ? <span className="text-3xs font-semibold text-emerald-600">✓</span> : <CopyIcon className="h-4 w-4" />}
    </button>
  )
}

// Right-side slide-over rather than a routed page — the list stays
// mounted and scrolled to where it was underneath, so opening a signal to
// read the full summary doesn't cost the "at a glance, scan many" value
// the rest of the dashboard is built around. Deep-linkable via ?signal=.
function SignalDetailPanel({
  item,
  open,
  onClose,
  onToggleReviewed,
  relatedItems,
  onSelectRelated,
  companies = [],
  hiringSignals = [],
  marketData = null,
}) {
  const [find, setFind] = useState("")
  const [findOpen, setFindOpen] = useState(false)
  const [activeMatch, setActiveMatch] = useState(0)
  const bodyRef = useRef(null)
  const { profile: myCompany } = useMyCompany()

  useEffect(() => {
    function onKey(e) {
      if (!open) return
      if (e.key === "Escape") {
        if (findOpen) {
          setFindOpen(false)
          setFind("")
          return
        }
        onClose()
      }
      // ⌘F inside the drawer opens the in-document find rather than the
      // browser's, which can't see past the overlay usefully.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault()
        setFindOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose, findOpen])

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  // Reset the find state when the drawer switches to a different signal,
  // otherwise a stale match index points into the previous document.
  useEffect(() => {
    setActiveMatch(0)
  }, [item?.id, find])

  const matchCount = useMemo(() => {
    if (!find.trim() || !item) return 0
    const haystack = `${item.headline} ${item.summary} ${relevanceTierText(item.outreachRelevance ?? null) ?? ""}`
    const escaped = find.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return (haystack.match(new RegExp(escaped, "gi")) ?? []).length
  }, [find, item])

  const scrollToMatch = (index) => {
    const node = bodyRef.current?.querySelector(`[data-find-index="${index}"]`)
    if (node) node.scrollIntoView({ block: "center", behavior: "smooth" })
  }

  const step = (delta) => {
    if (matchCount === 0) return
    const next = (activeMatch + delta + matchCount) % matchCount
    setActiveMatch(next)
    scrollToMatch(next)
  }

  if (!item) return null

  const term = find.trim()
  const counter = { next: 0 }

  const tierText = relevanceTierText(item.outreachRelevance ?? null)
  const reason = buildSignalReason(item, companies)
  const reasonTone = REASON_TONE_STYLES[reason.tone] ?? REASON_TONE_STYLES.neutral
  const Icon = iconForSignal(item)
  const groupTone = toneClassesForSignal(item)
  const matchedCompanies = item.matchedCompanies ?? []
  const account = matchedCompanies[0] ?? item.entity
  const trackedCompany = companies.find((c) => c.companyKey === accountKey(account)) ?? null
  // A competitor is never a sales prospect, so this signal gets a
  // different read entirely — see src/lib/competitorInsights.js. Checked
  // here rather than baked into signalInsights.js so that module can stay
  // entirely about accounts, and this one entirely about vendors.
  const isCompetitor = Boolean(trackedCompany?.isCompetitor)
  const accountLinkProps = linkProps(`/accounts/${encodeURIComponent(accountKey(account))}`)

  const fullText = `${item.headline}\n\n${item.summary}\n\n${item.sourceUrl}`

  return (
    <div className="fixed inset-0 z-50" aria-hidden={!open} style={{ pointerEvents: open ? "auto" : "none" }}>
      <div
        className={`absolute inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.headline}
        className={`absolute inset-y-0 right-0 flex w-full max-w-[520px] flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-spring dark:border-zinc-800 dark:bg-zinc-950 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* The reference drawer opens on a photo with a dark gradient
            wash over it. There is no image in this pipeline — RSS gives
            headlines, not art — so the gradient carries the header on its
            own rather than sitting over a stock photo standing in for
            one. It still does the job the image did: mark where the
            drawer begins and say whose signal this is. */}
        <div className="bg-gradient-brand relative flex flex-shrink-0 items-center gap-3 px-4 py-3.5">
          <AccountAvatar name={account} logoUrl={trackedCompany?.logoUrl} size="sm" />
          <div className="min-w-0 flex-1">
            {/* Competitors are deliberately not linked here — they have
                no entry in deriveAccounts()'s output (Competitors.jsx is
                their page instead), so a link to /accounts/{key} would
                only ever land on "Account not found." */}
            {isCompetitor ? (
              <p className="flex items-center gap-1.5 truncate text-dense font-bold text-white">
                {account}
                <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-3xs font-semibold uppercase tracking-wide text-white">
                  <TargetIcon className="h-2.5 w-2.5" />
                  Competitor
                </span>
              </p>
            ) : (
              <a
                {...accountLinkProps}
                onClick={(e) => {
                  accountLinkProps.onClick(e)
                  if (!e.defaultPrevented) return
                  onClose()
                }}
                className="block truncate text-dense font-bold text-white hover:underline"
              >
                {account}
              </a>
            )}
            <time className="text-xs tabular-nums text-white/70">{formatDate(item.date)}</time>
          </div>
          <button
            type="button"
            onClick={() => setFindOpen((v) => !v)}
            aria-label="Find in this signal"
            aria-pressed={findOpen}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
              findOpen ? "bg-white/25 text-white" : "text-white/70 hover:bg-white/15 hover:text-white"
            }`}
          >
            <SearchIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/15 hover:text-white"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex items-start gap-3">
            <IconBadge icon={Icon} tone={groupTone.badge} className="mt-0.5" />
            <h2 className="text-[17px] font-bold leading-snug text-ink-900 dark:text-zinc-50">
              {markMatches(item.headline, term, counter)}
            </h2>
          </div>

          <p className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${reasonTone.text}`}>
            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${reasonTone.dot}`} aria-hidden="true" />
            {reason.label}
          </p>
          <p className="mt-1.5 text-dense leading-relaxed text-body-600 dark:text-zinc-300">
            <span className="font-bold text-ink-900 dark:text-zinc-100">Do this:</span> {actionForReason(reason, item)}
          </p>

          {/* Metadata grid — label/value rows rather than a pill soup, so
              Type, Topics, Date and Source are each findable by position. */}
          <dl className="mt-4 space-y-2.5 border-y border-slate-200 py-4 dark:border-zinc-800">
            <div className="flex gap-4">
              <dt className="w-20 flex-shrink-0 text-xs text-body-500 dark:text-zinc-400">Type</dt>
              <dd className="flex flex-wrap gap-1">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold capitalize ${groupTone.pill}`}
                >
                  <Icon className="h-3 w-3" />
                  {item.signalType}
                </span>
                <Pill tone="slate">{groupLabel(groupForSignal(item))}</Pill>
              </dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-20 flex-shrink-0 text-xs text-body-500 dark:text-zinc-400">Relevance</dt>
              <dd>
                <Pill tone={relevanceTone(item.outreachRelevance)}>
                  {item.outreachRelevance ? `${RELEVANCE_LABELS[item.outreachRelevance]} · ${item.outreachRelevance}/5` : "Unscored"}
                </Pill>
              </dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-20 flex-shrink-0 text-xs text-body-500 dark:text-zinc-400">Date</dt>
              <dd className="text-xs tabular-nums text-ink-900 dark:text-zinc-100">{formatDate(item.date)}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-20 flex-shrink-0 text-xs text-body-500 dark:text-zinc-400">Source</dt>
              <dd>
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline dark:text-brand-400"
                >
                  {domainFromUrl(item.sourceUrl)}
                  <ExternalLinkIcon className="h-3 w-3" />
                </a>
              </dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-20 flex-shrink-0 text-xs text-body-500 dark:text-zinc-400">Origin</dt>
              <dd>
                <span
                  title={
                    item.origin === "community"
                      ? "Added via community research (last30days), not the standing news pipeline"
                      : item.origin === "seed"
                        ? "Loaded from the initial seed set, not a live ingest run"
                        : "Found by the standing daily news pipeline"
                  }
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-semibold capitalize text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {item.origin ?? "news"}
                </span>
              </dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-20 flex-shrink-0 text-xs text-body-500 dark:text-zinc-400">Scope</dt>
              <dd className="flex flex-wrap gap-1">
                <span
                  className={`rounded-full px-2 py-0.5 text-2xs font-semibold capitalize ${pillClassForScope(item.scope)}`}
                >
                  {item.scope}
                </span>
              </dd>
            </div>
          </dl>

          <Collapsible title="Smart Summary" action={<CopyButton value={item.summary} label="Copy summary" />}>
            <p className="text-dense leading-relaxed text-body-600 dark:text-zinc-300">
              {markMatches(item.summary, term, counter)}
            </p>
          </Collapsible>

          {/* The deeper read. For an account signal: what this class of
              trigger usually means for the account, who feels it, and
              several concrete openers rather than one generic action
              line. For a competitor signal, there is no account and no
              outreach to open — see competitorInsights.js — so the same
              slot instead answers "what does this change about how I
              position" and "what should I watch next." Open by default
              either way — this is the depth the drawer was missing, not
              an optional extra. */}
          {isCompetitor ? (
            <Collapsible title="What This Means For Positioning" defaultOpen>
              <div className="space-y-4">
                <div>
                  <p className="mb-1 text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                    Why it matters
                  </p>
                  <p className="text-dense leading-relaxed text-body-600 dark:text-zinc-300">{positioningRead(item)}</p>
                </div>
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                    <TargetIcon className="h-3.5 w-3.5" />
                    What to watch next
                  </p>
                  <p className="text-dense leading-relaxed text-body-600 dark:text-zinc-300">{competitiveWatch(item)}</p>
                </div>
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                    <LightbulbIcon className="h-3.5 w-3.5" />
                    How this updates your positioning
                  </p>
                  <ul className="space-y-2.5">
                    {differentiationAngles(item).map((a, i) => (
                      <li key={i} className="text-dense leading-relaxed text-body-600 dark:text-zinc-300">
                        <span className="font-bold text-ink-900 dark:text-zinc-100">{a.label}.</span> {a.angle}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Collapsible>
          ) : (
            <Collapsible title="What This Means" defaultOpen>
              <div className="space-y-4">
                <div>
                  <p className="mb-1 text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                    For the account
                  </p>
                  <p className="text-dense leading-relaxed text-body-600 dark:text-zinc-300">{accountImpact(item)}</p>
                </div>
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                    <UsersIcon className="h-3.5 w-3.5" />
                    Who this affects
                  </p>
                  <p className="text-dense leading-relaxed text-body-600 dark:text-zinc-300">{whoThisAffects(item)}</p>
                </div>
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                    <LightbulbIcon className="h-3.5 w-3.5" />
                    Angles to approach with
                  </p>
                  <ul className="space-y-2.5">
                    {outreachAngles(item, trackedCompany?.status ?? null, myCompany?.valueProp).map((a, i) => (
                      <li key={i} className="text-dense leading-relaxed text-body-600 dark:text-zinc-300">
                        <span className="font-bold text-ink-900 dark:text-zinc-100">{a.label}.</span> {a.angle}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Collapsible>
          )}

          {tierText && (
            <Collapsible title={`Why this scored ${item.outreachRelevance}`} defaultOpen={(item.outreachRelevance ?? 0) >= 4}>
              <div className="space-y-2.5">
                <p className="text-dense leading-relaxed text-body-600 dark:text-zinc-300">
                  {scoreMeaning(item.outreachRelevance ?? null)}
                </p>
                <p className="text-dense leading-relaxed text-body-500 dark:text-zinc-400">
                  {markMatches(tierText, term, counter)}
                </p>
              </div>
            </Collapsible>
          )}

          {matchedCompanies.length > 0 && (
            <Collapsible title="Tracked Companies" defaultOpen>
              <dl className="space-y-2 text-dense">
                <div className="flex gap-3">
                  <dt className="w-20 flex-shrink-0 text-body-500 dark:text-zinc-400">Companies</dt>
                  <dd className="text-ink-900 dark:text-zinc-100">{matchedCompanies.join(", ")}</dd>
                </div>
                {trackedCompany?.status && (
                  <div className="flex gap-3">
                    <dt className="w-20 flex-shrink-0 text-body-500 dark:text-zinc-400">Status</dt>
                    <dd className="capitalize text-ink-900 dark:text-zinc-100">{trackedCompany.status}</dd>
                  </div>
                )}
              </dl>
            </Collapsible>
          )}

          {relatedItems.length > 0 && (
            <Collapsible title="Related Signals" defaultOpen={false}>
              <div className="flex flex-col gap-1">
                {relatedItems.map((related) => (
                  <button
                    key={related.id}
                    type="button"
                    onClick={() => onSelectRelated(related.id)}
                    className="flex items-start gap-2 rounded-md px-2 py-1.5 text-left text-dense text-body-600 transition-colors hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800/80"
                  >
                    <time className="flex-shrink-0 text-2xs tabular-nums text-slate-400 dark:text-zinc-500">
                      {formatDate(related.date)}
                    </time>
                    <span className="min-w-0 flex-1">
                      {related.entity !== item.entity && (
                        <span className="font-semibold text-slate-800 dark:text-zinc-200">{related.entity} — </span>
                      )}
                      {related.headline}
                    </span>
                  </button>
                ))}
              </div>
            </Collapsible>
          )}

          <Collapsible title="Hiring & Intent" defaultOpen={hiringSignals.length > 0}>
            {hiringSignals.length > 0 ? (
              <div className="flex flex-col gap-1">
                {hiringSignals.map((signal) => (
                  <a
                    key={signal.id}
                    href={signal.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="group flex items-start gap-2 rounded-md px-2 py-1.5 text-left text-dense text-body-600 transition-colors hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800/80"
                  >
                    <time className="flex-shrink-0 pt-0.5 text-2xs tabular-nums text-slate-400 dark:text-zinc-500">
                      {formatDate(signal.date)}
                    </time>
                    <span className="min-w-0 flex-1">{signal.headline}</span>
                    <ExternalLinkIcon className="mt-0.5 h-3 w-3 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                  </a>
                ))}
              </div>
            ) : (
              <NotIngested
                title="No hiring signals found yet"
                note="Hiring activity for this company (LinkedIn, Seek, Indeed, Glassdoor) isn't connected yet — that needs a one-time setup on my end, so just ask if you want it turned on. It's also possible it's already connected and genuinely found nothing worth reporting this time."
                sources={["LinkedIn (via agent-reach)", "Seek", "Indeed", "Glassdoor"]}
              />
            )}
          </Collapsible>

          <Collapsible title="Market Data" defaultOpen={Boolean(marketData)}>
            {marketData ? (
              <dl className="space-y-2.5">
                <div className="flex gap-4">
                  <dt className="w-28 flex-shrink-0 text-xs text-body-500 dark:text-zinc-400">Price</dt>
                  <dd className="text-xs tabular-nums text-ink-900 dark:text-zinc-100">
                    {marketData.price != null ? `$${Number(marketData.price).toFixed(2)}` : "—"}
                    {marketData.priceChangePct != null && (
                      <span className={`ml-1.5 font-semibold ${marketData.priceChangePct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {marketData.priceChangePct >= 0 ? "+" : ""}
                        {Number(marketData.priceChangePct).toFixed(2)}%
                      </span>
                    )}
                  </dd>
                </div>
                <div className="flex gap-4">
                  <dt className="w-28 flex-shrink-0 text-xs text-body-500 dark:text-zinc-400">Market cap</dt>
                  <dd className="text-xs tabular-nums text-ink-900 dark:text-zinc-100">
                    {marketData.marketCap != null ? `$${Number(marketData.marketCap).toLocaleString()}M` : "—"}
                  </dd>
                </div>
                <div className="flex gap-4">
                  <dt className="w-28 flex-shrink-0 text-xs text-body-500 dark:text-zinc-400">Next earnings</dt>
                  <dd className="text-xs tabular-nums text-ink-900 dark:text-zinc-100">
                    {marketData.nextEarningsDate ? formatDate(marketData.nextEarningsDate) : "Not scheduled"}
                  </dd>
                </div>
                <div className="flex gap-4">
                  <dt className="w-28 flex-shrink-0 text-xs text-body-500 dark:text-zinc-400">Ticker</dt>
                  <dd className="text-xs text-ink-900 dark:text-zinc-100">
                    {marketData.ticker}
                    {marketData.exchange && <span className="text-body-500 dark:text-zinc-400"> · {marketData.exchange}</span>}
                  </dd>
                </div>
              </dl>
            ) : trackedCompany?.stockTicker ? (
              <NotIngested
                title="No market data yet"
                note={`A stock ticker (${trackedCompany.stockTicker}) is set for this company, but the daily ingest run hasn't fetched its market data yet — check back after the next run.`}
                sources={["Finnhub"]}
              />
            ) : (
              <NotIngested
                title="No stock ticker set"
                note="Stock price, market cap, and earnings context only ever apply to a publicly listed company. Add a stock ticker on the Accounts page (Track a Company, or edit an existing tracked company) to start pulling this."
                sources={["Finnhub"]}
              />
            )}
          </Collapsible>
        </div>

        {findOpen && (
          <div className="flex flex-shrink-0 items-center gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
            <SearchIcon className="h-4 w-4 flex-shrink-0 text-slate-400 dark:text-zinc-500" />
            <input
              type="text"
              autoFocus
              value={find}
              onChange={(e) => setFind(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") step(e.shiftKey ? -1 : 1)
              }}
              placeholder="Find in this signal"
              className="min-w-0 flex-1 bg-transparent text-dense text-ink-900 outline-none placeholder:text-slate-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            <span className="flex-shrink-0 text-xs tabular-nums text-body-500 dark:text-zinc-400">
              {matchCount === 0 ? (term ? "0/0" : "") : `${activeMatch + 1}/${matchCount}`}
            </span>
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={matchCount === 0}
              aria-label="Previous match"
              className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={matchCount === 0}
              aria-label="Next match"
              className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
              aria-label="Back to top"
              className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <ArrowUpIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="flex flex-shrink-0 items-center gap-2 border-t border-slate-200 px-4 py-3 dark:border-zinc-800">
          <CopyButton value={fullText} label="Copy signal" />
          <button
            type="button"
            onClick={() => onToggleReviewed(item.id)}
            className={`rounded-full border px-4 py-2 text-dense font-semibold transition-colors ${
              item.reviewed
                ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                : "border-slate-200 text-slate-600 hover:border-slate-300 hover:text-ink-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
            }`}
          >
            {item.reviewed ? "Reviewed" : "Mark Reviewed"}
          </button>
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-navy-900 px-4 py-2 text-dense font-semibold text-white transition-colors hover:bg-navy-800 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            Open source
            <ExternalLinkIcon className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  )
}

export default SignalDetailPanel
