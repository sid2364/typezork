import { describe, expect, it } from 'vitest';
import { crypt } from '../src/content/crypt';
import { Game } from '../src/engine';
import { newGame, play, say, WALKTHROUGH, pastSkeleton } from './helpers';

describe('intro and restart markers', () => {
  it('pauses between the intro and the first room', () => {
    const styles = new Game(crypt).start().map((l) => l.style);
    const pause = styles.indexOf('pause');
    expect(pause).toBeGreaterThan(0);
    expect(styles.slice(pause + 1)[0]).toBe('title'); // the room name comes after the pause
    expect(styles).not.toContain('clear');
  });

  it('restart clears the screen and pauses again', () => {
    const game = pastSkeleton();
    say(game, 'open door');
    game.submit('restart');
    const styles = game.submit('yes').map((l) => l.style);
    expect(styles.indexOf('clear')).toBeGreaterThanOrEqual(0);
    expect(styles.indexOf('clear')).toBeLessThan(styles.indexOf('pause'));
  });
});

describe('go back', () => {
  it('returns to the previous room, and back again', () => {
    const game = pastSkeleton();
    play(game, ['open door', 'east', 'north']);
    expect(say(game, 'go back')).toContain("Dragon's Cell");
    expect(say(game, 'back')).toContain('Dungeon');
    expect(say(game, 'return')).toContain("Dragon's Cell");
    expect(game.state.previous).toBe('dungeon');
  });

  it.each(['cd ..', 'cd', 'cd -', 'cd ../..'])('"%s" goes back', (input) => {
    const game = pastSkeleton();
    play(game, ['open door', 'east', 'north']);
    expect(say(game, input)).toContain("Dragon's Cell");
    expect(game.state.location).toBe('dragonCell');
  });

  it('cd also takes a direction', () => {
    const game = pastSkeleton();
    play(game, ['open door', 'east']);
    say(game, 'cd north');
    expect(game.state.location).toBe('dungeon');
  });

  it('needs somewhere to go back to', () => {
    expect(say(pastSkeleton(), 'go back')).toBe("Back where? You haven't been anywhere yet.");
  });

  it('respects guards on the way back', () => {
    const game = pastSkeleton();
    play(game, WALKTHROUGH.slice(0, 13)); // at the portcullis, no torch
    play(game, ['north', 'go back']);
    expect(game.state.location).toBe('portcullis');
  });
});

describe('shortcuts are gone', () => {
  it.each(['n', 'i', 'l', 'x candle'])('"%s" is not understood', (input) => {
    expect(say(pastSkeleton(), input)).toMatch(/I don't know how to/);
  });
});

describe('bare hands', () => {
  it('kill dragon with hands', () => {
    const game = pastSkeleton();
    play(game, ['open door', 'east']);
    expect(say(game, 'kill dragon with bare hands')).toMatch(/punch the dragon squarely/);
    expect(say(game, 'punch dragon')).toMatch(/ambitious moth/);
    expect(game.state.killed).toEqual([]);
  });

  it('answering the weapon question with fists', () => {
    const game = pastSkeleton();
    play(game, WALKTHROUGH.slice(0, 10));
    say(game, 'kill dragon');
    expect(say(game, 'my fists')).toMatch(/punch the dragon/);
  });

  it('the troll has its own jokes', () => {
    const game = pastSkeleton();
    play(game, WALKTHROUGH.slice(0, 12));
    expect(say(game, 'kick troll')).toMatch(/giggles/);
  });
});

describe('jokes', () => {
  it('silly verbs get answers and take no turn', () => {
    const game = newGame();
    expect(say(game, 'xyzzy')).toMatch(/Wrong game/);
    expect(say(game, 'eat bone')).toMatch(/regret/);
    expect(say(game, 'smell')).toMatch(/adventure/);
    expect(game.state.turns).toBe(0);
  });
});

describe('compact help', () => {
  it('groups related commands on one line', () => {
    const text = say(pastSkeleton(), 'help');
    expect(text).toContain('take bone · drop bone');
    expect(text).toContain('go north · go back');
    expect(text.split('\n').length).toBeLessThanOrEqual(9);
  });
});
