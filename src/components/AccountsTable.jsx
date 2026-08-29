import { useState } from "react"
import { linkProps } from "../lib/router.js"
import { useLocalStorageState } from "../lib/useLocalStorageState.js"
import { Card, Pill, Button, ScoreBadge, PriorityPill, AccountAvatar, Pagination, EmptyState } from "./ui.jsx"
import { StarIcon, PinIcon, EyeIcon, ChevronDownIcon } from "./icons.jsx"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function formatDate(dateString) {
  if (!dateString) return "—"
  const [year, month, day] = dateString.split("-").map(Number)
  return `${String(day).padStart(2, "0")} ${MONTHS[month - 1]} ${year}`
}

function formatDateTime(isoString) {
  if (!isoString) return "—"
  return formatDate(isoString.slice(0, 10))
}

// Every column the table can show. `always` columns can't be hidden —
// without a name and a score the row stops being identifiable or
// rankable, which is the whole point of the table. `claimed` only makes
// sense once claimedAt is passed in, so it's opt-in per page rather than
// listed as always-available.
const BASE_COLUMNS = [
  { id: "name", label: "Name", always: true },
  { id: "type", label: "Type" },
  { id: "signals", label: "Signals" },
  { id: "priority", label: "Priority" },
  { id: "score", label: "Score", always: true },
  { id: "lastSignal", label: "Last Signal" },
  { id: "firstSeen", label: "First Seen" },
]

const CLAIMED_COLUMN = { id: "claimed", label: "Claimed On" }

const SORTABLE = {
  name: (a, b) => a.name.localeCompare(b.name),
  signals: (a, b) => a.signalCount - b.signalCount,
  score: (a, b) => a.score - b.score,
  lastSignal: (a, b) => String(a.lastSignalDate ?? "").localeCompare(String(b.lastSignalDate ?? "")),
  firstSeen: (a, b) => String(a.firstSeen ?? "").localeCompare(String(b.firstSeen ?? "")),
  priority: (a, b) => a.score - b.score,
}

