# Hosting this off Vercel

Everything needed to run this as an ordinary website on your own
infrastructure is already in the repo: `server/index.mjs` (a
zero-dependency Node server), a two-stage `Dockerfile`, and
`scripts/run-ingest.mjs` (the cron replacement). This document explains
what Vercel was doing for you, what you have to replace, and the three
routes to getting there.

---

## What Vercel is actually providing

Worth being precise about, because "move off Vercel" is four separate
migrations wearing a trenchcoat:

| # | What it does | Replacement |
|---|---|---|
| 1 | Serves `dist/` on a CDN with TLS and a domain | `server/index.mjs`, behind Caddy or your host's TLS |
| 2 | Runs each `api/*.js` as a serverless function | `server/index.mjs` routes them in one process |
| 3 | Triggers `/api/ingest` daily (`vercel.json` `crons`) | `npm run ingest` from system cron |
| 4 | Injects `DATABASE_URL` via the Neon integration | You set it yourself |

The database is **not** on Vercel. It's Neon, connected through Vercel's
integration — so it does not have to move, and I'd recommend it doesn't.
Neon's free tier is generous, it's reachable over plain HTTPS from
anywhere, and keeping it removes the riskiest part of the migration
(moving live data). All that changes is who sets `DATABASE_URL`.

---

## The one thing that genuinely changes

Serverless functions are stateless and short-lived; a long-running server
is neither. Two consequences:

**Ingest is no longer bounded by a platform timeout.** `MAX_ITEMS_PER_RUN`
(25, in `api/ingest.js`) and `maxDuration: 60` existed to fit inside a
Vercel function. Self-hosted, you can raise the cap and run ingest hourly
instead of daily — the Hobby-plan once-a-day cron limit is gone. This is
the main practical *upgrade* from moving.

**Nothing restarts your process for you.** On Vercel a memory leak or an
unhandled rejection was somebody else's problem. Use a supervisor —
Docker's `restart: unless-stopped`, or systemd — and don't skip it.

---

## Route A — a VPS with Docker (recommended)

The most "actual website" of the options: one box, one domain, no
platform account. ~$5/month on Hetzner, DigitalOcean, Vultr or Fly.

```bash
docker build -t sdr-dashboard .

docker run -d --name sdr-dashboard \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -e DATABASE_URL="postgres://..." \
  -e ANTHROPIC_API_KEY="sk-ant-..." \
  -e CRON_SECRET="$(openssl rand -hex 32)" \
  sdr-dashboard
```

Binding to `127.0.0.1` deliberately: the app has **no authentication** (see
the security note below), so it should never be directly exposed. Put a
reverse proxy in front that terminates TLS and adds a password.

`docker-compose.yml`, if you prefer:

```yaml
services:
  web:
    build: .
    restart: unless-stopped
    ports: ["127.0.0.1:3000:3000"]
    environment:
      DATABASE_URL: ${DATABASE_URL}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      CRON_SECRET: ${CRON_SECRET}
```

### TLS and a domain

Caddy is the shortest path — it obtains and renews Let's Encrypt
certificates automatically. A complete `Caddyfile`:

```
signals.yourdomain.com {
    reverse_proxy 127.0.0.1:3000
    basicauth {
        you $2a$14$...   # caddy hash-password
    }
}
```

Point an A record at the server's IP and Caddy handles the rest on first
request.

### Ingest on a schedule

```cron
# hourly, on the hour — no longer capped at once a day
0 * * * * cd /srv/sdr-dashboard && /usr/bin/docker exec sdr-dashboard npm run ingest >> /var/log/sdr-ingest.log 2>&1
```

Check it's working the same way you would on Vercel: watch `inserted` and
`companyMatched` in the run summary. `companyMatched` sitting at zero run
after run with a non-empty tracked list usually means a spelling mismatch
between what you typed and what the news calls the company.

---

## Route B — a platform-as-a-service

If you want the deploy ergonomics of Vercel without Vercel. Fly.io,
Railway and Render all run the `Dockerfile` as-is and give you TLS and a
subdomain for free.

Fly, end to end:

