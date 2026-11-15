import { item, spawnItem } from '../../dsl';

export const items = [
  // ---- crypt ----
  item('candle', {
    name: 'candle',
    adjectives: ['small', 'burning'],
    location: 'start',
    portable: false,
    description: 'The only light source is a small candle burning in the corner.',
    refuseTake: "It's almost out, and is stuck fast to the ground.",
  }),
  item('bone', {
    name: 'bone',
    aliases: ['bones', 'pile'],
    location: 'start',
    portable: true,
    description: 'You see a pile of bones in front of you.',
    takeMessage: 'You now have a bone.',
  }),
  item('door', {
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
    name: 'key',
    adjectives: ['single'],
    location: 'nowhere',
    portable: true,
    description: 'A single key lies inside the chest on a velvet cloth.',
    takeMessage: 'You have a key. But you do not know what it opens.',
  }),

  // ---- armoury ----
  item('window', {
    name: 'window',
    aliases: ['windows'],
    adjectives: ['large'],
    location: 'weaponsRoom',
    portable: false,
    refuseTake: 'Be serious.',
  }),
  item('sword', {
    name: 'sword',
    location: 'weaponsRoom',
    portable: true,
    takeMessage: 'Good choice. You now have a sword.',
  }),
  item('spear', {
    name: 'spear',
    location: 'weaponsRoom',
    portable: true,
    takeMessage: 'Great choice! You now have a spear.',
  }),
  item('knife', {
    name: 'knife',
    aliases: ['knives'],
    location: 'weaponsRoom',
    portable: true,
    takeMessage: 'You now have a knife.',
  }),
  item('hammer', {
    name: 'hammer',
    location: 'weaponsRoom',
    portable: true,
    takeMessage: 'You now have a hammer.',
  }),
  item('staff', {
    name: 'staff',
    aliases: ['stave', 'staves'],
    location: 'weaponsRoom',
    portable: true,
    takeMessage: 'Excellent choice. You now have a staff.',
  }),

  // ---- garden and beyond ----
  item('flower', {
    name: 'flower',
    aliases: ['flowers'],
    adjectives: ['wild', 'exotic'],
    location: 'garden',
    portable: true,
    takeMessage: 'The sweet scent of the flower fills your senses.',
  }),
  item('torch', {
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
    name: 'duck',
    adjectives: ['rubber'],
    location: 'library',
    portable: false,
    description: 'A rubber duck sits proudly on the desk.',
    refuseTake: 'The duck silently listens to your problems.',
  }),
  item('poster', {
    name: 'poster',
    location: 'devRoom',
    portable: false,
    description: "A programmer's joke poster hangs on the wall.",
    refuseTake: 'You chuckle at the nerdy humor.',
  }),
];
