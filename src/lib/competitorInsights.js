import { groupForSignal } from "./signalGroups.js"

// The Competitor Intelligence equivalent of signalInsights.js — but it
// answers a different question on purpose. signalInsights.js is written
// for a signal about an account you could sell into: what does this
// mean for them, who feels it, how do you open a conversation. None of
// that applies to a signal about a company you've flagged as a
// competitor (see the isCompetitor flag on tracked_companies) — you
// cannot call a competitor and pitch them. What's actually useful about a
// piece of competitor news is entirely different: what changed, why it
// matters for how you talk about your own product against them, and what
// to watch for next.
//
// Same hard rule as signalInsights.js and accountBrief.js: nothing here
// invents a fact about a real company. Every sentence is a generic,
// defensible read keyed off the signal's own fields (signal-type group)
// — what's generically true of *a competitor doing this class of thing*,
// not a specific claim about any one company. The specific fact stays in
// the headline and summary above it.

const GROUP_POSITIONING = {
  leadership: {
    read:
      "New leadership at a competitor usually means a strategy review is coming — pricing, packaging, or which segment they chase hardest can all shift in the first two quarters. Worth watching rather than reacting to immediately; the actual change shows up in their go-to-market a few months after the appointment, not in the announcement itself.",
    watch:
      "Watch for a repositioning or a new campaign in the following quarter — that's when a new leader's actual priorities become visible, not in the appointment announcement.",
  },
  regulatory: {
    read:
      "Regulatory or compliance pressure on a competitor's own business (not their customers') is a rare data point about their own operational maturity — worth noting quietly, not worth raising unprompted in a deal since it can read as opportunistic rather than substantive.",
    watch:
      "Watch whether this becomes public enough that a prospect asks about it unprompted — that's the only point it's worth having a considered, factual answer ready for.",
  },
  earnings: {
    read:
      "A competitor's earnings commentary is the most reliable read available on where they're actually investing next — what they call out as a priority is what their product and marketing will lean into for the next few quarters, regardless of what their website says today.",
    watch:
      "Watch which product line or segment gets the growth narrative in the call — that's the area they'll be most aggressive in over the following two quarters.",
  },
  funding: {
    read:
      "Funding, a partnership or an acquisition changes what a competitor can credibly claim. An acquisition usually means a capability gap they're trying to close by buying rather than building — worth knowing which gap, since it tells you what they were weak on before the deal.",
    watch:
      "Watch for the integration story over the following two quarters — a rushed or unclear integration is a legitimate stability question a prospect evaluating them could reasonably ask.",
  },
  research: {
    read:
      "Analyst coverage or a research report reshuffling a competitor's market position is the thing prospects will actually see and ask about — a Gartner or Forrester placement carries more weight in a buying committee than almost anything else a vendor can point to, deserved or not.",
    watch:
      "Watch how the competitor markets this placement over the following weeks — the language they lead with is usually the exact positioning to have a factual, non-defensive answer ready for.",
  },
  transformation: {
    read:
      "A competitor restructuring or transforming internally is often the leading indicator of a product or go-to-market pivot before it's publicly announced — worth noting as an early signal, not yet as a settled fact about their direction.",
    watch:
      "Watch for a rebrand, a new product tier, or a segment they stop chasing over the next couple of quarters — that's where a restructure like this usually lands.",
  },
  news: {
    read:
      "A competitor's product launch, brand move or market announcement is a public claim about what they think their edge is right now — the useful read isn't whether the claim is true, it's what they're choosing to lead with, since that's what prospects will hear first.",
    watch:
      "Watch how this lands with their own customers over the following weeks — a launch that gets a lukewarm public reception is worth knowing before it comes up in a deal.",
  },
  community: {
    read:
      "This is community-sourced intelligence about a competitor rather than published news — useful as an early read on how they're perceived, but treat it as a lead to verify rather than something to reference outward.",
    watch:
      "Watch for this surfacing in published coverage before treating it as confirmed.",
  },
  other: {
    read:
      "This doesn't fit a specific competitive-positioning pattern yet — read the headline and summary above for the actual substance and judge how directly it bears on how you compare.",
    watch: "Depends entirely on the substance of the signal itself — see the summary above.",
  },
}

export function positioningRead(item) {
  const group = groupForSignal(item)
  return GROUP_POSITIONING[group]?.read ?? GROUP_POSITIONING.other.read
}

export function competitiveWatch(item) {
  const group = groupForSignal(item)
  return GROUP_POSITIONING[group]?.watch ?? GROUP_POSITIONING.other.watch
}

// Differentiation angles: how this piece of competitor news updates the
// way you talk about your own product, not how you'd approach the competitor
// itself (you can't — see accountModel.js). Deliberately not "here's why
// we're better" copy; each one is a question to bring into a live deal
// where this competitor is in the mix, since a real conversation beats a
// canned comparison every time.
const GROUP_DIFFERENTIATION = {
  leadership: [
    { label: "Ask what's changing, don't assume", angle: "If this competitor is in an active deal, ask the prospect directly whether the leadership change has affected their evaluation timeline or criteria — better than guessing." },
    { label: "Note the instability, carefully", angle: "A leadership change mid-evaluation is a legitimate, factual point a prospect can weigh themselves — better raised as a question ('how are you thinking about that transition?') than as a knock." },
  ],
  regulatory: [
    { label: "Hold this one back", angle: "Regulatory trouble at a competitor is the sharpest-edged of these signals — it reads as opportunistic if raised unprompted. Have the facts ready only for if a prospect brings it up themselves." },
  ],
  earnings: [
    { label: "Match investment to your own roadmap", angle: "If their earnings call named a specific investment area, check whether you have a stronger, more mature answer there already — that's a fair, factual comparison to have ready." },
  ],
  funding: [
    { label: "Ask about the gap the deal is filling", angle: "An acquisition usually signals a capability gap. If it's relevant to a live deal, it's fair to ask the prospect how they're weighing a newly-acquired, not-yet-integrated capability against a native one." },
  ],
  research: [
    { label: "Know the placement, don't dispute it", angle: "Analyst placements are real data points prospects weigh. The useful move is knowing exactly what the report says and where you stand on the same axes — not arguing the placement itself." },
  ],
  transformation: [
    { label: "Watch for the pivot before it's announced", angle: "A restructure this early is a leading indicator, not a talking point yet — worth tracking, not worth raising with a prospect until the actual product or GTM change is public." },
  ],
  news: [
    { label: "Get hands-on before it comes up", angle: "If this is a product launch, the strongest position in a deal is to have actually looked at it — a specific, accurate comparison beats a generic one every time it comes up." },
  ],
  community: [
    { label: "Verify before it's referenced", angle: "Confirm this independently before using it in any outward conversation — community intelligence is a lead, not a citable fact." },
  ],
  other: [
    { label: "Use the summary above to judge relevance", angle: "No standard differentiation angle for this signal type yet — read the actual headline and summary and judge whether it's even relevant to a live deal." },
  ],
}

export function differentiationAngles(item) {
  const group = groupForSignal(item)
  return GROUP_DIFFERENTIATION[group] ?? GROUP_DIFFERENTIATION.other
}
