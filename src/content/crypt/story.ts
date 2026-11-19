// the state of the story, who is alive, who is a friend, what the player has lost
// and how it all ends. everything here reads flags and the killed list
// so it survives save, load and undo
import type { EventBus } from '../../engine/events';
import type { RankInfo } from '../../engine/definitions';
import type { World } from '../../engine/world';

// ---- who is who ----------------------------------------------------------------

// the skeleton at the crypt door: talk to it, look at it properly, then spar with it
export const skeletonTalked = (w: World): boolean => Boolean(w.flag('skeletonTalked'));
export const skeletonClue = (w: World): boolean => Boolean(w.flag('skeletonClue'));
export const skeletonBeaten = (w: World): boolean => Boolean(w.flag('skeletonBeaten'));
// it chased a thrown bone instead, and would rather you forgot about it
export const skeletonFetched = (w: World): boolean => Boolean(w.flag('skeletonFetched'));

// the tutorial lets the player try things first, and only says what to type when they
// are stuck: after TRIES commands in the crypt that did not get them any further
const TRIES = 2;
const HINTS = {
  talk: 'Hint: talk to skeleton',
  examine: 'Hint: examine skeleton',
  fight: 'Hint: fight skeleton',
  leave: 'Hint: go east',
} as const;

const tutorialStep = (w: World): keyof typeof HINTS =>
  skeletonBeaten(w)
    ? 'leave'
    : !skeletonTalked(w)
      ? 'talk'
      : !skeletonClue(w)
        ? 'examine'
        : 'fight';

function tutorialHint(w: World): void {
  // the tutorial is over once the player has left the crypt
  if (w.here !== 'start' || w.state.visited.includes('dragonCell')) return;
  const step = tutorialStep(w);
  // a new step starts the count again
  const tries = (w.flag('hintStep') ?? 'talk') === step ? Number(w.flag('hintTries') ?? 0) + 1 : 0;
  w.setFlag('hintStep', step);
  w.setFlag('hintTries', tries);
  if (tries > 0 && tries % TRIES === 0) w.hint(HINTS[step]);
}

// the dragon is alive and on your side, fed or brought back
export const dragonFriend = (w: World): boolean =>
  !w.isDead('dragon') && Boolean(w.flag('dragonFriend'));

// the dragon is alive and asleep and has never met you properly
export const dragonAsleep = (w: World): boolean => !w.isDead('dragon') && !w.flag('dragonFriend');

// fed, but it blocks the way: you lied about the keeper and could not back it up, or you
// said you came to fight and had nothing to fight with
export const dragonDoubts = (w: World): boolean =>
  !w.isDead('dragon') && Boolean(w.flag('dragonDoubt'));

export const dragonBlocks = (w: World): boolean =>
  !w.isDead('dragon') && Boolean(w.flag('dragonChallenged') || w.flag('dragonDoubt'));

export const dragonBlockedText = (w: World): string =>
  dragonDoubts(w)
    ? 'The dragon is awake, and his tail lies across the passage. He is waiting for you to ' +
      'tell him what the keeper thinks of the gardener.'
    : 'The dragon is awake, and his tail lies across the passage. He is waiting for you to ' +
      'come back with a worthy weapon.';

// the swords, spears and staves the dragon will cross claws with
export function worthyWeapon(w: World): string | undefined {
  const dragon = w.thing('dragon');
  return dragon.kind === 'creature' ? dragon.weakTo.find((id) => w.has(id)) : undefined;
}

// said something cruel to the troll and has not taken it back, so it sulks in the gazebo
export const trollSulks = (w: World): boolean =>
  !w.isDead('troll') &&
  Boolean(w.flag('trollHurt')) &&
  !w.flag('trollFriend') &&
  !w.flag('trollForgave');

export const trollFriend = (w: World): boolean =>
  !w.isDead('troll') && Boolean(w.flag('trollFriend'));

// kill the troll and you lose your voice
export const mute = (w: World): boolean => w.isDead('troll');

