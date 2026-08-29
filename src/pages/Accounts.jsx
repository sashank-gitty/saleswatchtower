import { useMemo, useState } from "react"
import { deriveAccounts, accountKey } from "../lib/accountModel.js"
import { useLocalStorageState } from "../lib/useLocalStorageState.js"
import AccountsTable from "../components/AccountsTable.jsx"
import {
  PageHeader,
  Button,
  FilterSelect,
  SearchInput,
  Modal,
  Field,
  TextInput,
  Textarea,
  Radio,
  Toggle,
} from "../components/ui.jsx"
import { DownloadIcon, PlusIcon } from "../components/icons.jsx"

// The whole point of this dashboard: type a company name in here and it
// starts getting watched. No signal has to exist yet — deriveAccounts()
// (accountModel.js) seeds a real account entry for every tracked
// company up front, so it shows up in the table below immediately, not
// once a signal eventually arrives.
function AddCompanyModal({ open, onClose, onAdd }) {
  const [name, setName] = useState("")
  const [note, setNote] = useState("")
  const [status, setStatus] = useState(null)
  const [isCompetitor, setIsCompetitor] = useState(false)
  const [asxTicker, setAsxTicker] = useState("")
  const [stockTicker, setStockTicker] = useState("")

  const handleClose = () => {
    setName("")
    setNote("")
    setStatus(null)
    setIsCompetitor(false)
    setAsxTicker("")
    setStockTicker("")
    onClose()
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return
    onAdd(accountKey(trimmedName), trimmedName, {
      status,
      isCompetitor,
      note: note.trim() || null,
      asxTicker: asxTicker.trim() || null,
      stockTicker: stockTicker.trim() || null,
    })
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
        <Field
          label="Stock ticker (optional)"
          hint="Confirmed working for US-listed companies (e.g. CVX for Chevron) — pulls a real stock price, market cap, and next earnings date. Confirmed NOT working for ASX-listed companies (Finnhub's free tier returns an access error for those) — use the ASX ticker field above instead for an ASX-listed company's real filings."
        >
          <TextInput
            value={stockTicker}
            onChange={(e) => setStockTicker(e.target.value)}
            placeholder="e.g. CVX"
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

// Merged with the former "My Accounts" page (Issue: two nearly-identical
// nav items — "Accounts" and "My Accounts" — were the single most
// confusing thing about this app on a first visit). "Tracked" in the
// Type filter below is the same filter My Accounts used to be a whole
// separate page for; Track-a-Company moved here too, so there's exactly
// one place to manage accounts instead of two that looked like they
// might mean different things.
function Accounts({ signals, companies = [], logoByKey = new Map(), loading, isClaimed, onToggleClaim, initialType = null }) {
  const [search, setSearch] = useState("")
  const [type, setType] = useState(initialType)
  const [priority, setPriority] = useState(null)
  const [minScore, setMinScore] = useState(null)
  const [addOpen, setAddOpen] = useState(false)

  const [starred, setStarred] = useLocalStorageState("sdr-dashboard-starred-accounts", [])

  const accounts = useMemo(() => deriveAccounts(signals, companies, logoByKey), [signals, companies, logoByKey])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return accounts.filter((account) => {
      if (priority && account.priority.id !== priority) return false
      if (minScore && account.score < Number(minScore)) return false
      if (type === "customer" && account.status !== "customer") return false
      if (type === "prospect" && account.status !== "prospect") return false
      if (type === "untracked" && account.managed) return false
      if (type === "starred" && !starred.includes(account.key)) return false
      if (type === "mine" && !isClaimed?.(account.key)) return false
      if (query && !account.name.toLowerCase().includes(query)) return false
      return true
    })
  }, [accounts, priority, minScore, type, search, starred, isClaimed])

  const toggleStar = (key) => {
    setStarred((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const handleExport = () => {
    const header = ["Account", "Status", "Signals", "Priority", "Score", "Last signal", "Tracked"]
    const rows = filtered.map((a) => [
      a.name,
      a.status ?? "not tracked",
      a.signalCount,
      a.priority.label,
      a.score,
      a.lastSignalDate ?? "",
      isClaimed?.(a.key) ? "yes" : "no",
    ])
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `accounts-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageHeader
        title="Accounts"
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
          <SearchInput value={search} onChange={setSearch} placeholder="Search accounts..." className="col-span-2 sm:col-span-1" />
          <FilterSelect
            label="Type"
            value={type}
            onChange={setType}
            options={[
              { value: "mine", label: "Tracked" },
              { value: "customer", label: "Customer" },
              { value: "prospect", label: "Prospect" },
              { value: "untracked", label: "Not tracked" },
              { value: "starred", label: "Starred" },
            ]}
          />
          <FilterSelect
            label="Priority"
            value={priority}
            onChange={setPriority}
            options={[
              { value: "p1", label: "P1" },
              { value: "p2", label: "P2" },
              { value: "p3", label: "P3" },
              { value: "none", label: "No Priority" },
            ]}
          />
          <FilterSelect
            label="Min score"
            value={minScore}
            onChange={setMinScore}
            options={[
              { value: "80", label: "80+" },
              { value: "55", label: "55+" },
              { value: "25", label: "25+" },
            ]}
          />
        </div>
      </PageHeader>

      <AccountsTable
        // Remounts (fresh default sort/columns) when switching in or out
        // of the "Tracked" filter, same as the two pages this merged from
        // had different defaults — sorted by score everywhere else,
        // sorted by when-you-tracked-it here, with the claimed-date
        // column shown.
        key={type === "mine" ? "mine" : "all"}
        accounts={filtered}
        loading={loading}
        starred={starred}
        onToggleStar={toggleStar}
        isClaimed={isClaimed}
        onToggleClaim={onToggleClaim}
        columnsStorageKey={type === "mine" ? "sdr-dashboard-my-account-columns" : "sdr-dashboard-account-columns"}
        defaultColumns={type === "mine" ? ["whyNow", "type", "signals", "priority", "claimed"] : undefined}
        showClaimedColumn={type === "mine"}
        defaultSort={type === "mine" ? { key: "claimed", dir: "desc" } : undefined}
        emptyTitle={type === "mine" && companies.length === 0 ? "No companies tracked yet" : undefined}
        emptyDescription={
          type === "mine" && companies.length === 0
            ? 'Click "Track a Company" above to add one by name and jot down why — no need for it to already have a signal.'
            : type === "mine"
              ? "Clear the search or other filters to see everything you're tracking."
              : undefined
        }
      />

      <AddCompanyModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={(key, name, options) => onToggleClaim(key, name, true, options)}
      />
    </>
  )
}

export default Accounts
