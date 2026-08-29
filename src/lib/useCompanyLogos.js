import { useEffect, useState } from "react"

// Logo URL per company_key, for every account — not just tracked ones
// (that's useCompanies.js). Same fetch-on-mount shape as useSentiment.js.
export function useCompanyLogos() {
  const [logos, setLogos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/company-logos", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setLogos(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch((err) => {
        if (err.name === "AbortError") return
        setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const logoUrlFor = (companyKey) => logos.find((l) => l.companyKey === companyKey)?.logoUrl ?? null

  return { logos, loading, logoUrlFor }
}
