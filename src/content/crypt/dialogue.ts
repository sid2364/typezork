// the two conversations of the game, and the things that follow from them
import { tokenize } from '../../engine/parser/lexer';
import type { World } from '../../engine/world';
import { banter } from './banter';
import {
  clubbed,
  mute,
  POINTS,
  skeletonClue,
  skeletonSwung,
  trollGrieves,
  trollSulks,
  worthyWeapon,
} from './story';

interface Option {
  readonly label: string;
  readonly run: () => void;
}

const WORDS: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  three: 3,
  first: 1,
  second: 2,
  third: 3,
};

// the player typed out a line, near enough: every word of it, in order, and nothing more
function saysLine(typed: readonly string[], label: string): boolean {
  const line = tokenize(label.replace(/\.\.\./g, ' '));
  return line.length > 0 && typed.join(' ') === line.join(' ');
}

// show numbered lines and wait until the player picks one
export function choose(w: World, options: readonly Option[], prompt = 'What do you say?'): void {
  const numbers = options.map((_, i) => String(i + 1));
  const list = () => options.forEach((o, i) => w.say(`${i + 1}. ${o.label}`, 'option'));
  const ask = () =>
    w.ask(
      `${prompt} (${numbers.join(', ')})`,
      (tokens) => {
        const n = Number(tokens[0]) || WORDS[tokens[0] ?? ''] || 0;
        // typing the line itself picks it: "who are you", "let me through"
        const option =
          (tokens.length === 1 ? options[n - 1] : undefined) ??
          options.find((o) => saysLine(tokens, o.label));
        if (option) {
          w.say(option.label);
          option.run();
          return;
        }
        // "can we be friends": they answer that, and wait for a proper answer
        if (banter.matches(tokens)) {
          banter.reply(w, tokens);
          ask();
          return;
        }
        w.say(
          'They are waiting for an answer. Type the number of the line you want to say.',
          'error',
        );
        list();
        ask();
      },
      { strict: true, choices: numbers },
    );
  list();
  ask();
}

// ---- the skeleton ----------------------------------------------------------------

export function talkToSkeleton(w: World): void {
  // after a death the player has paid for the door already, so it lets them by
  if (w.deaths > 0) {
    w.say(
      'The skeleton looks at the pile of bones, and then at you, for a long while. "You again," ' +
        'it says. "You have paid for this door already." It lets go of the handle and sits ' +
        'down against the wall.',
    );
    w.setFlag('skeletonTalked');
    w.setFlag('skeletonBeaten');
    return;
  }
  w.say(
    'The skeleton\'s jaw drops open with a dry click. "Another one awake," it says, in a voice ' +
      'like wind under a door. "They all want this door. Look at the pile, and you will see ' +
      'what became of them."',
  );
  choose(w, [
    {
      label: '"Who are you?"',
      run: () => {
        w.say(
          '"The one who holds this door," says the skeleton. "I held it before your bones were ' +
            'in you, and I will hold it when they are in that pile."',
        );
        skeletonChallenge(w);
      },
    },
    {
      label: '"Let me through."',
      run: () => {
        w.say('"They all said that," says the skeleton, and nods at the pile.');
        skeletonChallenge(w);
      },
    },
    {
      label: '"Are you... alive?"',
      run: () => {
        w.say('"More alive than you are going to be in a second," says the skeleton.');
        skeletonChallenge(w);
      },
    },
  ]);
}

function skeletonChallenge(w: World): void {
  // if the player already had a good look, the skeleton skips to the point
  w.say(
    skeletonClue(w)
      ? '"You have had your good look at me," says the skeleton. "Now come and take the door ' +
          'from me, if you can."'
      : 'The skeleton tightens its grip on the handle. "The door stays shut," it says, "unless ' +
          'you can take it from me." Your head still swims from your long sleep, and in this ' +
          'poor light you can hardly see what you would be fighting. You had better take a ' +
          'closer look first.',
  );
  w.setFlag('skeletonTalked');
}

