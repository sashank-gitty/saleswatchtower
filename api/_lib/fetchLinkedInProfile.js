// Real LinkedIn profile data via Bright Data's LinkedIn Scraper API
// (dataset gd_l1viktl72bvl7bjuj0) — async job model, not a single "give
// me this profile now" call: trigger a collection, then poll until it's
// ready. Callers own the poll loop (api/account-contacts.js's
// resource=role-research GET handler runs one check per request rather
// than blocking a serverless function for however long the job takes).
const DATASET_ID = "gd_l1viktl72bvl7bjuj0"
const BASE_URL = "https://api.brightdata.com/datasets/v3"

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
    "Content-Type": "application/json",
  }
}

export async function triggerProfileScrape(linkedinUrl) {
  const res = await fetch(`${BASE_URL}/trigger?dataset_id=${DATASET_ID}&format=json`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify([{ url: linkedinUrl }]),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Bright Data trigger failed: ${res.status} ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  const snapshotId = data.snapshot_id
  if (!snapshotId) throw new Error("Bright Data trigger response had no snapshot_id")
  return snapshotId
}

// Returns null while the job is still running, the parsed profile object
// once ready. Throws on a real failure (bad request, job reported
// failed) — the caller catches this and marks the row 'error'.
export async function checkProfileScrape(snapshotId) {
  const progressRes = await fetch(`${BASE_URL}/progress/${snapshotId}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(15000),
  })
  if (!progressRes.ok) {
    const text = await progressRes.text().catch(() => "")
    throw new Error(`Bright Data progress check failed: ${progressRes.status} ${text.slice(0, 200)}`)
  }
  const progress = await progressRes.json()
  if (progress.status === "running" || progress.status === "collecting" || progress.status === "building") {
    return null
  }
  if (progress.status !== "ready") {
    throw new Error(`Bright Data snapshot ${snapshotId} reported status "${progress.status}"`)
  }

  const snapshotRes = await fetch(`${BASE_URL}/snapshot/${snapshotId}?format=json`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(15000),
  })
  if (!snapshotRes.ok) {
    const text = await snapshotRes.text().catch(() => "")
    throw new Error(`Bright Data snapshot fetch failed: ${snapshotRes.status} ${text.slice(0, 200)}`)
  }
  const data = await snapshotRes.json()
  const profile = Array.isArray(data) ? data[0] : data
  return profile ?? null
}
