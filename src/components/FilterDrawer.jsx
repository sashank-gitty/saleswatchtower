import { useEffect } from "react"
import Sidebar from "./Sidebar.jsx"

function XIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

// Mobile/tablet-only filter drawer (below the `lg` breakpoint, matching the
// same breakpoint the desktop sidebar already uses). Wraps the exact same
// Sidebar component/props as desktop so every filter stays in sync and
// nothing is reimplemented — this is purely a different container for it.
function FilterDrawer({ open, onClose, ...sidebarProps }) {
  useEffect(() => {
    function onKey(e) {
      if (open && e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  return (
    <div className="fixed inset-0 z-50 lg:hidden" aria-hidden={!open} style={{ pointerEvents: open ? "auto" : "none" }}>
      <div
        className={`absolute inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        className={`absolute inset-y-0 left-0 flex w-[85vw] max-w-sm flex-col bg-slate-50 shadow-2xl transition-transform duration-300 ease-spring dark:bg-zinc-950 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
          <p className="text-sm font-semibold text-ink-900 dark:text-zinc-50">Filters</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:text-ink-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <Sidebar {...sidebarProps} />
        </div>
      </div>
    </div>
  )
}

export default FilterDrawer
