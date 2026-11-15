import { BUILTIN_COMMANDS } from './commands';
import type {
  CommandContext,
  CommandDef,
  GameControl,
  ParsedCommand,
  ResolveOptions,
} from './commands/types';
import type { GameDef } from './definitions';
import { parseDirection, type Direction } from './direction';
import { EventBus } from './events';
import { mapView, type MapView } from './map';
import { splitCommands, tokenize } from './parser/lexer';
import { Lexicon, splitObjects } from './parser/lexicon';
import { resolveNoun } from './parser/resolve';
import { deserialize, initialState, SaveError, serialize, type GameState } from './state';
import { line, type OutputLine, type ThingId } from './types';
import { World } from './world';

/** Where SAVE and LOAD keep their data. Front-ends supply one (localStorage, files, …). */
export interface SaveStorage {
  save(slot: string, data: string): void;
  load(slot: string): string | null;
}

export interface GameOptions {
  readonly storage?: SaveStorage;
  /** How many turns UNDO can go back. */
  readonly undoLimit?: number;
}

export interface GameView {
  readonly title: string;
  readonly room: { readonly id: string; readonly name: string };
  readonly exits: readonly { readonly dir: Direction; readonly to: string | null }[];
  readonly inventory: readonly { readonly id: ThingId; readonly name: string }[];
  readonly turns: number;
  readonly over: boolean;
  readonly won: boolean;
  /** The question the game is waiting on, if any. */
  readonly question: string | null;
  readonly map: MapView;
  /** Commands that make sense right now, for clickable hints. */
  readonly suggestions: readonly string[];
}

interface Pending {
  readonly question: string;
  readonly yesNo: boolean;
  readonly answer: (tokens: string[]) => void;
}

/**
 * A running game. Feed it player input with submit(); it returns the lines to
 * show. It never prints, reads input or exits the process itself, so the same
 * Game drives the web UI, the CLI and the tests.
 */
export class Game {
  readonly def: GameDef;
  readonly bus = new EventBus();
  private readonly world: World;
  private readonly commands: CommandDef[];
  private readonly byId = new Map<string, CommandDef>();
  private readonly lexicon = new Lexicon();
  private readonly storage: SaveStorage | undefined;
  private readonly undoLimit: number;
  private history: string[] = [];
  private pending: Pending | undefined;

  constructor(def: GameDef, options: GameOptions = {}) {
    this.def = def;
    this.storage = options.storage;
    this.undoLimit = options.undoLimit ?? 50;
    this.world = new World(def, initialState(def), this.bus);
    def.hooks?.(this.bus);

    // Game commands override built-ins with the same id.
    const custom = new Map(def.commands.map((c) => [c.id, c]));
    this.commands = [
      ...BUILTIN_COMMANDS.map((c) => custom.get(c.id) ?? c),
      ...def.commands.filter((c) => !BUILTIN_COMMANDS.some((b) => b.id === c.id)),
    ];
    for (const c of this.commands) {
      this.byId.set(c.id, c);
      for (const verb of c.verbs) this.lexicon.add(c.id, verb);
    }
    for (const [id, verbs] of Object.entries(def.synonyms)) {
      if (!this.byId.has(id)) throw new Error(`Synonyms given for unknown command "${id}"`);
      for (const verb of verbs) this.lexicon.add(id, verb);
    }
  }

  get state(): Readonly<GameState> {
    return this.world.state;
  }

  get question(): string | null {
    return this.pending?.question ?? null;
  }

  /** Title, intro and the first room. */
  start(): OutputLine[] {
    this.world.out.length = 0;
    this.intro(false);
    return this.flush();
  }

  /** Describe where the player is, e.g. after restoring an autosave. */
  resume(): OutputLine[] {
    this.world.out.length = 0;
    this.world.describeRoom();
    if (this.state.over) this.world.say('The game is over. Type RESTART to play again.');
    return this.flush();
  }

  serialize(): string {
    return serialize(this.def, this.world.state);
  }

