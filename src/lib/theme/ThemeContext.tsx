import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { applyTheme, DEFAULT_PREFS, loadPrefs, resolveDark, savePrefs, type ThemePrefs } from './theme'

export interface ThemeContextValue {
  prefs: ThemePrefs
  /** Whether dark colours are showing right now (resolves "system"). */
  isDark: boolean
  update: (changes: Partial<ThemePrefs>) => void
  reset: () => void
}

// eslint-disable-next-line react-refresh/only-export-components
export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<ThemePrefs>(loadPrefs)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)

  // Follow the OS switching between light and dark while the app is open.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemDark(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    applyTheme(prefs)
    savePrefs(prefs)
  }, [prefs, systemDark])

  const update = useCallback((changes: Partial<ThemePrefs>) => setPrefs((p) => ({ ...p, ...changes })), [])
  const reset = useCallback(() => setPrefs(DEFAULT_PREFS), [])
  const isDark = prefs.mode === 'system' ? systemDark : resolveDark(prefs.mode)
  const value = useMemo(() => ({ prefs, isDark, update, reset }), [prefs, isDark, update, reset])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
