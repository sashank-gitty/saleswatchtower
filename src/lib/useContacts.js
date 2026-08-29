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

  return { contacts, loading, contactsFor }
}
