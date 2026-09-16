import { sql } from "./_lib/db.js"
import { findAnzContacts } from "./_lib/fetchApolloContacts.js"
import { triggerProfileScrape, checkProfileScrape } from "./_lib/fetchLinkedInProfile.js"
import { researchRole } from "./_lib/roleIntelligence.js"
import { BudgetExceededError } from "./_lib/normalize.js"

// Real buying-group contacts per company (db/migrations/009, widened by
// 013 to allow Apollo as a source too). Two ways a row gets here now:
// POST below (run from a live session with the Apollo connector
// attached), or the in-app ?resource=find flow (Apollo's REST API,
// filtered to ANZ locations — see fetchApolloContacts.js). Still no
// automated daily ingest for this; both are on-demand pulls.
//
// This file also owns ?resource=role-research (trigger + poll), folded
// in here rather than a new api/ file — Vercel's Hobby plan caps
// serverless functions at 12 and this project is already at that cap.
const VALID_SOURCES = new Set(["lusha", "zoominfo", "apollo"])

async function handleRoleResearchGet(req, res) {
  const linkedinUrl = typeof req.query.linkedinUrl === "string" ? req.query.linkedinUrl : null
  if (!linkedinUrl) {
    res.status(400).json({ error: "linkedinUrl is required" })
    return
  }

  try {
    const rows = await sql`SELECT status, brief, snapshot_id AS "snapshotId", error_message AS "errorMessage" FROM contact_role_briefs WHERE linkedin_url = ${linkedinUrl}`
    const row = rows[0]
    if (!row) {
      res.status(200).json({ status: "not_started" })
      return
    }
    if (row.status !== "pending") {
      res.status(200).json({ status: row.status, brief: row.brief, errorMessage: row.errorMessage })
      return
    }

    // Still pending — check Bright Data once per request rather than
    // blocking this function for however long the job takes. The
    // frontend re-calls this endpoint every few seconds until it sees
    // "ready" (see AccountDetail.jsx's role-research polling).
    const profile = await checkProfileScrape(row.snapshotId)
    if (!profile) {
      res.status(200).json({ status: "pending" })
      return
    }

    const brief = await researchRole(profile)
    if (!brief) {
      await sql`UPDATE contact_role_briefs SET status = 'error', error_message = 'Could not extract a role brief from the scraped profile', fetched_at = now() WHERE linkedin_url = ${linkedinUrl}`
      res.status(200).json({ status: "error", errorMessage: "Could not extract a role brief from the scraped profile" })
      return
    }

    await sql`UPDATE contact_role_briefs SET status = 'ready', brief = ${JSON.stringify(brief)}, fetched_at = now() WHERE linkedin_url = ${linkedinUrl}`
    res.status(200).json({ status: "ready", brief })
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      res.status(200).json({ status: "error", errorMessage: err.message })
      return
    }
    console.error("account-contacts: role-research check failed for", linkedinUrl, err)
    await sql`UPDATE contact_role_briefs SET status = 'error', error_message = ${err.message} WHERE linkedin_url = ${linkedinUrl}`.catch(() => {})
    res.status(200).json({ status: "error", errorMessage: err.message })
  }
}

async function handleRoleResearchTrigger(req, res) {
  const { linkedinUrl } = req.body ?? {}
  if (typeof linkedinUrl !== "string" || !linkedinUrl.trim()) {
    res.status(400).json({ error: "linkedinUrl must be a non-empty string" })
    return
  }

  try {
    const existing = await sql`SELECT status, brief FROM contact_role_briefs WHERE linkedin_url = ${linkedinUrl}`
    if (existing.length > 0 && existing[0].status === "ready") {
      res.status(200).json({ status: "ready", brief: existing[0].brief })
      return
    }
    if (existing.length > 0 && existing[0].status === "pending") {
      res.status(200).json({ status: "pending" })
      return
    }

    const snapshotId = await triggerProfileScrape(linkedinUrl)
    await sql`
      INSERT INTO contact_role_briefs (linkedin_url, status, snapshot_id)
      VALUES (${linkedinUrl}, 'pending', ${snapshotId})
      ON CONFLICT (linkedin_url) DO UPDATE SET status = 'pending', snapshot_id = EXCLUDED.snapshot_id, brief = NULL, error_message = NULL
    `
    res.status(200).json({ status: "pending" })
  } catch (err) {
    console.error("account-contacts: role-research trigger failed for", linkedinUrl, err)
    res.status(500).json({ error: "Failed to start role research", message: err.message })
  }
}

