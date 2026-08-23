import { useMemo } from "react"
import { linkProps, navigate } from "../lib/router.js"
import { deriveAccounts } from "../lib/accountModel.js"
import { deriveCompetitors } from "../lib/competitorModel.js"
import { iconForSignal, toneClassesForSignal } from "../lib/signalGroups.js"
import { pillClassForSignalType } from "../lib/colors.js"
import { HIGH_RELEVANCE_THRESHOLD } from "../lib/relevance.js"
import {
  PageHeader,
  Card,
  Button,
  Pill,
  ScoreBadge,
  AccountAvatar,
  SectionTitle,
  EmptyState,
  Eyebrow,
  GradientText,
  IconBadge,
  LiveDot,
  StatTile,
} from "../components/ui.jsx"
import { RadarIcon, ChartIcon, LightbulbIcon, PersonPlusIcon, ChevronRightIcon, TargetIcon } from "../components/icons.jsx"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function formatDate(dateString) {
  if (!dateString) return "—"
  const [year, month, day] = dateString.split("-").map(Number)
  return `${String(day).padStart(2, "0")} ${MONTHS[month - 1]} ${year}`
}

function relativeHours(timestamp) {
  if (!timestamp) return null
  const hours = Math.floor((Date.now() - new Date(timestamp).getTime()) / 3_600_000)
  if (hours < 1) return "under an hour ago"
  if (hours === 1) return "1 hour ago"
  if (hours < 48) return `${hours} hours ago`
  return `${Math.floor(hours / 24)} days ago`
}

