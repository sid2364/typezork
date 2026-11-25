import type { Openable } from '../definitions';
import { resolveNoun, withoutFiller } from '../parser/resolve';
import { capitalise, type ThingId } from '../types';
import type { World } from '../world';
import { leaveRoom } from './movement';
import type { CommandContext, CommandDef } from './types';

const openableOf = (w: World, id: ThingId): Openable | undefined => {
  const thing = w.thing(id);
  return thing.kind === 'item' ? thing.openable : undefined;
};

function unlockThing(w: World, id: ThingId, o: Openable): void {
  w.unlock(id);
  w.say(o.unlockMessage ?? `You unlock ${w.the(id)} with ${w.the(o.lockedBy!)}.`);
}

/**
 * Open a thing, unlocking it first if the player carries the key.
 * Returns true if it ends up open.
 */
export function openThing(w: World, id: ThingId): boolean {
  const o = openableOf(w, id);
  if (!o) {
    w.say(`It's not possible to open ${w.the(id)}.`, 'error');
    return false;
  }
  if (w.isOpen(id)) {
    w.say(o.alreadyOpen ?? `${capitalise(w.the(id))} is already open.`);
    return true;
  }
  const veto = o.beforeOpen?.(w);
  if (veto) {
    w.say(veto, 'blocked');
    return false;
  }
  if (w.isLocked(id)) {
    if (!o.lockedBy || !w.has(o.lockedBy)) {
      w.say(o.lockedMessage ?? `${capitalise(w.the(id))} is locked.`, 'error');
      return false;
    }
    unlockThing(w, id, o);
  }
  w.setOpen(id, true);
  w.say(o.openMessage ?? `You open ${w.the(id)}.`);
  if (w.once(`open:${id}`)) for (const effect of o.onOpen ?? []) effect(w);
  w.bus.emit('open', { thing: id }, w);
  return true;
}

// the openable things in reach that pass a test, for guessing what "open" means
const openables = (w: World, test: (id: ThingId) => boolean): ThingId[] =>
  w.inScope().filter((id) => openableOf(w, id) && test(id));

// describe a thing the way examine does and tell listeners it was looked at
export function describeThing(w: World, id: ThingId): void {
  describe(w, id);
  w.bus.emit('examine', { thing: id, first: w.once(`examined:${id}`) }, w);
}

function describe(w: World, id: ThingId): void {
  const thing = w.thing(id);
  if (thing.kind === 'creature' && w.isDead(id)) {
    w.say(w.listing(id)!);
    return;
  }
  const text = thing.examine ?? (w.hasMoved(id) ? undefined : thing.description) ?? undefined;
  if (text) w.say(text);
  const o = openableOf(w, id);
  if (o) {
    const state = w.isOpen(id) ? 'open' : w.isLocked(id) ? 'closed and locked' : 'closed';
    w.say(`${capitalise(w.the(id))} is ${state}.`);
  } else if (!text) {
    w.say(`You see nothing special about ${w.the(id)}.`);
  }
}

// words that ask for a closer look rather than another look round
const CLOSER = new Set(['closer', 'closely', 'close', 'harder', 'hard', 'properly', 'carefully']);
const ROOM_WORDS = new Set(['around', 'about', 'room', 'here', 'am', 'i']);
// "look out of the window", "look through the gate"
const THROUGH = new Set(['out', 'of', 'through', 'outside']);

const throughless = (words: readonly string[]): string[] => {
  let skip = 0;
  while (skip < words.length && THROUGH.has(words[skip]!)) skip++;
  return words.slice(skip);
};

// "x crypt", "look at the armoury": the room's own name, when it names nothing in it
function namesRoom(w: World, words: readonly string[]): boolean {
  const named = withoutFiller(words);
  if (named.length === 0) return false;
  if (resolveNoun(named, w.inScope(), w.def.things).kind !== 'none') return false;
  const name = new Set(w.room().name.toLowerCase().split(/\s+/));
  return named.every((t) => name.has(t));
}

export const lookCommand: CommandDef = {
  id: 'look',
  verbs: ['look', 'l', 'where', 'gaze', 'see', 'look around', 'survey', 'scan', 'view'],
  meta: true,
  allowWhenOver: true,
  help: { usage: 'look', summary: 'Describe your surroundings.' },
  run(ctx) {
    const { w, cmd } = ctx;
    // "look more closely at the skeleton" names the skeleton after the "at"
    const said = cmd.prep === 'at' && cmd.indirect.length ? cmd.indirect : cmd.direct;
    const words = throughless(said.filter((t) => !ROOM_WORDS.has(t)));
    // "look" and "look again" are a look round, "look closer" is a look at something
    if (
      (withoutFiller(words).length === 0 && !words.some((t) => CLOSER.has(t))) ||
      namesRoom(w, words)
    ) {
      w.describeRoom();
      return;
    }
    const id = ctx.object(words, { ask: 'What do you want to look at?' });
    if (id) describeThing(w, id);
  },
};

