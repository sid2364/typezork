// what players say to the characters as if they were people: "can we be friends", "is he my
// dad", "lol". none of it is a command, so the one it is said to answers in its own voice.
// banter is only flavour: it takes no turn and changes nothing in the story
import type { Banter } from '../../engine/definitions';
import { resolveNoun } from '../../engine/parser/resolve';
import type { ThingId } from '../../engine/types';
import type { World } from '../../engine/world';
import {
  dragonAsleep,
  MUTE,
  mute,
  skeletonBeaten,
  skeletonFetched,
  trollFriend,
  trollGrieves,
  trollSulks,
} from './story';

type Line = string | ((w: World) => string);

interface Topic {
  // any one of these words is enough
  readonly words: readonly string[];
  // or any one of these runs of words
  readonly phrases?: readonly string[];
  // what the player does, for the ones with nothing of their own to say: "You ask {the} …"
  readonly act: (the: string) => string;
  readonly nobody: string;
  // the skeleton before the fight, and after it
  readonly guard: string;
  readonly beaten: string;
  readonly dragon?: string;
  readonly troll?: Line;
}

const TOPICS = {
  friend: {
    words: [
      'friend',
      'friends',
      'befriend',
      'buddy',
      'buddies',
      'pal',
      'pals',
      'bestie',
      'hug',
      'cuddle',
    ],
    phrases: ['high five'],
    act: (the) => `You ask ${the} to be your friend.`,
    nobody:
      'You ask the empty room to be your friend. It says nothing, and you decide to take that ' +
      'as a maybe.',
    guard:
      "The skeleton's jaw hangs open a moment, and then it points one long finger at the bone " +
      'pile. "Every one of them asked me that," it says. "I keep them all close by."',
    beaten:
      '"You knocked my jaw across the floor," says the skeleton, "and I have not laughed so ' +
      'hard in four hundred years. Friends, then." It holds out a bony hand, and you shake it, ' +
      'and it holds on a little longer than you would like.',
    dragon:
      '"We have shared a leg of mutton," says the dragon. "Among dragons, that makes us ' +
      'friends for a hundred years at the least."',
    troll: (w) =>
      trollFriend(w)
        ? '"Friend," says the troll, proud of the word, and thumps you on the shoulder, and you ' +
          'sit down in the grass rather suddenly.'
        : 'The troll looks at you over his hand for a long while. Then he holds out the other ' +
          'one, which is the size of your head, and shakes yours very carefully.',
  },
  family: {
    words: [
      'dad',
      'daddy',
      'father',
      'papa',
      'mom',
      'mum',
      'mother',
      'mommy',
      'mummy',
      'parent',
      'parents',
      'brother',
      'sister',
      'son',
      'daughter',
      'uncle',
      'aunt',
      'grandpa',
      'grandma',
      'grandfather',
      'grandmother',
      'family',
      'related',
    ],
    act: (the) => `You ask ${the} whether the two of you are related.`,
    nobody:
      'You ask the empty room about your family. Nobody here remembers them, and for a moment ' +
      'you are not sure you do either.',
    guard:
      'The skeleton tilts its skull and looks you up and down for a long while. "There is ' +
      'something about the jaw," it says at last, "but I do not remember having children, and ' +
      'I will not start with one who wants my door."',
    beaten:
      'The skeleton looks at you a long while with its skull on one side. "Go home," it says, ' +
      'quite gently. "Whoever is waiting there for you has waited long enough."',
    dragon:
      '"I am older than this castle and made mostly of fire," says the dragon. "If you were ' +
      'one of mine, you would have noticed by now."',
    troll:
      'The troll counts on his fingers, and gets as far as four, and gives up. "Nub," he says.',
  },
  love: {
    words: [
      'love',
      'marry',
      'kiss',
      'crush',
      'date',
      'boyfriend',
      'girlfriend',
      'husband',
      'wife',
      'cute',
      'handsome',
      'pretty',
      'gorgeous',
    ],
    act: (the) => `You make eyes at ${the}.`,
    nobody: 'You declare your love to the empty room. The echo says it back, which is a start.',
    guard:
      '"I have not had lips for a very long time," says the skeleton, "and I will not grow ' +
      'them back for you. Step away from the door."',
    beaten:
      'The skeleton lays a bony hand on its ribs, where its heart used to be. "You have a fine ' +
      'right hook," it says, "and that is the sweetest thing anyone has done for me in an age. ' +
      'But I am spoken for. The door and I go back a long way."',
    dragon:
      'The dragon lets out a long, slow puff of smoke that goes pink at the edges. "You are ' +
      'very small," he says, "and I am very old, and I think we had better stay friends."',
    troll: (w) =>
      `The troll goes a darker green${trollFriend(w) ? '' : ' behind his hand'}, and looks very ` +
      'hard at the flowers.',
  },
  name: {
    words: ['name', 'names', 'called'],
    act: (the) => `You ask ${the} for a name.`,
    nobody: 'You ask the empty room its name. The room keeps it to itself.',
    guard:
      '"I had one once," says the skeleton. "It is somewhere in that pile, with the ones who ' +
      'asked."',
    beaten:
      '"I have been trying to remember it ever since you knocked my jaw loose," says the ' +
      'skeleton. "It began with a B, I think. Or a G."',
    dragon:
      '"My name takes a week to say," says the dragon, "and you would burn your tongue on the ' +
      'middle of it."',
    troll: (w) =>
      trollFriend(w)
        ? '"Troll," says the troll, and points at himself, very pleased.'
        : 'The troll tries to tell you, but his hand is over his mouth, and all you hear is ' +
          '"Mmf."',
  },
  mood: {
    words: ['lonely', 'sad', 'happy', 'bored', 'tired'],
    phrases: [
      'how are you',
      "how're you",
      'how do you feel',
      'are you okay',
      'are you ok',
      'are you alright',
      'you okay',
      'you ok',
      'you alright',
    ],
    act: (the) => `You ask ${the} how things are.`,
    nobody:
      'Nobody here asks how you are. You are tired, and a long way from home, but you are ' +
      'still on your feet.',
    guard:
      '"Dead," says the skeleton. "Thank you for asking. Nobody ever asks." Its grip on the ' +
      'handle does not loosen.',
    beaten: '"My jaw aches," says the skeleton, "and I have not felt so well in years."',
  },
  mercy: {
    words: ['mercy', 'truce', 'peace', 'surrender', 'beg'],
    phrases: ['spare me', 'give up', 'let me through', 'let me pass', 'let me by'],
    act: (the) => `You beg ${the} for mercy.`,
    nobody: 'You beg the empty room for mercy. It never had a quarrel with you.',
    guard:
      '"They all begged," says the skeleton, and nods at the pile. "Some of them begged well."',
    beaten: '"You won," says the skeleton. "I ought to be the one begging."',
  },
  insult: {
    words: ['ugly', 'stupid', 'dumb', 'idiot', 'loser', 'bonehead', 'coward', 'stink', 'smelly'],
    act: (the) => `You call ${the} names.`,
    nobody: 'You insult the empty room. It takes it well.',
    guard:
      'The skeleton\'s knuckles creak on the handle. "Come a little closer," it says, "and say ' +
      'that again."',
    beaten:
      '"Say what you like," says the skeleton. "You have earned it, and my jaw is too sore to ' +
      'argue."',
  },
  praise: {
    words: ['cool', 'awesome', 'spooky', 'nice', 'amazing', 'beautiful'],
    act: (the) => `You pay ${the} a compliment.`,
    nobody:
      'You say something kind to the empty room. It cannot hear you, but it does no harm to ' +
      'practise.',
    guard:
      'The skeleton stands a little straighter. It has been a long while since anyone admired ' +
      'its bones. "Flattery will not open this door," it says, but it sounds pleased.',
    beaten: '"I know," says the skeleton, and polishes a knuckle on its ribs.',
  },
  laugh: {
    words: ['lol', 'haha', 'hahaha', 'hehe', 'lmao', 'lmfao', 'rofl', 'xd'],
    act: () => 'You laugh.',
    nobody: 'You laugh, and the echo laughs back a moment later, a little less sure of itself.',
    guard: '"Laugh while you have the breath for it," says the skeleton, and its jaw clacks.',
    beaten:
      'The skeleton cackles along with you until its whole frame shakes, and a rib falls off, ' +
      'and it has to put it back.',
  },
  joke: {
    words: ['joke', 'jokes', 'funny'],
    act: (the) => `You ask ${the} for a joke.`,
    nobody: 'You tell yourself a joke. You have heard it before.',
    guard:
      '"Knock knock," says the skeleton, and raps its knuckles on the door behind it. You do ' +
      'not dare to ask who is there.',
    beaten:
      '"Why did nobody ever get past me?" says the skeleton. It waits. "I had the guts to stop ' +
      'them." Its jaw rattles at its own joke for a long while, and you are too polite to ' +
      'point out that it has no guts at all.',
  },
} satisfies Record<string, Topic>;

