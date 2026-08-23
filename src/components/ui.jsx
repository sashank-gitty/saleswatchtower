import { useEffect, useRef, useState } from "react"
import { priorityFor } from "../lib/accountModel.js"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  DashIcon,
  SearchIcon,
} from "./icons.jsx"

// Shared presentational primitives. Everything here is stateless styling
// or self-contained interaction — no data shape from this app leaks in,
// so the same components serve the feed, the account table and search.

// The small uppercase label that sits above a heading in a tinted pill.
// Used sparingly — one per page section at most — as the thing that tells
// you what kind of block you are looking at before you read the heading.
export function Eyebrow({ tone = "brand", className = "", children }) {
  const tones = {
    brand: "bg-brand-100 text-navy-900 dark:bg-brand-500/15 dark:text-brand-200",
    slate: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300",
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
        tones[tone] ?? tones.brand
      } ${className}`}
    >
      {children}
    </span>
  )
}

// Navy-to-blue clipped to the glyphs. Deliberately a component rather than
// a bare class, so the "one or two words, never a sentence" rule has an
// obvious shape at every call site.
export function GradientText({ children, className = "" }) {
  return <span className={`text-gradient-brand ${className}`}>{children}</span>
}

export function PageHeader({ title, eyebrow, subtitle, actions, children }) {
  return (
    <div className="mb-6">
      {eyebrow && <div className="mb-2.5">{eyebrow}</div>}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-ink-900 dark:text-zinc-50">{title}</h1>
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>
      {subtitle && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-body-600 dark:text-zinc-400">{subtitle}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}

export function Card({ className = "", children, ...props }) {
  return (
    <div
      className={`rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(9,23,43,0.04)] dark:border-zinc-800 dark:bg-zinc-900/60 dark:shadow-none ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children, hint }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="text-lg font-bold tracking-tight text-ink-900 dark:text-zinc-50">{children}</h2>
      {hint && (
        <span
          title={hint}
          className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold text-slate-400 dark:border-zinc-600 dark:text-zinc-500"
        >
          i
        </span>
      )}
    </div>
  )
}

// Fully rounded, the way every button and badge in the reference product
// is. Primary is solid navy rather than the accent blue: the blue is
// doing so much work elsewhere (links, stats, active states) that a blue
// button would stop reading as the one thing to click.
export function Button({ variant = "secondary", className = "", children, ...props }) {
  const variants = {
    // Navy in light mode. On a near-black page navy has almost no
    // contrast against the background, so dark mode promotes the accent
    // blue into the primary slot instead.
    primary:
      "bg-navy-900 text-white border-navy-900 hover:bg-navy-800 hover:border-navy-800 dark:bg-brand-600 dark:border-brand-600 dark:hover:bg-brand-500 dark:hover:border-brand-500 disabled:bg-slate-200 disabled:border-slate-200 disabled:text-slate-400 dark:disabled:bg-zinc-800 dark:disabled:border-zinc-800 dark:disabled:text-zinc-600",
    secondary:
      "bg-white text-ink-900 border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:text-zinc-100",
    outline:
      "bg-transparent text-brand-600 border-brand-500/40 hover:bg-brand-50 hover:border-brand-500/60 dark:text-brand-400 dark:hover:bg-brand-500/10",
    ghost:
      "bg-transparent text-body-600 border-transparent hover:bg-slate-100 hover:text-ink-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
  }
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-5 py-2.5 text-sm font-semibold leading-none transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

// Every badge in the system is a fully-rounded, light-tint chip with dark
// text — no borders, no outline-only variants. Consistency of shape is
// what lets colour carry meaning: if pills differ in shape as well as
// hue, the hue stops being the signal.
export function Pill({ tone = "slate", className = "", children }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300",
    brand: "bg-brand-100 text-brand-800 dark:bg-brand-500/15 dark:text-brand-300",
    navy: "bg-navy-900 text-white dark:bg-navy-800",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${tones[tone] ?? tones.slate} ${className}`}
    >
      {children}
    </span>
  )
}

// The rounded-square icon container that fronts every category on every
// surface — feed rows, account tabs, agent cards, brief subsections. A
// ~32px tile, 8px radius, light tint of the category colour with the
// darker shade of the same hue for the glyph. This is the single biggest
// lever in the whole system: it turns a list of text rows into something
// that reads as a designed product.
export function IconBadge({ icon: Icon, tone = "bg-slate-100 text-slate-600", size = "md", className = "" }) {
  const sizes = {
    sm: "h-7 w-7 rounded-md",
    md: "h-9 w-9 rounded-lg",
    lg: "h-11 w-11 rounded-xl",
  }
  const glyphs = { sm: "h-3.5 w-3.5", md: "h-[18px] w-[18px]", lg: "h-5 w-5" }
  return (
    <span
      aria-hidden="true"
      className={`inline-flex flex-shrink-0 items-center justify-center ${sizes[size]} ${tone} ${className}`}
    >
      <Icon className={glyphs[size]} />
    </span>
  )
}

// "LIVE": green text next to a pulsing green dot. Reserved for something
// that is genuinely running right now, not for anything merely enabled.
export function LiveDot({ label = "Live", title }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400"
    >
      <span className="relative inline-flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      {label}
    </span>
  )
}

// The homepage-callout stat: a large bold accent-blue number with a
// quiet caption under it. Optionally a button — a stat that filters the
// view it is summarising is worth far more than a static one, and the
// hover lift is the only affordance that says so.
export function StatTile({ label, value, sub, tone = "brand", onClick, className = "" }) {
  const valueTones = {
    brand: "text-brand-600 dark:text-brand-400",
    ink: "text-ink-900 dark:text-zinc-50",
    rose: "text-rose-600 dark:text-rose-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
  }
  const Tag = onClick ? "button" : "div"
  return (
    <Tag
      {...(onClick ? { type: "button", onClick } : {})}
      className={`group flex flex-col rounded-xl border border-slate-200/80 bg-white p-5 text-left shadow-[0_1px_2px_rgba(9,23,43,0.04)] transition-all duration-200 ease-spring dark:border-zinc-800 dark:bg-zinc-900/60 dark:shadow-none ${
        onClick ? "hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:hover:border-brand-500/40" : ""
      } ${className}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-body-500 dark:text-zinc-400">{label}</p>
      <p className={`mt-2 text-4xl font-bold leading-none tabular-nums ${valueTones[tone] ?? valueTones.brand}`}>
        {value}
      </p>
      {sub && (
        <p className="mt-2 text-[12.5px] leading-snug text-body-500 dark:text-zinc-500">
          {sub}
          {onClick && (
            <span className="ml-1 inline-block text-brand-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-brand-400">
              &rarr;
            </span>
          )}
        </p>
      )}
    </Tag>
  )
}

