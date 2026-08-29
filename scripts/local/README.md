# Local last30days sync (Issue 5, semi-scheduled option)

Runs entirely on your own machine, on your own schedule, via macOS `launchd`.
Nothing here is deployed to Vercel — the dashboard's production code has no
knowledge of this and doesn't need to.

**Status: built but not verified end-to-end.** It was written without access
to a real macOS machine, a local Claude Code CLI, or launchd itself — none of
that exists in the sandboxed environment these files were written in. Treat
the first few runs as debugging sessions, not a working feature.

## What it does

Once a day: checks the live dashboard for entities that got a fresh
`news`-origin signal since the last time this ran, picks up to
`MAX_ENTITIES_PER_RUN` (default 5, prioritized by outreach relevance),
and for each one runs `claude -p` headless to execute the `last30days`
skill, extract 3-5 SDR-relevant findings with real cited sources, and
write them as `origin: 'community'` rows in the database.

## Prerequisites

- macOS (launchd is macOS-specific; on Linux, use `cron` or `systemd` timers
  instead — the orchestration script itself, `sync-last30days.mjs`, is
  plain Node and doesn't care what scheduler calls it)
- Node 20+
- The `claude` CLI installed locally and already logged in interactively at
  least once (headless mode reuses that session's auth, it doesn't log in
  itself)
- The `last30days` skill available in your local Claude Code — confirm with
  `/last30days` in an interactive session before automating it
- `DATABASE_URL` for your Neon database (same one `db/seed.mjs` and
  `db/backfill-relevance.mjs` use)

## Setup

1. **Test the orchestrator manually first — do not go straight to
   scheduling it.**
   ```bash
   cd /path/to/sdr-dashboard
   vercel env pull .env.local   # if you don't already have a current one
   node --env-file=.env.local scripts/local/sync-last30days.mjs
   ```
   Watch it run. Check the dashboard afterward for new `community`-origin
   signals. This is the point where you'll likely need to fix the
   `claude -p` invocation flags in `sync-last30days.mjs` — the
   `--allowedTools` flag name/syntax was written from documentation, not
   verified against a real CLI. Run `claude -p --help` locally and compare.

2. **Once a manual run works cleanly**, copy the plist template:
   ```bash
   cp scripts/local/com.sdrdashboard.last30days-sync.plist.template \
      ~/Library/LaunchAgents/com.sdrdashboard.last30days-sync.plist
   ```

3. **Edit the copied plist** and replace every `REPLACE_ME_*`:
   - `REPLACE_ME_NODE_PATH` — output of `which node`
   - `REPLACE_ME_REPO_PATH` — absolute path to this repo on your machine
   - `REPLACE_ME_DATABASE_URL` — your Neon connection string (this puts a
     secret in a plaintext plist file in your home directory; that's a
     reasonable tradeoff on a personal laptop, but know that's what you're
     doing)
   - `REPLACE_ME_CLAUDE_CLI_DIR` — directory containing the `claude`
     binary, e.g. output of `dirname "$(which claude)"` — launchd does not
     read your shell's PATH, only what's explicitly listed here
   - `REPLACE_ME_HOME` — output of `echo $HOME`

4. **Load it**:
   ```bash
   launchctl load ~/Library/LaunchAgents/com.sdrdashboard.last30days-sync.plist
   ```

5. **Verify it's registered**:
   ```bash
   launchctl list | grep sdrdashboard
   ```

6. **Check logs** after it's had a chance to fire:
   ```bash
   tail -f ~/Library/Logs/sdr-dashboard-last30days.log
   tail -f ~/Library/Logs/sdr-dashboard-last30days-error.log
   ```

## Known limitations, stated plainly

- **Only runs while your laptop is on and awake** at the scheduled time.
  launchd does not reliably "catch up" a missed run the way some other
  schedulers do.
- **Cost**: each entity researched is a full `last30days` run — several
  WebSearches plus the Python engine plus a reasoning pass. Five entities a
  day, every day, adds up. `MAX_ENTITIES_PER_RUN` exists specifically to cap
  this; start low.
- **Headless reliability is lower than interactive use.** No human is
  watching to catch a bad run, a malformed JSON write, or a skill update
  that changes its output shape. Check the logs periodically, don't assume
  silence means success.
- **The `--allowedTools` flag** — verify this against your installed CLI.
  If it's wrong, `claude -p` may fail outright, or (worse) may fail
  permission checks silently in a way that produces no findings without a
  clear error. Watch the first several runs closely.

## Uninstalling

```bash
launchctl unload ~/Library/LaunchAgents/com.sdrdashboard.last30days-sync.plist
rm ~/Library/LaunchAgents/com.sdrdashboard.last30days-sync.plist
```

---

## Local hiring-signal sync (a second, separate script)

Same shape as the last30days sync above — `sync-hiring-signals.mjs`,
`hiring-signal-prompt.mjs`, `db/push-hiring-signals.mjs`, and
`com.sdrdashboard.hiring-signal-sync.plist.template` — but researches real
hiring/team-growth signals per tracked company instead of general news,
and writes `origin: 'hiring_signal'` rows instead of `'community'`.

**Why this is a local script and not a cloud one:** it started life as a
Claude Code scheduled cloud routine (no laptop required), and that was
genuinely tried — created, run, and tested with two different tools
(`curl` and `WebFetch`) trying to reach this app's API. Both got an
identical `EGRESS_BLOCKED` denial: the cloud sandbox only allows outbound
connections to a fixed allowlist of known infrastructure (Anthropic's own
services, package registries, GitHub), and there's no setting to add a
personal Vercel deployment to that list. Research tools (WebSearch,
connected MCP services like ZoomInfo/Lusha) work fine from a cloud
routine; reaching back into this app at all does not, for reading tracked
companies or writing results. A local script has ordinary internet access
and no such wall, so that's where this lives instead.

One real difference from that abandoned cloud version: this script's
research pass uses WebSearch (and the `agent-reach` skill, if your local
Claude Code has it) only. It does **not** use ZoomInfo/Lusha's real data —
those were only reachable as MCP connections inside a Claude session
(cloud routine or a chat like this one), not from a headless `claude -p`
subprocess, unless you've separately added them as local MCP servers
(`claude mcp add`, out of scope of this script). If you want ZoomInfo/Lusha
data in the automatic nightly pipeline instead, that needs a direct API
integration with your own ZoomInfo/Lusha API key — a separate piece, not
built by this script.

Setup, prerequisites, and known limitations are otherwise identical to the
last30days sync above (same `claude` CLI / launchd requirements, same
"only runs while your laptop is on" caveat, same "verify `--allowedTools`
against your installed CLI" caveat) — swap the filenames:

```bash
node --env-file=.env.local scripts/local/sync-hiring-signals.mjs
```

```bash
cp scripts/local/com.sdrdashboard.hiring-signal-sync.plist.template \
   ~/Library/LaunchAgents/com.sdrdashboard.hiring-signal-sync.plist
# edit the copy, replace every REPLACE_ME_*, then:
launchctl load ~/Library/LaunchAgents/com.sdrdashboard.hiring-signal-sync.plist
```

Uninstall the same way:

```bash
launchctl unload ~/Library/LaunchAgents/com.sdrdashboard.hiring-signal-sync.plist
rm ~/Library/LaunchAgents/com.sdrdashboard.hiring-signal-sync.plist
```

---

## Local sentiment sync (a third script)

Same shape again — `sync-sentiment.mjs`, `sentiment-prompt.mjs`,
`db/push-sentiment.mjs`, `com.sdrdashboard.sentiment-sync.plist.template`
— but this one is behind the dashboard's **Sentiment** tab (per account),
not the signal feed. It writes to its own table, `company_sentiment`, one
append-only snapshot per research pass rather than a discrete signal per
event — see `db/migrations/006_add_company_sentiment.sql`.

Per research pass, it combines two skills into one synthesized read
instead of a list of findings: `last30days` for general news/analyst
coverage, and `agent-reach` for Reddit and social-platform chatter
specifically. Falls back to plain WebSearch/WebFetch for either piece if
that skill isn't available in your local Claude Code.

**Cost note:** this pass runs two skills per company, roughly double the
per-company cost of the hiring-signal sync above. `MAX_COMPANIES_PER_RUN`
defaults to 3 (vs. 5) for that reason, and the template schedules it for
Wednesday rather than Monday so the two don't stack on the same morning.

Unlike the hiring-signal sync, this one had **not** been run for real as
of when it was written — the prompt and push script follow the identical
proven shape (same `claude -p` invocation fixes: `stdio`, subprocess env
allowlist), but test it by hand before trusting the schedule, more so
than usual:

```bash
node --env-file=.env.local scripts/local/sync-sentiment.mjs
```

Then check `company_sentiment` in your database for a real row, and check
the Sentiment tab on that account in the dashboard, before loading the
plist:

```bash
cp scripts/local/com.sdrdashboard.sentiment-sync.plist.template \
   ~/Library/LaunchAgents/com.sdrdashboard.sentiment-sync.plist
# edit the copy, replace every REPLACE_ME_*, then:
launchctl load ~/Library/LaunchAgents/com.sdrdashboard.sentiment-sync.plist
```

Uninstall the same way:

```bash
launchctl unload ~/Library/LaunchAgents/com.sdrdashboard.sentiment-sync.plist
rm ~/Library/LaunchAgents/com.sdrdashboard.sentiment-sync.plist
```
