import { creature, revealExit, say } from '../../dsl';

export const creatures = [
  creature('dragon', {
    name: 'dragon',
    aliases: ['beast'],
    adjectives: ['giant', 'sleeping', 'dead'],
    location: 'dragonCell',
    killable: true,
    weakTo: ['sword', 'spear', 'staff'],
    description:
      'There is a giant dragon lying asleep in front of it. It seems to be guarding a passageway ' +
      'headed east.',
    deadDescription:
      'You see the giant dragon you had slain with its entrails strewn across the stone floor. ' +
      'There is a passage that leads you east.',
    refuseTake: 'You cannot be serious.',
    alreadyDead: 'The dragon is already dead. Why must you be such a brute?',
    onKill: [say('The passageway leading to the east opens up.')],
  }),

  creature('troll', {
    name: 'troll',
    adjectives: ['dead'],
    location: 'portcullis',
    killable: true,
    weakTo: ['spear', 'staff'],
    description:
      'A troll is wandering in the garden outside. It swings its massive club in the air every ' +
      'now and then.',
    deadDescription:
      'The troll lies dead on the grass. His tongue sticks out of his mouth making for an ' +
      'extremely unpleasant sight. You see a huge open space with a garden to the north.',
    refuseTake: 'How were you even planning on doing that? And more importantly, why?',
    alreadyDead: 'The troll lies dead in front of you. How much more do you want to kill it?',
    onKill: [revealExit('north'), say('It seems you can now walk about in the garden freely.')],
  }),
];
