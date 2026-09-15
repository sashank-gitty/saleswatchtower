import { useMemo, useState } from "react"
import { linkProps } from "../lib/router.js"
import { SIGNAL_GROUPS, countByGroup, filterByGroup, iconForSignal } from "../lib/signalGroups.js"
import { pillClassForSignalType } from "../lib/colors.js"
import { accountKey, deriveAccounts } from "../lib/accountModel.js"
import { useAlerts } from "../lib/useAlerts.js"
import { matchesQuery } from "../lib/textMatch.js"
import {
  PageHeader,
  Card,
  Button,
  TabStrip,
  FilterSelect,
  SearchInput,
  EmptyState,
  Modal,
  Field,
  TextInput,
  Radio,
  Toggle,
  Highlight,
  AccountAvatar,
  ScoreBadge,
  PriorityPill,
  SectionTitle,
} from "../components/ui.jsx"
import { AlertIcon } from "../components/icons.jsx"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function formatDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number)
  return `${String(day).padStart(2, "0")} ${MONTHS[month - 1]} ${year}`
}

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "180", label: "Last 6 months" },
]

function CreateAlertModal({ open, onClose, onCreate, query, days, group }) {
  const [name, setName] = useState("")
  const [frequency, setFrequency] = useState("daily")
  const [emailCc, setEmailCc] = useState("")
  const [active, setActive] = useState(true)

  const rangeLabel = RANGE_OPTIONS.find((r) => r.value === days)?.label.toLowerCase() ?? "all time"

  const handleCreate = () => {
    onCreate({ name: name.trim() || query || "Untitled alert", query, days, group, frequency, emailCc, active })
    setName("")
    setEmailCc("")
    setFrequency("daily")
    setActive(true)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Save This Search"
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" className="ml-auto" onClick={handleCreate}>
            Save
          </Button>
        </>
      }
    >
      <div className="mb-5 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/40">
        <AlertIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400 dark:text-zinc-500" />
        <div className="min-w-0">
          <p className="truncate text-dense font-semibold text-ink-900 dark:text-zinc-100">
            {query ? `"${query}"` : "All signals"}
          </p>
          <p className="text-xs text-body-500 dark:text-zinc-400">in the {rangeLabel}</p>
        </div>
      </div>

      <div className="space-y-4">
        <Field label="Search Name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={query || "Untitled search"} />
        </Field>

        <div>
          <p className="mb-1.5 text-xs font-medium text-body-500 dark:text-zinc-400">Digest frequency (for when email delivery ships)</p>
          <div className="space-y-2">
            <Radio name="frequency" value="daily" checked={frequency === "daily"} onChange={setFrequency} label="Daily" />
            <Radio name="frequency" value="weekly" checked={frequency === "weekly"} onChange={setFrequency} label="Weekly" />
          </div>
        </div>

        <Field label="Email CC">
          <TextInput value={emailCc} onChange={(e) => setEmailCc(e.target.value)} placeholder="teammate@example.com" />
        </Field>

        <Toggle checked={active} onChange={setActive} label="Active" />

        {/* Saying this here, at the point of promise, rather than in a
            help page nobody opens. */}
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
          Saved locally to this browser. The query is stored and re-run live on the Saved Searches page &mdash; but no
          email is sent yet: delivery needs a scheduled server job, which doesn&rsquo;t exist in this deployment.
        </p>
      </div>
    </Modal>
  )
}

