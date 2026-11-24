import adventureUrl from './audio/adventure.m4a';
import adventureMetalUrl from './audio/adventure_metal.m4a';

/** Played in this order, then round again. */
const TRACKS = [adventureUrl, adventureMetalUrl];

const VOLUME = 0.35;
const FADE_MS = 800;
/** How long before a track ends the next one starts downloading. */
const PRELOAD_LEAD_S = 60;

// Browsers only let sound start from some of these (which ones differs: touch screens
// ignore pointerdown, for one), so every press tries until one of them works.
const GESTURES = ['pointerdown', 'pointerup', 'click', 'touchend', 'keydown'] as const;

export interface Music {
  setEnabled(on: boolean): void;
}

/**
 * Background music that plays the tracks in turn and loops the list. The first track
 * loads behind the title screen while music is on, and starts on the first click, tap
 * or key press that the browser accepts as permission.
 */
export function startMusic(enabled: boolean): Music {
  // One player per track, so the next one can buffer while the current one plays.
  const players = TRACKS.map(() => {
    const audio = new Audio();
    audio.volume = 0;
    audio.preload = 'none'; // muted players don't download anything
    return audio;
  });
  let index = 0;
  const current = (): HTMLAudioElement => players[index]!;

  function load(i: number): void {
    const audio = players[i]!;
    if (audio.src) return;
    audio.preload = 'auto';
    audio.src = TRACKS[i]!;
  }
  if (enabled) load(0);

  let on = enabled;
  let starting = false;
  let played = false; // the browser has let it play at least once
  let fade = 0;

  function fadeIn(audio: HTMLAudioElement): void {
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
    const audio = current();
    if (!on || starting || document.hidden || !audio.paused) return;
    load(index);
    starting = true;
    audio.volume = 0;
    audio.play().then(
      () => {
        starting = false;
        fadeIn(audio);
      },
      () => {
        // Not allowed yet, interrupted by a pause, or a network hiccup: the next press tries again.
        starting = false;
      },
    );
  }

  function pause(): void {
    cancelAnimationFrame(fade);
    current().pause();
  }

  function onGesture(e: Event): void {
    // A press on a music button is left to its click, so muting first never starts the music.
    if ((e.target as Element | null)?.closest?.('[data-music-toggle]')) return;
    play();
  }

  for (const type of GESTURES) {
    document.addEventListener(type, onGesture, { passive: true });
  }

  players.forEach((audio, i) => {
    const next = (i + 1) % players.length;
    audio.addEventListener('playing', () => {
      if (played) return;
      played = true;
      for (const type of GESTURES) document.removeEventListener(type, onGesture);
    });
    audio.addEventListener('timeupdate', () => {
      if (audio.duration - audio.currentTime < PRELOAD_LEAD_S) load(next);
    });
    audio.addEventListener('ended', () => {
      cancelAnimationFrame(fade);
      audio.currentTime = 0;
      index = next;
      play();
    });
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
