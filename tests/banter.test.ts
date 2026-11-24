import { describe, expect, it } from 'vitest';
import { crypt } from '../src/content/crypt';
import { BANTER_WORDS } from '../src/content/crypt/banter';
import { Game } from '../src/engine';
import { FEED, newGame, pastSkeleton, play, say } from './helpers';

// what playtesters said to the characters as if they were people

const FRIENDS = /"Every one of them asked me that," it says/;
const FAMILY = /"There is something about the jaw,"/;

describe('small talk with the skeleton', () => {
  it('answers "can we be friends" in character, and takes no turn', () => {
    const game = newGame();
    expect(say(game, 'can we be friends')).toMatch(FRIENDS);
    expect(game.state.turns).toBe(0);
  });

  it('knows who "he" is, and who is named', () => {
    expect(say(newGame(), 'is he my dad')).toMatch(FAMILY);
    expect(say(newGame(), 'is the skeleton my father')).toMatch(FAMILY);
  });

  it('warms up once it is beaten', () => {
    expect(say(pastSkeleton(), 'can we be friends')).toMatch(/Friends, then\./);
    expect(say(pastSkeleton(), 'is he my dad')).toMatch(/"Go home," it says/);
  });

  it('catches what used to be misread as a command', () => {
    // these parsed as examine, the riddle answer and give
    expect(say(newGame(), 'who is your dad')).toMatch(FAMILY);
    expect(say(newGame(), 'tell me a joke')).toMatch(/"Knock knock," says the skeleton/);
    expect(say(newGame(), 'give up')).toMatch(/"They all begged,"/);
  });
});

describe('small talk in the middle of a conversation', () => {
  it('is answered, and the question is asked again', () => {
    const game = newGame();
    say(game, 'talk');
    expect(say(game, 'can we be friends')).toMatch(
      new RegExp(`${FRIENDS.source}[^]*\\nWhat do you say\\? \\(1, 2, 3\\)$`),
    );
    expect(say(game, '1')).toMatch(/"The one who holds this door,"/);
  });

  it('typing a line out picks it', () => {
    const game = newGame();
    say(game, 'talk');
    expect(say(game, 'who are you')).toMatch(/^"Who are you\?"\n"The one who holds this door,"/);
    const other = newGame();
    say(other, 'talk');
    expect(say(other, 'let me through')).toMatch(/"They all said that,"/);
  });
});

describe('everyone else', () => {
  it('the empty room has an answer too', () => {
    const game = pastSkeleton();
    play(game, ['open door', 'east', 'north']);
    expect(say(game, 'can we be friends')).toMatch(/You ask the empty room to be your friend\./);
  });

  it('the dragon and the troll answer in their own voices', () => {
    const asleep = pastSkeleton();
    play(asleep, ['open door', 'east']);
    expect(say(asleep, 'can we be friends')).toMatch(/The dragon goes on sleeping\./);
    const fed = pastSkeleton();
    play(fed, FEED);
    expect(say(fed, 'can we be friends')).toMatch(/"We have shared a leg of mutton,"/);
    expect(say(fed, 'is the troll my dad')).toBe('The troll is not here to hear you.');
    play(fed, ['east', 'north']);
    expect(say(fed, 'is he my dad')).toMatch(/The troll counts on his fingers/);
  });

  it('the duck listens', () => {
    const game = newGame();
    (game.state as { location: string }).location = 'library';
    expect(say(game, 'is the duck my dad')).toMatch(/The duck listens with perfect attention/);
  });

  it('without a voice there is nothing to say', () => {
    const game = newGame();
    game.state.killed.push('troll');
    expect(say(game, 'can we be friends')).toBe('You open your mouth. Nothing comes out.');
  });
});

describe('banter words', () => {
  it('are never verbs or names, so no command is lost to them', () => {
    const game = new Game(crypt);
    const verbs = [
      ...game.commandList.flatMap((c) => c.verbs),
      ...Object.values(crypt.synonyms).flat(),
    ].flatMap((v) => v.split(' '));
    const names = Object.values(crypt.things).flatMap((t) =>
      [t.name, ...(t.aliases ?? []), ...(t.adjectives ?? [])].flatMap((n) => n.split(' ')),
    );
    const taken = new Set([...verbs, ...names]);
    expect(BANTER_WORDS.filter((word) => taken.has(word))).toEqual([]);
  });
});
