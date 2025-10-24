export type ColorMode = 'color' | 'colorblind';

const KEY = 'color_mode';
const EVENT = 'colorModeChange';

export function getColorMode(): ColorMode {
  try {
    const v = localStorage.getItem(KEY) as ColorMode | null;
    return v === 'colorblind' ? 'colorblind' : 'color';
  } catch {
    return 'color';
  }
}

export function setColorMode(mode: ColorMode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent<ColorMode>(EVENT, { detail: mode } as any));
  } catch {}
}

export function onColorModeChange(handler: (mode: ColorMode) => void) {
  const listener = (e: Event) => {
    const ce = e as CustomEvent<ColorMode>;
    if (ce?.detail) handler(ce.detail);
    else handler(getColorMode());
  };
  window.addEventListener(EVENT, listener as EventListener);
  const storageListener = (e: StorageEvent) => {
    if (e.key === KEY) handler(getColorMode());
  };
  window.addEventListener('storage', storageListener);
  return () => {
    window.removeEventListener(EVENT, listener as EventListener);
    window.removeEventListener('storage', storageListener);
  };
}
