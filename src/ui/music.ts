import trackUrl from './audio/adventure.m4a';

const VOLUME = 0.35;
const FADE_MS = 800;

// Browsers only let sound start from some of these (which ones differs: touch screens
// ignore pointerdown, for one), so every press tries until one of them works.
const GESTURES = ['pointerdown', 'pointerup', 'click', 'touchend', 'keydown'] as const;

export interface Music {
  setEnabled(on: boolean): void;
}

/**
 * Looping background music. It loads behind the title screen while music is on, and
 * starts on the first click, tap or key press that the browser accepts as permission.
 */
export function startMusic(enabled: boolean): Music {
  const audio = new Audio();
  audio.loop = true;
  audio.volume = 0;
  // Muted players don't download it at all.
  audio.preload = enabled ? 'auto' : 'none';
  if (enabled) audio.src = trackUrl;

  let on = enabled;
  let starting = false;
  let played = false; // the browser has let it play at least once
  let fade = 0;

  function fadeIn(): void {
    cancelAnimationFrame(fade);
    const from = audio.volume;
    const start = performance.now();
    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / FADE_MS);
      audio.volume = from + (VOLUME - from) * t;
      if (t < 1) fade = requestAnimationFrame(step);
    };
    fade = requestAnimationFrame(step);
  }

  function play(): void {
    if (!on || starting || document.hidden || !audio.paused) return;
    if (!audio.src) audio.src = trackUrl;
    starting = true;
    audio.volume = 0;
    audio.play().then(
      () => {
        starting = false;
        fadeIn();
      },
      () => {
        // Not allowed yet, interrupted by a pause, or a network hiccup: the next press tries again.
        starting = false;
      },
    );
  }

  function pause(): void {
    cancelAnimationFrame(fade);
    audio.pause();
  }

  function onGesture(e: Event): void {
    // A press on a music button is left to its click, so muting first never starts the music.
    if ((e.target as Element | null)?.closest?.('[data-music-toggle]')) return;
    play();
  }

  for (const type of GESTURES) {
    document.addEventListener(type, onGesture, { passive: true });
  }
  audio.addEventListener('playing', () => {
    if (played) return;
    played = true;
    for (const type of GESTURES) document.removeEventListener(type, onGesture);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
    else if (played) play();
  });

  return {
    setEnabled(next: boolean): void {
      on = next;
      if (on) play();
      else pause();
    },
  };
}
