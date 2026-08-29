import { groupForSignal, groupLabel } from "./signalGroups.js"
import { HIGH_RELEVANCE_THRESHOLD, REGULATORY_SIGNAL_TYPES } from "./relevance.js"
import { companyKey } from "../../shared/companyKey.js"

// The account layer.
//
// This pipeline is signal-centric, not account-centric: signals are
// primary and accounts are a derived tag. Every signal already carries
// matchedCompanies (a hit against your tracked list) and entity (the
// company or topic it's about), which is everything an account rollup
// needs.
//
// Two kinds of account come out of this:
//
//   tracked   — the signal matched a company on your tracked list.
//   unmanaged — no match, but the signal is micro-scope and names a
//               company. This is whitespace: something worth knowing
//               about that you haven't explicitly added yet, promoted to
//               a first-class row so it can be opened and worked like any
//               other account.
//
// Macro signals ("interest rates rose") name no company and therefore
// produce no account at all — they stay in the feed as market context.

const DAY_MS = 24 * 60 * 60 * 1000

function parseDate(dateString) {
  return new Date(`${dateString}T00:00:00`)
}

export const accountKey = companyKey

// Which account names a signal should be filed under. A tracked-list
// match wins outright. A micro signal with no match still names a company
// worth tracking, so it files under its entity. A macro signal files
// under nothing.
//
// A company flagged as a competitor never files under itself here, even
// on a micro signal, because it isn't a sales prospect — nobody is
// cold-calling a competitor. Without this, every piece of competitor news
// the ingest pipeline collects would show up as a normal account row
// carrying "angles to approach," which makes no sense for a company
// you're never going to sell into. Those signals still exist in the full
// signal set; the Competitors page (src/pages/Competitors.jsx) is where
// they're meant to be read, not here.
function accountNamesFor(signal, competitorKeys) {
  const matched = signal.matchedCompanies ?? []
  if (matched.length) return matched.filter((name) => !competitorKeys.has(accountKey(name)))
  if (signal.scope === "micro" && signal.entity && !competitorKeys.has(accountKey(signal.entity))) {
    return [signal.entity]
  }
  return []
}

// Recency decay: a signal from today counts fully, one from 90 days ago
// counts for almost nothing. Half-life of ~21 days, which lines up with
// how long an outreach trigger stays worth mentioning on a call.
function recencyWeight(date, now) {
  const days = Math.max(0, (now - date) / DAY_MS)
  return Math.pow(0.5, days / 21)
}

// A 0-100 account score.
//
// Three things decide it, in the order a rep would weigh them:
//   relevance (55%) — the best outreach trigger this account has produced,
//                     using the same 1-5 rubric the feed already ranks on
//   recency   (30%) — how warm the account is right now
//   volume    (15%) — sustained activity, capped so one noisy account
//                     can't run away with the top of the table
//
// Deliberately not a black box: scoreBreakdown() returns the three parts
// so the account page can show its working rather than an unexplained
// number.
export function scoreAccount(signals, now = Date.now()) {
  if (!signals.length) return { score: 0, relevance: 0, recency: 0, volume: 0 }

  // Unscored rows count as the neutral mid-tier 3, matching how the feed
  // sort treats them. Scoring them 0 instead would be a statement that
  // the account is a bad prospect, when the truth is only that the row
  // predates relevance scoring.
  const maxRelevance = Math.max(...signals.map((s) => s.outreachRelevance ?? 3))
  const relevance = Math.min(1, maxRelevance / 5)

  const newest = Math.max(...signals.map((s) => parseDate(s.date).getTime()))
  const recency = recencyWeight(newest, now)

  // Weighted by recency so a burst of activity last week counts for more
  // than the same burst last quarter.
  const weighted = signals.reduce((sum, s) => sum + recencyWeight(parseDate(s.date).getTime(), now), 0)
  const volume = Math.min(1, weighted / 8)

  const score = Math.round(100 * (0.55 * relevance + 0.3 * recency + 0.15 * volume))
  return { score: Math.max(0, Math.min(100, score)), relevance, recency, volume }
}

export const PRIORITY_TIERS = [
  { id: "p1", label: "P1", min: 80 },
  { id: "p2", label: "P2", min: 55 },
  { id: "p3", label: "P3", min: 25 },
  { id: "none", label: "No Priority", min: 0 },
]

export function priorityFor(score) {
  return PRIORITY_TIERS.find((tier) => score >= tier.min) ?? PRIORITY_TIERS[PRIORITY_TIERS.length - 1]
}