// fists only. a swing before you have seen its weak jaw gets you thrown among the bones,
// and it lets go of the door once it has lost
export function brawlSkeleton(w: World): void {
  if (!skeletonClue(w)) {
    blindSwing(w);
    return;
  }
  w.say(
    'You go for the jaw. The skeleton is quick, and its first blow catches you on the ' +
      'shoulder and turns you half round, but you have seen the wire, and your fist finds it. ' +
      'The jaw goes spinning across the floor.',
  );
  w.say(
    'The skeleton picks up its jaw and clicks it back in, and looks at you for a long while. ' +
      'Then it cackles until its whole frame shakes. "Not bad," it says. It lets go of the ' +
      'door at last, and sits down against the wall, and waves you on.',
  );
  w.say('For a moment, the way it tilts its skull reminds you of someone.');
  w.setFlag('skeletonBeaten');
}

function blindSwing(w: World): void {
  if (skeletonSwung(w)) {
    w.say(
      'Again it catches your fist and throws you down among the bones, and again it takes ' +
        'hold of the door. You had better have a proper look at it first.',
    );
    return;
  }
  w.setFlag('skeletonSwung');
  w.say(
    'You swing at the skeleton. It catches your fist in its cold fingers as though it had ' +
      'waited all its long death for you to try, and it throws you down among the bones. ' +
      '"Is that all?" it says, and takes hold of the door again.',
  );
  w.say(
    'You never saw where to hit it. In this poor light you had better look at it properly ' +
      'before you try again.',
  );
}

// a thrown bone gets the skeleton off the door too, much to its shame
export function fetchForSkeleton(w: World): void {
  w.move('bone', 'start');
  w.say(
    "The skeleton's skull snaps round. Before it can stop itself it lets go of the door and " +
      'scrambles after the bone, and comes trotting back with it in its teeth.',
  );
  w.say(
    'It freezes. It looks at you. It spits the bone onto the floor, sits down against the ' +
      'wall, folds its arms, and will not meet your eye. The door is free.',
  );
  w.setFlag('skeletonFetched');
  w.setFlag('skeletonBeaten');
}

// ---- the dragon ----------------------------------------------------------------

// the first word to the dragon before he is fed: he half wakes, and goes back to sleep
export function talkToSleepingDragon(w: World): void {
  w.setFlag('dragonAsked');
  w.say(
    '"Hello?" you say. One enormous eye opens a crack. "...keeper?" says the dragon. The ' +
      'eye looks at you for a while. "No. You are not the keeper."',
  );
  choose(w, [
    {
      label: '"The keeper sent me."',
      run: () => {
        w.say(
          'Both eyes open. "Did he?" says the dragon. "The keeper never came to me without my ' +
            'supper. He kept it downstairs, in the cold."',
        );
        w.say(
          'His stomach makes a long, hollow sound. The eyes close again, and in a moment he ' +
            'is snoring.',
        );
      },
    },
    {
      label: '"Move. I need to go east."',
      run: () => {
        w.say(
          'The dragon shifts his tail, not out of the way. "Nobody passes a hungry dragon," he ' +
            'grumbles, and the eye closes. In a moment he is snoring again.',
        );
      },
    },
  ]);
}

export function feedDragon(w: World): void {
  w.move('mutton', 'nowhere');
  w.setFlag('dragonFriend');
  w.award('feed', POINTS.feed);
  w.say(
    "You put the mutton leg down by the dragon's nose and step back, fast. A nostril moves. " +
      'An eye opens. He looks at the mutton leg, and then it ' +
      'is gone, bone and all.',
  );
  w.say(
    'The eye turns to you. "You are not the keeper," the dragon says, his voice deep and ' +
      'tired. "The keeper said: wait. And so I wait. I have waited a long time. ' +
      'Do you know how long, o little one?"',
  );
  choose(w, [
    {
      label: '"A long time. I am sorry, sir."',
      run: () => {
        w.award('dragonKind1', POINTS.kindWord);
        w.say(
          '"It is good to hear it said out loud. Nobody ' +
            'says things out loud to a dragon.", said the dragon.',
        );
        dragonAsksWhy(w);
      },
    },
    {
      label: '"The keeper sent me."',
      run: () => keeperProof(w),
    },
    {
      label: '"I only need to go east."',
      run: () => {
        w.say(
          '"Everyone needs to go east," says the dragon. "The others brought swords to find their way. ' +
            'You brought me sustenance."',
        );
        dragonAsksWhy(w);
      },
    },
    // only for someone who has seen the keeper's empty room
    ...(sawKeeperRoom(w)
      ? [
          {
            label: '"The keeper is gone. His bed is made, his cup is on the table."',
            run: () => {
              tellKeeper(w);
              dragonAsksWhy(w);
            },
          },
        ]
      : []),
  ]);
}

