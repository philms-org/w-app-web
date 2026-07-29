# History Screen: Organizer Banner + Attendee Reconnect — Design

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:writing-plans to turn this into a task-by-task implementation plan, then superpowers:subagent-driven-development or superpowers:executing-plans to build it.

**Goal:** Extend the existing `components/tabs/HistoryTab.tsx` (live on `main` as of `4ca9a13`) so the per-venue detail view (1) opens with the organizer-provided banner photo via the existing `HeroCarousel` component, and (2) surfaces the people who were at that visit with a one-tap way to message them — turning History from a personal log into a reconnection tool, which is the app's core value (helping people connect, and generating engagement data event organizers care about).

**Not a rebuild.** `HistoryTab.tsx` already does: fetch past venues (`fetchLastVisited`), pink/gold gradient list, tap-through to a detail view that fetches that venue's full feed (`fetchFeed`, unfiltered — already shows every attendee's posts, not just the current user's) grouped by calendar day. This spec only adds the two pieces called out above.

## Context — what already exists (reused as-is, no changes)

- `components/HeroCarousel.tsx` — `{ images: string[], title: string, onBack: () => void }`. Full-bleed photo (or brand-gradient fallback if `images` is empty) with "W [title]" overlay, back arrow, page-dot pagination for 2+ images. Already used by `MainFeedTab.tsx`'s checked-in state via `bannerImages = selectedLocation.banner_image ? [selectedLocation.banner_image] : []`.
- `lib/data.ts` → `fetchAttendeeHistory(locationId): Promise<Profile[]>` — distinct profiles who checked in `mode: 'live'` at that venue, already filtering out anyone in `attendee_history_opt_outs` for that location. Privacy handling is already built; this feature just needs to call it.
- `lib/data.ts` → `startConversation(recipientIds: string[], name: string | null, isGroup: boolean, firstMessage: string): Promise<Conversation>` — creates a conversation and sends the first message in one call. Requires a non-empty `firstMessage` (it always sends one).
- `lib/store.ts` → `setActiveChat(userId)` and `setActiveTab(tab)`, both already used by `MessagesTab.tsx` to land on a specific open conversation.
- `Venue.banner_image?: string | null` (`lib/types.ts`) — the organizer-edited photo, already threaded from `locations` through `MapTab` and the store.

## Changes to `HistoryTab.tsx`

### 1. Hero carousel header (replaces the current plain pill header in the detail view)

```tsx
import HeroCarousel from '@/components/HeroCarousel';
// ...
<HeroCarousel
  images={selectedVenue.banner_image ? [selectedVenue.banner_image] : []}
  title={selectedVenue.name}
  onBack={() => setSelectedVenue(null)}
/>
```

The address line (currently inside the pill header) moves to a plain text line directly below the carousel, matching the mockup — no pill container needed once the carousel supplies the visual weight.

### 2. "Who was there" attendee strip + reconnect CTA

New state: `attendees: Profile[]`, `selectedAttendee: Profile | null`. On `selectedVenue` change, alongside the existing `fetchFeed` call, also call `fetchAttendeeHistory(selectedVenue.id)` and store the result.

Render a horizontally-scrollable strip of circular avatars (initial letter fallback if no `avatar_url`, matching the existing avatar pattern elsewhere in the app) between the carousel and the feed. Tapping an attendee sets `selectedAttendee` and reveals an inline reconnect row: a text input (placeholder "Say hi to {name}...") + a Message button.

Submitting: call `startConversation([attendee.id], null, false, text)`, then `setActiveChat(conversation.id)` and `setActiveTab('messages')` (mirrors the exact pattern `MessagesTab.tsx` already uses to land on an open conversation). No new data-layer function needed — this composes two existing store setters and one existing data function.

If `attendees` is empty (no one else present, or everyone opted out), the strip is omitted entirely — no empty-state placeholder needed here since the day-grouped feed below still stands on its own.

### 3. Feed section

Unchanged — already groups by day and shows each poster's name, exactly matching the "actual feed of when they were there" requirement from this conversation. No code changes needed here.

## Visual design

Matches the approved mockup (`history-screen-v3`, reviewed interactively):
- List view: unchanged pink/gold gradient (`#ED6BA1` → `#EDB859`, already in the codebase) container of dark pill venue rows.
- Detail view, top to bottom: `HeroCarousel` (200px, organizer photo or brand-gradient fallback) → address caption → "Who was there" label + avatar strip → (conditionally) reconnect input row → day-grouped feed (unchanged).

## Error / empty handling

- `fetchAttendeeHistory` failure: `console.error`, strip simply doesn't render (consistent with how `fetchFeed`/`fetchLastVisited` failures are already handled in this file — logged, not surfaced as a toast).
- `startConversation` failure: `console.error` + inline error text under the input ("Couldn't send — try again"), input stays populated so the user doesn't lose what they typed.
- No venues yet / no posts for a venue: unchanged existing empty states.

## Testing / verification

1. `npx tsc --noEmit` — no errors.
2. Manual dev-server pass: History tab → venue list renders → tap a venue with a `banner_image` set → carousel shows the real photo; tap one without → gradient fallback renders, no broken image.
3. Attendee strip renders for a venue with prior check-ins; tap an attendee → reconnect row appears; type + send → navigates to Messages tab with that conversation open and the message visible.
4. Venue with zero other attendees (or all opted out) → strip omitted, feed section still renders normally.
5. Confirm the existing history list → detail → back flow (already shipped) still works unchanged.

## Out of scope

- Any admin/organizer-facing UI for uploading or editing the banner photo — `banner_image` is already an editable venue field elsewhere (`updateEvent` in `lib/data.ts`); this spec only *consumes* it.
- Multi-photo carousels for History (venue_photos-style galleries) — `HeroCarousel` already supports multiple images if `images` has more than one entry, but there's no multi-image data source wired up anywhere in the app yet (Main Feed's checked-in state has the same single-image limitation). Out of scope to build that data layer here.
- Surfacing the `attendee_history_opt_out` toggle from this screen — that control lives (or will live) in Profile/privacy settings; History only needs to respect it, not expose it.
