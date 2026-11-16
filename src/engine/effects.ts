import type { Condition, Effect, Location, Text } from './definitions';
import type { Direction } from './direction';
import type { OutputStyle, RoomId, ThingId } from './types';

export const say =
  (text: Text, style: OutputStyle = 'info'): Effect =>
  (w) =>
    w.say(text, style);

export const setFlag =
  (name: string, value: boolean | number | string = true): Effect =>
  (w) =>
    w.setFlag(name, value);

/** Reveal a hidden exit. Defaults to the current room. */
export const revealExit =
  (dir: Direction, room?: RoomId): Effect =>
  (w) =>
    w.reveal(room ?? w.here, dir);

/** Put a thing into the current room (or another location). */
export const spawnItem =
  (id: ThingId, where?: Location): Effect =>
  (w) =>
    w.move(id, where ?? w.here);

export const moveItem =
  (id: ThingId, where: Location): Effect =>
  (w) =>
    w.move(id, where);

export const removeItem =
  (id: ThingId): Effect =>
  (w) =>
    w.move(id, 'nowhere');

/** End the game in victory. */
export const win =
  (text?: Text): Effect =>
  (w) => {
    if (text) w.say(text, 'win');
    w.win();
  };

// end the game in defeat
export const lose =
  (text?: Text): Effect =>
  (w) =>
    w.lose(text);

// give or take away points, once per key
export const award =
  (key: string, points: number): Effect =>
  (w) => {
    w.award(key, points);
  };

/** Run effects only when a condition holds. */
export const when =
  (c: Condition, ...effects: Effect[]): Effect =>
  (w) => {
    if (c(w)) for (const e of effects) e(w);
  };

/** Run effects at most once per game. */
export const once =
  (key: string, ...effects: Effect[]): Effect =>
  (w) => {
    if (w.once(key)) for (const e of effects) e(w);
  };
