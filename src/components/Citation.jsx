import { iconForSignal, groupForSignal, toneClassesForGroup } from "../lib/signalGroups.js"

// The citation badge — the single most load-bearing UI element on the
// account page.
//
// Every synthesized claim (a key insight, a value-pyramid bullet, a
// technology reference) is followed by one or more of these, each keyed
// to the signal it came from. Clicking one opens that signal in the
// drawer. That traceability is what separates a derived brief from a
// generated one: nothing on the page asserts anything the reader can't
// click through to the source of, so a rep can quote it on a call
// knowing exactly where it came from.
//
// Rendered as a rounded-full numbered tag rather than a bare number, and
// tinted from the shared per-group palette (lib/signalGroups.js) rather
// than its own copy of it — so a dense run of citations reads as a
// distribution (mostly leadership / mostly regulatory) before any number
// is read, in exactly the colours those groups wear everywhere else.
export function CitationBadge({ signal, index, onOpen }) {
  const Icon = iconForSignal(signal)
  const tone = toneClassesForGroup(groupForSignal(signal))

  return (
    <button
      type="button"
      onClick={() => onOpen(signal.id)}
      title={`${signal.headline} — ${signal.date}`}
      className={`ml-1 inline-flex translate-y-[-1px] items-center gap-0.5 rounded-full px-1.5 py-px align-middle text-[10px] font-bold tabular-nums transition-opacity hover:opacity-75 ${tone.pill}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {index}
    </button>
  )
}

// A run of citations after a claim.
export function Citations({ signals, indexOf, onOpen }) {
  if (!signals?.length) return null
  return (
    <span className="whitespace-nowrap">
      {signals.map((signal) => (
        <CitationBadge key={signal.id} signal={signal} index={indexOf(signal)} onOpen={onOpen} />
      ))}
    </span>
  )
}