const sawKeeperRoom = (w: World): boolean => w.state.visited.includes('keeper');

// the news can be told once, at the first meeting or any time after
export const keeperNewsPending = (w: World): boolean => sawKeeperRoom(w) && !w.flag('keeperTold');

export function tellKeeper(w: World): void {
  w.setFlag('keeperTold');
  w.award('keeperNews', POINTS.keeperNews);
  w.say(
    'The dragon is quiet for a long time. Smoke goes up from one nostril and does not stop. ' +
      '"I see," he says at last. "Let it be known that he always made his bed."',
  );
  w.say('"Well, then I must stop waiting," he sighs.');
}

// a lie about the keeper has to be backed up with what the keeper wrote. a wrong answer
// keeps the passage shut until you get it right, and a late right answer earns nothing
export function keeperProof(w: World): void {
  const retry = Boolean(w.flag('dragonDoubt'));
  w.say(
    retry
      ? '"Well?" says the dragon. "What does the keeper think of the gardener?"'
      : '"Did he," says the dragon, and both eyes are open now. "Then you know what he thinks ' +
          'of the gardener. So, tell me."',
  );
  const wrong = () => {
    w.setFlag('dragonDoubt');
    w.setFlag('dragonFooled');
    w.say(
      'The dragon looks at you for a long moment. "Do you really consider me to be a fool?" ' +
        'His tail stays where it is, across the passage east.',
    );
  };
  const right = () => {
    if (!retry) {
      w.setFlag('dragonDeceived');
      w.award('deceive', POINTS.deceive);
      w.say(
        'The dragon breathes out, long and slow. "That is what he always said," he says. ' +
          '"Word for word. So he did send you."',
      );
      dragonAsksWhy(w);
      return;
    }
    w.setFlag('dragonDoubt', false);
    w.say(
      '"That is what he always said," says the dragon. "You know it now. You did not know it ' +
        'then." He pulls his tail off the passage headed east, and lays his head down with ' +
        'his back to you.',
    );
  };
  choose(w, [
    { label: '"He is not to be trusted."', run: wrong },
    { label: '"He is not dangerous."', run: right },
    { label: '"He dislikes brussels sprouts."', run: wrong },
  ]);
}

function dragonAsksWhy(w: World): void {
  w.say(
    'He looks at you keenly. "You smell of candle smoke," he says, "and you seem lost. ' +
      'What do you look for?"',
  );
  choose(w, [
    {
      label: '"Home."',
      run: () => {
        w.say('"Hoom," says the dragon in his old accent. Satiated.');
        giveScale(w);
      },
    },
    {
      label: '"I do not know. I woke up in a crypt."',
      run: () => {
        w.award('dragonKind2', POINTS.kindWord);
        w.say(
          '"Then you are looking for yourself," says the dragon, tucking his head into his ' +
            'wing for a nap.',
        );
        giveScale(w);
      },
    },
    {
      label: '"Something to fight, I thought."',
      run: () => {
        w.say('"Yet you fed me," says the dragon. He gets up. It takes a while. "Then fight."');
        challengeDragon(w);
      },
    },
  ]);
}

// the dragon will fight you, but only fairly, and only if you came armed
export function challengeDragon(w: World): void {
  const weapon = worthyWeapon(w);
  if (!weapon) {
    w.setFlag('dragonChallenged');
    w.say(
      'He looks you up and down, and finds nothing worth fighting. "Come back with a worthy ' +
        'weapon," he says, and lays his tail back across the passage east.',
    );
    return;
  }
  w.setFlag('dragonChallenged', false);
  dragonDuel(w, weapon);
}