export type TopicId = keyof typeof TOPICS;

// every word that starts banter on its own, for tests that keep it clear of commands and names
export const BANTER_WORDS: readonly string[] = Object.values(TOPICS).flatMap((t) => t.words);

const has = (tokens: readonly string[], phrase: string): boolean => {
  const words = phrase.split(' ');
  return tokens.some((_, i) => words.every((word, j) => tokens[i + j] === word));
};

export function topicOf(tokens: readonly string[]): TopicId | undefined {
  return (Object.keys(TOPICS) as TopicId[]).find((id) => {
    const topic: Topic = TOPICS[id];
    return (
      topic.words.some((word) => tokens.includes(word)) ||
      (topic.phrases ?? []).some((phrase) => has(tokens, phrase))
    );
  });
}

const PRONOUNS = new Set(['it', 'he', 'she', 'him', 'her', 'they', 'them', 'that', 'this']);

// who it is said to: whoever is named, here or not, or "it", or the one creature in the room
function listener(w: World, tokens: readonly string[]): ThingId | null {
  const scope = w.inScope();
  const everyone = Object.keys(w.def.things);
  for (let i = 0; i < tokens.length; i++) {
    const found = resolveNoun(tokens.slice(i), everyone, w.def.things);
    if (found.kind === 'one') return found.id;
  }
  const it = w.state.it;
  const creatures = w.creaturesHere(true);
  if (it && scope.includes(it) && tokens.some((t) => PRONOUNS.has(t))) return it;
  if (it && creatures.includes(it)) return it;
  return w.obvious() ?? (creatures.length === 1 ? creatures[0]! : null);
}

