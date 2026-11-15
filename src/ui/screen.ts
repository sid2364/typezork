import type { OutputLine } from '../engine';

interface QueueItem {
  readonly el: HTMLElement;
  readonly text: string;
  typed: number;
}

/**
 * The scrollback "screen". Lines are typed out a character at a time; the
 * whole queue can be skipped. A separate aria-live region receives every line
 * in full straight away, so screen readers never wait on the animation.
 */
export class Screen {
  private queue: QueueItem[] = [];
  private frame = 0;
  private last = 0;
  private carry = 0;

  constructor(
    private readonly scroll: HTMLElement,
    private readonly live: HTMLElement,
    /** Characters per second; Infinity means instant. */
    private readonly speed: () => number,
  ) {}

  get busy(): boolean {
    return this.queue.length > 0;
  }

  print(lines: readonly OutputLine[]): void {
    for (const l of lines) {
      const el = document.createElement('p');
      el.className = `line line--${l.style}`;
      if (l.style === 'title') this.scroll.appendChild(spacer());
      this.scroll.appendChild(el);
      this.announce(l.text);
      if (l.style === 'echo' || !Number.isFinite(this.speed())) {
        // Flush anything still typing first so lines never appear out of order.
        if (l.style === 'echo') this.skip();
        el.textContent = l.text;
      } else {
        this.queue.push({ el, text: l.text, typed: 0 });
      }
    }
    this.scrollToEnd();
    if (this.queue.length && !this.frame) {
      this.last = performance.now();
      this.carry = 0;
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  /** Append an element (e.g. a button) after everything queued so far. */
  append(el: HTMLElement): void {
    this.skip();
    this.scroll.appendChild(el);
    this.scrollToEnd();
  }

  /** Finish typing everything immediately. */
  skip(): void {
    for (const item of this.queue) item.el.textContent = item.text;
    this.queue = [];
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.scrollToEnd();
  }

  clear(): void {
    this.skip();
    this.scroll.replaceChildren();
    this.live.replaceChildren();
  }

  private tick = (now: number): void => {
    this.carry += ((now - this.last) / 1000) * this.speed();
    this.last = now;
    let budget = Math.floor(this.carry);
    this.carry -= budget;
    const stick = this.nearEnd();
    while (budget > 0 && this.queue.length) {
      const item = this.queue[0]!;
      const n = Math.min(budget, item.text.length - item.typed);
      item.typed += n;
      budget -= n;
      item.el.textContent = item.text.slice(0, item.typed);
      if (item.typed >= item.text.length) {
        this.queue.shift();
        budget = Math.max(0, budget - 6); // a short beat between lines
      }
    }
    if (stick) this.scrollToEnd();
    this.frame = this.queue.length ? requestAnimationFrame(this.tick) : 0;
  };

  private nearEnd(): boolean {
    const s = this.scroll;
    return s.scrollHeight - s.scrollTop - s.clientHeight < 80;
  }

  private scrollToEnd(): void {
    this.scroll.scrollTop = this.scroll.scrollHeight;
  }

  private announce(text: string): void {
    const p = document.createElement('p');
    p.textContent = text;
    this.live.appendChild(p);
    // Keep the live region small; the visible screen holds the history.
    while (this.live.childElementCount > 60) this.live.firstElementChild?.remove();
  }
}

function spacer(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'line-gap';
  return el;
}
