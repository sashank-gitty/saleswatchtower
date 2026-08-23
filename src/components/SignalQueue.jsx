import { useEffect, useState } from "react"
import SignalRow from "./SignalRow.jsx"
import SkeletonRow from "./SkeletonRow.jsx"
import Checkbox from "./Checkbox.jsx"
import TagLegend from "./TagLegend.jsx"

// 20 cards on first paint, each carrying several badges, read as a wall
// of content before anyone had scrolled or filtered anything. 10 gives
// a screenful without feeling like a dump; Load More still reaches
// everything.
const INITIAL_VISIBLE_COUNT = 10
const LOAD_MORE_INCREMENT = 15

// Scope (Macro/Micro/All) and the quick-filter shortcuts used to live here
// as a second, tab-shaped filtering system alongside the sidebar's
// checkboxes — two controls silently filtering the same fields. Both now
// live in the filter panel as regular facets; this component just renders
// whatever `items` it's handed.
function DensityToggle({ density, onDensityChange }) {
  const options = [
    { id: "comfortable", label: "Cards" },
    { id: "compact", label: "Compact" },
  ]
  return (
    <div className="flex overflow-hidden rounded-md border border-slate-200 dark:border-zinc-800">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onDensityChange(option.id)}
          aria-pressed={density === option.id}
          title={option.id === "compact" ? "Dense, table-style rows for fast scanning" : "Roomy cards with full context"}
          className={`px-2 py-1 text-[11px] font-semibold transition-colors ${
            density === option.id
              ? "bg-brand-500/10 text-brand-600 dark:text-brand-400"
              : "text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function SignalQueue({
  items,
  onToggleReviewed,
  onMarkManyReviewed,
  onOpenSignal,
  loading,
  onClearEverything,
  density = "comfortable",
  onDensityChange,
  view = "all",
  onShowAll,
}) {
  const compact = density === "compact"
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT)
  const [legendOpen, setLegendOpen] = useState(false)

  // Rendering all matching cards at once made the desktop feed one
  // unbroken column with no natural stopping point. Reveal them in pages
  // instead — every signal is still counted, still reachable, this only
  // changes how many render up front.
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_COUNT)
  }, [items])

  const visibleItems = items.slice(0, visibleCount)
  const hasMore = visibleCount < items.length

  // Selection is scoped to what's currently visible — stale picks from a
  // previous filter shouldn't silently linger in the bulk-action count.
  useEffect(() => {
    setSelectedIds((prev) => {
      const visibleIds = new Set(items.map((i) => i.id))
      const next = new Set([...prev].filter((id) => visibleIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [items])

  const allVisibleSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id))
  const someVisibleSelected = items.some((i) => selectedIds.has(i.id))

  const toggleSelectAll = () => {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(items.map((i) => i.id)))
  }

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkMarkReviewed = () => {
    onMarkManyReviewed([...selectedIds])
    setSelectedIds(new Set())
  }

  return (
    <div>
      <div className="sticky top-[57px] z-20 -mx-1 mb-4 flex flex-wrap items-center gap-3 bg-slate-50/95 px-1 py-3 backdrop-blur-sm dark:bg-zinc-950/95">
        <p className="text-sm font-semibold text-body-600 dark:text-zinc-200">
          {items.length} signal{items.length === 1 ? "" : "s"}
        </p>

        <button
          type="button"
          onClick={() => setLegendOpen((v) => !v)}
          aria-expanded={legendOpen}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
            legendOpen
              ? "text-brand-600 dark:text-brand-400"
              : "text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-300"
          }`}
        >
          <span className="flex h-2.5 w-2.5 items-center gap-px overflow-hidden rounded-sm">
            <span className="h-full w-1/3 bg-rose-500" />
            <span className="h-full w-1/3 bg-emerald-500" />
            <span className="h-full w-1/3 bg-brand-500" />
          </span>
          Legend
        </button>

        <div className="ml-auto flex items-center gap-2">
          {items.length > 0 && (
            <>
              <div
                onClick={toggleSelectAll}
                className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <Checkbox checked={allVisibleSelected} indeterminate={!allVisibleSelected && someVisibleSelected} onChange={toggleSelectAll} label="Select all visible signals" />
                {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
              </div>
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleBulkMarkReviewed}
                  className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
                >
                  Mark {selectedIds.size} Reviewed
                </button>
              )}
            </>
          )}
          {onDensityChange && <DensityToggle density={density} onDensityChange={onDensityChange} />}
        </div>
      </div>

      {legendOpen && <TagLegend />}

      {compact && !loading && items.length > 0 && (
        <div className="mb-1.5 flex items-center gap-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
          <span className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="h-2 w-2 flex-shrink-0" />
          <span className="hidden w-16 flex-shrink-0 sm:block">Date</span>
          <span className="hidden w-28 flex-shrink-0 md:block">Type</span>
          <span className="min-w-0 flex-1">Signal</span>
          <span className="flex-shrink-0">Rel</span>
          <span className="hidden flex-shrink-0 lg:block">Source</span>
          <span className="w-[52px] flex-shrink-0" />
        </div>
      )}

      <div className={`flex flex-col ${compact ? "gap-1.5" : "gap-2.5"}`}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-300 py-12 text-center dark:border-zinc-700">
            {view === "focus" ? (
              <>
                <p className="text-sm text-slate-400 dark:text-zinc-500">
                  Nothing worth acting on this week under the current filters.
                </p>
                <button
                  type="button"
                  onClick={onShowAll}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-body-600 transition-colors hover:border-slate-300 hover:text-ink-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
                >
                  Show all signals
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-400 dark:text-zinc-500">No signals match the current filters.</p>
                <button
                  type="button"
                  onClick={onClearEverything}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-body-600 transition-colors hover:border-slate-300 hover:text-ink-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            {visibleItems.map((item) => (
              <SignalRow
                key={item.id}
                item={item}
                reviewed={item.reviewed}
                onToggleReviewed={onToggleReviewed}
                onOpen={onOpenSignal}
                selected={selectedIds.has(item.id)}
                onToggleSelect={toggleSelectOne}
                compact={compact}
              />
            ))}
            {hasMore && (
              <button
                type="button"
                onClick={() => setVisibleCount((v) => v + LOAD_MORE_INCREMENT)}
                className="mt-1 self-center rounded-md border border-slate-200 px-4 py-2 text-xs font-semibold text-body-600 transition-colors hover:border-slate-300 hover:text-ink-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
              >
                Load {Math.min(LOAD_MORE_INCREMENT, items.length - visibleCount)} more{" "}
                <span className="font-normal text-slate-400 dark:text-zinc-500">
                  ({items.length - visibleCount} remaining)
                </span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default SignalQueue
