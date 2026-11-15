import { parseDirection, type Direction } from '../direction';
import type { World } from '../world';
import { openThing } from './things';
import type { CommandDef } from './types';

/** Try to move the player. All checks (doors, guards, hooks) happen here. */
export function go(w: World, dir: Direction): void {
  const from = w.here;
  const exit = w.room().exits[dir];
  if (!exit || (exit.hidden && !w.isRevealed(from, dir))) {
    w.say(`You can't go ${dir}.`, 'error');
    return;
  }

  // Closed doors are opened on the way through (unlocked first if the player has the key).
  if (exit.door && !w.isOpen(exit.door) && !openThing(w, exit.door)) return;

  if (exit.guard && !exit.guard.when(w)) {
    w.say(exit.guard.blocked, 'error');
    return;
  }

  const veto =
    w.bus.emit('beforeMove', { from, to: exit.to, dir }, w) ?? w.room(exit.to).beforeEnter?.(w);
  if (veto) {
    w.say(veto, 'error');
    return;
  }

  if (exit.guard?.onPass && w.once(`pass:${from}:${dir}`)) w.say(exit.guard.onPass);

  enter(w, exit.to, from);
}

/** Put the player in a room, describe it and run its hooks. */
export function enter(w: World, room: string, from: string | null): void {
  const firstVisit = !w.state.visited.includes(room);
  w.state.location = room;
  if (firstVisit) w.state.visited.push(room);
  w.describeRoom();
  w.bus.emit('afterEnter', { room, from, firstVisit }, w);
  for (const effect of w.room(room).onEnter ?? []) effect(w);
}

export const goCommand: CommandDef = {
  id: 'go',
  verbs: ['go', 'walk', 'move', 'travel', 'run', 'head', 'climb'],
  help: { usage: 'go north (or just n)', summary: 'Move in a direction.' },
  run({ w, cmd }) {
    const words = cmd.direct.length ? cmd.direct : cmd.args;
    const dir = parseDirection(words);
    if (!dir) {
      w.say(words.length ? `I don't know how to go "${words.join(' ')}".` : 'Go where?', 'error');
      return;
    }
    go(w, dir);
  },
};