// verbs that read well in "What do you want to …?", the rest ask what to look at
const EXAMINE_VERBS = new Set([
  'examine',
  'inspect',
  'check',
  'read',
  'describe',
  'study',
  'observe',
  'investigate',
  'search',
  'watch',
]);

export const examineCommand: CommandDef = {
  id: 'examine',
  verbs: [
    'examine',
    'x',
    'inspect',
    'look at',
    'check',
    'read',
    'describe',
    'study',
    'observe',
    'investigate',
    'search',
    'watch',
    'peer at',
    'stare at',
    'look closer',
    'look closely',
    'look harder',
    'look properly',
    'look closer at',
    'look closely at',
    'look harder at',
    'look properly at',
    'take closer look',
    'take closer look at',
    'have closer look',
    'have closer look at',
    'get closer look',
    'get closer look at',
    'get closer',
    'go closer',
    'step closer',
    'move closer',
    'approach',
    'what is',
    'what are',
    "what's",
    'who is',
    "who's",
  ],
  meta: true,
  help: { usage: 'examine chest (or x chest)', summary: 'Look closely at something.' },
  run(ctx) {
    const { w, cmd } = ctx;
    const words = throughless(cmd.direct.length ? cmd.direct : cmd.indirect);
    // "search the room" is a look round
    if ((words.length && words.every((t) => ROOM_WORDS.has(t))) || namesRoom(w, words)) {
      w.describeRoom();
      return;
    }
    const plain = EXAMINE_VERBS.has(cmd.verb) ? cmd.verb : 'look at';
    const id = ctx.object(words, { ask: `What do you want to ${plain}?` });
    if (id) describeThing(w, id);
  },
};

/** Pick a thing up, or say why not. Returns whether the player now carries it. */
export function takeOne(w: World, id: ThingId): boolean {
  const thing = w.thing(id);
  if (w.has(id)) {
    w.say('You already have that!', 'error');
    return true;
  }
  const veto = w.bus.emit('beforeTake', { thing: id }, w);
  if (veto) {
    w.say(veto);
  } else if (thing.kind === 'creature') {
    w.say(thing.refuseTake ?? 'You cannot be serious.', 'error');
  } else if (!thing.portable) {
    w.say(thing.refuseTake ?? `You can't take ${w.the(id)}.`, 'error');
  } else {
    const message = w.hasMoved(id) ? 'Taken.' : (thing.takeMessage ?? 'Taken.');
    w.move(id, 'inventory');
    w.markMoved(id);
    w.say(message);
    w.bus.emit('take', { thing: id }, w);
  }
  return w.has(id);
}

export const takeCommand: CommandDef = {
  id: 'take',
  verbs: [
    'take',
    'get',
    'grab',
    'pick up',
    'pick',
    'lift',
    'collect',
    'snatch',
    'pocket',
    'steal',
    'loot',
    'carry',
    'obtain',
  ],
  help: { usage: 'take bone', summary: 'Pick something up.' },
  run(ctx) {
    const { w, cmd } = ctx;
    if (withoutFiller(cmd.direct).length === 0) {
      const id = ctx.object([], {
        candidates: w.thingsAt(w.here).filter((t) => {
          const thing = w.thing(t);
          return thing.kind === 'item' && thing.portable;
        }),
        none: 'There is nothing here you can take.',
      });
      if (id) takeOne(w, id);
      return;
    }
    if (cmd.direct.length === 1 && (cmd.direct[0] === 'all' || cmd.direct[0] === 'everything')) {
      const portable = w.thingsAt(w.here).filter((id) => {
        const t = w.thing(id);
        return t.kind === 'item' && t.portable;
      });
      if (portable.length === 0) w.say('There is nothing here you can take.', 'error');
      for (const id of portable) {
        w.say(`${w.thing(id).name}:`);
        takeOne(w, id);
      }
      return;
    }
    // Prefer things lying here over things already carried.
    const here = w.thingsAt(w.here);
    const inRoom =
      resolveNoun(cmd.direct, here, w.def.things, w.state.it, w.obvious()).kind !== 'none';
    const id = ctx.object(cmd.direct, inRoom ? { scope: here } : {});
    if (id) takeOne(w, id);
  },
};

