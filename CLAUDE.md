# CLAUDE.md

Guidance for any Claude Code session (yours or another agent's) working in this repo.

## Founder approval required

This repo has real user data and a lot of concurrent agent activity on it at once
(multiple sessions have worked the same branches in parallel). Before acting
autonomously, stop and ask the founder first for any of the following — "small"
or "obviously correct" does not exempt a change in these categories:

1. **Auth / RLS / security-sensitive changes.** Anything touching
   `supabase/migrations/*`, RLS policies, `is_master_admin`, CAPTCHA config, or
   auth/session handling. This table has a documented history of RLS
   misconfigurations reaching prod (`supabase/migrations/0006_profiles_rls_lockdown.sql`
   patched a policy that let any authenticated user self-promote to admin) —
   don't autonomously "fix" anything in this area even if it looks small.
2. **Anything already flagged by another session as founder-gated.** If a peer
   session's notes/summary say "pending founder go-ahead" or similar, a new
   session should not silently proceed past that just because it wasn't the one
   that wrote the note. Check `list_sessions` / recent session summaries for
   this repo before assuming you're the only one working on an area.
3. **Production data or schema changes** — anything beyond editing a `.sql`
   migration file in the repo (backfills, running something directly against
   the live DB, etc.).
4. **Merge conflicts where both sides changed the same logic**, or two agent
   sessions independently touching the same feature/branch. Given how often
   multiple sessions are active here, check for a live sibling session on the
   same branch before resolving a conflict unilaterally.
5. **Anything customer-facing at scale** — pricing, legal/privacy copy, or
   other content/policy decisions (not ordinary bug-fix copy changes).
6. **Destructive or hard-to-reverse git ops** — force-push, `reset --hard`,
   rewriting another session's branch history, etc. (standard practice, called
   out here for emphasis given how many branches are in flight at once.)

Everything else — bug fixes, lint/CI fixes, small reviewer nits, non-destructive
local changes — can proceed autonomously as usual.

## Working alongside other agent sessions

Multiple Claude Code sessions are frequently active on this repo at the same
time, often on overlapping branches (e.g. several sessions have shared
`feature/in-app-browser-carousel-links`). Before starting substantial work:

- Check for other running/recent sessions touching the same area.
- Don't assume a PR you didn't open is unwatched — check whether another
  session or the PR Steward is already subscribed before taking it over.