function dragonDuel(w: World, weapon: string): void {
  const name = w.thing(weapon).name;
  w.say(
    `You draw your ${name}. The dragon is awake now, and fed, and he is not thin any more ` +
      'where it counts. He is fast for something so big. You are not as fast as you thought. ' +
      `Twice his claw stops a hair from your face. Once your ${name} rings off his scales.`,
  );
  w.say(
    'Then he does something strange. He lowers his head and leaves his neck open, and looks at ' +
      'you.',
  );
  choose(
    w,
    [
      {
        label: 'Strike at his open neck.',
        run: () => tameDragon(w),
      },
      {
        label: `Lower your ${name}.`,
        run: () => {
          w.move(weapon, 'nowhere');
          w.setFlag('dragonDueled');
          w.setFlag('scaleScorched');
          w.award('duel', POINTS.duel);
          w.say(
            `You lower the ${name}. The dragon breathes on it, gently, and it is ash and ` +
              'cinders in your hand before you feel the heat. "Good," he says. "Now you know ' +
              'what strength is for."',
          );
          giveScale(w);
        },
      },
    ],
    'What do you do?',
  );
}

// beaten fairly and awake, he bows to you: a friend who serves, but he gives you no scale
function tameDragon(w: World): void {
  w.setFlag('dragonTamed');
  w.award('tame', POINTS.tame);
  w.say(
    'Your blow falls upon his neck, and the scales part, and dark blood runs down upon the ' +
      'stone. He does not fall. Slowly he bows his great head before you, until his jaw rests ' +
      'upon the floor. "So," he says, and the word is like stones grinding in a deep place. ' +
      '"You have the mastery. I will go where you go." He draws his tail out of the passage ' +
      'east, and lies down, and watches you with his old eyes.',
  );
}

// also used by talk if the conversation was cut short, for example by a reload
export function giveScale(w: World): void {
  w.say(
    'The dragon scratches under his chin with a lazy claw. Something falls and rings on the ' +
      'stone like a dropped coin. "A dragonscale," he says, "to aid you in your journey."',
  );
  w.say(
    'He pulls his tail off the passage headed east and lays his head back down. ' +
      (w.flag('keeperTold')
        ? '"Go on, then," he says, already half asleep. "One of us should go somewhere."'
        : '"If the keeper comes," he says, already half asleep, "say that I waited."'),
  );
  w.say('You now have a dragonscale.');
  w.move('scale', 'inventory');
  w.markMoved('scale');
  w.setFlag('scaleGiven');
}

// ---- the troll -----------------------------------------------------------------

