// the two conversations of the game, and the things that follow from them
import type { World } from '../../engine/world';
import { POINTS, skeletonClue } from './story';

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

// show numbered lines and wait until the player picks one
export function choose(w: World, options: readonly Option[]): void {
  const numbers = options.map((_, i) => String(i + 1));
  const list = () => options.forEach((o, i) => w.say(`${i + 1}. ${o.label}`));
  const ask = () =>
    w.ask(
      `What do you say? (${numbers.join(', ')})`,
      (tokens) => {
        const n = Number(tokens[0]) || WORDS[tokens[0] ?? ''] || 0;
        const option = tokens.length === 1 ? options[n - 1] : undefined;
        if (option) {
          w.say(option.label);
          option.run();
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
  // after a death the player has been through this already, so it lets them by
  if (w.deaths > 0) {
    w.say(
      'The skeleton looks at the pile of bones, then at you. "You again," it says. "You know how ' +
        'this goes. I will not make you do it twice."',
    );
    w.setFlag('skeletonTalked');
    w.setFlag('skeletonBeaten');
    return;
  }
  w.say('"Oh, good. Someone to talk to," says the skeleton, and its jaw clacks.');
  choose(w, [
    {
      label: '"Who are you?"',
      run: () => {
        w.say('"Someone who came this way before you," says the skeleton.');
        skeletonChallenge(w);
      },
    },
    {
      label: '"Let me through."',
      run: () => {
        w.say('"Wow, nobody says please anymore...", says the skeleton.');
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
      ? '"You have already taken a good look at me," says the skeleton. "Fists up!"'
      : 'The skeleton is serious. "Do you even know what you\'re dealing with?" asks the skeleton. You must admit to yourself that you need a ' +
          'closer look, you still feel a bit dizzy.',
  );
  w.setFlag('skeletonTalked');
}

// the skeleton lets go once it has had its fight
export function brawlSkeleton(w: World): void {
  w.say(
    'The skeleton lets go of the door and puts up its fists. It is quick. One good punch and ' +
      'its jaw goes spinning across the floor.',
  );
  w.say(
    'It picks the jaw up, clicks it back in, and cackles. It\'s whole frame shakes violently. "Not bad," it says. ' +
      'It sits down against the ' +
      'wall and waves you towards the door.',
  );
  w.say('For a moment, the way it tilts its skull reminds you of someone.');
  w.setFlag('skeletonBeaten');
}

// ---- the dragon ----------------------------------------------------------------

export function feedDragon(w: World): void {
  w.move('mutton', 'nowhere');
  w.setFlag('dragonFriend');
  w.award('feed', POINTS.feed);
  w.say(
    "You put the mutton leg down by the dragon's nose and step back, fast. A nostril moves. " +
      'An eye opens. It looks at the mutton leg, and then it ' +
      'is gone, bone and all.',
  );
  w.say(
    'The eye turns to you. "You are not the keeper," the dragon says, its voice deep and ' +
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
      run: () => {
        w.say(
          '"No," says the dragon. "The keeper sent no one. ' +
            'I will believe you because you brought me my dinner until you are out of my sight."',
        );
        dragonAsksWhy(w);
      },
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
  ]);
}

function dragonAsksWhy(w: World): void {
  w.say(
    'It looks at you keenly. "You smell of candle smoke," it says, "and you seem lost. ' +
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
          '"Then you are looking for yourself," says the dragon putting ' +
            'tucking his head into his wing for a nap.',
        );
        giveScale(w);
      },
    },
    {
      label: '"Something to fight, I thought."',
      run: () => {
        w.say('"Yet you fed me."');
        giveScale(w);
      },
    },
  ]);
}

// also used by talk if the conversation was cut short, for example by a reload
export function giveScale(w: World): void {
  w.say(
    'The dragon scratches under its chin with a lazy claw. Something falls and rings on the ' +
      'stone like a dropped coin. "A dragonscale," he says, "to aid you in your journey."',
  );
  w.say(
    'It pulls its tail off the passage headed east and lays its head back down. "If the keeper ' +
      'comes," it says, already half asleep, "say that I waited."',
  );
  w.say('You now have a dragonscale.');
  w.move('scale', 'inventory');
  w.markMoved('scale');
  w.setFlag('scaleGiven');
}

// ---- the troll -----------------------------------------------------------------

export function showMirror(w: World, glass: 'mirror' | 'scale'): void {
  const name = w.thing(glass).name;
  if (w.flag('trollHurt')) {
    w.say(
      `The troll does not want to look again. You hold the ${name} steady and wait. After a ` +
        'long time, one eye comes round. "Grak nub," it says behind its hand. "Ooga blug."',
    );
  } else {
    w.say(
      `You hold up the ${name}. The troll stops swinging its club. It comes closer, one slow ` +
        'step at a time, and looks. For a long moment it only looks. Then it takes its hand ' +
        'away from its mouth. One of its front teeth is broken in half.' +
        (glass === 'scale' && w.flag('scaleCracked')
          ? ' The crack in the scale runs right through its face. The troll does not seem ' +
            'to mind. It is used to broken things.'
          : ''),
    );
    w.say(
      '"Grak nub," it says, very quietly. "Ooga blug." You do not need the words. It thinks ' +
        'it is ugly.',
    );
  }
  choose(w, [
    {
      label: '"It is only a tooth. The rest of you is still here."',
      run: () => {
        w.award('trollKind1', POINTS.kindWord);
        w.say(
          'The troll looks at the tooth. Then it looks at the rest of himself.' +
            '"Hum," it says slowly. You are almost ' +
            'sure that is the troll word for good.',
        );
        trollFindsVoice(w, glass);
      },
    },
    {
      label: '"It makes you look... funny?"',
      run: () => {
        w.say(
          `The troll makes a silly face in the ${name}. His broken tooth is visible. It laughs, ` +
            'with its whole mouth, for the first time in what must be years.',
        );
        trollFindsVoice(w, glass);
      },
    },
    {
      label: '"Yes. It is quite horrendous."',
      run: () => {
        w.award('trollCruel', POINTS.cruelWord);
        w.setFlag('trollHurt');
        w.say(
          `The troll's face closes like a door. It turns away from the ${name} and` +
            ' stands on the garden path with its back ' +
            'to you. You feel the weight of your words.',
        );
      },
    },
  ]);
}

function trollFindsVoice(w: World, glass: 'mirror' | 'scale'): void {
  w.say(
    'Then the troll speaks again, slowly, with nothing in front of its mouth. The words come ' +
      'out clear. "You... talk good," it says. "I talk bad. Since tooth. All laugh. So I stop."',
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
      label: '"Say something. Loud. I want to hear it."',
      run: () => {
        w.say('The troll thinks about this. It breathes in. It is a lot of breath.');
        done();
      },
    },
    {
      label: '"I lost my voice too. I woke up without even a name."',
      run: () => {
        w.award('trollKind2', POINTS.kindWord);
        w.say('"Then we find," it says. "You and me."');
        done();
      },
    },
  ]);
}

