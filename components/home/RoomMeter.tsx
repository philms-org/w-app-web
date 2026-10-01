'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { theme, radius, type as typeTokens } from '@/lib/theme';
import { useTableSubscription } from '@/lib/hooks/useTableSubscription';
import {
  fetchRoomMeter,
  onContribution,
  roomMeterFill,
  METER_POINTS,
  type MeterContribution,
} from '@/lib/meter';

// "Room activity": a rolling one-hour energy level for the venue. Every
// engagement adds to it, and each one plays a short effect: stars fly from
// the thing the person touched into the bar. Other people's activity arrives
// through realtime and sends stars rising from the bottom of the screen.
//
// The server is the source of truth (migration 0033). The bar also moves
// the moment your own stars land, then reconciles with the server number.

const STAR_PATH = 'M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z';
const MAX_LIVE_STARS = 30;
const OPTIMISTIC_TTL_MS = 6000;

interface Pending {
  id: number;
  pts: number;
  landed: boolean;
}

export default function RoomMeter({ locationId }: { locationId: string }) {
  const [serverPts, setServerPts] = useState(0);
  const [aheadPts, setAheadPts] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [glowKey, setGlowKey] = useState(0);
  const [floats, setFloats] = useState<{ id: number; text: string }[]>([]);
  const [announce, setAnnounce] = useState('');

  const barRef = useRef<HTMLDivElement>(null);
  const serverRef = useRef<number | null>(null);
  const pendingRef = useRef<Pending[]>([]);
  const nextId = useRef(1);
  const liveStars = useRef(new Set<HTMLElement>());
  const fillRef = useRef(0);
  const lastStep = useRef(-1);

  const total = serverPts + aheadPts;
  const fill = roomMeterFill(total);
  const pct = Math.round(fill * 100);
  fillRef.current = fill;

  const syncAhead = useCallback(() => {
    setAheadPts(pendingRef.current.filter((p) => p.landed).reduce((s, p) => s + p.pts, 0));
  }, []);

  // ---------------------------------------------------------------- effect

  const fly = useCallback((origin: MeterContribution['origin'], count: number, onLand: () => void) => {
    const bar = barRef.current;
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!bar || reduce || liveStars.current.size + count > MAX_LIVE_STARS || document.visibilityState !== 'visible') {
      onLand();
      return;
    }
    const r = bar.getBoundingClientRect();
    const x1 = r.left + r.width * Math.max(0.04, Math.min(1, fillRef.current));
    const y1 = Math.max(16, Math.min(window.innerHeight - 16, r.top + r.height / 2));

    for (let i = 0; i < count; i++) {
      const x0 = origin ? origin.x : r.left + r.width * (0.15 + Math.random() * 0.7);
      const y0 = origin ? origin.y : Math.min(window.innerHeight + 12, y1 + 280);
      const mx = (x0 + x1) / 2 + (Math.random() - 0.5) * 140;
      const my = (y0 + y1) / 2 - 30 - Math.random() * 70;

      const el = document.createElement('span');
      el.setAttribute('aria-hidden', 'true');
      el.style.cssText =
        'position:fixed;left:0;top:0;width:18px;height:18px;pointer-events:none;z-index:3000;' +
        'color:#ffd166;filter:drop-shadow(0 0 5px rgba(255,209,102,.95));will-change:transform,opacity;';
      el.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18"><path d="${STAR_PATH}" fill="currentColor"/></svg>`;
      document.body.appendChild(el);
      liveStars.current.add(el);

      const anim = el.animate(
        [
          { transform: `translate(${x0 - 9}px,${y0 - 9}px) scale(.5)`, opacity: 0 },
          { transform: `translate(${mx - 9}px,${my - 9}px) scale(1.15)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${x1 - 9}px,${y1 - 9}px) scale(.35)`, opacity: 0.9 },
        ],
        { duration: 620 + Math.random() * 260, delay: i * 70, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'forwards' },
      );
      anim.onfinish = () => {
        el.remove();
        liveStars.current.delete(el);
        if (i === count - 1) onLand();
      };
    }
  }, []);

  const land = useCallback((label?: string) => {
    setGlowKey((k) => k + 1);
    if (label) {
      const id = nextId.current++;
      setFloats((f) => [...f, { id, text: label }]);
      setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 950);
    }
  }, []);

  // ----------------------------------------------------------------- data

  const load = useCallback(() => {
    fetchRoomMeter(locationId)
      .then(({ points }) => {
        const prev = serverRef.current;
        serverRef.current = points;
        setServerPts(points);
        setLoaded(true);
        if (prev === null || points <= prev) return;

        // Split the increase into "mine, already shown" and "someone else's".
        let delta = points - prev;
        for (const p of pendingRef.current) {
          if (delta <= 0) break;
          const take = Math.min(delta, p.pts);
          p.pts -= take;
          delta -= take;
        }
        pendingRef.current = pendingRef.current.filter((p) => p.pts > 0);
        syncAhead();
        if (delta > 0) fly(null, Math.min(5, Math.ceil(delta / 2)), () => land());
      })
      .catch((e) => console.error('Failed to load room meter:', e));
  }, [locationId, fly, land, syncAhead]);

  // Fires on subscribe, on any new pulse, on tab focus, and every 30s (which
  // also lets the bar cool down as old activity ages out of the hour).
  useTableSubscription({ table: 'meter_pulses', filter: `location_id=eq.${locationId}`, event: 'INSERT', onEvent: load });

  useEffect(() => {
    return onContribution((c) => {
      const pts = METER_POINTS[c.kind];
      const entry: Pending = { id: nextId.current++, pts, landed: false };
      pendingRef.current.push(entry);
      // If the server never confirms (rate limit, offline), drop the guess.
      setTimeout(() => {
        pendingRef.current = pendingRef.current.filter((p) => p.id !== entry.id);
        syncAhead();
      }, OPTIMISTIC_TTL_MS);
      fly(c.origin, Math.min(6, Math.max(1, pts)), () => {
        if (!pendingRef.current.some((p) => p.id === entry.id)) return; // server already counted it
        entry.landed = true;
        syncAhead();
        land(`+${pts}`);
      });
    });
  }, [fly, land, syncAhead]);

  useEffect(() => {
    const stars = liveStars.current;
    return () => {
      stars.forEach((s) => s.remove());
      stars.clear();
    };
  }, []);

  // Announce to screen readers only at 10% steps, not on every tap.
  useEffect(() => {
    const step = Math.floor(pct / 10);
    if (lastStep.current !== -1 && step !== lastStep.current) setAnnounce(`Room activity ${step * 10} percent`);
    lastStep.current = step;
  }, [pct]);

  if (!loaded) return null;

  return (
    <div
      role="group"
      aria-label="Room activity"
      style={{
        backgroundColor: theme.surface,
        border: `1px solid ${theme.divider}`,
        borderRadius: radius.card,
        padding: '12px 14px',
        marginBottom: 12,
        fontFamily: typeTokens.family,
      }}
    >
      <style>{`
        @keyframes wmeter-glow { 0% { opacity: .95; } 100% { opacity: 0; } }
        @keyframes wmeter-float { 0% { opacity: 0; transform: translateY(2px); } 20% { opacity: 1; } 100% { opacity: 0; transform: translateY(-18px); } }
        @media (prefers-reduced-motion: reduce) { .wmeter-fx { animation: none !important; } }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: typeTokens.label.fontSize, fontWeight: 700, color: theme.text }}>Room activity</span>
        <span style={{ fontSize: typeTokens.label.fontSize, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
      </div>

      <div
        ref={barRef}
        role="meter"
        aria-label="Room activity in the last hour"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        style={{ position: 'relative', height: 10, borderRadius: radius.pill, backgroundColor: theme.surface2, overflow: 'visible' }}
      >
        <div style={{ position: 'absolute', inset: 0, borderRadius: radius.pill, overflow: 'hidden' }}>
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              backgroundColor: theme.accent,
              transition: 'width .6s cubic-bezier(.3,.1,.3,1)',
            }}
          />
          {glowKey > 0 && (
            <span
              key={glowKey}
              className="wmeter-fx"
              aria-hidden="true"
              style={{
                position: 'absolute', inset: 0, borderRadius: radius.pill,
                background: 'linear-gradient(90deg, transparent, rgba(255,209,102,.9), transparent)',
                animation: 'wmeter-glow .6s ease-out forwards',
              }}
            />
          )}
        </div>
        {floats.map((f) => (
          <span
            key={f.id}
            className="wmeter-fx"
            aria-hidden="true"
            style={{
              position: 'absolute', right: 0, top: -22, fontSize: 13, fontWeight: 800, color: '#ffd166',
              textShadow: '0 0 6px rgba(255,209,102,.8)', animation: 'wmeter-float .9s ease-out forwards',
              pointerEvents: 'none',
            }}
          >
            {f.text}
          </span>
        ))}
      </div>

      <p style={{ margin: '8px 0 0', fontSize: typeTokens.caption.fontSize, color: theme.muted }}>
        {pct < 15 ? 'Quiet right now. Like, comment or post to get it going.' : 'Last hour. Everything you do here adds to it.'}
      </p>

      <span
        aria-live="polite"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}
      >
        {announce}
      </span>
    </div>
  );
}
