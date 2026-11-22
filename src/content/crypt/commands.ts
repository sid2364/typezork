import { describeThing, enter, go } from '../../engine/commands';
import type { CommandContext, CommandDef } from '../../engine/commands/types';
import type { ThingId } from '../../engine/types';
import type { World } from '../../engine/world';
import {
  apologiseToTroll,
  challengeDragon,
  feedDragon,
  fetchForSkeleton,
  giveScale,
  keeperNewsPending,
  keeperProof,
  tellKeeper,
  revisitDecisions,
  showMirror,
  talkToSkeleton,
  talkToGrievingTroll,
  talkToSleepingDragon,
  talkToTroll,
} from './dialogue';
import {
  dragonAsleep,
  dragonBlocks,
  dragonDoubts,
  dragonFriend,
  MUTE,
  mute,
  POINTS,
  rememberAll,
  scoreLine,
  skeletonBeaten,
  skeletonClue,
  skeletonFetched,
  skeletonTalked,
  trollFriend,
  trollGrieves,
  trollSulks,
  weak,
  worthyWeapon,
} from './story';

type Joke = string | ((w: World) => string);

// a command that just answers with a joke
const quip = (id: string, verbs: string[], text: Joke): CommandDef => ({
  id,
  verbs,
  meta: true,
  run: ({ w }) => w.say(text),
});

// a joke you need a voice for
const spoken = (id: string, verbs: string[], text: Joke): CommandDef =>
  quip(id, verbs, (w) => (mute(w) ? MUTE : w.text(text)));

// words that answer the riddle of the stream
const FIRE = new Set(['fire', 'fires', 'flame', 'flames', 'torch', 'blaze']);
const SPEAK = ['answer', 'say', 'reply', 'respond', 'tell'];
// saying the answer on its own is answering too
const BARE = ['fire', 'flame', 'flames'];

// the stream only parts if you really have a flame
function partStream(w: World, said: boolean): void {
  if (w.flag('streamParted')) {
    w.say('The stream has already let you pass. Its waters stay parted to the south.');
    return;
  }
  if (!w.has('torch')) {
    w.say(`"Fire, yes," the stream burbles, "but words don't burn." The water rushes on.`, 'error');
    return;
  }
  w.say(
    (said
      ? '"Fire," you say, and hold out the torch. '
      : 'You hold the torch out over the stream. ') +
      'The water in the river bends and parts. You see how deep the river bed is without the ' +
      'water there. The way south is clear.',
  );
  w.say(
    'For a moment you hear the riddle in another voice, a slower one, by a fire, from when ' +
      'you were small enough to be carried.',
  );
  w.setFlag('streamParted', true);
  w.award('riddle', POINTS.riddle);
}

// the stream at the portcullis asks a riddle and the answer is fire
const answerRiddle: CommandDef = {
  id: 'answer',
  verbs: [...SPEAK, ...BARE],
  run({ w, cmd }) {
    const words = BARE.includes(cmd.verb) ? [cmd.verb, ...cmd.args] : [...cmd.args];
    if (words.length === 0) {
      w.say(`${cmd.verb[0]!.toUpperCase()}${cmd.verb.slice(1)} what?`, 'error');
      return;
    }
    if (mute(w)) {
      w.say(
        MUTE +
          (w.here === 'portcullis' && !w.flag('streamParted')
            ? ' The stream waits. It does not need to hear you. It needs to see something.'
            : ''),
      );
      return;
    }
    if (w.here !== 'portcullis') {
      w.say(`You say "${words.join(' ')}" to nobody in particular. Nobody answers.`);
      return;
    }
    if (w.flag('streamParted') || words.some((t) => FIRE.has(t))) {
      partStream(w, true);
      return;
    }
    w.say(
      `"${words.join(' ')}?" The stream gurgles. That is not the answer it was looking for.`,
      'error',
    );
  },
};

// ---- give, show, feed, use -----------------------------------------------------