function Search({ signals, companies = [], logoByKey = new Map(), onOpenSignal }) {
  // Seeded from the URL so a search bar elsewhere (Home) can link
  // straight to a populated result set instead of an empty page.
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get("q") ?? "")
  const [group, setGroup] = useState("all")
  const [days, setDays] = useState("180")
  const [type, setType] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  const { createAlert } = useAlerts()

  // Accounts, not just signals — a real gap this used to have: searching
  // a company with no news yet (or just not enough to have written a
  // matching headline) returned nothing at all, even though the account
  // itself genuinely exists. deriveAccounts() now seeds one for every
  // tracked company regardless of signal count (see accountModel.js), so
  // this is a real, complete list to match names against, not a
  // best-effort subset.
  const accounts = useMemo(() => deriveAccounts(signals, companies, logoByKey), [signals, companies, logoByKey])
  const matchedAccounts = useMemo(() => {
    const needle = query.trim()
    if (!needle) return []
    return accounts
      .filter((a) => matchesQuery(a.name, needle))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
  }, [accounts, query])

  const logoByCompanyKey = useMemo(() => new Map(companies.map((c) => [c.companyKey, c.logoUrl])), [companies])
  const statusByCompanyKey = useMemo(() => new Map(companies.map((c) => [c.companyKey, c.status])), [companies])
  const statusFor = (signal) => {
    for (const name of signal.matchedCompanies ?? []) {
      const status = statusByCompanyKey.get(accountKey(name))
      if (status) return status
    }
    return null
  }

  const matched = useMemo(() => {
    const needle = query.trim()
    const cutoff = new Date()
    cutoff.setHours(0, 0, 0, 0)
    cutoff.setDate(cutoff.getDate() - Number(days))

    const results = signals.filter((signal) => {
      if (new Date(`${signal.date}T00:00:00`) < cutoff) return false
      if (type && statusFor(signal) !== type) return false
      if (needle) {
        // Wider than just headline/summary: entity, matched companies and
        // signal type are also fair game.
        const haystack = [
          signal.headline,
          signal.summary,
          signal.entity,
          ...(signal.matchedCompanies ?? []),
          signal.signalType,
        ].join(" ")
        if (!matchesQuery(haystack, needle)) return false
      }
      return true
    })

    // Without a query the feed's own date-desc order (from /api/signals)
    // is the right read. With one, the strongest, freshest matches
    // belong at the top rather than wherever they happened to sort by
    // date — a 5-year-old signal that happens to be newer than nothing
    // shouldn't outrank a highly relevant one from last week.
    if (needle) {
      results.sort(
        (a, b) => (b.outreachRelevance ?? 0) - (a.outreachRelevance ?? 0) || (a.date < b.date ? 1 : -1),
      )
    }

    return results
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals, query, days, type, companies])

  const counts = useMemo(() => countByGroup(matched), [matched])
  const results = useMemo(() => filterByGroup(matched, group), [matched, group])

  const tabs = useMemo(
    () => [
      { id: "all", label: "All", count: counts.all },
      ...SIGNAL_GROUPS.map((g) => ({ id: g.id, label: g.label, count: counts[g.id] ?? 0 })),
    ],
    [counts],
  )

  const term = query.trim()

  return (
    <>
      <PageHeader
        title="Search"
        actions={
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            <AlertIcon className="h-4 w-4" />
            Save Search
          </Button>
        }
      >
        <div className="space-y-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search headlines, summaries, entities and tracked companies..."
            className="max-w-2xl"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <FilterSelect
              label="Account type"
              value={type}
              onChange={setType}
              options={[
                { value: "customer", label: "Customer" },
                { value: "prospect", label: "Prospect" },
              ]}
            />
            <FilterSelect label="Date range" value={days} onChange={(v) => setDays(v ?? "180")} options={RANGE_OPTIONS} />
          </div>
        </div>
      </PageHeader>

      {matchedAccounts.length > 0 && (
        <div className="mb-5">
          <SectionTitle hint="Companies matching the name, whether or not they have any signals yet.">
            Accounts
          </SectionTitle>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {matchedAccounts.map((account) => (
              <a
                key={account.key}
                {...linkProps(`/accounts/${encodeURIComponent(account.key)}`)}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-brand-300 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-brand-500/40"
              >
                <AccountAvatar name={account.name} logoUrl={account.logoUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-dense font-semibold text-ink-900 dark:text-zinc-100">{account.name}</p>
                  <p className="text-2xs text-body-500 dark:text-zinc-400">
                    {account.signalCount} {account.signalCount === 1 ? "signal" : "signals"}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <PriorityPill priority={account.priority} />
                  <ScoreBadge score={account.score} size="sm" />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="px-4 pt-2">
          <TabStrip tabs={tabs} active={group} onChange={setGroup} />
        </div>

        {results.length === 0 ? (
          <EmptyState
            title={term ? `No signals match "${term}"` : "No signals in this range"}
            description="Try a broader date range, a different group, or clearing the account type filter."
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-zinc-800/70">
            {results.map((signal) => {
              const Icon = iconForSignal(signal)
              const account = (signal.matchedCompanies ?? [])[0] ?? signal.entity
              return (
                <li key={signal.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                  <div className="flex items-start gap-3 px-4 py-3">
                    <AccountAvatar name={account} logoUrl={logoByCompanyKey.get(accountKey(account))} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <a
                          {...linkProps(`/accounts/${encodeURIComponent(accountKey(account))}`)}
                          className="text-dense font-semibold text-slate-900 hover:text-brand-600 dark:text-zinc-100 dark:hover:text-brand-400"
                        >
                          {account}
                        </a>
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-medium ${pillClassForSignalType(signal.signalType)}`}
                        >
                          <Icon className="h-3 w-3" />
                          {signal.signalType}
                        </span>
                        <span className="text-xs tabular-nums text-slate-400 dark:text-zinc-500">
                          {formatDate(signal.date)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenSignal(signal.id)}
                        className="mt-1 block w-full text-left"
                      >
                        <span className="block text-dense font-medium text-slate-800 dark:text-zinc-200">
                          <Highlight text={signal.headline} term={term} />
                        </span>
                        <span className="mt-0.5 block line-clamp-2 text-xs leading-relaxed text-body-500 dark:text-zinc-400">
                          <Highlight text={signal.summary} term={term} />
                        </span>
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <CreateAlertModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={createAlert}
        query={term}
        days={days}
        group={group}
      />
    </>
  )
}

export default Search