function trollLetsYouPass(w: World, glass: 'mirror' | 'scale'): void {
  w.say(
    'It stands up straight, which takes a while, because there is a lot of troll. ' +
      '"I AM TROLL," it says. Birds leave the castle walls. The troll looks very surprised ' +
      'at the sound of its own voice. Then it smiles, broken tooth and all, and does not ' +
      'cover it.',
  );
  w.say(
    '"Garden," it says, and points north with the club. "My garden. You go. Do not step on ' +
      'small ones."' +
      (glass === 'mirror'
        ? ' It keeps the mirror, and holds it the way you hold a bird. You do not ask for it back.'
        : ' It gives the scale back with two careful fingers.'),
  );
  if (glass === 'mirror') w.move('mirror', 'nowhere');
  w.setFlag('trollFriend');
  w.award('help', POINTS.help);
  w.say('It seems you can now walk about in the garden freely.');
}

// ---- second chances ------------------------------------------------------------

export function reviveDragon(w: World): void {
  w.revive('dragon');
  w.setFlag('dragonFriend');
  w.setFlag('dragonRevived');
  w.setFlag('scaleCracked');
  w.setFlag('scaleGiven');
  w.move('scroll', 'nowhere');
  w.move('scale', 'inventory');
  w.markMoved('scale');
  w.award('reviveDragon', POINTS.revive);
  w.say(
    'You read the three lines aloud. Your voice shakes on the first, holds on the second, ' +
      'and on the third it is simply your voice. The scroll burns away in your hands without ' +
      'any heat.',
  );
  w.say(
    'The dragon breathes in. It is a long breath, like a door that opens in a house shut for ' +
      'years. One eye opens and finds you. "You," it says. There is a silence in which many ' +
      'things could happen... "You came back," it says. "People with swords never come back."',
  );
  w.say(
    'It scratches under its chin, and a scale falls and rings on the floor. It is a dragonscale,' +
      ' and it is whole. The dragon looks at you with a new light in its eye.',
  );
  w.say('You now have a dragonscale. Your arms have stopped shaking.');
}

export function reviveTroll(w: World): void {
  w.revive('troll');
  w.setFlag('trollFriend');
  w.setFlag('trollRevived');
  w.setFlag('dragonEstranged', false);
  w.move('potion', 'nowhere');
  w.award('reviveTroll', POINTS.revive);
  w.say(
    'You pour the potion over the troll. It smells of flowers and old paper. For a moment ' +
      'nothing happens, and you feel the special loneliness of someone who has done one bad ' +
      'thing and one silly thing.',
  );
  w.say(
    'The troll then sneezes. It sits up. It looks at you, and at its club, and at you again. It ' +
      'puts a hand over its mouth. "Nub," it says, very small, behind the hand.',
  );
  w.say('Something moves in your throat. "I am sorry," you say, and you hear it.');
  w.say('Far off, inside the castle, something large heaves an exhausted sigh of relief.');
}
