import { defineGame } from '../../dsl';
import { commands } from './commands';
import { creatures } from './creatures';
import { items } from './items';
import { rooms } from './rooms';
import { hooks, rankInfo } from './story';

/** The original pyzork map: wake in a crypt, find your way home. */
export const crypt = defineGame({
  id: 'crypt',
  title: 'Zork',
  intro: [
    'This is a text adventure. You control your character by typing commands such as ' +
      '"look", "open door" or "go east". Type HELP at any time for more.',
    'Hope you have fun with the game! Happy adventuring!',
  ],
  start: 'start',
  rooms,
  things: [...items, ...creatures],
  commands,
  hooks,
  rank: rankInfo,
  synonyms: { attack: ['spar', 'box', 'wrestle'] },
});
