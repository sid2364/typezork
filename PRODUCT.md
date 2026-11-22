# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, weighted equally:

- **Players.** People who arrive, often from the portfolio at sid2364.github.io, to play the crypt
  story in the browser on a desktop or a phone. Their job is to get home alive and find out what
  their choices cost.
- **People looking at the work.** Visitors to the portfolio, peers and developers who play for a
  while and then look at how it is built: the engine, the DSL and the custom map. For them the game
  shows the author's craft.

Neither audience is designed for at the other's expense.

## Product Purpose

typezork is a text adventure engine and web game in TypeScript, a child of sid2364/pyzork. It
ships one story, the crypt: you wake in a crypt and must get home past a hungry dragon and a troll
nobody understands. Success means a player reaches an ending that reflects how they played, and a
curious visitor comes away seeing a clean, data-driven engine underneath.

## Positioning

- **Choices with costs.** Every way past the creatures is open (feed, help, sneak past, kill), and
  each has a price. Killing the dragon costs your strength and your weapon. Killing the troll costs
  your voice. Killing both leads to a darker ending. A scroll can undo one kill.
- **Curiosity shapes the ending.** Points come from examining, kindness and kills. The more the
  player looks at, the more the ending tells them.
- **A modern parser in an old-style terminal.** It chains commands with "and", resolves pronouns
  ("it"), asks "which do you mean?", and offers undo, a minimap and a compass, all in the
  traditional typed-command form.

## Operating Context

- Served as static files at `/zork/` inside the Next.js portfolio site (sid2364/sid2364.github.io),
  published by `.github/workflows/deploy.yml`. It shares the portfolio's Google Analytics property.
- Played in a desktop browser with the side panels (status, compass, minimap, help) open, or on a
  phone where Map and Help collapse into toggles.
- Also playable in a terminal (`npm run cli`) on the same `Game` engine.
- Save and load, history recall with ↑/↓, and a title screen with Continue / New game. A death
  count persists between games ("each game over adds a bone to the pile").

## Capabilities and Constraints

**Binding constraints**

- **Keyboard first.** Typing commands is the core interaction. Buttons, panels and the compass
  support typing and never replace it.
- **Works on phones.** Mobile play is a real use case. Layouts must keep the prompt usable on small
  screens.
- **Static site, no backend.** All state (progress, saves, settings, death count) lives in
  localStorage on the device, and the build deploys as static files under the `/zork/` base path.

**Capabilities in place**

- Engine (`src/engine/`) has no DOM dependency and runs in Node and the browser. Commands return
  output lines instead of printing. `GameState` is plain JSON used for save/load and undo.
- DSL (`src/dsl/`) for authoring games: `defineGame`, `room`, `item`, `creature`, `door`, and
  more. `defineGame` checks every reference.
- Web UI (`src/ui/`): typewriter output, status panel, compass, minimap, help panel with suggestions
  and a command cheatsheet, and a settings dialog (text speed, theme, scanlines, wipe saved data,
  restart).
- An ARIA live log mirrors game output, and there is a reduced-motion fallback. Both exist in the
  current build, but the user has not set them as binding requirements.
- Save compatibility: if the map changes between versions, the title screen tells the player that
  their old save no longer works.

**Terminology**: a room, a thing (item or creature), an exit, a door, a guarded exit, a flag, an
ending, rank, score, turns.

## Brand Commitments

- Name: **ZORK** in the UI and the title screen ("Z O R K"). The credit reads "created by Sid
  Sahay" and links to sid2364.github.io.
- Title-screen line: "The classic text-based adventure game, reimagined."
- **In-game prose voice.** Plain, old-fashioned narration. Never use "this, not that" contrasts or
  clipped fragment lines. Mythic or dramatic passages (for example the ending where you kill
  everything) are written in a Lord of the Rings register: archaic syntax, sentences chained with
  "and", plain natural imagery.

## Evidence on Hand

- The sample transcript in `README.md`.
- A full walkthrough test (`tests/walkthrough.test.ts`) that plays the story end to end.
- The live game at https://sid2364.github.io/zork/.
- There are no player counts, testimonials, press mentions or analytics figures on hand. Future
  work must not invent any.

## Product Principles

1. **Typing is the game.** Every addition has to make typed play richer. Nothing should route
   around the prompt.
2. **Consequences are visible.** When a choice costs the player something, the interface and the
   prose make the cost felt and remembered.
3. **Reward looking closely.** Examining, reading and exploring always pay off, in points, in prose
   and in the ending.
4. **The engine stays clean.** Content is data and the engine stays pure, because the build is part
   of what visitors come to see.
5. **One game, every screen.** The same story has to hold up on a phone, a desktop and a terminal.