  /** Replace the current state with a saved one. Throws SaveError if the data is bad. */
  restore(data: string): void {
    this.world.state = deserialize(this.def, data);
    this.history = [];
    this.pending = undefined;
  }

  submit(input: string): OutputLine[] {
    const w = this.world;
    w.out.length = 0;
    const text = input.trim();
    if (!text) return [];
    w.out.push(line(`> ${text}`, 'echo'));

    if (this.pending) {
      const pending = this.pending;
      const tokens = tokenize(text);
      if (pending.yesNo || !this.parse(tokens)) {
        this.pending = undefined;
        this.step(() => pending.answer(tokens), pending.yesNo);
        return this.flush();
      }
      // The player ignored the question and typed a new command.
      this.pending = undefined;
    }

    let previous: ParsedCommand | undefined;
    for (const fragment of splitCommands(text)) {
      const tokens = tokenize(fragment);
      if (tokens.length === 0) continue;
      // "take sword and spear": a fragment without a verb reuses the previous one.
      const parsed =
        this.parse(tokens) ??
        (previous ? this.parse([...tokenize(previous.verb), ...tokens]) : undefined);
      if (!parsed) {
        w.say(
          `I don't know how to "${tokens.join(' ')}". Type HELP for a list of commands.`,
          'error',
        );
        break;
      }
      previous = parsed;
      const wasOver = this.state.over;
      this.execute(parsed);
      if (this.pending || (this.state.over && !wasOver)) break;
    }
    return this.flush();
  }

  view(): GameView {
    const w = this.world;
    const room = w.room();
    return {
      title: this.def.title,
      room: { id: room.id, name: room.name },
      exits: w.exits().map(([dir, exit]) => ({
        dir,
        to: w.state.visited.includes(exit.to) ? w.room(exit.to).name : null,
      })),
      inventory: w.inventory().map((id) => ({ id, name: w.thing(id).name })),
      turns: w.state.turns,
      over: w.state.over,
      won: w.state.won,
      question: this.question,
      map: mapView(w),
      suggestions: this.suggestions(),
    };
  }

  // ---- internals -------------------------------------------------------------

  private flush(): OutputLine[] {
    const out = [...this.world.out];
    this.world.out.length = 0;
    return out;
  }

  private intro(clear: boolean): void {
    const w = this.world;
    if (clear) w.out.push(line('', 'clear'));
    w.say(this.def.title, 'title');
    for (const p of this.def.intro) w.say(p);
    w.out.push(line('', 'pause'));
    w.describeRoom();
  }

  private parse(tokens: readonly string[]): ParsedCommand | undefined {
    if (tokens.length === 0) return undefined;
    if (parseDirection(tokens)) {
      return {
        raw: tokens.join(' '),
        commandId: 'go',
        verb: 'go',
        args: tokens,
        direct: tokens,
        indirect: [],
      };
    }
    const match = this.lexicon.match(tokens);
    if (!match) return undefined;
    const args = tokens.slice(match.length);
    return {
      raw: tokens.join(' '),
      commandId: match.commandId,
      verb: tokens.slice(0, match.length).join(' '),
      args,
      ...splitObjects(args),
    };
  }

  private execute(parsed: ParsedCommand): void {
    const command = this.byId.get(parsed.commandId)!;
    if (this.state.over && !command.allowWhenOver) {
      this.world.say(
        'The game is over. Type RESTART to play again, or UNDO to take back your last move.',
        'error',
      );
      return;
    }
    this.step(() => this.run(parsed, new Map()), command.meta ?? false);
  }

  /** Run a change. Non-meta changes take a turn and can be undone. */
  private step(fn: () => void, meta: boolean): void {
    if (meta) {
      fn();
      return;
    }
    const before = this.serialize();
    fn();
    this.world.state.turns++;
    this.bus.emit('turn', { turns: this.world.state.turns }, this.world);
    this.history.push(before);
    if (this.history.length > this.undoLimit) this.history.shift();
  }

