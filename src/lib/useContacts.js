import { useEffect, useState } from "react"

// Real buying-group contacts per company (api/account-contacts.js). Same
// fetch-on-mount shape as useSentiment.js — read-only, no mutations.
export function useContacts() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/account-contacts", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setContacts(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch((err) => {
        if (err.name === "AbortError") return
        setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const contactsFor = (companyKey) => contacts.filter((c) => c.companyKey === companyKey)

  // Apollo discovery, filtered to ANZ locations server-side
  // (api/_lib/fetchApolloContacts.js). Replaces this company's whole
  // Apollo-sourced contact list and refreshes local state so the
  // Contacts tab shows the new rows without a page reload.
  const findContacts = (companyKey) =>
    fetch("/api/account-contacts?resource=find", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyKey }),
    }).then(async (res) => {
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? `Server responded ${res.status}`)
      setContacts((prev) => [...prev.filter((c) => !(c.companyKey === companyKey && c.source === "apollo")), ...data])
      return data
    })

  return { contacts, loading, contactsFor, findContacts }
}
