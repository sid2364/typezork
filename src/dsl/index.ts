/**
 * Builder functions for writing games in TypeScript. A game is a list of rooms
 * and things passed to defineGame(), which checks them and returns a frozen
 * GameDef that the engine can run.
 */
import type { CommandDef } from '../engine/commands/types';
import type {
  Banter,
  Condition,
  CreatureDef,
  ExitDef,
  GameDef,
  ItemDef,
  RankInfo,
  RoomDef,
  Text,
  ThingDef,
} from '../engine/definitions';
import { DIRECTIONS, opposite, parseDirection, type Direction } from '../engine/direction';
import type { EventBus } from '../engine/events';
import type { RoomId, ThingId } from '../engine/types';
import type { World } from '../engine/world';

export * from '../engine/conditions';
export * from '../engine/effects';

/** Exit spec: a room id for a plain exit, or a full ExitDef. Keys may be "n", "north", "north-east"… */
export type ExitSpec = RoomId | ExitDef;

export type RoomSpec = Omit<RoomDef, 'id' | 'exits'> & {
  readonly exits?: Readonly<Record<string, ExitSpec>>;
};

export function room(id: RoomId, spec: RoomSpec): RoomDef {
  const exits: Partial<Record<Direction, ExitDef>> = {};
  for (const [word, exit] of Object.entries(spec.exits ?? {})) {
    const dir = parseDirection(word.split(/\s+/));
    if (!dir) throw new Error(`Room "${id}": "${word}" is not a direction`);
    exits[dir] = typeof exit === 'string' ? { to: exit } : exit;
  }
  return { ...spec, id, exits };
}

export function item(id: ThingId, spec: Omit<ItemDef, 'id' | 'kind'>): ItemDef {
  return { ...spec, id, kind: 'item' };
}

export function creature(
  id: ThingId,
  spec: Omit<CreatureDef, 'id' | 'kind' | 'weakTo'> & { readonly weakTo?: readonly ThingId[] },
): CreatureDef {
  return { weakTo: [], ...spec, id, kind: 'creature' };
}

/** An exit through a door (an openable item). Locks are set on the door item. */
export const door = (doorId: ThingId, to: RoomId): ExitDef => ({ to, door: doorId });

/** An exit that can only be used while `when` holds. */
export const guarded = (to: RoomId, when: Condition, blocked: Text, onPass?: Text): ExitDef => ({
  to,
  guard: onPass === undefined ? { when, blocked } : { when, blocked, onPass },
});

/** An exit that doesn't exist until revealed with revealExit(). */
export const hidden = (to: RoomId): ExitDef => ({ to, hidden: true });

export interface Connection {
  readonly from: RoomId;
  readonly dir: Direction;
  readonly to: RoomId;
}

/** A plain two-way passage: from --dir--> to, and to --opposite(dir)--> from. */
export const twoWay = (from: RoomId, dir: Direction, to: RoomId): Connection => ({ from, dir, to });

export interface GameSpec {
  readonly id: string;
  readonly title: string;
  /** Bump when a content change makes old saves unsafe (default 1). */
  readonly version?: number;
  readonly intro?: readonly string[];
  readonly start: RoomId;
  readonly rooms: readonly RoomDef[];
  readonly things?: readonly ThingDef[];
  /** Two-way passages added to the rooms' exits (explicit exits win). */
  readonly connections?: readonly Connection[];
  readonly commands?: readonly CommandDef[];
  readonly synonyms?: Readonly<Record<string, readonly string[]>>;
  readonly hooks?: (bus: EventBus) => void;
  readonly rank?: (score: number, w: World) => RankInfo;
  /** What the player's choices have cost them so far, for the status panel. */
  readonly losses?: (w: World) => readonly string[];
  /** Small talk with the characters, answered before any command is tried. */
  readonly banter?: Banter;
}

export class GameDefinitionError extends Error {}

/** Check a game for broken references and return it frozen. */
export function defineGame(spec: GameSpec): GameDef {
  const errors: string[] = [];
  const rooms: Record<RoomId, RoomDef> = {};
  for (const r of spec.rooms) {
    if (rooms[r.id]) errors.push(`Duplicate room "${r.id}"`);
    rooms[r.id] = { ...r, exits: { ...r.exits } };
  }
  const things: Record<ThingId, ThingDef> = {};
  for (const t of spec.things ?? []) {
    if (things[t.id]) errors.push(`Duplicate thing "${t.id}"`);
    things[t.id] = t;
  }

  for (const c of spec.connections ?? []) {
    for (const [from, dir, to] of [
      [c.from, c.dir, c.to],
      [c.to, opposite(c.dir), c.from],
    ] as const) {
      const r = rooms[from];
      if (!r) errors.push(`Connection from unknown room "${from}"`);
      else if (!r.exits[dir]) (r.exits as Partial<Record<Direction, ExitDef>>)[dir] = { to };
    }
  }

  if (!rooms[spec.start]) errors.push(`Start room "${spec.start}" does not exist`);
  for (const r of Object.values(rooms)) {
    for (const dir of DIRECTIONS) {
      const exit = r.exits[dir];
      if (!exit) continue;
      const where = `Room "${r.id}" exit ${dir}`;
      if (!rooms[exit.to]) errors.push(`${where} leads to unknown room "${exit.to}"`);
      if (exit.door) {
        const d = things[exit.door];
        if (!d) errors.push(`${where} uses unknown door "${exit.door}"`);
        else if (d.kind !== 'item' || !d.openable)
          errors.push(`${where}: "${exit.door}" can't be opened`);
      }
    }
  }
  for (const t of Object.values(things)) {
    if (t.location !== 'inventory' && t.location !== 'nowhere' && !rooms[t.location]) {
      errors.push(`Thing "${t.id}" starts in unknown room "${t.location}"`);
    }
    if (t.kind === 'item' && t.openable?.lockedBy && !things[t.openable.lockedBy]) {
      errors.push(`Thing "${t.id}" is locked by unknown thing "${t.openable.lockedBy}"`);
    }
    if (t.kind === 'creature') {
      for (const weapon of t.weakTo) {
        if (!things[weapon]) errors.push(`Creature "${t.id}" is weak to unknown thing "${weapon}"`);
      }
    }
  }
  if (errors.length)
    throw new GameDefinitionError(`Invalid game "${spec.id}":\n  ${errors.join('\n  ')}`);

  return deepFreeze({
    id: spec.id,
    title: spec.title,
    version: spec.version ?? 1,
    intro: spec.intro ?? [],
    start: spec.start,
    rooms,
    things,
    commands: spec.commands ?? [],
    synonyms: spec.synonyms ?? {},
    ...(spec.hooks ? { hooks: spec.hooks } : {}),
    ...(spec.rank ? { rank: spec.rank } : {}),
    ...(spec.losses ? { losses: spec.losses } : {}),
    ...(spec.banter ? { banter: spec.banter } : {}),
  });
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}
