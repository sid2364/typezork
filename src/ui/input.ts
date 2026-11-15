/** The prompt line: submit on Enter, ↑/↓ for history. */
export class PromptInput {
  private history: string[] = [];
  private index = 0;
  private draft = '';

  constructor(
    private readonly form: HTMLFormElement,
    readonly input: HTMLInputElement,
    private readonly onSubmit: (text: string) => void,
  ) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      input.value = '';
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
      }
    });
  }

  /** Put text in the prompt (e.g. from a help-panel template) and focus it. */
  fill(text: string): void {
    this.input.value = text;
    this.focus();
    this.input.setSelectionRange(text.length, text.length);
  }

  focus(): void {
    this.input.focus({ preventScroll: true });
  }

  submit(text: string): void {
    this.input.value = text;
    this.form.requestSubmit();
  }

  private recall(delta: number): void {
    if (this.index === this.history.length) this.draft = this.input.value;
    this.index = Math.max(0, Math.min(this.history.length, this.index + delta));
    this.input.value =
      this.index === this.history.length ? this.draft : (this.history[this.index] ?? '');
    const end = this.input.value.length;
    requestAnimationFrame(() => this.input.setSelectionRange(end, end));
  }
}