function answer(w: World, topic: Topic, who: ThingId | null): string {
  if (!who) return topic.nobody;
  const the = w.the(who);
  const The = the[0]!.toUpperCase() + the.slice(1);
  const act = topic.act(the);
  if (!w.inScope().includes(who)) return `${The} is not here to hear you.`;
  if (who === 'duck') {
    return `${act} The duck listens with perfect attention, the way it listens to everything, and says nothing at all.`;
  }
  if (w.thing(who).kind !== 'creature') return `${act} ${The} has nothing to say to that.`;
  if (w.isDead(who)) return `${act} ${The} is past answering.`;
  if (who === 'skeleton') {
    if (skeletonFetched(w)) {
      return (
        `${act} The skeleton keeps its arms folded and looks at the far wall. It is still ` +
        'pretending nothing happened.'
      );
    }
    return skeletonBeaten(w) ? topic.beaten : topic.guard;
  }
  if (who === 'dragon') {
    if (dragonAsleep(w)) {
      return (
        `${act} The dragon goes on sleeping. One ear twitches, which might be an answer, or ` +
        'a dream about mutton.'
      );
    }
    return (
      topic.dragon ??
      `${act} The dragon looks at you down the length of his nose, and a little smoke curls ` +
        'from his nostrils, which you decide is a good sign.'
    );
  }
  if (who === 'troll') {
    if (trollGrieves(w)) {
      return `${act} The troll does not seem to hear you. He is looking south, toward the castle.`;
    }
    if (trollSulks(w)) return `${act} The troll keeps his back to you and looks at the mountains.`;
    if (topic.troll) return w.text(topic.troll);
    return (
      `${act} The troll thinks it over${trollFriend(w) ? '' : ' from behind his hand'} for a ` +
      'long while. "Wug," he says at last, and nods, as though that settles it.'
    );
  }
  return `${act} ${The} looks at you and says nothing.`;
}

export const banter: Banter = {
  matches: (tokens) => topicOf(tokens) !== undefined,
  reply(w, tokens) {
    const id = topicOf(tokens);
    if (!id) return;
    if (mute(w)) {
      w.say(MUTE);
      return;
    }
    const who = listener(w, tokens);
    if (who && w.inScope().includes(who)) w.state.it = who;
    w.say(answer(w, TOPICS[id], who));
  },
};
