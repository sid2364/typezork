import { describe, expect, it } from 'vitest';
import { crypt } from '../src/content/crypt';
import { Game } from '../src/engine';
import { deserialize, initialState, SaveError, serialize } from '../src/engine/state';
import { memoryStorage, newGame, play, say, WALKTHROUGH } from './helpers';

describe('state', () => {
  it('round-trips through JSON', () => {
    const game = newGame();
    play(game, WALKTHROUGH.slice(0, 11));
    const text = game.serialize();
    expect(deserialize(crypt, text)).toEqual(game.state);
  });

  it('starts sensibly', () => {
    const s = initialState(crypt);
    expect(s.location).toBe('start');
    expect(s.locked).toEqual(['gate']);
    expect(s.things.key).toBe('nowhere');
    expect(s.visited).toEqual(['start']);
  });

  it('rejects bad saves', () => {
    expect(() => deserialize(crypt, 'nope')).toThrow(SaveError);
    expect(() => deserialize(crypt, '{"format":"other"}')).toThrow(SaveError);
    const other = serialize({ ...crypt, id: 'other' }, initialState(crypt));
    expect(() => deserialize(crypt, other)).toThrow(/another game/);
  });
});

describe('save, load, restore', () => {
  it('save and load through storage', () => {
    const storage = memoryStorage();
    const game = newGame(crypt, { storage });
    play(game, ['open door', 'east']);
    expect(say(game, 'save')).toBe('Game saved.');
    play(game, ['north', 'open chest']);
    expect(say(game, 'load')).toMatch(/^Game loaded\.\nDragon's Cell/);
    expect(game.state.location).toBe('dragonCell');
    expect(game.state.opened).toEqual(['door']);
    expect(say(game, 'load other')).toBe('There is no save called "other".');
  });

  it('without storage', () => {
    expect(say(newGame(), 'save')).toBe("Saving isn't available here.");
  });

  it('restore() continues a game', () => {
    const game = newGame();
    play(game, ['open door', 'east', 'north']);
    const copy = new Game(crypt);
    copy.restore(game.serialize());
    expect(copy.resume().map((l) => l.text)[0]).toBe('Dungeon');
    say(copy, 'open chest');
    expect(say(copy, 'take key')).toMatch(/You have a key/);
  });
});

describe('undo and restart', () => {
  it('undo steps back one turn at a time', () => {
    const game = newGame();
    play(game, ['open door', 'east', 'north']);
    expect(game.state.turns).toBe(3);
    expect(say(game, 'undo')).toMatch(/^Previous turn undone\.\nDragon's Cell/);
    say(game, 'undo');
    expect(game.state.location).toBe('start');
    expect(game.state.opened).toEqual(['door']);
    say(game, 'undo');
    expect(game.state.opened).toEqual([]);
    expect(say(game, 'undo')).toBe('There is nothing to undo.');
  });

  it('look and inventory do not take a turn', () => {
    const game = newGame();
    play(game, ['look', 'inventory', 'examine candle']);
    expect(game.state.turns).toBe(0);
  });

  it('restart asks first', () => {
    const game = newGame();
    play(game, ['open door', 'east']);
    expect(say(game, 'restart')).toBe('Do you really want to start over? (y/n)');
    expect(say(game, 'n')).toBe('Carry on, then.');
    expect(game.state.location).toBe('dragonCell');
    say(game, 'restart');
    expect(say(game, 'y')).toMatch(/^Zork/);
    expect(game.state.location).toBe('start');
    expect(game.state.turns).toBe(0);
  });
});