export const dropCommand: CommandDef = {
  id: 'drop',
  verbs: ['drop', 'leave', 'discard', 'put down', 'put', 'place', 'set down', 'throw away'],
  help: { usage: 'drop bone', summary: 'Put down something you carry.' },
  run(ctx) {
    const { w, cmd } = ctx;
    // "leave" on its own means leaving the room
    if (cmd.verb === 'leave' && cmd.args.length === 0) {
      leaveRoom(w);
      return;
    }
    const id = ctx.object(cmd.direct, {
      scope: w.inventory(),
      none: 'You are not carrying anything.',
      notFound: "Cannot drop something you don't have!",
    });
    if (!id) return;
    w.move(id, w.here);
    w.markMoved(id);
    w.say('Dropped.');
    w.bus.emit('drop', { thing: id }, w);
  },
};

export const openCommand: CommandDef = {
  id: 'open',
  verbs: ['open', 'push open', 'pull open', 'unbolt', 'unlatch', 'push', 'pull'],
  help: { usage: 'open door', summary: 'Open a door, chest, gate…' },
  run(ctx) {
    const { w } = ctx;
    const id = ctx.object(ctx.cmd.direct, {
      candidates: openables(w, (t) => !w.isOpen(t)),
      none: 'There is nothing here to open.',
    });
    if (id) openThing(w, id);
  },
};

export const closeCommand: CommandDef = {
  id: 'close',
  verbs: ['close', 'shut', 'slam'],
  run(ctx) {
    const { w } = ctx;
    const id = ctx.object(ctx.cmd.direct, {
      candidates: openables(w, (t) => w.isOpen(t)),
      none: 'There is nothing here to close.',
    });
    if (!id) return;
    const o = openableOf(w, id);
    if (!o) w.say(`It's not possible to close ${w.the(id)}.`, 'error');
    else if (!w.isOpen(id)) w.say(`${capitalise(w.the(id))} is already closed.`);
    else {
      w.setOpen(id, false);
      w.say(o.closeMessage ?? `You close ${w.the(id)}.`);
    }
  },
};

export const unlockCommand: CommandDef = {
  id: 'unlock',
  verbs: ['unlock'],
  help: { usage: 'unlock gate', summary: 'Unlock something with a key you carry.' },
  run(ctx) {
    const { w, cmd } = ctx;
    const id = ctx.object(cmd.direct, {
      candidates: openables(w, (t) => w.isLocked(t)),
      none: 'There is nothing here to unlock.',
    });
    if (!id) return;
    const o = openableOf(w, id);
    if (!o?.lockedBy) {
      w.say(`There is nothing to unlock on ${w.the(id)}.`, 'error');
      return;
    }
    if (!w.isLocked(id)) {
      w.say(`${capitalise(w.the(id))} isn't locked.`);
      return;
    }
    if (cmd.indirect.length) {
      const key = ctx.resolve(cmd.indirect, {
        scope: w.inventory(),
        notFound: `You aren't carrying any ${cmd.indirect.join(' ')}.`,
      });
      if (!key) return;
      if (key !== o.lockedBy) {
        w.say(`${capitalise(w.the(key))} doesn't fit.`, 'error');
        return;
      }
    } else if (!w.has(o.lockedBy)) {
      w.say('You do not have the required object to open this.', 'error');
      return;
    }
    unlockThing(w, id, o);
  },
};

function strike(w: World, target: ThingId, weapon: ThingId): void {
  const creature = w.thing(target);
  if (creature.kind !== 'creature') return;
  w.say(`${capitalise(w.the(target))} eyes you keenly.`);
  if (creature.weakTo.length > 0 && !creature.weakTo.includes(weapon)) {
    const { notWorthy } = creature;
    w.say(
      typeof notWorthy === 'function'
        ? notWorthy(w, weapon)
        : (notWorthy ??
            'You do not possess a weapon worthy of this battle. You decide to live and let live.'),
    );
    return;
  }
  w.say(`You draw your ${w.thing(weapon).name} and slay ${w.the(target)}.`);
  w.kill(target);
  for (const effect of creature.onKill ?? []) effect(w);
  w.bus.emit('kill', { thing: target, weapon }, w);
}

