// Daily cron with real-world flakiness (RSS hiccups, a slow Claude call
// timing out the function) — this is the only signal of whether it's
// actually still running, since a quiet day and a dead cron look
// identical from the feed alone.
const STALE_AFTER_HOURS = 36

function formatRelativeTime(date) {
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.round(diffMs / 60000)
  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.round(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.round(diffHours / 24)
  return `${diffDays}d ago`
}

function SyncStatus({ status }) {
  if (!status) return null

  const runAt = new Date(status.runAt)
  const hoursSinceRun = (Date.now() - runAt.getTime()) / 3600000
  const isHealthy = status.status === "success" && hoursSinceRun < STALE_AFTER_HOURS

  const { summary } = status
  const tooltip = [
    `Last ingest run: ${runAt.toLocaleString()}`,
    status.status === "error"
      ? `Failed: ${status.errorMessage ?? "unknown error"}`
      : summary
        ? `${summary.inserted} inserted, ${summary.accountMatched} account-matched, ${summary.errors?.length ?? 0} errors`
        : null,
    summary?.budgetExceeded ? "Monthly Claude API budget reached — rest of this run skipped." : null,
    !isHealthy && status.status === "success" ? "No run in over 36 hours — check the cron." : null,
  ]
    .filter(Boolean)
    .join("\n")

  return (
    <span
      title={tooltip}
      className={`hidden shrink-0 items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium lg:inline-flex ${
        isHealthy
          ? "border-slate-200 text-slate-500 dark:border-zinc-800 dark:text-zinc-400"
          : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${isHealthy ? "bg-emerald-500" : "bg-amber-500"}`}
      />
      Synced {formatRelativeTime(runAt)}
    </span>
  )
}

export default SyncStatus
