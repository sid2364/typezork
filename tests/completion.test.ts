import { describe, expect, it } from 'vitest';
import { complete, type Completions } from '../src/ui/input';
import { newGame, pastSkeleton } from './helpers';

const c: Completions = {
  suggestions: ['talk to skeleton', 'take candle', 'go east', 'look', 'inventory'],
  verbs: ['go', 'look', 'examine', 'take', 'drop', 'give', 'talk', 'mix'],
  things: ['candle', 'bone', 'skeleton', 'rusty key'],
  exits: ['east', 'north'],
};

describe('complete', () => {
  it('offers nothing for an empty prompt', () => {
    expect(complete('', c)).toBeNull();
    expect(complete('   ', c)).toBeNull();
  });

  it('prefers a whole command from the Try list', () => {
    expect(complete('ta', c)).toBe('talk to skeleton');
    expect(complete('tak', c)).toBe('take candle');
    expect(complete('talk to s', c)).toBe('talk to skeleton');
  });

  it('finishes the first word as a verb, then as a direction', () => {
    expect(complete('ex', c)).toBe('examine');
    expect(complete('m', c)).toBe('mix');
    expect(complete('nor', c)).toBe('north');
  });

  it('finishes the name of a thing after the verb', () => {
    expect(complete('examine sk', c)).toBe('examine skeleton');
    expect(complete('drop ru', c)).toBe('drop rusty key');
    expect(complete('drop rusty k', c)).toBe('drop rusty key');
    expect(complete('take the b', c)).toBe('take the bone');
  });

  it('finishes the second thing after a preposition', () => {
    expect(complete('give bone to sk', c)).toBe('give bone to skeleton');
  });

  it('finishes a direction after GO', () => {
    expect(complete('go n', c)).toBe('go north');
  });

  it('only finishes the last of several commands', () => {
    expect(complete('look and ex', c)).toBe('look and examine');
    expect(complete('look, then drop b', c)).toBe('look, then drop bone');
  });

  it('offers nothing once a word is finished or nothing matches', () => {
    expect(complete('examine', c)).toBeNull();
    expect(complete('examine candle', c)).toBeNull();
    expect(complete('xyz', c)).toBeNull();
    expect(complete('drop ', c)).toBeNull();
  });

  it('ignores case', () => {
    expect(complete('EX', c)).toBe('examine');
    expect(complete('Examine Sk', c)).toBe('Examine skeleton');
  });
});

describe('vocabulary', () => {
  it('lists every verb but the jokes', () => {
    const { verbs } = newGame().view().vocabulary;
    expect(verbs).toEqual(expect.arrayContaining(['examine', 'take', 'mix', 'sneak', 'answer']));
    for (const joke of ['dance', 'xyzzy', 'eat', 'smell', 'home'])
      expect(verbs).not.toContain(joke);
  });

  it('names what is here and what is carried', () => {
    const game = pastSkeleton();
    game.submit('take candle');
    const { things } = game.view().vocabulary;
    expect(things).toContain('candle');
    expect(things).toContain('door');
  });
});
