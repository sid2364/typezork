import type { ExitDef, GameDef, Location, RoomDef, Text, ThingDef } from './definitions';
import { DIRECTIONS, type Direction } from './direction';
import type { EventBus } from './events';
import type { GameState } from './state';
import { line, type OutputLine, type OutputStyle, type RoomId, type ThingId } from './types';

/**
 * The view that conditions, effects and commands work through: immutable
 * definitions plus the mutable state, with an output buffer for messages.
 */
// ask the player something, their next input goes to answer
export type Asker = (
  question: string,
  answer: (tokens: string[]) => void,
  opts?: {
    // a yes or no question, the answer takes no turn
    yesNo?: boolean;
    // answers to offer as clickable hints
    choices?: readonly string[];
    // the player cannot walk away, only meta commands like look and undo work until they answer
    strict?: boolean;
  },
) => void;

export class World {
  readonly out: OutputLine[] = [];
  // hints wait here until the output is handed over, so they always come last
  readonly hints: string[] = [];
  // how many times the player has lost over every game played
  // it lives outside the state so undo and restart do not forget it
  deaths = 0;
  // called with the new total every time the player loses
  onDeath: ((total: number) => void) | undefined;
  // set by the game, lets effects and hooks ask questions and not just commands
  ask: Asker = () => {};

  constructor(
    readonly def: GameDef,
    public state: GameState,
    readonly bus: EventBus,
  ) {}

  // ---- output ----------------------------------------------------------------

  text(t: Text): string {
    return typeof t === 'function' ? t(this) : t;
  }

  say(t: Text, style: OutputStyle = 'info'): void {
    const text = this.text(t);
    if (text) this.out.push(line(text, style));
  }

  // a hint for the player, held back and shown after the rest of the output
  hint(t: Text): void {
    const text = this.text(t);
    if (text && !this.hints.includes(text)) this.hints.push(text);
  }

  /** Returns true the first time it is called with a given key. */
  once(key: string): boolean {
    if (this.state.shownOnce.includes(key)) return false;
    this.state.shownOnce.push(key);
    return true;
  }

  // ---- lookups ---------------------------------------------------------------

  get here(): RoomId {
    return this.state.location;
  }

  room(id: RoomId = this.here): RoomDef {
    const room = this.def.rooms[id];
    if (!room) throw new Error(`Unknown room "${id}"`);
    return room;
  }

  thing(id: ThingId): ThingDef {
    const thing = this.def.things[id];
    if (!thing) throw new Error(`Unknown thing "${id}"`);
    return thing;
  }

  /** "the dragon", or just "Bob" for proper names. */
  the(id: ThingId): string {
    const thing = this.thing(id);
    return thing.properName ? thing.name : `the ${thing.name}`;
  }

  locationOf(id: ThingId): Location {
    return this.state.things[id] ?? 'nowhere';
  }

  has(id: ThingId): boolean {
    return this.locationOf(id) === 'inventory';
  }

  isOpen(id: ThingId): boolean {
    return this.state.opened.includes(id);
  }

  isLocked(id: ThingId): boolean {
    return this.state.locked.includes(id);
  }

  isDead(id: ThingId): boolean {
    return this.state.killed.includes(id);
  }

  hasMoved(id: ThingId): boolean {
    return this.state.moved.includes(id);
  }

  flag(name: string): boolean | number | string | undefined {
    return this.state.flags[name];
  }

  /** Visible things at a location, in definition order. */
  thingsAt(loc: Location): ThingId[] {
    return Object.keys(this.def.things).filter(
      (id) => this.state.things[id] === loc && !this.isShut(id),
    );
  }

  /** True while a thing is still in its container and the container is closed. */
  isShut(id: ThingId): boolean {
    const container = this.thing(id).inside;
    return !!container && !this.hasMoved(id) && !this.isOpen(container);
  }

  inventory(): ThingId[] {
    return this.thingsAt('inventory');
  }