function ColumnsMenu({ columns, visible, onToggle }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <Button variant="ghost" onClick={() => setOpen((v) => !v)}>
        <EyeIcon className="h-4 w-4" />
        Columns
        <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            {columns.map((column) => (
              <label
                key={column.id}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-dense ${
                  column.always
                    ? "cursor-not-allowed text-slate-400 dark:text-zinc-600"
                    : "cursor-pointer text-body-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                <input
                  type="checkbox"
                  checked={column.always || visible.includes(column.id)}
                  disabled={column.always}
                  onChange={() => onToggle(column.id)}
                  className="h-3.5 w-3.5 accent-brand-600"
                />
                {column.label}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// The account table shared by the Accounts page (every derived account)
// and the My Accounts page (only the ones manually claimed) — same
// columns, same sort/star/claim behaviour, so an account looks and works
// identically whichever list it's viewed from. Owns its own sort, column
// visibility and pagination state; the caller only supplies the
// already-filtered account list and the header/toolbar around it.
function AccountsTable({
  accounts,
  loading,
  starred,
  onToggleStar,
  isClaimed,
  claimedAt,
  onToggleClaim,
  columnsStorageKey,
  defaultColumns = ["type", "signals", "priority", "lastSignal"],
  showClaimedColumn = false,
  defaultSort = { key: "score", dir: "desc" },
  emptyTitle = "No accounts match these filters",
  emptyDescription = "Accounts are derived from signals that name a company. Only macro-scope market signals produce none at all.",
  toolbar,
}) {
  const [sort, setSort] = useState(defaultSort)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [visibleColumns, setVisibleColumns] = useLocalStorageState(columnsStorageKey, defaultColumns)

  const columns = showClaimedColumn ? [...BASE_COLUMNS, CLAIMED_COLUMN] : BASE_COLUMNS

  const sorted = [...accounts]
  const comparator = sort.key === "claimed" ? (a, b) => String(claimedAt?.(a.key) ?? "").localeCompare(String(claimedAt?.(b.key) ?? "")) : SORTABLE[sort.key]
  if (comparator) {
    sorted.sort((a, b) => (sort.dir === "asc" ? comparator(a, b) : comparator(b, a)))
  }

  const pageRows = sorted.slice(page * pageSize, (page + 1) * pageSize)

  const toggleColumn = (id) => {
    setVisibleColumns((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  const shows = (id) => columns.find((c) => c.id === id)?.always || visibleColumns.includes(id)

  const handleSort = (key) => {
    if (!SORTABLE[key] && key !== "claimed") return
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }))
  }

  const SortHeader = ({ id, label, className = "" }) => (
    <th scope="col" className={`px-3 py-2.5 text-left font-medium ${className}`}>
      {SORTABLE[id] || id === "claimed" ? (
        <button
          type="button"
          onClick={() => handleSort(id)}
          className={`inline-flex items-center gap-1 transition-colors hover:text-ink-900 dark:hover:text-zinc-100 ${
            sort.key === id ? "text-ink-900 dark:text-zinc-100" : ""
          }`}
        >
          {label}
          {sort.key === id && (
            <ChevronDownIcon className={`h-3 w-3 transition-transform ${sort.dir === "asc" ? "rotate-180" : ""}`} />
          )}
        </button>
      ) : (
        label
      )}
    </th>
  )

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-zinc-800">
        <p className="px-1 text-xs text-body-500 dark:text-zinc-400">
          <span className="font-bold tabular-nums text-ink-900 dark:text-zinc-100">{accounts.length}</span>{" "}
          {accounts.length === 1 ? "account" : "accounts"}
        </p>
        <div className="flex items-center gap-2">
          {toolbar}
          <ColumnsMenu columns={columns} visible={visibleColumns} onToggle={toggleColumn} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-lg bg-slate-100 dark:bg-zinc-800/60" />
          ))}
        </div>
      ) : pageRows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-dense">
            <thead className="border-b border-slate-200 bg-section text-2xs uppercase tracking-wider text-slate-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
              <tr>
                <SortHeader id="name" label="Name" className="pl-4" />
                {shows("type") && <SortHeader id="type" label="Type" />}
                {shows("signals") && <SortHeader id="signals" label="Signals" />}
                {shows("priority") && <SortHeader id="priority" label="Priority" />}
                <SortHeader id="score" label="Score" />
                {shows("lastSignal") && <SortHeader id="lastSignal" label="Last Signal" />}
                {shows("firstSeen") && <SortHeader id="firstSeen" label="First Seen" />}
                {showClaimedColumn && shows("claimed") && <SortHeader id="claimed" label="Claimed On" />}
                <th scope="col" className="w-16 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/70">
              {pageRows.map((account) => (
                <tr key={account.key} className="transition-colors hover:bg-section dark:hover:bg-zinc-800/40">
                  <td className="py-2 pl-4 pr-3">
                    <a
                      {...linkProps(`/accounts/${encodeURIComponent(account.key)}`)}
                      className="flex items-center gap-2.5"
                    >
                      <AccountAvatar name={account.name} size="sm" />
                      <span className="truncate font-semibold text-ink-900 hover:text-brand-600 dark:text-zinc-100 dark:hover:text-brand-400">
                        {account.name}
                      </span>
                      {isClaimed?.(account.key) && (
                        <span title="Manually claimed">
                          <PinIcon filled className="h-3.5 w-3.5 flex-shrink-0 text-brand-600" />
                        </span>
                      )}
                    </a>
                  </td>
                  {shows("type") && (
                    <td className="px-3 py-2">
                      {account.status ? (
                        <Pill tone={account.status === "customer" ? "emerald" : "brand"}>
                          {account.status === "customer" ? "Customer" : "Prospect"}
                        </Pill>
                      ) : (
                        <Pill tone="slate">Not tracked</Pill>
                      )}
                    </td>
                  )}
                  {shows("signals") && (
                    <td className="px-3 py-2.5 tabular-nums text-body-600 dark:text-zinc-300">
                      {account.signalCount}
                      {account.highRelevanceCount > 0 && (
                        <span className="ml-1.5 text-2xs font-semibold text-brand-600 dark:text-brand-400">
                          {account.highRelevanceCount} high
                        </span>
                      )}
                    </td>
                  )}
                  {shows("priority") && (
                    <td className="px-3 py-2">
                      <PriorityPill priority={account.priority} />
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <ScoreBadge score={account.score} size="sm" />
                  </td>
                  {shows("lastSignal") && (
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums text-body-500 dark:text-zinc-400">
                      {formatDate(account.lastSignalDate)}
                    </td>
                  )}
                  {shows("firstSeen") && (
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums text-body-500 dark:text-zinc-400">
                      {formatDate(account.firstSeen)}
                    </td>
                  )}
                  {showClaimedColumn && shows("claimed") && (
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums text-body-500 dark:text-zinc-400">
                      {formatDateTime(claimedAt?.(account.key))}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-2.5">
                      {onToggleClaim && (
                        <button
                          type="button"
                          onClick={() => onToggleClaim(account.key, account.name, !isClaimed?.(account.key))}
                          aria-label={isClaimed?.(account.key) ? "Remove from My Accounts" : "Add to My Accounts"}
                          aria-pressed={isClaimed?.(account.key)}
                          className={`transition-colors ${
                            isClaimed?.(account.key)
                              ? "text-brand-600 hover:text-brand-700"
                              : "text-slate-300 hover:text-body-600 dark:text-zinc-600 dark:hover:text-zinc-300"
                          }`}
                        >
                          <PinIcon filled={isClaimed?.(account.key)} className="h-4 w-4" />
                        </button>
                      )}
                      {onToggleStar && (
                        <button
                          type="button"
                          onClick={() => onToggleStar(account.key)}
                          aria-label={starred?.includes(account.key) ? "Unstar account" : "Star account"}
                          aria-pressed={starred?.includes(account.key)}
                          className={`transition-colors ${
                            starred?.includes(account.key)
                              ? "text-amber-500 hover:text-amber-600"
                              : "text-slate-300 hover:text-body-600 dark:text-zinc-600 dark:hover:text-zinc-300"
                          }`}
                        >
                          <StarIcon filled={starred?.includes(account.key)} className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {accounts.length > 0 && (
        <div className="border-t border-slate-200 dark:border-zinc-800">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={accounts.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(0)
            }}
          />
        </div>
      )}
    </Card>
  )
}

export default AccountsTable
