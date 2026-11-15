import { item, spawnItem } from '../../dsl';

export const items = [
  // ---- crypt ----
  item('candle', {
    examine:
      'A stubby candle, nearly burnt out. It has clearly been through a lot. You decide not to burden it further.',
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
    examine: 'A sturdy wooden door with an old iron handle.',
    name: 'door',
    location: 'start',
    portable: false,
    refuseTake: "You can't take the door.",
    openable: {
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
  item('chest', {
    examine:
      'An old wooden chest banded with iron. Treasure? Bones? Tax returns? Only one way to find out.',
    name: 'chest',
    location: 'dungeon',
    portable: false,
    description: 'You see a chest on the floor.',
    refuseTake: 'The chest is too heavy to lift.',
    openable: {
      openMessage: 'You open the chest and find a key inside.',
      alreadyOpen: 'The chest is already open.',
      onOpen: [spawnItem('key')],
    },
  }),
  item('key', {
    examine: 'A heavy iron key. It looks like it opens something important. Most keys do.',
    name: 'key',
    adjectives: ['single'],
    location: 'nowhere',
    portable: true,
    description: 'A single key lies inside the chest on a velvet cloth.',
    takeMessage: 'You have a key. But you do not know what it opens.',
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

  // ---- garden and beyond ----
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
      "The flame burns a peculiar bright red. Oddly, the wind doesn't seem to bother it at all. Water, though, might be another story.",
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
  item('poster', {
    examine: "The poster reads 'There is no place like 127.0.0.1.' You're beginning to agree.",
    name: 'poster',
    location: 'devRoom',
    portable: false,
    description: "A programmer's joke poster hangs on the wall.",
    refuseTake: 'You chuckle at the nerdy humor.',
  }),
];