// kill the dragon and you lose your strength
export const weak = (w: World): boolean => w.isDead('dragon');

export const MUTE = 'You open your mouth. Nothing comes out.';

// weapons that scrape and clank when you try to be quiet
const NOISY = ['sword', 'hammer', 'knife'];

// ---- score ---------------------------------------------------------------------

export const POINTS = {
  examine: 10,
  room: 20,
  fragment: 50,
  kindWord: 50,
  cruelWord: -100,
  sneak: 100,
  feed: 250,
  help: 250,
  kill: 250,
  killBoth: -500,
  revive: 500,
  riddle: 150,
  trap: -150,
  screen: 50,
  home: 200,
  deceive: 100,
  duel: 150,
  keeperNews: 100,
  clubbed: -50,
} as const;

// things that give back a piece of memory when you look at them closely
const FRAGMENTS: Readonly<Record<string, string>> = {
  candle: 'candle',
  door: 'door',
  runes: 'runes',
  water: 'water',
  mirror: 'face',
  scale: 'face',
};

const FRAGMENT_KEYS = [...new Set(Object.values(FRAGMENTS))];

export const fragments = (w: World): number =>
  FRAGMENT_KEYS.filter((f) => w.flag(`frag:${f}`)).length;

// the potion of remembering: every fragment not found yet, with its points
export function rememberAll(w: World): number {
  const missing = FRAGMENT_KEYS.filter((f) => !w.flag(`frag:${f}`));
  for (const f of missing) {
    w.setFlag(`frag:${f}`);
    w.addScore(POINTS.fragment);
  }
  return missing.length;
}

const RANKS: readonly (readonly [number, string])[] = [
  [2400, 'The Oned'],
  [1400, 'Fearless Wayfinder'],
  [800, 'Curious Seeker'],
  [300, 'Adventurous Wanderer'],
  [-Infinity, 'Clueless Sleepwalker'],
];

export const rank = (score: number): string => RANKS.find(([min]) => score >= min)![1];

// the same rank as a level, counted from the bottom of the ladder
export function rankInfo(score: number): RankInfo {
  const i = RANKS.findIndex(([min]) => score >= min);
  return { name: RANKS[i]![1], level: RANKS.length - i, of: RANKS.length };
}

export const scoreLine = (w: World): string =>
  `Your score is ${w.state.score}, in ${w.state.turns} turns. Rank: ${rank(w.state.score)}.`;

// ---- hooks ---------------------------------------------------------------------

