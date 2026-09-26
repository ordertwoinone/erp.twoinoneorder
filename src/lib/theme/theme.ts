// Appearance preferences (Settings → Appearance). Saved per browser in
// localStorage and applied as attributes on <html>; the colours themselves
// live in index.css. index.html runs the same logic inline before first paint
// so a dark-mode user doesn't see a white flash — keep STORAGE_KEY in sync.

export type ThemeMode = 'light' | 'dark' | 'system'
export type SidebarStyle = 'light' | 'dark' | 'accent'
export type RadiusOption = 'none' | 'default' | 'large'
export type FontSizeOption = 'small' | 'default' | 'large'

export interface ThemePrefs {
  mode: ThemeMode
  accent: string
  sidebar: SidebarStyle
  radius: RadiusOption
  fontSize: FontSizeOption
}

export const STORAGE_KEY = 'erp-appearance'

export const DEFAULT_PREFS: ThemePrefs = { mode: 'light', accent: 'navy', sidebar: 'light', radius: 'default', fontSize: 'default' }

/** `swatch` is only for the picker; the real values are in index.css. */
export const ACCENTS: { value: string; label: string; swatch: string }[] = [
  { value: 'navy', label: 'Navy', swatch: 'oklch(0.35 0.09 262)' },
  { value: 'blue', label: 'Blue', swatch: 'oklch(0.5 0.2 260)' },
  { value: 'emerald', label: 'Emerald', swatch: 'oklch(0.52 0.13 160)' },
  { value: 'teal', label: 'Teal', swatch: 'oklch(0.52 0.1 195)' },
  { value: 'violet', label: 'Violet', swatch: 'oklch(0.5 0.2 295)' },
  { value: 'rose', label: 'Rose', swatch: 'oklch(0.55 0.2 12)' },
  { value: 'orange', label: 'Orange', swatch: 'oklch(0.6 0.18 45)' },
  { value: 'amber', label: 'Amber', swatch: 'oklch(0.75 0.16 75)' },
  { value: 'slate', label: 'Graphite', swatch: 'oklch(0.3 0.02 264)' },
]

export function loadPrefs(): ThemePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<ThemePrefs>) }
  } catch {
    // Storage blocked or corrupt — fall back to defaults.
  }
  return DEFAULT_PREFS
}

export function savePrefs(prefs: ThemePrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Not persisted this time; the theme still applies for this session.
  }
}

export function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveDark(mode: ThemeMode) {
  return mode === 'dark' || (mode === 'system' && systemPrefersDark())
}

export function applyTheme(prefs: ThemePrefs) {
  const root = document.documentElement
  const dark = resolveDark(prefs.mode)
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
  const attr = (name: string, value: string, fallback: string) =>
    value === fallback ? root.removeAttribute(name) : root.setAttribute(name, value)
  attr('data-accent', prefs.accent, 'navy')
  attr('data-sidebar-style', prefs.sidebar, 'light')
  attr('data-radius', prefs.radius, 'default')
  attr('data-font-size', prefs.fontSize, 'default')
}
