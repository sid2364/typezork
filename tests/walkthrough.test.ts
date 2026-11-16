import { describe, expect, it } from 'vitest';
import {
  FEED,
  HELP,
  KIND_ROUTE,
  memoryStorage,
  newGame,
  play,
  say,
  TO_ARMOURY,
  WALKTHROUGH,
} from './helpers';

const TORCH_AND_HOME = ['north', 'north', 'take torch', 'south', 'south', 'wave torch', 'south'];

describe('the kind way through', () => {
  it('reaches the forest whole', () => {
    const game = newGame();
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
    const quick = play(newGame(), KIND_ROUTE);
    expect(quick).toMatch(/forgotten something important, about a candle/);
    expect(quick).not.toMatch(/Nobody put you in the crypt/);

    const game = newGame();
    play(game, ['examine candle', 'examine door']);
    play(game, [...FEED, 'examine scale', ...HELP]);
    const text = play(game, KIND_ROUTE.slice(FEED.length + HELP.length));
    expect(text).toMatch(/Nobody put you in the crypt/);
  });

  it('the dev room adds one quiet line', () => {
    const game = newGame();
    play(game, [...FEED, ...HELP, 'north', 'north', 'take torch', 'east', 'north']);
    expect(say(game, 'examine screen')).toMatch(/You find yourself in a dark empty crypt/);
    const text = play(game, ['south', 'west', 'south', 'south', 'fire', 'south', 'east']);
    expect(text).toMatch(/Somewhere, a computer stops humming\.$/);
  });
});

describe('the old way through', () => {
  it('still reaches the forest, but fails the test', () => {
    const game = newGame();
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
    const game = newGame();
    say(game, WALKTHROUGH.join(', then '));
    expect(game.state.location).toBe('end');
    expect(game.state.over).toBe(true);
  });

  it('refuses normal commands after the game is over', () => {
    const game = newGame();
    play(game, WALKTHROUGH);
    expect(say(game, 'west')).toMatch(/game is over/);
    expect(say(game, 'undo')).toContain('River');
    expect(game.state.over).toBe(false);
  });

  it('killing both costs far more than the kills gave', () => {
    const game = newGame();
    play(game, WALKTHROUGH.slice(0, 12));
    const before = game.state.score;
    expect(say(game, 'kill troll with staff')).toMatch(/That is both of them/);
    expect(game.state.score).toBe(before + 25 - 100);
  });
});

