import type { SaveStorage } from '../engine';

const PREFIX = 'typezork';

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage disabled (private mode, etc.)
  }
}

function set(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Quota or privacy settings: saving just won't persist.
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Save slots for the SAVE / LOAD commands. */
export function localSaves(gameId: string): SaveStorage {
  return {
    save: (slot, data) => set(`${PREFIX}:${gameId}:slot:${slot}`, data),
    load: (slot) => get(`${PREFIX}:${gameId}:slot:${slot}`),
  };
}

export const autosave = {
  load: (gameId: string) => get(`${PREFIX}:${gameId}:autosave`),
  save: (gameId: string, data: string) => set(`${PREFIX}:${gameId}:autosave`, data),
  clear: (gameId: string) => remove(`${PREFIX}:${gameId}:autosave`),
};

export type Speed = 'slow' | 'normal' | 'fast' | 'instant';
export type Theme = 'green' | 'amber';

export interface Settings {
  speed: Speed;
  theme: Theme;
  scanlines: boolean;
}

const DEFAULT_SETTINGS: Settings = { speed: 'normal', theme: 'green', scanlines: true };

export function loadSettings(): Settings {
  try {
    const parsed = JSON.parse(get(`${PREFIX}:settings`) ?? '{}') as Partial<Settings>;
    return {
      speed: ['slow', 'normal', 'fast', 'instant'].includes(parsed.speed as string)
        ? (parsed.speed as Speed)
        : DEFAULT_SETTINGS.speed,
      theme: parsed.theme === 'amber' ? 'amber' : 'green',
      scanlines: typeof parsed.scanlines === 'boolean' ? parsed.scanlines : true,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  set(`${PREFIX}:settings`, JSON.stringify(settings));
}