```bash
fly launch --no-deploy          # detects the Dockerfile
fly secrets set DATABASE_URL="postgres://..." \
                ANTHROPIC_API_KEY="sk-ant-..." \
                CRON_SECRET="$(openssl rand -hex 32)"
fly deploy
```

Scheduled ingest becomes a separate scheduled machine rather than a
crontab:

```bash
fly machine run . --schedule hourly --command "npm run ingest"
```

Railway and Render both have a "Cron Job" service type that runs
`npm run ingest` against the same image — same idea, different noun.

---

## Route C — split static and API

Frontend on any static host (Cloudflare Pages, Netlify, S3+CloudFront),
API on a small server. Cheapest at scale and gives you a real CDN.

The cost is that `/api/*` is now a different origin, which means CORS
headers and a rewrite rule — two things that currently don't exist because
same-origin has made them unnecessary. Not worth it for a single-user
tool. Skip this unless you're serving it globally.

---

## Running it locally, exactly as it runs in production

```bash
npm run build
DATABASE_URL="postgres://..." npm start
# http://localhost:3000
```

This is worth doing once before you migrate — it's the same code path the
container runs, so anything that breaks here would have broken in
production.

Note `npm run dev` is still Vite alone and does **not** serve `/api/*`. It
falls back to the committed `src/data/data.json` fixture so the UI works
without a database; that fallback is `import.meta.env.DEV`-only and never
reaches a build.

---

## Security: read this before pointing a domain at it

**The whole deployment is behind HTTP Basic auth**, and it **fails closed** —
with `DASHBOARD_PASSWORD` unset every request gets a 503 rather than being
served. Two env vars control it:

| Var | Required | Default |
|---|---|---|
| `DASHBOARD_PASSWORD` | **yes** — nothing serves without it | — |
| `DASHBOARD_USER` | no | `sdr` |

On Vercel this is `middleware.js`, which runs at the edge before any static
asset or `/api/*` function. Self-hosted it is `checkAuth()` in
`server/index.mjs`. Both exempt exactly one path: `/api/ingest`, which
authenticates with `CRON_SECRET` instead (Vercel Cron sends it as a Bearer
token, and Basic auth in front would reject that header before the route saw
it). Set `CRON_SECRET` to a real random value.

Basic auth is deliberate rather than a placeholder: this is a single-user
tool, the browser remembers the credential, and it needs no session
store, no user table and no login UI. If it ever goes wider than just you,
replace it with a real identity provider — but do not remove it and leave
nothing.

**Why it matters.** The whole point of this app is a list of companies
you're personally tracking, with your own notes on why — that's not
information you want sitting on an open port. Keep it behind auth.

Pick one, before it's reachable:

1. **HTTP basic auth at the proxy** (the Caddy snippet above). Two
   minutes, no code, good enough for personal use.
2. **A private network** — Tailscale or WireGuard, and never expose 443
   publicly at all. Best if it's only ever you.
3. **A real login.** Only worth it if you're sharing this with a team.

---

## Migration checklist

1. `npm run build && npm start` locally against the production
   `DATABASE_URL`. Confirm the feed loads and "Mark Reviewed" persists.
2. `docker build` and run the container locally. Same checks.
3. Provision the host; set `DATABASE_URL`, `ANTHROPIC_API_KEY`,
   `CRON_SECRET`.
4. Deploy. Verify `/`, a deep link like `/accounts/<key>`, and
   `/api/signals`.
5. Put auth in front of it **before** the DNS record propagates.
6. Add the ingest schedule. Run it once by hand and read the summary.
7. Watch one scheduled run land.
8. Only then remove the Vercel project — keep it until the new host has
   completed an ingest cycle, so rollback stays a DNS change.

## What to keep from Vercel

Nothing has to stay. But two things are worth not throwing away:

- **Neon.** Migrating Postgres is the one step that can lose data, and
  there's no benefit to it.
- **Preview deployments**, if you use them. Self-hosting has no
  equivalent without building one. (The README notes preview branching has
  bitten twice with un-run migrations — if that's been more cost than
  value, this is a reason to be glad to see it go.)