export function showMirror(w: World, glass: 'mirror' | 'scale'): void {
  const name = w.thing(glass).name;
  const seen = Boolean(w.flag('trollSawFace'));
  w.setFlag('trollSawFace');
  if (trollSulks(w) && seen) {
    w.say(
      `The troll does not want to look again. You hold the ${name} steady and wait. After a ` +
        'long time, one eye comes round. "Grak nub," he says behind his hand. "Ooga blug."',
    );
  } else if (trollSulks(w)) {
    w.say(
      `The troll will not look at anything you hold up. You hold the ${name} steady and wait. ` +
        'After a long time, curiosity wins, and one eye comes round. Then the other. He ' +
        'looks for a long moment, and then he takes his hand away from his mouth. One of his ' +
        'front teeth is broken in half.',
    );
    w.say(
      '"Grak nub," he says, very quietly. "Ooga blug." You do not need the words. He thinks ' +
        'he is ugly.',
    );
  } else if (trollGrieves(w)) {
    w.say(
      `You kneel and hold up the ${name}. For a long while the troll will not lower his hands. ` +
        'Then he looks. For a long moment he only looks. One of his front teeth is broken in ' +
        'half.',
    );
    w.say(
      '"Grak nub," he says, very quietly. "Ooga blug. Him say... hum." You do not need the ' +
        'words. He thinks he is ugly, and the only one who ever told him otherwise is gone.',
    );
  } else {
    w.say(
      `You hold up the ${name}. The troll stops swinging his club. He comes closer, one slow ` +
        'step at a time, and looks. For a long moment he only looks. Then he takes his hand ' +
        'away from his mouth. One of his front teeth is broken in half.' +
        (glass === 'scale' && w.flag('scaleCracked')
          ? ' The crack in the scale runs right through his face. The troll does not seem ' +
            'to mind. He is used to broken things.'
          : ''),
    );
    w.say(
      '"Grak nub," he says, very quietly. "Ooga blug." You do not need the words. He thinks ' +
        'he is ugly.',
    );
  }
  const grieving = trollGrieves(w);
  choose(w, [
    {
      label: '"It is only a tooth. The rest of you is still here."',
      run: () => {
        w.award('trollKind1', POINTS.kindWord);
        w.say(
          'The troll looks at the tooth. Then he looks at the rest of himself.' +
            ' "Hum," he says slowly. You are almost ' +
            'sure that is the troll word for good.',
        );
        trollFindsVoice(w, glass);
      },
    },
    // a troll who is mourning his friend is in no mood to laugh
    ...(grieving
      ? []
      : [
          {
            label: '"It makes you look... funny?"',
            run: () => {
              w.say(
                `The troll makes a silly face in the ${name}. His broken tooth is visible. He laughs, ` +
                  'with his whole mouth, for the first time in what must be years.',
              );
              if (w.locationOf('turnip') === 'nowhere') {
                w.move('turnip', 'inventory');
                w.markMoved('turnip');
                w.say(
                  'Still laughing, he digs in a pocket and pushes a small, muddy turnip into your ' +
                    'hands. "From garden," he says. "Small one. Not step on."',
                );
              }
              trollFindsVoice(w, glass);
            },
          },
        ]),
    {
      label: '"Yes. It is quite horrendous."',
      run: () =>
        hurtTroll(
          w,
          `The troll's face closes like a door. He turns away from the ${name}` +
            (w.here === 'gazebo'
              ? ', sits back down and looks at the mountains. You feel the weight of your words.'
              : ' and walks off north toward the gazebo with his back to you. You feel the ' +
                'weight of your words. The way north is open.'),
        ),
    },
  ]);
}

function trollFindsVoice(w: World, glass: 'mirror' | 'scale'): void {
  w.say(
    'Then the troll speaks again, slowly, with nothing in front of his mouth. The words come ' +
      'out clear. "You... talk good," he says. "I talk bad. Since tooth. All laugh. So I stop."',
  );
  const done = () => trollLetsYouPass(w, glass);
  choose(w, [
    {
      label: '"I am not laughing."',
      run: () => {
        w.say('The troll checks your face very carefully. "You not laugh."');
        done();
      },
    },
    {
      label: '"Say something, be loud!"',
      run: () => {
        w.say('The troll thinks. He takes a big breath in. You feel the air move.');
        done();
      },
    },
    {
      label: '"I lost my voice too. I woke up without even a name."',
      run: () => {
        w.award('trollKind2', POINTS.kindWord);
        w.say('"Then we find," he says. "You and me."');
        done();
      },
    },
  ]);
}

function trollLetsYouPass(w: World, glass: 'mirror' | 'scale'): void {
  w.say(
    'He stands up straight. This takes a while, because there is a lot of troll. ' +
      '"I AM TROLL," he says. Birds leave the castle walls. The troll looks surprised ' +
      'at the sound of his own voice. Then he smiles, broken tooth and all, and does not ' +
      'cover it.',
  );
  w.say(
    '"Garden," he says, and points north with the club. "My garden. You go. Do not step on ' +
      'small ones."' +
      (glass === 'mirror'
        ? ' He keeps the mirror, and holds it the way you hold a bird. You do not ask for it back.'
        : ' He gives the scale back with two careful fingers.'),
  );
  if (glass === 'mirror') w.move('mirror', 'nowhere');
  forgiven(w);
  w.setFlag('trollFriend');
  w.award('help', POINTS.help);
  w.say('It seems you can now walk about in the garden freely.');
}