describe('the dragon', () => {
  it('blocks the way east while it sleeps', () => {
    const game = newGame();
    play(game, ['open door', 'east']);
    expect(say(game, 'east')).toMatch(/won't get past it/);
    expect(say(game, 'sneak')).toMatch(/feet as loud as yours/);
  });

  it('hints that it is only hungry', () => {
    const game = newGame();
    play(game, ['open door', 'east']);
    expect(say(game, 'examine dragon')).toMatch(/thinner than a dragon should be/);
    expect(say(game, 'talk to dragon')).toMatch(/mutton/);
    expect(say(game, 'give bone to dragon')).toMatch(/not carrying any bone/);
  });

  it('can be fed, and gives a scale', () => {
    const game = newGame();
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
    const game = newGame();
    play(game, FEED.slice(0, 6));
    expect(say(game, 'east')).toMatch(/waiting for an answer/);
    expect(game.state.location).toBe('dragonCell');
    expect(say(game, 'look')).toMatch(/friendly eye/);
    expect(game.question).toMatch(/What do you say/);
    expect(say(game, 'two')).toMatch(/keeper never sends anyone/);
  });

  it('finishes the gift if the talk was cut short by a reload', () => {
    const storage = memoryStorage();
    const game = newGame(undefined, { storage });
    play(game, FEED.slice(0, 6));
    say(game, 'save');
    say(game, 'load');
    expect(game.question).toBeNull();
    expect(say(game, 'talk to dragon')).toMatch(/You now have a dragonscale/);
  });

  it('needs the felt boots to sneak past', () => {
    const game = newGame();
    play(game, ['open door', 'east', 'north', 'west']);
    expect(say(game, 'take boots')).toMatch(/no sound at all/);
    play(game, ['east', 'south']);
    expect(say(game, 'sneak east')).toMatch(/felt soles/);
    expect(game.state.location).toBe('portcullis');
    expect(game.state.flags.dragonSneaked).toBe(true);
  });

  it('smells the mutton when you sneak', () => {
    const game = newGame();
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
    const game = newGame(undefined, { onDeath: (n) => (deaths = n) });
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
    const game = newGame();
    play(game, [...TO_ARMOURY, 'take staff', 'north', 'north', 'west', 'take boots', 'east']);
    play(game, ['south', 'east']);
    expect(game.state.location).toBe('portcullis');
    expect(say(game, 'kill troll with staff')).toMatch(/never really got past it/);
    expect(game.state.over).toBe(true);
    expect(game.state.won).toBe(false);
  });

  it('takes your weapon with it when it dies', () => {
    const game = newGame();
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
    const game = newGame();
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
    const game = newGame();
    play(game, WALKTHROUGH.slice(0, 10));
    say(game, 'kill dragon');
    expect(say(game, 'go north')).toContain('Dungeon');
    expect(game.question).toBeNull();
  });

  it('bare hands with nothing carried', () => {
    const game = newGame();
    play(game, ['open door', 'east']);
    expect(say(game, 'kill dragon')).toMatch(/Come back another day/);
  });
});

describe('the troll', () => {
  it('blocks the garden and asks for something it cannot say', () => {
    const game = newGame();
    play(game, [...FEED, 'east']);
    expect(say(game, 'north')).toMatch(/'Nub,' it says behind its hand/);
    expect(game.state.location).toBe('portcullis');
    expect(say(game, 'talk to troll')).toMatch(/Ooga wug zug mog/);
    expect(say(game, 'give flower to troll')).toMatch(/not carrying any flower/);
  });

  it('finds its voice when it sees its face', () => {
    const game = newGame();
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
    const game = newGame();
    play(game, [...FEED, 'east', 'show scale to troll']);
    const before = game.state.score;
    expect(say(game, '3')).toMatch(/face closes like a door/);
    expect(game.state.score).toBe(before - 10);
    expect(say(game, 'north')).toMatch(/Nub/);
    expect(say(game, 'show scale')).toMatch(/does not want to look again/);
    play(game, ['1', '1']);
    expect(game.state.flags.trollFriend).toBe(true);
  });

  it('keeps the hand mirror from the tower', () => {
    const game = newGame();
    play(game, [...TO_ARMOURY, 'take spear', 'up', 'take mirror', 'down', 'north']);
    play(game, ['kill dragon with spear', 'east', 'show mirror to troll', '1']);
    expect(say(game, '1')).toMatch(/keeps the mirror/);
    expect(game.state.things.mirror).toBe('nowhere');
  });

  it('is not weak to every weapon', () => {
    const game = newGame();
    play(game, [...TO_ARMOURY, 'take sword and knife', 'north', 'kill dragon with sword', 'east']);
    expect(say(game, 'kill troll with knife')).toMatch(/live and let live/);
    expect(say(game, 'kill troll with sword')).toMatch(/You do not possess this sword/);
  });

  it('takes your voice with it when it dies', () => {
    const game = newGame();
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
    const game = newGame();
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
    const game = newGame();
    play(game, FED_THEN_KILLED);
    expect(say(game, 'mix potion')).toMatch(/would need a recipe/);
    play(game, ['north', 'take flower', 'north', 'east', 'take parchment', 'west', 'south']);
    say(game, 'south');
    expect(say(game, 'mix potion')).toMatch(/You now have a potion/);
    const before = game.state.score;
    const text = say(game, 'pour potion on troll');
    expect(text).toMatch(/Your voice is back/);
    expect(game.state.score).toBe(before + 50);
    expect(game.state.killed).toEqual([]);
    expect(say(game, 'kill troll with staff')).toBe('No. Not again.');
    expect(say(game, 'talk to troll')).toMatch(/'Hello,' says the troll, carefully/);
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
    const game = newGame();
    play(game, KILLED_THEN_HELPED);
    const end = play(game, ['north', 'take torch', 'south', 'south', 'fire', 'south', 'east']);
    expect(end).toMatch(/An empty place by the fire|There is an empty place by the fire/);
    expect(end).toMatch(/You chose your voice over your strength/);
    expect(game.state.won).toBe(true);
  });

  it('weak hands cannot make the potion', () => {
    const game = newGame();
    play(game, ['open door', 'take bone']);
    play(game, KILLED_THEN_HELPED.slice(1));
    play(game, ['take flower', 'north', 'east', 'take parchment']);
    expect(say(game, 'mix potion')).toMatch(/Your hands shake/);
    expect(game.state.things.potion).toBe('nowhere');
  });

  it('a scroll read in your own voice brings the dragon back', () => {
    const game = newGame();
    play(game, [...KILLED_THEN_HELPED, 'north', 'east', 'take scroll']);
    expect(say(game, 'read scroll')).toMatch(/stand where the strength fell/);
    play(game, ['west', 'south', 'south', 'west']);
    const before = game.state.score;
    const text = say(game, 'read scroll');
    expect(text).toMatch(/You came back/);
    expect(game.state.score).toBe(before + 50);
    expect(game.state.killed).toEqual([]);
    expect(game.state.things.scale).toBe('inventory');
    expect(say(game, 'examine scale')).toMatch(/A crack runs across it/);
    expect(say(game, 'kill dragon with scale')).toBe('No. Not again.');
    const end = play(game, ['east', ...TORCH_AND_HOME.slice(0, 5), 'fire', 'south', 'east']);
    expect(end).toMatch(/cracked scale on a string/);
    expect(end).toMatch(/whole, with a scar/);
  });

  it('with both dead there is nothing left to revive with', () => {
    const game = newGame();
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
    const game = newGame();
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
    const game = newGame();
    play(game, [...FEED, ...HELP, 'north', 'north', 'take torch', 'south', 'south']);
    expect(say(game, input)).toMatch(/bends and parts/);
    say(game, 'south');
    expect(game.state.location).toBe('river');
  });
});

describe('locks, traps and other ways to end early', () => {
  it('the gate is locked without the key', () => {
    const game = newGame();
    play(game, ['open door', 'east']);
    expect(say(game, 'south')).toBe('The gate is locked.');
    expect(say(game, 'open gate')).toBe('The gate is locked.');
    expect(say(game, 'unlock gate')).toBe('You do not have the required object to open this.');
    expect(game.state.location).toBe('dragonCell');
  });

  it('open gate with the key unlocks and opens it', () => {
    const game = newGame();
    play(game, ['open door', 'east', 'north', 'open chest', 'take key', 'south']);
    expect(say(game, 'open gate')).toBe(
      'You turn the key in the lock. The gate is unlocked.\n' +
        'The gate opens, you see daylight coming through from behind it.',
    );
  });

  it('looking at the trapped box costs points, once', () => {
    const game = newGame();
    play(game, [...TO_ARMOURY, 'up']);
    const before = game.state.score;
    expect(say(game, 'examine box')).toMatch(/cloud of black soot[^]*\n\(You lose 15 points/);
    expect(game.state.score).toBe(before - 15);
    expect(say(game, 'examine box')).not.toMatch(/soot/);
    expect(game.state.score).toBe(before - 15);
    expect(say(game, 'take box')).toMatch(/count your fingers/);
  });

  it('opening the trapped box ends the game', () => {
    const game = newGame();
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
    const game = newGame();
    play(game, [...FEED.slice(0, 4), 'open chest', 'take key', ...FEED.slice(4), 'south']);
    expect(say(game, 'up')).toMatch(/dragonscale in your pocket grows warm/);
  });

  it('every game over leaves a bone in the crypt', () => {
    expect(say(newGame(), 'look')).not.toMatch(/added/);
    expect(say(newGame(undefined, { deaths: 1 }), 'look')).toMatch(/added a bone to the pile/);
    const game = newGame(undefined, { deaths: 2 });
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
    expect(game.state.score).toBe(1);
    say(game, 'examine bone');
    expect(game.state.score).toBe(1);
    // the candle is also a piece of memory
    say(game, 'look at candle');
    expect(game.state.score).toBe(7);
    expect(game.view().score).toBe(7);
    expect(say(game, 'score')).toBe('Your score is 7, in 0 turns. Rank: Sleepwalker.');
  });

  it('gives points for rooms, kindness and kills', () => {
    const game = newGame();
    play(game, ['open door', 'east']);
    expect(game.state.score).toBe(2);
    play(game, FEED.slice(2));
    // one more room, the feed, and two kind lines
    expect(game.state.score).toBe(2 + 2 + 25 + 5 + 5);
  });
});

describe('small things', () => {
  it('there is no place like home', () => {
    const game = newGame();
    expect(say(game, 'go home')).toBe('Not yet.');
    play(game, [...FEED, ...HELP, 'north', 'north', 'east', 'north']);
    expect(say(game, 'home')).toMatch(/no place like it[^]*Crypt/);
    expect(game.state.location).toBe('start');
  });

  it('the duck listens', () => {
    const game = newGame();
    play(game, [...FEED, ...HELP, 'north', 'north', 'east']);
    expect(say(game, 'talk to duck')).toMatch(/takes no credit/);
  });

  it('reading is still examining', () => {
    const game = newGame();
    play(game, ['open door', 'east', 'north', 'west']);
    expect(say(game, 'read note')).toMatch(/HOOM is home/);
    expect(say(game, 'read ledger')).toMatch(/Bright as mirrors/);
  });
});
