import { describe, expect, it } from 'vitest';
import { newGame, play, say, WALKTHROUGH } from './helpers';

describe('crypt walkthrough', () => {
  it('reaches the forest and wins', () => {
    const game = newGame();
    const text = play(game, WALKTHROUGH);
    expect(game.state.location).toBe('end');
    expect(game.state.over).toBe(true);
    expect(game.state.won).toBe(true);
    expect(text).toContain('Bravo! You beat the game!');
    expect(game.view().map.rooms.map((r) => r.id)).toEqual([
      'start',
      'dragonCell',
      'dungeon',
      'weaponsRoom',
      'portcullis',
      'garden',
      'gazebo',
      'river',
      'end',
    ]);
  });

  it('also works as a single chained line', () => {
    const game = newGame();
    say(game, WALKTHROUGH.join(', then '));
    expect(game.state.won).toBe(true);
  });

  it('refuses normal commands after the game is over', () => {
    const game = newGame();
    play(game, WALKTHROUGH);
    expect(say(game, 'west')).toMatch(/game is over/);
    expect(say(game, 'undo')).toContain('River');
    expect(game.state.over).toBe(false);
  });
});

describe('crypt puzzles', () => {
  it('the gate is locked without the key', () => {
    const game = newGame();
    play(game, ['open door', 'east']);
    expect(say(game, 'south')).toBe('The gate is locked.');
    expect(say(game, 'open gate')).toBe('The gate is locked.');
    expect(say(game, 'unlock gate')).toBe('You do not have the required object to open this.');
    expect(game.state.location).toBe('dragonCell');
  });

  it('open gate with the key unlocks and opens it', () => {
    const game = newGame();
    play(game, ['open door', 'east', 'north', 'open chest', 'take key', 'south']);
    expect(say(game, 'open gate')).toBe(
      'You turn the key in the lock. The gate is unlocked.\n' +
        'The gate opens, you see daylight coming through from behind it.',
    );
  });

  it('the dragon blocks the way east while alive', () => {
    const game = newGame();
    play(game, ['open door', 'east']);
    expect(say(game, 'east')).toMatch(/won't get past it/);
  });

  it('the garden is hidden until the troll dies', () => {
    const game = newGame();
    play(game, WALKTHROUGH.slice(0, 12));
    expect(game.state.location).toBe('portcullis');
    expect(say(game, 'north')).toBe("You can't go north.");
    expect(game.view().exits.map((e) => e.dir)).not.toContain('north');
  });

  it('the river blocks you until its riddle is answered with fire', () => {
    const game = newGame();
    play(game, WALKTHROUGH.slice(0, 13));
    expect(say(game, 'south')).toMatch(/You cannot get past the stream/);
    expect(say(game, 'answer water')).toMatch(/not the answer/);
    // The right answer without a flame isn't enough.
    expect(say(game, 'say fire')).toMatch(/words don't burn/);
    expect(say(game, 'south')).toMatch(/You cannot get past the stream/);

    play(game, ['north', 'north', 'take torch', 'south', 'south']);
    // Carrying the torch doesn't solve it on its own.
    expect(say(game, 'south')).toMatch(/waiting for an answer\. The torch in your hand flickers/);
    expect(game.state.location).toBe('portcullis');
    expect(say(game, 'fire')).toMatch(/bends and parts/);
    expect(say(game, 'answer fire')).toMatch(/already let you pass/);
    say(game, 'south');
    expect(game.state.location).toBe('river');
    say(game, 'north');
    say(game, 'south');
    expect(game.state.location).toBe('river');
  });

  it.each([
    'answer fire',
    'say "fire"',
    'flame',
    'show torch to stream',
    'wave torch',
    'use torch',
  ])('"%s" solves the riddle with the torch in hand', (input) => {
    const game = newGame();
    play(game, [...WALKTHROUGH.slice(0, 13), 'north', 'north', 'take torch', 'south', 'south']);
    expect(say(game, input)).toMatch(/bends and parts/);
    say(game, 'south');
    expect(game.state.location).toBe('river');
  });

  it('asks which weapon when none is given', () => {
    const game = newGame();
    play(game, WALKTHROUGH.slice(0, 10));
    expect(say(game, 'kill dragon')).toBe(
      'You do not stand a chance if you fight with your bare hands.\n' +
        'What do you want to attack the dragon with?',
    );
    expect(game.question).toBe('What do you want to attack the dragon with?');
    expect(say(game, 'key')).toMatch(/Dragons do not have keyholes/);
    say(game, 'kill dragon');
    expect(say(game, 'with the spear')).toMatch(/slay the dragon/);
    expect(game.state.killed).toContain('dragon');
  });

  it('a new command abandons the weapon question', () => {
    const game = newGame();
    play(game, WALKTHROUGH.slice(0, 10));
    say(game, 'kill dragon');
    expect(say(game, 'go north')).toContain('Dungeon');
    expect(game.question).toBeNull();
  });

  it('bare hands with nothing carried', () => {
    const game = newGame();
    play(game, ['open door', 'east']);
    expect(say(game, 'kill dragon')).toMatch(/Come back another day/);
  });

  it('weapons the troll is not weak to', () => {
    const game = newGame();
    play(game, WALKTHROUGH.slice(0, 7));
    play(game, ['south', 'take sword', 'north', 'kill dragon with sword', 'east']);
    expect(say(game, 'kill troll with sword')).toMatch(/live and let live/);
    expect(say(game, 'kill troll with spear')).toMatch(/You do not possess this spear/);
  });

  it('dead creatures change their description', () => {
    const game = newGame();
    play(game, WALKTHROUGH.slice(0, 11));
    expect(say(game, 'look')).toMatch(/entrails strewn/);
    expect(say(game, 'kill dragon')).toMatch(/already dead/);
  });
});
