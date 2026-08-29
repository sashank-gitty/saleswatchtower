import { useState } from "react"
import { pillClassForSignalType } from "../lib/colors.js"
import { QUICK_FILTERS, isQuickFilterActive } from "../lib/quickFilters.js"
import {
  ACCOUNT_COVERAGE_MODES,
  ACCOUNT_COVERAGE_SHORT_LABELS,
  ACCOUNT_COVERAGE_HINTS,
} from "../lib/accountCoverage.js"

const DATE_RANGES = [
  { value: "7", label: "7d" },
  { value: "30", label: "30d" },
  { value: "90", label: "90d" },
  { value: "all", label: "All" },
]

const SCOPE_OPTIONS = [
  { id: "all", label: "All", value: [] },
  { id: "macro", label: "Macro", value: ["macro"] },
  { id: "micro", label: "Micro", value: ["micro"] },
]

// Pulls the swatch for a filter row out of the same pill class the pill
// itself uses, so the dot beside a checkbox can never drift from the chip
// that option produces in the feed. Pills are light tints (-100), which
// is invisible as an 8px dot, so the hue is mapped up to its -500 shade
// through a literal table — Tailwind scans source text and would never
// emit a class name assembled at runtime.
const SWATCH_BY_HUE = {
  slate: "bg-slate-400",
  rose: "bg-rose-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  brand: "bg-brand-500",
}

function swatchClassFor(colorFor, option) {
  if (!colorFor) return null
  const hue = colorFor(option).match(/(?:^|\s)bg-([a-z]+)-\d/)?.[1]
  return SWATCH_BY_HUE[hue] ?? SWATCH_BY_HUE.slate
}

const SEARCHABLE_THRESHOLD = 8