// a troll that was hurt and made up with you goes back to its garden path
function forgiven(w: World): void {
  if (!w.flag('trollHurt')) return;
  w.setFlag('trollForgave');
  w.move('troll', 'garden');
}

// a hurt troll sulks in the gazebo until you take the cruel word back
export function apologiseToTroll(w: World): void {
  w.say(
    'The troll sits at the edge of the gazebo with his back to you, gazing at the mountains. ' +
      'He does not turn round. His hand is over his mouth.',
  );
  // a mirror or a scale in your pocket can go straight into the conversation
  const glass = (['mirror', 'scale'] as const).find((id) => w.has(id));
  choose(w, [
    {
      label: w.flag('trollSawFace')
        ? '"I am sorry. I was wrong. It is only a tooth."'
        : '"I am sorry. I should not have called you that."',
      run: () => {
        w.award('trollSorry', POINTS.kindWord);
        w.say(
          'For a long time nothing happens. Then the troll turns round, slowly, the way a ' +
            'mountain would. "You say sorry," he says from behind his hand. "Out loud. Hum." ' +
            'He gets up, picks up his club, and stumps off south to his garden path, and ' +
            'leaves the torch where it was.',
        );
        forgiven(w);
      },
    },
    {
      label: '"I need that torch."',
      run: () =>
        w.say(
          '"Nub," says the troll to the mountains. He does not move, and neither does the torch.',
        ),
    },
    {
      label: '"Never mind."',
      run: () => w.say('The troll goes on looking at the mountains.'),
    },
    ...(glass
      ? [{ label: `Hold up the ${w.thing(glass).name}.`, run: () => showMirror(w, glass) }]
      : []),
  ]);
}

// a cruel word sends the troll off to sulk in the gazebo, over the torch
function hurtTroll(w: World, text: string): void {
  w.award('trollCruel', POINTS.cruelWord);
  w.setFlag('trollHurt');
  w.setFlag('trollForgave', false);
  w.say(text);
  w.move('troll', 'gazebo');
}

// once you have read the keeper's note, you know what some of the troll's words mean
function gloss(w: World, meaning: string): void {
  if (w.flag('readNote')) w.say(`You remember the keeper's note. ${meaning}`);
}

// the first word to the troll: it cannot say what it wants, but it can show you
export function talkToTroll(w: World): void {
  w.setFlag('trollAsked');
  w.say(
    'The troll looks at you over the top of the hand he keeps over his mouth. "Ooga wug zug ' +
      'mog," he says. "Grak nub."',
  );
  gloss(w, 'ZUG is see. MOG is face. GRAK is tooth. NUB is no.');
  choose(w, [
    {
      label: '"I don\'t understand."',
      run: () => {
        w.say(
          'The troll tries harder, but cannot seem to get the words out. He looks away, ashamed.' +
            ' You think to yourself maybe he needs to see himself more clearly.',
        );
      },
    },
    {
      label: '"Let me through, you stupid oaf."',
      run: () => {
        hurtTroll(
          w,
          'The troll looks at you for a long time. "Blug," he says, very quietly, and walks off ' +
            'north toward the gazebo with his back to you. The way north is open, but nobody ' +
            'is waving you through.',
        );
        gloss(w, 'BLUG is bad.');
      },
    },
  ]);
}

// ---- the grieving troll ----------------------------------------------------------

// with the dragon dead, the troll asks who did it. the truth is the only way to his mirror
export function talkToGrievingTroll(w: World): void {
  if (w.flag('trollToldTruth')) {
    w.say('The troll does not lift his face from his hands. "Him sleep," he says. "Long sleep."');
    return;
  }
  w.say(
    'The troll does not hide his mouth now. He looks at you a long while with his red eyes. ' +
      '"Him sleep," he says. "Long sleep. Who?"',
  );
  const weapon = worthyWeapon(w, 'troll');
  choose(w, [
    {
      label: '"I did. He was asleep."',
      run: () => {
        w.setFlag('trollToldTruth');
        w.award('trollTruth', POINTS.kindWord);
        w.say(
          'The troll looks at you for a long time. The club comes down slowly, until its end ' +
            'rests in the grass. "Me grow turnips," he says. "Him keep warm. Hum." He sits down ' +
            'heavily by the path, and covers his face with both hands.',
        );
      },
    },
    {
      label: '"I do not know."',
      run: () =>
        w.say('"Nub," says the troll. He looks at your hands for a long while. "You know."'),
    },
    ...(weapon
      ? [{ label: `Raise your ${w.thing(weapon).name}.`, run: () => trollFight(w, weapon) }]
      : []),
  ]);
}

