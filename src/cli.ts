/**
 * Terminal front-end: `npm run cli`. Works interactively or with piped input:
 *   printf 'open door\ne\n' | npm run cli --silent
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { crypt } from './content/crypt';
import { Game, type OutputLine, type SaveStorage } from './engine';

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

const tty = process.stdout.isTTY;
const width = Math.min(process.stdout.columns || 80, 100);
const colour: Record<OutputLine['style'], string> = {
  title: '\x1b[1;32m',
  room: '\x1b[32m',
  info: '',
  error: '\x1b[33m',
  question: '\x1b[36m',
  win: '\x1b[1;35m',
  echo: '\x1b[2m',
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

function print(lines: readonly OutputLine[]): void {
  for (const l of lines) {
    if (l.style === 'echo' && tty) continue; // the player can already see what they typed
    if (l.style === 'title') process.stdout.write('\n');
    const text = wrap(l.text);
    process.stdout.write(
      tty && colour[l.style] ? `${colour[l.style]}${text}\x1b[0m\n` : `${text}\n`,
    );
  }
}

const game = new Game(crypt, { storage: fileStorage });
print(game.start());

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: tty });
const prompt = () => {
  if (tty) rl.prompt();
};
rl.setPrompt('\n> ');
prompt();
rl.on('line', (input) => {
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
  prompt();
});
rl.on('close', () => process.exit(0));
