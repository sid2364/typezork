import { describe, expect, it } from 'vitest';
import {
  FEED,
  HELP,
  hints,
  KIND_ROUTE,
  memoryStorage,
  newGame,
  pastSkeleton,
  play,
  say,
  TO_ARMOURY,
  TUTORIAL,
  WALKTHROUGH,
} from './helpers';

const TORCH_AND_HOME = ['north', 'north', 'take torch', 'south', 'south', 'wave torch', 'south'];

describe('the kind way through', () => {
  it('reaches the forest whole', () => {
    const game = pastSkeleton();
    const text = play(game, KIND_ROUTE);
    expect(game.state.location).toBe('end');
    expect(game.state.over).toBe(true);
    expect(game.state.won).toBe(true);
    expect(text).toContain('You passed the test. You came home whole.');
    expect(text).toContain('Bravo! You beat the game!');
    expect(game.state.killed).toEqual([]);
    expect(game.view().map.rooms.map((r) => r.id)).toEqual([
      'start',
      'dragonCell',
      'dungeon',
      'portcullis',
      'garden',
      'gazebo',
      'river',
      'end',
    ]);
  });

  it('remembers more if you looked at more', () => {
    const quick = play(pastSkeleton(), KIND_ROUTE);
    expect(quick).toMatch(/forgotten something important, about a candle/);
    expect(quick).not.toMatch(/Nobody put you in the crypt/);

    const game = pastSkeleton();
    play(game, ['examine candle', 'examine door']);
    play(game, [...FEED, 'examine scale', ...HELP]);
    const text = play(game, KIND_ROUTE.slice(FEED.length + HELP.length));
    expect(text).toMatch(/Nobody put you in the crypt/);
  });

  it('the dev room adds one quiet line', () => {
    const game = pastSkeleton();
    play(game, [...FEED, ...HELP, 'north', 'north', 'take torch', 'east', 'north']);
    expect(say(game, 'examine screen')).toMatch(/You find yourself in a dark empty crypt/);
    const text = play(game, ['south', 'west', 'south', 'south', 'fire', 'south', 'east']);
    expect(text).toMatch(/Somewhere, a computer stops humming\.$/);
  });
});

describe('the old way through', () => {
  it('still reaches the forest, but fails the test', () => {
    const game = pastSkeleton();
    const text = play(game, WALKTHROUGH);
    expect(game.state.location).toBe('end');
    expect(game.state.over).toBe(true);
    expect(game.state.won).toBe(false);
    expect(text).toContain('It hits you then; you have reached home.');
    expect(text).toContain('Two places by the fire are empty.');
    expect(text).toContain('You did not pass the test.');
    expect(text).not.toContain('Bravo');
  });

  it('also works as a single chained line', () => {
    const game = pastSkeleton();
    say(game, WALKTHROUGH.join(', then '));
    expect(game.state.location).toBe('end');
    expect(game.state.over).toBe(true);
  });

  it('refuses normal commands after the game is over', () => {
    const game = pastSkeleton();
    play(game, WALKTHROUGH);
    expect(say(game, 'west')).toMatch(/game is over/);
    expect(say(game, 'undo')).toContain('River');
    expect(game.state.over).toBe(false);
  });

  it('killing both costs far more than the kills gave', () => {
    const game = pastSkeleton();
    play(game, WALKTHROUGH.slice(0, 12));
    const before = game.state.score;
    expect(say(game, 'kill troll with staff')).toMatch(/That is both of them/);
    expect(game.state.score).toBe(before + 250 - 500);
  });
});

