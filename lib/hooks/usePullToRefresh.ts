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
  const startY = useRef<number | null>(null);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) return;
      startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && window.scrollY === 0) {
        setPullDistance(Math.min(delta, MAX_PULL));
      }
    };

    const onTouchEnd = () => {
      setPullDistance((current) => {
        if (current >= THRESHOLD) {
          setPulling(true);
          onRefresh();
          setTimeout(() => setPulling(false), 800);
        }
        return 0;
      });
      startY.current = null;
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
