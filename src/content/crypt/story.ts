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

// beaten fairly in the duel: he bowed to you and follows you, but gave you no scale
export const dragonTamed = (w: World): boolean =>
  !w.isDead('dragon') && Boolean(w.flag('dragonTamed'));

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

// a weapon you carry that is fit to fight the dragon (or the troll) with
export function worthyWeapon(w: World, who = 'dragon'): string | undefined {
  const creature = w.thing(who);
  return creature.kind === 'creature' ? creature.weakTo.find((id) => w.has(id)) : undefined;
}

// said something cruel to the troll and has not taken it back, so it sulks in the gazebo
export const trollSulks = (w: World): boolean =>
  !w.isDead('troll') &&
  Boolean(w.flag('trollHurt')) &&
  !w.flag('trollFriend') &&
  !w.flag('trollForgave');

export const trollFriend = (w: World): boolean =>
  !w.isDead('troll') && Boolean(w.flag('trollFriend'));

// the dragon is dead, and the troll mourns his friend and stands against you
export const trollGrieves = (w: World): boolean =>
  !w.isDead('troll') && w.isDead('dragon') && !w.flag('trollFriend');

// kill the troll in one blow and you lose your voice. beat him in a fair fight and you keep it
export const mute = (w: World): boolean => w.isDead('troll') && !w.flag('trollFought');

// kill the dragon and you lose your strength
export const weak = (w: World): boolean => w.isDead('dragon');

export const MUTE = 'You open your mouth. Nothing comes out.';

// weapons that scrape and clank when you try to be quiet
const NOISY = ['sword', 'spear', 'hammer', 'knife'];

// the troll's club, for anyone who brings the wrong thing to a fight with it
export function clubbed(w: World, weapon?: string): string {
  w.award('clubbed', POINTS.clubbed);
  if (w.here === 'gazebo') {
    w.state.location = 'garden';
    return (
      'The troll does not even turn round. The club comes back over his shoulder, quite ' +
      'gently for a club, and you go down the gazebo steps in one go, and land in the flowers. ' +
      'Small ones. You hope he did not see.'
    );
  }
  const lost = weapon ? w.thing(weapon).name : undefined;
  if (weapon) w.move(weapon, 'nowhere');
  const torch = w.has('torch');
  if (torch) w.move('torch', 'gazebo');
  // the garden has no stream of its own, so the blow carries you down the path to it
  w.state.location = 'portcullis';
  return (
    'The troll swings his club, not even very hard. You fly backwards down the garden path, ' +
    'over the bank and into the stream, which is much colder than it looked.' +
    (lost ? ` Your ${lost} goes one way and you go the other. Only you come back.` : '') +
    (torch
      ? ' The torch hisses out in your hand and is gone. Far to the north, a red glow comes ' +
        'back to the edge of the gazebo, as if nothing happened.'
      : '') +
    ' You crawl out on the bank, soaked, and up the path the troll is back to swinging his ' +
    'club as if nothing happened.'
  );
}

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
  revive: 500,
  riddle: 150,
  trap: -150,
  screen: 50,
  home: 200,
  deceive: 100,
  duel: 150,
  tame: 100,
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

type Ladder = readonly (readonly [number, string])[];

const RANKS: Ladder = [
  [2400, 'The One'],
  [1400, 'Fearless Wayfinder'],
  [800, 'Seeker'],
  [300, 'Wanderer'],
  [-Infinity, 'Sleepwalker'],
];

// with both of them dead the castle needs a keeper, and the ranks follow the darker road
const KEEPER_RANKS: Ladder = [
  [1600, 'The Keeper'],
  [1000, 'Dragonbane'],
  [600, 'Slayer'],
  [300, 'Brute'],
  [-Infinity, 'Butcher'],
];

export const bothDead = (w: World): boolean => w.isDead('dragon') && w.isDead('troll');

const ladder = (w?: World): Ladder => (w && bothDead(w) ? KEEPER_RANKS : RANKS);

// the rank as a level, counted from the bottom of the ladder
export function rankInfo(score: number, w?: World): RankInfo {
  const ranks = ladder(w);
  const i = ranks.findIndex(([min]) => score >= min);
  return { name: ranks[i]![1], level: ranks.length - i, of: ranks.length };
}

