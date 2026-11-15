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
    expect(say(game, 'w')).toMatch(/game is over/);
    expect(say(game, 'undo')).toContain('River');
    expect(game.state.over).toBe(false);
  });
});

describe('crypt puzzles', () => {
  it('the gate is locked without the key', () => {
    const game = newGame();
    play(game, ['open door', 'e']);
    expect(say(game, 's')).toBe('The gate is locked.');
    expect(say(game, 'open gate')).toBe('The gate is locked.');
    expect(say(game, 'unlock gate')).toBe('You do not have the required object to open this.');
    expect(game.state.location).toBe('dragonCell');
  });

  it('open gate with the key unlocks and opens it', () => {
    const game = newGame();
    play(game, ['open door', 'e', 'n', 'open chest', 'take key', 's']);
    expect(say(game, 'open gate')).toBe(
      'You turn the key in the lock. The gate is unlocked.\n' +
        'The gate opens, you see daylight coming through from behind it.',
    );
  });

  it('the dragon blocks the way east while alive', () => {
    const game = newGame();
    play(game, ['open door', 'e']);
    expect(say(game, 'e')).toMatch(/won't get past it/);
  });

  it('the garden is hidden until the troll dies', () => {
    const game = newGame();
    play(game, WALKTHROUGH.slice(0, 12));
    expect(game.state.location).toBe('portcullis');
    expect(say(game, 'n')).toBe("You can't go north.");
    expect(game.view().exits.map((e) => e.dir)).not.toContain('north');
  });

  it('the river blocks you without the torch, and parts once with it', () => {
    const game = newGame();
    play(game, WALKTHROUGH.slice(0, 13));
    expect(say(game, 's')).toMatch(/You cannot get past the stream/);
    play(game, ['n', 'n', 'take torch', 's', 's']);
    expect(say(game, 's')).toMatch(/^The water in the river bends and parts/);
    expect(say(game, 'n')).not.toMatch(/bends and parts/);
    expect(say(game, 's')).not.toMatch(/bends and parts/);
  });

  it('asks which weapon when none is given', () => {
    const game = newGame();
    play(game, WALKTHROUGH.slice(0, 10));
    expect(say(game, 'kill dragon')).toBe(
      'You do not stand a chance if you fight with your bare hands.\n' +
        'What do you want to attack the dragon with?',
    );
    expect(game.question).toBe('What do you want to attack the dragon with?');
    expect(say(game, 'key')).toMatch(/not possess a weapon worthy/);
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
    play(game, ['open door', 'e']);
    expect(say(game, 'kill dragon')).toMatch(/Come back another day/);
  });

  it('weapons the troll is not weak to', () => {
    const game = newGame();
    play(game, WALKTHROUGH.slice(0, 7));
    play(game, ['s', 'take sword', 'n', 'kill dragon with sword', 'e']);
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
