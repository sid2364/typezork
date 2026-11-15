/** Words that separate a direct object from an indirect one: "attack troll WITH spear". */
export const PREPOSITIONS = new Set([
  'with',
  'using',
  'at',
  'on',
  'onto',
  'in',
  'into',
  'to',
  'from',
]);

export interface VerbMatch {
  readonly commandId: string;
  /** Number of tokens the verb phrase used. */
  readonly length: number;
}

/**
 * Maps verb phrases ("pick up", "x", "look at") to command ids. Built from the
 * command registry plus any per-game synonyms.
 */
export class Lexicon {
  private phrases = new Map<string, string>();
  private longest = 1;

  add(commandId: string, phrase: string): void {
    const key = phrase.toLowerCase().trim().split(/\s+/).join(' ');
    this.phrases.set(key, commandId);
    this.longest = Math.max(this.longest, key.split(' ').length);
  }

  /** Longest verb phrase at the start of the tokens. */
  match(tokens: readonly string[]): VerbMatch | undefined {
    for (let n = Math.min(this.longest, tokens.length); n > 0; n--) {
      const commandId = this.phrases.get(tokens.slice(0, n).join(' '));
      if (commandId) return { commandId, length: n };
    }
    return undefined;
  }
}

export interface Phrase {
  readonly direct: string[];
  readonly prep?: string;
  readonly indirect: string[];
}

/** Split the words after the verb into "direct [prep indirect]". */
export function splitObjects(tokens: readonly string[]): Phrase {
  const i = tokens.findIndex((t, idx) => idx > 0 && PREPOSITIONS.has(t));
  if (i < 0) {
    // A leading preposition ("look at chest" without a phrase for it) is just dropped.
    const direct = tokens[0] && PREPOSITIONS.has(tokens[0]) ? tokens.slice(1) : [...tokens];
    return { direct, indirect: [] };
  }
  const direct = tokens.slice(0, i);
  if (direct[0] && PREPOSITIONS.has(direct[0])) direct.shift();
  return { direct, prep: tokens[i], indirect: tokens.slice(i + 1) };
}