export function hooks(bus: EventBus): void {
  bus.on('ready', (_, w) => tutorialHint(w));

  bus.on('afterEnter', ({ room, firstVisit }, w) => {
    if (firstVisit) w.addScore(POINTS.room);
    if (room === 'tower' && w.has('scale')) {
      w.say('The dragonscale in your pocket grows warm. Something in this room means harm.');
    }
  });

  bus.on('examine', ({ thing, first }, w) => {
    // a close look at the skeleton, or at its hands on the door, shows what it wants
    if (thing === 'note') w.setFlag('readNote');
    if (thing === 'skeleton' || (thing === 'door' && !skeletonBeaten(w))) {
      w.setFlag('skeletonClue');
    }
    if (!first) return;
    if (thing === 'box') {
      w.addScore(POINTS.trap);
      return;
    }
    w.addScore(POINTS.examine);
    const fragment = FRAGMENTS[thing];
    if (fragment && !w.flag(`frag:${fragment}`)) {
      w.setFlag(`frag:${fragment}`);
      w.addScore(POINTS.fragment);
    }
    if (thing === 'screen') {
      w.setFlag('sawScreen');
      w.addScore(POINTS.screen);
    }
  });

  // the duck is not to be taken: the first grab costs points, after that it only warns
  // a troll you were cruel to sits between you and the torch
  bus.on('beforeTake', ({ thing }, w) => {
    if (thing !== 'torch' || !trollSulks(w) || w.locationOf('troll') !== w.here) return;
    return (
      'You reach past the troll for the torch. A huge green hand comes down over it, without ' +
      'the troll even turning round. "Nub," he says to the mountains.'
    );
  });

  bus.on('beforeTake', ({ thing }, w) => {
    if (thing !== 'duck') return;
    if (w.flag('duckTrap')) {
      return (
        'You reach for the duck. It looks at you. You remember the books, and put your ' +
        'hand away.'
      );
    }
    w.setFlag('duckTrap');
    w.addScore(POINTS.trap);
    return (
      'You close your hand round the duck. It squeaks, very loudly, and every book in the ' +
      'library slams shut at once. Dust falls from the shelves in a slow grey curtain. When it ' +
      'settles, the duck is exactly where it was, and you are covered in the opinions of old ' +
      'books.'
    );
  });

  // tiptoeing east past a dragon that is still asleep
  bus.on('beforeMove', ({ from, to }, w) => {
    if (from !== 'dragonCell' || to !== 'portcullis' || !dragonAsleep(w)) return;
    const noisy = NOISY.find((id) => w.has(id));
    if (noisy) {
      w.lose(
        `You tiptoe past the dragon in perfect silence. Your feet do, that is. The ${noisy} ` +
          'on your back scrapes along the wall with a sound like a very long sneeze. One ' +
          'enormous eye opens. The boots, it turns out, can do nothing about the rest of you.',
      );
      return;
    }
    if (w.has('mutton')) {
      return (
        "You take one soft step. The dragon's nose moves. He sniffs, in his sleep, in the " +
        'exact direction of the mutton in your arms. One more step and he will wake up. You ' +
        'stop. Maybe waking him up is not the worst idea, if you have something to give him.'
      );
    }
    w.say(
      'You hold your breath and walk past the dragon on felt soles. His tail twitches once. ' +
        'You do not breathe again until you are through. Behind you, he goes on sleeping, and ' +
        'goes on being hungry.',
    );
    w.setFlag('dragonSneaked');
    w.award('sneak', POINTS.sneak);
  });

  bus.on('kill', ({ thing, weapon }, w) => {
    if (thing === 'dragon') killedDragon(w, weapon);
    if (thing === 'troll') killedTroll(w);
  });
}

function killedDragon(w: World, weapon: string): void {
  const name = w.thing(weapon).name;
  w.addScore(POINTS.kill);
  w.say(
    w.flag('dragonKilledAwake')
      ? 'He sees the blow coming and does not move. He had lowered his guard because you had ' +
          'fed him, and he does not raise it now. He lies down slowly, with his head turned ' +
          'toward the door, as if he still waited for someone. You find that you are not as ' +
          'proud of this as you expected.'
      : 'He did not even wake up. He was thinner than he looked, and he lay with his head ' +
          'turned toward the door, as if he still waited for someone. His stomach makes one ' +
          'last hollow sound. You find that you are not as proud of this as you expected.',
  );
  w.say(
    `Your ${name} is stuck fast in the dragon. You pull until your arms shake. They go on ` +
      `shaking afterwards. The ${name} stays where it is.`,
  );
  w.move(weapon, 'nowhere');
  w.say('The passageway leading to the east opens up.');
  if (w.isDead('troll')) killedBoth(w);
}

