const ARTICLES = new Set(['a', 'an', 'the', 'some', 'my']);

/**
 * Split a line of input into separate commands:
 * "open door and go east, then look" → ["open door", "go east", "look"].
 */
export function splitCommands(input: string): string[] {
  return input
    .split(/[.;,!?]|\b(?:then|and)\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Lowercase, strip punctuation and articles, split on whitespace. */
export function tokenize(command: string): string[] {
  return command
    .toLowerCase()
    .replace(/[^a-z0-9'\- ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !ARTICLES.has(t));
}
