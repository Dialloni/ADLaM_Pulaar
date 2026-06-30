import { useState, useEffect } from 'react';

export type Theme = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

const KEY = 'gando_theme';

// Auto mode follows the time of day: light during the day, dark at night.
// Day window = 07:00–18:59 local time.
function timeTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  const h = new Date().getHours();
  return h >= 7 && h < 19 ? 'light' : 'dark';
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    try { return (localStorage.getItem(KEY) as Theme) || 'system'; } catch { return 'system'; }
  });

  // re-evaluate auto (time-based) theme periodically so it flips at the day/night boundary
  const [, force] = useState(0);
  useEffect(() => {
    if (theme !== 'system') return;
    const id = setInterval(() => force(n => n + 1), 10 * 60 * 1000); // every 10 min
    return () => clearInterval(id);
  }, [theme]);

  const resolved: ResolvedTheme = theme === 'system' ? timeTheme() : theme;

  const setTheme = (t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem(KEY, t); } catch {}
  };

  const toggle = () => setTheme(resolved === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved);
  }, [resolved]);

  return { theme, setTheme, toggle, resolved };
}
