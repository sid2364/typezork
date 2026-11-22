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

/**
 * Delete this game's saves (autosave and named slots) that fail isValid, e.g. ones
 * from an older version of the game. Returns how many were removed.
 */
export function purgeStaleSaves(gameId: string, isValid: (data: string) => boolean): number {
  const autosaveKey = `${PREFIX}:${gameId}:autosave`;
  const slotPrefix = `${PREFIX}:${gameId}:slot:`;
  const stale: string[] = [];
  try {
    // Collect first: removing while walking would shift the key indexes.
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key === null || (key !== autosaveKey && !key.startsWith(slotPrefix))) continue;
      const data = localStorage.getItem(key);
      if (data !== null && !isValid(data)) stale.push(key);
    }
  } catch {
    return 0; // storage disabled
  }
  stale.forEach(remove);
  return stale.length;
}

/** Delete everything this site keeps on the device: saves, settings and the death count. */
export function clearAllData(): void {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${PREFIX}:`)) keys.push(key);
    }
  } catch {
    return; // storage disabled: nothing was kept
  }
  keys.forEach(remove);
}

// how many times the player has lost this game on this device
export const deaths = {
  load: (gameId: string): number => Number(get(`${PREFIX}:${gameId}:deaths`)) || 0,
  save: (gameId: string, total: number) => set(`${PREFIX}:${gameId}:deaths`, String(total)),
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
