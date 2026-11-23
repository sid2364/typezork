// The title's letters arrive as runes and settle into Z O R K. Every few seconds after that, a
// letter or two stirs back into runes and settles again; on a device that can hover, pointing at a
// letter does the same.

// Elder Futhark and box-drawing glyphs. Sig, othala, algiz and tyr are left out because hate
// movements have taken them up.
const GLYPHS = [...'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛈᛒᛖᛗᛚᛜᛞ╬╪┼▓▒░'];

const STEP_MS = 55; // how often a scrambling cell changes glyph
const LOCK_AT_MS = [450, 650, 850, 1050]; // when each letter settles, from the first frame
const STIR_MS = 300; // how long a stirred letter scrambles before it settles again
const IDLE_MS = 5000; // roughly how often letters stir on their own
const IDLE_JITTER_MS = 1200; // ± around IDLE_MS, so it never feels metronomic
const PAIR_GAP_MS = 120; // when two letters stir, the second starts this much later

interface Cell {
  el: HTMLSpanElement;
  letter: string;
  lockAt: number; // timestamp at which it settles; Infinity while waiting for the first frame
  nextStep: number;
}

function randomGlyph(not: string): string {
  let g = not;
  while (g === not) g = GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? g;
  return g;
}

/** Build the heading's letter cells and play the decode. Returns a function that stops it. */
export function startTitleRunes(heading: HTMLElement, reducedMotion: MediaQueryList): () => void {
  const host = heading.querySelector<HTMLElement>('.title-runes');
  if (!host) return () => {};
  const word = host.textContent ?? '';

  // Each letter gets a fixed-width cell, so glyphs from fallback fonts can't move the word.
  const cells: Cell[] = [];
  host.textContent = '';
  for (const ch of word) {
    if (ch === ' ') {
      host.append(' ');
      continue;
    }
    const el = document.createElement('span');
    el.className = 'title-runes__cell';
    el.textContent = ch;
    host.append(el);
    cells.push({ el, letter: ch, lockAt: 0, nextStep: 0 });
  }

  if (reducedMotion.matches) return () => {};

  let frame = 0;
  let idle = 0;
  let stopped = false;
  let decoded = false; // the first decode has finished

  const settle = (cell: Cell): void => {
    cell.el.textContent = cell.letter;
    cell.el.classList.remove('is-scrambling');
  };

  const tick = (now: number): void => {
    frame = 0;
    let busy = false;
    for (const [i, cell] of cells.entries()) {
      if (!cell.el.classList.contains('is-scrambling')) continue;
      if (cell.lockAt === Infinity) cell.lockAt = now + (LOCK_AT_MS[i] ?? 0);
      if (now >= cell.lockAt) {
        settle(cell);
        continue;
      }
      busy = true;
      if (now >= cell.nextStep) {
        cell.el.textContent = randomGlyph(cell.el.textContent ?? '');
        cell.nextStep = now + STEP_MS;
      }
    }
    if (busy) {
      frame = requestAnimationFrame(tick);
    } else if (!decoded) {
      decoded = true;
      scheduleIdle();
    }
  };

  const run = (): void => {
    if (!frame && !stopped) frame = requestAnimationFrame(tick);
  };

  const stir = (cell: Cell): void => {
    if (!decoded || stopped || cell.el.classList.contains('is-scrambling')) return;
    cell.el.classList.add('is-scrambling');
    cell.lockAt = performance.now() + STIR_MS;
    cell.nextStep = 0;
    run();
  };

  // One letter, sometimes two, stirs on its own every few seconds. Skipped while the tab is hidden.
  const scheduleIdle = (): void => {
    const wait = IDLE_MS + (Math.random() * 2 - 1) * IDLE_JITTER_MS;
    idle = window.setTimeout(() => {
      if (stopped) return;
      if (!document.hidden) {
        const order = [...cells].sort(() => Math.random() - 0.5);
        const count = Math.random() < 0.35 ? 2 : 1;
        order.slice(0, count).forEach((cell, i) => {
          if (i === 0) stir(cell);
          else window.setTimeout(() => stir(cell), i * PAIR_GAP_MS);
        });
      }
      scheduleIdle();
    }, wait);
  };

  // Scramble from the start so the real letters never flash before the decode.
  for (const cell of cells) {
    cell.el.classList.add('is-scrambling');
    cell.el.textContent = randomGlyph(cell.letter);
    cell.lockAt = Infinity;
  }
  // Start once the font is in, so the decode doesn't settle into a fallback face.
  void document.fonts.ready.then(run);

  const canHover = window.matchMedia('(hover: hover)').matches;
  const listeners = cells.map((cell) => {
    const onEnter = (): void => stir(cell);
    if (canHover) cell.el.addEventListener('pointerenter', onEnter);
    return () => cell.el.removeEventListener('pointerenter', onEnter);
  });

  return () => {
    stopped = true;
    if (frame) cancelAnimationFrame(frame);
    window.clearTimeout(idle);
    frame = 0;
    for (const remove of listeners) remove();
    for (const cell of cells) settle(cell);
  };
}
