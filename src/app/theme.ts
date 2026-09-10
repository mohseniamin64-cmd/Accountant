import {useState} from 'react';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'diaco-login-theme';

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

export function readThemeMode(): ThemeMode {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeMode(stored) ? stored : 'light';
}

export function useTheme(): readonly [ThemeMode, (mode: ThemeMode) => void] {
  const [mode, setModeState] = useState<ThemeMode>(readThemeMode);

  function setMode(next: ThemeMode): void {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    setModeState(next);
  }

  return [mode, setMode] as const;
}