// any attack on the grieving troll: a fair fight with a worthy weapon, a lost one without
export function attackGrievingTroll(w: World): void {
  const weapon = worthyWeapon(w, 'troll');
  if (weapon) {
    trollFight(w, weapon);
    return;
  }
  w.say('He hardly looks at what you hold. The club comes round before you can lift it.');
  loseTrollFight(w);
}

// two exchanges, and a wrong answer in either loses the fight
function trollFight(w: World, weapon: string): void {
  const name = w.thing(weapon).name;
  const lost = (text: string) => () => {
    w.say(text);
    loseTrollFight(w, weapon);
  };
  w.say(
    `You raise your ${name}. The troll sees it, and something goes out of his face, and ` +
      'something worse comes into it. His hands tighten upon the club. He swings it idly no ' +
      'longer. "Blug," he says. "You blug. Him sleep. Him SLEEP." And he comes at you across ' +
      'the grass.',
  );
  choose(
    w,
    [
      {
        label: `Stand your ground and raise your ${name}.`,
        run: lost(`The club is longer than your ${name}, and the troll is longer than the club.`),
      },
      {
        label: 'Step in, under the swing.',
        run: () => {
          w.say(
            'The club goes over your head with a sound like a door slamming in the wind. Then ' +
              'you are inside his reach, where a club is of no use to anyone, and you drive ' +
              `your ${name} into his side. He goes down on one knee in the grass.`,
          );
          trollRises(w, weapon);
        },
      },
      {
        label: '"He would have eaten me."',
        run: lost('"Him NUB eat!" roars the troll. "Him eat mutton!"'),
      },
    ],
    'What do you do?',
  );
}

function trollRises(w: World, weapon: string): void {
  const name = w.thing(weapon).name;
  const lost = (text: string) => () => {
    w.say(text);
    loseTrollFight(w, weapon);
  };
  w.say(
    'He looks past you, down the path toward the castle and the cell where his old friend ' +
      'lies. ' +
      '"Hoom," he says, very low. Then he rises, and the club goes up over his head in both ' +
      'hands, and comes down at you from on high.',
  );
  gloss(w, 'HOOM is home.');
  choose(
    w,
    [
      {
        label: '"I am sorry."',
        run: lost('"Late," says the troll. "Too late." The club does not slow.'),
      },
      {
        label: 'Throw a fistful of mud in his face.',
        run: lost(
          'The mud strikes him full in the eyes, and he does not so much as blink. He is a ' +
            'troll, and his whole mind is upon you.',
        ),
      },
      {
        label: 'Dodge, and strike.',
        run: () => {
          w.say(
            'You throw yourself aside. The club comes down where you stood and sinks deep into ' +
              `the earth, and while he heaves at it, your ${name} finds him.`,
          );
          w.setFlag('trollFought');
          w.kill('troll');
          w.bus.emit('kill', { thing: 'troll', weapon }, w);
        },
      },
    ],
    'What do you do?',
  );
}

// the first lost fight puts you in the stream, the second one is the end of you
function loseTrollFight(w: World, weapon?: string): void {
  const losses = Number(w.flag('trollFightsLost') ?? 0) + 1;
  w.setFlag('trollFightsLost', losses);
  if (losses >= 2) {
    w.lose(
      'This time the club does not stop. The last thing you see is the troll going down the ' +
        'path and in through the archway, very slowly, to sit beside his friend.',
    );
    return;
  }
  if (w.here !== 'garden') {
    w.say(clubbed(w, weapon));
    return;
  }
  // the mechanics of a clubbing, told the way a grieving troll would do it
  clubbed(w, weapon);
  const lost = weapon ? w.thing(weapon).name : undefined;
  w.say(
    'The club catches you full in the chest, and you fly backwards down the garden path, over ' +
      'the bank and into the stream.' +
      (lost ? ` Your ${lost} goes one way and you go the other. Only you come back.` : '') +
      ' You crawl out on the bank, soaked and aching. Up the path, the troll stands at the ' +
      "garden's edge again, and waits for you.",
  );
}

