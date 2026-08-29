import { useMemo } from "react"
import { navigate } from "../lib/router.js"
import { useAlerts, matchAlert } from "../lib/useAlerts.js"
import { groupLabel, iconForSignal } from "../lib/signalGroups.js"
import { pillClassForSignalType } from "../lib/colors.js"
import { PageHeader, Card, Button, Pill, Toggle, EmptyState } from "../components/ui.jsx"
import { TrashIcon, AlertIcon } from "../components/icons.jsx"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function formatDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number)
  return `${String(day).padStart(2, "0")} ${MONTHS[month - 1]} ${year}`
}

function AlertCard({ alert, signals, onUpdate, onDelete, onOpenSignal }) {
  const matches = useMemo(() => matchAlert(alert, signals), [alert, signals])
  const recent = matches.slice(0, 3)

  const facets = [
    alert.query ? `"${alert.query}"` : null,
    alert.group && alert.group !== "all" ? groupLabel(alert.group) : null,
    alert.days ? `last ${alert.days} days` : null,
  ].filter(Boolean)

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-ink-900 dark:text-zinc-50">{alert.name}</h3>
            <Pill tone={alert.frequency === "daily" ? "brand" : "slate"}>
              {alert.frequency === "daily" ? "Daily" : "Weekly"}
            </Pill>
            {!alert.active && <Pill tone="slate">Paused</Pill>}
          </div>
          <p className="mt-1 text-xs text-body-500 dark:text-zinc-400">{facets.join(" · ") || "All signals"}</p>
          <p className="mt-0.5 text-2xs text-slate-400 dark:text-zinc-500">
            Created {formatDate(alert.createdAt)}
            {alert.emailCc ? ` · CC ${alert.emailCc}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-lg font-semibold tabular-nums text-ink-900 dark:text-zinc-50">{matches.length}</p>
            <p className="text-2xs text-slate-400 dark:text-zinc-500">matches now</p>
          </div>
          <Toggle checked={alert.active} onChange={(value) => onUpdate(alert.id, { active: value })} />
          <button
            type="button"
            onClick={() => onDelete(alert.id)}
            aria-label={`Delete alert ${alert.name}`}
            className="text-slate-300 transition-colors hover:text-rose-500 dark:text-zinc-600 dark:hover:text-rose-400"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {recent.length > 0 && (
        <ul className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-zinc-800/70 dark:border-zinc-800/70">
          {recent.map((signal) => {
            const Icon = iconForSignal(signal)
            return (
              <li key={signal.id}>
                <button
                  type="button"
                  onClick={() => onOpenSignal(signal.id)}
                  className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/40"
                >
                  <span
                    className={`mt-0.5 inline-flex flex-shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-medium ${pillClassForSignalType(signal.signalType)}`}
                  >
                    <Icon className="h-3 w-3" />
                    {signal.signalType}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-dense text-body-600 dark:text-zinc-200">
                    {signal.headline}
                  </span>
                  <span className="flex-shrink-0 text-xs tabular-nums text-slate-400 dark:text-zinc-500">
                    {formatDate(signal.date)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function Alerts({ signals, onOpenSignal }) {
  const { alerts, updateAlert, deleteAlert } = useAlerts()

  return (
    <>
      <PageHeader
        title="Saved Searches"
        actions={
          <Button variant="primary" onClick={() => navigate("/search")}>
            <AlertIcon className="h-4 w-4" />
            Save a new search
          </Button>
        }
      />

      <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
        <p className="text-dense font-medium text-amber-700 dark:text-amber-400">
          These are saved queries, not notifications &mdash; nothing is emailed to you yet.
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-amber-700/80 dark:text-amber-400/80">
          Each search below re-runs live against the current signal set, so the match count and preview are real. Email
          delivery is not wired up: it needs a scheduled server job with a mail transport, alongside the existing ingest
          cron. Saved searches are also stored per-browser in localStorage, so they don&rsquo;t follow you between devices.
        </p>
      </div>

      {alerts.length === 0 ? (
        <Card>
          <EmptyState
            title="No saved searches"
            description="Run a search, then use Save Search to keep it here with a live match count."
            action={
              <Button variant="primary" onClick={() => navigate("/search")}>
                Go to Search
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              signals={signals}
              onUpdate={updateAlert}
              onDelete={deleteAlert}
              onOpenSignal={onOpenSignal}
            />
          ))}
        </div>
      )}
    </>
  )
}

export default Alerts
