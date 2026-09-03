# Location-tracking disclosure copy — rewrite for review (2026-09-02)

**Why:** the current draft copy makes two claims that are false vs. the code
on `main` today (flagged in `RESUME-launch-prep.md` → "FOUNDER DECISION
NEEDED"). This doc is **path (b): rewrite the copy to match what the code
actually does.** No SQL changes. Founder to approve wording, then it gets
applied to the three files.

Nothing here is legal review — it's an accuracy pass. A lawyer should still
see the final `/privacy` text before launch.

---

## Ground truth — what the code actually does

Verified against `supabase/migrations/0011`–`0016` and
`lib/hooks/useZoneTracking.ts`.

| Behaviour | Reality |
|---|---|
| **When location is recorded** | Only while you have an **open check-in** at that venue (`record_zone_position` returns early otherwise — 0015). Only for venues that have defined "zones"/areas; for a venue with no zones the app never even starts watching position (`useZoneTracking`). |
| **What is stored** | `zone_position_fixes` = `(user_id, zone_id, recorded_at)`. Your device sends lat/lng in the RPC call; the server matches it to the **nearest named zone** and stores only that zone id + timestamp. **Raw coordinates are never persisted.** |
| **How often** | At most once per 10 seconds (`MIN_INTERVAL_MS`), low-accuracy mode. |
| **Retention** | `zone_position_fixes` rows older than 48 h are deleted — by an hourly `pg_cron` job (`purge-stale-zone-positions`, 0016) and again as a side-effect of every report load (0013/0015). |
| **Derived/aggregate storage** | **None.** There is no aggregate table. Every organizer report is recomputed live from the trailing 48 h of `zone_position_fixes` on each open. Once a fix ages out, everything derived from it disappears from the report. |
| **k=3 anonymity floor** | **Applied** to: zone **occupancy** (`having count(distinct user_id) >= 3`) and **cross-venue movement** (`having count(*) >= 3`). **Not applied** to: **average dwell time** per zone, or **zone-to-zone transition** counts — a zone with 1 person shows that person's dwell minutes / movements. |
| **What organizers see** | Zone names + numbers only (occupancy, avg dwell minutes, transition counts, cross-venue %). No names, no user ids, no coordinates. Reports are manager-gated (`is_venue_manager`, `security definer`). |
| **Cross-venue movement** | Organizer sees "X % of my attendees also checked into «named venue» within ±12 h". Based on `location_checkins`, not zone tracking. k=3 floored. The current copy doesn't mention this at all. |
| **Controls** | Deny / revoke via browser or device settings. "Maybe Later" in the modal sets a fallback location and a `locationDenied` flag. Without location you can't do geofenced check-in or see nearby venues (there is a manual "pick a venue as your location" fallback). |

### The two false claims (verbatim, current copy)

1. `/privacy` → *"Individual attendees are never identified in these reports —
   figures below 3 people are hidden so no one can be singled out from a
   small count."*
   → the k=3 hide only covers occupancy + cross-venue. **Dwell time and
   transitions are shown at any count**, including 1.

2. `/privacy` → *"Only the aggregated, anonymized statistics derived from it
   (e.g. "Main Bar was busiest at 9pm") are kept longer, for the venue's
   ongoing reporting."*
   → **false.** Nothing is kept past 48 h. There is no stored aggregate.
   The report is recomputed each time and only ever reflects the last 48 h.

---

## Surface 1 — `app/privacy/page.tsx`

### "What we collect" — CURRENT
> While you're checked in to a venue, we periodically record your approximate
> position within that venue. This only happens while you have an active
> check-in — we don't track your location before you check in, after you check
> out, or anywhere outside the venue you're checked into.

### "What we collect" — PROPOSED
> Some venues divide their space into named areas (for example "Main Bar" or
> "Patio"). While you're checked in to a venue like that, about once every
> 10 seconds your device sends its location to us, we match it to the nearest
> named area, and we store **only that area name and the time** — not your
> actual coordinates.
>
> This happens only while you have an active check-in. We don't record
> anything before you check in, after you check out, at venues that haven't
> defined areas, or anywhere outside the venue you're checked into.

*Why: "record your approximate position" overstates it — coordinates are
never stored, only a matched area name. Also adds the "venues with areas
only" condition, which is real.*

### "Why we collect it" — CURRENT
> Venue organizers use this data in aggregate to understand things like which
> areas of their venue are busiest and how long attendees typically stay.
> Individual attendees are never identified in these reports — figures below
> 3 people are hidden so no one can be singled out from a small count.

### "Why we collect it" — PROPOSED
> Venue organizers see summary reports for their own venue: how many people
> are in each area, the average time people spend in each area, how people
> move between areas, and what share of their attendees also visited other
> venues nearby. **Reports show area names and totals only — never your name,
> your account, or your coordinates.**
>
> Head-count figures — how many people are in an area, and how many of a
> venue's attendees also went to another venue — are hidden when fewer than
> 3 people are involved, so no one can be picked out of a small number.
> Average-time and area-to-area movement figures can be shown for smaller
> groups; they still carry no identifying information, but a venue could in
> principle relate them to who was present at the time.

*Why: this is the core correction. It scopes the "below 3 is hidden" claim
to the two figures it actually covers, and is candid that dwell/transition
figures aren't floored — while making clear no report names anyone.*

### "How long we keep it" — CURRENT
> Raw position data is deleted within 48 hours. Only the aggregated,
> anonymized statistics derived from it (e.g. "Main Bar was busiest at 9pm")
> are kept longer, for the venue's ongoing reporting.

### "How long we keep it" — PROPOSED
> Area-and-time records are deleted within 48 hours — an automated job runs
> every hour. **Nothing derived from them is stored separately.** Each time
> an organizer opens their report it's recalculated from scratch using only
> the last 48 hours of data, so anything older has already disappeared from
> every report.

*Why: removes the false "kept longer" claim and the misleading "busiest at
9pm" example, which implies a lasting record.*

### "Your controls" — CURRENT / PROPOSED
Current text is accurate. **Keep as-is** (optionally append: *"Denying
location doesn't delete area-and-time records already collected during a
past check-in; those age out on the normal 48-hour schedule."*)

---

## Surface 2 — permission modal, `app/main/page.tsx` (~line 153)

### CURRENT
> The W App works best when we know your location. This helps us show you
> nearby people and places to connect. While you're checked in to a venue,
> we also share your approximate position with that venue for anonymized
> attendance analytics — never before check-in or after checkout.

### PROPOSED
> The W App works best when we know your location — it's how we show you
> nearby people and places. While you're checked in to a venue that has
> defined areas, we also match your location to those areas (like "Main
> Bar") so the organizer can see which areas are busy. They see totals for
> their venue only — never your name or your exact location — and this stops
> the moment you check out.

*Why: "share your approximate position with that venue" reads as "the venue
sees where I am". They see aggregate area counts. Also adds the "venue with
areas" condition.*

---

## Surface 3 — checked-in indicator, `components/home/CheckedInHero.tsx` (~line 246)

### CURRENT
> 📍 Sharing location with this venue while checked in — Learn more

### PROPOSED (copy-only)
> 📍 Location is used for this venue's area analytics while you're checked in
> — Learn more

**Behaviour note (recommended, small):** the indicator currently shows for
*every* checked-in venue, even ones with no zones where nothing is recorded.
Gating it on "venue has ≥1 zone" would make it truthful without copy
gymnastics — a few lines in `CheckedInHero` (a `venue_zones` head-count
check, same pattern as `useZoneTracking`). If you'd rather not touch
behaviour now, the fallback copy is:
> 📍 If this venue has defined areas, your location is used for its
> analytics while you're checked in — Learn more

---

## Decisions needed from you

1. **Approve / edit** the proposed text for surfaces 1–3.
2. **Dwell time & transitions with no k=3 floor** — the proposed copy is
   honest about this. Alternative is path (a): add `having count(distinct
   user_id) >= 3` to the `dwell` and `transitions` CTEs in a new migration,
   then the simpler "all figures hidden below 3" copy becomes true. ~10 lines
   of SQL + a QA/prod apply. Your call which way.
3. **Checked-in indicator** — gate it on "venue has areas" (small behaviour
   change, cleaner) or ship the conditional copy?
4. Confirm a lawyer reviews the final `/privacy` wording before launch.