// what a thing is for when the player does not say who gets it
function usualTarget(w: World, thing: ThingId): ThingId | undefined {
  const here = (id: ThingId) => w.locationOf(id) === w.here;
  if (thing === 'mutton' && here('dragon')) return 'dragon';
  if (thing === 'torch' && here('stream')) return 'stream';
  if ((thing === 'scale' || thing === 'mirror') && here('troll')) {
    return 'troll';
  }
  if (thing === 'scroll' && here('dragon')) return 'dragon';
  if (thing === 'bone' && here('skeleton')) return 'skeleton';
  return undefined;
}

function giveToSkeleton(w: World, thing: ThingId): void {
  if (thing !== 'bone') {
    w.say(`The skeleton has no use for the ${w.thing(thing).name}.`);
  } else if (skeletonFetched(w)) {
    w.say('The skeleton looks at the bone. Its finger bones twitch. "No," it says firmly.');
  } else if (skeletonBeaten(w)) {
    w.say('The skeleton eyes the bone. "I know what you are doing," it says.');
  } else {
    fetchForSkeleton(w);
  }
}

function giveToDragon(w: World, thing: ThingId): void {
  const name = w.thing(thing).name;
  if (w.isDead('dragon')) {
    w.say(
      thing === 'scroll'
        ? 'The dragon cannot read. The scroll is for you to read.'
        : `The dragon is past caring about the ${name}. You made sure of that.`,
    );
  } else if (thing === 'mutton') {
    feedDragon(w);
  } else if (thing === 'turnip') {
    w.say(
      dragonAsleep(w)
        ? 'You hold the turnip under the nose of the dragon. He does not stir.'
        : 'The dragon sniffs the turnip. "Is it mutton?" he asks. It is not.',
    );
  } else if (dragonFriend(w)) {
    w.say(`The dragon looks at the ${name} politely. "Is it mutton?" he asks. It is not mutton.`);
  } else if (thing === 'bone') {
    w.say(
      'You hold the bone under the nose of the dragon. He sniffs in his sleep, and his whole ' +
        'face falls. There is no meat on it. The dragon is not a dog, but he does know what ' +
        'dinner is.',
    );
  } else {
    w.say(`The dragon sleeps on. Whatever he dreams of, it is not the ${name}.`);
  }
}

function giveToTroll(w: World, thing: ThingId): void {
  const name = w.thing(thing).name;
  if (w.isDead('troll')) {
    w.say(`The troll is past caring about the ${name}. You made sure of that.`);
  } else if (thing === 'turnip') {
    w.say('The troll pushes it back to you. "You," he says. "For you."');
  } else if (trollFriend(w)) {
    w.say(`The troll looks at the ${name} and says its name out loud, slowly, with great pride.`);
  } else if (trollGrieves(w) && !w.flag('trollToldTruth')) {
    // he will look at nothing you hold up until you tell him who killed his friend
    w.say(`The troll knocks the ${name} aside. "Who?" he says.`);
  } else if (thing === 'mirror' || thing === 'scale') {
    showMirror(w, thing);
  } else if (thing === 'flower') {
    w.say('You present the troll with a flower. He sniffs it, sneezes, and looks at you sadly.');
  } else if (thing === 'bone' || thing === 'mutton') {
    w.say(
      `You offer the troll the ${name}. He looks deeply offended. Trolls are vegetarian, apparently.`,
    );
  } else {
    w.say(
      `The troll looks at the ${name}. "Nub," he says behind his hand. He makes a small ` +
        'square in the air with two fingers, and points at his own face.',
    );
  }
}