function killedTroll(w: World): void {
  if (dragonAsleep(w)) {
    w.lose(
      'The troll falls, and the sound of it rolls through the archway and into the castle. ' +
        'In there, something stops snoring. You have just enough time to remember the dragon ' +
        'you tiptoed past, and to understand that you never really got past him. He arrives all ' +
        'at once. He is not interested in a conversation.',
    );
    return;
  }
  w.addScore(POINTS.kill);
  w.say(
    'You open your mouth to say something over the body: a joke, a word, anything. Nothing ' +
      "comes out. You try again. Your voice is gone. It went wherever the troll's went.",
  );
  if (dragonFriend(w)) {
    w.say(
      `A shadow crosses the ${w.here === 'gazebo' ? 'gazebo' : 'garden'}. The dragon lands ` +
        'badly, like something that has not flown ' +
        'in years, and looks at the troll for a long time. He does not roar. He holds out one ' +
        'claw' +
        (w.locationOf('scale') === 'nowhere'
          ? ', and then lets it fall.'
          : ', and waits until the scale is in it. You give it back because there is ' +
            'nothing else to do.') +
        ' "He grew the turnips," the dragon says, "and he never once ate the mutton." He walks ' +
        'back into the castle and does not look at you.',
    );
    w.move('scale', 'nowhere');
    w.setFlag('dragonEstranged');
  }
  if (w.isDead('dragon')) killedBoth(w);
  if (w.here === 'portcullis') w.say('It seems you can now walk about in the garden freely.');
}

function killedBoth(w: World): void {
  w.addScore(POINTS.killBoth);
  w.say(
    'That is both of them. The castle is very quiet ' +
      'now, and so are you. Your arms shake and your mouth is empty.',
  );
}

// ---- the ending ----------------------------------------------------------------

// runs when the player reaches the forest, the room text has already been shown
export function ending(w: World): void {
  w.addScore(POINTS.home);
  const dDead = w.isDead('dragon');
  const tDead = w.isDead('troll');

  if (dDead && tDead) {
    w.say(
      'Two places by the fire are empty. People ' +
        'speak to you, and you understand every word. Yet, when you open your mouth to answer, ' +
        'nothing comes out. A child runs up and holds out her arms. Yours do not lift, they lack the strength.',
    );
    w.say('You are home but you are not whole.');
    w.say(
      'You did not pass the test.',
      'lose',
    );
    w.say(scoreLine(w));
    w.state.over = true;
    return;
  }

  w.say(
    'You look at the faces, one after another. You know them. You have always known them. ' +
      'Every face here is a face of yours.',
  );

  // the strength
  if (dDead) {
    w.say(
      'There is an empty place by the fire. Nobody sits in it, and nobody explains it. A ' +
        'child runs up and holds out her arms. Yours do not lift. They shake a little, the ' +
        'way they did over the dragon, and stay at your sides. You tell her why. You have the ' +
        'words for it, at least.',
    );
  } else if (w.flag('dragonEstranged')) {
    w.say(
      'A very tall one, with smoke in his breath, sits on the far side of the fire and keeps ' +
        'the fire between you. He does not leave. He does not come closer.',
    );
  } else if (w.flag('dragonRevived')) {
    w.say(
      'A very tall one stands a little apart, with a cracked scale on a string around his ' +
        'neck. He looks at you for a long moment. Then he comes over anyway. That "anyway" is ' +
        'the best thing anyone gives you all day.',
    );
  } else if (w.flag('dragonDueled')) {
    w.say(
      'At the back stands a very tall one with a scorched scale on a string around his neck. ' +
        'He shows it to everyone, and tells them how you came at him with a blade and then ' +
        'put it down. He tells it twice. The second time, the blade is bigger.',
    );
  } else if (w.flag('dragonFooled')) {
    w.say(
      'At the back stands a very tall one with smoke in his breath. He does not mention the ' +
        'keeper all evening, and neither do you. Once, he catches your eye, and very nearly ' +
        'smiles.',
    );
  } else if (w.flag('dragonFriend')) {
    w.say(
      'At the back stands a very tall one with smoke in his laugh. He lifts you off the ' +
        'ground with one arm, to show that he can, and to show that you are worth lifting.',
    );
  } else {
    w.say(
      'Everyone is here except one. At night, something large breathes at the edge of the ' +
        'forest. It does not come closer.',
    );
  }

  // he heard it from you that the keeper was not coming back
  if (!dDead && w.flag('keeperTold')) {
    w.say(
      'Someone has made a bed by the fire. There is a cup beside it. ' +
        'The tall one sits next to it all night, keeping watch.',
    );
  }

  // the voice
  if (tDead) {
    w.say(
      'There is an empty place by the fire. They speak to you, and you understand every ' +
        'word. You open your mouth to answer. Nothing comes out. They wait, kindly, for a ' +
        'long time. Then they stop waiting.',
    );
  } else if (w.flag('trollRevived')) {
    w.say(
      'One of them has a broken tooth, and is a little shy of you. But when you say you are ' +
        'sorry, out loud, in the voice you got back, the answer is a nod, and a place to sit.',
    );
  } else if (w.flag('trollForgave') && w.flag('trollFriend')) {
    w.say(
      'One of them has a broken tooth, and keeps a hand near his mouth. When you speak to him, ' +
        'he lowers the hand. He does not cover the tooth again all evening.',
    );
  } else if (w.flag('trollForgave')) {
    // forgiven, but never shown his face, so he never found his voice
    w.say(
      'One of them has a broken tooth, and sits beside you. But his hand stays over his mouth ' +
        'all evening. Nobody ever showed him his own face.',
    );
  } else if (w.flag('trollHurt') && !w.flag('trollFriend')) {
    // the cruel word was never taken back
    w.say(
      'One of them has a broken tooth, and keeps a hand over his mouth all evening. He sits at ' +
        'the edge of the firelight, close enough to hear, too far to talk. You know what you ' +
        'said. Your voice is your own, and you have not yet used it to say anything else.',
    );
  } else {
    w.say(
      'One of them has a broken tooth, and starts to cover it with a hand, then remembers, ' +
        'and takes the hand away. "Booga hoom," he says, loud enough for the whole forest. ' +
        'You are home. You say it back, and your voice is your own, and it carries.',
    );
  }

  // the more you looked at the more you remember
  const found = fragments(w);
  if (found >= 3) {
    w.say(
      'And then you remember, the way you remember a word. The candle, and your own hands ' +
        'lighting it. The bolt, and your own hand closing it. Nobody put you in the crypt. ' +
        'You went in to find out who would come out.',
    );
    if (found >= 4) {
      w.say(
        'You painted the lines under your eyes yourself, so that you would know your own ' +
          'face when you met it.',
      );
    }
  } else {
    w.say(
      'You feel that you have forgotten something important, about a candle. It will come ' +
        'back to you. Or you will have to go back for it, and look closer.',
    );
  }

  w.say(verdict(w));
  w.say('Bravo! You beat the game!', 'win');
  w.say(scoreLine(w));
  if (w.flag('sawScreen')) w.say('Somewhere, a computer stops humming.');
  w.win();
}

