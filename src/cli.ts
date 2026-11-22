/**
 * Terminal front-end: `npm run cli`. Works interactively or with piped input:
 *   printf 'open door\ne\n' | npm run cli --silent
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { crypt } from './content/crypt';
import { Game, isCompatibleSave, type OutputLine, type SaveStorage } from './engine';

const SAVE_DIR = join(process.cwd(), '.saves');

const fileStorage: SaveStorage = {
  save(slot, data) {
    mkdirSync(SAVE_DIR, { recursive: true });
    writeFileSync(join(SAVE_DIR, `${safe(slot)}.json`), data);
  },
  load(slot) {
    const file = join(SAVE_DIR, `${safe(slot)}.json`);
    return existsSync(file) ? readFileSync(file, 'utf8') : null;
  },
};
const safe = (slot: string) => slot.replace(/[^a-z0-9-]/gi, '_');

/** Delete saves from an older version of the game. Returns how many were removed. */
function purgeStaleSaves(): number {
  if (!existsSync(SAVE_DIR)) return 0;
  let removed = 0;
  for (const name of readdirSync(SAVE_DIR)) {
    if (!name.endsWith('.json')) continue;
    const file = join(SAVE_DIR, name);
    if (!isCompatibleSave(crypt, readFileSync(file, 'utf8'))) {
      rmSync(file);
      removed++;
    }
  }
  return removed;
}

const tty = process.stdout.isTTY;
const width = Math.min(process.stdout.columns || 80, 100);
const colour: Record<OutputLine['style'], string> = {
  title: '\x1b[1;32m',
  room: '\x1b[32m',
  info: '',
  error: '\x1b[33m',
  question: '\x1b[36m',
  option: '\x1b[92m',
  hint: '\x1b[3;94m',
  win: '\x1b[1;35m',
  lose: '\x1b[1;31m',
  echo: '\x1b[2m',
  pause: '',
  clear: '',
};

function wrap(text: string): string {
  if (text.startsWith('  ')) return text; // pre-formatted (help table)
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current && current.length + word.length + 1 > width) {
      lines.push(current);
      current = word;
    } else current = current ? `${current} ${word}` : word;
  }
  lines.push(current);
  return lines.join('\n');
}

/** Lines held back until the player presses Enter (after a 'pause' marker). */
let held: OutputLine[] | null = null;

function print(lines: readonly OutputLine[]): void {
  for (const [i, l] of lines.entries()) {
    if (l.style === 'clear') {
      if (tty) process.stdout.write('\x1b[2J\x1b[H');
      continue;
    }
    if (l.style === 'pause') {
      if (!tty) continue;
      held = lines.slice(i + 1);
      process.stdout.write('\n\x1b[2m[Press Enter to continue]\x1b[0m');
      return;
    }
    if (l.style === 'echo' && tty) continue; // the player can already see what they typed
    if (l.style === 'title') process.stdout.write('\n');
    const text = wrap(l.text);
    process.stdout.write(
      tty && colour[l.style] ? `${colour[l.style]}${text}\x1b[0m\n` : `${text}\n`,
    );
  }
}

// game overs are counted in a small file so the crypt remembers them
const DEATHS_FILE = join(SAVE_DIR, 'deaths.txt');
const game = new Game(crypt, {
  storage: fileStorage,
  deaths: existsSync(DEATHS_FILE) ? Number(readFileSync(DEATHS_FILE, 'utf8')) || 0 : 0,
  onDeath(total) {
    mkdirSync(SAVE_DIR, { recursive: true });
    writeFileSync(DEATHS_FILE, String(total));
  },
});
if (purgeStaleSaves() > 0) {
  process.stdout.write('Old saves from an earlier version of the game were removed.\n');
}
print(game.start());

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: tty });
const prompt = () => {
  if (tty) rl.prompt();
};
rl.setPrompt('\n> ');
if (!held) prompt();
rl.on('line', (input) => {
  if (held) {
    const rest = held;
    held = null;
    print(rest);
    if (!held) prompt();
    return;
  }
  const text = input.trim().toLowerCase();
  if (text === 'quit' || text === 'exit' || text === 'q') {
    process.stdout.write('Good-bye.\n');
    rl.close();
    return;
  }
  print(game.submit(input));
  if (game.state.over && !tty) {
    rl.close();
    return;
  }
  if (!held) prompt();
});
rl.on('close', () => process.exit(0));