const giveCommand: CommandDef = {
  id: 'give',
  verbs: [
    'give',
    'offer',
    'show',
    'feed',
    'hand',
    'throw',
    'present',
    'use',
    'wave',
    'hold up',
    'hold',
    'raise',
    'pour',
  ],
  help: { usage: 'give mutton to dragon', summary: 'Give or show something to someone.' },
  run(ctx) {
    const { w, cmd } = ctx;
    if (cmd.direct.length === 0) {
      w.say(`${cmd.verb[0]!.toUpperCase()}${cmd.verb.slice(1)} what?`, 'error');
      return;
    }
    // feed dragon and feed dragon with mutton name the eater first
    let what = cmd.direct;
    let whom = cmd.indirect;
    if (cmd.verb === 'feed' && (cmd.indirect.length === 0 || cmd.prep === 'with')) {
      whom = cmd.direct;
      what = cmd.indirect;
      if (what.length === 0) {
        const food = ['mutton', 'bone', 'flower'].find((id) => w.has(id));
        if (!food) {
          w.say('You have nothing that anyone would call food.', 'error');
          return;
        }
        what = [w.thing(food).name];
      }
    }
    const thing = ctx.resolve(what, {
      scope: w.inventory(),
      notFound: `You are not carrying any ${what.join(' ')}.`,
    });
    if (!thing) return;
    const target = whom.length ? ctx.resolve(whom) : usualTarget(w, thing);
    if (whom.length && !target) return;

    if (target === 'dragon') giveToDragon(w, thing);
    else if (target === 'troll') giveToTroll(w, thing);
    else if (target === 'skeleton') giveToSkeleton(w, thing);
    else if (target === 'stream') {
      if (thing === 'torch') partStream(w, false);
      else w.say('The stream rushes past, unimpressed.', 'error');
    } else if (target === 'duck') {
      w.say('The duck accepts nothing. It only listens.');
    } else if (target) {
      w.say(`${w.the(target).replace(/^./, (c) => c.toUpperCase())} has no use for it.`);
    } else if (thing === 'torch') {
      w.say('You wave the torch about. It crackles cheerfully.');
    } else if (thing === 'potion') {
      w.say('Nobody else can drink this for you.');
    } else {
      w.say(`You wave the ${w.thing(thing).name} about. Nothing happens.`);
    }
  },
};

// ---- talk ----------------------------------------------------------------------

function talkTo(w: World, target: ThingId): void {
  if (target === 'skeleton') {
    if (skeletonBeaten(w)) {
      w.say('"Go on," says the skeleton. "And come back with all your bones."');
    } else if (!skeletonTalked(w)) {
      talkToSkeleton(w);
    } else {
      w.say(
        skeletonClue(w)
          ? '"Enough talk," says the skeleton. "Fists up. Fight me."'
          : '"I have said my piece," says the skeleton. "Now look closer. Examine me. Then put ' +
              'your fists up."',
      );
    }
  } else if (target === 'dragon') {
    if (w.isDead('dragon')) {
      w.say('The dragon does not answer. It is the kind of silence that you made yourself.');
    } else if (dragonAsleep(w) && !w.flag('dragonAsked')) {
      talkToSleepingDragon(w);
    } else if (dragonAsleep(w)) {
      w.say(
        '"Hello?" you say. The dragon does not wake. "...keeper?..." he mumbles in his sleep. ' +
          'Then his stomach answers for him: a long, hollow sound. "...mutton..." says the ' +
          'dragon, and sighs a little smoke.',
      );
    } else if (dragonDoubts(w)) {
      keeperProof(w);
    } else if (dragonBlocks(w)) {
      if (worthyWeapon(w)) {
        w.say('"Ah," says the dragon, and gets up. "Now you have something to fight with."');
        challengeDragon(w);
      } else {
        w.say('"Come back with a worthy weapon," says the dragon. His tail does not move.');
      }
    } else if (!w.flag('scaleGiven') && !w.flag('dragonFooled')) {
      w.say('"Ah," says the dragon. "Where were we? I was about to give you something."');
      giveScale(w);
    } else if (keeperNewsPending(w) && !w.flag('dragonEstranged')) {
      w.say('You tell the dragon about the room at the bottom of the stairs.');
      tellKeeper(w);
    } else if (w.flag('dragonEstranged')) {
      w.say(
        'The dragon turns his back to you. "You feed me," he says to the wall. "Then you do ' +
          'that. Which one is really you?"',
      );
    } else if (w.flag('dragonRevived')) {
      w.say('"I am still deciding about you," says the dragon. "But you may sit, while I decide."');
    } else if (w.flag('dragonFooled')) {
      w.say('"I am no fool," says the dragon, without opening his eyes. "Carry on."');
    } else if (w.flag('keeperTold')) {
      w.say('"Still here," says the dragon. "I have nobody to wait for. It is a strange feeling."');
    } else {
      w.say('"Still here," says the dragon. "Still waiting. It is easier with company."');
    }
  } else if (target === 'troll') {
    if (w.isDead('troll')) {
      w.say('The troll does not answer.');
    } else if (trollGrieves(w)) {
      talkToGrievingTroll(w);
    } else if (w.flag('trollRevived')) {
      w.say('"Hello," says the troll, carefully. He does not come closer.');
    } else if (trollSulks(w)) {
      apologiseToTroll(w);
    } else if (trollFriend(w) && w.isDead('dragon')) {
      w.say('The troll looks west, through the archway. "Him sleep," he says. "Long sleep."');
    } else if (trollFriend(w)) {
      w.say('"HELLO," says the troll, with all of his mouth. He is still very proud of the word.');
    } else if (!w.flag('trollAsked') && !w.flag('trollHurt')) {
      talkToTroll(w);
    } else {
      w.say(
        '"Ooga wug zug mog," the troll says hiding his face behind one huge hand.' +
          ' "Grak nub." He points at the hand over his mouth, and looks away.',
      );
    }
  } else if (target === 'duck') {
    w.say(
      'You explain your whole situation to the duck. It listens without interrupting. By the ' +
        'end, you understand your problem a little better. The duck takes no credit.',
    );
  } else if (target === 'stream') {
    w.say(
      w.flag('streamParted')
        ? 'The stream has said all it wanted to say.'
        : 'The stream says it again, patiently: "It eats many things; it fears me but not the ' +
            'wind. But give me enough and I will subside momentarily."',
    );
  } else if (target === 'candle') {
    w.say('You talk to the candle. It flickers in all the right places. A good listener.');
  } else {
    w.say(`You talk to ${w.the(target)}. It has nothing to add.`);
  }
}

