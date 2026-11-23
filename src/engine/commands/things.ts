import type { Openable } from '../definitions';
import { resolveNoun } from '../parser/resolve';
import { capitalise, type ThingId } from '../types';
import type { World } from '../world';
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

export const lookCommand: CommandDef = {
  id: 'look',
  verbs: ['look', 'where', 'gaze', 'see'],
  meta: true,
  allowWhenOver: true,
  help: { usage: 'look', summary: 'Describe your surroundings.' },
  run(ctx) {
    const { w, cmd } = ctx;
    const words = cmd.direct.filter((t) => !['around', 'room', 'here', 'am', 'i'].includes(t));
    if (words.length === 0) {
      w.describeRoom();
      return;
    }
    const id = ctx.resolve(words);
    if (id) describeThing(w, id);
  },
};

export const examineCommand: CommandDef = {
  id: 'examine',
  verbs: ['examine', 'inspect', 'look at', 'check', 'read', 'describe'],
  meta: true,
  help: { usage: 'examine chest', summary: 'Look closely at something.' },
  run(ctx) {
    if (ctx.cmd.direct.length === 0) {
      ctx.w.say('Examine what?', 'error');
      return;
    }
    const id = ctx.resolve(ctx.cmd.direct);
    if (id) describeThing(ctx.w, id);
  },
};

function takeOne(w: World, id: ThingId): void {
  const thing = w.thing(id);
  if (w.has(id)) {
    w.say('You already have that!', 'error');
    return;
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
}

export const takeCommand: CommandDef = {
  id: 'take',
  verbs: ['take', 'get', 'grab', 'pick up', 'pick', 'lift', 'collect'],
  help: { usage: 'take bone', summary: 'Pick something up.' },
  run(ctx) {
    const { w, cmd } = ctx;
    if (cmd.direct.length === 0) {
      w.say('Take what?', 'error');
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
    const inRoom = resolveNoun(cmd.direct, here, w.def.things, w.state.it).kind !== 'none';
    const id = ctx.resolve(cmd.direct, inRoom ? { scope: here } : {});
    if (id) takeOne(w, id);
  },
};

export const dropCommand: CommandDef = {
  id: 'drop',
  verbs: ['drop', 'leave', 'discard', 'put down'],
  help: { usage: 'drop bone', summary: 'Put down something you carry.' },
  run(ctx) {
    const { w, cmd } = ctx;
    if (cmd.direct.length === 0) {
      w.say('Drop what?', 'error');
      return;
    }
    const id = ctx.resolve(cmd.direct, {
      scope: w.inventory(),
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
  verbs: ['open'],
  help: { usage: 'open door', summary: 'Open a door, chest, gate…' },
  run(ctx) {
    if (ctx.cmd.direct.length === 0) {
      ctx.w.say('Open what?', 'error');
      return;
    }
    const id = ctx.resolve(ctx.cmd.direct);
    if (id) openThing(ctx.w, id);
  },
};

export const closeCommand: CommandDef = {
  id: 'close',
  verbs: ['close', 'shut'],
  run(ctx) {
    const { w } = ctx;
    const id = ctx.cmd.direct.length ? ctx.resolve(ctx.cmd.direct) : undefined;
    if (!ctx.cmd.direct.length) w.say('Close what?', 'error');
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
    if (cmd.direct.length === 0) {
      w.say('Unlock what?', 'error');
      return;
    }
    const id = ctx.resolve(cmd.direct);
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
const UNARMED_VERBS = new Set(['punch', 'kick', 'slap', 'bite', 'headbutt', 'tickle']);

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
    ...UNARMED_VERBS,
  ],
  help: { usage: 'kill dragon with spear', summary: 'Fight a creature.' },
  run(ctx) {
    const { w, cmd } = ctx;
    if (cmd.direct.length === 0) {
      w.say('Attack what?', 'error');
      return;
    }
    const target = ctx.resolve(cmd.direct, {
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
    const unarmed =
      UNARMED_VERBS.has(cmd.verb) ||
      cmd.indirect.length === 0 ||
      BARE_HANDS.has(cmd.indirect.join(' '));
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
    if (cmd.indirect.length) {
      chooseWeapon(ctx, target, cmd.indirect);
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
  verbs: ['inventory', 'inv', 'items'],
  meta: true,
  help: { usage: 'inventory', summary: 'List what you carry.' },
  run({ w }) {
    const items = w.inventory();
    w.say(
      items.length
        ? `You have with you: ${items.map((id) => w.thing(id).name).join(', ')}.`
        : 'You do not hold anything at the moment.',
    );
  },
};