function verdict(w: World): string {
  if (w.isDead('troll')) {
    return (
      'You passed the test, in conflict with yourself. You chose your strength over your ' +
      'voice. One day you will want to talk about it.'
    );
  }
  if (w.isDead('dragon')) {
    return (
      'You passed the test. You chose your voice over your strength. It is a real choice, ' +
      'and it has a real price.'
    );
  }
  if (!w.flag('dragonFriend')) {
    return (
      'You passed the test, but it is not finished. One part of you is still asleep in a ' +
      'castle, and still hungry.'
    );
  }
  // said sorry, but the troll never saw his face
  if (w.flag('trollForgave') && !w.flag('trollFriend')) {
    return 'You passed the test. You came home whole, but part of you still hides its face.';
  }
  // the cruel word to the troll was never taken back
  if (w.flag('trollHurt') && !w.flag('trollFriend')) {
    return 'You passed the test. You came home whole, but with something left unsaid.';
  }
  if (
    w.flag('dragonRevived') ||
    w.flag('trollRevived') ||
    w.flag('dragonEstranged') ||
    w.flag('trollForgave')
  ) {
    return (
      'You passed the test. You came home whole, with a scar. The scar is the part you are ' +
      'proudest of.'
    );
  }
  return 'You passed the test. You came home whole.';
}