const talkCommand: CommandDef = {
  id: 'talk',
  verbs: ['talk', 'speak', 'chat', 'greet'],
  help: { usage: 'talk to troll', summary: 'Talk to someone.' },
  run(ctx) {
    const { w, cmd } = ctx;
    const words = cmd.indirect.length ? cmd.indirect : cmd.direct;
    let target: ThingId | undefined;
    if (words.length === 0) {
      const creatures = w.thingsAt(w.here).filter((id) => w.thing(id).kind === 'creature');
      if (creatures.length !== 1) {
        w.say('Talk to whom?', 'error');
        return;
      }
      target = creatures[0];
    } else {
      target = ctx.resolve(words, { notFound: `There is no ${words.join(' ')} here to talk to.` });
    }
    if (!target) return;
    if (mute(w)) {
      w.say(
        target === 'duck'
          ? 'You look at the duck. The duck looks at you. For once, you are equally quiet.'
          : MUTE,
      );
      return;
    }
    talkTo(w, target);
  },
};

// ---- reading and mixing --------------------------------------------------------

const readCommand: CommandDef = {
  id: 'read',
  verbs: ['read', 'recite', 'chant', 'read aloud'],
  run(ctx: CommandContext) {
    const { w, cmd } = ctx;
    if (cmd.direct.length === 0) {
      w.say('Read what?', 'error');
      return;
    }
    const id = ctx.resolve(cmd.direct);
    if (!id) return;
    if (id !== 'scroll' || !w.has('scroll')) {
      describeThing(w, id);
      return;
    }
    if (!w.isDead('dragon') && !w.isDead('troll')) {
      w.say(
        'You read the first line aloud. The words hang in the air, look around for someone to ' +
          'call back, and find no one. They settle back onto the page. You have not sent anyone ' +
          'away.',
      );
      return;
    }
    revisitDecisions(w);
  },
};

// the recipe wants a flower, a bone and something iron: any metal weapon will do
const INGREDIENTS = ['flower', 'bone'] as const;
const IRON = ['sword', 'spear', 'hammer'] as const;

