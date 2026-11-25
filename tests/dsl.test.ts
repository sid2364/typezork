import { describe, expect, it } from 'vitest';
import { creature, defineGame, door, GameDefinitionError, item, room, twoWay } from '../src/dsl';
import { computeLayout } from '../src/engine/map';
import { crypt } from '../src/content/crypt';
import { newGame, say, pastSkeleton } from './helpers';

describe('defineGame', () => {
  it('builds two-way connections with opposite directions', () => {
    const def = defineGame({
      id: 'g',
      title: 'G',
      start: 'a',
      rooms: [room('a', { name: 'A', description: '' }), room('b', { name: 'B', description: '' })],
      connections: [twoWay('a', 'northeast', 'b')],
    });
    expect(def.rooms.a!.exits.northeast).toEqual({ to: 'b' });
    expect(def.rooms.b!.exits.southwest).toEqual({ to: 'a' });
  });

  it('accepts direction abbreviations in exits', () => {
    const r = room('a', { name: 'A', description: '', exits: { n: 'b', 'south-west': 'c' } });
    expect(Object.keys(r.exits)).toEqual(['north', 'southwest']);
    expect(() => room('a', { name: 'A', description: '', exits: { left: 'b' } })).toThrow(
      /not a direction/,
    );
  });

  it('reports broken references', () => {
    expect(() =>
      defineGame({
        id: 'bad',
        title: 'Bad',
        start: 'nowhere-room',
        rooms: [
          room('a', { name: 'A', description: '', exits: { n: 'missing', e: door('ghost', 'a') } }),
        ],
        things: [
          item('lamp', { name: 'lamp', location: 'attic', portable: true }),
          creature('orc', { name: 'orc', location: 'a', killable: true, weakTo: ['axe'] }),
        ],
      }),
    ).toThrow(GameDefinitionError);
    try {
      defineGame({
        id: 'bad',
        title: 'Bad',
        start: 'a',
        rooms: [room('a', { name: 'A', description: '', exits: { n: 'missing' } })],
      });
    } catch (e) {
      expect((e as Error).message).toContain('leads to unknown room "missing"');
    }
  });

  it('freezes definitions', () => {
    expect(Object.isFrozen(crypt.rooms.start)).toBe(true);
    expect(() => {
      (crypt.rooms as Record<string, unknown>).x = 1;
    }).toThrow();
  });

  it('dead creatures without a dead description get a generic one', () => {
    const def = defineGame({
      id: 'wolf',
      title: 'Wolf',
      start: 'a',
      rooms: [room('a', { name: 'A', description: 'Room.' })],
      things: [
        creature('wolf', {
          name: 'wolf',
          location: 'a',
          killable: true,
          description: 'A wolf growls.',
        }),
        item('axe', { name: 'axe', location: 'inventory', portable: true }),
      ],
    });
    const game = newGame(def);
    say(game, 'kill wolf with axe');
    expect(say(game, 'look')).toBe('A\nRoom.\nThe dead wolf lies here.');
    expect(say(game, 'examine wolf')).toBe('The dead wolf lies here.');
  });

  it('non-killable creatures say so (old killFighter bug)', () => {
    const def = defineGame({
      id: 'ghost',
      title: 'Ghost',
      start: 'a',
      rooms: [room('a', { name: 'A', description: '' })],
      things: [
        creature('ghost', {
          name: 'ghost',
          location: 'a',
          killable: false,
          immune: 'Your blow passes right through it.',
        }),
        item('stick', { name: 'stick', location: 'inventory', portable: true }),
      ],
    });
    const game = newGame(def);
    expect(say(game, 'hit ghost with stick')).toBe(
      'The ghost eyes you keenly.\nYour blow passes right through it.',
    );
  });
});

describe('minimap layout', () => {
  it('places crypt rooms on a grid without collisions', () => {
    const layout = computeLayout(crypt);
    expect(layout.start).toEqual([0, 0]);
    expect(layout.dragonCell).toEqual([1, 0]);
    expect(layout.dungeon).toEqual([1, -1]);
    expect(layout.weaponsRoom).toEqual([1, 1]);
    expect(layout.portcullis).toEqual([2, 0]);
    expect(layout.garden).toEqual([2, -1]);
    expect(layout.river).toEqual([2, 1]);
    const cells = Object.values(layout).map((p) => p.join(','));
    expect(new Set(cells).size).toBe(cells.length);
  });

  it('shows visited rooms, edges and stubs', () => {
    const game = pastSkeleton();
    say(game, 'open door');
    say(game, 'east');
    const map = game.view().map;
    expect(map.rooms.map((r) => [r.id, r.current])).toEqual([
      ['start', false],
      ['dragonCell', true],
    ]);
    expect(map.edges).toEqual([{ from: 'start', to: 'dragonCell' }]);
    expect(map.stubs.map((s) => s.dir).sort()).toEqual(['east', 'north', 'south']);
    const visited = new Set(map.rooms.map((r) => r.id));
    for (const { from, dir, to } of map.stubs) {
      expect(to).toBe(crypt.rooms[from]!.exits[dir]!.to);
      expect(visited.has(to)).toBe(false);
    }
  });

  it('marks rooms where a creature lives, and where one was killed', () => {
    const game = pastSkeleton();
    say(game, 'open door');
    say(game, 'east');
    const mark = (id: string) => game.view().map.rooms.find((r) => r.id === id)?.mark;
    expect(mark('dragonCell')).toEqual({ kind: 'creature', name: 'dragon' });
    for (const input of ['north', 'open chest', 'take key', 'south', 'unlock gate', 'south'])
      say(game, input);
    say(game, 'take spear');
    say(game, 'north');
    say(game, 'kill dragon with spear');
    say(game, 'south');
    expect(mark('dragonCell')).toEqual({ kind: 'slain', name: 'dragon' });
    expect(mark('weaponsRoom')).toBeNull();
  });
});