function FilterSection({ title, options, selected, onToggle, colorFor, labelFor }) {
  // Collapsed by default, even on desktop, so a section with a lot of
  // options doesn't dump every checkbox on screen before anyone's touched
  // a filter. A section with an active selection still opens itself
  // below, so a filter already in use stays visible.
  const [open, setOpen] = useState(() => selected.length > 0)
  const [query, setQuery] = useState("")

  const showSearch = options.length > SEARCHABLE_THRESHOLD
  const visibleOptions = showSearch && query.trim()
    ? options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  return (
    <div className="border-b border-slate-200 py-3 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left text-sm font-semibold text-body-600 dark:text-zinc-200"
      >
        <span className={`inline-block text-3xs text-slate-400 transition-transform duration-200 ease-spring dark:text-zinc-500 ${open ? "rotate-90" : ""}`}>
          &#9656;
        </span>
        <span className="flex-1">{title}</span>
        {selected.length > 0 && (
          <span className="rounded-full bg-brand-500/10 px-1.5 py-0.5 text-2xs font-semibold text-brand-600 dark:text-brand-400">
            {selected.length}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2">
          {showSearch && (
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Filter ${title.toLowerCase()}...`}
              className="mb-1.5 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:placeholder:text-zinc-500 dark:focus:border-brand-500"
            />
          )}
          <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto scrollbar-thin">
            {visibleOptions.length === 0 ? (
              <p className="px-1.5 py-1 text-xs text-slate-400 dark:text-zinc-500">No matches.</p>
            ) : (
              visibleOptions.map((option) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-dense text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800/80"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(option)}
                    onChange={() => onToggle(option)}
                    className="h-3.5 w-3.5 flex-shrink-0 accent-brand-600"
                  />
                  {colorFor && (
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${swatchClassFor(colorFor, option)}`} />
                  )}
                  <span className={labelFor ? "truncate" : "truncate capitalize"}>
                    {labelFor ? labelFor(option) : option}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Scope only ever has two real values, so a segmented control reads
// better than a checkbox list — and having exactly one control for it
// (instead of this plus a separate Macro/Micro/All tab bar elsewhere)
// means it can't disagree with itself.
function ScopeControl({ scopeFilter, scopeCounts, onScopeChange }) {
  const current = scopeFilter.length === 0 ? "all" : scopeFilter[0]

  return (
    <div className="border-b border-slate-200 pb-3 dark:border-zinc-800">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-body-500 dark:text-zinc-400">Scope</p>
      <div className="flex overflow-hidden rounded-md border border-slate-200 dark:border-zinc-800">
        {SCOPE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onScopeChange(option.value)}
            className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${
              current === option.id
                ? "bg-brand-500/10 text-brand-600 dark:text-brand-400"
                : "text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {option.label}{" "}
            <span className="font-mono text-3xs tabular-nums text-slate-400 dark:text-zinc-500">
              ({scopeCounts[option.id] ?? 0})
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// Same segmented-control shape as ScopeControl, because it's the same
// kind of choice: three mutually exclusive views of the whole feed.
//
// The two non-default modes are opposites, and both are real workflows.
// "Tracked" is watching what you already added. "Not yet tracked" is
// whitespace hunting — named companies in the news that don't match
// anything on your list yet, which is where the next company to add
// comes from.
function AccountCoverageControl({ accountCoverage, onAccountCoverageChange }) {
  return (
    <div className="border-b border-slate-200 py-3 dark:border-zinc-800">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-body-500 dark:text-zinc-400">
        Account Coverage
      </p>
      {/* The explanation of what each mode means lives in the button's
          title tooltip rather than as permanent text underneath — one
          fewer paragraph on screen at all times, at the cost of it only
          showing on hover. Worth it: three segmented controls in a row
          (Date Range, Scope, this) each printing their own caption line
          was a lot of standing text for something used occasionally. */}
      <div className="flex overflow-hidden rounded-md border border-slate-200 dark:border-zinc-800">
        {ACCOUNT_COVERAGE_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onAccountCoverageChange(mode)}
            title={ACCOUNT_COVERAGE_HINTS[mode]}
            className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${
              accountCoverage === mode
                ? "bg-brand-500/10 text-brand-600 dark:text-brand-400"
                : "text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {ACCOUNT_COVERAGE_SHORT_LABELS[mode]}
          </button>
        ))}
      </div>
    </div>
  )
}

// Shortcuts that set a combination of the same facets below — not a
// second, competing filtering system. Multiple can be active at once
// (e.g. High Relevance + This Week), which the old single-select pill row
// couldn't do.
function QuickFilters({ urlState, onToggleQuickFilter }) {
  return (
    <div className="border-b border-slate-200 py-3 dark:border-zinc-800">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-body-500 dark:text-zinc-400">
        Quick Filters
      </p>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_FILTERS.map((quickFilter) => {
          const active = isQuickFilterActive(quickFilter, urlState)
          return (
            <button
              key={quickFilter.id}
              type="button"
              onClick={() => onToggleQuickFilter(quickFilter)}
              aria-pressed={active}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-200 ease-spring ${
                active
                  ? "border-brand-500/30 bg-brand-500/10 text-brand-600 dark:text-brand-400"
                  : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-ink-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
              }`}
            >
              {quickFilter.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Sidebar({
  dateRange,
  onDateRangeChange,
  scopeFilter,
  scopeCounts,
  onScopeChange,
  entityOptions,
  signalTypeOptions,
  entityFilter,
  signalTypeFilter,
  onToggleEntity,
  onToggleSignalType,
  urlState,
  onToggleQuickFilter,
  accountCoverage,
  onAccountCoverageChange,
  activeFilterCount,
  onClearAll,
  onCopyViewLink,
  viewLinkCopied,
}) {
  return (
    <aside className="flex h-full flex-col gap-1 overflow-y-auto border-r border-slate-200 bg-white/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40 lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)]">
      {/* One header row instead of two stacked blocks — the share
          action used to be its own bordered section with a full-width
          button; it's compact enough to sit inline with Clear all. The
          whole view is URL-backed, so this one click hands the rep who
          owns it a link rather than a list of checkboxes to re-tick. */}
      <div className="mb-1 flex items-center gap-2 pb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-body-500 dark:text-zinc-400">Filters</span>
        {activeFilterCount > 0 && (
          <span className="rounded-full bg-brand-500/10 px-1.5 py-0.5 text-2xs font-semibold text-brand-600 dark:text-brand-400">
            {activeFilterCount}
          </span>
        )}
        <button
          type="button"
          onClick={onCopyViewLink}
          title="Copy link to this view"
          className="ml-auto rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-ink-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
        >
          {viewLinkCopied ? "Copied" : "Share"}
        </button>
        <button
          type="button"
          onClick={onClearAll}
          disabled={activeFilterCount === 0}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-ink-900 disabled:cursor-default disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
        >
          Clear
        </button>
      </div>

      <QuickFilters urlState={urlState} onToggleQuickFilter={onToggleQuickFilter} />

      <div className="border-b border-slate-200 pb-3 dark:border-zinc-800">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-body-500 dark:text-zinc-400">Date Range</p>
        <div className="flex overflow-hidden rounded-md border border-slate-200 dark:border-zinc-800">
          {DATE_RANGES.map((range) => (
            <button
              key={range.value}
              type="button"
              onClick={() => onDateRangeChange(range.value)}
              className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${
                dateRange === range.value
                  ? "bg-brand-500/10 text-brand-600 dark:text-brand-400"
                  : "text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <ScopeControl scopeFilter={scopeFilter} scopeCounts={scopeCounts} onScopeChange={onScopeChange} />

      <AccountCoverageControl
        accountCoverage={accountCoverage}
        onAccountCoverageChange={onAccountCoverageChange}
      />

      <FilterSection
        title="Signal Type"
        options={signalTypeOptions}
        selected={signalTypeFilter}
        onToggle={onToggleSignalType}
        colorFor={pillClassForSignalType}
      />

      <FilterSection
        title="Entity"
        options={entityOptions}
        selected={entityFilter}
        onToggle={onToggleEntity}
      />
    </aside>
  )
}

export default Sidebar