  /** Creatures in the room, the living ones only unless asked otherwise. */
  creaturesHere(includeDead = false): ThingId[] {
    return this.thingsAt(this.here).filter(
      (id) => this.thing(id).kind === 'creature' && (includeDead || !this.isDead(id)),
    );
  }

  /** The thing a stray "it" or "him" most likely means: the one creature in the room. */
  obvious(): ThingId | null {
    const creatures = this.creaturesHere();
    return creatures.length === 1 ? creatures[0]! : null;
  }

  /**
   * Everything the player can refer to: what's in the room, the doors out of it (a door
   * belongs to the room on one side but is seen from both), and what they carry.
   */
  inScope(): ThingId[] {
    const here = this.thingsAt(this.here);
    const doors = this.exits()
      .map(([, exit]) => exit.door)
      .filter((id): id is ThingId => id !== undefined && !here.includes(id));
    return [...here, ...new Set(doors), ...this.inventory()];
  }

  isRevealed(room: RoomId, dir: Direction): boolean {
    return this.state.revealed.includes(`${room}:${dir}`);
  }

  /** Exits of a room that the player knows about (hidden ones only once revealed). */
  exits(room: RoomId = this.here): [Direction, ExitDef][] {
    const exits = this.room(room).exits;
    const result: [Direction, ExitDef][] = [];
    for (const dir of DIRECTIONS) {
      const exit = exits[dir];
      if (exit && (!exit.hidden || this.isRevealed(room, dir))) result.push([dir, exit]);
    }
    return result;
  }

  // ---- mutations -------------------------------------------------------------

  move(id: ThingId, to: Location): void {
    this.thing(id);
    this.state.things[id] = to;
  }

  markMoved(id: ThingId): void {
    if (!this.state.moved.includes(id)) this.state.moved.push(id);
  }

  setFlag(name: string, value: boolean | number | string = true): void {
    this.state.flags[name] = value;
  }

  setOpen(id: ThingId, open: boolean): void {
    this.state.opened = this.state.opened.filter((x) => x !== id);
    if (open) this.state.opened.push(id);
  }

  unlock(id: ThingId): void {
    this.state.locked = this.state.locked.filter((x) => x !== id);
  }

  kill(id: ThingId): void {
    if (!this.state.killed.includes(id)) this.state.killed.push(id);
  }

  reveal(room: RoomId, dir: Direction): void {
    const key = `${room}:${dir}`;
    if (!this.state.revealed.includes(key)) this.state.revealed.push(key);
  }

  win(): void {
    this.state.over = true;
    this.state.won = true;
  }

  // end the game in defeat
  lose(text?: Text): void {
    if (this.state.over) return;
    if (text) this.say(text, 'lose');
    this.say(
      'GAME OVER. Type UNDO to take back your last move, or RESTART to begin again.',
      'lose',
    );
    this.state.over = true;
    this.state.won = false;
    this.deaths++;
    this.onDeath?.(this.deaths);
  }

  // bring a dead creature back
  revive(id: ThingId): void {
    this.state.killed = this.state.killed.filter((x) => x !== id);
  }

  addScore(points: number): void {
    this.state.score += points;
  }

  // add points once per key, returns true if they were given this time
  award(key: string, points: number): boolean {
    if (!this.once(`score:${key}`)) return false;
    this.state.score += points;
    return true;
  }

  // ---- description -----------------------------------------------------------

  /** Text for a thing as it appears in a room description, if any. */
  listing(id: ThingId): string | undefined {
    const thing = this.thing(id);
    if (thing.kind === 'creature' && this.isDead(id)) {
      return thing.deadDescription
        ? this.text(thing.deadDescription)
        : `The dead ${thing.name} lies here.`;
    }
    if (this.hasMoved(id)) return `There is a ${thing.name} here.`;
    return thing.description ? this.text(thing.description) : undefined;
  }

  describeRoom(): void {
    const room = this.room();
    this.say(room.name, 'title');
    this.say(room.description, 'room');
    for (const id of this.thingsAt(this.here)) {
      const text = this.listing(id);
      if (text) this.say(text, 'room');
    }
  }
}
