import { useMemo, useState } from "react"
import { linkProps } from "../lib/router.js"
import { AccountAvatar, Pill, ScoreBadge, SearchInput } from "./ui.jsx"

// The Command Center rail: every account as one clickable row, search
// filtering the list itself rather than living in the page header. This
// is the whole point of the Accounts tab now — the account you're
// looking at is state the URL carries (/accounts/:key), not a page you
// navigate away from and back to.
function AccountRail({ accounts, selectedKey, className = "" }) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return accounts
    return accounts.filter((a) => a.name.toLowerCase().includes(q))
  }, [accounts, query])

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="border-b border-slate-200 p-3 dark:border-zinc-800">
        <SearchInput value={query} onChange={setQuery} placeholder="Search accounts..." />
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filtered.length === 0 ? (
          <p className="p-4 text-center text-xs text-body-500 dark:text-zinc-500">No accounts match.</p>
        ) : (
          filtered.map((account) => {
            const isSelected = account.key === selectedKey
            return (
              <a
                key={account.key}
                {...linkProps(`/accounts/${encodeURIComponent(account.key)}`)}
                className={`flex items-center gap-2.5 border-l-2 px-3 py-2.5 transition-colors ${
                  isSelected
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                    : "border-transparent hover:bg-slate-50 dark:hover:bg-zinc-900/60"
                }`}
              >
                <AccountAvatar name={account.name} logoUrl={account.logoUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-dense font-semibold text-ink-900 dark:text-zinc-50">{account.name}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {account.status && (
                      <Pill tone={account.status === "customer" ? "emerald" : "brand"}>
                        {account.status === "customer" ? "Customer" : "Prospect"}
                      </Pill>
                    )}
                    {!account.managed && <Pill tone="slate">Not tracked</Pill>}
                  </div>
                </div>
                <ScoreBadge score={account.score} size="sm" />
              </a>
            )
          })
        )}
      </div>
    </div>
  )
}

export default AccountRail