// The account header banner: navy-to-blue at 135deg, a white rounded-square
// tile carrying the company mark on the left, identity stacked beside it,
// and a semi-transparent line of context on the right. Nothing in here is
// clickable — it exists to make an account page feel like a record you
// opened rather than a table you drilled into.
export function GradientBanner({ tile, title, subtitle, aside, children }) {
  return (
    <div className="bg-gradient-brand relative overflow-hidden rounded-xl px-5 py-5 sm:px-6">
      {/* A soft off-centre highlight so the gradient doesn't read as a
          flat two-stop ramp across a wide banner. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl"
      />
      <div className="relative flex flex-wrap items-center gap-x-5 gap-y-4">
        {tile && (
          <span className="inline-flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-white text-xl font-bold text-navy-900 shadow-sm sm:h-16 sm:w-16 sm:text-2xl">
            {tile}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 truncate text-[13px] font-medium text-white/70">{subtitle}</p>}
        </div>
        {aside && <p className="max-w-xs text-[13px] leading-relaxed text-white/70">{aside}</p>}
        {children}
      </div>
    </div>
  )
}

// P1 up-chevron in green, P3 down-chevron in red, "No Priority" a plain
// grey dash. The chevron is a real icon rather than a text arrow: at
// 11px a glyph like "\u2303" renders at wildly different weights across
// platforms, and the direction is the whole message.
const PRIORITY_STYLES = {
  p1: { tone: "emerald", Icon: ChevronUpIcon },
  p2: { tone: "amber", Icon: ChevronUpIcon },
  p3: { tone: "rose", Icon: ChevronDownIcon },
  none: { tone: "slate", Icon: DashIcon },
}

// Same four bands as PRIORITY_STYLES above, as disc fills.
const SCORE_TONES = {
  p1: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  p2: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  p3: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  none: "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400",
}

// The account score, rendered as the reference product does it: a filled
// disc whose tint tracks the number, so a table can be scanned by colour
// before any digit is read.
//
// The bands come from priorityFor() rather than from thresholds of their
// own. A P1 account showing an amber score would be the system arguing
// with itself in two colours; deriving both from the same function means
// it cannot happen.
export function ScoreBadge({ score, size = "md" }) {
  const sizes = {
    sm: "h-7 w-7 text-[11px]",
    md: "h-8 w-8 text-[12px]",
    lg: "h-11 w-11 text-[15px]",
  }
  return (
    <span
      title={`Account score ${score} / 100`}
      className={`inline-flex flex-shrink-0 items-center justify-center rounded-full font-bold tabular-nums ${
        SCORE_TONES[priorityFor(score).id] ?? SCORE_TONES.none
      } ${sizes[size]}`}
    >
      {score}
    </span>
  )
}

export function PriorityPill({ priority }) {
  const style = PRIORITY_STYLES[priority.id] ?? PRIORITY_STYLES.none
  return (
    <Pill tone={style.tone}>
      <style.Icon className="h-3 w-3 flex-shrink-0" />
      {priority.label}
    </Pill>
  )
}

// Company mark. No logo CDN is reachable from this app and inventing one
// would mean hotlinking third-party assets, so this derives a stable
// monogram + hue from the name instead. Same input always yields the same
// swatch, which is what makes a table scannable.
export function AccountAvatar({ name, size = "md" }) {
  const hues = [
    "bg-brand-500",
    "bg-sky-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-violet-500",
    "bg-teal-500",
    "bg-fuchsia-500",
  ]
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(i)
    hash |= 0
  }
  const hue = hues[Math.abs(hash) % hues.length]
  const initials = name
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const sizes = {
    sm: "h-7 w-7 rounded-md text-[10px]",
    md: "h-9 w-9 rounded-lg text-[12px]",
    lg: "h-12 w-12 rounded-xl text-base",
    xl: "h-16 w-16 rounded-2xl text-2xl",
  }
  return (
    <span
      aria-hidden="true"
      className={`inline-flex flex-shrink-0 items-center justify-center font-bold text-white ${hue} ${sizes[size]}`}
    >
      {initials || "?"}
    </span>
  )
}

// Horizontal tab strip with counts. Scrolls rather than wraps: the strip
// is a single row in the reference product and wrapping it would push the
// list content down unpredictably as counts change.
export function TabStrip({ tabs, active, onChange, className = "" }) {
  return (
    <div className={`-mx-1 overflow-x-auto scrollbar-thin ${className}`}>
      <div className="flex min-w-max items-center gap-1 border-b border-slate-200 px-1 dark:border-zinc-800">
        {tabs.map((tab) => {
          const isActive = tab.id === active
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              aria-current={isActive ? "true" : undefined}
              className={`relative inline-flex items-center gap-2 whitespace-nowrap px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                isActive
                  ? "text-brand-600 dark:text-brand-400"
                  : "text-body-600 hover:text-ink-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              {/* A tab that names a category wears that category's badge,
                  in the same tint it wears on every row underneath. The
                  tint stays on when the tab is inactive — that is the
                  point of it, so the colour can be learned by scanning
                  the strip rather than by clicking through it. */}
              {tab.Icon && <IconBadge icon={tab.Icon} tone={tab.tone ?? ""} size="sm" />}
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${
                    isActive
                      ? "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                      : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {tab.count}
                </span>
              )}
              {isActive && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-500" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Sub-navigation for the account detail page — same role as the tab strip
// but without counts and without the underline rail, matching how the
// reference product separates "which record" from "which slice of it".
export function SubNav({ tabs, active, onChange }) {
  return (
    <div className="-mx-1 overflow-x-auto scrollbar-thin">
      <div className="flex min-w-max items-center gap-1 px-1">
        {tabs.map((tab) => {
          const isActive = tab.id === active
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                isActive
                  ? "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                  : "text-body-600 hover:bg-slate-100 hover:text-ink-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Filter dropdown. A native <select> under a styled shell: it gets the
// platform's own picker on touch devices for free, which a custom
// listbox would have to reimplement badly.
export function FilterSelect({ label, value, options, onChange, className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        aria-label={label}
        className={`w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-[13px] outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700 dark:bg-zinc-900 ${
          value ? "text-ink-900 dark:text-zinc-100" : "text-slate-400 dark:text-zinc-500"
        }`}
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value} className="text-ink-900 dark:text-zinc-100">
            {option.label}
            {option.count !== undefined ? ` (${option.count})` : ""}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = "Search...", className = "", inputRef }) {
  return (
    <div className={`relative ${className}`}>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[13px] text-ink-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
      />
    </div>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5"
    >
      <span
        className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-brand-600" : "bg-slate-300 dark:bg-zinc-700"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </span>
      {label && <span className="text-[13px] text-body-600 dark:text-zinc-300">{label}</span>}
    </button>
  )
}

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }) {
  const from = total === 0 ? 0 : page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1)

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 px-4 py-3 text-[12px] text-body-500 dark:text-zinc-400">
      <label className="flex items-center gap-2">
        Rows per page:
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[12px] text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        >
          {[10, 25, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>

      <span className="tabular-nums">
        {from}&ndash;{to} of {total}
      </span>

      <div className="flex items-center gap-0.5">
        <PagerButton onClick={() => onPageChange(0)} disabled={page === 0} label="First page">
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          <ChevronLeftIcon className="-ml-2.5 h-3.5 w-3.5" />
        </PagerButton>
        <PagerButton onClick={() => onPageChange(page - 1)} disabled={page === 0} label="Previous page">
          <ChevronLeftIcon className="h-4 w-4" />
        </PagerButton>
        <PagerButton onClick={() => onPageChange(page + 1)} disabled={page >= lastPage} label="Next page">
          <ChevronRightIcon className="h-4 w-4" />
        </PagerButton>
        <PagerButton onClick={() => onPageChange(lastPage)} disabled={page >= lastPage} label="Last page">
          <ChevronRightIcon className="h-3.5 w-3.5" />
          <ChevronRightIcon className="-ml-2.5 h-3.5 w-3.5" />
        </PagerButton>
      </div>
    </div>
  )
}

function PagerButton({ onClick, disabled, label, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-100 hover:text-ink-900 disabled:pointer-events-none disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      {children}
    </button>
  )
}

// Shown wherever a panel exists in the reference layout but this
// pipeline ingests nothing that could fill it. Naming the missing source
// explicitly is the point: an empty panel that explains itself is a
// roadmap item, while a silently blank one reads as a bug — and a
// plausibly-populated one would be a fabrication.
export function NotIngested({ title, sources, note }) {
  return (
    <Card className="p-6">
      <p className="text-sm font-bold text-ink-900 dark:text-zinc-100">{title}</p>
      <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-body-600 dark:text-zinc-400">{note}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {sources.map((source) => (
          <Pill key={source} tone="slate">
            {source}
          </Pill>
        ))}
      </div>
    </Card>
  )
}

// A footnote under a chart or table: the caveat or the "so what", set
// quieter than body text and separated by a hairline.
export function SectionNote({ children }) {
  return (
    <p className="mt-3 border-t border-slate-200 pt-3 text-[12px] leading-relaxed text-body-500 dark:border-zinc-800 dark:text-zinc-400">
      {children}
    </p>
  )
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm font-bold text-ink-900 dark:text-zinc-100">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-body-600 dark:text-zinc-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// Wraps every occurrence of `term` in the given text so search results
// and the detail drawer can show *why* a row matched. Returns an array of
// nodes rather than HTML — no dangerouslySetInnerHTML, so a headline
// containing markup can't inject anything.
// `term` can be a multi-word query — search matching is now tokenized
// (see lib/textMatch.js: every word has to appear, not the exact phrase),
// so highlighting has to mark each matched word individually rather than
// only the full phrase, or a match on "nab leadership" against a headline
// with those two words apart would highlight nothing at all.
export function Highlight({ text, term }) {
  if (!term || !text) return text ?? null
  const tokens = [...new Set(String(term).toLowerCase().split(/\s+/).filter(Boolean))]
  if (!tokens.length) return text
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  const parts = String(text).split(new RegExp(`(${escaped.join("|")})`, "gi"))
  return parts.map((part, index) =>
    tokens.includes(part.toLowerCase()) ? (
      <mark
        key={index}
        className="rounded-sm bg-brand-500/20 px-0.5 font-medium text-brand-700 dark:bg-brand-500/30 dark:text-brand-200"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  )
}

export function Modal({ open, onClose, title, children, footer }) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] dark:bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 className="text-lg font-bold tracking-tight text-ink-900 dark:text-zinc-50">{title}</h2>
        <div className="mt-4">{children}</div>
        {footer && <div className="mt-6 flex items-center gap-2">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-body-500 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  )
}

export function TextInput({ className = "", ...props }) {
  return (
    <input
      type="text"
      className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-ink-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 ${className}`}
      {...props}
    />
  )
}

export function Textarea({ className = "", ...props }) {
  return (
    <textarea
      className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-ink-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 ${className}`}
      {...props}
    />
  )
}

export function Radio({ name, value, checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="h-4 w-4 accent-brand-600"
      />
      <span className="text-[13px] text-body-600 dark:text-zinc-300">{label}</span>
    </label>
  )
}

// Collapsible section used throughout the detail drawer.
export function Collapsible({ title, defaultOpen = true, action, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-b border-slate-200 py-4 last:border-b-0 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex flex-1 items-center gap-2 text-left"
        >
          <ChevronDownIcon
            className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform dark:text-zinc-500 ${
              open ? "" : "-rotate-90"
            }`}
          />
          <h3 className="text-[15px] font-bold text-ink-900 dark:text-zinc-50">{title}</h3>
        </button>
        {action}
      </div>
      {open && <div className="mt-3 pl-6">{children}</div>}
    </section>
  )
}
