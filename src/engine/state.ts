import type { GameDef, Location } from './definitions';
import type { RoomId, ThingId } from './types';

/**
 * Everything that changes during play. Plain JSON: no classes, no functions,
 * no Sets, so it can be saved, restored and snapshotted for undo.
 */
export interface GameState {
  location: RoomId;
  things: Record<ThingId, Location>;
  flags: Record<string, boolean | number | string>;
  visited: RoomId[];
  opened: ThingId[];
  locked: ThingId[];
  killed: ThingId[];
  /** Things the player has moved from their starting place. */
  moved: ThingId[];
  /** Hidden exits that have been revealed, as "room:direction". */
  revealed: string[];
  /** Keys of one-off messages that have already been shown. */
  shownOnce: string[];
  /** The thing "it" refers to. */
  it: ThingId | null;
  turns: number;
  over: boolean;
  won: boolean;
}

export const SAVE_FORMAT = 'typezork-save';
export const SAVE_VERSION = 1;

export function initialState(def: GameDef): GameState {
  const things: Record<ThingId, Location> = {};
  const opened: ThingId[] = [];
  const locked: ThingId[] = [];
  for (const thing of Object.values(def.things)) {
    things[thing.id] = thing.location;
    if (thing.kind === 'item' && thing.openable) {
      if (thing.openable.startsOpen) opened.push(thing.id);
      else if (thing.openable.lockedBy) locked.push(thing.id);
    }
  }
  return {
    location: def.start,
    things,
    flags: {},
    visited: [def.start],
    opened,
    locked,
    killed: [],
    moved: [],
    revealed: [],
    shownOnce: [],
    it: null,
    turns: 0,
    over: false,
    won: false,
  };
}

export function serialize(def: GameDef, state: GameState): string {
  return JSON.stringify({ format: SAVE_FORMAT, version: SAVE_VERSION, game: def.id, state });
}

export class SaveError extends Error {}

export function deserialize(def: GameDef, text: string): GameState {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new SaveError('The save data is corrupt.');
  }
  if (!isRecord(data) || data.format !== SAVE_FORMAT) throw new SaveError('That is not a save.');
  if (data.version !== SAVE_VERSION) throw new SaveError('That save is from another version.');
  if (data.game !== def.id) throw new SaveError('That save belongs to another game.');
  const state = data.state;
  if (!isRecord(state) || typeof state.location !== 'string' || !(state.location in def.rooms)) {
    throw new SaveError('The save data is corrupt.');
  }
  // Fill in anything missing (e.g. things added to the game since the save was made).
  const fresh = initialState(def);
  const merged = { ...fresh, ...(state as Partial<GameState>) } as GameState;
  merged.things = { ...fresh.things, ...merged.things };
  return merged;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
