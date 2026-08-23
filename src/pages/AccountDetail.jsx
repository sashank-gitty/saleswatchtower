import { useMemo, useState } from "react"
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
import { Citations } from "../components/Citation.jsx"
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
} from "../components/icons.jsx"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function formatDate(dateString) {
  if (!dateString) return "—"
  const [year, month, day] = dateString.split("-").map(Number)
  return `${String(day).padStart(2, "0")} ${MONTHS[month - 1]} ${year}`
}

const OPPORTUNITY_GROUPS = new Set(["earnings", "funding", "transformation"])

const TABS = [
  { id: "facts", label: "Fast Facts" },
  { id: "summary", label: "Summary" },
  { id: "signals", label: "Signals" },
  { id: "value", label: "Value" },
  { id: "custom", label: "Custom" },
  { id: "research", label: "Research" },
  { id: "contacts", label: "Contacts" },
  { id: "tech", label: "Tech" },
]

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
          <span className="text-[11px] font-semibold tabular-nums text-slate-400 dark:text-zinc-500">{count}</span>
        )}
      </div>
      {children}
    </section>
  )
}

function EmptyLine({ children }) {
  return <p className="text-[13px] leading-relaxed text-body-500 dark:text-zinc-400">{children}</p>
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      {Icon && <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400 dark:text-zinc-500" />}
      <span className="text-[13px] text-body-500 dark:text-zinc-400">{label}</span>
      <span className="ml-auto text-right text-[13px] font-semibold text-ink-900 dark:text-zinc-100">{value}</span>
    </div>
  )
}

