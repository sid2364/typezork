import { BUILTIN_COMMANDS } from './commands';
import type {
  CommandContext,
  CommandDef,
  GameControl,
  ObjectOptions,
  ParsedCommand,
  ResolveOptions,
} from './commands/types';
import type { GameDef, RankInfo } from './definitions';
import { parseDirection, type Direction } from './direction';
import { EventBus } from './events';
import { mapView, type MapView } from './map';
import { splitCommands, tokenize } from './parser/lexer';
import { Lexicon, splitObjects } from './parser/lexicon';
import { resolveNoun, withoutFiller } from './parser/resolve';
import { deserialize, initialState, SaveError, serialize, type GameState } from './state';
import { capitalise, line, type OutputLine, type ThingId } from './types';
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
  // how many times the player has lost before, front-ends may remember this between games
  readonly deaths?: number;
  // called with the new total every time the player loses
  readonly onDeath?: (total: number) => void;
}

export interface GameView {
  readonly title: string;
  readonly room: { readonly id: string; readonly name: string };
  readonly exits: readonly { readonly dir: Direction; readonly to: string | null }[];
  readonly inventory: readonly { readonly id: ThingId; readonly name: string }[];
  readonly turns: number;
  readonly score: number;
  /** The rank the score earns, if the game has ranks. */
  readonly rank: RankInfo | null;
  /** What the player's choices have cost them so far, if the game keeps track. */
  readonly losses: readonly string[];
  readonly over: boolean;
  readonly won: boolean;
  /** The question the game is waiting on, if any. */
  readonly question: string | null;
  readonly map: MapView;
  /** Commands that make sense right now, for clickable hints. */
  readonly suggestions: readonly string[];
  /** Words a front-end can complete as the player types. */
  readonly vocabulary: Vocabulary;
}

export interface Vocabulary {
  /** The main verb of every command but the secret ones, in help order. */
  readonly verbs: readonly string[];
  /** Names of everything the player can refer to: the room's contents and what they carry. */
  readonly things: readonly string[];
}

// words a player may open with before the verb: "i want to fight it", "please open the door"
const LEAD = new Set([
  'please',
  'i',
  'want',
  'to',
  'try',
  'let',
  'me',
  'lets',
  "let's",
  'can',
  'could',
  'will',
  'shall',
  'just',
  'now',
  'gonna',
  'wanna',
]);

// answers that drop a follow-up question
const NEVER_MIND = new Set(['nevermind', 'never', 'nothing', 'cancel', 'nobody', 'none']);

interface Pending {
  readonly question: string;
  readonly yesNo: boolean;
  readonly strict: boolean;
  // answers to offer as clickable hints
  readonly choices: readonly string[];
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
  private readonly verbs: readonly string[];
  private readonly byId = new Map<string, CommandDef>();
  private readonly lexicon = new Lexicon();
  private readonly storage: SaveStorage | undefined;
  private readonly undoLimit: number;
  private history: string[] = [];
  private pending: Pending | undefined;
  // turns taken since the last save or load, which a LOAD would throw away
  private unsaved = false;

  constructor(def: GameDef, options: GameOptions = {}) {
    this.def = def;
    this.storage = options.storage;
    this.undoLimit = options.undoLimit ?? 50;
    this.world = new World(def, initialState(def), this.bus);
    this.world.deaths = options.deaths ?? 0;
    this.world.onDeath = options.onDeath;
    this.world.ask = (question, answer, opts) => {
      this.pending = {
        question,
        yesNo: opts?.yesNo ?? false,
        strict: opts?.strict ?? false,
        choices: opts?.choices ?? [],
        answer,
      };
      this.world.say(question, 'question');
    };
    def.hooks?.(this.bus);

    // Game commands override built-ins with the same id.
    const custom = new Map(def.commands.map((c) => [c.id, c]));
    this.commands = [
      ...BUILTIN_COMMANDS.map((c) => custom.get(c.id) ?? c),
      ...def.commands.filter((c) => !BUILTIN_COMMANDS.some((b) => b.id === c.id)),
    ];
    this.verbs = [...new Set(this.commands.filter((c) => !c.secret).map((c) => c.verbs[0]!))];
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
    this.world.hints.length = 0;
    this.intro(false);
    return this.flush();
  }

  /** Describe where the player is, e.g. after restoring an autosave. */
  resume(): OutputLine[] {
    this.world.out.length = 0;
    this.world.hints.length = 0;
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
    this.unsaved = false;
  }

