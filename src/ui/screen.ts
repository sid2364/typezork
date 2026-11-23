import type { OutputLine } from '../engine';

interface QueueItem {
  readonly el: HTMLElement;
  readonly text: string;
  /** The line split into words, each with the spaces around it, so joined they are the text. */
  readonly words: readonly string[];
  /** The next word to show. */
  next: number;
  /** Characters shown so far. */
  shown: number;
  /** Budget (in characters) the next word needs before it appears. */
  cost: number;
}

/** A short beat between one line and the next, in characters. */
const LINE_BEAT = 6;

/**
 * What a word costs to type, in characters: about its length, a little more or less each time
 * so the rhythm is never mechanical, and never less than a short beat.
 */
function wordCost(word: string): number {
  return Math.max(2, word.trim().length) * (0.7 + Math.random() * 0.65);
}

/** The pause a word leaves before the next one: a breath after a sentence, less after a comma. */
function pauseAfter(word: string): number {
  const end = word.trimEnd().replace(/["'”’)\]]+$/, '');
  if (/[.!?]$/.test(end)) return 5;
  if (/[,;:—–-]$/.test(end)) return 2.5;
  return 0;
}

/**
 * The scrollback "screen". Lines are typed out a word at a time, at an uneven,
 * human pace (the speed setting is the average); the whole queue can be skipped. A separate aria-live region receives every line
 * in full straight away, so screen readers never wait on the animation. The
 * typed lines are hidden from assistive tech to avoid reading them twice, but
 * controls added with append() (Continue, Play again) stay reachable.
 */
export class Screen {
  private queue: QueueItem[] = [];
  private frame = 0;
  private last = 0;
  private carry = 0;
  private idle: (() => void)[] = [];

  constructor(
    private readonly scroll: HTMLElement,
    private readonly live: HTMLElement,
    /** Characters per second on average; Infinity means instant. */
    private readonly speed: () => number,
  ) {}

  get busy(): boolean {
    return this.queue.length > 0;
  }

  print(lines: readonly OutputLine[]): void {
    for (const l of lines) {
      if (l.style === 'pause' || l.style === 'clear') continue; // handled by the caller
      // A new command: everything before it becomes "older" text.
      if (l.style === 'echo') this.dimOlder();
      const el = document.createElement('p');
      el.className = `line line--${l.style}`;
      el.setAttribute('aria-hidden', 'true');
      if (l.style === 'title') this.scroll.appendChild(spacer());
      this.scroll.appendChild(el);
      this.announce(l.text);
      if (l.style === 'echo' || !Number.isFinite(this.speed())) {
        // Flush anything still typing first so lines never appear out of order.
        if (l.style === 'echo') this.skip();
        el.textContent = l.text;
        el.classList.add('line--typed');
      } else {
        const words = l.text.match(/\s*\S+\s*/g) ?? [];
        this.queue.push({
          el,
          text: l.text,
          words,
          next: 0,
          shown: 0,
          cost: wordCost(words[0] ?? ''),
        });
      }
    }
    this.scrollToEnd();
    if (this.queue.length && !this.frame) {
      this.last = performance.now();
      this.carry = 0;
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  /** Append an element (e.g. a button) once everything queued so far has been typed. */
  append(el: HTMLElement): void {
    this.whenIdle(() => {
      this.scroll.appendChild(el);
      this.scrollToEnd();
    });
  }

  /** Run a callback once typing has finished (immediately if nothing is queued). */
  whenIdle(fn: () => void): void {
    if (this.queue.length) this.idle.push(fn);
    else fn();
  }

  /** Finish typing everything immediately. */
  skip(): void {
    for (const item of this.queue) {
      if (item.el.textContent !== item.text) item.el.textContent = item.text; // blank lines
      done(item.el);
    }
    this.queue = [];
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.scrollToEnd();
    this.flushIdle();
  }

  clear(): void {
    this.idle = [];
    this.skip();
    this.scroll.replaceChildren();
    this.live.replaceChildren();
  }

  private tick = (now: number): void => {
    // the budget, in characters, grows with time at the chosen speed and is spent a word at a time
    this.carry += ((now - this.last) / 1000) * this.speed();
    this.last = now;
    const stick = this.nearEnd();
    while (this.queue.length) {
      const item = this.queue[0]!;
      // the line being typed carries a block cursor at its end
      item.el.classList.add('line--typing');
      if (item.next < item.words.length) {
        if (this.carry < item.cost) break;
        this.carry -= item.cost;
        const word = item.words[item.next++]!;
        item.shown += word.length;
        item.el.textContent = item.text.slice(0, item.shown);
        const following = item.words[item.next];
        if (following !== undefined) {
          item.cost = wordCost(following) + pauseAfter(word);
          continue;
        }
      }
      if (item.el.textContent !== item.text) item.el.textContent = item.text; // blank lines
      done(item.el);
      this.queue.shift();
      this.carry -= LINE_BEAT;
    }
    if (stick) this.scrollToEnd();
    this.frame = this.queue.length ? requestAnimationFrame(this.tick) : 0;
    if (!this.queue.length) this.flushIdle();
  };

  private flushIdle(): void {
    const callbacks = this.idle;
    this.idle = [];
    for (const fn of callbacks) fn();
  }

  /** Mark every line currently on screen as old, so the latest turn stands out. */
  dimOlder(): void {
    for (const el of this.scroll.querySelectorAll('.line:not(.line--old)')) {
      el.classList.add('line--old');
    }
  }

  private nearEnd(): boolean {
    const s = this.scroll;
    return s.scrollHeight - s.scrollTop - s.clientHeight < 80;
  }

  private scrollToEnd(): void {
    this.scroll.scrollTop = this.scroll.scrollHeight;
  }

  /** Tell screen readers something that isn't printed as a line (e.g. "Press Enter to continue"). */
  announce(text: string): void {
    const p = document.createElement('p');
    p.textContent = text;
    this.live.appendChild(p);
    // Keep the live region small; the visible screen holds the history.
    while (this.live.childElementCount > 60) this.live.firstElementChild?.remove();
  }
}

/** A line has finished typing: the cursor leaves it, and lines that glow on arrival can start. */
function done(el: HTMLElement): void {
  el.classList.remove('line--typing');
  el.classList.add('line--typed');
}

function spacer(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'line-gap';
  el.setAttribute('aria-hidden', 'true');
  return el;
}
