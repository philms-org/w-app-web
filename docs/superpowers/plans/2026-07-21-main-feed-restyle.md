# Main Feed Restructure + Dark Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the W App web tab bar from 5 tabs to 3 (Map, Main Feed, Messages), merge `HomeTab`+`LocationTab` into one `MainFeedTab` with two states, and restyle the app to the real dark (`#231E20`) + cyan/pink brand theme instead of the current light theme — while removing all "wing" terminology/imagery.

**Architecture:** Introduce a single `lib/theme.ts` color-token module, rebuild `TabBar.tsx` around 3 tabs with a plain W glyph, build a new `MainFeedTab.tsx` that reuses `LocationTab`'s existing dark, on-brand empty-state and checked-in-state UI almost verbatim, and do targeted background/text-color fixes in `MapTab.tsx`, `MessagesTab.tsx`, and `ProfileTab.tsx` rather than full rewrites.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind v4 (installed but not used for styling — inline `style={{}}` is the codebase's actual convention), zustand (`lib/store.ts`), lucide-react icons.

## Global Constraints

- No new npm dependencies.
- Keep the existing inline-`style={{}}` convention — do not migrate to Tailwind classes.
- Dark background = `#231E20` exactly (matches existing `.text-w-black` in `app/globals.css`, sourced from the iOS asset catalog's `Colors.black`).
- Pill/card background = `#F0F6FA` (`Colors.back_gray`). Accent = `#17BFD9` (cyan, `Colors.blue`). Accent2 = `#EC2C91` (pink, `Colors.pink`).
- No "wing" terminology or wing-shaped imagery anywhere in code, comments, or UI copy.
- No automated test suite exists in this repo (confirmed via `package.json` — no test runner installed). Every task's verification step is a manual dev-server check, run with `npm run dev` from `/Users/sr/w-app-web`.
- This repo lives at `/Users/sr/w-app-web` (not `~/Downloads/wings-main` — moved 2026-07-21 due to a macOS permissions issue).

---

### Task 1: Color tokens

**Files:**
- Create: `lib/theme.ts`
- Modify: `app/globals.css` (add one utility class)

**Interfaces:**
- Produces: `theme.bg`, `theme.pill`, `theme.accent`, `theme.accent2` (all `string`, hex colors) — imported as `import { theme } from '@/lib/theme'` by Tasks 2, 4, 6, 7, 8.

- [ ] **Step 1: Create `lib/theme.ts`**

```ts
export const theme = {
  bg: '#231E20',       // Colors.black (iOS view background)
  pill: '#F0F6FA',      // Colors.back_gray (iOS field/card background)
  accent: '#17BFD9',    // Colors.blue (cyan)
  accent2: '#EC2C91',   // Colors.pink
} as const;
```

- [ ] **Step 2: Add a dark-background utility class to `app/globals.css`**

Find this existing block (around line 17-20):

```css
.text-w-blue { color: #17BFD9; }
.text-w-pink { color: #EC2C91; }
.text-w-black { color: #231E20; }
.text-w-dark-gray { color: #919191; }
```

Add a matching background utility directly above it:

```css
.bg-w-black { background-color: #231E20; }

.text-w-blue { color: #17BFD9; }
.text-w-pink { color: #EC2C91; }
.text-w-black { color: #231E20; }
.text-w-dark-gray { color: #919191; }
```

- [ ] **Step 3: Verify**

Run: `cd /Users/sr/w-app-web && npx tsc --noEmit`
Expected: No new errors (the file has no imports to break).

- [ ] **Step 4: Commit**

```bash
git add lib/theme.ts app/globals.css
git commit -m "Add shared color tokens matching the iOS asset catalog"
```

---

### Task 2: Tab bar restructure (3 tabs, plain W, dark)

**Files:**
- Modify: `components/TabBar.tsx` (full rewrite)

**Interfaces:**
- Consumes: `theme` from Task 1 (`lib/theme.ts`).
- Produces: `TabBar` now renders tab ids `'map' | 'feed' | 'messages'` only (no `'home'`, `'location'`, `'profile'` icons). `activeTab`/`onTabChange`/`unreadCount` props unchanged.

- [ ] **Step 1: Replace the full contents of `components/TabBar.tsx`**

```tsx
'use client';

import { MapPin, MessageCircle } from 'lucide-react';
import { theme } from '@/lib/theme';

interface TabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  unreadCount?: number;
}

export default function TabBar({ activeTab, onTabChange, unreadCount = 0 }: TabBarProps) {
  const tabs = [
    { id: 'map', label: 'Map', icon: MapPin },
    { id: 'feed', label: 'Main Feed', icon: null },
    { id: 'messages', label: 'Messages', icon: MessageCircle },
  ];

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.bg,
      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      height: '64px',
      paddingBottom: 'env(safe-area-inset-bottom)',
      zIndex: 50
    }}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const color = isActive ? theme.accent : '#919191';

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              height: '100%',
              color,
              transition: 'color 0.2s ease',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}
          >
            <div style={{ position: 'relative' }}>
              {tab.id === 'feed' ? (
                <span style={{
                  fontSize: '22px',
                  fontWeight: 'bold',
                  lineHeight: 1,
                  color,
                  fontFamily: 'Montserrat, system-ui, sans-serif'
                }}>
                  W
                </span>
              ) : (
                Icon && <Icon style={{ width: '24px', height: '24px' }} strokeWidth={isActive ? 2.5 : 2} />
              )}

              {tab.id === 'messages' && unreadCount > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  width: '20px',
                  height: '20px',
                  backgroundColor: theme.accent2,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                </div>
              )}
            </div>
            <span style={{ fontSize: '12px', marginTop: '4px' }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
```

Note: this removes the old SVG icon entirely — including its `{/* Left Wing */}` / `{/* Right Wing */}` comments — replacing it with a plain bold "W" glyph. No wing imagery remains anywhere in this file.

- [ ] **Step 2: Verify**

Run: `cd /Users/sr/w-app-web && npx tsc --noEmit`
Expected: New errors referencing `'home'`, `'location'`, `'profile'` tab ids in `app/main/page.tsx` are expected at this point (Task 5 fixes them) — confirm no errors *inside* `components/TabBar.tsx` itself.

- [ ] **Step 3: Commit**

```bash
git add components/TabBar.tsx
git commit -m "Restructure tab bar to 3 tabs (Map/Main Feed/Messages), drop wing icon"
```

---

### Task 3: Store default tab rename

**Files:**
- Modify: `lib/store.ts:97`

**Interfaces:**
- Consumes: nothing new.
- Produces: `useStore.getState().activeTab` now defaults to `'feed'` instead of `'home'`.

- [ ] **Step 1: Change the default `activeTab` value**

In `lib/store.ts`, find (around line 97):

```ts
      activeTab: 'home',
```

Replace with:

```ts
      activeTab: 'feed',
```

Note: `activeTab` is not in the store's `partialize` list (only `user`, `token`, `isAuthenticated` persist to localStorage), so this default change is safe with no migration needed for existing users.

- [ ] **Step 2: Verify**

Run: `cd /Users/sr/w-app-web && npx tsc --noEmit`
Expected: Same pre-existing errors as after Task 2 (still waiting on Task 5), nothing new from this file.

- [ ] **Step 3: Commit**

```bash
git add lib/store.ts
git commit -m "Default activeTab to 'feed' (renamed from 'home')"
```

---

### Task 4: Build `MainFeedTab.tsx`

**Files:**
- Create: `components/tabs/MainFeedTab.tsx`

**Interfaces:**
- Consumes: `theme` (Task 1); `useStore` for `selectedLocation`, `setSelectedLocation`, `setActiveTab` (unchanged store shape); `checkIn`, `checkOut`, `fetchPresence` from `lib/data.ts` (unchanged signatures, reused verbatim from the old `LocationTab.tsx`).
- Produces: default export `MainFeedTab` — a self-contained component with no props, used by Task 5.

- [ ] **Step 1: Create `components/tabs/MainFeedTab.tsx`**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { checkIn, checkOut, fetchPresence } from '@/lib/data';
import { theme } from '@/lib/theme';
import { MapPin, Users, LogOut, User, Heart, Briefcase, Clock, Trophy, UserCircle } from 'lucide-react';

export default function MainFeedTab() {
  const { selectedLocation, setSelectedLocation, setActiveTab } = useStore();
  const [peopleHere, setPeopleHere] = useState<any[]>([]);
  const [comingSoon, setComingSoon] = useState<'history' | 'rewards' | null>(null);

  useEffect(() => {
    if (!selectedLocation) return;

    checkIn(selectedLocation.id).catch((err) => console.error('Check-in failed:', err));

    fetchPresence(selectedLocation.id)
      .then((rows) => {
        setPeopleHere(
          rows.map((row) => ({
            id: row.id,
            name: row.profiles?.display_name ?? 'Someone',
            bio: row.profiles?.profession ?? '',
            lookingFor: [
              ...(row.profiles?.socialising_id ? ['socializing'] : []),
              ...(row.profiles?.networking_id ? ['business'] : []),
              ...(row.profiles?.dating_id ? ['love'] : []),
            ],
            distance: 'here now',
          }))
        );
      })
      .catch((err) => console.error('Failed to load presence:', err));
  }, [selectedLocation]);

  const handleCheckIn = () => {
    setActiveTab('messages');
  };

  const handleLeaveLocation = () => {
    if (selectedLocation) {
      checkOut(selectedLocation.id).catch((err) => console.error('Check-out failed:', err));
    }
    setSelectedLocation(null);
    setActiveTab('map');
  };

  const quickAccessItems = [
    { id: 'history' as const, label: 'History', icon: Clock },
    { id: 'rewards' as const, label: 'Rewards', icon: Trophy },
    { id: 'profile' as const, label: 'Profile', icon: UserCircle },
  ];

  const handleQuickAccess = (id: 'history' | 'rewards' | 'profile') => {
    if (id === 'profile') {
      setActiveTab('profile');
      return;
    }
    setComingSoon(id);
  };

  if (!selectedLocation) {
    return (
      <div style={{
        minHeight: '100vh',
        background: `
          radial-gradient(circle at center, rgba(23, 191, 217, 0.1) 0%, rgba(0, 0, 0, 0.9) 100%),
          url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80"><defs><pattern id="brick" width="200" height="80" patternUnits="userSpaceOnUse"><rect width="200" height="80" fill="%23222"/><rect width="96" height="36" x="2" y="2" fill="%23333" rx="2"/><rect width="96" height="36" x="102" y="2" fill="%232a2a2a" rx="2"/><rect width="96" height="36" x="52" y="42" fill="%232d2d2d" rx="2"/><rect width="44" height="36" x="2" y="42" fill="%232f2f2f" rx="2"/><rect width="44" height="36" x="154" y="42" fill="%23272727" rx="2"/></pattern></defs><rect width="200" height="80" fill="url(%23brick)"/></svg>') repeat
        `,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative'
      }}>
        <div style={{ position: 'absolute', top: '80px', textAlign: 'center', width: '100%' }}>
          <h1 style={{
            color: theme.accent,
            fontSize: '32px',
            fontWeight: 'bold',
            fontFamily: 'Montserrat, system-ui, sans-serif',
            textShadow: '0 0 20px rgba(23, 191, 217, 0.8), 0 0 40px rgba(23, 191, 217, 0.4)',
            marginBottom: '8px'
          }}>
            Locations nearby
          </h1>
        </div>

        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          width: '100%',
          maxWidth: '350px'
        }}>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '48px' }}>
            <div style={{
              position: 'absolute',
              top: '-20px',
              left: '-20px',
              width: '120px',
              height: '120px',
              background: 'radial-gradient(circle, rgba(23, 191, 217, 0.4) 0%, transparent 70%)',
              borderRadius: '50%',
              animation: 'pulse 2s ease-in-out infinite'
            }}></div>

            <div style={{
              width: '80px',
              height: '80px',
              backgroundColor: '#000000',
              borderRadius: '50% 50% 50% 0',
              transform: 'rotate(-45deg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `3px solid ${theme.accent}`,
              boxShadow: '0 0 40px rgba(23, 191, 217, 0.8), inset 0 0 20px rgba(23, 191, 217, 0.2)',
              position: 'relative'
            }}>
              <span style={{
                fontSize: '32px',
                fontWeight: 'bold',
                background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                transform: 'rotate(45deg)',
                fontFamily: 'Montserrat, system-ui, sans-serif',
                textShadow: '0 0 10px rgba(23, 191, 217, 0.5)'
              }}>
                W
              </span>
            </div>
          </div>

          <p style={{
            color: 'white',
            fontSize: '18px',
            fontFamily: 'Montserrat, system-ui, sans-serif',
            textAlign: 'center',
            lineHeight: 1.4,
            marginBottom: '48px',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
          }}>
            You are not checked into a location. Go to the map to see nearby locations.
          </p>
        </div>

        <div style={{
          position: 'absolute',
          bottom: '200px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '24px'
        }}>
          {quickAccessItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleQuickAccess(item.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: theme.pill,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(23, 191, 217, 0.3)'
                }}>
                  <Icon style={{ width: '24px', height: '24px', color: theme.bg }} />
                </div>
                <span style={{
                  color: 'white',
                  fontSize: '12px',
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
                }}>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{
          position: 'absolute',
          bottom: '120px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '300px',
          padding: '0 24px'
        }}>
          <button
            onClick={() => setActiveTab('map')}
            style={{
              width: '100%',
              background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)`,
              color: 'white',
              fontWeight: '600',
              padding: '16px 32px',
              borderRadius: '16px',
              border: `2px solid ${theme.accent}`,
              cursor: 'pointer',
              fontSize: '18px',
              fontFamily: 'Montserrat, system-ui, sans-serif',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 0 30px rgba(23, 191, 217, 0.6)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <span style={{
              fontSize: '20px',
              background: `linear-gradient(135deg, ${theme.accent2} 0%, ${theme.accent} 100%)`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>➤</span>
            Explore Locations
            <div style={{
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
              animation: 'shimmer 2s ease-in-out infinite'
            }}></div>
          </button>
        </div>

        {comingSoon && (
          <div
            onClick={() => setComingSoon(null)}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              zIndex: 2000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px'
            }}
          >
            <div style={{
              backgroundColor: theme.pill,
              borderRadius: '16px',
              padding: '32px 24px',
              maxWidth: '320px',
              textAlign: 'center'
            }}>
              <h3 style={{
                fontSize: '20px',
                fontWeight: '700',
                marginBottom: '8px',
                color: theme.bg,
                fontFamily: 'Montserrat, system-ui, sans-serif',
                textTransform: 'capitalize'
              }}>{comingSoon} — Coming Soon</h3>
              <p style={{ color: '#919191', fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                This screen is on the way. Check back soon.
              </p>
            </div>
          </div>
        )}

        <style jsx>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.6; transform: scale(0.95); }
            50% { opacity: 1; transform: scale(1.05); }
          }
          @keyframes shimmer {
            0% { left: -100%; }
            100% { left: 100%; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
      <div className="bg-gradient-w px-6 pt-12 pb-6 safe-top">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h1 className="text-white text-2xl font-bold mb-1">{selectedLocation.name}</h1>
            <p className="text-white/80 text-sm">{selectedLocation.description}</p>
          </div>
          <button onClick={handleLeaveLocation} className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
            <LogOut className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-white/80" />
            <span className="text-white font-medium">
              {selectedLocation.count} {selectedLocation.count === 1 ? 'person' : 'people'} here
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-white/80" />
            <span className="text-white font-medium">{selectedLocation.radius}m radius</span>
          </div>
        </div>
      </div>

      <div className="px-6 -mt-3 mb-6">
        <div className="bg-w-back-gray rounded-xl p-3 shadow-sm flex gap-2">
          <button className="flex-1 py-2 bg-w-light-blue text-w-blue rounded-lg font-medium">
            Share Location
          </button>
          <button className="flex-1 py-2 bg-pink-50 text-w-pink rounded-lg font-medium">
            Invite Friends
          </button>
        </div>
      </div>

      <div className="px-6">
        <h3 className="font-semibold mb-4 text-white">People Here Now</h3>

        <div className="space-y-3">
          {peopleHere.map((person) => (
            <div key={person.id} className="bg-w-back-gray rounded-xl p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 bg-w-light-gray rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-w-dark-gray" />
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{person.name}</h4>
                  </div>
                  {person.bio && <p className="text-w-dark-gray text-sm mb-2">{person.bio}</p>}

                  <div className="flex gap-2 mb-3">
                    {person.lookingFor.includes('socializing') && (
                      <span className="badge-socializing flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Socializing
                      </span>
                    )}
                    {person.lookingFor.includes('business') && (
                      <span className="badge-business flex items-center gap-1">
                        <Briefcase className="w-3 h-3" />
                        Business
                      </span>
                    )}
                    {person.lookingFor.includes('love') && (
                      <span className="badge-love flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        Love
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-w-dark-gray text-sm">{person.distance}</span>
                    <button
                      onClick={handleCheckIn}
                      className="bg-w-blue text-white px-4 py-1.5 rounded-full text-sm font-medium
                                hover:opacity-90 active:scale-95 transition-all"
                    >
                      Check In
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {peopleHere.length === 0 && (
          <div className="bg-w-back-gray rounded-xl p-6 text-center">
            <Users className="w-12 h-12 text-w-light-gray mx-auto mb-3" />
            <p className="text-w-dark-gray">No one else is here yet</p>
            <p className="text-w-dark-gray text-sm mt-1">Be the first to check in!</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `cd /Users/sr/w-app-web && npx tsc --noEmit`
Expected: No errors inside `components/tabs/MainFeedTab.tsx` itself.

- [ ] **Step 3: Commit**

```bash
git add components/tabs/MainFeedTab.tsx
git commit -m "Add MainFeedTab: merges Home+Location empty/checked-in states, adds quick-access row"
```

---

### Task 5: Wire `MainFeedTab` into the app, delete old tab files

**Files:**
- Modify: `app/main/page.tsx`
- Delete: `components/tabs/HomeTab.tsx`
- Delete: `components/tabs/LocationTab.tsx`

**Interfaces:**
- Consumes: `MainFeedTab` (Task 4), `theme` (Task 1).
- Produces: `app/main/page.tsx` no longer imports or renders `HomeTab`/`LocationTab`; tab switch handles `'map' | 'feed' | 'messages' | 'profile'` only.

- [ ] **Step 1: Update imports in `app/main/page.tsx`**

Find:

```tsx
import TabBar from '@/components/TabBar';
import HomeTab from '@/components/tabs/HomeTab';
import MapTab from '@/components/tabs/MapTab';
import LocationTab from '@/components/tabs/LocationTab';
import MessagesTab from '@/components/tabs/MessagesTab';
import ProfileTab from '@/components/tabs/ProfileTab';
import { MapPin, X } from 'lucide-react';
```

Replace with:

```tsx
import TabBar from '@/components/TabBar';
import MainFeedTab from '@/components/tabs/MainFeedTab';
import MapTab from '@/components/tabs/MapTab';
import MessagesTab from '@/components/tabs/MessagesTab';
import ProfileTab from '@/components/tabs/ProfileTab';
import { theme } from '@/lib/theme';
import { MapPin } from 'lucide-react';
```

(Drops the unused `X` import — it was never referenced in this file's JSX.)

- [ ] **Step 2: Update the `renderTab` switch**

Find:

```tsx
  const renderTab = () => {
    switch (activeTab) {
      case 'home':
        return <HomeTab />;
      case 'map':
        return <MapTab />;
      case 'location':
        return <LocationTab />;
      case 'messages':
        return <MessagesTab />;
      case 'profile':
        return <ProfileTab />;
      default:
        return <HomeTab />;
    }
  };
```

Replace with:

```tsx
  const renderTab = () => {
    switch (activeTab) {
      case 'map':
        return <MapTab />;
      case 'feed':
        return <MainFeedTab />;
      case 'messages':
        return <MessagesTab />;
      case 'profile':
        return <ProfileTab />;
      default:
        return <MainFeedTab />;
    }
  };
```

- [ ] **Step 3: Fix the off-brand hover color on the location-permission modal's primary button**

Find (inside the `showLocationPrompt` modal JSX):

```tsx
                onMouseOver={(e) => e.target.style.backgroundColor = '#0EA5E9'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#17BFD9'}
```

Replace with:

```tsx
                onMouseOver={(e) => e.target.style.backgroundColor = theme.accent2}
                onMouseOut={(e) => e.target.style.backgroundColor = theme.accent}
```

(`#0EA5E9` is not a brand color anywhere else in the app; the modal card itself — white on a dark scrim — already matches the brand's light-pill-on-dark pattern and needs no other change.)

- [ ] **Step 4: Delete the superseded tab files**

```bash
git rm components/tabs/HomeTab.tsx components/tabs/LocationTab.tsx
```

- [ ] **Step 5: Verify**

Run: `cd /Users/sr/w-app-web && npx tsc --noEmit`
Expected: No errors. This is the first point where the full app should type-check cleanly again.

Then run: `cd /Users/sr/w-app-web && npm run dev`
Open `http://localhost:3000/main` in a browser (logged in as an existing test user, or via the auth flow), and confirm:
- Tab bar shows exactly 3 icons: pin (Map), W (Main Feed), envelope (Messages)
- Main Feed loads with the dark empty-state (no crash, no light-background flash)
- Quick-access row (History, Rewards, Profile) renders below the empty-state message

- [ ] **Step 6: Commit**

```bash
git add app/main/page.tsx
git commit -m "Wire MainFeedTab into app, drop Home/Location tabs, fix modal hover color"
```

---

### Task 6: `MapTab` — fix stale tab id + dark restyle

**Files:**
- Modify: `components/tabs/MapTab.tsx`

**Interfaces:**
- Consumes: `theme` (Task 1).
- Produces: no interface changes — same default export, same props (none).

- [ ] **Step 1: Add the theme import**

Find:

```tsx
import { Search, Filter, MapPin, Users, Navigation, X } from 'lucide-react';
import dynamic from 'next/dynamic';
```

Replace with:

```tsx
import { Search, Filter, MapPin, Users, Navigation, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { theme } from '@/lib/theme';
```

- [ ] **Step 2: Fix the stale `setActiveTab('location')` call**

Find (in `handleLocationSelect`):

```tsx
  const handleLocationSelect = (location: any) => {
    setSelectedLocation(location);
    setActiveTab('location');
  };
```

Replace with:

```tsx
  const handleLocationSelect = (location: any) => {
    setSelectedLocation(location);
    setActiveTab('feed');
  };
```

(`'location'` no longer maps to any case in `app/main/page.tsx`'s `renderTab` switch after Task 5 — without this fix, selecting a venue would silently fall through to the `default` case instead of showing the checked-in Main Feed state.)

- [ ] **Step 3: Restyle the outer page background**

Find:

```tsx
    <div style={{ minHeight: '100vh', backgroundColor: '#F0F6FA', position: 'relative' }}>
```

Replace with:

```tsx
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, position: 'relative' }}>
```

This is the only background change needed in this file: the floating search header, the "Nearby Locations" bottom sheet, and the "Add New Location" modal all already have their own explicit white/light backgrounds (the brand's light-pill-on-dark pattern), and the map itself covers most of the viewport regardless.

- [ ] **Step 4: Verify**

Run: `cd /Users/sr/w-app-web && npx tsc --noEmit`
Expected: No errors.

Then in the running dev server, open the Map tab and confirm: any visible page background (edges outside the map/header/list) is dark, not light; selecting a venue navigates to the Main Feed's checked-in state (not a blank/default screen).

- [ ] **Step 5: Commit**

```bash
git add components/tabs/MapTab.tsx
git commit -m "MapTab: fix stale 'location' tab id, restyle page background to dark"
```

---

### Task 7: `MessagesTab` — dark restyle + contrast fix

**Files:**
- Modify: `components/tabs/MessagesTab.tsx`

**Interfaces:**
- Consumes: `theme` (Task 1).
- Produces: no interface changes.

- [ ] **Step 1: Add the theme import, drop unused imports**

Find:

```tsx
import { Search, MoreVertical, Check, CheckCheck, MessageCircle } from 'lucide-react';
import Image from 'next/image';
```

Replace with:

```tsx
import { Search, MessageCircle } from 'lucide-react';
import { theme } from '@/lib/theme';
```

(Drops `MoreVertical`, `Check`, `CheckCheck`, and the unused `Image` import — none were referenced anywhere in this file's JSX.)

- [ ] **Step 2: Restyle the outer page background**

Find:

```tsx
    <div style={{ minHeight: '100vh', backgroundColor: '#F0F6FA' }}>
```

Replace with:

```tsx
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
```

- [ ] **Step 3: Fix a real contrast bug this introduces**

The "No Messages Yet" empty state sits directly on this outer background (unlike the searchable list above it, which has its own white container). Its heading currently has no explicit color, so it would inherit the page's default dark text color (`text-w-black`, set on `<body>` in `app/layout.tsx`) and become invisible against the new dark background.

Find:

```tsx
            <h2 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              marginBottom: '8px',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>No Messages Yet</h2>
```

Replace with:

```tsx
            <h2 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              marginBottom: '8px',
              color: 'white',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>No Messages Yet</h2>
```

- [ ] **Step 4: Verify**

Run: `cd /Users/sr/w-app-web && npx tsc --noEmit`
Expected: No errors.

Then in the running dev server, open the Messages tab with no conversations and confirm "No Messages Yet" is clearly legible (white text on dark background), and with conversations present confirm the message list (white card) still renders with normal dark-on-light text.

- [ ] **Step 5: Commit**

```bash
git add components/tabs/MessagesTab.tsx
git commit -m "MessagesTab: restyle page background to dark, fix empty-state contrast"
```

---

### Task 8: `ProfileTab` — dark restyle

**Files:**
- Modify: `components/tabs/ProfileTab.tsx`

**Interfaces:**
- Consumes: `theme` (Task 1).
- Produces: no interface changes.

- [ ] **Step 1: Add the theme import**

Find:

```tsx
import { signOut } from '@/lib/auth';
import {
  Camera, Edit2, Settings, Bell, Shield, HelpCircle,
  LogOut, ChevronRight, User, MapPin, Briefcase, Heart, Users
} from 'lucide-react';
```

Replace with:

```tsx
import { signOut } from '@/lib/auth';
import { theme } from '@/lib/theme';
import {
  Camera, Edit2, Settings, Bell, Shield, HelpCircle,
  LogOut, ChevronRight, User, MapPin, Briefcase, Heart, Users
} from 'lucide-react';
```

- [ ] **Step 2: Restyle the outer page background**

Find:

```tsx
    <div style={{ minHeight: '100vh', backgroundColor: '#F0F6FA' }}>
```

Replace with:

```tsx
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
```

This is the only change needed: the gradient header, and every card below it (Looking For, About Me, Menu Items, Logout button), already have their own explicit backgrounds and don't rely on the page's default text/background colors.

- [ ] **Step 3: Verify**

Run: `cd /Users/sr/w-app-web && npx tsc --noEmit`
Expected: No errors.

Then in the running dev server, navigate to Profile via the Main Feed's quick-access button and confirm the page background is dark, and every card (Looking For / About Me / Menu Items / Logout) is still fully legible.

- [ ] **Step 4: Commit**

```bash
git add components/tabs/ProfileTab.tsx
git commit -m "ProfileTab: restyle page background to dark"
```

---

### Task 9: Full manual verification pass

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Start the dev server**

Run: `cd /Users/sr/w-app-web && npm run dev`

- [ ] **Step 2: Run the full click-through from the spec's Testing section**

1. Load Main Feed with no location selected → confirm dark empty-state renders with the History/Rewards/Profile quick-access row
2. Browse Map tab → select a venue → confirm the Main Feed's checked-in state renders (header shows venue name, check-in fires without a console error, people-here list loads or shows the empty state)
3. Tap the leave/logout icon on the checked-in header → confirm return to the no-location empty state and the Map tab
4. Messages tab renders in dark theme; toggle between a populated and empty conversation list if possible
5. Tap the Profile quick-access button from Main Feed → confirm navigation to the Profile tab, dark background, all cards legible
6. Tap History and Rewards quick-access buttons → confirm each shows the "Coming Soon" modal (no dead link, no crash), and tapping outside the modal dismisses it

- [ ] **Step 3: Run a final typecheck across the whole repo**

Run: `cd /Users/sr/w-app-web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Confirm no wing language remains**

Run: `cd /Users/sr/w-app-web && grep -rniI "wing" --include="*.tsx" --include="*.ts" . | grep -v node_modules | grep -v "/.next/"`
Expected: No output (the two `TabBar.tsx` wing-shape comments were removed in Task 2; nothing else referenced "wing").

- [ ] **Step 5: Fix anything verification turned up, then commit**

If Steps 2-4 found no issues, skip this step entirely — Task 8's commit is the last one needed.

If issues were found, fix them directly in the relevant file from Tasks 1-8, then:

```bash
git add -A
git commit -m "Fix issues found during Phase 1 manual verification"
```
