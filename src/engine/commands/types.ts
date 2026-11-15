import type { ThingId } from '../types';
import type { World } from '../world';

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

/** Engine operations that commands can ask for (and that tests or front-ends can rely on). */
export interface GameControl {
  save(slot: string): void;
  load(slot: string): void;
  restart(): void;
  undo(): void;
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
  /** Ask the player a question. Their next input goes to `answer`. */
  ask(question: string, answer: (tokens: string[]) => void, opts?: { yesNo?: boolean }): void;
}

export interface CommandDef {
  readonly id: string;
  /** Verb phrases that trigger the command. The first is the canonical one. */
  readonly verbs: readonly string[];
  /** Meta commands don't take a turn and aren't recorded for undo. */
  readonly meta?: boolean;
  /** Allowed after the game has ended. */
  readonly allowWhenOver?: boolean;
  readonly help?: { readonly usage: string; readonly summary: string };
  run(ctx: CommandContext): void;
}