export const scoreLine = (w: World, turns = w.state.turns): string =>
  `Your score is ${w.state.score}, in ${turns} turns. ` +
  `Rank: ${rankInfo(w.state.score, w).name}.`;

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
  // only a sleeping dragon can be killed: beaten awake in the duel, he is tamed instead
  w.say(
    'He did not even wake up. He was thinner than he looked, and he lay with his head ' +
      'turned toward the door, as if he still waited for someone. His stomach makes one ' +
      'last hollow sound. You find that you are not as proud of this as you expected.',
  );
  w.say(
    `Your ${name} is stuck fast in the dragon. You pull until your arms shake. They go on ` +
      `shaking afterwards. The ${name} stays where it is.`,
  );
  w.move(weapon, 'nowhere');
  w.say('The passageway leading to the east opens up.');
  if (trollFriend(w)) {
    w.say(
      'Out in the garden, the troll stops practising his words. For a long time you hear ' +
        'nothing from him at all.',
    );
  }
  if (w.isDead('troll')) killedBoth(w);
}

function killedTroll(w: World): void {
  if (dragonAsleep(w)) {
    w.lose(
      'The troll falls, and the sound of it rolls down the path, through the archway and into ' +
        'the castle. ' +
        'In there, something stops snoring. You have just enough time to remember the dragon ' +
        'you tiptoed past, and to understand that you never really got past him. He arrives all ' +
        'at once. He is not interested in a conversation.',
    );
    return;
  }
  w.addScore(POINTS.kill);
  if (w.flag('trollFought')) {
    w.say(
      'He lies down in the grass with his face toward the castle, as if he meant to go home ' +
        'that way. Your voice is still your own, yet you find no word to say over him.',
    );
  } else {
    w.say(
      'You open your mouth to say something over the body: a joke, a word, anything. Nothing ' +
        "comes out. You try again. Your voice is gone. It went wherever the troll's went.",
    );
  }
  if (dragonFriend(w)) {
    w.say(
      `A shadow crosses the ${w.here === 'gazebo' ? 'gazebo' : 'garden'}. The dragon lands ` +
        'badly, like something that has not flown in years, and looks at the troll for a long ' +
        'time.' +
        (w.locationOf('scale') === 'nowhere'
          ? ' He holds out one claw, and then lets it fall.'
          : ' He holds out one claw for the scale. You give it back because there is nothing ' +
            'else to do.') +
        ' "He grew the turnips," he says, and goes back into the castle without a look at you.',
    );
    w.move('scale', 'nowhere');
    w.setFlag('dragonEstranged');
  }
  if (w.isDead('dragon')) killedBoth(w);
  if (w.here === 'garden') w.say('It seems you can now walk about in the garden freely.');
}

// the second of them falls, and the castle is left without a keeper
function killedBoth(w: World): void {
  w.say(
    'So both have fallen, the old worm in his cell and the gardener in the grass. A great ' +
      'stillness settles upon the castle, and upon you also. Your arms tremble. None now ' +
      'remain to keep this house.',
  );
}

// ---- the ending ----------------------------------------------------------------

// runs when the player reaches the forest, the room text has already been shown
export function ending(w: World): void {
  w.addScore(POINTS.home);
  if (bothDead(w)) keeperEnding(w);
  else homeEnding(w);
  // the move into the forest is still being taken, and only counts once it ends
  w.say(scoreLine(w, w.state.turns + 1));
  if (w.flag('sawScreen')) w.say('Somewhere, a computer stops humming.');
  w.win();
}

// the darker road: with the dragon and the troll both gone, you go back to keep the castle
function keeperEnding(w: World): void {
  w.say('You look upon the faces, and you know them all. Two are missing from among them.');
  remember(w);
  w.say(
    'None bids you go, yet you know that the castle must have a keeper. So you turn back, and ' +
      "cross the river, and go in under the portcullis and down the stair. In the keeper's " +
      'quarters the coat behind the door fits you well. You open the ledger where the entries ' +
      'end, and beneath them you write a single word: Waiting.',
  );
  w.say(
    'The great bowl stands empty by the door, and no step comes down the stair. The waiting is ' +
      'yours now, and it has no end.',
  );
  w.say('Bravo! You beat the game, by the darker road.', 'win');
}