function AccountDetail({ account, onOpenSignal, loading, isClaimed, claimedAt, onToggleClaim }) {
  const [tab, setTab] = useState("summary")
  const [group, setGroup] = useState("all")

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
        className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-slate-500 transition-colors hover:text-ink-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Accounts
      </a>

      {/* Gradient identity banner, then the pills, then the sticky tab
          rail. Splitting the three means the banner can be as loud as it
          likes (it only renders once, at the top) while the rail that
          actually has to stay put while you scroll stays quiet and thin. */}
      <GradientBanner
        tile={initialsFor(account.name)}
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
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-white/70">Score</span>
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
              {isClaimed?.(account.key) ? "In My Accounts" : "Add to My Accounts"}
            </Button>
          )}
          <Button variant="secondary" onClick={() => window.location.reload()}>
            <RefreshIcon className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="sticky top-14 z-20 -mx-4 mb-5 mt-3 border-b border-slate-200 bg-page/90 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 dark:border-zinc-800 dark:bg-zinc-950/90">
        <SubNav tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {tab === "facts" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <Card className="p-5">
              <SectionTitle hint="Signals bucketed by how recently they landed, so a warming account reads differently from a cooling one.">
                Signal Timeline
              </SectionTitle>
              <div className="space-y-4">
                {buckets.map((bucket) => (
                  <div key={bucket.id}>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                      {bucket.label}
                    </p>
                    <ul className="space-y-1">
                      {bucket.signals.map((signal) => (
                        <li key={signal.id}>
                          <button
                            type="button"
                            onClick={() => onOpenSignal(signal.id)}
                            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[12.5px] text-body-600 transition-colors hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800/40"
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
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <SectionTitle>Signal Mix</SectionTitle>
              <div className="space-y-2">
                {distribution.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3">
                    <span className="w-40 flex-shrink-0 truncate text-[12px] text-body-600 dark:text-zinc-300">
                      {entry.label}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                      <div
                        className={`h-full rounded-full ${toneClassesForGroup(entry.id).dot}`}
                        style={{ width: `${Math.max(4, entry.share * 100)}%` }}
                      />
                    </div>
                    <span className="w-8 flex-shrink-0 text-right text-[12px] tabular-nums text-body-500 dark:text-zinc-400">
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

      {tab === "summary" && (
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
                          <p className="text-[13px] leading-relaxed text-body-600 dark:text-zinc-300">
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
                          <p className="mt-1.5 text-[12px] leading-relaxed text-body-500 dark:text-zinc-400">
                            {accountImpact(insight.signals[0])}
                          </p>
                          {angle && (
                            <p className="mt-1.5 text-[12px] leading-relaxed text-body-500 dark:text-zinc-400">
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
                      <li key={signal.id} className="text-[13px] leading-relaxed text-body-600 dark:text-zinc-300">
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
                      <li key={signal.id} className="text-[13px] leading-relaxed text-body-600 dark:text-zinc-300">
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
                      <li key={signal.id} className="text-[13px] leading-relaxed text-body-600 dark:text-zinc-300">
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
                      <li key={signal.id} className="text-[13px] leading-relaxed text-body-600 dark:text-zinc-300">
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
                    <span className="block text-[13px] font-semibold text-ink-900 dark:text-zinc-100">
                      {signal.headline}
                    </span>
                    <span className="mt-0.5 block line-clamp-2 text-[12px] text-body-500 dark:text-zinc-400">
                      {signal.summary}
                    </span>
                    <span className="mt-1.5 inline-flex">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${pillClassForSignalType(signal.signalType)}`}
                      >
                        {signal.signalType}
                      </span>
                    </span>
                  </span>
                  <span className="flex-shrink-0 text-[12px] tabular-nums text-slate-400 dark:text-zinc-500">
                    {formatDate(signal.date)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === "value" && (
        <Card className="p-5">
          <SectionTitle hint="Signals mapped onto a value framework. Tiers with no matching signals are omitted rather than shown empty.">
            Value Pyramid
          </SectionTitle>
          {pyramid.length === 0 ? (
            <p className="text-[13px] text-body-500 dark:text-zinc-400">
              Not enough signal variety yet to build a value view for this account.
            </p>
          ) : (
            <div className="space-y-6">
              {pyramid.map((tier) => (
                <section key={tier.id} className="border-l-2 border-brand-500 pl-4">
                  <h3 className="text-[15px] font-semibold text-brand-600 dark:text-brand-400">{tier.label}</h3>
                  <p className="mt-0.5 text-[12px] text-body-500 dark:text-zinc-400">{tier.blurb}</p>
                  <ul className="mt-2.5 space-y-2">
                    {tier.items.map((item) => (
                      <li key={item.groupId} className="text-[13px] leading-relaxed text-body-600 dark:text-zinc-300">
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
      )}

      {tab === "custom" && (
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
              <table className="w-full min-w-[720px] text-[13px]">
                <thead className="border-y border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
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

      {tab === "research" && (
        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle hint="How this account's score was calculated. Shown rather than hidden so a low score can be argued with.">
              Score Breakdown
            </SectionTitle>
            <div className="mb-4 flex items-center gap-3">
              <ScoreBadge score={account.score} size="lg" />
              <div>
                <p className="text-[13px] font-medium text-ink-900 dark:text-zinc-100">
                  {account.score} / 100 &middot; {account.priority.label}
                </p>
                <p className="text-[12px] text-body-500 dark:text-zinc-400">
                  Weighted: relevance 55%, recency 30%, volume 15%
                </p>
              </div>
            </div>
            <div className="space-y-2.5">
              {[
                { label: "Best outreach trigger (relevance)", value: account.scoreBreakdown.relevance, weight: "55%" },
                { label: "How warm right now (recency)", value: account.scoreBreakdown.recency, weight: "30%" },
                { label: "Sustained activity (volume)", value: account.scoreBreakdown.volume, weight: "15%" },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="w-56 flex-shrink-0 text-[12px] text-body-600 dark:text-zinc-300">{row.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${Math.max(2, row.value * 100)}%` }}
                    />
                  </div>
                  <span className="w-16 flex-shrink-0 text-right text-[12px] tabular-nums text-body-500 dark:text-zinc-400">
                    {Math.round(row.value * 100)}% &times; {row.weight}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle>All Sources</SectionTitle>
            <ul className="space-y-1.5">
              {account.signals.map((signal) => (
                <li key={signal.id} className="flex items-baseline gap-2 text-[13px]">
                  <span className="w-6 flex-shrink-0 text-right text-[11px] font-semibold tabular-nums text-slate-400 dark:text-zinc-500">
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
                  <span className="ml-auto flex-shrink-0 text-[11px] tabular-nums text-slate-400 dark:text-zinc-500">
                    {formatDate(signal.date)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {tab === "contacts" && (
        <NotIngested
          title="Contacts — not available from this pipeline"
          note="The reference product resolves buying-group contacts and tracks job moves. This pipeline has no people data at all — it ingests company-level news only. Populating this would mean wiring a contact source into ingest, e.g. a ZoomInfo or Lusha connector."
          sources={["ZoomInfo contact search", "Lusha buying-group search", "LinkedIn Sales Navigator"]}
        />
      )}

      {tab === "tech" && (
        <NotIngested
          title="Account Technologies — not available from this pipeline"
          note="The reference product infers an account's tech stack from job postings that name tools. This pipeline ingests no job postings, so there is no evidence base to build a stack from. Inferring one from news headlines would be guesswork presented as fact about a real company's infrastructure."
          sources={["Job posting feeds", "BuiltWith / HG Insights", "ZoomInfo technographics"]}
        />
      )}
    </>
  )
}

export default AccountDetail
