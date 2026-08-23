import { useMemo, useState } from "react"
import { deriveAccounts } from "../lib/accountModel.js"
import { useLocalStorageState } from "../lib/useLocalStorageState.js"
import AccountsTable from "../components/AccountsTable.jsx"
import { PageHeader, Button, FilterSelect, SearchInput } from "../components/ui.jsx"
import { DownloadIcon } from "../components/icons.jsx"

function Accounts({ signals, companies = [], loading, isClaimed, onToggleClaim }) {
  const [search, setSearch] = useState("")
  const [type, setType] = useState(null)
  const [priority, setPriority] = useState(null)
  const [minScore, setMinScore] = useState(null)

  const [starred, setStarred] = useLocalStorageState("sdr-dashboard-starred-accounts", [])

  const accounts = useMemo(() => deriveAccounts(signals, companies), [signals, companies])

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
          <Button variant="outline" onClick={handleExport} disabled={!filtered.length}>
            <DownloadIcon className="h-4 w-4" />
            Export
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search accounts..." className="col-span-2 sm:col-span-1" />
          <FilterSelect
            label="Type"
            value={type}
            onChange={setType}
            options={[
              { value: "customer", label: "Customer" },
              { value: "prospect", label: "Prospect" },
              { value: "untracked", label: "Not tracked" },
              { value: "starred", label: "Starred" },
              { value: "mine", label: "Tracked" },
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
        accounts={filtered}
        loading={loading}
        starred={starred}
        onToggleStar={toggleStar}
        isClaimed={isClaimed}
        onToggleClaim={onToggleClaim}
        columnsStorageKey="sdr-dashboard-account-columns"
      />
    </>
  )
}

export default Accounts
