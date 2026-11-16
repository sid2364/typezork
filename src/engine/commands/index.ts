import {
  helpCommand,
  loadCommand,
  restartCommand,
  saveCommand,
  undoCommand,
  waitCommand,
} from './meta';
import { goCommand } from './movement';
import {
  attackCommand,
  closeCommand,
  dropCommand,
  examineCommand,
  inventoryCommand,
  lookCommand,
  openCommand,
  takeCommand,
  unlockCommand,
} from './things';
import type { CommandDef } from './types';

/** Built-in commands, in the order they appear in HELP. */
export const BUILTIN_COMMANDS: readonly CommandDef[] = [
  goCommand,
  lookCommand,
  examineCommand,
  takeCommand,
  dropCommand,
  openCommand,
  closeCommand,
  unlockCommand,
  attackCommand,
  inventoryCommand,
  waitCommand,
  saveCommand,
  loadCommand,
  undoCommand,
  restartCommand,
  helpCommand,
];

export type { CommandContext, CommandDef, GameControl, ParsedCommand } from './types';
export { go, enter } from './movement';
export { describeThing, openThing } from './things';
