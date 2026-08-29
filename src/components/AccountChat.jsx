import { useState } from "react"
import { Card, Button, TextInput } from "./ui.jsx"
import { SparklesIcon } from "./icons.jsx"

// A cap on how many of the account's signals get sent per question — a
// busy account could have hundreds; this bounds the request payload and
// the token cost. account.signals is already sorted newest-first
// (accountModel.js), so a plain slice keeps the most recent, most likely
// to be relevant.
const MAX_SIGNALS_SENT = 40

// Scoped Q&A grounded in one account's own signals — see
// api/_lib/accountChat.js for why this stays fast and cheap (no
// web-search tool, so none of the timeout issues that call's sibling,
// companyProfile.js, ran into this session apply here). Deliberately
// stateless: no history is kept between questions, matching this app's
// "don't build for a need that isn't real yet" instinct — the most
// recent question and its answer are all that's shown, and asking again
// replaces both rather than appending to a thread.
function AccountChat({ companyName, signals }) {
  const [question, setQuestion] = useState("")
  const [asked, setAsked] = useState(null)
  const [answer, setAnswer] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = question.trim()
    if (!trimmed || loading) return

    setLoading(true)
    setError(null)
    setAnswer(null)
    setAsked(trimmed)

    fetch("/api/account-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName,
        question: trimmed,
        signals: signals.slice(0, MAX_SIGNALS_SENT).map((s) => ({
          date: s.date,
          signalType: s.signalType,
          headline: s.headline,
          summary: s.summary,
          sourceUrl: s.sourceUrl,
        })),
      }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Server responded ${res.status}`))))
      .then((data) => {
        if (data.budgetExceeded) {
          setError("This month's Claude API budget has been reached — try again next month.")
          return
        }
        setAnswer(data.answer)
      })
      .catch(() => setError("Couldn't get an answer — try again."))
      .finally(() => setLoading(false))

    setQuestion("")
  }

  return (
    <Card className="mb-5 p-5">
      <div className="mb-3 flex items-center gap-2">
        <SparklesIcon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
        <h2 className="text-dense font-bold text-ink-900 dark:text-zinc-50">Ask about {companyName}</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <TextInput
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Have they had any leadership changes recently?"
          disabled={loading}
        />
        <Button type="submit" variant="primary" disabled={loading || !question.trim()} className="flex-shrink-0">
          {loading ? "Thinking…" : "Ask"}
        </Button>
      </form>

      {(asked || error) && (
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 dark:border-zinc-800">
          {asked && <p className="text-xs font-semibold text-body-500 dark:text-zinc-400">{asked}</p>}
          {loading && <p className="text-dense text-body-500 dark:text-zinc-400">Reading this account's signals…</p>}
          {error && <p className="text-dense text-rose-600 dark:text-rose-400">{error}</p>}
          {answer && <p className="text-dense leading-relaxed text-body-600 dark:text-zinc-300">{answer}</p>}
        </div>
      )}
    </Card>
  )
}

export default AccountChat
