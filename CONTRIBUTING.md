# Contributing

Thanks for looking at Sales Watchtower. It's built to be self-hosted and
adapted, so contributions that keep it generic — no hardcoded company,
industry, or region — are especially welcome.

## Getting set up

1. Fork and clone the repo.
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in `DATABASE_URL` and
   `ANTHROPIC_API_KEY` at minimum — see the README's "One-time setup" for
   the full walkthrough.
4. `npm run dev` for the frontend. API routes need `vercel dev` to run
   locally (see README "Development").

## Before opening a PR

- `npm run lint` and `npm run build` should both pass clean.
- No secrets, real company data, or personal identifiers in commits —
  `.gitignore` already excludes `.env*` and spreadsheet exports; double
  check your diff anyway.
- Keep the app generic. If a change only makes sense for one company or
  industry, it probably belongs in your own fork's config, not upstream.

## What to work on

Check open issues, or the "explained honestly — what's live vs. not yet
built" notes on the Radar page for known gaps.
