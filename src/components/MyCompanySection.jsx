import { useState } from "react"
import { useMyCompany } from "../lib/useMyCompany.js"
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

  const handleResearch = (e) => {
    e.preventDefault()
    if (!companyName.trim()) return
    setError(null)
    research(companyName.trim()).then((data) => {
      if (data.budgetExceeded) setError("This month's Claude API budget has been reached.")
      else if (!data.found) setError(`Couldn't find a real company matching "${companyName}" — try a more specific name.`)
    })
  }

  const handleValuePropBlur = () => {
    if (valueProp == null || valueProp === profile.valueProp) return
    save({ valueProp })
  }

  const handleAddCompetitor = (name) => {
    const key = accountKey(name)
    onToggleClaim(key, name, true, { isCompetitor: true })
    const nextCompetitors = profile.competitors.map((c) => (c.name === name ? { ...c, added: true } : c))
    save({ competitors: nextCompetitors })
  }

  if (loading) return <Card className="h-40 animate-pulse p-5" />

  return (
    <Card className="p-5">
      <SectionTitle hint="Type your company in once — this personalizes outreach angles, defaults Home's industry view, and can seed your Competitors list.">
        My Company
      </SectionTitle>

      {!profile?.companyName ? (
        <form onSubmit={handleResearch} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <label className="mb-1.5 block text-xs font-medium text-body-500 dark:text-zinc-400">Company name</label>
            <TextInput value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Corporation" />
          </div>
          <Button type="submit" variant="primary" disabled={!companyName.trim() || researching}>
            {researching ? "Researching..." : "Research"}
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-base font-bold text-ink-900 dark:text-zinc-50">{profile.companyName}</p>
              {profile.industry && <p className="text-xs text-body-500 dark:text-zinc-400">{profile.industry}</p>}
            </div>
            <Button
              variant="secondary"
              onClick={() => research(profile.companyName)}
              disabled={researching}
            >
              {researching ? "Researching..." : "Re-research"}
            </Button>
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
