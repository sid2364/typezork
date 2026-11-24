import type { ThingId } from '../types';
import type { Asker, World } from '../world';

export interface ParsedCommand {
  readonly raw: string;
  readonly commandId: string;
  /** The verb phrase the player used ("pick up"). */
  readonly verb: string;
  /** All words after the verb. */
  readonly args: readonly string[];
  readonly direct: readonly string[];
  readonly prep?: string;
  readonly indirect: readonly string[];
}

export interface ResolveOptions {
  /** Restrict to these things. Defaults to everything in scope. */
  readonly scope?: readonly ThingId[];
  /** Message when nothing matches. */
  readonly notFound?: string;
}

export interface ObjectOptions extends ResolveOptions {
  /**
   * What the command could sensibly mean when the player names nothing. One candidate,
   * or the last thing referred to among them, is taken as meant; several are asked about.
   * Defaults to everything in scope.
   */
  readonly candidates?: readonly ThingId[];
  /** The follow-up question. Defaults to "What do you want to <verb>?". */
  readonly ask?: string;
  /** Said when nothing here could be meant. */
  readonly none?: string;
}

/** Engine operations that commands can ask for (and that tests or front-ends can rely on). */
export interface GameControl {
  save(slot: string): void;
  load(slot: string): void;
  restart(): void;
  undo(): void;
  /** True when turns have been taken since the last save or load. */
  readonly unsaved: boolean;
  readonly commands: readonly CommandDef[];
}

export interface CommandContext {
  readonly w: World;
  readonly cmd: ParsedCommand;
  readonly game: GameControl;
  /**
   * Resolve a noun phrase to a thing. On failure prints a message (or asks a
   * "which do you mean" question) and returns undefined.
   */
  resolve(tokens: readonly string[], opts?: ResolveOptions): ThingId | undefined;
  /**
   * The object of the command, forgiving how it is put. Named words are resolved as
   * with resolve(). With none, the obvious thing is taken and shown, "(the skeleton)",
   * or a follow-up question is asked whose answer completes the command.
   */
  object(words: readonly string[], opts?: ObjectOptions): ThingId | undefined;
  /** Ask the player a question. Their next input goes to `answer`. */
  ask: Asker;
}

export interface CommandDef {
  readonly id: string;
  /** Verb phrases that trigger the command. The first is the canonical one. */
  readonly verbs: readonly string[];
  /** Meta commands don't take a turn and aren't recorded for undo. */
  readonly meta?: boolean;
  /** Allowed after the game has ended. */
  readonly allowWhenOver?: boolean;
  /** Jokes and easter eggs: they work when typed but are never offered as a completion. */
  readonly secret?: boolean;
  readonly help?: { readonly usage: string; readonly summary: string };
  run(ctx: CommandContext): void;
}
