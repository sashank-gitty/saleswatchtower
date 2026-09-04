import { useState } from "react"
import { linkProps } from "../lib/router.js"
import { AccountAvatar, Pill, ScoreBadge } from "./ui.jsx"
import { ChevronDownIcon } from "./icons.jsx"
import SignalRow from "./SignalRow.jsx"

// One account block: a header row carrying the account's identity and
// rollup, then its individual signals nested beneath as dense compact
// rows. The nesting is what makes this different from a flat feed — it
// answers "what is happening at each account" rather than "what happened
// most recently". Collapsed to a 3-signal preview by default — a page
// full of accounts each starting fully expanded defeats the point of
// grouping at all, which is exactly what made this unusable before.
function AccountBlock({ account, signals, companies, onOpenSignal, onToggleReviewed, selectedIds, onToggleSelect }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? signals : signals.slice(0, 3)

  return (
    <div className="border-b border-slate-200 last:border-b-0 dark:border-zinc-800">
      <div className="flex items-start gap-3 bg-section px-4 py-3 dark:bg-zinc-900/40">
        <AccountAvatar name={account.name} logoUrl={account.logoUrl} size="sm" />
        <div className="min-w-0 flex-1">
          {/* Identity on its own line, status pill on the line beneath it
              — kept apart rather than run together so the account name is
              the thing a scan lands on first. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <a
              {...linkProps(`/accounts/${encodeURIComponent(account.key)}`)}
              className="truncate text-dense font-bold text-ink-900 hover:text-brand-600 dark:text-zinc-50 dark:hover:text-brand-400"
            >
              {account.name}
            </a>
            {account.status && (
              <Pill tone={account.status === "customer" ? "emerald" : "brand"}>
                {account.status === "customer" ? "Customer" : "Prospect"}
              </Pill>
            )}
            {!account.managed && <Pill tone="slate">Not tracked</Pill>}
          </div>
          {/* The terse per-account reason to look, not the fuller
              category tally — that's one hover away via the title
              attribute, same "detail on demand" pattern SectionTitle's
              hint icon already uses elsewhere in this app. */}
          <p className="mt-0.5 truncate text-xs text-body-500 dark:text-zinc-400" title={account.rollup}>
            {account.whyNow}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <ScoreBadge score={account.score} size="sm" />
          <Pill tone="slate">
            {signals.length} {signals.length === 1 ? "Signal" : "Signals"}
          </Pill>
        </div>
      </div>

      <div className="flex flex-col gap-1 p-1.5">
        {visible.map((signal) => (
          <SignalRow
            key={signal.id}
            item={signal}
            companies={companies}
            reviewed={signal.reviewed}
            onToggleReviewed={onToggleReviewed}
            onOpen={onOpenSignal}
            selected={selectedIds.has(signal.id)}
            onToggleSelect={onToggleSelect}
            showCheckbox
            compact
            hideEntity
          />
        ))}
      </div>

      {signals.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-center gap-1 px-4 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-ink-900 dark:text-zinc-400 dark:hover:bg-zinc-800/40 dark:hover:text-zinc-100"
        >
          <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          {expanded ? "Show fewer" : `Show all ${signals.length} signals`}
        </button>
      )}
    </div>
  )
}

export default AccountBlock
