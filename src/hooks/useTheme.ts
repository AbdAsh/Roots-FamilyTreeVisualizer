/**
 * Theme store: light/dark with system-preference fallback.
 * The initial value is read from the `data-theme` attribute the inline
 * index.html bootstrap already set (avoids a flash), falling back to
 * localStorage / prefers-color-scheme. Applying a theme writes the
 * attribute, the persisted key, and the address-bar theme-color.
 */
import { create } from 'zustand';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'roots-theme';
const META_LIGHT = '#f6f3ec';
const META_DARK = '#211e1a';

function readInitial(): Theme {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
  }
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === 'light' || s === 'dark') return s;
  } catch { /* ignore */ }
  if (typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

function apply(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? META_DARK : META_LIGHT);
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
}

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readInitial(),
  setTheme: (t) => { apply(t); set({ theme: t }); },
  toggle: () => { const n: Theme = get().theme === 'dark' ? 'light' : 'dark'; apply(n); set({ theme: n }); },
}));
