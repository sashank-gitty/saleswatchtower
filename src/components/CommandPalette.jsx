import { useEffect, useMemo, useRef, useState } from "react"
import { pillClassForScope } from "../lib/colors.js"

function CommandPalette({ open, onClose, items, onSelectItem, onClearFilters, onToggleTheme }) {
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef(null)
  const itemRefs = useRef([])

  useEffect(() => {
    if (open) {
      setQuery("")
      setActiveIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const matchingItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items.slice(0, 6)
    return items
      .filter((item) => `${item.headline} ${item.entity} ${item.summary}`.toLowerCase().includes(q))
      .slice(0, 6)
  }, [items, query])

  const actions = useMemo(() => {
    const all = [
      { id: "clear-filters", label: "Clear all filters", run: onClearFilters },
      { id: "toggle-theme", label: "Toggle light / dark mode", run: onToggleTheme },
    ]
    const q = query.trim().toLowerCase()
    if (!q) return all
    return all.filter((a) => a.label.toLowerCase().includes(q))
  }, [query, onClearFilters, onToggleTheme])

  const entries = useMemo(
    () => [
      ...matchingItems.map((item) => ({ type: "item", id: item.id, item })),
      ...actions.map((action) => ({ type: "action", id: action.id, action })),
    ],
    [matchingItems, actions],
  )

  useEffect(() => {
    setActiveIndex((i) => (entries.length ? Math.min(i, entries.length - 1) : 0))
  }, [entries.length])

  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  const runEntry = (entry) => {
    if (!entry) return
    if (entry.type === "item") onSelectItem(entry.item)
    else entry.action.run()
    onClose()
  }

  useEffect(() => {
    function handleKey(e) {
      if (!open) return
      if (e.key === "Escape") {
        onClose()
        return
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIndex((i) => (entries.length ? (i + 1) % entries.length : 0))
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIndex((i) => (entries.length ? (i - 1 + entries.length) % entries.length : 0))
        return
      }
      if (e.key === "Enter") {
        e.preventDefault()
        runEntry(entries[activeIndex])
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose, entries, activeIndex])

  if (!open) return null

  itemRefs.current = []

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 px-4 pt-24 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search signals or run a command..."
          className="w-full border-b border-slate-200 bg-transparent px-4 py-3 text-sm text-ink-900 outline-none placeholder:text-slate-400 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />

        <div className="max-h-80 overflow-y-auto p-2">
          {matchingItems.length > 0 && (
            <div className="mb-1">
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Signals</p>
              {matchingItems.map((item) => {
                const entryIndex = entries.findIndex((e) => e.type === "item" && e.id === item.id)
                return (
                  <button
                    key={item.id}
                    ref={(el) => (itemRefs.current[entryIndex] = el)}
                    type="button"
                    onMouseEnter={() => setActiveIndex(entryIndex)}
                    onClick={() => runEntry(entries[entryIndex])}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                      activeIndex === entryIndex
                        ? "bg-brand-500/10 text-ink-900 dark:text-zinc-100"
                        : "text-body-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold capitalize ${pillClassForScope(item.scope)}`}>
                      {item.scope}
                    </span>
                    <span className="truncate">{item.headline}</span>
                  </button>
                )
              })}
            </div>
          )}

          {actions.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Actions</p>
              {actions.map((action) => {
                const entryIndex = entries.findIndex((e) => e.type === "action" && e.id === action.id)
                return (
                  <button
                    key={action.id}
                    ref={(el) => (itemRefs.current[entryIndex] = el)}
                    type="button"
                    onMouseEnter={() => setActiveIndex(entryIndex)}
                    onClick={() => runEntry(entries[entryIndex])}
                    className={`flex w-full items-center rounded-md px-2 py-2 text-left text-sm transition-colors ${
                      activeIndex === entryIndex
                        ? "bg-brand-500/10 text-ink-900 dark:text-zinc-100"
                        : "text-body-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {action.label}
                  </button>
                )
              })}
            </div>
          )}

          {matchingItems.length === 0 && actions.length === 0 && (
            <p className="px-2 py-4 text-center text-sm text-slate-400 dark:text-zinc-500">No matches.</p>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-slate-200 px-3 py-1.5 text-[11px] text-slate-400 dark:border-zinc-800 dark:text-zinc-500">
          <span><kbd className="font-mono">&uarr;&darr;</kbd> navigate</span>
          <span><kbd className="font-mono">&crarr;</kbd> select</span>
          <span><kbd className="font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
