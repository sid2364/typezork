import { creature } from '../../dsl';
import type { World } from '../../engine/world';
import { brawlSkeleton, challengeDragon } from './dialogue';
import {
  dragonBlockedText,
  dragonBlocks,
  dragonDoubts,
  dragonFriend,
  POINTS,
  skeletonBeaten,
  skeletonClue,
  skeletonFetched,
  skeletonTalked,
  trollFriend,
  trollSulks,
  worthyWeapon,
} from './story';

// the troll's club, for anyone who brings the wrong thing to a fight with it
function clubbed(w: World, weapon?: string): string {
  w.award('clubbed', POINTS.clubbed);
  if (w.here === 'gazebo') {
    w.state.location = 'garden';
    return (
      'The troll does not even turn round. The club comes back over his shoulder, quite ' +
      'gently for a club, and you go down the gazebo steps in one go, and land in the flowers. ' +
      'Small ones. You hope he did not see.'
    );
  }
  const lost = weapon ? w.thing(weapon).name : undefined;
  if (weapon) w.move(weapon, 'nowhere');
  const torch = w.has('torch');
  if (torch) w.move('torch', 'gazebo');
  return (
    'The troll swings his club, not even very hard. You fly backwards over the bank and into ' +
    'the stream, which is much colder than it looked.' +
    (lost ? ` Your ${lost} goes one way and you go the other. Only you come back.` : '') +
    (torch
      ? ' The torch hisses out in your hand and is gone. Far to the north, a red glow comes ' +
        'back to the edge of the gazebo, as if nothing happened.'
      : '') +
    ' You crawl out on the bank, soaked, and the troll is back to swinging his club as if ' +
    'nothing happened.'
  );
}

export const creatures = [
  // holds the crypt door until you talk to it, look at it and spar with it
  creature('skeleton', {
    name: 'skeleton',
    aliases: ['skull'],
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
            (!skeletonTalked(w)
              ? 'It looks like it wants to have a conversation.'
              : !skeletonClue(w)
                ? 'It watches you, and waits for you to take a closer look.'
                : 'Its cloth-wrapped knuckles are white. It is waiting for a fight.'),
    examine:
      'Up close, the skeleton seems in better shape than you would expect. Its knuckles are ' +
      "wrapped in strips of old cloth, the way a boxer's are. It just wants a good clean fight.",
    beforeAttack: (w) => {
      if (skeletonFetched(w)) {
        return 'The skeleton does not even look up. "We will never speak of this," it says.';
      }
      if (skeletonBeaten(w)) {
        return 'The skeleton holds up a bony hand in defeat. "Once was enough. My ribs are still ringing."';
      }
      if (!skeletonTalked(w)) {
        return (
          'The skeleton lets go of the door with one hand, just long enough to wag a finger ' +
          'at you. Manners. It looks like it wants a conversation first.'
        );
      }
      if (!skeletonClue(w)) {
        return '"Do you even know what you\'re dealing with?" asks the skeleton. "Look closer."';
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
    aliases: ['beast'],
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
        ? 'Up close, the dragon is mostly ribs and patience. He is a better colour since he ate. ' +
          'His scales are polished as bright as mirrors, every one.'
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
    adjectives: ['dead'],
    location: 'portcullis',
    killable: true,
    weakTo: ['spear', 'staff'],
    description: (w) =>
      trollSulks(w) && w.locationOf('troll') === 'gazebo'
        ? 'The troll sits at the edge of the gazebo, gazing at the mountains, with his back to ' +
          'you. The torch is on the far side of him.'
        : w.flag('trollRevived')
          ? 'The troll sits a little way off the garden path and watches you carefully. His hand ' +
            'is not over his mouth.'
          : trollFriend(w)
            ? 'The troll sits by the garden path and practises words out loud. "Garden. Club. ' +
              'Tooth." He waves when he sees you.'
            : 'A troll is wandering in the garden outside. He swings his massive club in the air ' +
              'every now and then.',
    deadDescription: (w) =>
      w.locationOf('troll') === 'gazebo'
        ? 'The troll lies dead by the gazebo rail, still facing the mountains.'
        : 'The troll lies dead on the grass. His tongue sticks out of his mouth making for an ' +
          'extremely unpleasant sight. You see a huge open space with a garden to the north.',
    examine: (w) =>
      'The troll is large, green and smells like a wet sock. He swings his club absent-mindedly, ' +
      'like someone twirling a pen in a meeting.' +
      (trollFriend(w)
        ? ' One of his front teeth is broken in half. He does not hide it.'
        : ' He keeps one huge hand over his mouth, even when he talks.'),
    beforeAttack: (w) =>
      w.flag('trollRevived')
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
