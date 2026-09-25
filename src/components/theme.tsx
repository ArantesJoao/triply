'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { cn } from '@/lib/cn';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'triply-theme';

// `--surface-page` in each theme. The browser chrome and status bar take this
// colour, so it has to follow the in-app toggle, not just the OS preference
// the `theme-color` media queries in layout.tsx can see.
const PAGE_LIGHT = '#FAFAF8';
const PAGE_DARK = '#0F1230';

/**
 * Runs before paint so a dark-mode user never sees a white flash. Kept in sync
 * with `applyTheme` below.
 */
export const themeScript = `
(function(){
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var dark = stored === 'dark' ||
      ((!stored || stored === 'system') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){
      m.setAttribute('content', dark ? '${PAGE_DARK}' : '${PAGE_LIGHT}');
    });
  } catch (e) {}
})();
`;

function applyTheme(theme: Theme) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute('content', dark ? PAGE_DARK : PAGE_LIGHT);
  });
}

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({ theme: 'system', setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored) setThemeState(stored);
    // Again after hydration: Next may place the `theme-color` tags after the
    // inline script, too late for it to have found them.
    applyTheme(stored ?? 'system');
  }, []);

  // Follow the OS while the preference is "system".
  useEffect(() => {
    if (theme !== 'system') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border border-line bg-subtle p-0.5',
        className,
      )}
      role="group"
      aria-label="Colour theme"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-pressed={theme === value}
          title={label}
          className={cn(
            'grid size-7 place-items-center rounded-full transition-colors duration-150',
            theme === value
              ? 'bg-brand text-brand-contrast'
              : 'text-faint hover:text-ink',
          )}
        >
          <Icon size={14} strokeWidth={2} />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}
