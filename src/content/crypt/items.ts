import { item, lose, spawnItem } from '../../dsl';
import { skeletonBeaten, skeletonTalked } from './story';

export const items = [
  // ---- crypt ----
  item('candle', {
    examine:
      'A stubby candle, nearly burnt out. It has clearly been through a lot. You decide not to ' +
      'burden it further.',
    name: 'candle',
    adjectives: ['small', 'burning'],
    location: 'start',
    portable: false,
    description: 'The only light source is a small candle burning in the corner.',
    refuseTake: "It's almost out, and is stuck fast to the ground.",
  }),
  item('bone', {
    examine:
      "It's a bone. Possibly belonged to a previous adventurer who didn't read the help screen.",
    name: 'bone',
    aliases: ['bones', 'pile'],
    location: 'start',
    portable: true,
    description: 'You see a pile of bones in front of you.',
    takeMessage: 'You now have a bone.',
  }),
  item('door', {
    examine: (w) =>
      'A sturdy wooden door with an old iron handle. The bolt is on this side. Whoever shut ' +
      'this door did it from where you stand.' +
      (skeletonBeaten(w)
        ? ''
        : " The skeleton's hands are wrapped round the handle, and its knuckles are bound in " +
          "strips of old cloth, the way a boxer's are. It is not holding the door like a guard. " +
          'It is holding it like someone who wants to be made to let go.'),
    name: 'door',
    location: 'start',
    portable: false,
    refuseTake: "You can't take the door.",
    openable: {
      beforeOpen: (w) => {
        if (skeletonBeaten(w)) return undefined;
        return skeletonTalked(w)
          ? 'The skeleton holds on. "Words will not move me," it says. "You will have to make me."'
          : 'The skeleton has both hands round the handle and will not let go. It tilts its ' +
              'skull at you, the way people do when they are waiting for you to say something.';
      },
      openMessage: 'The door opens revealing a path towards the east.',
      alreadyOpen: 'The door is already open.',
    },
  }),

  // ---- dragon's cell ----
  item('gate', {
    examine:
      'A steel gate, the kind that says "authorised personnel only" without using any words.',
    name: 'gate',
    adjectives: ['steel'],
    location: 'dragonCell',
    portable: false,
    refuseTake: "You can't take the gate.",
    openable: {
      lockedBy: 'key',
      lockedMessage: 'The gate is locked.',
      unlockMessage: 'You turn the key in the lock. The gate is unlocked.',
      openMessage: 'The gate opens, you see daylight coming through from behind it.',
      alreadyOpen: 'The gate is already open.',
    },
  }),

  // ---- dungeon ----
  item('runes', {
    name: 'runes',
    aliases: ['rune', 'walls', 'wall', 'writing'],
    adjectives: ['ancient'],
    location: 'dungeon',
    portable: false,
    examine:
      'You cannot read them. But when you trace one with your finger, your hand finishes the ' +
      'stroke before your eye has found the end of it. Your hand has made this shape before.',
    refuseTake: 'The runes are part of the wall. The wall is part of the castle. No.',
  }),
  item('mutton', {
    name: 'mutton',
    aliases: ['meat', 'leg', 'food', 'leg of mutton'],
    adjectives: ['cured'],
    location: 'dungeon',
    portable: true,
    description: 'A leg of cured mutton hangs from a hook in the ceiling.',
    examine:
      'A whole leg of mutton, cured with salt and smoke. Someone hung it here with care.' +
      ' The other hooks are empty.',
    takeMessage:
      'You unhook the mutton. It is heavy, and it smells wonderful. You feel sure that ' +
      'somebody is missing it.',
  }),
  item('chest', {
    examine: (w) =>
      !w.isOpen('chest')
        ? 'An old wooden chest banded with iron. Treasure? Bones? Tax returns? Only one way to find out.'
        : w.hasMoved('key')
          ? 'An old wooden chest banded with iron. It held a key once. Now it holds a velvet cloth.'
          : 'An old wooden chest banded with iron. Inside, a single key lies on a velvet cloth.',
    name: 'chest',
    location: 'dungeon',
    portable: false,
    description: 'You see a chest on the floor.',
    refuseTake: 'The chest is too heavy to lift.',
    openable: {
      openMessage: (w) =>
        w.hasMoved('key')
          ? 'You open the chest. There is nothing inside but a velvet cloth.'
          : 'You open the chest and find a key inside.',
      alreadyOpen: 'The chest is already open.',
      onOpen: [spawnItem('key')],
    },
  }),
  item('key', {
    examine: 'A heavy iron key. It looks like it opens something important. Most keys do.',
    name: 'key',
    adjectives: ['single'],
    location: 'nowhere',
    inside: 'chest',
    portable: true,
    description: 'A single key lies inside the chest on a velvet cloth.',
    takeMessage: 'You have a key. But you do not know what it opens.',
  }),

  // ---- keeper's quarters ----
  item('boots', {
    name: 'boots',
    aliases: ['boot', 'pair of boots'],
    adjectives: ['felt', 'soft'],
    location: 'keeper',
    portable: true,
    description: 'A pair of felt boots stands by the bed, side by side, as if waiting.',
    examine:
      'Thick felt soles, as soft as moss. The keeper wore them to walk past something without ' +
      'waking it. They will make your feet quiet. They can do nothing about the rest of you.',
    takeMessage:
      'You pull the boots on. They fit. Your steps make no sound at all, which is a strange ' +
      'thing to hear.',
  }),
  item('ledger', {
    name: 'ledger',
    aliases: ['book', 'page'],
    adjectives: ['feeding'],
    location: 'keeper',
    portable: false,
    description: 'A ledger lies open on the table.',
    examine:
      "The keeper's feeding ledger. Every day has the same line, in the same careful hand: " +
      '"One leg of mutton." The entries stop in the middle of a page.',
    refuseTake: 'It belongs on this table. You leave it open at the last page, the way it was.',
  }),
  item('note', {
    name: 'note',
    aliases: ['notes', 'paper'],
    location: 'keeper',
    portable: false,
    description: 'A note is pinned to the wall above the bed.',
    examine:
      '"The gardener is NOT dangerous. Remind him of himself.' +
      '\nNUB is no.\nZUG is see.\nMOG is face.\nGRAK is tooth.\nHUM is good.\n' +
      'BLUG is bad.\nHOOM is home."',
    refuseTake: 'You leave the note where the keeper pinned it. You have read it. That is enough.',
  }),
  item('bowl', {
    name: 'bowl',
    adjectives: ['enormous', 'feeding'],
    location: 'keeper',
    portable: false,
    description: 'An enormous bowl stands by the door, licked clean.',
    examine:
      'A feeding bowl the size of a cartwheel. A name is painted on the side in a careful ' +
      'hand, but the paint is too worn to read. Somebody loved whatever ate from this.',
    refuseTake: 'It is the size of a cartwheel. Also, it is not yours.',
  }),

  // ---- tower room ----
  item('mirror', {
    name: 'mirror',
    aliases: ['looking glass', 'glass'],
    adjectives: ['hand', 'small', 'silver'],
    location: 'tower',
    portable: true,
    description: 'A small hand mirror lies face down on the dressing table.',
    examine:
      'A small silver hand mirror. It shows you a face with two painted lines under each eye. ' +
      'You look for a long time. It is a little like being introduced to someone.',
    takeMessage: 'You take the mirror. You do not look into it yet. You are not sure why.',
  }),
  item('box', {
    name: 'box',
    aliases: ['wire', 'lid'],
    adjectives: ['jewelled', 'jeweled'],
    location: 'tower',
    portable: false,
    examine: (w) =>
      w.state.shownOnce.includes('examined:box')
        ? 'The box sits there and sparkles. The thin wire still runs from its lid into the ' +
          'floor. It still wants to be opened. You still should not.'
        : 'You lean in for a good look. Something inside the box clicks, and a cloud of black ' +
          'soot hits you in the face. When you can see again, you notice the thin wire that ' +
          'runs from the lid into the floor. The box wants to be opened. Do not open it.',
    refuseTake:
      'You reach for the box. Then you notice the thin wire that runs from it into the floor. ' +
      'You take your hand back and count your fingers.',
    openable: {
      openMessage: 'You lift the lid. The wire goes tight.',
      onOpen: [
        lose(
          'The floor of the tower room is a trapdoor, and now it is open. You fall for a long ' +
            'time. You have time to think that the wire was really quite easy to see.',
        ),
      ],
    },
  }),

  // ---- armoury ----
  item('window', {
    examine: 'Large windows. Through them: daylight, freedom, and a pigeon judging you.',
    name: 'window',
    aliases: ['windows'],
    adjectives: ['large'],
    location: 'weaponsRoom',
    portable: false,
    refuseTake: 'Be serious.',
  }),
  item('sword', {
    examine: 'A fine steel sword. Remember: the pointy end goes into the other fellow.',
    name: 'sword',
    location: 'weaponsRoom',
    portable: true,
    takeMessage: 'Good choice. You now have a sword.',
  }),
  item('spear', {
    examine: 'A long spear, excellent for keeping large things at a respectful distance.',
    name: 'spear',
    location: 'weaponsRoom',
    portable: true,
    takeMessage: 'Great choice! You now have a spear.',
  }),
  item('knife', {
    examine: 'A small knife. Good for bread. Less good for dragons.',
    name: 'knife',
    aliases: ['knives'],
    location: 'weaponsRoom',
    portable: true,
    takeMessage: 'You now have a knife.',
  }),
  item('hammer', {
    examine: 'A hefty hammer. Everything is starting to look a bit like a nail.',
    name: 'hammer',
    location: 'weaponsRoom',
    portable: true,
    takeMessage: 'You now have a hammer.',
  }),
  item('staff', {
    examine: 'A tall wooden staff. You feel at least 20% more wizardly just holding it.',
    name: 'staff',
    aliases: ['stave', 'staves'],
    location: 'weaponsRoom',
    portable: true,
    takeMessage: 'Excellent choice. You now have a staff.',
  }),

  // ---- portcullis and river ----
  item('stream', {
    name: 'stream',
    aliases: ['water', 'river'],
    adjectives: ['fast', 'flowing'],
    location: 'portcullis',
    portable: false,
    examine: (w) =>
      w.flag('streamParted')
        ? 'The water stands apart in two clear walls, and waits politely for you to finish.'
        : 'The stream runs fast and clear. It looks back at you, as if it waits for you to ' +
          'say something.',
    refuseTake: 'You cup your hands. The stream runs out of them and looks pleased with itself.',
  }),
  item('water', {
    name: 'water',
    aliases: ['river', 'reflection', 'face'],
    location: 'river',
    portable: false,
    examine:
      'The river is clear near the bank, and it shows you a face. There are two painted lines ' +
      'under each eye. You do not remember painting them. Your fingers go to them at once, ' +
      'and know the way.',
    refuseTake: 'You cup your hands. The river runs out of them.',
  }),

  // ---- garden and beyond ----
  item('scale', {
    name: 'dragonscale',
    aliases: ['scale', 'dragon scale'],
    adjectives: ['polished', 'cracked', 'warm'],
    location: 'nowhere',
    portable: true,
    examine: (w) =>
      'A dragonscale the size of your palm, polished as bright as a mirror. It shows you a ' +
      'face with two painted lines under each eye.' +
      (w.flag('scaleCracked')
        ? ' A crack runs across it now. Your face is on both sides of the crack.'
        : ' You look for a long time. It is a little like being introduced to someone.'),
  }),
  item('flower', {
    examine: 'A wild flower with an exotic scent. Very pretty. Completely useless in a fight.',
    name: 'flower',
    aliases: ['flowers'],
    adjectives: ['wild', 'exotic'],
    location: 'garden',
    portable: true,
    takeMessage: 'The sweet scent of the flower fills your senses.',
  }),
  item('torch', {
    examine:
      "The flame burns a peculiar bright red. Oddly, the wind doesn't seem to bother it at all." +
      ' Water, though, might be another story.',
    name: 'torch',
    adjectives: ['flaming'],
    location: 'gazebo',
    portable: true,
    description:
      'A flaming torch lies on the edge of the gazebo. The fire shines a peculiar bright red in ' +
      'the sunlight.',
    takeMessage: 'You pick up the torch and carefully hold onto it.',
  }),
  item('duck', {
    examine:
      'A yellow rubber duck. Programmers explain their bugs to it. It has heard things no duck should hear.',
    name: 'duck',
    adjectives: ['rubber'],
    location: 'library',
    portable: false,
    description: 'A rubber duck sits proudly on the desk.',
    refuseTake: 'The duck silently listens to your problems.',
  }),
  item('scroll', {
    name: 'scroll',
    adjectives: ['red'],
    location: 'library',
    portable: true,
    description: 'A scroll with a red ribbon lies on the top shelf.',
    examine:
      'The ribbon comes off easily. The scroll says: "TO CALL BACK A STRENGTH. Stand where ' +
      'the strength fell. Read these words aloud, in your own voice. This works once. It does ' +
      'not work for those who have nothing left to read with." Under that are three lines in ' +
      'a language you do not know and, somehow, can pronounce.',
    takeMessage: 'You take the scroll. It is warmer than paper should be.',
  }),
  item('parchment', {
    name: 'parchment',
    aliases: ['recipe'],
    adjectives: ['old'],
    location: 'library',
    portable: true,
    description: 'An old parchment sticks out of a book on the desk.',
    examine:
      'A page torn from something older than the library. "TO CALL BACK A VOICE. A flower for ' +
      'the breath. A bone for the body. This page for the memory. Grind them together with ' +
      'strong hands, and pour it where the voice fell. Weak hands will only make a mess."',
    takeMessage: 'You pull the parchment free. The book lets it go, as if it kept it for you.',
  }),
  item('potion', {
    name: 'potion',
    aliases: ['bottle', 'paste'],
    location: 'nowhere',
    portable: true,
    examine:
      'A grey-green potion that smells of flowers and old paper. It is the least impressive ' +
      'miracle you have ever seen.',
  }),
  item('poster', {
    examine: `The poster reads "There is no place like 127.0.0.1." You're beginning to agree.`,
    name: 'poster',
    location: 'devRoom',
    portable: false,
    description: "A programmer's joke poster hangs on the wall.",
    refuseTake: 'You chuckle at the nerdy humor.',
  }),
  item('screen', {
    name: 'screen',
    aliases: ['computer', 'computers', 'monitor', 'terminal', 'chair'],
    location: 'devRoom',
    portable: false,
    examine:
      'One screen is on. Green text on black: "You find yourself in a dark empty crypt." ' +
      'Below it, a cursor blinks and waits for someone to type. The chair in front of it is ' +
      'still warm.',
    refuseTake: 'You get the feeling that it is not yours to move. Not from this side.',
  }),
];
