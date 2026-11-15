import type { Condition } from './definitions';
import type { RoomId, ThingId } from './types';

export const has =
  (id: ThingId): Condition =>
  (w) =>
    w.has(id);

/** True if the flag is set to anything truthy, or equals `value` if given. */
export const flag =
  (name: string, value?: boolean | number | string): Condition =>
  (w) =>
    value === undefined ? Boolean(w.flag(name)) : w.flag(name) === value;

export const isOpen =
  (id: ThingId): Condition =>
  (w) =>
    w.isOpen(id);

export const isDead =
  (id: ThingId): Condition =>
  (w) =>
    w.isDead(id);

export const inRoom =
  (room: RoomId): Condition =>
  (w) =>
    w.here === room;

export const visited =
  (room: RoomId): Condition =>
  (w) =>
    w.state.visited.includes(room);

export const not =
  (c: Condition): Condition =>
  (w) =>
    !c(w);

export const all =
  (...cs: Condition[]): Condition =>
  (w) =>
    cs.every((c) => c(w));

export const any =
  (...cs: Condition[]): Condition =>
  (w) =>
    cs.some((c) => c(w));
