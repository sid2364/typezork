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
import { rankInfo } from '../src/content/crypt/story';

const TORCH_AND_HOME = ['north', 'north', 'take torch', 'south', 'south', 'wave torch', 'south'];

describe('the kind way through', () => {
  it('reaches the forest whole', () => {
    const game = pastSkeleton();
    const text = play(game, KIND_ROUTE);
    expect(game.state.location).toBe('end');
    expect(game.state.over).toBe(true);
    expect(game.state.won).toBe(true);
    expect(text).toContain('You came home whole.');
    expect(text).not.toContain('You passed the test');
    expect(text).toContain('Here ends the road home.');
    expect(text).toContain('Voice: kept · Strength: kept');
    expect(text).toContain('Other roads remain.');
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
    expect(quick).not.toMatch(/You shut yourself in the crypt/);
    expect(quick).not.toMatch(/passed the test/);

    const game = pastSkeleton();
    play(game, ['examine candle', 'examine door']);
    play(game, [...FEED, 'examine scale', ...HELP]);
    const text = play(game, KIND_ROUTE.slice(FEED.length + HELP.length));
    expect(text).toMatch(/your own hands lighting it[^]*You shut yourself in the crypt/);
    expect(text).toMatch(/You passed the test\. You came home whole/);
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
  it('reaches the forest and wins by the darker road, as the new keeper', () => {
    const game = pastSkeleton();
    const text = play(game, WALKTHROUGH);
    expect(game.state.location).toBe('end');
    expect(game.state.over).toBe(true);
    expect(game.state.won).toBe(true);
    expect(text).toMatch(/come under the eaves of a great forest/);
    expect(text).not.toContain('you have reached home');
    expect(text).toMatch(/Two are missing from among them/);
    expect(text).toMatch(/you write a single word: Waiting/);
    expect(text).toMatch(/The waiting is yours now, and it has no end/);
    expect(text).toContain('Here ends the darker road.');
    expect(text).toMatch(/Voice: (lost|kept) · Strength: lost\nMemories found: \d of 5/);
    expect(text).not.toMatch(/did not pass/);
    expect(game.view().rank).toEqual({ name: 'Dragonbane', level: 4, of: 5 });
    // the final move counts, so the ending agrees with the turn counter
    expect(text).toContain(`in ${game.state.turns} turns.`);
  });

  it('also works as a single chained line', () => {
    const game = pastSkeleton();
    // a chain stops at a question, so the troll fight is answered on its own
    say(game, WALKTHROUGH.slice(0, 14).join(', then '));
    expect(game.question).toMatch(/What do you do/);
    play(game, ['2', '3']);
    say(game, WALKTHROUGH.slice(16).join(', then '));
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

  it('killing both only adds the kill, and turns the ranks to the darker road', () => {
    const game = pastSkeleton();
    play(game, WALKTHROUGH.slice(0, 13));
    const before = game.state.score;
    expect(game.view().rank?.name).toBe('Wanderer');
    expect(say(game, 'kill troll with staff')).toMatch(/He swings it idly no longer/);
    expect(game.state.score).toBe(before);
    expect(say(game, '2')).toMatch(/He goes down on one knee/);
    expect(play(game, ['3'])).toMatch(/None now remain to keep this house/);
    expect(game.state.score).toBe(before + 250);
    expect(game.view().rank?.name).toBe('Slayer');
  });
});

describe('the skeleton', () => {
  it('holds the door and throws you down until you have looked at it', () => {
    const game = newGame();
    expect(say(game, 'look')).toMatch(/something to say to you/);
    expect(say(game, 'open door')).toMatch(/will not let go/);
    expect(say(game, 'east')).toMatch(/will not let go/);
    expect(game.state.location).toBe('start');
    expect(say(game, 'fight skeleton')).toMatch(/throws you down among the bones/);
    expect(game.state.flags.skeletonBeaten).toBeUndefined();

    expect(say(game, 'talk to skeleton')).toMatch(/Another one awake/);
    expect(game.question).toMatch(/What do you say/);
    expect(say(game, 'east')).toMatch(/waiting for an answer/);
    expect(say(game, '1')).toMatch(/holds this door[^]*closer look first/);

    expect(say(game, 'open door')).toMatch(/You will have to make me/);
    expect(say(game, 'fight skeleton')).toMatch(/^Again it catches your fist/);
    expect(say(game, 'examine skeleton')).toMatch(/twist of rusted wire/);
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
    expect(out.at(-2)?.text).toMatch(/look at it properly/);
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
    expect(say(game, 'look')).toMatch(/something to say to you/);
    say(game, 'examine skeleton');
    say(game, 'talk');
    expect(say(game, '1')).toMatch(/had your good look at me/);
    const look = say(game, 'look');
    expect(look).toMatch(/waits for you to try/);
    expect(look).not.toMatch(/something to say|cannot make out/);
    // looking first was already the fight step, talking did not start the count again
    expect(hints(game, 'look')).toEqual([]);
    expect(hints(game, 'look')).toEqual(['Hint: fight skeleton']);
  });

  it('asks for a closer look once you have talked', () => {
    const game = newGame();
    play(game, ['talk', '2']);
    expect(say(game, 'look')).toMatch(/cannot make out much more of it/);
  });

  it('can be fought without a word, once you have looked', () => {
    const game = newGame();
    play(game, ['punch skeleton']);
    expect(say(game, 'look')).toMatch(/cannot make out much more of it/);
    // a blind swing moves the hints on to looking, with no talking at all
    expect(hints(game, 'look')).toEqual(['Hint: examine skeleton']);
    say(game, 'examine skeleton');
    expect(say(game, 'punch skeleton')).toMatch(/jaw goes spinning/);
    expect(game.state.flags.skeletonTalked).toBeUndefined();
    expect(say(game, 'east')).toContain("Dragon's Cell");
  });

  it('the door is a clue too', () => {
    const game = newGame();
    play(game, ['talk', '2']);
    expect(say(game, 'examine door')).toMatch(/twist of rusted wire/);
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
    expect(say(game, 'east')).toMatch(/won't get past him/);
    expect(say(game, 'sneak')).toMatch(/feet as loud as yours/);
  });

  it('hints that it is only hungry', () => {
    const game = pastSkeleton();
    play(game, ['open door', 'east']);
    expect(say(game, 'examine dragon')).toMatch(/thinner than a dragon should be/);
    expect(say(game, 'talk to dragon')).toMatch(/You are not the keeper/);
    expect(say(game, '1')).toMatch(/kept it downstairs/);
    expect(say(game, 'talk to dragon')).toMatch(/\.\.\.mutton\.\.\./);
    expect(say(game, 'give bone to dragon')).toMatch(/not carrying any bone/);
  });

  it('grumbles if you tell him to move, but still sleeps', () => {
    const game = pastSkeleton();
    play(game, ['open door', 'east', 'talk to dragon']);
    expect(say(game, '2')).toMatch(/Nobody passes a hungry dragon/);
    play(game, ['north', 'west', 'take boots', 'east', 'south']);
    expect(say(game, 'east')).toMatch(/felt soles/);
    expect(game.state.location).toBe('portcullis');
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
    expect(say(game, 'two')).toMatch(/what he thinks of the gardener/);
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

  it('a spear on your back scrapes too', () => {
    const game = pastSkeleton();
    play(game, [...TO_ARMOURY, 'take spear', 'north', 'north', 'west', 'take boots', 'east']);
    play(game, ['south']);
    expect(say(game, 'east')).toMatch(/spear on your back scrapes/);
  });

  it('a troll you befriended mourns the dragon if you go back and kill him', () => {
    const game = pastSkeleton();
    play(game, [...TO_ARMOURY, 'take staff', 'up', 'take mirror', 'down', 'north', 'north']);
    play(game, ['west', 'take boots', 'east', 'south', 'east', 'north']);
    play(game, ['show mirror to troll', '1', '3']);
    expect(game.state.flags.trollFriend).toBe(true);
    play(game, ['south', 'west']);
    expect(say(game, 'kill dragon with staff')).toMatch(/troll stops practising his words/);
    play(game, ['east', 'north']);
    expect(say(game, 'look')).toMatch(/not practising any words today/);
    expect(say(game, 'talk to troll')).toMatch(/Long sleep/);
  });

  it('comes for you if you sneaked past it and then kill the troll', () => {
    const game = pastSkeleton();
    play(game, [...TO_ARMOURY, 'take staff', 'north', 'north', 'west', 'take boots', 'east']);
    play(game, ['south', 'east']);
    expect(game.state.location).toBe('portcullis');
    say(game, 'north');
    expect(say(game, 'kill troll with staff')).toMatch(/never really got past him/);
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

  it('believes a lie about the keeper if you can back it up', () => {
    const game = pastSkeleton();
    play(game, FEED.slice(0, 6));
    expect(say(game, '2')).toMatch(/So, tell me/);
    const before = game.state.score;
    expect(say(game, '2')).toMatch(/So he did send you/);
    expect(game.state.score).toBe(before + 100);
    expect(say(game, '1')).toMatch(/You now have a dragonscale/);
  });

  it('turns a bad liar away until the answer is right, and keeps its scale', () => {
    const game = pastSkeleton();
    play(game, FEED.slice(0, 6));
    say(game, '2');
    const before = game.state.score;
    expect(say(game, '3')).toMatch(/Do you really consider me to be a fool/);
    expect(say(game, 'east')).toMatch(/what the keeper thinks of the gardener/);
    expect(game.state.location).toBe('dragonCell');
    expect(say(game, 'kill dragon with bone')).toMatch(/First you lie to me/);
    expect(say(game, 'talk to dragon')).toMatch(/Well\?/);
    expect(say(game, '1')).toMatch(/fool/);
    say(game, 'talk to dragon');
    expect(say(game, '2')).toMatch(/You did not know it then/);
    expect(game.state.score).toBe(before);
    expect(game.state.things.scale).toBe('nowhere');
    expect(say(game, 'talk to dragon')).toMatch(/I am no fool/);
    expect(game.state.things.scale).toBe('nowhere');
    say(game, 'east');
    expect(game.state.location).toBe('portcullis');
  });

  it('sends you away to find a worthy weapon, then fights you fairly', () => {
    const game = pastSkeleton();
    play(game, [...TO_ARMOURY, 'north', 'north', 'take mutton', 'south', 'give mutton to dragon']);
    say(game, '1');
    expect(say(game, '3')).toMatch(/Come back with a worthy weapon/);
    expect(say(game, 'east')).toMatch(/his tail lies across the passage/);
    expect(game.state.location).toBe('dragonCell');
    play(game, ['south', 'take sword', 'north']);
    expect(say(game, 'talk to dragon')).toMatch(/You draw your sword/);
    const before = game.state.score;
    expect(say(game, '2')).toMatch(/Now you know what strength is for/);
    expect(game.state.score).toBe(before + 150);
    expect(game.state.things.sword).toBe('nowhere');
    expect(game.state.things.scale).toBe('inventory');
    expect(say(game, 'examine scale')).toMatch(/scorched black/);
    say(game, 'east');
    expect(game.state.location).toBe('portcullis');
  });

  it('is tamed if you strike in the duel, and gives you no scale', () => {
    const game = pastSkeleton();
    play(game, [...TO_ARMOURY, 'take spear', 'north', 'north', 'take mutton', 'south']);
    play(game, ['give mutton to dragon', '1', '3']);
    const before = game.state.score;
    const text = say(game, '1');
    expect(text).toMatch(/You have the mastery/);
    expect(text).not.toMatch(/did not even wake up/);
    expect(game.state.killed).toEqual([]);
    expect(game.state.score).toBe(before + 100);
    expect(game.state.things.spear).toBe('inventory');
    expect(game.state.things.scale).not.toBe('inventory');
    expect(say(game, 'look')).toMatch(/long scar upon his neck/);
    expect(say(game, 'kill dragon with spear')).toMatch(/bowed his head to you once/);
    say(game, 'east');
    expect(game.state.location).toBe('portcullis');
  });

  it('a tamed dragon comes home mended', () => {
    const game = pastSkeleton();
    // no scale from a tamed dragon, so the troll sees his face in the tower mirror
    play(game, [...TO_ARMOURY, 'take spear', 'up', 'take mirror', 'down', 'north', 'north']);
    play(game, ['take mutton', 'south', 'give mutton to dragon', '1', '3', '1']);
    play(game, ['east', 'north', 'show mirror to troll', '1', '3', 'south']);
    const text = play(game, KIND_ROUTE.slice(FEED.length + HELP.length));
    expect(game.state.won).toBe(true);
    expect(text).toMatch(/keeps the cold from your back/);
    expect(text).toMatch(/you are mended/);
  });

  it('a challenge can also be taken up with kill', () => {
    const game = pastSkeleton();
    play(game, [...TO_ARMOURY, 'north', 'north', 'take mutton', 'south', 'give mutton to dragon']);
    play(game, ['1', '3', 'south', 'take staff', 'north']);
    expect(say(game, 'kill dragon with staff')).toMatch(/Now you have something to fight with/);
    expect(game.question).toMatch(/What do you do/);
    expect(game.state.killed).toEqual([]);
  });

  it('only hears about the keeper from someone who saw the room', () => {
    const unseen = pastSkeleton();
    play(unseen, FEED.slice(0, 5));
    say(unseen, 'feed dragon');
    expect(unseen.view().suggestions).toEqual(['1', '2', '3']);

    const game = pastSkeleton();
    play(game, ['open door', 'east', 'north', 'take mutton', 'west', 'east', 'south']);
    say(game, 'feed dragon');
    expect(game.view().suggestions).toEqual(['1', '2', '3', '4']);
    expect(say(game, '4')).toMatch(/I must stop waiting/);
    // told the keeper is gone, he does not ask you to say that he waited
    const scale = say(game, '2');
    expect(scale).toMatch(/One of us should go somewhere/);
    expect(scale).not.toMatch(/say that I waited/);
    expect(say(game, 'talk to dragon')).toMatch(/nobody to wait for/);
    const end = play(game, [...HELP, ...KIND_ROUTE.slice(FEED.length + HELP.length)]);
    expect(end).toMatch(/with a cup beside it[^]*sits with the rest of you/);
  });

  it('bare hands with nothing carried', () => {
    const game = pastSkeleton();
    play(game, ['open door', 'east']);
    expect(say(game, 'kill dragon')).toMatch(/Come back another day/);
  });
});

describe('the troll', () => {
  it('waits in the garden, blocks the gazebo, and asks for something it cannot say', () => {
    const game = pastSkeleton();
    play(game, [...FEED, 'east', 'north']);
    expect(game.state.location).toBe('garden');
    expect(say(game, 'north')).toMatch(/"Nub," he says behind his hand/);
    expect(game.state.location).toBe('garden');
    expect(say(game, 'talk to troll')).toMatch(/Ooga wug zug/);
    expect(say(game, '1')).toMatch(/needs to see himself more clearly/);
    expect(say(game, 'talk to troll')).toMatch(/Ooga wug zug mog/);
    expect(game.question).toBeNull();
    expect(say(game, 'give flower to troll')).toMatch(/not carrying any flower/);
  });

  it('knows what the troll means once you have read the note', () => {
    const game = pastSkeleton();
    play(game, ['open door', 'east', 'north', 'take mutton', 'west', 'examine note', 'east']);
    play(game, ['south', 'give mutton to dragon', '1', '2', 'east', 'north']);
    expect(say(game, 'talk to troll')).toMatch(/You remember the keeper's note\. ZUG is see/);
  });

  it('walks off to the gazebo if you call it a cretin, before it ever saw its face', () => {
    const game = pastSkeleton();
    play(game, [...FEED, 'east', 'north', 'talk to troll']);
    const before = game.state.score;
    expect(say(game, '2')).toMatch(/"Blug," he says, very quietly/);
    expect(game.state.score).toBe(before - 100);
    expect(game.state.things.troll).toBe('gazebo');
    say(game, 'north');
    expect(say(game, 'take torch')).toMatch(/huge green hand/);
    // the scale in your pocket can be held up from the conversation
    expect(say(game, 'talk to troll')).toMatch(/His hand is over his mouth/);
    expect(game.view().suggestions).toEqual(['1', '2', '3', '4']);
    say(game, '3');
    say(game, 'talk to troll');
    expect(say(game, '1')).toMatch(/You say sorry/);
    expect(game.state.things.troll).toBe('garden');
    expect(game.state.flags.trollFriend).toBeFalsy();
    expect(say(game, 'take torch')).toMatch(/You pick up the torch/);
    // forgiven, it still has its voice to find
    say(game, 'south');
    const look = say(game, 'show scale to troll');
    expect(look).not.toMatch(/look again/);
    expect(look).toMatch(/broken in half/);
    play(game, ['1', '1']);
    expect(game.state.flags.trollFriend).toBe(true);
  });

  it('looks at its face for the first time even while it sulks', () => {
    const game = pastSkeleton();
    play(game, [...FEED, 'east', 'north', 'talk to troll', '2', 'north', 'talk to troll']);
    const look = say(game, '4');
    expect(look).toMatch(/curiosity wins/);
    expect(look).not.toMatch(/look again/);
    say(game, '1');
    expect(say(game, '1')).toMatch(/I AM TROLL/);
    expect(game.state.flags.trollFriend).toBe(true);
    expect(game.state.flags.trollForgave).toBe(true);
    expect(game.state.things.troll).toBe('garden');
  });

  it('finds its voice when it sees its face', () => {
    const game = pastSkeleton();
    play(game, [...FEED, 'east', 'north']);
    expect(say(game, 'show scale to troll')).toMatch(/broken in half/);
    say(game, '2');
    const text = say(game, '2');
    expect(text).toMatch(/I AM TROLL/);
    expect(text).toMatch(/gives the scale back/);
    expect(game.state.things.scale).toBe('inventory');
    expect(say(game, 'kill troll with scale')).toMatch(/wave back/);
    expect(say(game, 'talk to troll')).toMatch(/HELLO/);
    say(game, 'north');
    expect(game.state.location).toBe('gazebo');
  });

  it('sulks in the gazebo over the torch until you say sorry', () => {
    const game = pastSkeleton();
    play(game, [...FEED, 'east', 'north', 'show scale to troll']);
    const before = game.state.score;
    expect(say(game, '3')).toMatch(/face closes like a door/);
    expect(game.state.score).toBe(before - 100);
    expect(game.state.things.troll).toBe('gazebo');
    expect(say(game, 'north')).toMatch(/gazing at the mountains, with his back to you/);
    expect(game.state.location).toBe('gazebo');
    expect(say(game, 'take torch')).toMatch(/huge green hand comes down over it/);
    expect(game.state.things.torch).toBe('gazebo');
    expect(say(game, 'talk to troll')).toMatch(/I am sorry/);
    expect(say(game, '2')).toMatch(/He does not move/);
    say(game, 'talk to troll');
    expect(say(game, '1')).toMatch(/You say sorry/);
    expect(game.state.things.troll).toBe('garden');
    // sorry mends it, but only its face can give it its voice back
    expect(game.state.flags.trollFriend).toBeFalsy();
    const end = play(game, ['take torch', 'south', 'south', 'answer fire', 'south', 'east']);
    expect(end).toMatch(/Nobody ever showed him his own face/);
    expect(end).not.toMatch(/lowers the hand/);
    expect(end).not.toMatch(/Booga hoom/);
    expect(end).toMatch(/hides its face still/);
    expect(end).not.toMatch(/you are mended/);
    expect(game.state.won).toBe(true);
  });

  it('comes home with its voice if you say sorry and then show it its face', () => {
    const game = pastSkeleton();
    play(game, [
      ...FEED,
      'east',
      'north',
      'show scale to troll',
      '3',
      'north',
      'talk to troll',
      '1',
    ]);
    expect(game.state.flags.trollForgave).toBe(true);
    play(game, ['take torch', 'south', 'show scale to troll', '1', '1']);
    expect(game.state.flags.trollFriend).toBe(true);
    const end = play(game, ['south', 'answer fire', 'south', 'east']);
    expect(end).toMatch(/lowers the hand/);
    expect(end).not.toMatch(/his own face/);
    expect(end).toMatch(/you are mended/);
    expect(game.state.won).toBe(true);
  });

  it('can also be won back with its face, in the gazebo', () => {
    const game = pastSkeleton();
    play(game, [...FEED, 'east', 'north', 'show scale to troll', '3', 'north']);
    expect(say(game, 'show scale')).toMatch(/does not want to look again/);
    play(game, ['1', '1']);
    expect(game.state.flags.trollFriend).toBe(true);
    expect(game.state.flags.trollForgave).toBe(true);
    expect(game.state.things.troll).toBe('garden');
  });

  it('frees the torch if killed in the gazebo, and lies where it fell', () => {
    const game = pastSkeleton();
    play(game, [...TO_ARMOURY, 'take staff', 'north', 'north', 'take mutton', 'south']);
    play(game, ['give mutton to dragon', '1', '2', 'east', 'north', 'show scale to troll', '3']);
    say(game, 'north');
    const kill = say(game, 'kill troll with staff');
    expect(kill).toMatch(/A shadow crosses the gazebo/);
    expect(kill).not.toMatch(/garden freely/);
    expect(say(game, 'look')).toMatch(/lies dead by the gazebo rail/);
    expect(say(game, 'take torch')).not.toMatch(/green hand/);
    expect(game.state.things.torch).toBe('inventory');
  });

  it('gives you a turnip if you laugh with it, and nobody wants it', () => {
    const game = pastSkeleton();
    play(game, [...FEED, 'east', 'north', 'show scale to troll']);
    expect(say(game, '2')).toMatch(/Small one\. Not step on/);
    expect(game.state.things.turnip).toBe('inventory');
    say(game, '1');
    expect(say(game, 'give turnip to troll')).toMatch(/For you/);
    play(game, ['south', 'west']);
    expect(say(game, 'give turnip to dragon')).toMatch(/Is it mutton\?/);
    expect(game.state.things.turnip).toBe('inventory');
  });

  it('keeps the hand mirror from the tower', () => {
    const game = pastSkeleton();
    play(game, [...TO_ARMOURY, 'take spear', 'up', 'take mirror', 'down', 'north']);
    play(game, ['kill dragon with spear', 'east', 'north', 'talk to troll', '1']);
    play(game, ['show mirror to troll', '1']);
    expect(say(game, '1')).toMatch(/keeps the mirror/);
    expect(game.state.things.mirror).toBe('nowhere');
  });

  // fed, so the dragon is alive and the troll is not grieving
  const FED_WITH_KEY = [
    'open door',
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
  ];

  it('is not weak to every weapon', () => {
    const game = pastSkeleton();
    play(game, [...FED_WITH_KEY, 'take sword and knife', 'north', 'east', 'north']);
    const text = say(game, 'kill troll with knife');
    expect(text).toMatch(/into the stream/);
    expect(game.state.things.knife).toBe('nowhere');
    // the blow carries you down the path to the stream at the portcullis
    expect(game.state.location).toBe('portcullis');
    say(game, 'north');
    expect(say(game, 'kill troll with sword')).toMatch(/longer than your sword/);
  });

  it('clubs you into the stream, and your torch goes back where it came from', () => {
    const game = pastSkeleton();
    play(game, [...FEED, ...HELP, 'north', 'north', 'take torch', 'south']);
    // a friend will not fight, so make it a stranger again for this
    game.state.flags.trollFriend = false;
    const before = game.state.score;
    expect(say(game, 'punch troll')).toMatch(/hisses out/);
    expect(game.state.things.torch).toBe('gazebo');
    expect(game.state.score).toBe(before - 50);
  });

  it('takes your voice with it when it dies in one blow', () => {
    const game = pastSkeleton();
    play(game, [...FED_WITH_KEY, 'take staff', 'north', 'east', 'north', 'kill troll with staff']);
    expect(game.state.killed).toEqual(['troll']);
    expect(say(game, 'sing')).toBe('You open your mouth. Nothing comes out.');
    expect(say(game, 'talk to troll')).toBe('You open your mouth. Nothing comes out.');
    play(game, ['north', 'take torch', 'south', 'south']);
    expect(say(game, 'answer fire')).toMatch(/Nothing comes out\. The stream waits/);
    expect(say(game, 'wave torch')).toMatch(/bends and parts/);
  });
});

describe('the grieving troll', () => {
  // the dragon dead in his sleep, and you in the garden with a staff
  const KILLED = [
    ...TO_ARMOURY,
    'take spear and staff',
    'north',
    'kill dragon with spear',
    'east',
    'north',
  ];

  it('blocks the gazebo and will not look in the mirror until you tell the truth', () => {
    const game = pastSkeleton();
    play(game, [...TO_ARMOURY, 'take spear', 'up', 'take mirror', 'down', 'north']);
    play(game, ['kill dragon with spear', 'east', 'north']);
    expect(say(game, 'look')).toMatch(/His eyes are red/);
    expect(say(game, 'north')).toMatch(/Him sleep\. You blug/);
    expect(say(game, 'show mirror to troll')).toMatch(/knocks the mirror aside/);
    say(game, 'talk to troll');
    expect(say(game, '2')).toMatch(/You know/);
    say(game, 'talk to troll');
    const before = game.state.score;
    expect(say(game, '1')).toMatch(/covers his face with both hands/);
    expect(game.state.score).toBe(before + 50);
    expect(say(game, 'look')).toMatch(/both hands over his face/);
    expect(say(game, 'show mirror to troll')).toMatch(/You kneel and hold up the mirror/);
    // a troll mourning his friend is in no mood to laugh at his own face
    expect(game.view().suggestions).toEqual(['1', '2']);
    play(game, ['1', '1']);
    expect(game.state.flags.trollFriend).toBe(true);
    say(game, 'north');
    expect(game.state.location).toBe('gazebo');
  });

  it('dies only in a fight, and you keep your voice', () => {
    const game = pastSkeleton();
    play(game, KILLED);
    const before = game.state.score;
    say(game, 'talk to troll');
    expect(say(game, '3')).toMatch(/Him SLEEP/);
    expect(say(game, '2')).toMatch(/from on high/);
    expect(game.state.killed).toEqual(['dragon']);
    expect(say(game, '3')).toMatch(/Your voice is still your own/);
    expect(game.state.killed).toEqual(['dragon', 'troll']);
    expect(game.state.score).toBe(before + 250);
    expect(say(game, 'sing')).not.toMatch(/Nothing comes out/);
  });

  it('beaten fairly, he stays dead when the dragon comes back, and you keep your voice', () => {
    const game = pastSkeleton();
    play(game, [...KILLED, 'talk to troll', '3', '2', '3']);
    play(game, ['north', 'east', 'take scroll', 'read scroll', '1']);
    expect(game.state.killed).toEqual(['troll']);
    const end = play(game, ['west', 'take torch', 'south', 'south', 'fire', 'south', 'east']);
    expect(end).toMatch(/They ask you who used to sit there/);
    expect(end).not.toMatch(/nothing comes out/i);
    expect(end).toMatch(/You kept your voice and your strength/);
    expect(end).not.toMatch(/strength over your voice/);
    expect(game.state.won).toBe(true);
  });

  it('a lost fight puts you in the stream, and a second one ends the game', () => {
    const game = pastSkeleton();
    play(game, KILLED);
    say(game, 'kill troll with staff');
    expect(say(game, '1')).toMatch(/longer than the club[^]*into the stream/);
    expect(game.state.things.staff).toBe('nowhere');
    expect(game.state.killed).toEqual(['dragon']);
    expect(game.state.over).toBe(false);
    // the blow carries you down to the stream, and he waits for you back in the garden
    expect(game.state.location).toBe('portcullis');
    say(game, 'north');
    expect(say(game, 'north')).toMatch(/Him sleep/);
    // the spear is in the dragon, so this time there is nothing fit to fight with
    expect(say(game, 'kill troll')).toMatch(/The club comes round before you can lift it/);
    expect(game.state.over).toBe(true);
    expect(game.state.won).toBe(false);
  });

  it('cannot be fooled in the second exchange', () => {
    for (const answer of ['1', '2']) {
      const game = pastSkeleton();
      play(game, KILLED);
      play(game, ['kill troll with staff', '2']);
      expect(say(game, answer)).toMatch(/into the stream/);
      expect(game.state.killed).toEqual(['dragon']);
    }
  });

  it('beats you without a worthy weapon, and that counts as a lost fight', () => {
    const game = pastSkeleton();
    play(game, [...TO_ARMOURY, 'take spear and knife', 'north', 'kill dragon with spear', 'east']);
    say(game, 'north');
    expect(say(game, 'kill troll with knife')).toMatch(/into the stream/);
    expect(game.state.over).toBe(false);
    say(game, 'north');
    expect(say(game, 'punch troll')).toMatch(/GAME OVER/);
    expect(game.state.over).toBe(true);
  });

  it('leaves you a voice to read the scroll aloud', () => {
    const game = pastSkeleton();
    play(game, [...WALKTHROUGH.slice(0, 16), 'north', 'east', 'take scroll']);
    expect(say(game, 'read scroll')).toMatch(/read the three lines aloud/);
    expect(say(game, '2')).toMatch(/"I am sorry," you say\. He hears it/);
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
    'north',
    'kill troll with staff',
  ];

  it('the dragon takes its scale back', () => {
    const game = pastSkeleton();
    const text = play(game, FED_THEN_KILLED);
    expect(text).toMatch(/Your voice is gone/);
    expect(text).toMatch(/You give it back because there is nothing else to do/);
    expect(game.state.things.scale).toBe('nowhere');
    expect(game.state.over).toBe(false);
    play(game, ['south', 'west']);
    expect(say(game, 'look')).toMatch(/lies with his back to you/);
    const end = play(game, ['east', ...TORCH_AND_HOME, 'east']);
    expect(end).toMatch(/You chose your strength over your voice/);
    expect(game.state.won).toBe(true);
  });

  it('the scroll calls the troll back, even with no voice to read it', () => {
    const game = pastSkeleton();
    play(game, FED_THEN_KILLED);
    play(game, ['north', 'east', 'take scroll']);
    const read = say(game, 'read scroll');
    expect(read).toMatch(/the words lift off the page/);
    expect(read).toMatch(/the troll in the grass/);
    const before = game.state.score;
    const text = say(game, '1');
    expect(text).toMatch(/"I am sorry," you say, and you hear the words/);
    expect(text).toMatch(/The scroll burns away/);
    expect(game.state.score).toBe(before + 500);
    expect(game.state.killed).toEqual([]);
    expect(game.state.things.scroll).toBe('nowhere');
    play(game, ['west', 'south']);
    expect(say(game, 'kill troll with staff')).toBe('No. Not again.');
    expect(say(game, 'talk to troll')).toMatch(/"Hello," says the troll, carefully/);
    const end = play(game, [...TORCH_AND_HOME.slice(1, 5), 'say fire', 'south', 'east']);
    expect(end).toMatch(/you are mended/);
    expect(game.state.won).toBe(true);
  });

  it('a potion of remembering gives back every memory', () => {
    const game = pastSkeleton();
    play(
      game,
      FED_THEN_KILLED.map((c) => c.replace('staff', 'spear')),
    );
    expect(say(game, 'mix potion')).toMatch(/would need a recipe/);
    play(game, ['take flower', 'north', 'east', 'take parchment']);
    expect(say(game, 'examine parchment')).toMatch(/TO CALL BACK A MEMORY/);
    expect(say(game, 'mix potion')).toMatch(/You now have a potion/);
    expect(game.state.things.spear).toBe('nowhere');
    expect(game.state.things.parchment).toBe('inventory');
    expect(say(game, 'drink potion')).toMatch(/lines painted under its eyes/);
    expect(game.state.things.potion).toBe('nowhere');
    expect(say(game, 'drink potion')).toMatch(/nothing here that you would trust/);
    expect(say(game, 'mix potion')).toMatch(/only potion you know how to make/);
    const end = play(game, ['west', 'take torch', 'south', 'south', 'wave torch', 'south', 'east']);
    expect(end).toMatch(/You painted the lines under your eyes yourself/);
    // the potion already said the candle and the bolt, the ending does not say them again
    expect(end).toMatch(/You shut yourself in the crypt/);
    expect(end).not.toMatch(/your own hands lighting it/);
    expect(game.state.won).toBe(true);
  });

  it('the potion needs iron, and a wooden staff is not iron', () => {
    const game = pastSkeleton();
    play(game, FED_THEN_KILLED);
    play(game, ['take flower', 'north', 'east', 'take parchment']);
    expect(say(game, 'mix potion')).toMatch(/You do not have anything made of iron/);
    expect(game.state.things.staff).toBe('inventory');
    expect(game.state.things.potion).toBe('nowhere');
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
    'north',
    // he grieves, and will not look in the mirror until he hears the truth
    'talk to troll',
    '1',
    'show mirror to troll',
    '1',
    '1',
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

  it('the scroll calls the dragon back from anywhere', () => {
    const game = pastSkeleton();
    play(game, [...KILLED_THEN_HELPED, 'north', 'east', 'take scroll']);
    expect(say(game, 'read scroll')).toMatch(/read the three lines aloud/);
    const before = game.state.score;
    const text = say(game, '1');
    expect(text).toMatch(/You came back/);
    expect(game.state.score).toBe(before + 500);
    expect(game.state.killed).toEqual([]);
    expect(game.state.things.scale).toBe('inventory');
    expect(say(game, 'examine scale')).toMatch(/A crack runs across it/);
    const end = play(game, ['west', 'take torch', 'south', 'south', 'fire', 'south', 'east']);
    expect(end).toMatch(/cracked scale on a string/);
    expect(end).toMatch(/you are mended/);
  });

  it('rolling the scroll up keeps it for later', () => {
    const game = pastSkeleton();
    play(game, [...KILLED_THEN_HELPED, 'north', 'east', 'take scroll', 'read scroll']);
    expect(say(game, '2')).toMatch(/tie the ribbon/);
    expect(game.state.things.scroll).toBe('inventory');
    expect(game.state.killed).toEqual(['dragon']);
  });

  it('with both dead the scroll calls back only one', () => {
    const game = pastSkeleton();
    play(game, ['open door', 'take bone']);
    play(game, WALKTHROUGH.slice(1, 16));
    play(game, ['take flower', 'north', 'east', 'take scroll and parchment']);
    expect(say(game, 'mix potion')).toMatch(/Your hands shake/);
    expect(say(game, 'read scroll')).toMatch(/one of them/);
    const before = game.state.score;
    const text = say(game, '2');
    expect(text).toMatch(/The other one, unfortunately, stays where you left it/);
    // only the revive itself, and the ranks come back from the darker road
    expect(game.state.score).toBe(before + 500);
    expect(game.view().rank?.name).toBe('Seeker');
    expect(text).not.toMatch(/sigh of relief/);
    expect(game.state.killed).toEqual(['dragon']);
    expect(game.state.things.scroll).toBe('nowhere');
  });

  it('with nobody dead the scroll has no one to call', () => {
    const game = pastSkeleton();
    play(game, [...FEED, ...HELP, 'north', 'north', 'east', 'take scroll']);
    expect(say(game, 'read scroll')).toMatch(/You have not sent anyone away/);
    expect(game.state.things.scroll).toBe('inventory');
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

  it('grabbing the duck costs points, once', () => {
    const game = pastSkeleton();
    play(game, [...FEED, ...HELP, 'north', 'north', 'east']);
    const before = game.state.score;
    expect(say(game, 'grab duck')).toMatch(/every book in the library slams shut/);
    expect(game.state.score).toBe(before - 150);
    expect(say(game, 'take duck')).toMatch(/You remember the books/);
    expect(game.state.score).toBe(before - 150);
    expect(game.state.things.duck).toBe('library');
    expect(say(game, 'take all')).not.toMatch(/duck/);
  });

  it('looking at the trapped box costs points, once', () => {
    const game = pastSkeleton();
    play(game, [...TO_ARMOURY, 'up']);
    const before = game.state.score;
    expect(say(game, 'examine box')).toMatch(/cloud of black soot/);
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
    expect(say(pastSkeleton(), 'look')).not.toMatch(/new bone/);
    expect(say(pastSkeleton({ deaths: 1 }), 'look')).toMatch(/You count 1 new bone in the pile/);
    const game = pastSkeleton({ deaths: 2 });
    expect(say(game, 'look')).toMatch(/You count 2 new bones in the pile/);
    play(game, [...TO_ARMOURY, 'up', 'open box', 'restart']);
    expect(say(game, 'look')).toMatch(/You count 3 new bones in the pile/);
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

  it('shows the rank as a level for the status bar', () => {
    expect(newGame().view().rank).toEqual({ name: 'Sleepwalker', level: 1, of: 5 });
    expect(rankInfo(299)).toEqual({ name: 'Sleepwalker', level: 1, of: 5 });
    expect(rankInfo(300)).toEqual({ name: 'Wanderer', level: 2, of: 5 });
    expect(rankInfo(2400)).toEqual({ name: 'The One', level: 5, of: 5 });
  });

  it('has its own ladder once both the dragon and the troll are dead', () => {
    const game = pastSkeleton();
    play(game, WALKTHROUGH.slice(0, 16));
    expect(game.view().rank).toEqual({ name: 'Slayer', level: 3, of: 5 });
    expect(say(game, 'score')).toMatch(/Rank: Slayer\.$/m);
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
    expect(say(game, 'read ledger')).toMatch(/One leg of mutton/);
  });
});

describe('what the choices cost', () => {
  it('the view lists what has been lost, and nothing before', () => {
    const game = pastSkeleton();
    expect(game.view().losses).toEqual([]);
    play(game, WALKTHROUGH);
    expect(game.view().losses).toContain('your strength');
  });
});
