'use client';

import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 80;
const MAX_PULL = 120;

// Standard mobile pull-to-refresh gesture: drag down from the top of a
// scrolled-to-top page, release past THRESHOLD to fire onRefresh. Listens on
// `window` rather than a ref so it works regardless of which element actually
// scrolls in this codebase's plain-div layout (no scroll container convention
// exists yet).
export function usePullToRefresh(onRefresh: () => void) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  // Once a gesture is determined to be a horizontal scroll (e.g. dragging
  // across one of the horizontally-scrolling venue card rows), it's disabled
  // for the rest of the touch so a diagonal drift doesn't still trigger a
  // refresh.
  const horizontalLock = useRef(false);
  // Mirrors pullDistance without waiting for a render, so onTouchEnd can read
  // the latest value directly instead of doing side effects inside a
  // setState updater (which React 19 StrictMode double-invokes in dev).
  const pullDistanceRef = useRef(0);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) return;
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      horizontalLock.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null || startX.current === null) return;
      const dx = e.touches[0].clientX - startX.current;
      const dy = e.touches[0].clientY - startY.current;

      if (!horizontalLock.current && Math.abs(dx) > Math.abs(dy)) {
        horizontalLock.current = true;
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
      if (horizontalLock.current) return;

      if (dy > 0 && window.scrollY === 0) {
        const next = Math.min(dy, MAX_PULL);
        pullDistanceRef.current = next;
        setPullDistance(next);
      }
    };

    const onTouchEnd = () => {
      if (pullDistanceRef.current >= THRESHOLD) {
        setPulling(true);
        onRefresh();
        setTimeout(() => setPulling(false), 800);
      }
      pullDistanceRef.current = 0;
      setPullDistance(0);
      startX.current = null;
      startY.current = null;
      horizontalLock.current = false;
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [onRefresh]);

  return { pulling, pullDistance };
}
