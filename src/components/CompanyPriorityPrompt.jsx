import { useEffect, useRef, useState } from "react"
import { useMyCompany } from "../lib/useMyCompany.js"
import { STRATEGIC_FRAMINGS } from "../lib/strategicAngles.js"

// The clarifying question after "type your company in, everything
// adapts": once research lands on a real company, the ONE field that's
// never researched — strategicPriorities (see strategicAngles.js, which
// reorders every account's suggested approach angle by it) — is still
// blank or stale from whatever company you had before. Same pattern as
// ResearchOverlay.jsx: reads the shared singleton directly and mounts
// once in App.jsx, so it surfaces no matter which UI started the switch
// (Settings' form or TopNav's quick-switch dropdown), not just when
// Settings happens to be open.
function CompanyPriorityPrompt() {
  const { profile, save } = useMyCompany()
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState(null)
  const mountedCompanyRef = useRef(false)
  const prevCompanyRef = useRef(null)

  useEffect(() => {
    if (!profile) return
    if (!mountedCompanyRef.current) {
      mountedCompanyRef.current = true
      prevCompanyRef.current = profile.companyName ?? null
      return
    }
    if (profile.companyName && profile.companyName !== prevCompanyRef.current) {
      setVisible(true)
      setError(null)
    }
    prevCompanyRef.current = profile.companyName ?? null
  }, [profile])

  if (!visible || !profile?.companyName) return null

  const pick = (framing) => {
    setSaving(framing.id)
    setError(null)
    save({ strategicPriorities: framing.label })
      .then(() => setVisible(false))
      .catch(() => setError("Couldn't save that — try again."))
      .finally(() => setSaving(null))
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 rounded-xl border border-brand-200 bg-white p-4 shadow-xl dark:border-brand-500/30 dark:bg-zinc-900">
      <p className="mb-1 text-dense font-semibold text-ink-900 dark:text-zinc-50">
        What does leadership want right now from {profile.companyName}?
      </p>
      <p className="mb-3 text-xs text-body-500 dark:text-zinc-400">
        Shapes the suggested approach angle on every account. Change it anytime in Settings.
      </p>
      <div className="flex flex-wrap gap-2">
        {STRATEGIC_FRAMINGS.map((f) => (
          <button
            key={f.id}
            type="button"
            disabled={saving != null}
            onClick={() => pick(f)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-dense font-medium text-ink-900 transition-colors hover:border-brand-400 hover:bg-brand-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {saving === f.id ? "Saving..." : f.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="rounded-full px-3 py-1.5 text-dense font-medium text-body-500 transition-colors hover:text-ink-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Not sure yet
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  )
}

export default CompanyPriorityPrompt
