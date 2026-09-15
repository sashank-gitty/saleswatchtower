import { useEffect, useRef, useState } from "react"
import { useMyCompany } from "../lib/useMyCompany.js"
import { useCompanySuggestions } from "../lib/useCompanySuggestions.js"
import { accountKey } from "../lib/accountModel.js"
import { Card, SectionTitle, Button, TextInput, Textarea, Pill } from "./ui.jsx"

// The seed for "type in your company, everything adapts": your own
// company profile, researched the same way a tracked company's is
// (api/_lib/companyProfile.js), then yours to correct. Three things
// this feeds elsewhere in the app: the Competitors page (via "Add as
// tracked competitor" below), Home's By Industry default (industry,
// read here from the same profile), and personalized outreach angles
// (value prop, used by signalInsights.js).
function MyCompanySection({ isTracked, onToggleClaim }) {
  const { profile, loading, researching, research, save } = useMyCompany()
  const [companyName, setCompanyName] = useState("")
  const [error, setError] = useState(null)
  const [valueProp, setValueProp] = useState(null)
  const [priorities, setPriorities] = useState(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  // Lets an already-set-up company still change its name from right here
  // instead of only via TopNav's quick-switch — the empty-profile form
  // below is reused for this, just gated open manually instead of by
  // "no profile yet".
  const [editingName, setEditingName] = useState(false)
  const suggestions = useCompanySuggestions(companyName, editingName || !profile?.companyName)

  // profile is a shared singleton (useMyCompany.js) — a switch started
  // from TopNav lands here too. valueProp/priorities above are local
  // overrides for the not-yet-saved textarea text; without this reset
  // they kept showing the PREVIOUS company's edited text forever, since
  // a non-null local override always wins over the incoming profile —
  // the exact "Settings doesn't update" bug reported live.
  const mountedCompanyRef = useRef(false)
  const prevCompanyRef = useRef(null)

  useEffect(() => {
    if (!profile) return
    if (!mountedCompanyRef.current) {
      mountedCompanyRef.current = true
      prevCompanyRef.current = profile.companyName ?? null
      return
    }
    if (profile.companyName !== prevCompanyRef.current) {
      setValueProp(null)
      setPriorities(null)
    }
    prevCompanyRef.current = profile.companyName ?? null
  }, [profile])

  const runResearch = (name) => {
    setError(null)
    setDropdownOpen(false)
    research(name)
      .then((data) => {
        if (data.budgetExceeded) setError("This month's Claude API budget has been reached.")
        else if (!data.found) setError(`Couldn't find a real company matching "${name}" — try a more specific name.`)
        else {
          setCompanyName("")
          setEditingName(false)
        }
      })
      .catch(() => setError("Something went wrong reaching the server — try again in a moment."))
  }

  const handleResearch = (e) => {
    e.preventDefault()
    if (!companyName.trim()) return
    runResearch(companyName.trim())
  }

  // Selecting a real suggestion skips the extra "now click Research"
  // step — you already confirmed which real company you meant, so it
  // populates immediately.
  const handleSelectSuggestion = (suggestion) => {
    setCompanyName(suggestion.name)
    runResearch(suggestion.name)
  }

  const handleValuePropBlur = () => {
    if (valueProp == null || valueProp === profile.valueProp) return
    save({ valueProp }).catch(() => setError("Couldn't save your value prop — try again."))
  }

  const handlePrioritiesBlur = () => {
    if (priorities == null || priorities === profile.strategicPriorities) return
    save({ strategicPriorities: priorities }).catch(() => setError("Couldn't save your priorities — try again."))
  }

  const handleAddCompetitor = (name) => {
    const key = accountKey(name)
    onToggleClaim(key, name, true, { isCompetitor: true })
    const nextCompetitors = profile.competitors.map((c) => (c.name === name ? { ...c, added: true } : c))
    save({ competitors: nextCompetitors }).catch(() => setError("Couldn't save that — try again."))
  }

  if (loading) return <Card className="h-40 animate-pulse p-5" />

  const showNameForm = editingName || !profile?.companyName

  return (
    <Card className="p-5">
      <SectionTitle hint="Type your company in once — this personalizes outreach angles, defaults Home's industry view, and can seed your Competitors list.">
        My Company
      </SectionTitle>

      {showNameForm ? (
        <form onSubmit={handleResearch} className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[240px] flex-1">
            <label className="mb-1.5 block text-xs font-medium text-body-500 dark:text-zinc-400">Company name</label>
            <TextInput
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value)
                setDropdownOpen(true)
              }}
              onFocus={() => setDropdownOpen(true)}
              onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
              placeholder={profile?.companyName || "Acme Corporation"}
              autoComplete="off"
              autoFocus={editingName}
            />
            {dropdownOpen && suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                {suggestions.map((s) => (
                  <button
                    key={s.domain || s.name}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectSuggestion(s)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800"
                  >
                    <span className="text-dense font-medium text-ink-900 dark:text-zinc-100">{s.name}</span>
                    {s.domain && <span className="text-xs text-body-500 dark:text-zinc-400">{s.domain}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button type="submit" variant="primary" disabled={!companyName.trim() || researching}>
            {researching ? "Researching..." : "Research"}
          </Button>
          {profile?.companyName && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditingName(false)
                setCompanyName("")
                setError(null)
              }}
            >
              Cancel
            </Button>
          )}
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-base font-bold text-ink-900 dark:text-zinc-50">{profile.companyName}</p>
              {profile.industry && <p className="text-xs text-body-500 dark:text-zinc-400">{profile.industry}</p>}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEditingName(true)}>
                Change company
              </Button>
              <Button
                variant="secondary"
                onClick={() => research(profile.companyName)}
                disabled={researching}
              >
                {researching ? "Researching..." : "Re-research"}
              </Button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-body-500 dark:text-zinc-400">
              Your value prop — rewrite in your own words, this is what personalizes outreach angles
            </label>
            <Textarea
              value={valueProp ?? profile.valueProp ?? ""}
              onChange={(e) => setValueProp(e.target.value)}
              onBlur={handleValuePropBlur}
              rows={3}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-body-500 dark:text-zinc-400">
              What leadership wants right now — e.g. "net-new revenue this quarter" or "retention over new logos." Never researched, only what you type — this shapes each account's suggested approach angle.
            </label>
            <Textarea
              value={priorities ?? profile.strategicPriorities ?? ""}
              onChange={(e) => setPriorities(e.target.value)}
              onBlur={handlePrioritiesBlur}
              rows={2}
            />
          </div>

          {profile.competitors.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-body-500 dark:text-zinc-400">Real competitors research found</p>
              <div className="flex flex-col gap-1.5">
                {profile.competitors.map((c) => {
                  const alreadyTracked = c.added || isTracked(accountKey(c.name))
                  return (
                    <div key={c.name} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-zinc-800">
                      <span className="text-dense text-ink-900 dark:text-zinc-100">{c.name}</span>
                      {alreadyTracked ? (
                        <Pill tone="emerald">Added</Pill>
                      ) : (
                        <Button variant="secondary" className="text-xs" onClick={() => handleAddCompetitor(c.name)}>
                          Add as competitor
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
    </Card>
  )
}

export default MyCompanySection
