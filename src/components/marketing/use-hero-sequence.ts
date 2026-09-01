'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Timing for the hero's "Claude writes to the board" sequence: the prompt
 * text reveals word by word, then the confirmation line, then the connecting
 * dots and chevron, then the Fri cards land in time order. Each stage starts
 * once the previous one has had time to finish, landing the whole sequence
 * around 3.4s.
 */
const WORDS_TEXT =
  'Friday in London: Borough Market first thing, then Tate Modern for a couple of hours. Suggest somewhere for lunch nearby and put it on the board.';
export const WORDS = WORDS_TEXT.split(' ');

const WORD_STAGGER = 32;
const WORD_DUR = 260;
const WORDS_END = (WORDS.length - 1) * WORD_STAGGER + WORD_DUR;
const DONE_LINE_START = WORDS_END + 180;
const DONE_LINE_DUR = 380;
const DOTS_START = DONE_LINE_START + DONE_LINE_DUR + 200;
const DOT_STAGGER = 120;
const DOT_DUR = 280;
const CHEVRON_START = DOTS_START + DOT_STAGGER * 2 + 200;
const CHEVRON_DUR = 280;
// The board preview isn't downstream of the chat bubble — it starts settling
// into place as soon as the visual mounts, in parallel with the words above,
// rather than waiting for the whole "written to the board" sequence to finish.
const CARDS_START = 130;
const CARD_STAGGER = 150;
const CARD_DUR = 340;
const SEQUENCE_MS =
  Math.max(CARDS_START + CARD_STAGGER * 2 + CARD_DUR, CHEVRON_START + CHEVRON_DUR) + 100;

export const heroTiming = {
  WORD_STAGGER,
  WORD_DUR,
  DONE_LINE_START,
  DONE_LINE_DUR,
  DOTS_START,
  DOT_STAGGER,
  DOT_DUR,
  CHEVRON_START,
  CHEVRON_DUR,
  CARDS_START,
  CARD_STAGGER,
  CARD_DUR,
};

/**
 * Drives the hero sequence's one-time play, plus a single replay if (and
 * only if) the hero visual fully leaves the viewport and comes back. Replay
 * works by bumping `playKey`, which the caller uses to remount the animated
 * subtree — a fresh mount naturally restarts every CSS transition inside it,
 * no manual animation-reset needed.
 */
export function useHeroSequence() {
  const visibilityRef = useRef<HTMLDivElement | null>(null);
  const [playKey, setPlayKey] = useState(0);
  const [started, setStarted] = useState(false);

  const playedRef = useRef(false);
  const leftRef = useRef(false);
  const replayedRef = useRef(false);

  useEffect(() => {
    setStarted(false);
    const raf = requestAnimationFrame(() => setStarted(true));
    const timer = setTimeout(() => {
      playedRef.current = true;
    }, SEQUENCE_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [playKey]);

  useEffect(() => {
    const el = visibilityRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (leftRef.current && !replayedRef.current && playedRef.current) {
            replayedRef.current = true;
            leftRef.current = false;
            playedRef.current = false;
            setPlayKey((key) => key + 1);
          }
        } else if (entry.intersectionRatio === 0 && playedRef.current) {
          leftRef.current = true;
        }
      },
      { threshold: [0, 0.01] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { visibilityRef, playKey, started };
}