/** Words that mean "no weapon at all". */
const BARE_HANDS = new Set([
  'hand',
  'hands',
  'bare hand',
  'bare hands',
  'fist',
  'fists',
  'bare fists',
  'fingers',
  'feet',
  'foot',
  'teeth',
  'nothing',
  'karate',
  'kung fu',
]);

/** Verbs that are an unarmed attack by definition. */
const UNARMED_VERBS = new Set([
  'punch',
  'kick',
  'slap',
  'bite',
  'headbutt',
  'tickle',
  'smack',
  'whack',
  'thump',
  'shove',
  'tackle',
  'elbow',
  'box',
  'spar',
  'wrestle',
  'brawl',
]);

function bareHanded(w: World, target: ThingId): void {
  const creature = w.thing(target);
  if (creature.kind !== 'creature') return;
  w.say(
    creature.bareHanded ??
      `You flail at ${w.the(target)} with your bare hands. ` +
        `${capitalise(w.the(target))} looks more confused than hurt.`,
  );
}

function chooseWeapon(ctx: CommandContext, target: ThingId, words: readonly string[]): void {
  if (BARE_HANDS.has(words.join(' '))) {
    bareHanded(ctx.w, target);
    return;
  }
  const weapon = ctx.resolve(words, {
    scope: ctx.w.inventory(),
    notFound: `You do not possess this ${words.join(' ')} of which you speak.`,
  });
  if (weapon) strike(ctx.w, target, weapon);
}

export const attackCommand: CommandDef = {
  id: 'attack',
  verbs: [
    'attack',
    'kill',
    'fight',
    'strike',
    'hit',
    'beat',
    'slay',
    'stab',
    'injure',
    'bash',
    'smash',
    'hack',
    'slash',
    'chop',
    'cut',
    'lunge at',
    'swing at',
    'charge',
    'duel',
    'challenge',
    'murder',
    ...UNARMED_VERBS,
  ],
  help: { usage: 'kill dragon with spear', summary: 'Fight a creature.' },
  run(ctx) {
    const { w, cmd } = ctx;
    const target = ctx.object(cmd.direct, {
      candidates: w.creaturesHere(),
      none: 'There is nothing here to fight.',
      notFound: `There is no ${cmd.direct.join(' ')} you can tussle with here.`,
    });
    if (!target) return;
    const creature = w.thing(target);
    if (creature.kind !== 'creature') {
      w.say(`Violence won't help with ${w.the(target)}.`, 'error');
      return;
    }
    if (w.isDead(target)) {
      w.say(creature.alreadyDead ?? `${capitalise(w.the(target))} is already dead.`);
      return;
    }
    const refusal = creature.beforeAttack?.(w);
    if (refusal !== undefined) {
      w.say(refusal);
      return;
    }
    // only "with" and "using" name a weapon. "in the face" is where, and the hands do it
    const weapon = cmd.prep === 'with' || cmd.prep === 'using' ? cmd.indirect : [];
    const unarmed =
      UNARMED_VERBS.has(cmd.verb) || weapon.length === 0 || BARE_HANDS.has(weapon.join(' '));
    if (creature.brawl && unarmed) {
      creature.brawl(w);
      return;
    }
    if (!creature.killable) {
      w.say(`${capitalise(w.the(target))} eyes you keenly.`);
      w.say(creature.immune ?? `You cannot kill ${w.the(target)}.`);
      return;
    }
    if (UNARMED_VERBS.has(cmd.verb)) {
      bareHanded(w, target);
      return;
    }
    if (weapon.length) {
      chooseWeapon(ctx, target, weapon);
      return;
    }
    w.say('You do not stand a chance if you fight with your bare hands.');
    if (w.inventory().length === 0) {
      w.say('Come back another day when you are deemed a worthy opponent.');
      return;
    }
    ctx.ask(`What do you want to attack ${w.the(target)} with?`, (tokens) => {
      const words = tokens[0] === 'with' || tokens[0] === 'using' ? tokens.slice(1) : tokens;
      if (words.length === 0) w.say('Alright then...');
      else chooseWeapon(ctx, target, words);
    });
  },
};

export const inventoryCommand: CommandDef = {
  id: 'inventory',
  verbs: ['inventory', 'inv', 'i', 'items', 'pockets', 'bag'],
  meta: true,
  help: { usage: 'inventory (or i)', summary: 'List what you carry.' },
  run({ w }) {
    const items = w.inventory();
    w.say(
      items.length
        ? `You have with you: ${items.map((id) => w.thing(id).name).join(', ')}.`
        : 'You do not hold anything at the moment.',
    );
  },
};