// The plain-English rollup under an account's name in the feed. Built
// from the groups actually present rather than a template, and capped at
// three clauses so a busy account doesn't produce a paragraph.
export function rollupSentence(signals) {
  if (!signals.length) return "No recent signals"

  const counts = new Map()
  for (const signal of signals) {
    const id = groupForSignal(signal)
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }

  const phrases = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => {
      const label = groupLabel(id).toLowerCase()
      return count === 1 ? `1 ${label} signal` : `${count} ${label} signals`
    })

  if (phrases.length === 1) return capitalize(phrases[0])
  if (phrases.length === 2) return capitalize(`${phrases[0]} and ${phrases[1]}`)
  return capitalize(`${phrases[0]}, ${phrases[1]}, and ${phrases[2]}`)
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

// "3 days ago" / "today" / "2 months ago" — deliberately its own small
// helper rather than reusing Radar.jsx's relativeHours or
// SyncStatus.jsx's formatRelativeTime: both of those are built for a
// "how fresh is the sync" reading (hours matter), this one reads in
// days/weeks/months since it's describing a signal that could be months
// old. Not worth generalizing a third pattern into one shared function
// for a one-line difference in granularity.
function relativeDays(dateString, now) {
  const days = Math.floor((now - parseDate(dateString).getTime()) / DAY_MS)
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 30) return `${days} days ago`
  if (days < 60) return "about a month ago"
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)}+ years ago`
}

// The single most relevant, most recent signal — deliberately just one,
// not a synthesis of several. This is the terse "why now" line: a
// glanceable reason to look, not a summary. rollupSentence() (above)
// already covers "give me the fuller category breakdown" and is meant
// to sit behind a hover hint next to this, not be replaced by it.
export function whyNowLine(signals, now = Date.now()) {
  if (!signals.length) return "No signals yet"

  const best = [...signals].sort((a, b) => {
    const relevanceDiff = (b.outreachRelevance ?? 3) - (a.outreachRelevance ?? 3)
    if (relevanceDiff !== 0) return relevanceDiff
    return a.date < b.date ? 1 : -1
  })[0]

  const label = groupLabel(groupForSignal(best))
  return `${label} · ${relativeDays(best.date, now)}`
}

// Turns the three score components into up to 3 concrete "elevators"
// (real reasons this account is worth acting on) and up to 2 "reductors"
// (real reasons to hesitate) — plain-English, not a repeat of the raw
// percentages already shown next to this. Every line traces back to a
// real signal or a real, checkable fact about this account; nothing is
// templated to fill a slot that has nothing behind it — an account with
// no genuine reductor shows none, rather than a manufactured one.
export function scoreReasons(signals, breakdown, now = Date.now()) {
  const elevators = [...signals]
    .filter((s) => (s.outreachRelevance ?? 0) >= HIGH_RELEVANCE_THRESHOLD)
    .sort((a, b) => (b.outreachRelevance ?? 0) - (a.outreachRelevance ?? 0) || (a.date < b.date ? 1 : -1))
    .slice(0, 3)
    .map((s) => `${groupLabel(groupForSignal(s))} — ${s.headline}`)

  const reductorSignals = [...signals]
    .filter((s) => REGULATORY_SIGNAL_TYPES.has(s.signalType))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 2)
    .map((s) => `${groupLabel(groupForSignal(s))} — ${s.headline}`)

  const reductors = [...reductorSignals]

  // Only added when there's room left and the fact is real — never pads
  // reductors past 2 total, and never states staleness/thinness for an
  // account that isn't actually stale/thin.
  if (reductors.length < 2 && breakdown.recency < 0.3 && signals.length) {
    const newest = signals.reduce((latest, s) => (s.date > latest ? s.date : latest), signals[0].date)
    reductors.push(`No new signals in ${relativeDays(newest, now)}`)
  }
  if (reductors.length < 2 && breakdown.volume < 0.2) {
    reductors.push(signals.length === 1 ? "Only 1 signal on record" : `Only ${signals.length} signals on record`)
  }

  return { elevators, reductors: reductors.slice(0, 2) }
}

// Weekly signal counts over the last 8 weeks, plus the % change between
// the last 30 days and the 30 days before that — "is this account
// heating up or cooling off," not just "how many signals." `changePct`
// is null when the prior period had zero signals (a percentage off a
// zero base is meaningless, not just large) — direction "new" covers
// that case instead of a nonsensical +Infinity%.
export function signalTrend(signals, now = Date.now()) {
  const WEEK_MS = 7 * DAY_MS
  const weeklyCounts = Array(8).fill(0)
  for (const signal of signals) {
    const ageMs = now - parseDate(signal.date).getTime()
    const weekIndex = 7 - Math.floor(ageMs / WEEK_MS)
    if (weekIndex >= 0 && weekIndex < 8) weeklyCounts[weekIndex] += 1
  }

  const THIRTY_DAYS_MS = 30 * DAY_MS
  let last30 = 0
  let prior30 = 0
  for (const signal of signals) {
    const ageMs = now - parseDate(signal.date).getTime()
    if (ageMs < THIRTY_DAYS_MS) last30 += 1
    else if (ageMs < THIRTY_DAYS_MS * 2) prior30 += 1
  }

  if (prior30 === 0) {
    return { weeklyCounts, changePct: null, direction: last30 > 0 ? "new" : "flat" }
  }

  const changePct = Math.round(((last30 - prior30) / prior30) * 100)
  const direction = changePct > 5 ? "up" : changePct < -5 ? "down" : "flat"
  return { weeklyCounts, changePct, direction }
}

// Builds the full account list from a signal array plus your tracked
// companies. `companies` is the array from useCompanies() — used to know
// which matched names are competitors (excluded here, see
// accountNamesFor) and to carry each tracked company's status/note onto
// its account row.
export function deriveAccounts(signals, companies = [], now = Date.now()) {
  const competitorKeys = new Set(companies.filter((c) => c.isCompetitor).map((c) => c.companyKey))
  const companiesByKey = new Map(companies.map((c) => [c.companyKey, c]))

  const byKey = new Map()

  for (const signal of signals) {
    for (const name of accountNamesFor(signal, competitorKeys)) {
      const key = accountKey(name)
      if (!key) continue

      let account = byKey.get(key)
      if (!account) {
        account = { key, name, signals: [], tracked: false }
        byKey.set(key, account)
      }

      account.signals.push(signal)

      // A tracked-list match anywhere upgrades the account, and the
      // tracked company's own name wins over an entity string scraped
      // from a headline — "CBA" and "Commonwealth Bank of Australia"
      // should present under one name.
      if ((signal.matchedCompanies ?? []).includes(name)) {
        account.tracked = true
        account.name = name
      }
    }
  }

  return [...byKey.values()]
    .map((account) => {
      const sorted = [...account.signals].sort((a, b) => (a.date < b.date ? 1 : -1))
      const breakdown = scoreAccount(sorted, now)
      const highRelevanceCount = sorted.filter(
        (s) => (s.outreachRelevance ?? 0) >= HIGH_RELEVANCE_THRESHOLD,
      ).length
      const tracked = companiesByKey.get(account.key) ?? null

      // "Managed" has to mean "is this company on my tracked list right
      // now" — the live truth, `tracked` above (a real row in
      // tracked_companies). account.tracked (set in the loop above) is a
      // narrower, historical signal: whether some signal's
      // matched_companies happened to include this name, which is fixed
      // at ingest time. Adding a company after its signals already
      // existed left matched_companies empty on those older rows
      // forever — a company you'd just tracked would show "Mine" (from
      // isClaimed, which checks the live list directly) right next to
      // "Not tracked" in the banner (from the old account.tracked-only
      // check) until the next ingest run happened to re-match it. Either
      // signal being true is enough to call an account managed now.
      const managed = account.tracked || tracked !== null

      return {
        key: account.key,
        name: tracked?.companyName ?? account.name,
        signals: sorted,
        signalCount: sorted.length,
        highRelevanceCount,
        unreviewedCount: sorted.filter((s) => !s.reviewed).length,
        status: tracked?.status ?? (managed ? "prospect" : null),
        note: tracked?.note ?? null,
        managed,
        // Company-snapshot fields (api/_lib/companyProfile.js) — only a
        // tracked company can have one, since that's the only time it
        // gets fetched. Untracked/derived accounts carry nulls, same as
        // status/note above.
        logoUrl: tracked?.logoUrl ?? null,
        domain: tracked?.domain ?? null,
        industry: tracked?.industry ?? null,
        description: tracked?.description ?? null,
        businessModel: tracked?.businessModel ?? null,
        offerings: tracked?.offerings ?? [],
        headquarters: tracked?.headquarters ?? null,
        employeeCount: tracked?.employeeCount ?? null,
        employeeGrowth: tracked?.employeeGrowth ?? null,
        foundedYear: tracked?.foundedYear ?? null,
        firstSeen: sorted[sorted.length - 1]?.date ?? null,
        lastSignalDate: sorted[0]?.date ?? null,
        score: breakdown.score,
        scoreBreakdown: breakdown,
        priority: priorityFor(breakdown.score),
        rollup: rollupSentence(sorted),
        reasons: scoreReasons(sorted, breakdown, now),
        trend: signalTrend(sorted, now),
        whyNow: whyNowLine(sorted, now),
      }
    })
    .sort((a, b) => b.score - a.score || b.signalCount - a.signalCount)
}

export function findAccount(accounts, key) {
  return accounts.find((account) => account.key === key) ?? null
}