const mixCommand: CommandDef = {
  id: 'mix',
  verbs: ['mix', 'brew', 'grind', 'make', 'prepare', 'craft'],
  run({ w }) {
    if (w.locationOf('potion') !== 'nowhere' || w.flag('potionDrunk')) {
      w.say('You have made the only potion you know how to make.');
      return;
    }
    if (!w.has('parchment')) {
      w.say('You do not know how to make anything. You would need a recipe.', 'error');
      return;
    }
    if (weak(w)) {
      w.say(
        'You smooth the page out to read the recipe. Your hands shake just holding it. Grinding ' +
          'bone and working iron would take strong hands. Yours stayed with the dragon.',
        'error',
      );
      return;
    }
    const iron = IRON.find((id) => w.has(id));
    const missing = [
      ...INGREDIENTS.filter((id) => !w.has(id)).map((id) => `the ${w.thing(id).name}`),
      ...(iron ? [] : ['anything made of iron']),
    ];
    if (missing.length) {
      w.say(
        `The recipe wants a flower, a bone and some iron. You do not have ${missing.join(' or ')}.`,
        'error',
      );
      return;
    }
    for (const id of [...INGREDIENTS, iron!]) w.move(id, 'nowhere');
    w.move('potion', 'inventory');
    w.markMoved('potion');
    w.say(
      `You grind the bone to powder between two stones, with your own two hands. You add the ` +
        `flower, and then scrape the ${w.thing(iron!).name} against the stones until the powder ` +
        `turns the colour of rust. The ${w.thing(iron!).name} is no use to anyone after that. You ` +
        `now have a potion. It smells better than it looks.`,
    );
  },
};

// the potion of remembering gives back every memory you have not found yet
const drinkCommand: CommandDef = {
  id: 'drink',
  verbs: ['drink', 'sip', 'quaff'],
  run({ w }) {
    if (!w.has('potion')) {
      w.say('There is nothing here that you would trust in a cup.');
      return;
    }
    w.move('potion', 'nowhere');
    w.setFlag('potionDrunk');
    if (rememberAll(w) === 0) {
      w.say(
        'You drink the potion. It tastes of old paper. Nothing new comes back. You already ' +
          'remember everything.',
      );
      return;
    }
    w.say(
      'You drink the potion. It tastes of old paper, then of nothing, then of a room you have ' +
        'not stood in for a very long time.',
    );
    w.say(
      'It comes back the way a word comes back. A candle, and your own hands lighting it. A ' +
        'door, and your own hand drawing the bolt. Runes on a wall that you can read, because ' +
        'you wrote them. Clear water, and a reflection you did not know. And a face in a glass, ' +
        'with lines painted under its eyes. You remember it all at once. This was a rite of ' +
        'passage, a test you set yourself, to see what sort of person you have become.',
    );
  },
};

const sneakCommand: CommandDef = {
  id: 'sneak',
  verbs: ['sneak', 'tiptoe', 'creep'],
  run({ w }) {
    if (w.here === 'dragonCell') go(w, 'east');
    else w.say('You tiptoe on the spot. Very stealthy. Nobody is impressed.');
  },
};

const wearCommand: CommandDef = {
  id: 'wear',
  verbs: ['wear', 'put on'],
  meta: true,
  run(ctx) {
    const { w, cmd } = ctx;
    const id = cmd.direct.length ? ctx.resolve(cmd.direct) : undefined;
    if (!cmd.direct.length) w.say('Wear what?', 'error');
    if (!id) return;
    if (id !== 'boots') w.say(`You cannot wear ${w.the(id)}. You did try.`);
    else if (w.has('boots')) w.say('You already wear them. They are very quiet about it.');
    else w.say('Take them first.');
  },
};

const scoreCommand: CommandDef = {
  id: 'score',
  verbs: ['score', 'points', 'rank'],
  meta: true,
  allowWhenOver: true,
  help: { usage: 'score', summary: 'Show your score and turns.' },
  run: ({ w }) => w.say(scoreLine(w)),
};

// there is no place like it
const homeCommand: CommandDef = {
  id: 'home',
  verbs: ['home', 'go home'],
  run({ w }) {
    if (w.here !== 'devRoom') {
      w.say('Not yet.');
      return;
    }
    w.say("There's no place like it. The screens flicker, and so do you.");
    enter(w, 'start', null);
  },
};

