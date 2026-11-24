import { describe, expect, it } from 'vitest';
import { crypt } from '../src/content/crypt';
import { Game } from '../src/engine';
import { newGame, pastSkeleton, play, say, TO_ARMOURY } from './helpers';

// the player is always right: what playtesters typed, and what it should mean

const SWING = /throws you down among the bones/;
const LOOK = /twist of rusted wire/;

describe('the obvious thing', () => {
  it('"fight it" and "hit him" mean the one creature in the room', () => {
    expect(say(newGame(), 'fight it')).toMatch(SWING);
    expect(say(newGame(), 'hit him')).toMatch(SWING);
    expect(say(newGame(), 'look at him')).toMatch(LOOK);
  });

  it('a verb on its own takes the one thing it could mean, and says so', () => {
    const out = say(newGame(), 'fight');
    expect(out).toMatch(/^\(the skeleton\)\n/);
    expect(out).toMatch(SWING);
    expect(say(newGame(), 'take')).toBe('(the bone)\nYou now have a bone.');
  });

  it('talking about someone makes them "it"', () => {
    const game = newGame();
    play(game, ['talk', '1']);
    expect(say(game, 'fight it')).toMatch(SWING);
  });

  it('"look closer" after the skeleton asks for it means the skeleton', () => {
    const game = newGame();
    play(game, ['talk', '1']);
    expect(say(game, 'look closer')).toMatch(/^\(the skeleton\)\n.*twist of rusted wire/);
    expect(game.state.flags.skeletonClue).toBe(true);
  });

  it('says plainly when nothing could be meant', () => {
    const game = pastSkeleton();
    play(game, ['open door', 'east', 'north']);
    expect(say(game, 'fight')).toBe('There is nothing here to fight.');
  });
});

describe('follow-up questions', () => {
  it('asks what to look at, and the answer finishes the command', () => {
    const game = newGame();
    expect(say(game, 'look closer')).toBe('What do you want to look at?');
    expect(game.view().suggestions).toEqual(['candle', 'bone', 'door', 'skeleton']);
    expect(say(game, 'skeleton')).toMatch(LOOK);
    expect(game.question).toBeNull();
  });

  it('uses the verb the player typed', () => {
    const game = newGame();
    expect(say(game, 'examine')).toBe('What do you want to examine?');
    expect(say(game, 'candle')).toMatch(/stubby candle/);
  });

  it('asks which weapon-room thing to take, and takes it', () => {
    const game = pastSkeleton();
    play(game, TO_ARMOURY);
    expect(say(game, 'take')).toBe('What do you want to take?');
    expect(say(game, 'the spear')).toMatch(/You now have a spear/);
  });

  it('a new command instead of an answer just runs', () => {
    const game = newGame();
    say(game, 'examine');
    expect(say(game, 'look')).toMatch(/^Crypt\n/);
    expect(game.question).toBeNull();
  });

  it('can be waved away', () => {
    const game = newGame();
    say(game, 'examine');
    expect(say(game, 'nevermind')).toBe('Never mind, then.');
  });
});

describe('noun phrases', () => {
  it('filler words are ignored', () => {
    expect(say(newGame(), 'look at the skeleton closely')).toMatch(LOOK);
    expect(say(newGame(), 'examine it more closely')).toMatch(LOOK);
    expect(say(newGame(), 'look more closely at the bones')).toMatch(/It's a bone/);
  });

  it('extra words after the name are ignored', () => {
    expect(say(newGame(), 'ask skeleton who it is')).toMatch(/Another one awake/);
  });

  it('"in the face" is where you hit, not what with', () => {
    expect(say(newGame(), 'punch it in the face')).toMatch(SWING);
    const game = newGame();
    play(game, ['examine skeleton']);
    expect(say(game, 'kick the skeleton in the jaw')).toMatch(/jaw goes spinning/);
  });

  it('"with" still names a weapon', () => {
    const game = newGame();
    play(game, ['take bone']);
    expect(say(game, 'hit skeleton with bone')).toMatch(/Hands only/);
  });
});

describe('vocabulary', () => {
  it.each([
    ['x skeleton', LOOK],
    ['what is that', LOOK],
    ['approach skeleton', LOOK],
    ['take a closer look at the skeleton', LOOK],
    ['study the skeleton', LOOK],
    ['i', /You do not hold anything/],
    ['l', /^Crypt\n/],
    ['z', /Okay then/],
    ['smack the skeleton', SWING],
    ['say hello to the skeleton', /Another one awake/],
    ['i want to fight it', SWING],
    ['please open the door', /will not let go/],
    ['can i talk to the skeleton', /Another one awake/],
  ])('"%s"', (input, expected) => {
    expect(say(newGame(), input)).toMatch(expected);
  });

  it('an unknown verb with a known thing says what can be done with it', () => {
    expect(say(newGame(), 'juggle skeleton')).toBe(
      'I don\'t know how to "juggle" the skeleton, but you could examine it, talk to it or ' +
        'attack it.',
    );
    expect(say(newGame(), 'moonwalk wildly')).toMatch(/Type HELP/);
  });

  it('no word means two different commands', () => {
    const owners = new Map<string, Set<string>>();
    const game = new Game(crypt);
    const phrases = [
      ...game.commandList.flatMap((c) => c.verbs.map((v) => [v, c.id] as const)),
      ...Object.entries(crypt.synonyms).flatMap(([id, vs]) => vs.map((v) => [v, id] as const)),
    ];
    for (const [verb, id] of phrases) owners.set(verb, (owners.get(verb) ?? new Set()).add(id));
    // the crypt overrides "read" on purpose: reading is examining, except for the scroll
    const clashes = [...owners].filter(([v, ids]) => ids.size > 1 && v !== 'read');
    expect(clashes).toEqual([]);
  });
});

describe('leaving', () => {
  it('"go through the door" and "leave" take the way out', () => {
    const game = pastSkeleton();
    expect(say(game, 'go through the door')).toContain("Dragon's Cell");
    const again = pastSkeleton();
    expect(say(again, 'leave')).toContain("Dragon's Cell");
  });

  it('"leave" with several ways out asks which', () => {
    const game = pastSkeleton();
    play(game, ['open door', 'east']);
    expect(say(game, 'leave')).toBe('Which way do you want to go?');
    expect(say(game, 'north')).toMatch(/Dungeon/);
    expect(game.state.location).toBe('dungeon');
  });

  it('"leave bone" still drops it', () => {
    const game = newGame();
    play(game, ['take bone']);
    expect(say(game, 'leave bone')).toBe('Dropped.');
  });
});
