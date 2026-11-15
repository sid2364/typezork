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
    examine:
      'The dragon is enormous, scaly and very much asleep. A thin curl of smoke drifts from one ' +
      "nostril. It guards the passage east as if it's being paid to.",
    refuseTake: 'You cannot be serious.',
    alreadyDead: 'The dragon is already dead. Why must you be such a brute?',
    bareHanded:
      'You roll up your sleeves and punch the dragon squarely on the snout. It opens one ' +
      'enormous eye, regards you the way you might regard an ambitious moth, and goes back to ' +
      'sleep. Your knuckles will remember this.',
    notWorthy: (w, weapon) =>
      (<Record<string, string>>{
        knife:
          'You jab the dragon with the knife. It snores, and a puff of smoke singes your ' +
          "eyebrows. You'll need something with a bit more reach.",
        hammer:
          'You bonk the dragon on the toe with the hammer. It twitches in its sleep, possibly ' +
          "enjoying a pleasant dream. You decide that's enough excitement for one day.",
        bone: 'You wave the bone at the dragon. The dragon is not a dog. The dragon does not fetch.',
        key: 'You try to unlock the dragon. Dragons do not have keyholes. You checked.',
        torch: 'You threaten a dragon with fire. The dragon, asleep, does not dignify this.',
        flower:
          "You tuck the flower behind the dragon's ear. It looks lovely. It is still very much alive.",
      })[weapon] ??
      `You wave the ${w.thing(weapon).name} at the dragon threateningly. ` +
        'The dragon remains spectacularly unthreatened.',
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
    examine:
      'The troll is large, green and smells like a wet sock. It swings its club absent-mindedly, ' +
      'like someone twirling a pen in a meeting.',
    refuseTake: 'How were you even planning on doing that? And more importantly, why?',
    alreadyDead: 'The troll lies dead in front of you. How much more do you want to kill it?',
    bareHanded:
      'You punch the troll in the belly. It giggles, which is somehow worse. Then it remembers ' +
      'it is holding a club, and you remember you have somewhere else to be.',
    notWorthy: (w, weapon) =>
      (<Record<string, string>>{
        bone: 'You offer the troll the bone. It looks deeply offended. Trolls are vegetarian, apparently.',
        flower:
          'You present the troll with a flower. It sniffs it, sneezes, and swings its club at you anyway.',
        sword:
          "The troll's club is longer than your sword, and the troll is longer than you. " +
          'You decide to live and let live.',
      })[weapon] ??
      `You size up the troll's club, then your ${w.thing(weapon).name}. ` +
        'You decide to live and let live.',
    onKill: [revealExit('north'), say('It seems you can now walk about in the garden freely.')],
  }),
];
