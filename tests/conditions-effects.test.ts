import { describe, expect, it } from 'vitest';
import {
  all,
  any,
  defineGame,
  flag,
  has,
  inRoom,
  isDead,
  isOpen,
  item,
  moveItem,
  not,
  once,
  removeItem,
  revealExit,
  room,
  say,
  setFlag,
  spawnItem,
  visited,
  when,
  win,
} from '../src/dsl';
import { EventBus } from '../src/engine/events';
import { initialState } from '../src/engine/state';
import { World } from '../src/engine/world';

const def = defineGame({
  id: 'test',
  title: 'Test',
  start: 'a',
  rooms: [
    room('a', { name: 'A', description: 'Room A.', exits: { n: { to: 'b', hidden: true } } }),
    room('b', { name: 'B', description: 'Room B.' }),
  ],
  things: [
    item('coin', { name: 'coin', location: 'inventory', portable: true }),
    item('box', { name: 'box', location: 'a', portable: false, openable: {} }),
    item('gem', { name: 'gem', location: 'nowhere', portable: true }),
  ],
});
const world = () => new World(def, initialState(def), new EventBus());

describe('conditions', () => {
  it('evaluate against the world', () => {
    const w = world();
    expect(has('coin')(w)).toBe(true);
    expect(has('gem')(w)).toBe(false);
    expect(inRoom('a')(w)).toBe(true);
    expect(visited('b')(w)).toBe(false);
    expect(isOpen('box')(w)).toBe(false);
    expect(isDead('box')(w)).toBe(false);
    expect(flag('x')(w)).toBe(false);
    w.setFlag('x', 3);
    expect(flag('x')(w)).toBe(true);
    expect(flag('x', 3)(w)).toBe(true);
    expect(flag('x', 4)(w)).toBe(false);
  });

  it('compose', () => {
    const w = world();
    expect(all(has('coin'), inRoom('a'))(w)).toBe(true);
    expect(all(has('coin'), has('gem'))(w)).toBe(false);
    expect(any(has('gem'), inRoom('a'))(w)).toBe(true);
    expect(not(has('gem'))(w)).toBe(true);
  });
});

describe('effects', () => {
  it('change state and print', () => {
    const w = world();
    say('Hello.')(w);
    setFlag('door')(w);
    spawnItem('gem')(w);
    revealExit('north')(w);
    moveItem('coin', 'b')(w);
    expect(w.out.map((l) => l.text)).toEqual(['Hello.']);
    expect(w.flag('door')).toBe(true);
    expect(w.locationOf('gem')).toBe('a');
    expect(w.exits().map(([d]) => d)).toEqual(['north']);
    expect(w.locationOf('coin')).toBe('b');
    removeItem('gem')(w);
    expect(w.locationOf('gem')).toBe('nowhere');
  });

  it('when() and once()', () => {
    const w = world();
    when(has('gem'), say('never'))(w);
    when(has('coin'), say('yes'))(w);
    once('k', say('first'))(w);
    once('k', say('second'))(w);
    expect(w.out.map((l) => l.text)).toEqual(['yes', 'first']);
  });

  it('win() ends the game', () => {
    const w = world();
    win('Yay')(w);
    expect(w.state.over && w.state.won).toBe(true);
    expect(w.out[0]).toEqual({ text: 'Yay', style: 'win' });
  });
});