async function handleFindContacts(req, res) {
  const { companyKey } = req.body ?? {}
  if (typeof companyKey !== "string" || !companyKey.trim()) {
    res.status(400).json({ error: "companyKey must be a non-empty string" })
    return
  }

  try {
    const profileRows = await sql`SELECT domain, company_name AS "companyName" FROM company_profiles WHERE company_key = ${companyKey}`
    const domain = profileRows[0]?.domain
    if (!domain) {
      res.status(400).json({
        error: "No domain on file for this company yet — company research runs automatically once a company is tracked, try again shortly.",
      })
      return
    }

    const found = await findAnzContacts(domain)
    await sql`DELETE FROM account_contacts WHERE company_key = ${companyKey} AND source = 'apollo'`
    for (const c of found) {
      await sql`
        INSERT INTO account_contacts (company_key, full_name, title, linkedin_url, source)
        VALUES (${companyKey}, ${c.fullName}, ${c.title}, ${c.linkedinUrl}, 'apollo')
      `
    }
    const rows = await sql`
      SELECT company_key AS "companyKey", full_name AS "fullName", title, email,
        linkedin_url AS "linkedinUrl", source, fetched_at AS "fetchedAt"
      FROM account_contacts WHERE company_key = ${companyKey} ORDER BY full_name
    `
    res.status(200).json(rows)
  } catch (err) {
    console.error("account-contacts: find failed for", companyKey, err)
    res.status(500).json({ error: "Failed to find contacts", message: err.message })
  }
}

export default async function handler(req, res) {
  if (req.method === "GET" && req.query.resource === "role-research") {
    await handleRoleResearchGet(req, res)
    return
  }

  if (req.method === "POST" && req.query.resource === "role-research") {
    await handleRoleResearchTrigger(req, res)
    return
  }

  if (req.method === "POST" && req.query.resource === "find") {
    await handleFindContacts(req, res)
    return
  }

  if (req.method === "GET") {
    try {
      const rows = await sql`
        SELECT
          company_key AS "companyKey",
          full_name AS "fullName",
          title,
          email,
          linkedin_url AS "linkedinUrl",
          source,
          fetched_at AS "fetchedAt"
        FROM account_contacts
        ORDER BY company_key, full_name
      `
      res.status(200).json(rows)
    } catch (err) {
      console.error("GET /api/account-contacts failed:", err)
      res.status(500).json({ error: "Failed to load contacts" })
    }
    return
  }

  // Replaces this company's contacts from this specific provider only —
  // re-running a pull updates its own rows without touching contacts
  // fetched from a different provider (e.g. Airtasker's existing ZoomInfo
  // rows survive an Apollo pull for a different company).
  if (req.method === "POST") {
    const { companyKey, source, contacts } = req.body ?? {}
    if (typeof companyKey !== "string" || !companyKey.trim()) {
      res.status(400).json({ error: "companyKey must be a non-empty string" })
      return
    }
    if (!VALID_SOURCES.has(source)) {
      res.status(400).json({ error: `source must be one of: ${[...VALID_SOURCES].join(", ")}` })
      return
    }
    if (!Array.isArray(contacts) || contacts.some((c) => typeof c?.fullName !== "string" || !c.fullName.trim())) {
      res.status(400).json({ error: "contacts must be an array of objects with a non-empty fullName" })
      return
    }

    try {
      await sql`DELETE FROM account_contacts WHERE company_key = ${companyKey} AND source = ${source}`
      for (const c of contacts) {
        await sql`
          INSERT INTO account_contacts (company_key, full_name, title, email, linkedin_url, source)
          VALUES (${companyKey}, ${c.fullName.trim()}, ${c.title ?? null}, ${c.email ?? null}, ${c.linkedinUrl ?? null}, ${source})
        `
      }
      const rows = await sql`
        SELECT
          company_key AS "companyKey", full_name AS "fullName", title, email,
          linkedin_url AS "linkedinUrl", source, fetched_at AS "fetchedAt"
        FROM account_contacts WHERE company_key = ${companyKey} ORDER BY full_name
      `
      res.status(200).json(rows)
    } catch (err) {
      console.error("POST /api/account-contacts failed for", companyKey, err)
      res.status(500).json({ error: "Failed to save contacts" })
    }
    return
  }

  res.status(405).json({ error: "Method not allowed" })
}