export const commands: CommandDef[] = [
  answerRiddle,
  giveCommand,
  talkCommand,
  readCommand,
  mixCommand,
  drinkCommand,
  sneakCommand,
  wearCommand,
  scoreCommand,
  homeCommand,
  spoken(
    'xyzzy',
    ['xyzzy', 'plugh', 'abracadabra'],
    'A hollow voice says "Fool." Wrong game, I\'m afraid.',
  ),
  quip(
    'jump',
    ['jump', 'hop'],
    'You jump on the spot. Nothing happens, but you feel a little better.',
  ),
  spoken(
    'sing',
    ['sing', 'hum', 'whistle'],
    'You sing a few bars. Somewhere in the dark, something sighs.',
  ),
  quip('dance', ['dance'], 'You dance like nobody is watching. Somebody is probably watching.'),
  quip(
    'sleep',
    ['sleep', 'nap'],
    'This is no place for a nap. Something around here snores louder than you.',
  ),
  spoken('pray', ['pray'], 'You pray. Nobody answers, but nobody tells you off either.'),
  spoken(
    'shout',
    ['shout', 'yell', 'scream'],
    'Your voice echoes back at you, sounding slightly mocking.',
  ),
  spoken(
    'hello',
    ['hello', 'hi', 'hey'],
    "Hello to you too. The walls don't answer, but they look friendly enough.",
  ),
  spoken(
    'swear',
    ['swear', 'curse', 'damn', 'fuck', 'shit'],
    'Such language! Somewhere, a candle flickers disapprovingly.',
  ),
  quip('swim', ['swim'], (w) =>
    w.here === 'river'
      ? 'The current would carry you straight back past the castle. Not the plan.'
      : "There's nothing to swim in here. You do a few strokes in the air anyway.",
  ),
  {
    id: 'eat',
    verbs: ['eat', 'lick', 'taste'],
    meta: true,
    run(ctx) {
      const { w, cmd } = ctx;
      if (cmd.direct.length === 0) {
        w.say("You're not that hungry. Adventure first, snacks later.");
        return;
      }
      const id = ctx.resolve(cmd.direct);
      if (!id) return;
      const jokes: Record<string, string> = {
        bone: 'You gnaw on the bone thoughtfully. It tastes of regret.',
        mutton:
          'You take one bite. It is excellent. You have the feeling that something nearby ' +
          'would enjoy it even more than you.',
        potion: 'It is not for you. Well. It is, a little. But not like that.',
        flower: 'You nibble a petal. Floral, with notes of poor decision-making.',
        candle: 'You lick the candle. Waxy. You are not proud of this.',
        dragon: 'The dragon is, if anything, more likely to eat you.',
        troll: 'You would need a very large fork and a very strong stomach.',
        duck: 'You bite the rubber duck. It squeaks reproachfully.',
        skeleton: 'There is nothing left on it to eat. Someone got there first.',
      };
      w.say(jokes[id] ?? `You'd rather not eat ${w.the(id)}.`);
    },
  },
  {
    id: 'smell',
    verbs: ['smell', 'sniff'],
    meta: true,
    run(ctx) {
      const { w, cmd } = ctx;
      if (cmd.direct.length === 0) {
        w.say('You smell damp stone, old smoke and, faintly, adventure.');
        return;
      }
      const id = ctx.resolve(cmd.direct);
      if (!id) return;
      const smells: Record<string, string> = {
        flower: 'The sweet, exotic scent of the flower fills your senses. Lovely.',
        troll: 'Wet sock. Definitely wet sock.',
        dragon: 'Sulphur, smoke, and a hint of the last adventurer.',
        torch: 'Smoke. And, oddly, the sea.',
        bone: "You'd rather not, actually.",
        mutton:
          'Salt, smoke and rosemary. Your stomach makes a sound. Something else makes a bigger one.',
        boots: 'Felt, dust and, very faintly, dragon.',
        skeleton: 'Dust and candle smoke. It smells, you realise, a lot like you.',
      };
      w.say(smells[id] ?? `${w.the(id).replace(/^./, (c) => c.toUpperCase())} smells of dust.`);
    },
  },
];
