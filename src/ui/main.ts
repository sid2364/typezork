import './styles.css';
import { crypt } from '../content/crypt';
import { Game, type GameDef, type OutputLine } from '../engine';
import { HelpPanel } from './helpPanel';
import { PromptInput } from './input';
import { renderCompass } from './compass';
import { renderMinimap } from './minimap';
import { Screen } from './screen';
import {
  autosave,
  loadSettings,
  localSaves,
  saveSettings,
  type Settings,
  type Speed,
} from './storage';

const def: GameDef = crypt;

const $ = <T extends Element>(selector: string): T => {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`Missing element ${selector}`);
  return node;
};

const app = $<HTMLDivElement>('#app');
const titleScreen = $<HTMLDivElement>('#title-screen');
const settingsDialog = $<HTMLDialogElement>('#settings');
const minimap = $<SVGSVGElement>('#minimap');
const compass = $<SVGSVGElement>('#compass');

// ---- settings ----------------------------------------------------------------

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const SPEEDS: Record<Speed, number> = { slow: 35, normal: 110, fast: 400, instant: Infinity };
const settings: Settings = loadSettings();

function applySettings(): void {
  app.dataset.theme = settings.theme;
  app.dataset.scanlines = settings.scanlines ? 'on' : 'off';
  const form = settingsDialog.querySelector('form')!;
  (form.elements.namedItem('scanlines') as HTMLInputElement).checked = settings.scanlines;
  for (const name of ['speed', 'theme'] as const) {
    for (const input of form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)) {
      input.checked = input.value === settings[name];
    }
  }
}

settingsDialog.querySelector('form')!.addEventListener('change', (e) => {
  const input = e.target as HTMLInputElement;
  if (input.name === 'speed') settings.speed = input.value as Speed;
  if (input.name === 'theme') settings.theme = input.value as Settings['theme'];
  if (input.name === 'scanlines') settings.scanlines = input.checked;
  saveSettings(settings);
  applySettings();
});
settingsDialog.addEventListener('close', () => prompt.focus());
$('#settings-button').addEventListener('click', () => settingsDialog.showModal());
$('#restart-button').addEventListener('click', () => {
  settingsDialog.close();
  run('restart');
});

// ---- game --------------------------------------------------------------------

const screen = new Screen($('#scroll'), $('#live'), () =>
  reducedMotion.matches ? Infinity : SPEEDS[settings.speed],
);

let game = new Game(def, { storage: localSaves(def.id) });
let endShown = false;

const prompt = new PromptInput($('#prompt'), $('#command'), (text) => run(text));

const help = new HelpPanel(
  $('#suggestions'),
  $('#cheatsheet'),
  (command) => {
    closePanels();
    prompt.submit(command);
  },
  (template) => {
    closePanels();
    prompt.fill(template);
  },
);

function run(text: string): void {
  show(game.submit(text));
  afterTurn();
}

/** Lines held back after a 'pause' marker until the player presses Enter. */
let held: OutputLine[] | null = null;
let continueHint: HTMLButtonElement | null = null;

/** Print engine output, honouring 'clear' (wipe the screen) and 'pause' (wait for Enter). */
function show(lines: readonly OutputLine[]): void {
  const clear = lines.findLastIndex((l) => l.style === 'clear');
  if (clear >= 0) {
    held = null;
    continueHint?.remove();
    screen.clear();
    lines = lines.slice(clear + 1);
  }
  const pause = lines.findIndex((l) => l.style === 'pause');
  if (pause < 0) {
    screen.print(lines);
    return;
  }
  screen.print(lines.slice(0, pause));
  held = lines.slice(pause + 1);
  const hint = document.createElement('button');
  hint.type = 'button';
  hint.className = 'line line--continue';
  hint.textContent = 'Press Enter to continue ↵';
  hint.addEventListener('click', (e) => {
    e.stopPropagation();
    proceed();
  });
  continueHint = hint;
  screen.append(hint);
}

