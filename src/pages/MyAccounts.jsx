import { useMemo, useState } from "react"
import { useLocalStorageState } from "../lib/useLocalStorageState.js"
import { accountKey } from "../lib/accountModel.js"
import AccountsTable from "../components/AccountsTable.jsx"
import {
  PageHeader,
  SearchInput,
  EmptyState,
  Card,
  Button,
  Modal,
  Field,
  TextInput,
  Textarea,
  Radio,
  Toggle,
  SectionTitle,
} from "../components/ui.jsx"
import { DownloadIcon, PlusIcon, TrashIcon } from "../components/icons.jsx"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function formatDate(dateString) {
  if (!dateString) return "—"
  const [year, month, day] = String(dateString).slice(0, 10).split("-").map(Number)
  return `${String(day).padStart(2, "0")} ${MONTHS[month - 1]} ${year}`
}

// The whole point of this dashboard: type a company name in here and it
// starts getting watched. Saved through the same tracking mechanism the
// pin icon already uses (see useCompanies.js) so there's exactly one list.
// No signal has to exist yet — the next news-check run picks it up
// automatically. Until then it shows in the "Added Manually" list below.
function AddCompanyModal({ open, onClose, onAdd }) {
  const [name, setName] = useState("")
  const [note, setNote] = useState("")
  const [status, setStatus] = useState(null)
  const [isCompetitor, setIsCompetitor] = useState(false)
  const [asxTicker, setAsxTicker] = useState("")

  const handleClose = () => {
    setName("")
    setNote("")
    setStatus(null)
    setIsCompetitor(false)
    setAsxTicker("")
    onClose()
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return
    onAdd(accountKey(trimmedName), trimmedName, { status, isCompetitor, note: note.trim() || null, asxTicker: asxTicker.trim() || null })
    handleClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Track a Company">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Company name">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Corporation"
            autoFocus
            required
          />
        </Field>
        <Field label="Status (optional)">
          <div className="flex flex-wrap gap-4">
            <Radio name="status" value="prospect" checked={status === "prospect"} onChange={() => setStatus("prospect")} label="Prospect" />
            <Radio name="status" value="customer" checked={status === "customer"} onChange={() => setStatus("customer")} label="Customer" />
            <Radio name="status" value="" checked={status === null} onChange={() => setStatus(null)} label="Not set" />
          </div>
        </Field>
        <Toggle
          checked={isCompetitor}
          onChange={setIsCompetitor}
          label="This is a competitor, not a prospect (track for positioning, not outreach)"
        />
        <Field label="ASX ticker (optional)" hint="Only if this company is listed on the Australian Securities Exchange — lets us pull its real earnings and annual report filings, not just news about them. Leave blank otherwise.">
          <TextInput
            value={asxTicker}
            onChange={(e) => setAsxTicker(e.target.value)}
            placeholder="e.g. CBA"
          />
        </Field>
        <Field label="Why you're tracking this (optional)">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Met their VP of Sales at a conference, following up in Q3"
            rows={3}
          />
        </Field>
        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" variant="primary" disabled={!name.trim()}>
            Start Tracking
          </Button>
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// The account list for whatever you've manually marked as yours — found
// in the feed, in the whitespace view, or typed straight in — pinned so
// it's easy to find again without re-filtering the full Accounts table
// every time. Same columns and behaviour as Accounts, just pre-filtered
// to `claims` (the companies you're tracking) and sorted by tracked date
// instead of score by default.
function MyAccounts({ accounts, claims, loading, isClaimed, onToggleClaim }) {
  const [search, setSearch] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [starred, setStarred] = useLocalStorageState("sdr-dashboard-starred-accounts", [])
  const toggleStar = (key) => {
    setStarred((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const claimedByKey = useMemo(() => new Map(claims.map((c) => [c.companyKey, c])), [claims])

  const claimedAccounts = useMemo(
    () => accounts.filter((account) => claimedByKey.has(account.key)),
    [accounts, claimedByKey],
  )

  // Tracked companies that don't resolve to a live account (its signals
  // aged out of the derived set, or none have arrived yet) — surfaced
  // rather than silently dropped, since the company is still really being
  // tracked and you'd otherwise wonder where it went.
  const orphanedClaims = useMemo(
    () => claims.filter((c) => !accounts.some((a) => a.key === c.companyKey)),
    [claims, accounts],
  )

  const claimedAtLookup = (key) => claimedByKey.get(key)?.createdAt ?? null

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return claimedAccounts.filter((account) => {
      if (query && !account.name.toLowerCase().includes(query)) return false
      return true
    })
  }, [claimedAccounts, search])

  const handleExport = () => {
    const header = ["Account", "Status", "Signals", "Priority", "Score", "Tracked on"]
    const rows = filtered.map((a) => [
      a.name,
      a.status ?? "not set",
      a.signalCount,
      a.priority.label,
      a.score,
      (claimedAtLookup(a.key) ?? "").slice(0, 10),
    ])
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `my-accounts-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageHeader
        title="My Accounts"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              <PlusIcon className="h-4 w-4" />
              Track a Company
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={!filtered.length}>
              <DownloadIcon className="h-4 w-4" />
              Export
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search my accounts..." className="col-span-2 sm:col-span-1" />
        </div>
      </PageHeader>

      {claims.length === 0 && !loading ? (
        <Card>
          <EmptyState
            title="No companies tracked yet"
            description={
              'Click "Track a Company" above to add one by name and jot down why — no need for it to already have a signal. Or found a good company in the feed? Click the pin icon (or "Add to My Accounts") on its page to add it here instead.'
            }
            action={
              <Button variant="primary" onClick={() => setAddOpen(true)}>
                <PlusIcon className="h-4 w-4" />
                Track a Company
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {filtered.length === 0 && orphanedClaims.length === 0 ? (
            <Card>
              <EmptyState
                title="No tracked companies match this search"
                description="Clear the search to see everything you're tracking."
              />
            </Card>
          ) : (
            filtered.length > 0 && (
              <AccountsTable
                accounts={filtered}
                loading={loading}
                starred={starred}
                onToggleStar={toggleStar}
                isClaimed={isClaimed}
                claimedAt={claimedAtLookup}
                onToggleClaim={onToggleClaim}
                columnsStorageKey="sdr-dashboard-my-account-columns"
                defaultColumns={["type", "signals", "priority", "claimed"]}
                showClaimedColumn
                defaultSort={{ key: "claimed", dir: "desc" }}
                emptyTitle="No tracked companies match this search"
                emptyDescription="Clear the search to see everything you're tracking."
              />
            )
          )}

          {orphanedClaims.length > 0 && (
            <>
              <SectionTitle hint="Companies you've added by name with nothing in the news yet. They'll move into the table above automatically the moment a signal about them shows up.">
                Added Manually — Watching for News
              </SectionTitle>
              <div className="space-y-2">
                {orphanedClaims.map((c) => (
                  <Card key={c.companyKey} className="flex flex-wrap items-start gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-bold text-ink-900 dark:text-zinc-50">{c.companyName}</p>
                      {c.note ? (
                        <p className="mt-1 text-[12.5px] leading-relaxed text-body-600 dark:text-zinc-300">{c.note}</p>
                      ) : (
                        <p className="mt-1 text-[12.5px] italic text-body-500 dark:text-zinc-500">No note added</p>
                      )}
                      <p className="mt-1.5 text-[11px] text-slate-400 dark:text-zinc-500">Added {formatDate(c.createdAt)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      className="flex-shrink-0"
                      onClick={() => onToggleClaim(c.companyKey, c.companyName, false)}
                    >
                      <TrashIcon className="h-4 w-4" />
                      Remove
                    </Button>
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <AddCompanyModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={(key, name, options) => onToggleClaim(key, name, true, options)}
      />
    </>
  )
}

export default MyAccounts
