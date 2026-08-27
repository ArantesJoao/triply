'use client';

import { useEffect, useState } from 'react';

/**
 * Returns `true` when the app is rendering in dark mode.
 *
 * Reads the `.dark` class on `<html>` (set by the theme script and toggle)
 * and watches for changes via MutationObserver so the value stays in sync
 * with the ThemeToggle and OS preference.
 */
export function useDarkMode(): boolean {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    setDark(el.classList.contains('dark'));

    const observer = new MutationObserver(() => {
      setDark(el.classList.contains('dark'));
    });
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return dark;
}
