import { useMyCompany } from "../lib/useMyCompany.js"
import { SparklesIcon } from "./icons.jsx"

// The "it's thinking" moment for a company switch — real web-search
// research (api/_lib/companyProfile.js) genuinely takes up to ~55
// seconds, so a silent wait would read as broken. Self-contained: reads
// the shared `researching` flag directly (useMyCompany.js), so it lights
// up no matter which UI triggered the switch (Settings' form, TopNav's
// quick-switch dropdown, a future third place) — one overlay, rendered
// once in App.jsx, not duplicated per trigger point. animate-bounce is
// Tailwind's own built-in keyframe, no custom CSS needed for the
// "dances around" effect.
function ResearchOverlay() {
  const { researching, profile } = useMyCompany()

  if (!researching) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm dark:bg-zinc-950/70">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white px-8 py-7 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <span className="flex h-12 w-12 animate-bounce items-center justify-center rounded-full bg-navy-900 text-white dark:bg-brand-600">
          <SparklesIcon className="h-6 w-6" />
        </span>
        <div className="text-center">
          <p className="font-bold text-ink-900 dark:text-zinc-50">Setting up your dashboard...</p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-body-500 dark:text-zinc-400">
            Real web research on {profile?.companyName || "your company"} — usually under a minute.
          </p>
        </div>
      </div>
    </div>
  )
}

export default ResearchOverlay