  private run(parsed: ParsedCommand, preResolved: ReadonlyMap<string, ThingId>): void {
    const w = this.world;
    const ctx: CommandContext = {
      w,
      cmd: parsed,
      game: this.control,
      resolve: (tokens, opts) => this.resolve(parsed, preResolved, tokens, opts),
      ask: (question, answer, opts) => {
        this.pending = { question, yesNo: opts?.yesNo ?? false, answer };
        w.say(question, 'question');
      },
    };
    this.byId.get(parsed.commandId)!.run(ctx);
  }

  private resolve(
    parsed: ParsedCommand,
    preResolved: ReadonlyMap<string, ThingId>,
    tokens: readonly string[],
    opts: ResolveOptions = {},
  ): ThingId | undefined {
    const w = this.world;
    const key = tokens.join(' ');
    const known = preResolved.get(key);
    if (known) return known;

    const result = resolveNoun(tokens, opts.scope ?? w.inScope(), this.def.things, w.state.it);
    if (result.kind === 'one') {
      w.state.it = result.id;
      return result.id;
    }
    if (result.kind === 'none') {
      w.say(opts.notFound ?? `You see no ${key} here.`, 'error');
      return undefined;
    }
    const names = result.ids.map((id) => w.the(id));
    const list = names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1];
    this.pending = {
      question: `Which do you mean, ${list}?`,
      yesNo: false,
      answer: (answer) => {
        // "iron" answers "which key?" as "iron key"; a full name works too.
        let pick = resolveNoun([...answer, ...tokens], result.ids, this.def.things);
        if (pick.kind !== 'one') pick = resolveNoun(answer, result.ids, this.def.things);
        if (pick.kind === 'one') {
          w.state.it = pick.id;
          this.run(parsed, new Map(preResolved).set(key, pick.id));
        } else {
          w.say("That didn't narrow it down. Never mind.", 'error');
        }
      },
    };
    w.say(this.pending.question, 'question');
    return undefined;
  }

  private readonly control: GameControl = ((game: Game) => ({
    get commands() {
      return game.commands;
    },
    save: (slot) => {
      const w = this.world;
      if (!this.storage) {
        w.say("Saving isn't available here.", 'error');
        return;
      }
      this.storage.save(slot, this.serialize());
      w.say(slot === 'default' ? 'Game saved.' : `Game saved as "${slot}".`);
    },
    load: (slot) => {
      const w = this.world;
      const data = this.storage?.load(slot) ?? null;
      if (data === null) {
        w.say(
          slot === 'default' ? 'There is no saved game.' : `There is no save called "${slot}".`,
          'error',
        );
        return;
      }
      try {
        this.restore(data);
      } catch (e) {
        w.say(e instanceof SaveError ? e.message : 'That save could not be loaded.', 'error');
        return;
      }
      w.say('Game loaded.');
      w.describeRoom();
    },
    restart: () => {
      this.world.state = initialState(this.def);
      this.history = [];
      this.pending = undefined;
      this.intro(true);
    },
    undo: () => {
      const w = this.world;
      const previous = this.history.pop();
      if (!previous) {
        w.say('There is nothing to undo.', 'error');
        return;
      }
      w.state = deserialize(this.def, previous);
      this.pending = undefined;
      w.say('Previous turn undone.');
      w.describeRoom();
    },
  }))(this);

  private suggestions(): string[] {
    const w = this.world;
    if (w.state.over) return ['restart', 'undo'];
    const out: string[] = [];
    for (const id of w.thingsAt(w.here)) {
      const t = w.thing(id);
      if (t.kind === 'creature') {
        if (!w.isDead(id) && t.killable) out.push(`attack ${t.name}`);
      } else if (t.openable && !w.isOpen(id)) {
        out.push(`${w.isLocked(id) ? 'unlock' : 'open'} ${t.name}`);
      } else if (t.portable) {
        out.push(`take ${t.name}`);
      }
    }
    for (const [dir] of w.exits()) out.push(`go ${dir}`);
    out.push('look', 'inventory');
    return [...new Set(out)].slice(0, 8);
  }

  /** Commands in help order (exposed for help screens). */
  get commandList(): readonly CommandDef[] {
    return this.commands;
  }
}