  submit(input: string): OutputLine[] {
    const w = this.world;
    w.out.length = 0;
    w.hints.length = 0;
    const text = input.trim();
    if (!text) return [];
    w.out.push(line(`> ${text}`, 'echo'));

    if (this.pending) {
      const pending = this.pending;
      const tokens = tokenize(text);
      const chat = !this.state.over && (this.def.banter?.matches(tokens) ?? false);
      const parsed = chat ? undefined : this.parse(tokens);
      if (pending.strict && parsed && this.byId.get(parsed.commandId)!.meta) {
        // looking around or undoing is fine mid-conversation and the question stays open
        this.execute(parsed);
        if (this.pending === pending) w.say(pending.question, 'question');
        return this.flush();
      }
      if (pending.yesNo || pending.strict || (!parsed && !chat)) {
        this.pending = undefined;
        this.step(() => pending.answer(tokens), pending.yesNo);
        return this.settle();
      }
      // The player ignored the question and typed a new command.
      this.pending = undefined;
    }

    let previous: ParsedCommand | undefined;
    for (const fragment of splitCommands(text)) {
      const tokens = tokenize(fragment);
      if (tokens.length === 0) continue;
      // "can we be friends": small talk, answered in character before any command is tried
      if (!this.state.over && this.def.banter?.matches(tokens)) {
        this.def.banter.reply(this.world, tokens);
        previous = undefined;
        continue;
      }
      // "take sword and spear": a fragment without a verb reuses the previous one.
      const parsed =
        this.parse(tokens) ??
        (previous ? this.parse([...tokenize(previous.verb), ...tokens]) : undefined);
      if (!parsed) {
        this.notUnderstood(tokens);
        break;
      }
      previous = parsed;
      const wasOver = this.state.over;
      this.execute(parsed);
      if (this.pending || (this.state.over && !wasOver)) break;
    }
    return this.settle();
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
      score: w.state.score,
      rank: this.def.rank?.(w.state.score, w) ?? null,
      losses: this.def.losses?.(w) ?? [],
      over: w.state.over,
      won: w.state.won,
      question: this.question,
      map: mapView(w),
      suggestions: this.suggestions(),
      vocabulary: {
        verbs: this.verbs,
        things: [...new Set(w.inScope().map((id) => w.thing(id).name))],
      },
    };
  }

  // ---- internals -------------------------------------------------------------

  // tell listeners the game waits for a new command, unless it still waits for an answer
  private settle(): OutputLine[] {
    if (!this.pending && !this.state.over) this.bus.emit('ready', {}, this.world);
    return this.flush();
  }

  private flush(): OutputLine[] {
    const out = [...this.world.out, ...this.world.hints.map((h) => line(h, 'hint'))];
    this.world.out.length = 0;
    this.world.hints.length = 0;
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
    // "i want to fight it": skip the polite words in front of the verb, if a verb follows.
    // "i" on its own is still the inventory
    let i = 0;
    while (i < tokens.length - 1 && LEAD.has(tokens[i]!)) i++;
    return (i > 0 ? this.parseVerb(tokens.slice(i)) : undefined) ?? this.parseVerb(tokens);
  }

  private parseVerb(tokens: readonly string[]): ParsedCommand | undefined {
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
    this.unsaved = true;
    this.bus.emit('turn', { turns: this.world.state.turns }, this.world);
    this.remember(before);
  }

  // keep a state UNDO can go back to, up to the limit
  private remember(state: string): void {
    this.history.push(state);
    if (this.history.length > this.undoLimit) this.history.shift();
  }

  private run(parsed: ParsedCommand, preResolved: ReadonlyMap<string, ThingId>): void {
    const w = this.world;
    const ctx: CommandContext = {
      w,
      cmd: parsed,
      game: this.control,
      resolve: (tokens, opts) => this.resolve(parsed, preResolved, tokens, opts),
      object: (words, opts) => this.object(parsed, preResolved, words, opts),
      ask: w.ask,
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

    const result = resolveNoun(
      tokens,
      opts.scope ?? w.inScope(),
      this.def.things,
      w.state.it,
      w.obvious(),
    );
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
      strict: false,
      choices: result.ids.map((id) => w.thing(id).name),
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

  // the object of a command: named, obvious, or asked for in a follow-up question
  private object(
    parsed: ParsedCommand,
    preResolved: ReadonlyMap<string, ThingId>,
    words: readonly string[],
    opts: ObjectOptions = {},
  ): ThingId | undefined {
    const w = this.world;
    const named = withoutFiller(words);
    if (named.length) return this.resolve(parsed, preResolved, named, opts);

    const candidates = [...new Set(opts.candidates ?? opts.scope ?? w.inScope())];
    const it = w.state.it;
    const meant =
      it && candidates.includes(it) ? it : candidates.length === 1 ? candidates[0] : null;
    if (meant) {
      // say what was understood, the way the old games did
      w.say(`(${w.the(meant)})`);
      w.state.it = meant;
      return meant;
    }
    if (candidates.length === 0) {
      w.say(opts.none ?? `${capitalise(parsed.verb)} what?`, 'error');
      return undefined;
    }
    const question = opts.ask ?? `What do you want to ${parsed.verb}?`;
    this.pending = {
      question,
      yesNo: false,
      strict: false,
      choices: candidates.slice(0, 6).map((id) => w.thing(id).name),
      // the answer finishes the command: "fight" … "skeleton", or "skeleton with fists"
      answer: (answer) => {
        if (answer.length === 0 || NEVER_MIND.has(answer[0]!)) {
          w.say('Never mind, then.');
          return;
        }
        const phrase = splitObjects(answer);
        const prep = phrase.prep ?? parsed.prep;
        const indirect = phrase.prep ? phrase.indirect : parsed.indirect;
        this.run(
          {
            ...parsed,
            raw: `${parsed.verb} ${answer.join(' ')}`,
            args: [...phrase.direct, ...(prep ? [prep] : []), ...indirect],
            direct: phrase.direct,
            ...(prep ? { prep } : {}),
            indirect,
          },
          preResolved,
        );
      },
    };
    w.say(question, 'question');
    return undefined;
  }

  // a command nobody understood. if it names something here, say what can be done with it
  private notUnderstood(tokens: readonly string[]): void {
    const w = this.world;
    const help = 'Type HELP for a list of commands.';
    for (let i = 1; i < tokens.length; i++) {
      const found = resolveNoun(
        tokens.slice(i),
        w.inScope(),
        this.def.things,
        w.state.it,
        w.obvious(),
      );
      if (found.kind !== 'one') continue;
      const id = found.id;
      const thing = w.thing(id);
      const can = ['examine it'];
      if (thing.kind === 'creature' && !w.isDead(id)) {
        if (this.byId.has('talk')) can.push('talk to it');
        can.push('attack it');
      } else if (thing.kind === 'item') {
        if (thing.portable && !w.has(id)) can.push('take it');
        if (thing.openable && !w.isOpen(id)) can.push('open it');
      }
      const list = can.length > 1 ? `${can.slice(0, -1).join(', ')} or ${can.at(-1)}` : can[0];
      w.say(
        `I don't know how to "${tokens.slice(0, i).join(' ')}" ${w.the(id)}, but you could ${list}.`,
        'error',
      );
      return;
    }
    w.say(`I don't know how to "${tokens.join(' ')}". ${help}`, 'error');
  }

  private readonly control: GameControl = ((game: Game) => ({
    get commands() {
      return game.commands;
    },
    get unsaved() {
      return game.unsaved && !game.state.over;
    },
    save: (slot) => {
      const w = this.world;
      if (!this.storage) {
        w.say("Saving isn't available here.", 'error');
        return;
      }
      this.storage.save(slot, this.serialize());
      this.unsaved = false;
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
      // the game as it stands goes on the undo pile, so a load can be taken back
      const before = this.serialize();
      const history = this.history;
      try {
        this.restore(data);
      } catch (e) {
        w.say(e instanceof SaveError ? e.message : 'That save could not be loaded.', 'error');
        return;
      }
      this.history = history;
      this.remember(before);
      w.say('Game loaded. Type UNDO to go back to where you were.');
      w.describeRoom();
    },
    restart: () => {
      this.world.state = initialState(this.def);
      this.history = [];
      this.pending = undefined;
      this.unsaved = false;
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
      // the state brought back may not be the one last saved
      this.unsaved = true;
      w.say('Previous turn undone.');
      w.describeRoom();
    },
  }))(this);

  private suggestions(): string[] {
    const w = this.world;
    if (w.state.over) return ['restart', 'undo'];
    if (this.pending?.choices.length) return [...this.pending.choices];
    // a move offered now would only be read as the answer
    if (this.pending?.yesNo) return ['yes', 'no'];
    const talk = this.byId.has('talk');
    const out: string[] = [];
    for (const id of w.thingsAt(w.here)) {
      const t = w.thing(id);
      if (t.kind === 'creature') {
        if (!w.isDead(id) && talk) out.push(`talk to ${t.name}`);
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
