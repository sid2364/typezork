import { describe, expect, it } from 'vitest';
import { item } from '../src/dsl';
import { parseDirection, opposite } from '../src/engine/direction';
import { splitCommands, tokenize } from '../src/engine/parser/lexer';
import { Lexicon, splitObjects } from '../src/engine/parser/lexicon';
import { resolveNoun } from '../src/engine/parser/resolve';

describe('lexer', () => {
  it('splits chained commands', () => {
    expect(splitCommands('open door and go east, then look. i')).toEqual([
      'open door',
      'go east',
      'look',
      'i',
    ]);
  });

  it('tokenizes, lowercases and drops articles', () => {
    expect(tokenize('Take THE Rusty  key!')).toEqual(['take', 'rusty', 'key']);
    expect(tokenize('go north-east')).toEqual(['go', 'north-east']);
  });
});

describe('directions', () => {
  it('parses words, abbreviations and two-word forms', () => {
    expect(parseDirection(['north'])).toBe('north');
    expect(parseDirection(['n'])).toBe('north');
    expect(parseDirection(['sw'])).toBe('southwest');
    expect(parseDirection(['u'])).toBe('up');
    expect(parseDirection(['north-east'])).toBe('northeast');
    expect(parseDirection(['south', 'west'])).toBe('southwest');
    expect(parseDirection(['up'])).toBe('up');
    expect(parseDirection(['banana'])).toBeUndefined();
  });

  it('knows opposites', () => {
    expect(opposite('north')).toBe('south');
    expect(opposite('northwest')).toBe('southeast');
    expect(opposite('up')).toBe('down');
  });
});

describe('lexicon', () => {
  const lex = new Lexicon();
  lex.add('take', 'take');
  lex.add('take', 'pick up');
  lex.add('examine', 'look at');
  lex.add('look', 'look');

  it('prefers the longest verb phrase', () => {
    expect(lex.match(['look', 'at', 'chest'])).toEqual({ commandId: 'examine', length: 2 });
    expect(lex.match(['look'])).toEqual({ commandId: 'look', length: 1 });
    expect(lex.match(['pick', 'up', 'bone'])).toEqual({ commandId: 'take', length: 2 });
    expect(lex.match(['dance'])).toBeUndefined();
  });

  it('splits direct and indirect objects', () => {
    expect(splitObjects(['troll', 'with', 'big', 'spear'])).toEqual({
      direct: ['troll'],
      prep: 'with',
      indirect: ['big', 'spear'],
    });
    expect(splitObjects(['at', 'chest'])).toEqual({ direct: ['chest'], indirect: [] });
  });
});

describe('resolveNoun', () => {
  const things = {
    brass: item('brass', { name: 'brass key', location: 'nowhere', portable: true }),
    iron: item('iron', { name: 'iron key', location: 'nowhere', portable: true }),
    bone: item('bone', { name: 'bone', aliases: ['pile'], location: 'nowhere', portable: true }),
  };
  const scope = ['brass', 'iron', 'bone'];

  it('matches names, adjectives, aliases and plurals', () => {
    expect(resolveNoun(['brass', 'key'], scope, things)).toEqual({ kind: 'one', id: 'brass' });
    expect(resolveNoun(['iron'], scope, things)).toEqual({ kind: 'none' }); // adjective alone
    expect(resolveNoun(['pile'], scope, things)).toEqual({ kind: 'one', id: 'bone' });
    expect(resolveNoun(['bones'], scope, things)).toEqual({ kind: 'one', id: 'bone' });
  });

  it('reports ambiguity', () => {
    expect(resolveNoun(['key'], scope, things)).toEqual({
      kind: 'ambiguous',
      ids: ['brass', 'iron'],
    });
  });

  it('only looks in scope', () => {
    expect(resolveNoun(['key'], ['iron'], things)).toEqual({ kind: 'one', id: 'iron' });
    expect(resolveNoun(['bone'], ['iron'], things)).toEqual({ kind: 'none' });
  });

  it('resolves "it"', () => {
    expect(resolveNoun(['it'], scope, things, 'bone')).toEqual({ kind: 'one', id: 'bone' });
    expect(resolveNoun(['it'], ['iron'], things, 'bone')).toEqual({ kind: 'none' });
  });

  it('lets any pronoun fall back to the obvious thing', () => {
    expect(resolveNoun(['him'], scope, things, null, 'bone')).toEqual({ kind: 'one', id: 'bone' });
    expect(resolveNoun(['that'], scope, things, 'iron', 'bone')).toEqual({
      kind: 'one',
      id: 'iron',
    });
    expect(resolveNoun(['them'], ['iron'], things, null, 'bone')).toEqual({ kind: 'none' });
  });

  it('ignores filler words', () => {
    expect(resolveNoun(['bone', 'more', 'closely'], scope, things)).toEqual({
      kind: 'one',
      id: 'bone',
    });
    expect(resolveNoun(['closer'], scope, things)).toEqual({ kind: 'none' });
  });

  it('falls back to the longest start that names one thing', () => {
    expect(resolveNoun(['brass', 'key', 'who', 'is'], scope, things)).toEqual({
      kind: 'one',
      id: 'brass',
    });
    // a start that names two things asks which, like the whole phrase would
    expect(resolveNoun(['key', 'please', 'now', 'thing'], scope, things).kind).toBe('ambiguous');
  });
});
