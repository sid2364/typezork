import type { GameView } from '../engine';

/** Templates: clicking one fills the prompt so the player can finish it. */
const CHEATSHEET: readonly [label: string, template: string, hint: string][] = [
  ['look / l', 'look', 'describe the room'],
  ['go north / n', 'go ', 'move (n, s, e, w, ne, …)'],
  ['examine … / x …', 'examine ', 'look closely'],
  ['take …', 'take ', 'pick something up'],
  ['drop …', 'drop ', 'put it down'],
  ['open …', 'open ', 'doors, chests, gates'],
  ['unlock …', 'unlock ', 'if you have the key'],
  ['kill … with …', 'kill ', 'fight a creature'],
  ['inventory / i', 'inventory', 'what you carry'],
  ['undo', 'undo', 'take back a move'],
  ['save / load', 'save', 'keep your progress'],
  ['help', 'help', 'the full list'],
];

export class HelpPanel {
  constructor(
    private readonly suggestions: HTMLUListElement,
    cheatsheet: HTMLUListElement,
    private readonly onRun: (command: string) => void,
    onFill: (template: string) => void,
  ) {
    for (const [label, template, hint] of CHEATSHEET) {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'link';
      button.textContent = label;
      button.addEventListener('click', () =>
        template.endsWith(' ') ? onFill(template) : onRun(template),
      );
      const span = document.createElement('span');
      span.className = 'help__hint';
      span.textContent = hint;
      li.append(button, span);
      cheatsheet.appendChild(li);
    }
  }

  render(view: GameView): void {
    const items = view.suggestions.map((s) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip';
      button.textContent = s;
      button.addEventListener('click', () => this.onRun(s));
      li.appendChild(button);
      return li;
    });
    this.suggestions.replaceChildren(...items);
  }
}
