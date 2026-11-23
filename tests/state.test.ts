import { describe, expect, it } from 'vitest';
import { crypt } from '../src/content/crypt';
import { Game } from '../src/engine';
import {
  deserialize,
  initialState,
  isCompatibleSave,
  SaveError,
  serialize,
} from '../src/engine/state';
import { memoryStorage, newGame, play, say, WALKTHROUGH, pastSkeleton } from './helpers';

describe('state', () => {
  it('round-trips through JSON', () => {
    const game = pastSkeleton();
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

  it('rejects saves from an older version of the game', () => {
    const old = serialize({ ...crypt, version: crypt.version - 1 }, initialState(crypt));
    expect(() => deserialize(crypt, old)).toThrow(/older version/);
    // saves from before content versions existed carry none
    const unversioned = JSON.parse(serialize(crypt, initialState(crypt))) as Record<
      string,
      unknown
    >;
    delete unversioned.gameVersion;
    expect(() => deserialize(crypt, JSON.stringify(unversioned))).toThrow(/older version/);
  });

  it('isCompatibleSave', () => {
    expect(isCompatibleSave(crypt, serialize(crypt, initialState(crypt)))).toBe(true);
    const old = serialize({ ...crypt, version: crypt.version - 1 }, initialState(crypt));
    expect(isCompatibleSave(crypt, old)).toBe(false);
    expect(isCompatibleSave(crypt, 'nope')).toBe(false);
  });
});

describe('save, load, restore', () => {
  it('save and load through storage', () => {
    const storage = memoryStorage();
    const game = pastSkeleton({ storage });
    play(game, ['open door', 'east']);
    expect(say(game, 'save')).toBe('Game saved.');
    play(game, ['north', 'open chest']);
    // moves since the save would be set aside, so it asks first
    expect(say(game, 'load')).toMatch(/^Load the saved game\?.*\(y\/n\)$/);
    expect(say(game, 'n')).toBe('Carry on, then.');
    expect(game.state.location).toBe('dungeon');
    say(game, 'load');
    expect(say(game, 'y')).toMatch(
      /^Game loaded\. Type UNDO to go back to where you were\.\nDragon's Cell/,
    );
    expect(game.state.location).toBe('dragonCell');
    expect(game.state.opened).toEqual(['door']);
    // nothing new since the load, so a second load needs no question
    expect(say(game, 'load')).toMatch(/^Game loaded\./);
    expect(say(game, 'load other')).toBe('There is no save called "other".');
  });

  it('a load can be undone', () => {
    const storage = memoryStorage();
    const game = pastSkeleton({ storage });
    play(game, ['open door', 'east', 'save', 'north', 'open chest', 'load', 'y']);
    expect(game.state.location).toBe('dragonCell');
    expect(say(game, 'undo')).toMatch(/^Previous turn undone\.\nDungeon/);
    expect(game.state.location).toBe('dungeon');
    expect(game.state.opened).toContain('chest');
    // the turns before the load can still be undone too
    say(game, 'undo');
    expect(game.state.opened).not.toContain('chest');
  });

  it('without storage', () => {
    expect(say(pastSkeleton(), 'save')).toBe("Saving isn't available here.");
  });

  it('restore() continues a game', () => {
    const game = pastSkeleton();
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
    const game = pastSkeleton();
    const start = game.state.turns;
    play(game, ['open door', 'east', 'north']);
    expect(game.state.turns).toBe(start + 3);
    expect(say(game, 'undo')).toMatch(/^Previous turn undone\.\nDragon's Cell/);
    say(game, 'undo');
    expect(game.state.location).toBe('start');
    expect(game.state.opened).toEqual(['door']);
    say(game, 'undo');
    expect(game.state.opened).toEqual([]);
    // one more undo takes back the fight with the skeleton
    say(game, 'undo');
    expect(game.state.flags.skeletonBeaten).toBeUndefined();
  });

  it('look and inventory do not take a turn', () => {
    const game = newGame();
    play(game, ['look', 'inventory', 'examine candle']);
    expect(game.state.turns).toBe(0);
  });

  it('restart asks first', () => {
    const game = pastSkeleton();
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