describe('the skeleton', () => {
  it('holds the door until you talk, look and fight', () => {
    const game = newGame();
    expect(say(game, 'look')).toMatch(/wants to have a conversation/);
    expect(say(game, 'open door')).toMatch(/will not let go/);
    expect(say(game, 'east')).toMatch(/will not let go/);
    expect(game.state.location).toBe('start');
    expect(say(game, 'fight skeleton')).toMatch(/Manners/);

    expect(say(game, 'talk to skeleton')).toMatch(/Someone to talk to/);
    expect(game.question).toMatch(/What do you say/);
    expect(say(game, 'east')).toMatch(/waiting for an answer/);
    expect(say(game, '1')).toMatch(/came this way before you[^]*know what you're dealing with/);

    expect(say(game, 'open door')).toMatch(/You will have to make me/);
    expect(say(game, 'fight skeleton')).toMatch(/Look closer/);
    expect(say(game, 'examine skeleton')).toMatch(/good clean fight/);
    expect(say(game, 'fight skeleton')).toMatch(/jaw goes spinning/);
    expect(game.state.killed).toEqual([]);
    expect(say(game, 'look')).toMatch(/pleased with itself/);
    expect(say(game, 'fight skeleton')).toMatch(/Once was enough/);
    expect(say(game, 'east')).toContain("Dragon's Cell");
  });

  it('lets go of the door to fetch a thrown bone', () => {
    const game = newGame();
    say(game, 'take bone');
    expect(say(game, 'throw bone')).toMatch(/trotting back[^]*spits the bone onto the floor/);
    expect(game.state.things.bone).toBe('start');
    const look = say(game, 'look');
    expect(look).toMatch(/pretending nothing happened/);
    expect(look).toMatch(/There is a bone here/);
    expect(say(game, 'fight skeleton')).toMatch(/never speak of this/);
    say(game, 'take bone');
    expect(game.state.things.bone).toBe('inventory');
    expect(say(game, 'give bone to skeleton')).toMatch(/"No," it says firmly/);
    expect(say(game, 'east')).toContain("Dragon's Cell");
  });

  it('can be bribed with a bone partway through the tutorial', () => {
    const game = newGame();
    play(game, ['take bone', 'talk to skeleton', '1']);
    expect(say(game, 'give bone to skeleton')).toMatch(/door is free/);
    expect(hints(game, 'look')).toEqual([]);
    expect(hints(game, 'look')).toEqual(['Hint: go east']);
  });

  it('hints only once the player is stuck', () => {
    const game = newGame();
    expect(game.start().filter((l) => l.style === 'hint')).toEqual([]);
    // two tries of their own, then a nudge
    expect(hints(game, 'open door')).toEqual([]);
    expect(hints(game, 'examine candle')).toEqual(['Hint: talk to skeleton']);
    expect(hints(game, 'east')).toEqual([]);
    expect(hints(game, 'take bone')).toEqual(['Hint: talk to skeleton']);
    // no hint mid-conversation, and the count starts again after it
    expect(hints(game, 'talk')).toEqual([]);
    expect(hints(game, '1')).toEqual([]);
    expect(hints(game, 'open door')).toEqual([]);
    const out = game.submit('fight skeleton');
    expect(out.at(-1)).toEqual({ text: 'Hint: examine skeleton', style: 'hint' });
    expect(out.at(-2)?.text).toMatch(/Look closer/);
    // examining is progress: no hint for it
    expect(hints(game, 'examine skeleton')).toEqual([]);
    expect(hints(game, 'east')).toEqual([]);
    expect(hints(game, 'look')).toEqual(['Hint: fight skeleton']);
    // the right command is never followed by a hint, the way out waits two tries as well
    expect(hints(game, 'fight skeleton')).toEqual([]);
    expect(hints(game, 'look')).toEqual([]);
    expect(hints(game, 'inventory')).toEqual(['Hint: go east']);
    expect(hints(game, 'east')).toEqual([]);
    // once out of the crypt the tutorial is over, even back inside it
    expect(hints(game, 'west')).toEqual([]);
    expect(hints(game, 'look')).toEqual([]);
    expect(hints(game, 'look')).toEqual([]);
  });

  it('gives no hints to someone who knows what to do', () => {
    const game = newGame();
    const inputs = [...TUTORIAL, 'east'];
    const lines = [...game.start(), ...inputs.flatMap((input) => game.submit(input))];
    expect(lines.filter((l) => l.style === 'hint')).toEqual([]);
  });

  it('keeps the room, the skeleton and the hints in step, whatever the order', () => {
    const game = newGame();
    expect(say(game, 'look')).toMatch(/wants to have a conversation/);
    say(game, 'examine skeleton');
    say(game, 'talk');
    expect(say(game, '1')).toMatch(/already taken a good look at me/);
    const look = say(game, 'look');
    expect(look).toMatch(/waiting for a fight/);
    expect(look).not.toMatch(/conversation|closer look/);
    expect(hints(game, 'look')).toEqual(['Hint: fight skeleton']);
  });

  it('asks for a closer look once you have talked', () => {
    const game = newGame();
    play(game, ['talk', '2']);
    expect(say(game, 'look')).toMatch(/waits for you to take a closer look/);
  });

  it('the door is a clue too', () => {
    const game = newGame();
    play(game, ['talk', '2']);
    expect(say(game, 'examine door')).toMatch(/wants to be made to let go/);
    expect(say(game, 'punch skeleton')).toMatch(/jaw goes spinning/);
  });

  it('only fights with bare hands', () => {
    const game = newGame();
    play(game, ['take bone', 'talk to skeleton', '3', 'examine skeleton']);
    expect(say(game, 'kill skeleton with bone')).toMatch(/Hands only/);
    expect(game.state.flags.skeletonBeaten).toBeUndefined();
    expect(say(game, 'kill skeleton with fists')).toMatch(/jaw goes spinning/);
  });

  it('lets you straight by after a death', () => {
    const game = newGame(undefined, { deaths: 1 });
    expect(say(game, 'east')).toMatch(/will not let go/);
    expect(say(game, 'talk to skeleton')).toMatch(/You again/);
    expect(game.question).toBeNull();
    expect(game.state.flags.skeletonBeaten).toBe(true);
    expect(say(game, 'spar with skeleton')).toMatch(/Once was enough/);
    expect(say(game, 'east')).toContain("Dragon's Cell");
  });
});

describe('the dragon', () => {
  it('blocks the way east while it sleeps', () => {
    const game = pastSkeleton();
    play(game, ['open door', 'east']);
    expect(say(game, 'east')).toMatch(/won't get past it/);
    expect(say(game, 'sneak')).toMatch(/feet as loud as yours/);
  });

  it('hints that it is only hungry', () => {
    const game = pastSkeleton();
    play(game, ['open door', 'east']);
    expect(say(game, 'examine dragon')).toMatch(/thinner than a dragon should be/);
    expect(say(game, 'talk to dragon')).toMatch(/mutton/);
    expect(say(game, 'give bone to dragon')).toMatch(/not carrying any bone/);
  });

  it('can be fed, and gives a scale', () => {
    const game = pastSkeleton();
    play(game, FEED.slice(0, 5));
    expect(say(game, 'feed dragon')).toMatch(/You are not the keeper/);
    expect(game.question).toMatch(/What do you say/);
    expect(game.view().suggestions).toEqual(['1', '2', '3']);
    say(game, '1');
    expect(say(game, '2')).toMatch(/You now have a dragonscale/);
    expect(game.state.things.scale).toBe('inventory');
    expect(game.state.things.mutton).toBe('nowhere');
    expect(say(game, 'kill dragon with scale')).toMatch(/trusts you now/);
    say(game, 'east');
    expect(game.state.location).toBe('portcullis');
  });

  it('holds you in the conversation until you answer', () => {
    const game = pastSkeleton();
    play(game, FEED.slice(0, 6));
    expect(say(game, 'east')).toMatch(/waiting for an answer/);
    expect(game.state.location).toBe('dragonCell');
    expect(say(game, 'look')).toMatch(/friendly eye/);
    expect(game.question).toMatch(/What do you say/);
    expect(say(game, 'two')).toMatch(/keeper sent no one/);
  });

  it('finishes the gift if the talk was cut short by a reload', () => {
    const storage = memoryStorage();
    const game = pastSkeleton({ storage });
    play(game, FEED.slice(0, 6));
    say(game, 'save');
    say(game, 'load');
    expect(game.question).toBeNull();
    expect(say(game, 'talk to dragon')).toMatch(/You now have a dragonscale/);
  });

  it('needs the felt boots to sneak past', () => {
    const game = pastSkeleton();
    play(game, ['open door', 'east', 'north', 'west']);
    expect(say(game, 'take boots')).toMatch(/no sound at all/);
    play(game, ['east', 'south']);
    expect(say(game, 'sneak east')).toMatch(/felt soles/);
    expect(game.state.location).toBe('portcullis');
    expect(game.state.flags.dragonSneaked).toBe(true);
  });

  it('smells the mutton when you sneak', () => {
    const game = pastSkeleton();
    play(game, [
      'open door',
      'east',
      'north',
      'take mutton',
      'west',
      'take boots',
      'east',
      'south',
    ]);
    expect(say(game, 'east')).toMatch(/exact direction of the mutton/);
    expect(game.state.location).toBe('dragonCell');
    expect(game.state.over).toBe(false);
  });

  it('wakes up if you sneak with something that clanks', () => {
    let deaths = 0;
    const game = pastSkeleton({ onDeath: (n) => (deaths = n) });
    play(game, [...TO_ARMOURY, 'take sword', 'north', 'north', 'west', 'take boots', 'east']);
    play(game, ['south']);
    const text = say(game, 'east');
    expect(text).toMatch(/sword on your back scrapes/);
    expect(text).toMatch(/GAME OVER/);
    expect(game.state.over).toBe(true);
    expect(game.state.won).toBe(false);
    expect(game.state.location).toBe('dragonCell');
    expect(deaths).toBe(1);
    say(game, 'undo');
    expect(game.state.over).toBe(false);
  });

  it('comes for you if you sneaked past it and then kill the troll', () => {
    const game = pastSkeleton();
    play(game, [...TO_ARMOURY, 'take staff', 'north', 'north', 'west', 'take boots', 'east']);
    play(game, ['south', 'east']);
    expect(game.state.location).toBe('portcullis');
    expect(say(game, 'kill troll with staff')).toMatch(/never really got past it/);
    expect(game.state.over).toBe(true);
    expect(game.state.won).toBe(false);
  });

  it('takes your weapon with it when it dies', () => {
    const game = pastSkeleton();
    play(game, WALKTHROUGH.slice(0, 10));
    const text = say(game, 'kill dragon with spear');
    expect(text).toMatch(/slay the dragon/);
    expect(text).toMatch(/not as proud of this as you expected/);
    expect(text).toMatch(/spear is stuck fast/);
    expect(text).toMatch(/passageway leading to the east opens up/);
    expect(game.state.things.spear).toBe('nowhere');
    expect(say(game, 'look')).toMatch(/entrails strewn/);
    expect(say(game, 'kill dragon')).toMatch(/already dead/);
  });

  it('asks which weapon when none is given', () => {
    const game = pastSkeleton();
    play(game, WALKTHROUGH.slice(0, 10));
    expect(say(game, 'kill dragon')).toBe(
      'You do not stand a chance if you fight with your bare hands.\n' +
        'What do you want to attack the dragon with?',
    );
    expect(game.question).toBe('What do you want to attack the dragon with?');
    expect(say(game, 'key')).toMatch(/Dragons do not have keyholes/);
    say(game, 'kill dragon');
    expect(say(game, 'with the spear')).toMatch(/slay the dragon/);
    expect(game.state.killed).toContain('dragon');
  });

  it('a new command abandons the weapon question', () => {
    const game = pastSkeleton();
    play(game, WALKTHROUGH.slice(0, 10));
    say(game, 'kill dragon');
    expect(say(game, 'go north')).toContain('Dungeon');
    expect(game.question).toBeNull();
  });

  it('bare hands with nothing carried', () => {
    const game = pastSkeleton();
    play(game, ['open door', 'east']);
    expect(say(game, 'kill dragon')).toMatch(/Come back another day/);
  });
});

describe('the troll', () => {
  it('blocks the garden and asks for something it cannot say', () => {
    const game = pastSkeleton();
    play(game, [...FEED, 'east']);
    expect(say(game, 'north')).toMatch(/"Nub," it says behind its hand/);
    expect(game.state.location).toBe('portcullis');
    expect(say(game, 'talk to troll')).toMatch(/Ooga wug zug mog/);
    expect(say(game, 'give flower to troll')).toMatch(/not carrying any flower/);
  });

  it('finds its voice when it sees its face', () => {
    const game = pastSkeleton();
    play(game, [...FEED, 'east']);
    expect(say(game, 'show scale to troll')).toMatch(/broken in half/);
    say(game, '2');
    const text = say(game, '2');
    expect(text).toMatch(/I AM TROLL/);
    expect(text).toMatch(/gives the scale back/);
    expect(game.state.things.scale).toBe('inventory');
    expect(say(game, 'kill troll with scale')).toMatch(/wave back/);
    expect(say(game, 'talk to troll')).toMatch(/HELLO/);
    say(game, 'north');
    expect(game.state.location).toBe('garden');
  });

  it('closes up at a cruel word, and gives you another chance', () => {
    const game = pastSkeleton();
    play(game, [...FEED, 'east', 'show scale to troll']);
    const before = game.state.score;
    expect(say(game, '3')).toMatch(/face closes like a door/);
    expect(game.state.score).toBe(before - 100);
    expect(say(game, 'north')).toMatch(/Nub/);
    expect(say(game, 'show scale')).toMatch(/does not want to look again/);
    play(game, ['1', '1']);
    expect(game.state.flags.trollFriend).toBe(true);
  });

  it('keeps the hand mirror from the tower', () => {
    const game = pastSkeleton();
    play(game, [...TO_ARMOURY, 'take spear', 'up', 'take mirror', 'down', 'north']);
    play(game, ['kill dragon with spear', 'east', 'show mirror to troll', '1']);
    expect(say(game, '1')).toMatch(/keeps the mirror/);
    expect(game.state.things.mirror).toBe('nowhere');
  });

  it('is not weak to every weapon', () => {
    const game = pastSkeleton();
    play(game, [...TO_ARMOURY, 'take sword and knife', 'north', 'kill dragon with sword', 'east']);
    expect(say(game, 'kill troll with knife')).toMatch(/live and let live/);
    expect(say(game, 'kill troll with sword')).toMatch(/You do not possess this sword/);
  });

  it('takes your voice with it when it dies', () => {
    const game = pastSkeleton();
    play(game, WALKTHROUGH.slice(0, 13));
    expect(game.state.killed).toEqual(['dragon', 'troll']);
    expect(say(game, 'sing')).toBe('You open your mouth. Nothing comes out.');
    expect(say(game, 'talk to troll')).toBe('You open your mouth. Nothing comes out.');
    play(game, ['north', 'north', 'take torch', 'south', 'south']);
    expect(say(game, 'answer fire')).toMatch(/Nothing comes out\. The stream waits/);
    expect(say(game, 'wave torch')).toMatch(/bends and parts/);
  });
});

describe('strength against voice', () => {
  const FED_THEN_KILLED = [
    'open door',
    'take bone',
    'east',
    'north',
    'take mutton',
    'open chest',
    'take key',
    'south',
    'give mutton to dragon',
    '1',
    '1',
    'south',
    'take staff',
    'north',
    'east',
    'kill troll with staff',
  ];

  it('the dragon takes its scale back', () => {
    const game = pastSkeleton();
    const text = play(game, FED_THEN_KILLED);
    expect(text).toMatch(/Your voice is gone/);
    expect(text).toMatch(/You give it back because there is nothing else to do/);
    expect(game.state.things.scale).toBe('nowhere');
    expect(game.state.over).toBe(false);
    say(game, 'west');
    expect(say(game, 'look')).toMatch(/lies with its back to you/);
    const end = play(game, ['east', ...TORCH_AND_HOME, 'east']);
    expect(end).toMatch(/You chose your strength over your voice/);
    expect(game.state.won).toBe(true);
  });

  it('a potion made with strong hands brings the troll back', () => {
    const game = pastSkeleton();
    play(game, FED_THEN_KILLED);
    expect(say(game, 'mix potion')).toMatch(/would need a recipe/);
    play(game, ['north', 'take flower', 'north', 'east', 'take parchment', 'west', 'south']);
    say(game, 'south');
    expect(say(game, 'mix potion')).toMatch(/You now have a potion/);
    const before = game.state.score;
    const text = say(game, 'pour potion on troll');
    expect(text).toMatch(/"I am sorry," you say, and you hear it/);
    expect(game.state.score).toBe(before + 500);
    expect(game.state.killed).toEqual([]);
    expect(say(game, 'kill troll with staff')).toBe('No. Not again.');
    expect(say(game, 'talk to troll')).toMatch(/"Hello," says the troll, carefully/);
    const end = play(game, [...TORCH_AND_HOME.slice(0, 5), 'say fire', 'south', 'east']);
    expect(end).toMatch(/whole, with a scar/);
    expect(game.state.won).toBe(true);
  });

  const KILLED_THEN_HELPED = [
    ...TO_ARMOURY,
    'take spear',
    'up',
    'take mirror',
    'down',
    'north',
    'kill dragon with spear',
    'east',
    'show mirror to troll',
    '2',
    '1',
    'north',
  ];

  it('one kill is a choice, not a failure', () => {
    const game = pastSkeleton();
    play(game, KILLED_THEN_HELPED);
    const end = play(game, ['north', 'take torch', 'south', 'south', 'fire', 'south', 'east']);
    expect(end).toMatch(/An empty place by the fire|There is an empty place by the fire/);
    expect(end).toMatch(/You chose your voice over your strength/);
    expect(game.state.won).toBe(true);
  });

  it('weak hands cannot make the potion', () => {
    const game = pastSkeleton();
    play(game, ['open door', 'take bone']);
    play(game, KILLED_THEN_HELPED.slice(1));
    play(game, ['take flower', 'north', 'east', 'take parchment']);
    expect(say(game, 'mix potion')).toMatch(/Your hands shake/);
    expect(game.state.things.potion).toBe('nowhere');
  });

  it('a scroll read in your own voice brings the dragon back', () => {
    const game = pastSkeleton();
    play(game, [...KILLED_THEN_HELPED, 'north', 'east', 'take scroll']);
    expect(say(game, 'read scroll')).toMatch(/stand where the strength fell/);
    play(game, ['west', 'south', 'south', 'west']);
    const before = game.state.score;
    const text = say(game, 'read scroll');
    expect(text).toMatch(/You came back/);
    expect(game.state.score).toBe(before + 500);
    expect(game.state.killed).toEqual([]);
    expect(game.state.things.scale).toBe('inventory');
    expect(say(game, 'examine scale')).toMatch(/A crack runs across it/);
    expect(say(game, 'kill dragon with scale')).toBe('No. Not again.');
    const end = play(game, ['east', ...TORCH_AND_HOME.slice(0, 5), 'fire', 'south', 'east']);
    expect(end).toMatch(/cracked scale on a string/);
    expect(end).toMatch(/whole, with a scar/);
  });

  it('with both dead there is nothing left to revive with', () => {
    const game = pastSkeleton();
    play(game, ['open door', 'take bone']);
    play(game, WALKTHROUGH.slice(1, 13));
    play(game, ['north', 'take flower', 'north', 'east', 'take scroll and parchment']);
    expect(say(game, 'mix potion')).toMatch(/Your hands shake/);
    play(game, ['west', 'south', 'south', 'west']);
    expect(say(game, 'read scroll')).toMatch(/Nothing comes out\. The words stay on the page/);
    expect(game.state.killed).toEqual(['dragon', 'troll']);
  });
});

describe('the stream', () => {
  it('blocks you until its riddle is answered with fire', () => {
    const game = pastSkeleton();
    play(game, [...FEED, ...HELP]);
    expect(say(game, 'south')).toMatch(/You cannot get past the stream/);
    expect(say(game, 'answer water')).toMatch(/not the answer/);
    // The right answer without a flame isn't enough.
    expect(say(game, 'say fire')).toMatch(/words don't burn/);
    expect(say(game, 'south')).toMatch(/You cannot get past the stream/);

    play(game, ['north', 'north', 'take torch', 'south', 'south']);
    // Carrying the torch doesn't solve it on its own.
    expect(say(game, 'south')).toMatch(/waiting for an answer\. The torch in your hand flickers/);
    expect(game.state.location).toBe('portcullis');
    expect(say(game, 'fire')).toMatch(/bends and parts/);
    expect(say(game, 'answer fire')).toMatch(/already let you pass/);
    say(game, 'south');
    expect(game.state.location).toBe('river');
    say(game, 'north');
    say(game, 'south');
    expect(game.state.location).toBe('river');
  });

  it.each([
    'answer fire',
    'say "fire"',
    'flame',
    'show torch to stream',
    'wave torch',
    'use torch',
  ])('"%s" solves the riddle with the torch in hand', (input) => {
    const game = pastSkeleton();
    play(game, [...FEED, ...HELP, 'north', 'north', 'take torch', 'south', 'south']);
    expect(say(game, input)).toMatch(/bends and parts/);
    say(game, 'south');
    expect(game.state.location).toBe('river');
  });
});

describe('locks, traps and other ways to end early', () => {
  it('the gate is locked without the key', () => {
    const game = pastSkeleton();
    play(game, ['open door', 'east']);
    expect(say(game, 'south')).toBe('The gate is locked.');
    expect(say(game, 'open gate')).toBe('The gate is locked.');
    expect(say(game, 'unlock gate')).toBe('You do not have the required object to open this.');
    expect(game.state.location).toBe('dragonCell');
  });

  it('open gate with the key unlocks and opens it', () => {
    const game = pastSkeleton();
    play(game, ['open door', 'east', 'north', 'open chest', 'take key', 'south']);
    expect(say(game, 'open gate')).toBe(
      'You turn the key in the lock. The gate is unlocked.\n' +
        'The gate opens, you see daylight coming through from behind it.',
    );
  });

  it('looking at the trapped box costs points, once', () => {
    const game = pastSkeleton();
    play(game, [...TO_ARMOURY, 'up']);
    const before = game.state.score;
    expect(say(game, 'examine box')).toMatch(/cloud of black soot[^]*\n\(You lose 150 points/);
    expect(game.state.score).toBe(before - 150);
    expect(say(game, 'examine box')).not.toMatch(/soot/);
    expect(game.state.score).toBe(before - 150);
    expect(say(game, 'take box')).toMatch(/count your fingers/);
  });

  it('opening the trapped box ends the game', () => {
    const game = pastSkeleton();
    play(game, [...TO_ARMOURY, 'up']);
    const text = say(game, 'open box');
    expect(text).toMatch(/trapdoor/);
    expect(text).toMatch(/GAME OVER/);
    expect(game.state.over).toBe(true);
    expect(game.state.won).toBe(false);
    expect(say(game, 'undo')).toContain('Tower Room');
    expect(game.state.over).toBe(false);
  });

  it('the dragonscale warns you about the trap', () => {
    const game = pastSkeleton();
    play(game, [...FEED.slice(0, 4), 'open chest', 'take key', ...FEED.slice(4), 'south']);
    expect(say(game, 'up')).toMatch(/dragonscale in your pocket grows warm/);
  });

  it('every game over leaves a bone in the crypt', () => {
    expect(say(pastSkeleton(), 'look')).not.toMatch(/added/);
    expect(say(pastSkeleton({ deaths: 1 }), 'look')).toMatch(/added a bone to the pile/);
    const game = pastSkeleton({ deaths: 2 });
    expect(say(game, 'look')).toMatch(/You count 2 new ones/);
    play(game, [...TO_ARMOURY, 'up', 'open box', 'restart']);
    expect(say(game, 'look')).toMatch(/You count 3 new ones/);
  });
});

describe('score', () => {
  it('gives a point for each new thing you examine', () => {
    const game = newGame();
    expect(game.state.score).toBe(0);
    say(game, 'examine bone');
    expect(game.state.score).toBe(10);
    say(game, 'examine bone');
    expect(game.state.score).toBe(10);
    // the candle is also a piece of memory
    say(game, 'look at candle');
    expect(game.state.score).toBe(70);
    expect(game.view().score).toBe(70);
    expect(say(game, 'score')).toMatch(/^Your score is 70, in 0 turns. Rank: Sleepwalker.$/m);
  });

  it('gives points for rooms, kindness and kills', () => {
    const game = pastSkeleton();
    // looking at the skeleton is the only score the tutorial gives
    expect(game.state.score).toBe(10);
    play(game, ['open door', 'east']);
    expect(game.state.score).toBe(10 + 20);
    play(game, FEED.slice(2));
    // one more room, the feed, and two kind lines
    expect(game.state.score).toBe(10 + 20 + 20 + 250 + 50 + 50);
  });
});

describe('small things', () => {
  it('there is no place like home', () => {
    const game = pastSkeleton();
    expect(say(game, 'go home')).toBe('Not yet.');
    play(game, [...FEED, ...HELP, 'north', 'north', 'east', 'north']);
    expect(say(game, 'home')).toMatch(/no place like it[^]*Crypt/);
    expect(game.state.location).toBe('start');
  });

  it('the duck listens', () => {
    const game = pastSkeleton();
    play(game, [...FEED, ...HELP, 'north', 'north', 'east']);
    expect(say(game, 'talk to duck')).toMatch(/takes no credit/);
  });

  it('reading is still examining', () => {
    const game = pastSkeleton();
    play(game, ['open door', 'east', 'north', 'west']);
    expect(say(game, 'read note')).toMatch(/HOOM is home/);
    expect(say(game, 'read ledger')).toMatch(/polish his scales/);
  });
});
