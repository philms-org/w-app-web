# #TSWWS26 go-live runbook (Sparq – Innovation Quarter, Oct 2–4, 2026)

## 1. Bring the prod database up to date (BLOCKER — founder runs)

As of 2026-09-30, prod Supabase (`yatixschvikugckkpfum`) is missing migrations 0024–0031,
so the venue feed, comments, reports, announcements and profile-privacy lockdown that
`main` already ships are **broken on the live app**. QA is missing only 0029.

**Skip `0024_profiles_pii_lockdown.sql`.** It is an older version superseded by 0026.
It revokes all SELECT on `profiles`, which would break sign-up (upsert) and the admin console.

Run from the repo root:

```bash
supabase link --project-ref ducadjakxmkfcvrteoqz && supabase db query --linked < supabase/migrations/0029_venue_announcements.sql
```

```bash
supabase link --project-ref yatixschvikugckkpfum && (echo "begin;"; cat supabase/migrations/0024_venue_event_feed.sql supabase/migrations/0025_venue_feed_followups.sql supabase/migrations/0026_profiles_public_view.sql supabase/migrations/0027_auth_rate_limits.sql supabase/migrations/0028_fix_master_admin_guard.sql supabase/migrations/0029_venue_announcements.sql supabase/migrations/0030_venue_feed_comments_moderation.sql supabase/migrations/0031_announcers_and_announcement_posts.sql; echo "commit;") | supabase db query --linked
```

This runs as a single transaction, so if any statement fails nothing is applied.

## 2. Create the venue (founder, in the app, as master admin)

1. `/admin` → create venue **"Sparq – Innovation Quarter"**. Set the pin on the building and the geofence radius (~75–100 m covers the building plus the parking lot).
2. Assign the lead organizer as venue **owner**. From then on they can add co-organizers as announcers.
3. Add the event graphics (main graphic, Schedule, Mentors, Judges, Sponsors cards) as carousel banners.
4. Before Friday, check in once on site with a test account to confirm the geofence works.

## 3. Organizer cheat-sheet for the weekend

- **Announcements:** post from the venue's announcement bar. They're pinned for everyone checked in.
- **Mass message:** Organizer hub (`/main/organizer`) → message all checked-in attendees.
- **Moderation:** Organizer hub → Reports. Resolve flagged posts and comments, or delete them.
- **Send the welcome email:** `welcome-email.md` (fill in `{{support_email}}`).
