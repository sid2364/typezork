import type { CommandDef } from './types';

/** Built-in commands shown together on one line of HELP. */
const HELP_GROUPS: readonly (readonly string[])[] = [
  ['look', 'examine'],
  ['go'],
  ['take', 'drop'],
  ['open', 'unlock'],
  ['attack'],
  ['inventory', 'undo'],
  ['save', 'load', 'restart'],
];

export const helpCommand: CommandDef = {
  id: 'help',
  verbs: ['help', 'commands', 'hint'],
  meta: true,
  allowWhenOver: true,
  help: { usage: 'help', summary: 'Show this list.' },
  run({ w, game }) {
    w.say('Type what you want to do in plain English, e.g. "open door and go east". Try:');
    const usage = new Map(game.commands.filter((c) => c.help).map((c) => [c.id, c.help!.usage]));
    const shown = new Set<string>(['help']);
    const lines: string[] = [];
    for (const group of HELP_GROUPS) {
      const parts = group.filter((id) => usage.has(id));
      parts.forEach((id) => shown.add(id));
      if (parts.length) lines.push(parts.map((id) => usage.get(id)).join(' · '));
    }
    const extra = [...usage].filter(([id]) => !shown.has(id)).map(([, u]) => u);
    if (extra.length) lines.push(extra.join(' · '));
    for (const l of lines) w.say(`  ${l}`);
  },
};

export const waitCommand: CommandDef = {
  id: 'wait',
  verbs: ['wait', 'stand', 'nothing', 'rest'],
  run({ w }) {
    w.say('Okay then...');
  },
};

const slotName = (args: readonly string[]): string => args.join('-') || 'default';

export const saveCommand: CommandDef = {
  id: 'save',
  verbs: ['save'],
  meta: true,
  help: { usage: 'save', summary: 'Save your progress.' },
  run({ game, cmd }) {
    game.save(slotName(cmd.args));
  },
};

export const loadCommand: CommandDef = {
  id: 'load',
  verbs: ['load', 'restore'],
  meta: true,
  allowWhenOver: true,
  help: { usage: 'load', summary: 'Load a saved game.' },
  run({ w, game, cmd, ask }) {
    const slot = slotName(cmd.args);
    if (!game.unsaved) {
      game.load(slot);
      return;
    }
    ask(
      'Load the saved game? The moves you made since you last saved will be set aside. (y/n)',
      (tokens) => {
        if (tokens[0] === 'y' || tokens[0] === 'yes') game.load(slot);
        else w.say('Carry on, then.');
      },
      { yesNo: true },
    );
  },
};

export const restartCommand: CommandDef = {
  id: 'restart',
  verbs: ['restart', 'new game'],
  meta: true,
  allowWhenOver: true,
  help: { usage: 'restart', summary: 'Start over.' },
  run({ w, game, ask }) {
    if (w.state.over) {
      game.restart();
      return;
    }
    ask(
      'Do you really want to start over? (y/n)',
      (tokens) => {
        if (tokens[0] === 'y' || tokens[0] === 'yes') game.restart();
        else w.say('Carry on, then.');
      },
      { yesNo: true },
    );
  },
};

export const undoCommand: CommandDef = {
  id: 'undo',
  verbs: ['undo', 'oops'],
  meta: true,
  allowWhenOver: true,
  help: { usage: 'undo', summary: 'Take back your last move.' },
  run({ game }) {
    game.undo();
  },
};
