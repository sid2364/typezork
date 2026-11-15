export const DIRECTIONS = [
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
  'up',
  'down',
] as const;

export type Direction = (typeof DIRECTIONS)[number];

const OPPOSITES: Record<Direction, Direction> = {
  north: 'south',
  northeast: 'southwest',
  east: 'west',
  southeast: 'northwest',
  south: 'north',
  southwest: 'northeast',
  west: 'east',
  northwest: 'southeast',
  up: 'down',
  down: 'up',
};

/** Screen-space vectors (y grows downwards) used to lay out the minimap. */
const VECTORS: Record<Direction, readonly [number, number]> = {
  north: [0, -1],
  northeast: [1, -1],
  east: [1, 0],
  southeast: [1, 1],
  south: [0, 1],
  southwest: [-1, 1],
  west: [-1, 0],
  northwest: [-1, -1],
  // Up and down have no natural place on a flat map; draw them diagonally.
  up: [1, -1],
  down: [-1, 1],
};

const SHORT: Record<Direction, string> = {
  north: 'n',
  northeast: 'ne',
  east: 'e',
  southeast: 'se',
  south: 's',
  southwest: 'sw',
  west: 'w',
  northwest: 'nw',
  up: 'u',
  down: 'd',
};

const WORDS = new Map<string, Direction>();
for (const dir of DIRECTIONS) {
  WORDS.set(dir, dir);
  WORDS.set(SHORT[dir], dir);
}
for (const [alias, dir] of [
  ['north-east', 'northeast'],
  ['north-west', 'northwest'],
  ['south-east', 'southeast'],
  ['south-west', 'southwest'],
  ['upstairs', 'up'],
  ['downstairs', 'down'],
] as const) {
  WORDS.set(alias, dir);
}

export const opposite = (dir: Direction): Direction => OPPOSITES[dir];
export const vector = (dir: Direction): readonly [number, number] => VECTORS[dir];
export const shortName = (dir: Direction): string => SHORT[dir];
export const isDirection = (word: string): word is Direction =>
  (DIRECTIONS as readonly string[]).includes(word);

/**
 * Parse one or two tokens into a direction: "n", "north", "north-east", or
 * "north east" all work.
 */
export function parseDirection(tokens: readonly string[]): Direction | undefined {
  if (tokens.length === 1) return WORDS.get(tokens[0]!);
  if (tokens.length === 2) return WORDS.get(tokens.join(''));
  return undefined;
}
