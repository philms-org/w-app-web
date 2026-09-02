# Privacy-copy rewrite — staging activity log

**Status:** DONE

Scope: mechanical staging only. No application source files were edited by
this pass. This log turns the approved-in-principle draft in
`docs/privacy-copy-rewrite-2026-09-02.md` into exact, character-for-character
diffs against the real current file content, so applying it later (once the
founder signs off on wording) is a single mechanical step.

## Files identified as targets

Verified by reading each file directly (not assumed from the draft doc).

1. **`app/privacy/page.tsx`** — three sections change:
   - "What we collect" paragraph, lines 54–59
   - "Why we collect it" paragraph, lines 64–69
   - "How long we keep it" paragraph, lines 74–78
   - "Your controls" (lines 82–87) — draft says keep as-is; optional append only.
2. **`app/main/page.tsx`** — permission-modal body copy, **line 153** (single
   line; draft doc's "~line 153" estimate was exact).
3. **`components/home/CheckedInHero.tsx`** — checked-in indicator text,
   **line 280** (draft doc estimated "~line 246" — actual current line is
   280; file has grown since the draft was written). Note: the "📍" in the
   draft's before/after quotes represents the adjacent `<MapPin>` icon
   component (line 279), not literal text — the text node itself has no
   emoji in it today and none should be added; only the sentence after the
   icon changes.

## Prepared patches (ready to apply on founder sign-off)

### Patch 1 — `app/privacy/page.tsx`, "What we collect" (lines 52–60)

BEFORE (exact):
```tsx
        <div style={sectionStyle}>
          <h2 style={headingStyle}>What we collect</h2>
          <p style={bodyStyle}>
            While you&apos;re checked in to a venue, we periodically record your approximate position
            within that venue. This only happens while you have an active check-in — we don&apos;t
            track your location before you check in, after you check out, or anywhere outside the
            venue you&apos;re checked into.
          </p>
        </div>
```

AFTER:
```tsx
        <div style={sectionStyle}>
          <h2 style={headingStyle}>What we collect</h2>
          <p style={bodyStyle}>
            Some venues divide their space into named areas (for example &ldquo;Main Bar&rdquo; or
            &ldquo;Patio&rdquo;). While you&apos;re checked in to a venue like that, about once every
            10 seconds your device sends its location to us, we match it to the nearest named area,
            and we store only that area name and the time — not your actual coordinates.
          </p>
          <p style={{ ...bodyStyle, marginTop: '10px' }}>
            This happens only while you have an active check-in. We don&apos;t record anything before
            you check in, after you check out, at venues that haven&apos;t defined areas, or anywhere
            outside the venue you&apos;re checked into.
          </p>
        </div>
```

*Staging note: the draft's proposed copy is two paragraphs; I split it into
two `<p>` tags (with a `marginTop: '10px'` spacer on the second, matching the
`{ ...bodyStyle, marginTop: '8px' }` spread pattern already used at line 90 of
this same file) since no section in this file currently has multi-paragraph
body copy. This is a structural/mechanical choice, not a wording change —
flagged in "Discrepancies" below in case the founder or whoever applies this
prefers a single `<p>` with a manual line break instead.*

### Patch 2 — `app/privacy/page.tsx`, "Why we collect it" (lines 62–70)

BEFORE (exact):
```tsx
        <div style={sectionStyle}>
          <h2 style={headingStyle}>Why we collect it</h2>
          <p style={bodyStyle}>
            Venue organizers use this data in aggregate to understand things like which areas of
            their venue are busiest and how long attendees typically stay. Individual attendees are
            never identified in these reports — figures below 3 people are hidden so no one can be
            singled out from a small count.
          </p>
        </div>
```

AFTER:
```tsx
        <div style={sectionStyle}>
          <h2 style={headingStyle}>Why we collect it</h2>
          <p style={bodyStyle}>
            Venue organizers see summary reports for their own venue: how many people are in each
            area, the average time people spend in each area, how people move between areas, and
            what share of their attendees also visited other venues nearby. <strong>Reports show
            area names and totals only — never your name, your account, or your coordinates.</strong>
          </p>
          <p style={{ ...bodyStyle, marginTop: '10px' }}>
            Head-count figures — how many people are in an area, and how many of a venue&apos;s
            attendees also went to another venue — are hidden when fewer than 3 people are involved,
            so no one can be picked out of a small number. Average-time and area-to-area movement
            figures can be shown for smaller groups; they still carry no identifying information, but
            a venue could in principle relate them to who was present at the time.
          </p>
        </div>
```

*Staging note: same two-`<p>` treatment as Patch 1, for the same reason. The
draft's `**bold**` markdown is rendered as `<strong>` — no other emphasis
styling exists in this file to match against.*

### Patch 3 — `app/privacy/page.tsx`, "How long we keep it" (lines 72–79)

BEFORE (exact):
```tsx
        <div style={sectionStyle}>
          <h2 style={headingStyle}>How long we keep it</h2>
          <p style={bodyStyle}>
            Raw position data is deleted within 48 hours. Only the aggregated, anonymized statistics
            derived from it (e.g. &ldquo;Main Bar was busiest at 9pm&rdquo;) are kept longer, for the
            venue&apos;s ongoing reporting.
          </p>
        </div>
```

AFTER:
```tsx
        <div style={sectionStyle}>
          <h2 style={headingStyle}>How long we keep it</h2>
          <p style={bodyStyle}>
            Area-and-time records are deleted within 48 hours — an automated job runs every hour.{' '}
            <strong>Nothing derived from them is stored separately.</strong> Each time an organizer
            opens their report it&apos;s recalculated from scratch using only the last 48 hours of
            data, so anything older has already disappeared from every report.
          </p>
        </div>
```

### Patch 4 (OPTIONAL, not decided) — `app/privacy/page.tsx`, "Your controls" (lines 81–88)

Draft doc says current text is accurate and to **keep as-is**, with an
*optional* appended sentence. This is NOT a firm instruction — do not apply
unless the founder explicitly says to append it.

BEFORE (exact, for reference — unchanged unless the optional append is approved):
```tsx
        <div style={sectionStyle}>
          <h2 style={headingStyle}>Your controls</h2>
          <p style={bodyStyle}>
            You can deny or revoke location access at any time in your browser or device settings.
            Without location access, you can still use The W App, but you won&apos;t be able to check
            in to venues or see nearby locations.
          </p>
        </div>
```

IF the founder approves the optional append, insert this second `<p>`
immediately after the existing one (before the closing `</div>`):
```tsx
          <p style={{ ...bodyStyle, marginTop: '10px' }}>
            Denying location doesn&apos;t delete area-and-time records already collected during a past
            check-in; those age out on the normal 48-hour schedule.
          </p>
```

### Patch 5 — `app/main/page.tsx`, permission modal body (line 153)

BEFORE (exact, single line, 14-space indent):
```tsx
              The W App works best when we know your location. This helps us show you nearby people and places to connect. While you&apos;re checked in to a venue, we also share your approximate position with that venue for anonymized attendance analytics — never before check-in or after checkout.
```

AFTER:
```tsx
              The W App works best when we know your location — it&apos;s how we show you nearby people and places. While you&apos;re checked in to a venue that has defined areas, we also match your location to those areas (like &ldquo;Main Bar&rdquo;) so the organizer can see which areas are busy. They see totals for their venue only — never your name or your exact location — and this stops the moment you check out.
```

*This is a same-element, same-styling, text-only swap inside the existing
`<p style={{...}}>...</p>` at line 146–154 — no JSX structure changes.*

### Patch 6 — `components/home/CheckedInHero.tsx`, checked-in indicator (line 280)

BEFORE (exact, 12-space indent, immediately after the `<MapPin .../>` icon on line 279):
```tsx
            Sharing location with this venue while checked in — Learn more
```

AFTER — **two options, founder must pick one (see Decisions §3 in the draft doc)**:

Option A (recommended by draft, copy-only, no behavior change):
```tsx
            Location is used for this venue&apos;s area analytics while you&apos;re checked in — Learn more
```

Option B (fallback conditional copy, if the founder doesn't want to touch
`CheckedInHero`'s zone-gating behavior right now):
```tsx
            If this venue has defined areas, your location is used for its analytics while you&apos;re checked in — Learn more
```

*Neither option requires a JSX structure change — both are a straight text
swap inside the existing `<Link>` at lines 266–282. The draft doc's
recommended behavior change (gate the whole `checkedIn && (...)` block on
"venue has ≥1 zone", not just swap copy) is a code change, not a copy
change, and is explicitly out of scope for this mechanical staging pass —
see Discrepancies below.*

## Discrepancies / concerns found

1. **Draft doc's line-number estimate drifted for `CheckedInHero.tsx`.** Doc
   says "~line 246"; actual current line is 280. Not a wording problem, just
   noting the file has changed since 2026-09-02 draft was written — verify
   line numbers again before applying if more time passes.

2. **Two-paragraph rendering is a staging judgment call, not specified by
   the draft.** The draft's proposed copy for "What we collect" and "Why we
   collect it" is written as two markdown paragraphs each. I rendered them
   as two `<p>` tags with a `marginTop: '10px'` spacer (matching an existing
   spacing pattern elsewhere in the file). This is the most natural
   mechanical translation, but it's a structural choice I made, not one the
   draft doc specified — whoever applies this should sanity-check the
   spacing looks right, or collapse back to a single `<p>` if preferred.

3. **"Your controls" section — optional append is unresolved**, per the
   draft doc itself ("optionally append..."). Not staged as a firm patch;
   staged as Patch 4 marked optional. Do not apply without explicit sign-off.

4. **Checked-in indicator (`CheckedInHero.tsx`) — copy alone doesn't fully
   resolve the truthfulness gap the draft doc raises.** The draft is explicit
   that the indicator currently shows for *every* checked-in venue, even ones
   with zero zones (where nothing is ever recorded), and that the *ideal* fix
   is a behavior change (gate the indicator on the venue having ≥1 zone) —
   copy Option B is presented by the draft only as a fallback if that
   behavior change isn't wanted yet. This is item 3 of the draft's "Decisions
   needed" list and is unresolved. Per this task's instructions, gating
   behavior is a code change beyond "copy fix" scope — I have staged only the
   two copy variants (Patch 6, Options A/B) and left the behavior-change
   question for the founder/whoever applies this to decide separately.

5. **"Your controls" section doesn't mention the manual venue-picker
   fallback.** The draft doc's own "ground truth" table notes: "Without
   location you can't do geofenced check-in or see nearby venues (there is a
   manual 'pick a venue as your location' fallback)." The draft doc marks
   the current "Your controls" copy as "accurate, keep as-is" and doesn't
   propose mentioning this fallback at all — current copy says flatly "you
   won't be able to check in to venues or see nearby locations," which is a
   bit stronger than reality if that fallback exists. I have not touched
   this wording (per the "do not silently fix wording" instruction) — just
   flagging the inconsistency between the draft's own ground-truth table and
   its "keep as-is" verdict on this one section, for the founder to weigh in
   on if they want.

6. **Item 2 of the draft's "Decisions needed" (k=3 floor on dwell/transition
   figures) is a SQL/migration decision, not a copy file** — confirmed out of
   scope for this staging pass (no `app/privacy/page.tsx` etc. patch depends
   on which way that goes; the proposed copy above is honest either way,
   per the draft's own reasoning). Flagging only so it isn't lost — it's
   still an open founder decision per the draft doc, separate from the
   copy patches above.

## Next step

All patches staged and ready. Founder needs to:

1. Review the wording in `docs/privacy-copy-rewrite-2026-09-02.md` (source
   of truth for the copy itself) and the exact staged diffs in this file.
2. Decide on the two open items that affect which staged patch variant gets
   applied:
   - Patch 4 (`app/privacy/page.tsx` "Your controls" append) — apply or skip.
   - Patch 6 (`CheckedInHero.tsx` indicator) — Option A (copy-only) vs.
     Option B (conditional copy) vs. doing the recommended zone-gating
     behavior change instead/first.
3. Once approved, applying is purely mechanical — in this order:
   1. `app/privacy/page.tsx` — apply Patch 1, then Patch 2, then Patch 3
      (each is an independent, non-overlapping block within the same file —
      order doesn't matter functionally, but applying top-to-bottom avoids
      line-number drift between edits). Apply Patch 4 only if the founder
      approved the optional append.
   2. `app/main/page.tsx` — apply Patch 5 (single-line swap).
   3. `components/home/CheckedInHero.tsx` — apply Patch 6 with whichever
      option (A or B) the founder chose.
4. A lawyer should still review the final `/privacy` wording before launch
   (per the draft doc's own opening note — unchanged by this staging pass).
