# Multi-agent dispatch — activity log (2026-09-02)

**Purpose:** Continuation anchor if this session hits a usage limit mid-flight. Three
background agents were dispatched in parallel from a chat session after realtime
chat+presence shipped. Each owns its own detailed log file (linked below) that it updates
as it progresses — read that file for the real-time status of any one task. This file is
just the index.

**If you're a fresh session picking this up:** check each agent's log file first. If a task
says "IN PROGRESS" but its worktree/branch shows no recent commits, the agent likely died
mid-task — read its log for how far it got, then either resume it by hand or re-dispatch
following the same instructions referenced below.

## Task 1: Banner/carousel image upload RLS fix (QA)
- **Log:** `docs/activity-log-banner-rls-fix.md`
- **Scope:** Storage RLS 403 blocking banner image upload on `w-app-qa`
  (`app/main/venue/carousel`) — bucket policies look un-applied on QA per the
  2026-09-02 build-state-inventory finding. Fix + verify on QA, code-only otherwise.
- **Isolation:** worktree removed, work merged to `main`
- **Status:** DONE. Root cause: `banners` storage bucket had zero RLS
  policies on `storage.objects` (deny-all). Fixed by
  `supabase/migrations/0018_banners_storage_policies.sql` (public read +
  write scoped to `is_venue_manager()`, mirroring the existing `banners`
  table policy). Applied + verified on QA (prod untouched, as scoped).
  Merged to `main` (`4012434`). No live browser upload test — no test
  credentials available, same limitation as everything else this session.

## Task 2: Connections graph / QR-scan / friends-feed — brainstorm + spec + plan
- **Log:** `docs/activity-log-connections-graph-plan.md`
- **Isolation:** worktree removed, work merged to `main` (`671ef77`)
- **Status:** DONE. Key finding: this was mis-scoped by the original audit —
  `connections`, `friendships`, and `peek_invites` tables **already exist**
  on QA with correct schema/constraints. The real blocker is that
  `connections`/`friendships` have **no INSERT policy** (write-locked by
  RLS) — a missing write-path problem, not a missing-schema one. The 2
  organizer-report figures stuck at 0 need **no code change**, just rows to
  exist. Deliverables:
  - `docs/superpowers/specs/2026-09-02-connections-graph-qr-connect-design.md`
  - `docs/superpowers/plans/2026-09-02-connections-write-path-qr-connect.md`
    (Plan A, 7 tasks — migration + RPCs + QR display/scan/contact-choice UI)
  - `docs/superpowers/plans/2026-09-02-friends-activity-feed-unlock.md`
    (Plan B, 3 tasks — unlock the feed once Plan A's write path exists)
  - **FOUNDER DECISIONS NEEDED before Plan A's Task 7 (prod gate):**
    1. Single-opt-in (scan = instant connection, no accept step) vs. a
       double opt-in/accept flow.
    2. Both parties must be checked in at the *same venue* to connect (no
       connecting outside/off-app) — real forgery resistance for zero new
       schema, but a genuine product restriction; the alternative is signed
       rotating QR tokens (more schema/complexity).
    3. `next.config.ts:29` currently sets `Permissions-Policy: camera=()` —
       camera is hard-disabled site-wide. Any QR scanner is dead until this
       becomes `camera=(self)`. Already an explicit step in Plan A Task 5,
       flagging here since it's an easy thing to miss.
  - Migration renumbered to `0019` (banner-RLS-fix's parallel agent took
    `0018` first) — Plan A's own Global Constraints tell the implementer to
    re-check the next free number before starting, since `main` moves fast.

## Task 3: Privacy-copy rewrite — stage the patch, do not apply
- **Log:** `docs/activity-log-privacy-copy-staging.md`
- **Scope:** Reads the already-drafted `docs/privacy-copy-rewrite-2026-09-02.md`,
  identifies the exact files/lines it targets, and prepares a ready-to-apply diff.
  **Does not apply it** — final wording sign-off is the founder's call, not
  delegable to an agent.
- **Isolation:** none (docs-only, worked directly in the main checkout)
- **Status:** DONE. Committed to `main` as `d12c700`. Patches staged for 3
  files (`app/privacy/page.tsx`, `app/main/page.tsx`,
  `components/home/CheckedInHero.tsx`) — nothing applied to the app yet.
  Waiting on founder review/sign-off of the wording in
  `docs/privacy-copy-rewrite-2026-09-02.md` plus this log's staged diffs,
  and one open decision (copy-only vs. behavior-change fix for
  `CheckedInHero`'s checked-in indicator — see the log for both options).

## Not delegated (needs a human with credentials)
- `main` is still unpushed to `origin` — no GitHub auth available in this environment.
  Run `git push origin main` from an authenticated terminal.
