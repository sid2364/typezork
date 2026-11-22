import { describe, expect, it } from 'vitest';
import { defineGame, item, room } from '../src/dsl';
import { newGame, play, say, pastSkeleton } from './helpers';

describe('movement', () => {
  it('accepts bare directions and abbreviations', () => {
    const game = pastSkeleton();
    say(game, 'open door');
    expect(say(game, 'east')).toContain("Dragon's Cell");
    expect(say(game, 'west')).toContain('Crypt');
    expect(say(game, 'walk east')).toContain("Dragon's Cell");
  });

  it('a locked door opens on the way through if you carry the key', () => {
    const game = pastSkeleton();
    play(game, ['open door', 'east', 'north', 'open chest', 'take key', 'south']);
    expect(say(game, 'south')).toMatch(
      /^You turn the key in the lock\. The gate is unlocked\.\nThe gate opens.*\n\n?Armoury/,
    );
  });

  it('closing the chest hides the key inside it', () => {
    const game = pastSkeleton();
    play(game, ['open door', 'east', 'north', 'open chest']);
    expect(say(game, 'look')).toContain('velvet cloth');
    say(game, 'close chest');
    expect(say(game, 'look')).not.toContain('key');
    expect(say(game, 'take key')).not.toContain('You have a key');
    say(game, 'open chest');
    expect(say(game, 'take key')).toContain('You have a key');
  });

  it('a closed, unlocked door opens on the way through', () => {
    const game = pastSkeleton();
    expect(say(game, 'east')).toMatch(
      /^The door opens revealing a path towards the east\.\n\n?Dragon's Cell/,
    );
  });

  it('says where you cannot go', () => {
    const game = pastSkeleton();
    expect(say(game, 'north')).toBe("You can't go north.");
    expect(say(game, 'go')).toBe('Go where?');
    expect(say(game, 'go sideways')).toBe('I don\'t know how to go "sideways".');
  });
});

