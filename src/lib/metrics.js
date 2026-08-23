import { HIGH_RELEVANCE_THRESHOLD } from "./relevance.js"

const RISK_SIGNAL_TYPES = new Set(["regulation", "pain point"])

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function parseItemDate(item) {
  return new Date(`${item.date}T00:00:00`)
}

function daysAgo(n, from) {
  const d = startOfDay(from)
  d.setDate(d.getDate() - n)
  return d
}

// Anchors "today" to the most recent item date so the dashboard reads
// sensibly against this fixture data regardless of when it's viewed.
function latestItemDate(items) {
  if (!items.length) return startOfDay(new Date())
  return items.reduce((max, item) => {
    const d = parseItemDate(item)
    return d > max ? d : max
  }, parseItemDate(items[0]))
}

export function computeMetrics(items) {
  const today = latestItemDate(items)
  const weekStart = daysAgo(6, today)
  const prevWeekStart = daysAgo(13, today)
  const prevWeekEnd = daysAgo(7, today)
  const thirtyDaysAgo = daysAgo(29, today)

  const thisWeek = items.filter((item) => parseItemDate(item) >= weekStart)
  const lastWeek = items.filter(
    (item) => parseItemDate(item) >= prevWeekStart && parseItemDate(item) <= prevWeekEnd,
  )
  const last30 = items.filter((item) => parseItemDate(item) >= thirtyDaysAgo)

  const weekOverWeekDelta = thisWeek.length - lastWeek.length
  const weekOverWeekPct = lastWeek.length === 0
    ? null
    : Math.round((weekOverWeekDelta / lastWeek.length) * 100)

  const riskThisWeek = thisWeek.filter((item) => RISK_SIGNAL_TYPES.has(item.signalType))
  const riskLastWeek = lastWeek.filter((item) => RISK_SIGNAL_TYPES.has(item.signalType))

  const entities = new Set(items.map((item) => item.entity))
  const entitiesThisWeek = new Set(thisWeek.map((item) => item.entity))

  // Daily counts for the last 30 days, oldest first, for sparklines/charts.
  // `risk` is tracked alongside macro/micro so the regulatory KPI tile can
  // draw its own trajectory, not just the all-signals one.
  const dailyBuckets = []
  for (let i = 29; i >= 0; i -= 1) {
    const day = daysAgo(i, today)
    const key = day.toISOString().slice(0, 10)
    dailyBuckets.push({ date: key, macro: 0, micro: 0, total: 0, risk: 0 })
  }
  const bucketIndex = new Map(dailyBuckets.map((b, idx) => [b.date, idx]))
  for (const item of last30) {
    const idx = bucketIndex.get(item.date)
    if (idx === undefined) continue
    dailyBuckets[idx].total += 1
    if (item.scope === "macro") dailyBuckets[idx].macro += 1
    else dailyBuckets[idx].micro += 1
    if (RISK_SIGNAL_TYPES.has(item.signalType)) dailyBuckets[idx].risk += 1
  }

  // The single answer the top of the page leads with: how many signals this
  // week actually clear the bar to reach out on, and which one to open first.
  // Ranked the same way the feed is (relevance, then recency) so "start here"
  // and the feed's first row never disagree.
  const actWorthyThisWeek = thisWeek
    .filter((item) => (item.outreachRelevance ?? 0) >= HIGH_RELEVANCE_THRESHOLD)
    .sort((a, b) => {
      const relDiff = (b.outreachRelevance ?? 0) - (a.outreachRelevance ?? 0)
      if (relDiff !== 0) return relDiff
      return a.date < b.date ? 1 : -1
    })
  const topPrioritySignal = actWorthyThisWeek[0] ?? null

  const entityCounts = new Map()
  for (const item of thisWeek) {
    entityCounts.set(item.entity, (entityCounts.get(item.entity) ?? 0) + 1)
  }
  const topEntity = [...entityCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null

  const signalTypeCounts = new Map()
  for (const item of thisWeek) {
    signalTypeCounts.set(item.signalType, (signalTypeCounts.get(item.signalType) ?? 0) + 1)
  }
  const topSignalType = [...signalTypeCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null

  return {
    today,
    totalSignals: items.length,
    thisWeekCount: thisWeek.length,
    lastWeekCount: lastWeek.length,
    weekOverWeekDelta,
    weekOverWeekPct,
    riskThisWeekCount: riskThisWeek.length,
    riskLastWeekCount: riskLastWeek.length,
    entitiesTracked: entities.size,
    entitiesThisWeek: entitiesThisWeek.size,
    dailyBuckets,
    topEntity,
    topSignalType,
    actWorthyThisWeekCount: actWorthyThisWeek.length,
    topPrioritySignal,
  }
}
