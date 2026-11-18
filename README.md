# typezork

Yet another version of the classic text game Zork, with a customisable map. Child of
[sid2364/pyzork](https://github.com/sid2364/pyzork), rewritten in TypeScript as a small, data-driven
engine with a retro web UI.

Play it at **https://sid2364.github.io/zork/**.

```
> open door and go east
The door opens revealing a path towards the east.

Dragon's Cell
You see a staircase leading into the darkness in the north and a steel gate to the south.
There is a giant dragon lying asleep in front of you. It seems to be guarding a passageway headed east.
```

## The story

You wake in a crypt and you need to get home. A hungry dragon and a troll that nobody understands
stand in your way. You can feed, help, sneak past or kill them, and each choice has a price:

- Kill the dragon and you lose your strength (and your weapon). Kill the troll and you lose your
  voice. Kill both and you still reach home, but you fail the test.
- A scroll can undo one kill, wherever you read it. A potion helps you remember.
- Some mistakes end the game early. Each game over adds a bone to the pile in the crypt.
- You get points for what you examine, for kindness and even for kills. The more you look at,
  the more the ending tells you. `score` shows your score, turns and rank.

## Running it

Needs Node 22 or newer (`.nvmrc`).

```sh
npm install
npm run dev      # web UI at http://localhost:5173/zork/
npm run cli      # play in the terminal
npm test         # unit tests + a full walkthrough
npm run build    # static site in dist/, served from /zork/
```

`npm run lint` checks ESLint and Prettier; `npm run format` fixes formatting.

## How it fits together

```
src/
  engine/          Pure TypeScript. No DOM; runs in Node and the browser.
    game.ts        Game: submit(input) → output lines, view() → state for the UI
    state.ts       GameState: plain JSON, used for save/load and undo
    world.ts       Definitions + state + output buffer, given to commands and effects
    commands/      Built-in verbs (go, look, take, open, unlock, attack, undo, …)
    parser/        Tokenizer, verb lexicon, noun resolution ("it", "which do you mean…?")
    conditions.ts  has('key'), isDead('dragon'), flag('x'), not(), all(), any()
    effects.ts     say(), revealExit(), spawnItem(), setFlag(), win(), lose(), award(), once()
    events.ts      Event bus: beforeMove (can veto), afterEnter, take, drop, open, kill, examine, turn
    map.ts         Minimap layout from exit directions
  dsl/             Builders for writing games: defineGame, room, item, creature, door, …
  content/crypt/   The original pyzork map, grown into a longer story
    story.ts       Who is alive or a friend, the score, the hooks and the endings
    dialogue.ts    Conversations with numbered choices, and the revive scene
  ui/              Web front-end (typewriter screen, help panel, minimap, settings)
  cli.ts           Terminal front-end
```

Definitions are immutable and all changes live in `GameState`. Commands return output instead
of printing, so the same `Game` drives the browser, the terminal and the tests.

## Writing a game

```ts
import {
  defineGame,
  room,
  item,
  creature,
  door,
  guarded,
  hidden,
  isDead,
  has,
  spawnItem,
  revealExit,
  say,
  win,
} from './dsl';

export const myGame = defineGame({
  id: 'my-game',
  title: 'My Game',
  start: 'hall',
  rooms: [
    room('hall', {
      name: 'Hall',
      description: 'A draughty hall. A heavy door leads north.',
      exits: {
        n: door('oakDoor', 'vault'),
        e: guarded('yard', isDead('wolf'), 'The wolf snarls.'),
      },
    }),
    room('vault', {
      name: 'Vault',
      description: 'Gold everywhere.',
      onEnter: [win('You are rich!')],
    }),
    room('yard', { name: 'Yard', description: 'Mud.', exits: { w: 'hall' } }),
  ],
  things: [
    item('oakDoor', {
      name: 'door',
      adjectives: ['oak', 'heavy'],
      location: 'hall',
      portable: false,
      openable: { lockedBy: 'key' },
    }),
    item('key', { name: 'key', location: 'yard', portable: true }),
    item('axe', { name: 'axe', location: 'hall', portable: true }),
    creature('wolf', {
      name: 'wolf',
      location: 'hall',
      killable: true,
      weakTo: ['axe'],
      description: 'A wolf guards the way east.',
    }),
  ],
});
```

`defineGame` checks every reference (exits, doors, keys, weapons) and throws a readable error if
anything is missing. Games can add their own commands and verb synonyms, and subscribe to engine
events through `hooks`.

## Deploying

`.github/workflows/deploy.yml` builds the site and replaces `public/zork/` in
`sid2364/sid2364.github.io` (a Next.js site) with the new `dist/`. Next.js copies `public/` into
the built site as-is, so the portfolio's own deploy, triggered by that push, serves the game at
`/zork/`. It needs a deploy key; see the comments at the top of the workflow. Until the
`ZORK_DEPLOY_KEY` secret exists, the workflow builds but doesn't publish.

## Credits

The engine design borrows ideas (not code) from
[ClementJ18/pyzork](https://github.com/ClementJ18/pyzork): vetoable room hooks, two-way
connections, an event-driven core and swappable input/output.

## License

MIT
