import { door, flag, guarded, room } from '../../dsl';
import {
  bothDead,
  dragonAsleep,
  dragonBlockedText,
  dragonBlocks,
  ending,
  trollFriend,
  trollGrieves,
} from './story';

export const rooms = [
  room('start', {
    name: 'Crypt',
    description:
      'You find yourself in a dark empty crypt. There is an eerie feel to this place, and you do ' +
      'not feel comfortable at all. You need to get home. There is a door to the east.',
    exits: { east: door('door', 'dragonCell') },
    pos: [0, 0],
  }),

  room('dragonCell', {
    name: "Dragon's Cell",
    description:
      'You see a staircase leading into the darkness in the north and a steel gate to the south.',
    exits: {
      west: 'start',
      north: 'dungeon',
      south: door('gate', 'weaponsRoom'),
      // dead or fed or you wear the felt boots, the sneak itself is a hook in story.ts
      // fed but challenged to a fight you could not take up, he blocks the way awake
      east: guarded(
        'portcullis',
        (w) => (!dragonAsleep(w) && !dragonBlocks(w)) || (dragonAsleep(w) && w.has('boots')),
        (w) =>
          dragonBlocks(w)
            ? dragonBlockedText(w)
            : "The dragon's bulk fills the passage to the east. You won't get past him while he " +
              'lives. Not with feet as loud as yours, at least.',
      ),
    },
  }),

  room('dungeon', {
    name: 'Dungeon',
    description:
      'You enter a small dungeon where you see ancient runes scrawled across the walls. The ' +
      'stairs lead back south, up to the cell and the something big that sleeps in it.',
    exits: { south: 'dragonCell', west: 'keeper' },
  }),

  room('keeper', {
    name: "Keeper's Quarters",
    description:
      'A small, tidy room. Someone lived here and left in the middle of an ordinary day: the ' +
      'bed is made, a cup stands on the table, and a coat still hangs behind the door. The only ' +
      'way out is back east, into the dungeon.',
    exits: { east: 'dungeon' },
  }),

  room('weaponsRoom', {
    name: 'Armoury',
    description:
      'You enter a room full of weapons. You see swords, knives, spears, staves, and hammers ' +
      'displayed all around you. Large windows illuminate the room with the daylight outside. A ' +
      "steel gate to the north leads back toward the dragon's lair. A tight spiral " +
      'stair in the corner climbs up.',
    exits: { north: 'dragonCell', up: 'tower' },
  }),

  room('tower', {
    name: 'Tower Room',
    description:
      'You climb to a round room at the top of the tower. It was a dressing room once. Dust ' +
      'covers the table, the chair and the floor. It does not cover the jewelled box in the ' +
      'middle of the floor, which sits exactly where you would put a box if you wanted someone ' +
      'to look at it. The stair goes back down.',
    exits: { down: 'weaponsRoom' },
    pos: [0, 1],
  }),

  room('portcullis', {
    name: 'Portcullis',
    description:
      'A portcullis is drawn up. You are standing just outside a sprawling castle with dark ' +
      'walls. To your south there is a fast flowing stream. An archway to the west heads back ' +
      "toward the dragon's cell.",
    exits: {
      west: 'dragonCell',
      // the troll moves aside once it is a friend, once it is hurt, or once it cannot object
      north: guarded(
        'garden',
        (w) => w.isDead('troll') || trollFriend(w) || Boolean(w.flag('trollHurt')),
        (w) =>
          trollGrieves(w)
            ? 'The troll steps in front of you and lifts his club. "Nub," he says. ' +
              '"Him sleep. You blug."'
            : 'The troll steps in front of you. "Nub," he says behind his hand, and shakes his ' +
              'head. He does not look angry. He looks like he is waiting for something.',
      ),
      // The stream only parts once its riddle is answered (see the answer command).
      south: guarded(
        'river',
        flag('streamParted'),
        (w) =>
          'The stream says to you, "It eats many things; it fears me but not the wind. But give ' +
          'me enough and I will subside momentarily." You cannot get past the stream. It seems ' +
          'to be waiting for an answer.' +
          (w.has('torch') ? ' The torch in your hand flickers.' : ''),
      ),
    },
  }),

  room('river', {
    name: 'River',
    description:
      "You are at the river. It's flowing north, back past the castle. On the other side of the " +
      'river in the east you see a deep, dark forest.',
    // The old map had no way back from here; north returns to the castle.
    exits: { east: 'end', north: 'portcullis' },
  }),

  room('garden', {
    name: 'Garden',
    description:
      'Wild flowers with exotic fragrances bloom about you and the light of day makes for a ' +
      'beautiful scene in the garden. There is a gazebo up north, and to the south a path leads to the castle.',
    exits: { south: 'portcullis', north: 'gazebo' },
  }),

  room('gazebo', {
    name: 'Gazebo',
    description:
      'You are at a gazebo. You see snow-festooned mountain peaks that extend and meet the ' +
      'horizon in the north. Below you there is nothing but the deepest valley you have ever ' +
      'seen. To the south, is the fragrant garden whose scent fills the air even here.' +
      ' You hear a strange sound emanating from the east.',
    exits: { south: 'garden', east: 'library' },
  }),

  room('library', {
    name: 'Library',
    description:
      'Shelves of dusty books line this cosy hidden library. You hear a strange sound emanating ' +
      'from the north and can see the gazebo entrance to the west.',
    exits: { west: 'gazebo', north: 'devRoom' },
  }),

  room('devRoom', {
    name: 'Dev Room',
    description:
      'This small chamber houses humming computers. A poster reads "There is no place like ' +
      '127.0.0.1." A narrow doorway to the south leads back to the library.',
    exits: { south: 'library' },
  }),

  room('end', {
    name: 'Forest',
    description: (w) =>
      bothDead(w)
        ? 'You cross the river and come under the eaves of a great forest, and its paths are ' +
          'known to you, as a dream is known in waking. Folk of the wood come out to greet you, ' +
          'and halt, and look long upon your trembling hands. Then they draw back among the ' +
          'trunks.'
        : 'You cross the river into a huge forest that looks oddly familiar. A band of ' +
          'tribesmen comes out of the trees to greet you. You understand their tongue, and they ' +
          'treat you as one of their own. It hits you then: you have reached home.',
    onEnter: [ending],
  }),
];
