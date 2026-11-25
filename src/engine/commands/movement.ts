import { parseDirection, type Direction } from '../direction';
import { resolveNoun } from '../parser/resolve';
import type { World } from '../world';
import { openThing } from './things';
import type { CommandDef } from './types';

// the way "up" or "down" means here: the real exit, or failing that a staircase that climbs that way
function stairway(w: World, dir: Direction): Direction {
  if (w.room().exits[dir] || (dir !== 'up' && dir !== 'down')) return dir;
  return w.exits().find(([, exit]) => exit.stairs === dir)?.[0] ?? dir;
}

/** Try to move the player. All checks (doors, guards, hooks) happen here. */
export function go(w: World, asked: Direction): void {
  const from = w.here;
  const dir = stairway(w, asked);
  const exit = w.room().exits[dir];
  if (!exit || (exit.hidden && !w.isRevealed(from, dir))) {
    w.say(`You can't go ${asked}.`, 'error');
    return;
  }

  // Closed doors are opened on the way through (unlocked first if the player has the key).
  if (exit.door && !w.isOpen(exit.door) && !openThing(w, exit.door)) return;

  if (exit.guard && !exit.guard.when(w)) {
    w.say(exit.guard.blocked, 'blocked');
    return;
  }

  const veto =
    w.bus.emit('beforeMove', { from, to: exit.to, dir }, w) ?? w.room(exit.to).beforeEnter?.(w);
  // a hook may have ended the game, for example a trap or a guard that woke up
  if (w.state.over) return;
  if (veto) {
    w.say(veto, 'blocked');
    return;
  }

  if (exit.guard?.onPass && w.once(`pass:${from}:${dir}`)) w.say(exit.guard.onPass);

  enter(w, exit.to, from);
}

/** Put the player in a room, describe it and run its hooks. */
export function enter(w: World, room: string, from: string | null): void {
  const firstVisit = !w.state.visited.includes(room);
  if (from !== null) w.state.previous = from;
  w.state.location = room;
  if (firstVisit) w.state.visited.push(room);
  w.describeRoom();
  w.bus.emit('afterEnter', { room, from, firstVisit }, w);
  for (const effect of w.room(room).onEnter ?? []) effect(w);
}

/** Return to the previous room. Going back twice returns you to where you were. */
export function goBack(w: World): void {
  const previous = w.state.previous;
  if (!previous) {
    w.say("Back where? You haven't been anywhere yet.", 'error');
    return;
  }
  const way = w.exits().find(([, exit]) => exit.to === previous);
  if (!way) {
    w.say("You can't find your way back from here.", 'error');
    return;
  }
  go(w, way[0]);
}

/** Leave the room the only way there is, or ask which way when there are several. */
export function leaveRoom(w: World): void {
  const ways = w.exits().map(([dir]) => dir);
  if (ways.length === 1) {
    go(w, ways[0]!);
    return;
  }
  if (ways.length === 0) {
    w.say('There is no way out of here that you can see.', 'error');
    return;
  }
  // the answer is a direction, which is a command of its own and simply runs
  w.ask('Which way do you want to go?', () => w.say('Never mind, then.'), { choices: ways });
}

// the exit whose door, stair or stream these words name: "go through the door", "cross the stream"
function doorway(w: World, words: readonly string[]): Direction | undefined {
  for (const [dir, exit] of w.exits()) {
    const via = exit.door ?? exit.via;
    if (via && resolveNoun(words, [via], w.def.things).kind === 'one') return dir;
  }
  return undefined;
}

/** The way "climb" means here: up if there is one, else the only way that climbs. */
function climbWay(w: World): Direction | undefined {
  const ways = w
    .exits()
    .filter(([dir, exit]) => dir === 'up' || dir === 'down' || exit.stairs)
    .map(([dir, exit]) => ({ dir, way: dir === 'up' || dir === 'down' ? dir : exit.stairs }));
  const up = ways.find((c) => c.way === 'up');
  if (up) return up.dir;
  return ways.length === 1 ? ways[0]!.dir : undefined;
}

const CLIMB_VERBS = new Set(['climb', 'ascend', 'descend']);
// words for a stair that name no particular one: "climb the stairs"
const STAIR_WORDS = new Set(['stairs', 'stair', 'staircase', 'steps', 'step', 'ladder']);

// "go through the door", "go out of the door", "walk past it"
const THROUGH = new Set(['through', 'out', 'of', 'past', 'via', 'towards', 'toward']);
// on their own these mean leaving the room
const OUT_VERBS = new Set(['exit', 'leave room', 'get out', 'escape', 'flee']);

const BACK_VERBS = ['back', 'return', 'retreat', 'go back'];

export const goCommand: CommandDef = {
  id: 'go',
  verbs: [
    'go',
    'walk',
    'move',
    'travel',
    'run',
    'head',
    'climb',
    'ascend',
    'descend',
    'cross',
    'ford',
    'wade',
    'back',
    'return',
    'retreat',
    'cd',
    'proceed',
    'continue',
    'step',
    'enter',
    'venture',
    'crawl',
    'hurry',
    'flee',
    'escape',
    'exit',
    'leave room',
    'get out',
  ],
  help: {
    usage: 'go north (or n) · go back',
    summary: 'Move in a direction, or back where you came from.',
  },
  run({ w, cmd }) {
    const words = cmd.direct.length ? cmd.direct : cmd.args;
    // For the shell-minded: "cd .." (the dots never reach us) and "cd -" go back.
    const cdBack = cmd.verb === 'cd' && (words.length === 0 || words.join(' ') === '-');
    if (cdBack || BACK_VERBS.includes(cmd.verb) || words.join(' ') === 'back') {
      goBack(w);
      return;
    }
    if (words.length === 0 && OUT_VERBS.has(cmd.verb)) {
      leaveRoom(w);
      return;
    }
    // "ascend" and "descend" say which way on their own
    if (words.length === 0 && (cmd.verb === 'ascend' || cmd.verb === 'descend')) {
      go(w, cmd.verb === 'ascend' ? 'up' : 'down');
      return;
    }
    // "climb", or "climb the stairs" where no one stair is named: up, or the only way that climbs
    if (CLIMB_VERBS.has(cmd.verb) && words.every((t) => STAIR_WORDS.has(t))) {
      const way = (words.length ? doorway(w, words) : undefined) ?? climbWay(w);
      if (!way) {
        w.say('There is nothing here to climb.', 'error');
        return;
      }
      if (!words.length || !doorway(w, words)) w.say(`(${way})`);
      go(w, way);
      return;
    }
    let skip = 0;
    while (skip < words.length && THROUGH.has(words[skip]!)) skip++;
    const rest = words.slice(skip);
    const dir = parseDirection(words) ?? (rest.length ? parseDirection(rest) : undefined);
    if (!dir && skip > 0 && rest.length === 0) {
      leaveRoom(w); // "go out"
      return;
    }
    const way = dir ?? (rest.length ? doorway(w, rest) : undefined);
    if (!way) {
      w.say(words.length ? `I don't know how to go "${words.join(' ')}".` : 'Go where?', 'error');
      return;
    }
    go(w, way);
  },
};
