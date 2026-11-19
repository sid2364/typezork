/**
 * Immutable game definitions. These are produced by the DSL (see src/dsl) and
 * never change during play: everything that changes lives in GameState.
 */
import type { CommandDef } from './commands/types';
import type { Direction } from './direction';
import type { EventBus } from './events';
import type { RoomId, ThingId } from './types';
import type { World } from './world';

/** Static text, or text computed from the current world (e.g. state-dependent descriptions). */
export type Text = string | ((w: World) => string);

/** A read-only test against the world. */
export type Condition = (w: World) => boolean;

/** Something that changes the world and/or prints output. */
export type Effect = (w: World) => void;

/** Where a thing can be: in a room, carried, or not (yet) in the game. */
export type Location = RoomId | 'inventory' | 'nowhere';

export interface Guard {
  /** The exit can be used only while this holds. */
  readonly when: Condition;
  /** Printed when the guard blocks the player. */
  readonly blocked: Text;
  /** Printed the first time the player gets past the guard. */
  readonly onPass?: Text;
}

export interface ExitDef {
  readonly to: RoomId;
  /** A door (an openable thing) that must be open to pass. Closed, unlocked doors are opened automatically. */
  readonly door?: ThingId;
  /** Hidden exits can't be seen or used until revealed with the revealExit() effect. */
  readonly hidden?: boolean;
  readonly guard?: Guard;
}

export interface RoomDef {
  readonly id: RoomId;
  readonly name: string;
  readonly description: Text;
  readonly exits: Readonly<Partial<Record<Direction, ExitDef>>>;
  /** Fixed minimap position. Rooms without one are placed relative to their neighbours. */
  readonly pos?: readonly [number, number];
  /** Return a message to stop the player entering. */
  readonly beforeEnter?: (w: World) => string | undefined;
  /** Runs after the player enters and the room has been described. */
  readonly onEnter?: readonly Effect[];
}

export interface Openable {
  /** Thing needed to unlock. The thing starts locked if this is set. */
  readonly lockedBy?: ThingId;
  readonly startsOpen?: boolean;
  readonly openMessage?: Text;
  readonly closeMessage?: Text;
  readonly alreadyOpen?: Text;
  readonly lockedMessage?: Text;
  readonly unlockMessage?: Text;
  /** Return a message to stop the thing being opened, e.g. while someone holds it shut. */
  readonly beforeOpen?: (w: World) => string | undefined;
  /** Runs the first time the thing is opened. */
  readonly onOpen?: readonly Effect[];
}

interface ThingCommon {
  readonly id: ThingId;
  readonly name: string;
  /** Extra nouns the player can use, e.g. ['bones', 'pile']. */
  readonly aliases?: readonly string[];
  /** Words that may qualify the noun, e.g. ['steel'] for "steel gate". */
  readonly adjectives?: readonly string[];
  /** Where the thing starts. */
  readonly location: Location;
  /**
   * Shown in the room description while the thing is where it started.
   * Once the player has moved it, a generic "There is a … here." is used instead.
   */
  readonly description?: Text;
  /**
   * An openable thing this starts inside. Until the player moves it, it can't be
   * seen or reached while that container is closed.
   */
  readonly inside?: ThingId;
  /** Shown by EXAMINE. Falls back to description. */
  readonly examine?: Text;
  /** Shown when the player tries to take something that can't be taken. */
  readonly refuseTake?: Text;
  /** Proper nouns don't get "the" in generated messages. */
  readonly properName?: boolean;
}

export interface ItemDef extends ThingCommon {
  readonly kind: 'item';
  readonly portable: boolean;
  /** Shown the first time the item is taken. */
  readonly takeMessage?: Text;
  readonly openable?: Openable;
}

export interface CreatureDef extends ThingCommon {
  readonly kind: 'creature';
  readonly killable: boolean;
  /** Weapons that work. An empty list means any carried item will do. */
  readonly weakTo: readonly ThingId[];
  readonly deadDescription?: Text;
  readonly alreadyDead?: Text;
  /** Shown when attacking a creature that can't be killed. */
  readonly immune?: Text;
  /** Shown when the weapon isn't one the creature is weak to. Functions also get the weapon. */
  readonly notWorthy?: string | ((w: World, weapon: ThingId) => string);
  /** Shown when the player attacks with bare hands (punch, kick, "with my fists", …). */
  readonly bareHanded?: Text;
  // return a message to stop an attack before it starts, for a friend or a second chance.
  // an empty string stops it too, for a hook that has already said what happens instead
  readonly beforeAttack?: (w: World) => string | undefined;
  /** A fight with bare hands (fight x, punch x, kill x with fists). Replaces the usual unarmed response. */
  readonly brawl?: Effect;
  readonly onKill?: readonly Effect[];
}

export type ThingDef = ItemDef | CreatureDef;

/** Where a score stands on a game's ladder of ranks: level 1 is the lowest. */
export interface RankInfo {
  readonly name: string;
  readonly level: number;
  readonly of: number;
}

export interface GameDef {
  readonly id: string;
  readonly title: string;
  readonly intro: readonly string[];
  readonly start: RoomId;
  readonly rooms: Readonly<Record<RoomId, RoomDef>>;
  readonly things: Readonly<Record<ThingId, ThingDef>>;
  /** Game-specific commands, added to (or overriding) the built-ins. */
  readonly commands: readonly CommandDef[];
  /** Extra verb synonyms: { take: ['pocket'] }. Keys are command ids. */
  readonly synonyms: Readonly<Record<string, readonly string[]>>;
  /** Subscribe to engine events (quests, scoring, …). */
  readonly hooks?: (bus: EventBus) => void;
  /** The rank a score earns, for front-ends to show. */
  readonly rank?: (score: number) => RankInfo;
}
