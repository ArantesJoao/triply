'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Reveals `totalLength` characters over time once `active` becomes true, at
 * roughly `msPerChar` per character — a typewriter effect driven by a raw
 * character count rather than a fixed keyframe list, so callers can slice
 * arbitrary styled text against it.
 */
export function useTypedReveal(active: boolean, totalLength: number, msPerChar = 10) {
  const [revealed, setRevealed] = useState(0);
  const startRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || totalLength === 0) return;

    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setRevealed(totalLength);
      return;
    }

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const count = Math.min(totalLength, Math.floor(elapsed / msPerChar));
      setRevealed(count);
      if (count < totalLength) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [active, totalLength, msPerChar]);

  return revealed;
}