describe('things', () => {
  it('look, examine and shortcuts', () => {
    const game = pastSkeleton();
    expect(say(game, 'look')).toMatch(/^Crypt\nYou find yourself/);
    expect(say(game, 'examine candle')).toMatch(/^A stubby candle/);
    expect(say(game, 'look at the bones')).toMatch(/^It's a bone/);
    expect(say(game, 'examine door')).toMatch(
      /^A sturdy wooden door with an old iron handle\..*\nThe door is closed\.$/,
    );
    expect(say(game, 'examine unicorn')).toBe('You see no unicorn here.');
  });

  it('take, drop and inventory', () => {
    const game = pastSkeleton();
    expect(say(game, 'inventory')).toBe('You do not hold anything at the moment.');
    expect(say(game, 'take candle')).toBe("It's almost out, and is stuck fast to the ground.");
    expect(say(game, 'pick up bone')).toBe('You now have a bone.');
    expect(say(game, 'take bone')).toBe('You already have that!');
    expect(say(game, 'inventory')).toBe('You have with you: bone.');
    expect(say(game, 'drop it')).toBe('Dropped.');
    expect(say(game, 'drop bone')).toBe("Cannot drop something you don't have!");
    // A dropped item keeps its identity and is listed generically.
    expect(say(game, 'look')).toContain('There is a bone here.');
    expect(say(game, 'take bone')).toBe('Taken.');
  });

  it('dropped items can be carried elsewhere', () => {
    const game = pastSkeleton();
    play(game, ['take bone', 'open door', 'east', 'drop bone']);
    expect(say(game, 'look')).toContain('There is a bone here.');
    expect(game.state.things.bone).toBe('dragonCell');
  });

  it('take all', () => {
    const game = pastSkeleton();
    expect(say(game, 'take all')).toBe('bone:\nYou now have a bone.');
  });

  it('open and close', () => {
    const game = pastSkeleton();
    expect(say(game, 'open door')).toBe('The door opens revealing a path towards the east.');
    expect(say(game, 'open door')).toBe('The door is already open.');
    expect(say(game, 'close door')).toBe('You close the door.');
    expect(say(game, 'open candle')).toBe("It's not possible to open the candle.");
  });

  it('chained commands share a verb', () => {
    const game = pastSkeleton();
    play(game, [
      'open door',
      'east',
      'north',
      'open chest',
      'take key',
      'south',
      'unlock gate',
      'south',
    ]);
    expect(say(game, 'take sword and spear')).toBe(
      'Good choice. You now have a sword.\nGreat choice! You now have a spear.',
    );
  });

  it('attacking things that are not creatures', () => {
    const game = pastSkeleton();
    expect(say(game, 'kill candle')).toBe("Violence won't help with the candle.");
    expect(say(game, 'kill wizard')).toBe('There is no wizard you can tussle with here.');
  });

  it('unknown verbs', () => {
    const game = pastSkeleton();
    expect(say(game, 'moonwalk wildly')).toMatch(/I don't know how to "moonwalk wildly"/);
  });

  it('wait and help', () => {
    const game = pastSkeleton();
    expect(say(game, 'wait')).toBe('Okay then...');
    expect(say(game, 'help')).toMatch(/kill dragon with spear/);
  });
});

describe('disambiguation', () => {
  const def = defineGame({
    id: 'keys',
    title: 'Keys',
    start: 'hall',
    rooms: [room('hall', { name: 'Hall', description: 'A hall.' })],
    things: [
      item('brass', { name: 'brass key', location: 'hall', portable: true, takeMessage: 'Brass!' }),
      item('iron', { name: 'iron key', location: 'hall', portable: true, takeMessage: 'Iron!' }),
    ],
  });

  it('asks which one, then carries on', () => {
    const game = newGame(def);
    expect(say(game, 'take key')).toBe('Which do you mean, the brass key or the iron key?');
    expect(say(game, 'iron')).toBe('Iron!');
    expect(game.state.things.iron).toBe('inventory');
    expect(say(game, 'take key')).toBe('Brass!');
  });

  it('gives up on an unhelpful answer', () => {
    const game = newGame(def);
    say(game, 'take key');
    expect(say(game, 'blue')).toBe("That didn't narrow it down. Never mind.");
  });
});

describe('game-specific commands', () => {
  it('can add verbs and synonyms', () => {
    const def = defineGame({
      id: 'custom',
      title: 'Custom',
      start: 'hall',
      rooms: [room('hall', { name: 'Hall', description: 'A hall.' })],
      things: [item('rose', { name: 'rose', location: 'hall', portable: true })],
      commands: [
        {
          id: 'smell',
          verbs: ['smell', 'sniff'],
          run: (ctx) => {
            const id = ctx.resolve(ctx.cmd.direct);
            if (id) ctx.w.say(`The ${ctx.w.thing(id).name} smells lovely.`);
          },
        },
      ],
      synonyms: { take: ['pocket'] },
    });
    const game = newGame(def);
    expect(say(game, 'sniff rose')).toBe('The rose smells lovely.');
    expect(say(game, 'pocket rose')).toBe('Taken.');
  });

  it('treats saying hello to someone as talking to them', () => {
    const talked = say(newGame(), 'talk to skeleton');
    expect(say(newGame(), 'hello skeleton')).toBe(talked);
    expect(say(newGame(), 'hi skeleton')).toBe(talked);
    expect(say(newGame(), 'hello dragon')).toBe(say(newGame(), 'talk to dragon'));
  });
});

describe('events', () => {
  it('beforeMove can veto and turn counts', () => {
    const game = pastSkeleton();
    const turns: number[] = [];
    game.bus.on('beforeMove', ({ to }) =>
      to === 'dragonCell' ? 'A ghost bars the way.' : undefined,
    );
    game.bus.on('turn', ({ turns: t }) => void turns.push(t));
    const start = game.state.turns;
    say(game, 'open door');
    expect(say(game, 'east')).toBe('A ghost bars the way.');
    expect(turns).toEqual([start + 1, start + 2]);
  });
});