// What actually runs behind this dashboard, described as what it does
// rather than dressed up as a product feature. Two of the three stages
// are real and running; the third isn't built, and says so rather than
// showing a fake "active" light — a status pill is only worth having if
// it can read false.
const AGENT_TONES = {
  live: { badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  partial: { badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", pill: "amber", label: "Partial" },
  planned: { badge: "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400", pill: "slate", label: "Not built" },
}

function AgentCard({ icon: Icon, name, role, status, detail, tone }) {
  const config = AGENT_TONES[tone] ?? AGENT_TONES.planned

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-3">
        <IconBadge icon={Icon} tone={config.badge} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-bold text-ink-900 dark:text-zinc-50">{name}</h3>
          <p className="text-[12px] text-body-500 dark:text-zinc-400">{role}</p>
        </div>
        {/* "Running" is the one state that earns a pulsing dot rather than
            a static pill: it is a claim about right now. */}
        {tone === "live" ? <LiveDot label="Running" title="This stage runs on the daily cron" /> : (
          <Pill tone={config.pill}>{config.label}</Pill>
        )}
      </div>
      <p className="text-[12.5px] leading-relaxed text-body-500 dark:text-zinc-400">{detail}</p>
      {status && <p className="mt-2 text-[12.5px] font-semibold text-body-600 dark:text-zinc-300">{status}</p>}
    </Card>
  )
}

function Radar({ signals, companies = [], syncStatus, onOpenSignal, loading }) {
  const accounts = useMemo(() => deriveAccounts(signals, companies), [signals, companies])
  const competitors = useMemo(() => deriveCompetitors(signals, companies), [signals, companies])

  const priorities = useMemo(() => accounts.filter((a) => a.highRelevanceCount > 0).slice(0, 8), [accounts])

  const thisWeek = useMemo(() => {
    const cutoff = new Date()
    cutoff.setHours(0, 0, 0, 0)
    cutoff.setDate(cutoff.getDate() - 7)
    return signals.filter((s) => new Date(`${s.date}T00:00:00`) >= cutoff)
  }, [signals])

  const highThisWeek = thisWeek.filter((s) => (s.outreachRelevance ?? 0) >= HIGH_RELEVANCE_THRESHOLD)
  const unreviewed = signals.filter((s) => !s.reviewed).length
  const competitorMovesThisWeek = useMemo(() => {
    const cutoff = new Date()
    cutoff.setHours(0, 0, 0, 0)
    cutoff.setDate(cutoff.getDate() - 7)
    return competitors.reduce(
      (sum, c) => sum + c.signals.filter((s) => new Date(`${s.date}T00:00:00`) >= cutoff).length,
      0,
    )
  }, [competitors])

  const lastRun = syncStatus?.finishedAt ?? syncStatus?.startedAt ?? syncStatus?.createdAt ?? null
  const runAgo = relativeHours(lastRun)

  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow>What the pipeline found</Eyebrow>}
        title={
          <>
            Your <GradientText>Radar</GradientText>
          </>
        }
        subtitle="A running read on what already happened — the pipeline stages below, the signals they scored, and the accounts that came out on top."
      />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Signals this week", value: thisWeek.length, tone: "ink" },
          { label: "Worth acting on", value: highThisWeek.length, tone: "brand" },
          { label: "Accounts in play", value: accounts.length, tone: "ink" },
          { label: "Unreviewed", value: unreviewed, tone: "ink" },
        ].map((tile) => (
          <StatTile key={tile.label} label={tile.label} value={tile.value} tone={tile.tone} />
        ))}
      </div>

      <SectionTitle hint="The pipeline stages behind this dashboard, described as what they actually do.">
        Pipeline
      </SectionTitle>
      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AgentCard
          icon={RadarIcon}
          name="Scan"
          role="Detects buying signals"
          tone="live"
          detail="Queries the news for every company you're tracking, dedupes against existing rows, and inserts what's new. Runs on a schedule."
          status={runAgo ? `Last run ${runAgo}` : "Waiting for first run"}
        />
        <AgentCard
          icon={ChartIcon}
          name="Score"
          role="Scores and matches"
          tone="live"
          detail="Normalizes each new item into the schema via Claude, scores it 1–5 on the outreach-relevance rubric, and matches it against your tracked companies list."
          status={`${signals.length} signals scored and matched`}
        />
        <AgentCard
          icon={PersonPlusIcon}
          name="Draft"
          role="Drafts personalized outreach"
          tone="planned"
          detail="Nothing in this deployment drafts outreach yet — the account brief and discovery questions are as far as it goes. Wiring this up means an endpoint that takes a signal plus a persona and returns a draft."
        />
      </div>

      <SectionTitle hint="Companies you've flagged as competitors — a quick pointer to the full Competitor Intelligence page.">
        On Your Radar
      </SectionTitle>
      <Card className="mb-8 flex flex-wrap items-center gap-4 p-5">
        <IconBadge icon={TargetIcon} tone="bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400" size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-ink-900 dark:text-zinc-50">
            {competitorMovesThisWeek} competitor {competitorMovesThisWeek === 1 ? "move" : "moves"} this week
          </p>
          <p className="mt-0.5 text-[12.5px] text-body-500 dark:text-zinc-400">
            What the companies you compete with have been up to — for keeping your positioning current, not for outreach.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/competitors")}>
          Open Competitor Intelligence
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </Card>

      <SectionTitle hint="Accounts with at least one high-relevance signal, ranked by account score.">
        Top Priorities
      </SectionTitle>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-zinc-800/60" />
          ))}
        </div>
      ) : priorities.length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing clears the bar right now"
            description="No account currently has a high-relevance signal. The full feed is still worth a scan."
            action={
              <Button variant="primary" onClick={() => navigate("/feed")}>
                Open Global Feed
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {priorities.map((account) => {
            const lead = account.signals.find(
              (s) => (s.outreachRelevance ?? 0) >= HIGH_RELEVANCE_THRESHOLD,
            )
            const Icon = lead ? iconForSignal(lead) : LightbulbIcon
            const leadTone = lead ? toneClassesForSignal(lead) : null
            return (
              <Card key={account.key} className="p-4 transition-colors hover:border-brand-300 dark:hover:border-brand-500/40">
                <div className="flex flex-wrap items-start gap-3">
                  <AccountAvatar name={account.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        {...linkProps(`/accounts/${encodeURIComponent(account.key)}`)}
                        className="text-[14px] font-bold text-ink-900 hover:text-brand-600 dark:text-zinc-50 dark:hover:text-brand-400"
                      >
                        {account.name}
                      </a>
                      {account.status && (
                        <Pill tone={account.status === "customer" ? "emerald" : "brand"}>
                          {account.status === "customer" ? "Customer" : "Prospect"}
                        </Pill>
                      )}
                    </div>

                    {lead && (
                      <button
                        type="button"
                        onClick={() => onOpenSignal(lead.id)}
                        className="mt-2.5 flex w-full items-start gap-2.5 text-left"
                      >
                        <IconBadge icon={Icon} tone={leadTone.badge} size="sm" className="mt-0.5" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold text-ink-900 dark:text-zinc-200">
                            {lead.headline}
                          </span>
                          <span className="mt-0.5 block line-clamp-2 text-[12px] text-body-500 dark:text-zinc-400">
                            {lead.summary}
                          </span>
                          <span className="mt-1.5 inline-flex">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${pillClassForSignalType(lead.signalType)}`}
                            >
                              {lead.signalType}
                            </span>
                          </span>
                        </span>
                        <span className="flex-shrink-0 text-[12px] tabular-nums text-slate-400 dark:text-zinc-500">
                          {formatDate(lead.date)}
                        </span>
                      </button>
                    )}
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-2">
                    <ScoreBadge score={account.score} />
                    <a
                      {...linkProps(`/accounts/${encodeURIComponent(account.key)}`)}
                      aria-label={`Open ${account.name}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-ink-900 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    >
                      <ChevronRightIcon className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}

export default Radar
