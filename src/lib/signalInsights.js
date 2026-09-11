import { groupForSignal } from "./signalGroups.js"
import { HIGH_RELEVANCE_THRESHOLD } from "./relevance.js"

// A deeper, multi-part read on a single signal, for the detail drawer's
// insight section — the "why does this matter and what do I do with it"
// depth the one-line reason/action pair didn't have room for.
//
// Same hard rule as accountBrief.js and signalReason.js: nothing here
// invents a fact about a real company. Every sentence is a generic,
// defensible read tied to the signal's own fields (signal-type group,
// practice area, account status, score) — the kind of thing that's true
// of *any* signal shaped like this one. The specific fact is always the
// headline and summary already on screen above this section; this module
// explains why that class of fact tends to matter and what an SDR
// typically does with it, it does not claim anything new about the named
// company.

// Keyed by signal-group id (see signalGroups.js). `impact` is what this
// class of signal usually means for the account itself; `who` is who
// inside or around the account actually feels it — the "what this means
// for consumers / employees / everyone" layer, since the account isn't a
// single person.
const GROUP_IMPACT = {
  leadership: {
    impact:
      "A new leader in this seat typically opens a 60–90 day window where vendor relationships, budgets and existing tooling get reviewed fresh. Priorities the previous leader had settled are back up for debate — that window closes once they've made their first calls, so it's worth more now than it will be in six months.",
    who: "Whoever reports into this seat is watching for early signs of what the new leader changes first. Frontline teams usually find out about a re-platforming decision only after it's made, not before — which is exactly the gap an outside conversation can fill.",
  },
  regulatory: {
    impact:
      "Regulatory or compliance pressure like this usually forces a named internal owner and a budget line even when the account hasn't gone to market for a vendor yet — it's a mandate, not a discretionary spend, which changes how fast a deal can move once it starts.",
    who: "The customers or employees the regulation exists to protect are the ones who feel the operational strain first, well before it shows up in a boardroom deck. That lived experience — not the regulation's text — is the sharper thing to reference.",
  },
  earnings: {
    impact:
      "A result this public becomes the lens leadership judges every initiative through for the following quarter: cost discipline after a miss, or investment appetite after a beat. Either way, whatever gets funded next has to visibly answer to this number.",
    who: "Investors and analysts are the stated audience for the number, but the operating consequence — headcount, spend, which initiatives survive — lands squarely on the teams underneath them.",
  },
  funding: {
    impact:
      "Fresh funding, a partnership or an M&A event almost always comes with a stated reason attached — growth, product expansion, market entry. That stated reason, not the transaction itself, is the actual opening: it tells you what they're about to be measured on.",
    who: "Employees and the market read this as a signal of direction. If it's a partnership or acquisition, the combined entity's customers are the ones whose day-to-day experience is about to change, often before internal teams have fully worked out how.",
  },
  research: {
    impact:
      "A published analyst view or research shift resets how this account gets compared to its peers. Accounts move quickly to either defend a position that reads well or explain away one that doesn't — both are live conversations right after publication, not evergreen ones.",
    who: "Whoever owns competitive or brand positioning internally is the one under sudden pressure to respond to an external framing they didn't write.",
  },
  transformation: {
    impact:
      "A transformation or restructure this visible almost always has a stated 'why' attached — cost, growth, or customer experience. That stated reason is the pretext to use; the reorg itself is just the mechanism.",
    who: "Employees living through the change and the customers who experience its output are both directly affected, and both are legitimate angles — one is an internal-friction story, the other is a service-quality one.",
  },
  news: {
    impact:
      "Product, brand or market moves like this are the account publicly staking out a position. That's a live, current-events reason to ask how the move is actually landing internally — the press release and the internal reality are rarely the same story.",
    who: "The account's own customers and the market watching the move are the two audiences it's trying to win over. Which one they're more worried about disappointing is usually the more interesting question to ask than the move itself.",
  },
  community: {
    impact:
      "This is community-sourced intelligence rather than published news — useful as texture and as an early read on the account, but treat it as a lead to verify rather than a citable fact to put in an email.",
    who: "Whoever the insight names or describes is worth privately confirming before it's referenced outward in any outreach.",
  },
  other: {
    impact:
      "This signal doesn't fit a specific playbook yet — read the headline and summary above for the actual substance and use judgment on how directly it ties to this account's situation.",
    who: "Depends entirely on the substance of the signal itself — see the summary above.",
  },
}

export function accountImpact(item) {
  const group = groupForSignal(item)
  return GROUP_IMPACT[group]?.impact ?? GROUP_IMPACT.other.impact
}

export function whoThisAffects(item) {
  const group = groupForSignal(item)
  return GROUP_IMPACT[group]?.who ?? GROUP_IMPACT.other.who
}

