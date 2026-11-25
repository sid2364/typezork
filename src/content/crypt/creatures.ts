import { creature } from '../../dsl';
import { attackGrievingTroll, brawlSkeleton, challengeDragon } from './dialogue';
import {
  clubbed,
  dragonBlockedText,
  dragonBlocks,
  dragonDoubts,
  dragonFriend,
  dragonTamed,
  skeletonBeaten,
  skeletonClue,
  skeletonFetched,
  skeletonSwung,
  skeletonTalked,
  trollFriend,
  trollGrieves,
  trollSulks,
  worthyWeapon,
} from './story';

export const creatures = [
  // holds the crypt door and throws you down until you have seen where to hit it
  creature('skeleton', {
    name: 'skeleton',
    aliases: ['skull', 'jaw'],
    location: 'start',
    killable: false,
    // the room text says what the skeleton wants next, in step with the hints
    description: (w) =>
      skeletonFetched(w)
        ? 'A skeleton sits against the wall by the door with its arms folded. It is pretending ' +
          'nothing happened.'
        : skeletonBeaten(w)
          ? 'A skeleton sits slumped against the wall by the door, arms folded, looking very ' +
            'pleased with itself.'
          : 'A skeleton stands against the door with both bony hands wrapped round the handle. ' +
            (skeletonClue(w)
              ? 'Its cloth-bound knuckles are white, and its crooked jaw rattles as it waits ' +
                'for you to try.'
              : skeletonTalked(w) || skeletonSwung(w)
                ? 'It watches every move you make. By the light of one small candle you cannot ' +
                  'make out much more of it than that.'
                : 'Its empty eyes have been on you since you woke, and its jaw works as though ' +
                  'it has something to say to you.'),
    examine:
      'Up close the skeleton is in better shape than you would like. Its knuckles are bound in ' +
      "strips of old cloth, the way a fighter's are, and the cloth is stained dark. But its jaw " +
      'hangs crooked, held on by a single twist of rusted wire, and it rattles when the thing ' +
      'speaks. One good blow there might do it.',
    beforeAttack: (w) => {
      if (skeletonFetched(w)) {
        return 'The skeleton does not even look up. "We will never speak of this," it says.';
      }
      if (skeletonBeaten(w)) {
        return 'The skeleton holds up a bony hand in defeat. "Once was enough. My jaw is still ringing."';
      }
      return undefined;
    },
    brawl: brawlSkeleton,
    immune:
      '"Put that down," says the skeleton. "Hands only. I do not have the skin for anything ' +
      'else."',
    refuseTake: 'The skeleton slaps your hand away.',
  }),

  creature('dragon', {
    name: 'dragon',
    aliases: ['beast', 'body', 'corpse', 'carcass', 'entrails'],
    adjectives: ['giant', 'sleeping', 'dead'],
    location: 'dragonCell',
    killable: true,
    weakTo: ['sword', 'spear', 'staff'],
    description: (w) =>
      dragonBlocks(w)
        ? dragonBlockedText(w)
        : w.flag('dragonEstranged')
          ? 'The dragon lies with his back to you. The passage east is open. He does not turn round.'
          : w.flag('dragonRevived')
            ? 'The dragon lies awake and watches you. He is deciding about you, and he is in no ' +
              'hurry. The passage east is open.'
            : dragonTamed(w)
              ? 'The dragon lies across the cell with a long scar upon his neck. He lifts his ' +
                'head when you come in, and waits for your word. The passage east is open.'
              : dragonFriend(w)
                ? 'The dragon lies with his chin on his claws and watches you with one sleepy, ' +
                  'friendly eye. His tail no longer blocks the passage east.'
                : 'There is a giant dragon lying asleep in front of you. He seems to be guarding a ' +
                  'passageway headed east.',
    deadDescription:
      'You see the giant dragon you had slain with his entrails strewn across the stone floor. ' +
      'There is a passage that leads you east.',
    examine: (w) =>
      dragonFriend(w)
        ? 'Up close, the dragon is mostly ribs and patience.' +
          (w.flag('dragonRevived') ? '' : ' He is a better colour since he ate.') +
          ' His scales are polished as bright as mirrors, every one.' +
          (dragonTamed(w) ? ' A long scar runs down his neck, where your blow fell.' : '')
        : 'The dragon is enormous, scaly and very much asleep. A thin curl of smoke drifts from ' +
          "one nostril. He guards the passage east as if he's being paid to. He is also thinner " +
          'than a dragon should be. His stomach makes a long, hollow sound, and he mumbles ' +
          'something in his sleep that could be "mutton".',
    beforeAttack: (w) => {
      if (dragonDoubts(w)) {
        return (
          'The dragon watches your hand. "First you lie to me," he says, "and then this?" You ' +
          'put the weapon away.'
        );
      }
      if (dragonBlocks(w)) {
        if (!worthyWeapon(w)) return '"A worthy weapon," says the dragon. "I said."';
        w.say('"Ah," says the dragon, and gets up. "Now you have something to fight with."');
        challengeDragon(w);
        return '';
      }
      return w.flag('dragonRevived')
        ? 'No. Not again.'
        : dragonTamed(w)
          ? 'He bowed his head to you once. You put the weapon away.'
          : dragonFriend(w)
            ? 'The dragon trusts you now. You look at the weapon in your hand, and put it away.'
            : undefined;
    },
    refuseTake: 'You cannot be serious.',
    alreadyDead: 'The dragon is already dead. Why must you be such a brute?',
    bareHanded:
      'You roll up your sleeves and punch the dragon squarely on the snout. He opens one ' +
      'enormous eye, regards you the way you might regard an ambitious moth, and goes back to ' +
      'sleep.',
    notWorthy: (w, weapon) =>
      (<Record<string, string>>{
        knife:
          'You jab the dragon with the knife. He snores, and a puff of smoke singes your ' +
          "eyebrows. You'll need something with a bit more reach.",
        hammer:
          'You bonk the dragon on the toe with the hammer. He twitches in his sleep, possibly ' +
          "enjoying a pleasant dream. You decide that's enough excitement for one day.",
        bone: 'You wave the bone at the dragon. The dragon is not a dog. The dragon does not fetch.',
        key: 'You try to unlock the dragon. Dragons do not have keyholes. You checked.',
        torch: 'You threaten a dragon with fire. The dragon, asleep, does not dignify this.',
        flower:
          "You tuck the flower behind the dragon's ear. It looks lovely. He is still very much alive.",
        mutton:
          'You slap the dragon with a leg of mutton. His nose twitches. You have the feeling ' +
          'that you hold the right thing the wrong way.',
        boots: 'You throw a boot at the dragon. It bounces off without a sound. Felt, you see.',
      })[weapon] ??
      `You wave the ${w.thing(weapon).name} at the dragon threateningly. ` +
        'The dragon remains spectacularly unthreatened.',
  }),

  creature('troll', {
    name: 'troll',
    aliases: ['body', 'corpse'],
    adjectives: ['dead'],
    location: 'garden',
    killable: true,
    weakTo: ['spear', 'staff'],
    description: (w) =>
      trollSulks(w) && w.locationOf('troll') === 'gazebo'
        ? 'The troll sits at the edge of the gazebo, gazing at the mountains, with his back to ' +
          'you. The torch is on the far side of him.'
        : trollGrieves(w)
          ? w.flag('trollToldTruth')
            ? 'The troll sits in the grass by the path with both hands over his face.'
            : 'The troll stands on the garden path with his club in both hands. His eyes are ' +
              'red. He looks at you, and then past you, south, toward the castle where his ' +
              'friend lies.'
          : w.flag('trollRevived')
            ? `The troll sits a little way off ${w.locationOf('troll') === 'gazebo' ? 'by the gazebo rail' : 'the garden path'} ` +
              'and watches you carefully. His hand is not over his mouth.'
            : trollFriend(w) && w.isDead('dragon')
              ? 'The troll sits by the garden path with his club across his knees, and looks ' +
                'south toward the castle. He is not practising any words today.'
              : trollFriend(w)
                ? 'The troll sits by the garden path and practises words out loud. "Garden. Club. ' +
                  'Tooth." He waves when he sees you.'
                : 'A troll is wandering in the garden. He swings his massive club in the air ' +
                  'every now and then.',
    deadDescription: (w) =>
      w.flag('trollFought')
        ? 'The troll lies in the grass with his face toward the castle. Beyond him, the path ' +
          'runs on north to the gazebo.'
        : w.locationOf('troll') === 'gazebo'
          ? 'The troll lies dead by the gazebo rail, still facing the mountains.'
          : 'The troll lies dead on the grass. His tongue sticks out of his mouth making for an ' +
            'extremely unpleasant sight. Beyond him, the path runs on north to the gazebo.',
    examine: (w) =>
      'The troll is large, green and smells like a wet sock.' +
      (trollGrieves(w)
        ? ' His eyes are red, and his knuckles are white upon the club. He does not hide his ' +
          'mouth now. One of his front teeth is broken in half.'
        : ' He swings his club absent-mindedly, like someone twirling a pen in a meeting.' +
          (trollFriend(w)
            ? ' One of his front teeth is broken in half. He does not hide it.'
            : ' He keeps one huge hand over his mouth, even when he talks.')),
    // with his friend dead, the troll will not go down in one blow
    beforeAttack: (w) =>
      trollGrieves(w)
        ? (attackGrievingTroll(w), '')
        : w.flag('trollRevived')
          ? 'No. Not again.'
          : trollFriend(w)
            ? 'The troll waves at you with the club. You lower your weapon and wave back.'
            : undefined,
    refuseTake: 'How were you even planning on doing that? And more importantly, why?',
    alreadyDead: 'The troll lies dead in front of you. How much more do you want to kill him?',
    bareHanded: (w) =>
      'You punch the troll in the belly. He giggles, which is somehow worse. Then he remembers ' +
      'he is holding a club.\n' +
      clubbed(w),
    notWorthy: (w, weapon) =>
      ((<Record<string, string>>{
        bone: 'You swing the bone at the troll. He looks deeply offended. Trolls are vegetarian, apparently.',
        flower: 'You swat the troll with a flower. He sniffs it, sneezes, and swings his club.',
        sword: "The troll's club is longer than your sword, and the troll is longer than you.",
      })[weapon] ?? `You size up the troll's club, then your ${w.thing(weapon).name}. Too late.`) +
      '\n' +
      clubbed(w, weapon),
  }),
];
