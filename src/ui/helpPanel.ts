import type { GameView } from '../engine';

type Entry = readonly [label: string, template: string];

/**
 * Cheatsheet lines. Most hold one command; closely related ones share a line.
 * Each entry is [label, template]: templates ending in a space fill the prompt
 * so the player can finish them; the rest run straight away.
 */
const CHEATSHEET: readonly (readonly Entry[])[] = [
  [['look', 'look']],
  [['examine ...', 'examine ']],
  [
    ['go north', 'go north'],
    ['go back', 'go back'],
  ],
  [
    ['take ...', 'take '],
    ['drop ...', 'drop '],
  ],
  [['open ...', 'open ']],
  [['unlock ...', 'unlock ']],
  [['kill ... with ...', 'kill ']],
  [['inventory', 'inventory']],
  [
    ['undo', 'undo'],
    ['save', 'save'],
    ['load', 'load'],
    ['help', 'help'],
  ],
];

export class HelpPanel {
  constructor(
    private readonly suggestions: HTMLUListElement,
    cheatsheet: HTMLUListElement,
    private readonly onRun: (command: string) => void,
    onFill: (template: string) => void,
  ) {
    for (const line of CHEATSHEET) {
      const li = document.createElement('li');
      line.forEach(([label, template], i) => {
        if (i > 0) li.append(' / ');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'link';
        button.textContent = label;
        button.addEventListener('click', () =>
          template.endsWith(' ') ? onFill(template) : onRun(template),
        );
        li.append(button);
      });
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
