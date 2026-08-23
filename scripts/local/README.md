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
