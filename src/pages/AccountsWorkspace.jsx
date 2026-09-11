import { useEffect } from "react"
import { navigate } from "../lib/router.js"
import AccountRail from "../components/AccountRail.jsx"
import AccountDetail from "./AccountDetail.jsx"
import { EmptyState } from "../components/ui.jsx"

// Command Center: the account is the unit of navigation, not the page.
// A persistent rail on the left, whichever account the URL names on the
// right — selecting a different account never leaves this screen.
// Auto-selects the top account so the workspace never opens empty when
// accounts exist; the URL still carries the real selection, so a direct
// link to /accounts/:key still works exactly as before.
function AccountsWorkspace({ accounts, accountId, activeAccount, ...detailProps }) {
  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      navigate(`/accounts/${encodeURIComponent(accounts[0].key)}`, { replace: true })
    }
  }, [accountId, accounts])

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100vh-3.5rem)] sm:-mx-6">
      <AccountRail
        accounts={accounts}
        selectedKey={accountId ? decodeURIComponent(accountId) : null}
        className="w-72 flex-shrink-0 border-r border-slate-200 dark:border-zinc-800"
      />
      <div className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {activeAccount ? (
          <AccountDetail account={activeAccount} {...detailProps} />
        ) : (
          <EmptyState
            title={accounts.length === 0 ? "No accounts yet" : "Select an account"}
            description={
              accounts.length === 0
                ? "Track a company from Settings to see it here."
                : "Pick one from the list on the left."
            }
          />
        )}
      </div>
    </div>
  )
}

export default AccountsWorkspace
