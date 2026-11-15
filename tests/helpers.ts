import { crypt } from '../src/content/crypt';
import { Game, type GameOptions, type SaveStorage } from '../src/engine';
import type { GameDef } from '../src/engine/definitions';

export function newGame(def: GameDef = crypt, options: GameOptions = {}): Game {
  const game = new Game(def, options);
  game.start();
  return game;
}

/** Submit a command and return the non-echo output as one string. */
export function say(game: Game, input: string): string {
  return game
    .submit(input)
    .filter((l) => l.style !== 'echo' && l.style !== 'pause' && l.style !== 'clear')
    .map((l) => l.text)
    .join('\n');
}

export function play(game: Game, inputs: readonly string[]): string {
  return inputs.map((i) => say(game, i)).join('\n');
}

export function memoryStorage(): SaveStorage & { slots: Map<string, string> } {
  const slots = new Map<string, string>();
  return {
    slots,
    save: (slot, data) => void slots.set(slot, data),
    load: (slot) => slots.get(slot) ?? null,
  };
}

export const WALKTHROUGH = [
  'open door',
  'east',
  'north',
  'open chest',
  'take key',
  'south',
  'unlock gate',
  'south',
  'take spear',
  'north',
  'kill dragon with spear',
  'east',
  'kill troll with spear',
  'north',
  'north',
  'take torch',
  'south',
  'south',
  'answer fire',
  'south',
  'east',
] as const;
