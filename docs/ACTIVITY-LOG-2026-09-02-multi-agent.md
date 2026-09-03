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
- **Isolation:** own git worktree at
  `.claude/worktrees/agent-a0ba22e056525d82d` (branch
  `worktree-agent-a0ba22e056525d82d`)
- **Status:** IN PROGRESS. First run applied a migration ("Applied without
  errors. Now verify.") then died to a transient network error before
  verifying/merging. Resumed once already (via SendMessage) to finish
  verification + merge-to-main-if-clean. **If this session/agent dies again
  (e.g. computer restart) before a completion notification arrives:** check
  `git -C .claude/worktrees/agent-a0ba22e056525d82d log --oneline` for
  commits and `docs/activity-log-banner-rls-fix.md` inside that worktree
  for exact status — do not assume it's done or undone, verify from disk.

## Task 2: Connections graph / QR-scan / friends-feed — brainstorm + spec + plan
- **Log:** `docs/activity-log-connections-graph-plan.md`
- **Scope:** Planning only, no code. Produces a design spec
  (`docs/superpowers/specs/`) and implementation plan
  (`docs/superpowers/plans/`) for resolving the connections/friends schema —
  the single blocker behind the Connect/QR stub, the locked-only friends-activity
  feed, Round 2 Peek, and 2 always-zero organizer-report figures.
- **Isolation:** own git worktree at
  `.claude/worktrees/agent-ae242158d77edf0e0` (branch
  `worktree-agent-ae242158d77edf0e0`)
- **Status:** IN PROGRESS. First run was mid-exploration (possibly doing DB
  queries) when it died to the same transient network error. Resumed once
  already (via SendMessage). **If this session/agent dies again before a
  completion notification arrives:** check
  `git -C .claude/worktrees/agent-ae242158d77edf0e0 log --oneline` and
  `docs/activity-log-connections-graph-plan.md` inside that worktree for
  exact status — spec/plan docs may exist there uncommitted even if no
  commit shows yet.

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
