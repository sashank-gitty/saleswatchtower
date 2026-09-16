// Real people discovery via Apollo's People Search API, filtered to one
// company (by domain — Apollo's org filter matches on domain, not name,
// which is unreliable for anything but an exact match) and ANZ
// locations. Sibling to fetchMarketData.js: plain REST, no LLM.
//
// This endpoint deliberately never returns email/phone (Apollo's own
// docs: those need a separate, credit-costing Enrichment call) — name,
// title, and linkedin_url are enough to drive the role-research feature,
// so this app doesn't pay for enrichment it doesn't use yet.
const BASE_URL = "https://api.apollo.io/v1/mixed_people/search"

export async function findAnzContacts(domain) {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": process.env.APOLLO_API_KEY,
    },
    body: JSON.stringify({
      q_organization_domains_list: [domain],
      person_locations: ["Australia", "New Zealand"],
      per_page: 25,
    }),
    signal: AbortSignal.timeout(20000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Apollo people search failed: ${res.status} ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const people = Array.isArray(data.people) ? data.people : []

  return people
    .filter((p) => p.name)
    .map((p) => ({
      fullName: p.name,
      title: p.title ?? null,
      linkedinUrl: p.linkedin_url ?? null,
    }))
}
