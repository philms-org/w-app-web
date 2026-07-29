# History Screen: Organizer Banner + Attendee Reconnect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing, already-shipped `components/tabs/HistoryTab.tsx` so its per-venue detail view opens with the organizer's banner photo (via the existing `HeroCarousel` component) and lets the user reconnect with people who were at that visit (via the existing `fetchAttendeeHistory` and `startConversation` functions).

**Architecture:** Single-file change to `components/tabs/HistoryTab.tsx`. Swap the current plain pill header for `HeroCarousel`. Add attendee-strip state fed by `fetchAttendeeHistory`, rendered between the header and the day-grouped feed. Add a small inline compose row that appears when an attendee is selected, which calls `startConversation` and then navigates to the Messages tab. No new files, no new data-layer functions, no schema changes.

**Tech Stack:** Next.js 15, React 19, TypeScript, zustand (`lib/store.ts`), lucide-react icons, inline `style={{}}` (this codebase's convention — no Tailwind classes).

## Global Constraints

- No new npm dependencies.
- Keep the existing inline-`style={{}}` convention in `HistoryTab.tsx` — do not migrate to Tailwind classes.
- Dark background = `#231E20` exactly (`theme.bg`). Accent = `#17BFD9` (`theme.accent`, cyan).
- No automated test suite exists in this repo — every task's verification step is `npx tsc --noEmit` plus a manual dev-server check, run with `npm run dev` from `/Users/sr/w-app-web`.
- This repo lives at `/Users/sr/w-app-web`.
- `setActiveChat` (from `lib/store.ts`) is set by `MessagesTab.tsx` today but nothing reads it — there is no chat-thread view in this app yet. Do not describe or build UI that implies one opens; after sending a reconnect message, the correct, honest behavior is navigating to the Messages tab list, where the new conversation now appears (because `fetchConversations` picks it up).

---

### Task 1: Hero carousel header

**Files:**
- Modify: `components/tabs/HistoryTab.tsx`

**Interfaces:**
- Consumes: `HeroCarousel` from `@/components/HeroCarousel` — `{ images: string[], title: string, onBack: () => void }` (existing, unmodified).
- Produces: no new exports. The detail view's outer `<div>` no longer carries page padding directly — a new inner padded `<div>` wraps everything below the carousel. Tasks 2 and 3 add their JSX inside that inner div, directly after the address paragraph.

- [ ] **Step 1: Add the import**

At the top of `components/tabs/HistoryTab.tsx`, find:

```tsx
import { fetchLastVisited, fetchFeed } from '@/lib/data';
import { theme } from '@/lib/theme';
import type { Venue, FeedItem } from '@/lib/types';
import { ChevronRight, ChevronLeft, Clock, User, BadgeCheck } from 'lucide-react';
```

Replace with:

```tsx
import { fetchLastVisited, fetchFeed } from '@/lib/data';
import { theme } from '@/lib/theme';
import type { Venue, FeedItem } from '@/lib/types';
import { ChevronRight, Clock, User, BadgeCheck } from 'lucide-react';
import HeroCarousel from '@/components/HeroCarousel';
```

(Drops `ChevronLeft` — it was only used by the back button this task removes; the carousel's own back arrow replaces it.)

- [ ] **Step 2: Replace the detail view's header**

Find (the full `if (selectedVenue)` block's opening, through the end of the pill header):

```tsx
  if (selectedVenue) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, padding: '16px 24px 24px' }}>
        <button
          onClick={() => setSelectedVenue(null)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'none',
            border: 'none',
            color: theme.accent,
            fontSize: '15px',
            fontWeight: 600,
            padding: '8px 0 16px',
            cursor: 'pointer',
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}
        >
          <ChevronLeft style={{ width: '20px', height: '20px' }} />
          History
        </button>

        <div style={{ backgroundColor: theme.pill, borderRadius: '16px', padding: '16px 20px' }}>
          <h1 style={{
            color: theme.bg,
            fontSize: '20px',
            fontWeight: 700,
            marginBottom: selectedVenue.address ? '6px' : 0,
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}>{selectedVenue.name}</h1>
          {selectedVenue.address && (
            <p style={{ color: '#919191', fontSize: '13px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
              {selectedVenue.address}
            </p>
          )}
        </div>

        {detailLoading && (
```

Replace with:

```tsx
  if (selectedVenue) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
        <HeroCarousel
          images={selectedVenue.banner_image ? [selectedVenue.banner_image] : []}
          title={selectedVenue.name}
          onBack={() => setSelectedVenue(null)}
        />

        <div style={{ padding: '16px 24px 24px' }}>
        {selectedVenue.address && (
          <p style={{ color: '#919191', fontSize: '13px', marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            {selectedVenue.address}
          </p>
        )}

        {detailLoading && (
```

- [ ] **Step 3: Close the new wrapping div**

Find the very end of the `if (selectedVenue)` return statement:

```tsx
          </div>
        ))}
      </div>
    );
  }
```

Replace with:

```tsx
          </div>
        ))}
        </div>
      </div>
    );
  }
```

- [ ] **Step 4: Verify**

Run: `cd /Users/sr/w-app-web && npx tsc --noEmit`
Expected: No errors.

Then run: `cd /Users/sr/w-app-web && npm run dev`, open the History tab, tap a venue. Confirm: the carousel renders full-bleed at the top (photo if the venue has `banner_image`, brand-gradient fallback if not), "W [venue name]" overlay text is legible, tapping the back arrow returns to the list, and the address line + feed below still render correctly inside their own padding.

- [ ] **Step 5: Commit**

```bash
git add components/tabs/HistoryTab.tsx
git commit -m "HistoryTab: use HeroCarousel for the organizer banner in the detail view"
```

---

### Task 2: "Who was there" attendee strip

**Files:**
- Modify: `components/tabs/HistoryTab.tsx`

**Interfaces:**
- Consumes: `fetchAttendeeHistory(locationId: string): Promise<Profile[]>` from `@/lib/data` (existing, unmodified). `Profile` type from `@/lib/types` (existing — has `id`, `display_name`, `avatar_url?`, `is_verified?`).
- Produces: `attendees: Profile[]` and `selectedAttendeeId: string | null` state, both consumed by Task 3.

- [ ] **Step 1: Extend imports**

Find:

```tsx
import { fetchLastVisited, fetchFeed } from '@/lib/data';
import { theme } from '@/lib/theme';
import type { Venue, FeedItem } from '@/lib/types';
```

Replace with:

```tsx
import { fetchLastVisited, fetchFeed, fetchAttendeeHistory } from '@/lib/data';
import { theme } from '@/lib/theme';
import type { Venue, FeedItem, Profile } from '@/lib/types';
```

- [ ] **Step 2: Add attendee state and fetch effect**

Find:

```tsx
export default function HistoryTab() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [groups, setGroups] = useState<DayGroup[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
```

Replace with:

```tsx
export default function HistoryTab() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [groups, setGroups] = useState<DayGroup[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [attendees, setAttendees] = useState<Profile[]>([]);
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string | null>(null);
```

Find:

```tsx
  useEffect(() => {
    if (!selectedVenue) return;
    setDetailLoading(true);
    fetchFeed(selectedVenue.id)
      .then((feed) => setGroups(groupByDay(feed)))
      .catch((err) => console.error('Failed to load venue history:', err))
      .finally(() => setDetailLoading(false));
  }, [selectedVenue]);
```

Replace with:

```tsx
  useEffect(() => {
    if (!selectedVenue) return;
    setDetailLoading(true);
    fetchFeed(selectedVenue.id)
      .then((feed) => setGroups(groupByDay(feed)))
      .catch((err) => console.error('Failed to load venue history:', err))
      .finally(() => setDetailLoading(false));
  }, [selectedVenue]);

  useEffect(() => {
    if (!selectedVenue) return;
    setAttendees([]);
    setSelectedAttendeeId(null);
    fetchAttendeeHistory(selectedVenue.id)
      .then(setAttendees)
      .catch((err) => console.error('Failed to load attendee history:', err));
  }, [selectedVenue]);
```

- [ ] **Step 3: Render the attendee strip**

Find (the address paragraph added in Task 1, immediately before `{detailLoading && (`):

```tsx
        {selectedVenue.address && (
          <p style={{ color: '#919191', fontSize: '13px', marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            {selectedVenue.address}
          </p>
        )}

        {detailLoading && (
```

Replace with:

```tsx
        {selectedVenue.address && (
          <p style={{ color: '#919191', fontSize: '13px', marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            {selectedVenue.address}
          </p>
        )}

        {attendees.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <p style={{
              color: '#919191',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '10px',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>Who was there</p>
            <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '4px' }}>
              {attendees.map((attendee) => (
                <button
                  key={attendee.id}
                  onClick={() => setSelectedAttendeeId(attendee.id === selectedAttendeeId ? null : attendee.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    flexShrink: 0,
                    width: '56px'
                  }}
                >
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: theme.pill,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: attendee.id === selectedAttendeeId ? `2px solid ${theme.accent}` : '2px solid transparent'
                  }}>
                    <span style={{ color: theme.bg, fontSize: '16px', fontWeight: 700, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                      {(attendee.display_name ?? '?').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span style={{
                    color: 'white',
                    fontSize: '10px',
                    textAlign: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%',
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}>{attendee.display_name ?? 'Someone'}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {detailLoading && (
```

- [ ] **Step 4: Verify**

Run: `cd /Users/sr/w-app-web && npx tsc --noEmit`
Expected: No errors.

Then in the running dev server, open a venue in History that has prior check-ins from other users. Confirm the "Who was there" strip renders with an avatar (initial letter) and name per attendee, and tapping one highlights it with a cyan ring (tap again to un-highlight). For a venue with no other attendees, confirm the strip section doesn't render at all (no empty box).

- [ ] **Step 5: Commit**

```bash
git add components/tabs/HistoryTab.tsx
git commit -m "HistoryTab: add 'Who was there' attendee strip via fetchAttendeeHistory"
```

---

### Task 3: Reconnect message flow

**Files:**
- Modify: `components/tabs/HistoryTab.tsx`

**Interfaces:**
- Consumes: `startConversation(recipientIds: string[], name: string | null, isGroup: boolean, firstMessage: string): Promise<Conversation>` from `@/lib/data` (existing, unmodified — requires non-empty `firstMessage`). `useStore` from `@/lib/store` for `setActiveTab` (existing, unmodified).
- Produces: no new exports.

- [ ] **Step 1: Import `useStore`**

Find:

```tsx
import { fetchLastVisited, fetchFeed, fetchAttendeeHistory } from '@/lib/data';
```

Replace with:

```tsx
import { fetchLastVisited, fetchFeed, fetchAttendeeHistory, startConversation } from '@/lib/data';
import { useStore } from '@/lib/store';
```

- [ ] **Step 2: Add compose state and the send handler**

Find:

```tsx
export default function HistoryTab() {
  const [venues, setVenues] = useState<Venue[]>([]);
```

Replace with:

```tsx
export default function HistoryTab() {
  const { setActiveTab } = useStore();
  const [venues, setVenues] = useState<Venue[]>([]);
```

Find (the end of the two `useEffect` calls added in Task 2, right before `if (selectedVenue) {`):

```tsx
  useEffect(() => {
    if (!selectedVenue) return;
    setAttendees([]);
    setSelectedAttendeeId(null);
    fetchAttendeeHistory(selectedVenue.id)
      .then(setAttendees)
      .catch((err) => console.error('Failed to load attendee history:', err));
  }, [selectedVenue]);

  if (selectedVenue) {
```

Replace with:

```tsx
  useEffect(() => {
    if (!selectedVenue) return;
    setAttendees([]);
    setSelectedAttendeeId(null);
    fetchAttendeeHistory(selectedVenue.id)
      .then(setAttendees)
      .catch((err) => console.error('Failed to load attendee history:', err));
  }, [selectedVenue]);

  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const selectedAttendee = attendees.find((a) => a.id === selectedAttendeeId) ?? null;

  const handleSendReconnect = () => {
    if (!selectedAttendee || !messageText.trim()) return;
    setSending(true);
    setSendError(null);
    startConversation([selectedAttendee.id], null, false, messageText.trim())
      .then(() => {
        setMessageText('');
        setSelectedAttendeeId(null);
        setActiveTab('messages');
      })
      .catch((err) => {
        console.error('Failed to start conversation:', err);
        setSendError("Couldn't send — try again");
      })
      .finally(() => setSending(false));
  };

  if (selectedVenue) {
```

- [ ] **Step 3: Render the compose row**

Find (the end of the attendee-strip block added in Task 2, right before `{detailLoading && (`):

```tsx
            </div>
          </div>
        )}

        {detailLoading && (
```

Replace with:

```tsx
            </div>
          </div>
        )}

        {selectedAttendee && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={`Say hi to ${selectedAttendee.display_name ?? 'them'}...`}
                style={{
                  flex: 1,
                  backgroundColor: theme.pill,
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '10px 16px',
                  fontSize: '14px',
                  color: theme.bg,
                  fontFamily: 'Montserrat, system-ui, sans-serif'
                }}
              />
              <button
                onClick={handleSendReconnect}
                disabled={sending || !messageText.trim()}
                style={{
                  backgroundColor: theme.accent,
                  color: 'white',
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: sending || !messageText.trim() ? 'default' : 'pointer',
                  opacity: sending || !messageText.trim() ? 0.6 : 1,
                  fontFamily: 'Montserrat, system-ui, sans-serif'
                }}
              >
                {sending ? 'Sending...' : 'Message'}
              </button>
            </div>
            {sendError && (
              <p style={{ color: '#EC2C91', fontSize: '12px', marginTop: '6px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                {sendError}
              </p>
            )}
          </div>
        )}

        {detailLoading && (
```

- [ ] **Step 4: Verify**

Run: `cd /Users/sr/w-app-web && npx tsc --noEmit`
Expected: No errors.

Then in the running dev server: open a venue with attendees, tap one, confirm the input + Message button appear. Type a message and tap Message. Confirm: the button shows "Sending...", then the app switches to the Messages tab, and the new conversation appears in that list with your message as the preview. Tap a different attendee first, then tap the same one again to confirm the un-highlight/hide-row toggle still works. Test the empty-input case (Message button stays disabled).

- [ ] **Step 5: Commit**

```bash
git add components/tabs/HistoryTab.tsx
git commit -m "HistoryTab: add reconnect message flow via startConversation"
```

---

### Task 4: Full manual verification pass

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Start the dev server**

Run: `cd /Users/sr/w-app-web && npm run dev`

- [ ] **Step 2: Click-through**

1. History tab → venue list renders (pink/gold gradient, unchanged from before this plan).
2. Tap a venue with `banner_image` set → carousel shows the real photo, "W [name]" overlay, back arrow works.
3. Tap a venue without `banner_image` → carousel shows the brand-gradient fallback, no broken image, no console error.
4. Venue with prior attendees → "Who was there" strip renders; tap an attendee → compose row appears; send a message → lands on Messages tab, new conversation visible with the sent text as its preview.
5. Venue with zero other attendees → strip is absent, feed section renders normally with no gap/empty box.
6. Day-grouped feed below (unchanged pre-existing behavior) still shows every attendee's posts with names and timestamps.

- [ ] **Step 3: Final typecheck**

Run: `cd /Users/sr/w-app-web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Fix anything verification turned up, then commit**

If Step 2 found no issues, skip this step — Task 3's commit is the last one needed.

If issues were found, fix them directly in `components/tabs/HistoryTab.tsx`, then:

```bash
git add -A
git commit -m "Fix issues found during History reconnect feature verification"
```
