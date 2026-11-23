import './styles.css';
import { crypt } from '../content/crypt';
import { Game, isCompatibleSave, type GameDef, type OutputLine } from '../engine';
import { HelpPanel } from './helpPanel';
import { PromptInput } from './input';
import { renderCompass } from './compass';
import { renderMinimap } from './minimap';
import { Screen } from './screen';
import {
  autosave,
  clearAllData,
  deaths,
  loadSettings,
  localSaves,
  purgeStaleSaves,
  saveSettings,
  storageAvailable,
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

const themeColor = $<HTMLMetaElement>('meta[name="theme-color"]');

/** Paint the glass's grain once: a small tile of random specks that CSS tiles and jitters. */
function paintGrain(): void {
  const size = 160;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return; // no grain, the rest of the glass still shows
  const pixels = ctx.createImageData(size, size);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const v = Math.random() * 255;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = v;
    pixels.data[i + 3] = Math.random() * 255;
  }
  ctx.putImageData(pixels, 0, 0);
  $<HTMLElement>('.glass').style.setProperty('--grain', `url(${canvas.toDataURL()})`);
}
paintGrain();

function applySettings(): void {
  app.dataset.theme = settings.theme;
  // the phone's browser bar takes the screen colour of the chosen theme
  themeColor.content = getComputedStyle(app).getPropertyValue('--bg').trim();
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
$('#wipe-button').addEventListener('click', () => {
  if (!confirm('Delete all saved data? Your progress, saved games and settings will be gone.'))
    return;
  clearAllData();
  // start over from a clean page so nothing still in memory gets saved again
  location.reload();
});

// ---- game --------------------------------------------------------------------

const screen = new Screen($('#scroll'), $('#live'), () =>
  reducedMotion.matches ? Infinity : SPEEDS[settings.speed],
);

// Without storage (some private modes block it) SAVE says so instead of claiming success.
const canSave = storageAvailable();

/** Set when a command took a turn or examined something (looking closely pays, but takes no turn).
    UNDO, LOAD and RESTART do neither, so the state they bring back never lights up. */
let tookTurn = false;

// every game over is remembered so the crypt can show it
function newGame(): Game {
  const g = new Game(def, {
    storage: canSave ? localSaves(def.id) : undefined,
    deaths: deaths.load(def.id),
    onDeath: (total) => deaths.save(def.id, total),
  });
  const played = (): void => {
    tookTurn = true;
  };
  g.bus.on('turn', played);
  g.bus.on('examine', played);
  return g;
}

let game = newGame();
let endShown = false;
/** Score and rank level shown before this turn, to light up whatever changed. */
let lastScore = 0;
let lastLevel = 0;
/** The room shown last turn, and the rooms left before it, for the map's afterglow. */
let lastRoom = '';
let lastTurns = 0;
let trail: string[] = [];

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

const caret = $<HTMLElement>('.prompt__caret');

function run(text: string): void {
  tookTurn = false;
  show(game.submit(text));
  afterTurn(tookTurn);
  // the > blinks for a few seconds after each turn, then holds steady; a finished animation is
  // gone from getAnimations(), so start it over by resetting the style
  caret.style.animation = 'none';
  void caret.offsetWidth;
  caret.style.animation = '';
}

/** Light an element up like fresh phosphor; it fades back on its own. */
function flare(node: Element, className = 'flare'): void {
  node.classList.remove(className);
  void (node as HTMLElement).offsetWidth; // restart the animation if it is still running
  node.classList.add(className);
  const end = (e: Event): void => {
    if (e.target !== node) return; // a child's animation ending bubbles up too
    node.classList.remove(className);
    node.removeEventListener('animationend', end);
  };
  node.addEventListener('animationend', end);
}

/** Points arrive quietly in the story, so the panel and the bar say so. */
function markScore(score: number): void {
  const change = score - lastScore;
  const signed = change > 0 ? `+${change}` : `−${-change}`;
  const delta = document.createElement('span');
  delta.className = change > 0 ? 'status__delta' : 'status__delta status__delta--down';
  delta.textContent = signed;
  delta.setAttribute('aria-hidden', 'true');
  delta.addEventListener('animationend', () => delta.remove(), { once: true });
  $('#status-score').append(delta);
  flare($('#status-score'));
  flare($('#bar-status'));
  screen.announce(`Score ${signed}, now ${score}.`);
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
  hint.setAttribute('aria-label', 'Continue');
  hint.addEventListener('click', (e) => {
    e.stopPropagation();
    proceed();
  });
  continueHint = hint;
  screen.append(hint);
  screen.announce('Press Enter to continue.');
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

/** Refresh every panel. `played` is true when a turn was just taken, so changes can light up. */
function afterTurn(played = false): void {
  autosave.save(def.id, game.serialize());
  const view = game.view();
  $('#status-room').textContent = view.room.name;
  $('#status-turns').textContent = String(view.turns);
  $('#status-score').textContent = String(view.score);
  $('#status-exits').textContent = view.exits.map((e) => e.dir).join(', ') || 'none';
  $('#status-inventory').textContent = view.inventory.map((i) => i.name).join(', ') || 'nothing';
  $('#status-level').textContent = view.rank ? String(view.rank.level) : '–';
  const level = view.rank?.level ?? 0;
  if (played && view.score !== lastScore) markScore(view.score);
  if (played && level !== lastLevel) flare($('#status-level'));
  lastScore = view.score;
  lastLevel = level;
  const rank = view.rank ? ` · ${view.rank.name}` : '';
  $('#bar-status').textContent =
    `${view.room.name} · turn ${view.turns} · score ${view.score}${rank}`;
  document.title = `${view.room.name} — Zork`;
  help.render(view);
  // The way the player came: rooms just left, most recent first. Undo, load and restart (which
  // take no turn, and move the player or wind the turns back) start it afresh; LOOK and the like
  // leave it be.
  const moved = view.room.id !== lastRoom;
  if (!played && (moved || view.turns < lastTurns)) trail = [];
  else if (moved) trail = [lastRoom, ...trail.filter((id) => id !== view.room.id)].slice(0, 3);
  lastRoom = view.room.id;
  lastTurns = view.turns;
  const found = renderMinimap(minimap, def, view, {
    caption: { label: $('#map-label'), here: $('#map-here'), count: $('#map-count') },
    reveal: played,
    trail,
  });
  if (found) flare($('#map-count'));
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
    // as the last words of a death land, the tube browns out once
    if (!view.won && played) screen.whenIdle(() => flare($('#screen'), 'is-dying'));
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
  if (titleScreen.hidden) return;
  titleScreen.hidden = true;
  setGameInert(false);
  screen.clear();
  game = newGame();
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

// While the title screen is up, the game behind it can't take focus or be read.
const gameRegions = ['.bar', '#left', '#screen', '#right'].map((s) => $<HTMLElement>(s));
function setGameInert(on: boolean): void {
  for (const region of gameRegions) region.inert = on;
}
setGameInert(!titleScreen.hidden);

// Saves from an older version of the game can't be continued: clear them out.
if (purgeStaleSaves(def.id, (data) => isCompatibleSave(def, data)) > 0) {
  $<HTMLParagraphElement>('#save-notice').hidden = false;
}

const continueButton = $<HTMLButtonElement>('#continue-button');
continueButton.hidden = autosave.load(def.id) === null;
continueButton.addEventListener('click', () => begin(true));
$('#new-button').addEventListener('click', () => begin(false));
(continueButton.hidden ? $<HTMLButtonElement>('#new-button') : continueButton).focus();

// ---- global input ------------------------------------------------------------

document.addEventListener('keydown', (e) => {
  if (settingsDialog.open) return;
  if (!titleScreen.hidden) {
    // A focused button or link handles Enter itself; otherwise focus was lost
    // (a click on the background, a tab that loaded unfocused), so start here.
    const target = e.target as HTMLElement;
    if (e.key === 'Enter' && !e.repeat && !target.closest('button, a')) {
      e.preventDefault();
      begin(!continueButton.hidden);
    }
    return;
  }
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
  // On phones a tap on the dimmed story closes an open drawer, and does nothing else.
  if (app.dataset.open) {
    closePanels();
    return;
  }
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