function proceed(): void {
  if (!held) return;
  const rest = held;
  held = null;
  continueHint?.remove();
  continueHint = null;
  show(rest);
  prompt.focus();
}

function afterTurn(): void {
  autosave.save(def.id, game.serialize());
  const view = game.view();
  $('#status-room').textContent = view.room.name;
  $('#status-turns').textContent = String(view.turns);
  $('#status-exits').textContent = view.exits.map((e) => e.dir).join(', ') || 'none';
  $('#status-inventory').textContent = view.inventory.map((i) => i.name).join(', ') || 'nothing';
  $('#bar-status').textContent = `${view.room.name} · turn ${view.turns}`;
  document.title = `${view.room.name} — Zork`;
  help.render(view);
  renderMinimap(minimap, def, view);
  renderCompass(
    compass,
    view.exits.map((e) => e.dir),
    (dir) => {
      closePanels();
      run(`go ${dir}`);
      prompt.focus();
    },
  );

  if (view.over && !endShown) {
    endShown = true;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn--big screen__again';
    button.textContent = 'Play again';
    button.addEventListener('click', () => {
      button.remove();
      run('restart');
      prompt.focus();
    });
    screen.append(button);
  }
  if (!view.over) {
    endShown = false;
    document.querySelector('.screen__again')?.remove();
  }
}

function begin(resume: boolean): void {
  titleScreen.hidden = true;
  screen.clear();
  game = new Game(def, { storage: localSaves(def.id) });
  const saved = resume ? autosave.load(def.id) : null;
  let lines;
  if (saved) {
    try {
      game.restore(saved);
      lines = game.resume();
    } catch {
      lines = game.start();
    }
  } else {
    lines = game.start();
  }
  show(lines);
  afterTurn();
  prompt.focus();
}

// ---- title screen ------------------------------------------------------------

const continueButton = $<HTMLButtonElement>('#continue-button');
continueButton.hidden = autosave.load(def.id) === null;
continueButton.addEventListener('click', () => begin(true));
$('#new-button').addEventListener('click', () => begin(false));
(continueButton.hidden ? $<HTMLButtonElement>('#new-button') : continueButton).focus();

// ---- global input ------------------------------------------------------------

document.addEventListener('keydown', (e) => {
  if (settingsDialog.open) return;
  if (!titleScreen.hidden) return; // the focused title button handles Enter
  if (held && e.key === 'Enter') {
    // First Enter finishes the typing, the next one continues.
    e.preventDefault();
    if (screen.busy) screen.skip();
    else proceed();
    return;
  }
  if (screen.busy) screen.skip();
  if (e.key === 'Escape') closePanels();
  // Typing anywhere goes to the prompt.
  const target = e.target as HTMLElement;
  if (
    target !== prompt.input &&
    e.key.length === 1 &&
    !e.metaKey &&
    !e.ctrlKey &&
    !isControl(target)
  ) {
    prompt.focus();
  }
});

function isControl(node: HTMLElement): boolean {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName);
}

$('#screen').addEventListener('click', () => {
  screen.skip();
  // Don't steal focus while the player is selecting text to copy.
  if (!window.getSelection()?.toString()) prompt.focus();
});

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-command]')) {
  button.addEventListener('click', () => {
    closePanels();
    run(button.dataset.command!);
    prompt.focus();
  });
}

// ---- mobile drawers ----------------------------------------------------------

function closePanels(): void {
  delete app.dataset.open;
  for (const b of document.querySelectorAll('[data-toggle]'))
    b.setAttribute('aria-expanded', 'false');
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-toggle]')) {
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', () => {
    const panel = button.dataset.toggle!;
    const open = app.dataset.open !== panel;
    closePanels();
    if (open) {
      app.dataset.open = panel;
      button.setAttribute('aria-expanded', 'true');
    }
  });
}

applySettings();
