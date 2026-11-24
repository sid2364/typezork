import { ARTICLES } from '../engine/parser/lexer';
import { PREPOSITIONS } from '../engine/parser/lexicon';

/** What the prompt can complete: the Try list first, then single words. */
export interface Completions {
  readonly suggestions: readonly string[];
  readonly verbs: readonly string[];
  readonly things: readonly string[];
  readonly exits: readonly string[];
}

const NONE: Completions = { suggestions: [], verbs: [], things: [], exits: [] };

/** The first option that starts with what was typed and has more to it, ignoring case. */
function first(typed: string, options: readonly string[]): string | undefined {
  const lower = typed.toLowerCase();
  return options.find((o) => o.length > typed.length && o.toLowerCase().startsWith(lower));
}

/**
 * The whole prompt text with the command being typed finished, or null. Only the last of
 * several chained commands ("look and ex") is completed. A whole command from the Try list
 * wins; otherwise the first word is finished as a verb or direction, the words after GO as a
 * direction, and the words after the verb (or its last preposition) as a thing's name.
 */
export function complete(text: string, c: Completions): string | null {
  if (!text.trim()) return null;
  // the same separators the lexer splits commands on
  const split = /^(.*(?:[.;,!?]|\b(?:and|then)\b)\s*)(.*)$/is.exec(text);
  const head = split?.[1] ?? '';
  const tail = split ? split[2]! : text;
  if (!tail) return null;
  const whole = first(tail, c.suggestions);
  if (whole) return head + whole;

  const space = tail.indexOf(' ');
  if (space < 0) {
    const word = first(tail, [...c.verbs, ...c.exits]);
    return word ? head + word : null;
  }
  const verb = tail.slice(0, space).toLowerCase();
  const words = tail.slice(space + 1).split(' ');
  let options = c.things;
  let from = 0;
  if (verb === 'go') {
    options = c.exits;
  } else {
    // after "give bone to", name the second thing
    for (let i = words.length - 2; i >= 0; i--) {
      if (PREPOSITIONS.has(words[i]!.toLowerCase())) {
        from = i + 1;
        break;
      }
    }
  }
  // "take the c" names the candle
  while (from < words.length - 1 && ARTICLES.has(words[from]!.toLowerCase())) from++;
  const phrase = words.slice(from).join(' ');
  if (!phrase) return null;
  const name = first(phrase, options);
  return name ? text.slice(0, text.length - phrase.length) + name : null;
}

/** The prompt line: submit on Enter, ↑/↓ for history, Tab to finish the dim completion. */
export class PromptInput {
  private history: string[] = [];
  private index = 0;
  private draft = '';
  private completions: Completions = NONE;
  /** What Tab would turn the prompt into, if anything. */
  private completion: string | null = null;
  private readonly ghostTyped = document.createElement('span');
  private readonly ghostRest = document.createElement('span');
  private readonly ghost = document.createElement('span');

  constructor(
    private readonly form: HTMLFormElement,
    readonly input: HTMLInputElement,
    private readonly onSubmit: (text: string) => void,
  ) {
    // the rest of the completion sits behind the input, lined up after what was typed
    const field = document.createElement('span');
    field.className = 'prompt__field';
    this.ghost.className = 'prompt__ghost';
    this.ghost.setAttribute('aria-hidden', 'true');
    this.ghostTyped.className = 'prompt__ghost-typed';
    this.ghost.append(this.ghostTyped, this.ghostRest);
    input.replaceWith(field);
    field.append(this.ghost, input);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      input.value = '';
      this.updateGhost();
      if (!text) return;
      if (this.history[this.history.length - 1] !== text) this.history.push(text);
      if (this.history.length > 100) this.history.shift();
      this.index = this.history.length;
      onSubmit(text);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.recall(-1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.recall(1);
      } else if (
        e.key === 'Tab' &&
        this.completion &&
        !e.shiftKey &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        this.fill(this.completion);
      }
    });
    // the caret moving off the end hides the ghost, coming back shows it
    for (const type of ['input', 'keyup', 'click']) {
      input.addEventListener(type, () => this.updateGhost());
    }
  }

  /** What the prompt may complete, refreshed after every turn. */
  setCompletions(completions: Completions): void {
    this.completions = completions;
    this.updateGhost();
  }

  /** Put text in the prompt (e.g. from a help-panel template) and focus it. */
  fill(text: string): void {
    this.input.value = text;
    this.focus();
    this.input.setSelectionRange(text.length, text.length);
    this.updateGhost();
  }

  focus(): void {
    this.input.focus({ preventScroll: true });
  }

  submit(text: string): void {
    this.input.value = text;
    this.form.requestSubmit();
  }

  private updateGhost(): void {
    const { value, selectionStart, selectionEnd, scrollLeft } = this.input;
    const atEnd = selectionStart === value.length && selectionEnd === value.length;
    // a scrolled input would no longer line up with the ghost
    this.completion = atEnd && scrollLeft === 0 ? complete(value, this.completions) : null;
    this.ghostTyped.textContent = this.completion ? value : '';
    this.ghostRest.textContent = this.completion?.slice(value.length) ?? '';
  }

  private recall(delta: number): void {
    if (this.index === this.history.length) this.draft = this.input.value;
    this.index = Math.max(0, Math.min(this.history.length, this.index + delta));
    this.input.value =
      this.index === this.history.length ? this.draft : (this.history[this.index] ?? '');
    const end = this.input.value.length;
    requestAnimationFrame(() => {
      this.input.setSelectionRange(end, end);
      this.updateGhost();
    });
  }
}