// Multiple concrete angles, not one generic action line. Each is a short
// label plus the talk track behind it, so there's a real choice to make
// rather than a single script to repeat verbatim.
const GROUP_ANGLES = {
  leadership: [
    { label: "Congratulate, then ask about the mandate", angle: "Open on the appointment itself, then ask what they were brought in to change — that answer is usually the actual sales conversation." },
    { label: "Reference the review window", angle: "New leaders reassess vendor relationships in their first quarter by default — worth raising while that window is still open, not after it closes." },
    { label: "Offer an outside read", angle: "A new leader has no institutional history with your category yet — position this as a fast way to get context, not a pitch." },
  ],
  regulatory: [
    { label: "Lead with the compliance angle directly", angle: "Skip the warm-up — reference the specific pressure and ask who inside the account owns the response to it." },
    { label: "Name the operational cost", angle: "Compliance pressure translates into real operational load on frontline teams; ask how that load is currently being absorbed." },
    { label: "Time it to the deadline, not the news cycle", angle: "If the regulation carries a compliance date, anchor outreach to that date rather than to how recent the headline is." },
  ],
  earnings: [
    { label: "Tie the ask to the stated priority", angle: "Earnings commentary usually names what leadership is prioritizing next quarter — frame the outreach around that stated priority, not around the result itself." },
    { label: "Read the number as a budget signal", angle: "A beat often means fresh investment appetite; a miss often means a cost-discipline mandate. Either is a reason to ask what's being reprioritized." },
  ],
  funding: [
    { label: "Ask what the money is actually for", angle: "Funding and M&A announcements name a stated use of funds — reference it directly rather than the raise amount." },
    { label: "Flag the integration angle", angle: "If this is a partnership or acquisition, the combined org usually needs new tooling to operate as one — worth asking who owns that decision." },
  ],
  research: [
    { label: "Reference the external framing", angle: "Whether the coverage is flattering or not, it's a live reason to ask how the account is responding to how it's being perceived right now." },
    { label: "Offer a benchmarking angle", angle: "Position the conversation as understanding where they sit relative to the peers named in the same coverage." },
  ],
  transformation: [
    { label: "Ask what the reorg is meant to fix", angle: "Restructures are announced with a stated goal — ask directly whether the current tooling and process support that goal or work against it." },
    { label: "Reference the disruption window", angle: "Teams going through a reorg are actively re-evaluating what stays and what changes — a live moment to be part of that conversation." },
  ],
  news: [
    { label: "Ask how the move is landing internally", angle: "The public announcement and the internal reality rarely match perfectly — ask what changed operationally, not just externally." },
    { label: "Reference the competitive read", angle: "Frame it as reacting to a market move rather than cold outreach — 'saw you just announced X' is a stronger open than a generic intro." },
  ],
  community: [
    { label: "Use it to sharpen a question, not as a claim", angle: "Treat this as a hypothesis to test in conversation — ask an open question shaped by it rather than stating it as fact." },
  ],
  other: [
    { label: "Use the summary above to shape the ask", angle: "No standard angle for this signal type yet — read the actual headline and summary and judge the specific hook it offers." },
  ],
}

const STATUS_ANGLES = {
  customer: { label: "Frame as expansion, not a cold ask", angle: "This account already has a relationship — bring the signal into an existing check-in rather than opening cold with it." },
  prospect: { label: "Use it as the outreach pretext itself", angle: "This is fresh enough to reference directly as the reason for reaching out — lead with it rather than burying it in a generic intro." },
}

// Caps at 4 so the drawer stays scannable: the group's own angles first
// (most specific to the trigger type), then a status angle if this signal
// matched a tracked company with a known customer/prospect status, then
// your own value prop if you've set one up (Settings' "My Company").
// The value prop is your own written words, not generated here — this
// just decides when it's relevant enough to surface as an angle.
export function outreachAngles(item, accountStatus = null, valueProp = null) {
  const group = groupForSignal(item)
  const angles = [...(GROUP_ANGLES[group] ?? GROUP_ANGLES.other)]

  const matched = item.matchedCompanies ?? []
  if (matched.length && accountStatus) {
    const statusAngle = STATUS_ANGLES[accountStatus]
    if (statusAngle) angles.push(statusAngle)
  }

  if (valueProp?.trim()) {
    angles.push({ label: "Connect it to your own pitch", angle: valueProp.trim() })
  }

  return angles.slice(0, 4)
}

// Plain-language read on what the 1-5 outreach-relevance score actually
// means for prioritization, layered on top of relevanceTierText's rubric
// definition (which explains *why* it scored that number). This explains
// what to *do* with that number.
export function scoreMeaning(score) {
  if (score == null) {
    return "This signal predates outreach-relevance scoring, so it's treated as the neutral mid-tier (3) rather than penalized — it's supporting context until it's rescored."
  }
  if (score >= HIGH_RELEVANCE_THRESHOLD) {
    return `A ${score}/5 clears the feed's own high-relevance bar (${HIGH_RELEVANCE_THRESHOLD}+) — strong enough to justify a standalone outreach touch on its own, not just supporting context for one.`
  }
  if (score === 3) {
    return "A 3/5 is the context tier: useful inside a conversation that's already happening, but on its own it's a thinner pretext than a 4 or 5 — pairs best with a stronger trigger for the same account."
  }
  return `A ${score}/5 is background-tier: informs how you frame a conversation more than it justifies opening one by itself.`
}
