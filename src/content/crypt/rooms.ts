import { door, flag, guarded, room } from '../../dsl';
import type { World } from '../../engine/world';
import { dragonAsleep, ending, trollFriend } from './story';

// every game over leaves one more bone in the crypt
const newBones = (w: World): string =>
  w.deaths === 0
    ? ''
    : w.deaths === 1
      ? ' Someone has added a bone to the pile since you were last here. You decide not to think about who.'
      : ` Someone has added to the bones since you were last here. You count ${w.deaths} new ones. You decide not to think about who.`;

export const rooms = [
  room('start', {
    name: 'Crypt',
    description: (w) =>
      'You find yourself in a dark empty crypt. There is an eerie feel to this place, and you do ' +
      'not feel comfortable at all. You need to get home. There is a door to the east.' +
      newBones(w),
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
      east: guarded(
        'portcullis',
        (w) => !dragonAsleep(w) || w.has('boots'),
        "The dragon's bulk fills the passage to the east. You won't get past it while it lives. " +
          'Not with feet as loud as yours, at least.',
      ),
    },
  }),

  room('dungeon', {
    name: 'Dungeon',
    description:
      'You enter a small dungeon where you see ancient runes scrawled across the walls. The ' +
      'stairs lead back south, up to the cell and the something big that sleeps in it. A low ' +
      'door to the west has a brass plate on it: KEEPER.',
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
      "narrow door to the north seems to lead back toward the dragon's lair. A tight spiral " +
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
      // the troll moves aside once it is a friend or once it cannot object
      north: guarded(
        'garden',
        (w) => w.isDead('troll') || trollFriend(w),
        "The troll steps in front of you. 'Nub,' it says behind its hand, and shakes its " +
          'head. It does not look angry. It looks like it is waiting for something.',
      ),
      // The stream only parts once its riddle is answered (see the answer command).
      south: guarded(
        'river',
        flag('streamParted'),
        (w) =>
          "The stream says to you, 'It eats many things; it fears me but not the wind. But give " +
          "me enough and I will subside momentarily.' You cannot get past the stream. It seems " +
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
      'beautiful scene in the garden. Behind you, you see the castle. There is a gazebo up north.',
    exits: { south: 'portcullis', north: 'gazebo' },
  }),

  room('gazebo', {
    name: 'Gazebo',
    description:
      'You are at a gazebo. You see snow-festooned mountain peaks that extend and meet the ' +
      'horizon in the north. Below you there is nothing but the deepest valley you have ever ' +
      'seen. You hear a strange sound emanating from the east.',
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
      "This small chamber houses humming computers. A poster reads 'There is no place like " +
      "127.0.0.1.' A narrow doorway to the south leads back to the library.",
    exits: { south: 'library' },
  }),

  room('end', {
    name: 'Forest',
    description:
      'You cross the river and find yourself in a huge forest. It looks vaguely familiar. ' +
      'Suddenly a group of tribesmen come out and greet you. Oddly enough, you understand their ' +
      'tongue, and they treat you as one of their own, not feeling threatened by you at all. It ' +
      'hits you then; you have reached home.',
    onEnter: [ending],
  }),
];
