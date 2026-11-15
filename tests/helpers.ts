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
    .filter((l) => l.style !== 'echo')
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
  'e',
  'n',
  'open chest',
  'take key',
  's',
  'unlock gate',
  's',
  'take spear',
  'n',
  'kill dragon with spear',
  'e',
  'kill troll with spear',
  'n',
  'n',
  'take torch',
  's',
  's',
  's',
  'e',
] as const;