// ---- second chances ------------------------------------------------------------

// the scroll, read anywhere: look back at who you killed and call one of them back
export function revisitDecisions(w: World): void {
  const dragon = w.isDead('dragon');
  const troll = w.isDead('troll');
  w.say(
    mute(w)
      ? 'You open your mouth to read, and nothing comes out. Then the words lift off the page ' +
          'on their own, one at a time, and say themselves in a voice that is almost yours. A voice from the great beyond.'
      : 'You unroll the scroll and read the three lines aloud. Your voice shakes on the first, ' +
          'holds on the second, and by the third it is simply your voice.',
  );
  const seen = [
    dragon ? 'the dragon, thin, his head turned toward the door' : '',
    troll ? 'the troll in the grass, his club beside him' : '',
  ].filter(Boolean);
  w.say(
    'The castle goes quiet around you, as if it were listening. You see again what you left ' +
      `behind: ${seen.join(', and ')}.`,
  );
  w.say(
    dragon && troll
      ? 'The scroll is warm in your hands. It can call back who you sent away, one of them.'
      : 'The scroll is warm in your hands. It can call back who you sent away.',
  );
  const callBack = (revive: (w: World) => void) => () => {
    revive(w);
    w.move('scroll', 'nowhere');
    w.say('The scroll burns away in your hands without any heat.');
    if (dragon && troll) w.say('The other one, unfortunately, stays where you left it.');
  };
  choose(
    w,
    [
      ...(dragon ? [{ label: 'Call back the dragon.', run: callBack(reviveDragon) }] : []),
      ...(troll ? [{ label: 'Call back the troll.', run: callBack(reviveTroll) }] : []),
      {
        label: 'Roll the scroll up again.',
        run: () => w.say('You roll the scroll up and tie the ribbon.'),
      },
    ],
    'What do you choose?',
  );
}

export function reviveDragon(w: World): void {
  w.revive('dragon');
  w.setFlag('dragonFriend');
  w.setFlag('dragonRevived');
  w.setFlag('scaleCracked');
  w.setFlag('scaleGiven');
  w.move('scale', 'inventory');
  w.markMoved('scale');
  w.award('reviveDragon', POINTS.revive);
  w.say(
    'Where the dragon was felled, something breathes in. It is a long breath like a door that opens ' +
      'in a house shut for years. There is then a silence in which many things could happen. "You ' +
      'came back," a voice says. "People with swords never come back."',
  );
  w.say(
    'Something falls out of the air and rings on the ground at your feet. It is a dragonscale, ' +
      'cracked across the middle.',
  );
  w.say('You now have a dragonscale. Your arms have stopped shaking.');
}

export function reviveTroll(w: World): void {
  const wasMute = mute(w);
  w.revive('troll');
  w.setFlag('trollFriend');
  w.setFlag('trollRevived');
  w.setFlag('dragonEstranged', false);
  w.award('reviveTroll', POINTS.revive);
  w.say(
    'Where the troll was felled, the grass stirs. For a moment nothing else happens, and you feel the ' +
      'special loneliness of someone who has done nothing wrong.',
  );
  w.say(
    'Then a sneeze, a big sneeze. The troll sits up. "Nub," he says, very small, behind the hand. You hear it, from where you stand.',
  );
  w.say(
    wasMute
      ? 'Something moves in your throat. "I am sorry," you say, and you hear the words.'
      : '"I am sorry," you say. He hears it, and nods, once.',
  );
  if (!w.isDead('dragon')) {
    w.say('Far off, inside the castle, something large heaves an exhausted sigh of relief.');
  }
}
