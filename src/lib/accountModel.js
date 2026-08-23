import { groupForSignal, groupLabel } from "./signalGroups.js"
import { HIGH_RELEVANCE_THRESHOLD } from "./relevance.js"
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

      return {
        key: account.key,
        name: account.name,
        signals: sorted,
        signalCount: sorted.length,
        highRelevanceCount,
        unreviewedCount: sorted.filter((s) => !s.reviewed).length,
        status: tracked?.status ?? (account.tracked ? "prospect" : null),
        note: tracked?.note ?? null,
        managed: account.tracked,
        firstSeen: sorted[sorted.length - 1]?.date ?? null,
        lastSignalDate: sorted[0]?.date ?? null,
        score: breakdown.score,
        scoreBreakdown: breakdown,
        priority: priorityFor(breakdown.score),
        rollup: rollupSentence(sorted),
      }
    })
    .sort((a, b) => b.score - a.score || b.signalCount - a.signalCount)
}

export function findAccount(accounts, key) {
  return accounts.find((account) => account.key === key) ?? null
}
