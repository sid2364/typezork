import type { ThingDef } from '../definitions';
import type { ThingId } from '../types';

export type Resolution =
  | { readonly kind: 'one'; readonly id: ThingId }
  | { readonly kind: 'none' }
  | { readonly kind: 'ambiguous'; readonly ids: readonly ThingId[] };

interface Vocabulary {
  /** Words that can name the thing on their own. */
  nouns: Set<string>;
  /** Every word that may appear when referring to it. */
  words: Set<string>;
  /** Full names, for exact matches. */
  phrases: Set<string>;
}

const cache = new WeakMap<ThingDef, Vocabulary>();

function vocabulary(thing: ThingDef): Vocabulary {
  let v = cache.get(thing);
  if (v) return v;
  v = { nouns: new Set(), words: new Set(), phrases: new Set() };
  for (const phrase of [thing.name, ...(thing.aliases ?? [])]) {
    const words = phrase.toLowerCase().split(/\s+/);
    v.phrases.add(words.join(' '));
    v.nouns.add(words[words.length - 1]!);
    for (const w of words) v.words.add(w);
  }
  for (const adj of thing.adjectives ?? []) v.words.add(adj.toLowerCase());
  cache.set(thing, v);
  return v;
}

/** Simple singularisation so "bones" finds "bone" without a stemmer. */
function variants(token: string): string[] {
  const out = [token];
  if (token.endsWith('ies')) out.push(token.slice(0, -3) + 'y');
  if (token.endsWith('es')) out.push(token.slice(0, -2));
  if (token.endsWith('s')) out.push(token.slice(0, -1));
  return out;
}

function matches(tokens: readonly string[], v: Vocabulary): boolean {
  let hasNoun = false;
  for (const token of tokens) {
    const forms = variants(token);
    const form = forms.find((f) => v.words.has(f));
    if (!form) return false;
    if (v.nouns.has(form)) hasNoun = true;
  }
  return hasNoun;
}

/** Words that stand for something already in mind: "fight it", "look at him". */
export const PRONOUNS = new Set([
  'it',
  'them',
  'him',
  'her',
  'he',
  'she',
  'they',
  'that',
  'this',
  'one',
]);

/** Words that colour a noun phrase without naming anything: "look at it more closely". */
const FILLER = new Set([
  'closer',
  'closely',
  'close',
  'carefully',
  'properly',
  'again',
  'more',
  'harder',
  'hard',
  'please',
  'really',
  'very',
  'now',
]);

/** A noun phrase without its filler words. */
export const withoutFiller = (tokens: readonly string[]): string[] =>
  tokens.filter((t) => !FILLER.has(t));

/**
 * Work out which in-scope thing a noun phrase refers to. Every word must be
 * part of the thing's name, aliases or adjectives, and at least one must be a
 * noun. Exact name matches win over partial ones. A pronoun means the last
 * thing referred to, or failing that the `fallback` (the obvious thing in the
 * room). Filler words are ignored, and when the whole phrase names nothing the
 * longest start of it that does is used instead: "skeleton who it is" is the skeleton.
 */
export function resolveNoun(
  tokens: readonly string[],
  scope: readonly ThingId[],
  things: Readonly<Record<ThingId, ThingDef>>,
  it: ThingId | null = null,
  fallback: ThingId | null = null,
): Resolution {
  const words = withoutFiller(tokens);
  const found = match(words, scope, things, it, fallback);
  if (found.kind !== 'none') return found;
  for (let n = words.length - 1; n > 0; n--) {
    // a start that names two things is asked about, the way the whole phrase would be
    const start = match(words.slice(0, n), scope, things, it, fallback);
    if (start.kind !== 'none') return start;
  }
  return found;
}

function match(
  tokens: readonly string[],
  scope: readonly ThingId[],
  things: Readonly<Record<ThingId, ThingDef>>,
  it: ThingId | null,
  fallback: ThingId | null,
): Resolution {
  if (tokens.length === 0) return { kind: 'none' };
  if (tokens.length === 1 && PRONOUNS.has(tokens[0]!)) {
    const meant = [it, fallback].find((id) => id && scope.includes(id));
    return meant ? { kind: 'one', id: meant } : { kind: 'none' };
  }
  const candidates = [...new Set(scope)].filter((id) => {
    const thing = things[id];
    return thing !== undefined && matches(tokens, vocabulary(thing));
  });
  if (candidates.length === 1) return { kind: 'one', id: candidates[0]! };
  if (candidates.length === 0) return { kind: 'none' };
  const phrase = tokens.join(' ');
  const exact = candidates.filter((id) => vocabulary(things[id]!).phrases.has(phrase));
  if (exact.length === 1) return { kind: 'one', id: exact[0]! };
  return { kind: 'ambiguous', ids: candidates };
}
