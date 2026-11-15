import type { CommandDef } from '../../engine/commands/types';
import type { World } from '../../engine/world';

/** A command that just answers with a joke. */
const quip = (id: string, verbs: string[], text: string | ((w: World) => string)): CommandDef => ({
  id,
  verbs,
  meta: true,
  run: ({ w }) => w.say(text),
});

export const commands: CommandDef[] = [
  quip(
    'xyzzy',
    ['xyzzy', 'plugh', 'abracadabra'],
    'A hollow voice says "Fool." Wrong game, I\'m afraid.',
  ),
  quip(
    'jump',
    ['jump', 'hop'],
    'You jump on the spot. Nothing happens, but you feel a little better.',
  ),
  quip(
    'sing',
    ['sing', 'hum', 'whistle'],
    'You sing a few bars. Somewhere in the dark, something sighs.',
  ),
  quip('dance', ['dance'], 'You dance like nobody is watching. Somebody is probably watching.'),
  quip(
    'sleep',
    ['sleep', 'nap'],
    'This is no place for a nap. Something around here snores louder than you.',
  ),
  quip('pray', ['pray'], 'You pray. Nobody answers, but nobody tells you off either.'),
  quip(
    'shout',
    ['shout', 'yell', 'scream'],
    'Your voice echoes back at you, sounding slightly mocking.',
  ),
  quip(
    'hello',
    ['hello', 'hi', 'hey'],
    "Hello to you too. The walls don't answer, but they look friendly enough.",
  ),
  quip(
    'swear',
    ['swear', 'curse', 'damn', 'fuck', 'shit'],
    'Such language! Somewhere, a candle flickers disapprovingly.',
  ),
  quip('swim', ['swim'], (w) =>
    w.here === 'river'
      ? 'The current would carry you straight back past the castle. Not the plan.'
      : "There's nothing to swim in here. You do a few strokes in the air anyway.",
  ),
  {
    id: 'eat',
    verbs: ['eat', 'lick', 'taste'],
    meta: true,
    run(ctx) {
      const { w, cmd } = ctx;
      if (cmd.direct.length === 0) {
        w.say("You're not that hungry. Adventure first, snacks later.");
        return;
      }
      const id = ctx.resolve(cmd.direct);
      if (!id) return;
      const jokes: Record<string, string> = {
        bone: 'You gnaw on the bone thoughtfully. It tastes of regret.',
        flower: 'You nibble a petal. Floral, with notes of poor decision-making.',
        candle: 'You lick the candle. Waxy. You are not proud of this.',
        dragon: 'The dragon is, if anything, more likely to eat you.',
        troll: 'You would need a very large fork and a very strong stomach.',
        duck: 'You bite the rubber duck. It squeaks reproachfully.',
      };
      w.say(jokes[id] ?? `You'd rather not eat ${w.the(id)}.`);
    },
  },
  {
    id: 'smell',
    verbs: ['smell', 'sniff'],
    meta: true,
    run(ctx) {
      const { w, cmd } = ctx;
      if (cmd.direct.length === 0) {
        w.say('You smell damp stone, old smoke and, faintly, adventure.');
        return;
      }
      const id = ctx.resolve(cmd.direct);
      if (!id) return;
      const smells: Record<string, string> = {
        flower: 'The sweet, exotic scent of the flower fills your senses. Lovely.',
        troll: 'Wet sock. Definitely wet sock.',
        dragon: 'Sulphur, smoke, and a hint of the last adventurer.',
        torch: 'Smoke. And, oddly, the sea.',
        bone: "You'd rather not, actually.",
      };
      w.say(smells[id] ?? `${w.the(id).replace(/^./, (c) => c.toUpperCase())} smells of dust.`);
    },
  },
];
