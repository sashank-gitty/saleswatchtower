import { useState } from "react"
import { useMeddpicc, PILLARS } from "../lib/useMeddpicc.js"
import { Card, Button, Textarea } from "./ui.jsx"
import { SparklesIcon } from "./icons.jsx"

function scoreTone(score) {
  if (score == null) return "text-slate-400 dark:text-zinc-500"
  if (score >= 76) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 51) return "text-amber-600 dark:text-amber-400"
  return "text-rose-600 dark:text-rose-400"
}

function PillarCard({ entry, label, onSave, onScore }) {
  const [text, setText] = useState(entry.freeText)
  const [checked, setChecked] = useState(entry.checklistDone)
  const [scoring, setScoring] = useState(false)
  const [error, setError] = useState(null)
  const dirty = text !== entry.freeText || checked !== entry.checklistDone

  const handleBlurSave = () => {
    if (!dirty) return
    onSave({ freeText: text, checklistDone: checked })
  }

  const handleScore = () => {
    if (!text.trim()) return
    // Score always runs against what's actually saved — save first if
    // the textarea has unsaved edits, so the AI never judges stale text.
    setScoring(true)
    setError(null)
    const save = dirty ? onSave({ freeText: text, checklistDone: checked }) : Promise.resolve()
    save
      .then(() => onScore(text))
      .then((result) => {
        if (result?.budgetExceeded) setError("This month's Claude API budget has been reached.")
      })
      .catch(() => setError("Couldn't score this — try again."))
      .finally(() => setScoring(false))
  }

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                setChecked(e.target.checked)
                onSave({ freeText: text, checklistDone: e.target.checked })
              }}
              className="h-4 w-4 accent-brand-600"
            />
            <span className="text-dense font-bold text-ink-900 dark:text-zinc-50">{label}</span>
          </label>
        </div>
        {entry.aiScore != null && (
          <span className={`text-sm font-bold tabular-nums ${scoreTone(entry.aiScore)}`}>{entry.aiScore}</span>
        )}
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlurSave}
        rows={3}
        placeholder="Write what you actually know — specific, named, evidenced beats a vague general statement."
      />
      {entry.aiFeedback && <p className="mt-1.5 text-xs text-body-500 dark:text-zinc-400">{entry.aiFeedback}</p>}
      {error && <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      <div className="mt-2 flex justify-end">
        <Button variant="secondary" className="text-xs" onClick={handleScore} disabled={!text.trim() || scoring}>
          {scoring ? "Scoring..." : "Score this"}
        </Button>
      </div>
    </Card>
  )
}

// MEDDPICC on every account — free text + a manual checklist tick per
// pillar, plus an optional AI score that judges the strength of the
// free text you actually wrote (never invents anything about the real
// account — see api/_lib/meddpiccScore.js). Also the home of the AI
// coaching call, which reasons across this worksheet AND the org chart
// together to point out gaps and connections between the two.
function MeddpiccPanel({ companyKey, companyName, orgChartPeople }) {
  const { entries, overallScore, loading, saveEntry, scoreEntry } = useMeddpicc(companyKey)
  const [coaching, setCoaching] = useState(null)
  const [coachingLoading, setCoachingLoading] = useState(false)
  const [coachingError, setCoachingError] = useState(null)

  const handleCoaching = () => {
    setCoachingLoading(true)
    setCoachingError(null)
    setCoaching(null)
    fetch("/api/account-coaching", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName, orgChart: orgChartPeople, meddpicc: entries }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Server responded ${res.status}`))))
      .then((data) => {
        if (data.budgetExceeded) {
          setCoachingError("This month's Claude API budget has been reached.")
          return
        }
        setCoaching(data.coaching)
      })
      .catch(() => setCoachingError("Couldn't get coaching — try again."))
      .finally(() => setCoachingLoading(false))
  }

  if (loading) return <Card className="h-48 animate-pulse" />

  return (
    <>
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            Deal Confidence
          </p>
          <p className={`text-3xl font-bold tabular-nums ${scoreTone(overallScore)}`}>
            {overallScore ?? "—"}
            {overallScore != null && <span className="text-sm font-normal text-body-500 dark:text-zinc-400"> / 100</span>}
          </p>
        </div>
        <Button variant="outline" onClick={handleCoaching} disabled={coachingLoading}>
          <SparklesIcon className="h-4 w-4" />
          {coachingLoading ? "Thinking..." : "Get AI Coaching"}
        </Button>
      </Card>

      {coachingError && <p className="mb-4 text-sm text-rose-600 dark:text-rose-400">{coachingError}</p>}
      {coaching && (
        <Card className="mb-4 border-brand-300 bg-brand-50/50 p-4 dark:border-brand-500/30 dark:bg-brand-500/5">
          <p className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
            <SparklesIcon className="h-3.5 w-3.5" />
            AI Coaching
          </p>
          <p className="text-dense leading-relaxed text-ink-900 dark:text-zinc-100">{coaching}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {PILLARS.map(({ id, label }) => {
          const entry = entries.find((e) => e.pillar === id)
          return (
            <PillarCard
              key={id}
              entry={entry}
              label={label}
              onSave={(values) => saveEntry(id, values)}
              onScore={(freeText) => scoreEntry(id, freeText)}
            />
          )
        })}
      </div>
    </>
  )
}

export default MeddpiccPanel
