import {Moon, Sun} from 'lucide-react';
import {useTheme, type ThemeMode} from './theme.js';

export function ThemeControl({
  onThemeChanged,
}: {
  onThemeChanged?: (theme: ThemeMode) => void;
}) {
  const [mode, setMode] = useTheme();
  const nextMode: ThemeMode = mode === 'light' ? 'dark' : 'light';
  const Icon = mode === 'light' ? Moon : Sun;

  function toggleTheme(): void {
    setMode(nextMode);
    onThemeChanged?.(nextMode);
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={`تغییر به حالت ${nextMode === 'dark' ? 'تیره' : 'روشن'}`}
      onClick={toggleTheme}
    >
      <Icon aria-hidden />
      <span>{mode === 'light' ? 'حالت تیره' : 'حالت روشن'}</span>
    </button>
  );
}
