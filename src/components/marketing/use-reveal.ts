'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * True once the element has been ~15% visible in the viewport; never resets,
 * so it never re-triggers on scroll back up.
 */
export function useRevealed<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, revealed };
}

/**
 * True once the page has scrolled a sentinel element out of view. Used for
 * the sticky header's past-40px look, without a scroll listener.
 */
export function useScrolledPast<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [past, setPast] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      setPast(!entry.isIntersecting);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, past };
}
