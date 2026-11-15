import type { CommandDef } from './types';

export const helpCommand: CommandDef = {
  id: 'help',
  verbs: ['help', 'h', '?', 'commands', 'hint'],
  meta: true,
  allowWhenOver: true,
  help: { usage: 'help', summary: 'Show this list.' },
  run({ w, game }) {
    w.say(
      'You control your character by typing commands in plain English. ' +
        'You can chain them: "open door and go east". Some useful commands:',
    );
    for (const c of game.commands) {
      if (c.help) w.say(`  ${c.help.usage.padEnd(28)} ${c.help.summary}`);
    }
  },
};

export const waitCommand: CommandDef = {
  id: 'wait',
  verbs: ['wait', 'z', 'stand', 'nothing', 'rest'],
  run({ w }) {
    w.say('Okay then...');
  },
};

const slotName = (args: readonly string[]): string => args.join('-') || 'default';

export const saveCommand: CommandDef = {
  id: 'save',
  verbs: ['save'],
  meta: true,
  help: { usage: 'save (or save name)', summary: 'Save your progress.' },
  run({ game, cmd }) {
    game.save(slotName(cmd.args));
  },
};

export const loadCommand: CommandDef = {
  id: 'load',
  verbs: ['load', 'restore'],
  meta: true,
  allowWhenOver: true,
  help: { usage: 'load (or load name)', summary: 'Load a saved game.' },
  run({ game, cmd }) {
    game.load(slotName(cmd.args));
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