function homeEnding(w: World): void {
  const dDead = w.isDead('dragon');
  const tDead = w.isDead('troll');

  w.say('You look at the faces, and you know them all. Every face here is a face of yours.');

  // the strength
  if (dDead) {
    w.say(
      'There is an empty place by the fire. A child runs up and holds out her arms, and yours ' +
        'will not lift. They shake, the way they did over the dragon.',
    );
  } else if (w.flag('dragonEstranged')) {
    w.say(
      'A very tall one, with smoke in his breath, sits on the far side of the fire and keeps ' +
        'the fire between you.',
    );
  } else if (w.flag('dragonRevived')) {
    w.say(
      'A very tall one stands apart, with a cracked scale on a string around his neck. He ' +
        'looks at you a long while, and then he comes over anyway.',
    );
  } else if (w.flag('dragonDueled')) {
    w.say(
      'A very tall one wears a scorched scale on a string around his neck. He tells everyone ' +
        'how you came at him armed and laid your weapon down. By the second telling, the ' +
        'weapon is bigger.',
    );
  } else if (w.flag('dragonFooled')) {
    w.say(
      'A very tall one with smoke in his breath does not mention the keeper all evening, and ' +
        'neither do you. Once, he catches your eye, and very nearly smiles.',
    );
  } else if (dragonTamed(w)) {
    w.say(
      'A very tall one with a long scar upon his neck lies down at your feet, and all evening ' +
        'he keeps the cold from your back.',
    );
  } else if (w.flag('dragonFriend')) {
    w.say(
      'A very tall one with smoke in his laugh lifts you off the ground with one arm, to show ' +
        'that he can, and to show that you are worth lifting.',
    );
  } else {
    w.say(
      'Everyone is here except one. Now and then the fire gutters, as if something far off ' +
        'had turned over in its sleep.',
    );
  }

  // he heard it from you that the keeper was not coming back
  if (!dDead && w.flag('keeperTold')) {
    w.say(
      'Someone has made a bed by the fire, with a cup beside it. The tall one looks at it a ' +
        'long while, and then comes and sits with the rest of you.',
    );
  }

  // the voice
  if (tDead && mute(w)) {
    w.say(
      'There is an empty place by the fire. They speak to you, and you open your mouth to ' +
        'answer, and nothing comes out. They wait kindly for a long time, and then they stop ' +
        'waiting.',
    );
  } else if (tDead) {
    // beaten in a fair fight: the voice is yours, and so is what you did with it
    w.say(
      'There is an empty place by the fire. They ask you who used to sit there. You have the ' +
        'voice to tell them, and you look into the fire a long time before you do.',
    );
  } else if (w.flag('trollRevived')) {
    w.say(
      'One of them has a broken tooth, and is a little shy of you. When you say you are sorry, ' +
        'out loud, he nods, and makes a place for you.',
    );
  } else if (w.flag('trollForgave') && w.flag('trollFriend')) {
    w.say(
      'One of them has a broken tooth, and keeps a hand near his mouth. When you speak to him, ' +
        'he lowers the hand, and does not cover the tooth again all evening.',
    );
  } else if (w.flag('trollForgave')) {
    // forgiven, but never shown his face, so he never found his voice
    w.say(
      'One of them has a broken tooth, and sits beside you with his hand over his mouth. ' +
        'Nobody ever showed him his own face.',
    );
  } else if (w.flag('trollHurt') && !w.flag('trollFriend')) {
    // the cruel word was never taken back
    w.say(
      'One of them has a broken tooth, and sits at the edge of the firelight all evening with ' +
        'a hand over his mouth. You know what you said, and you have not unsaid it.',
    );
  } else {
    w.say(
      'One of them has a broken tooth. He starts to cover it, remembers, and takes the hand ' +
        'away. "Booga hoom," he says, loud enough for the whole forest, and you say it back.',
    );
  }

  remember(w);
  w.say(verdict(w));
  w.say('Bravo! You beat the game!', 'win');
}

// the more you looked at the more you remember
function remember(w: World): void {
  const found = fragments(w);
  if (found >= 3) {
    // the potion has just told you about the candle and the bolt
    w.say(
      (w.flag('potionDrunk')
        ? ''
        : 'And then you remember, the way you remember a word. The candle, and your own hands ' +
          'lighting it. The bolt, and your own hand drawing it. ') +
        'You shut yourself in the crypt, to find out who would come out.',
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
}

function verdict(w: World): string {
  if (mute(w)) {
    return (
      'You passed the test, in conflict with yourself. You chose your strength over your ' +
      'voice. One day you will want to talk about it.'
    );
  }
  if (w.isDead('troll')) {
    return (
      'You passed the test, by a hard road. You kept your voice and your strength, and one ' +
      'day you will want to tell someone what they cost.'
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
    w.flag('dragonTamed') ||
    w.flag('trollForgave')
  ) {
    return (
      'You passed the test. You came home whole, with a scar. The scar is the part you are ' +
      'proudest of.'
    );
  }
  return 'You passed the test. You came home whole.';
}
