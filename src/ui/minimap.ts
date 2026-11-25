import { computeLayout, vector, type GameDef, type GameView } from '../engine';

const SVG = 'http://www.w3.org/2000/svg';
/** Distance between cell centres. */
const PITCH = 34;
/** Side of a room square; the rest of the pitch is the gap that corridors and chevrons sit in. */
const SIZE = 24;
const GAP = PITCH - SIZE;
/** Cells visible across the round view, which is always centred on the player. */
const CELLS = 3.5;
const VIEW = CELLS * PITCH;

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** Rooms already drawn on each map, so a newly found one can be marked as it appears. */
const seen = new WeakMap<SVGSVGElement, Set<string>>();

/** The path last drawn on each map (current room, then the trail). */
const trails = new WeakMap<SVGSVGElement, string>();

/** The room the player is in, per map, for the caption to return to after a hover. */
const here = new WeakMap<SVGSVGElement, string>();

type Caption = { label: Element; here: Element; count: Element };

export interface MinimapOptions {
  caption?: Caption;
  /** Ping rooms found since the last render. Off when a save is resumed or loaded. */
  reveal?: boolean;
  /** Rooms just left, most recent first; their afterglow fades with age. */
  trail?: readonly string[];
}

/** The persistent group that holds the rooms, so moving between rooms can animate. */
const worlds = new WeakMap<SVGSVGElement, SVGGElement>();

function worldGroup(svg: SVGSVGElement): SVGGElement {
  const existing = worlds.get(svg);
  if (existing) return existing;

  svg.setAttribute('viewBox', `${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`);
  const world = el('g', { class: 'map-world' });
  svg.replaceChildren(world);
  worlds.set(svg, world);
  return world;
}

/**
 * A round, radar-like grid map centred on the player: each explored room is a
 * square, corridors join neighbouring squares, and chevrons mark exits that
 * haven't been taken. The room each such exit leads to shows as a dashed, fogged
 * outline; squares with no room stay empty. The edges fade and blur away (see .minimap__lens).
 * The way the player came keeps an afterglow, rooms with a creature carry a mark
 * (a cross once it is slain), and pointing at a room names it in the caption.
 * Returns whether a newly found room was pinged.
 */
export function renderMinimap(
  svg: SVGSVGElement,
  def: GameDef,
  view: GameView,
  { caption, reveal = false, trail = [] }: MinimapOptions = {},
): boolean {
  const world = worldGroup(svg);
  const known = seen.get(svg);
  // rooms found since the last render; their pings are drawn last, over everything
  const pings: SVGElement[] = [];
  const layout = computeLayout(def);
  const { rooms, edges, stubs } = view.map;
  const centre = (id: string): [number, number] => {
    const [x, y] = layout[id] ?? [0, 0];
    return [x * PITCH, y * PITCH];
  };

  // fog: a dashed outline where an unvisited room lies past a known exit, and nothing elsewhere
  const children: SVGElement[] = [...new Set(stubs.map((s) => s.to))].map((id) => {
    const [x, y] = centre(id);
    return el('rect', {
      x: x - SIZE / 2,
      y: y - SIZE / 2,
      width: SIZE,
      height: SIZE,
      class: 'map-fog',
    });
  });

  // the afterglow: rooms just left, and the corridors between them, by how long ago
  const current = rooms.find((r) => r.current);
  const age = new Map(trail.map((id, i) => [id, i + 1]));
  const pair = (a: string, b: string): string => [a, b].sort().join('|');
  const path = current ? [current.id, ...trail] : [];
  const walked = new Map(path.slice(1).map((id, i) => [pair(path[i]!, id), i + 1]));
  // the trail only cools when it moves on, not every time the map is drawn
  const cooling = path.join('>') !== trails.get(svg);
  trails.set(svg, path.join('>'));

  for (const { from, to } of edges) {
    const [x1, y1] = centre(from);
    const [x2, y2] = centre(to);
    const line = el('line', { x1, y1, x2, y2, class: 'map-corridor' });
    const n = walked.get(pair(from, to));
    if (n) glow(line, 'map-corridor--trail', n, cooling);
    children.push(line);
  }

  for (const room of rooms) {
    const [x, y] = centre(room.id);
    const cell = el('rect', {
      x: x - SIZE / 2,
      y: y - SIZE / 2,
      width: SIZE,
      height: SIZE,
      class: room.current ? 'map-cell map-cell--current' : 'map-cell',
      'data-name': room.name,
    });
    const title = el('title');
    title.textContent = room.name;
    cell.append(title);
    const n = age.get(room.id);
    if (n && !room.current) glow(cell, 'map-cell--trail', n, cooling);
    children.push(cell);
    if (room.mark) children.push(mark(x, y, room.mark.kind, room.current));
    if (reveal && known && !known.has(room.id)) {
      // a new room traces itself in, with one radar ping
      cell.classList.add('map-cell--new');
      cell.setAttribute('pathLength', '100'); // so the trace's dash length is the whole outline
      pings.push(el('circle', { cx: x, cy: y, r: SIZE / 2, class: 'map-ping' }));
    }
  }
  seen.set(svg, new Set(rooms.map((r) => r.id)));

  for (const { from, dir } of stubs) {
    const [x, y] = centre(from);
    const [dx, dy] = vector(dir);
    // Sit the chevron in the gap just outside the square's edge (or corner, for diagonals).
    const reach = SIZE / 2 + GAP / 2;
    const at = `translate(${x + dx * reach} ${y + dy * reach})`;
    if (dir === 'up' || dir === 'down') {
      // stairs sit on a diagonal too, so give them their own mark: ▲ up, ▼ down
      children.push(
        el('path', {
          d: dir === 'up' ? 'M 0 -3.5 L 4 3 L -4 3 Z' : 'M 0 3.5 L 4 -3 L -4 -3 Z',
          transform: at,
          class: 'map-stub map-stub--stair',
        }),
      );
      continue;
    }
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    children.push(
      el('path', {
        d: 'M -2.5 -4 L 2 0 L -2.5 4',
        transform: `${at} rotate(${angle})`,
        class: 'map-stub',
      }),
    );
  }

  world.replaceChildren(...children, ...pings);

  const [cx, cy] = current ? centre(current.id) : [0, 0];
  world.style.transform = `translate(${-cx}px, ${-cy}px)`;

  here.set(svg, current?.name ?? '–');
  if (caption) {
    nameOnHover(svg, caption);
    showHere(svg, caption);
    caption.count.textContent = `${rooms.length} ${rooms.length === 1 ? 'location' : 'locations'}`;
  }

  const described = rooms.map((r) => {
    if (!r.mark) return r.name;
    const note = r.mark.kind === 'slain' ? 'lies dead there' : 'is there';
    return `${r.name} (the ${r.mark.name} ${note})`;
  });
  svg.setAttribute(
    'aria-label',
    `Map of explored locations: ${described.join(', ')}. ` +
      `You are in ${current?.name ?? 'an unknown place'}.`,
  );
  return pings.length > 0;
}

/** How much of the phosphor colour is left in a room left 1, 2 and 3 moves ago. */
const AFTERGLOW = [42, 26, 13];

/**
 * Give an element the afterglow of a room or corridor left `n` moves ago. When the trail has just
 * moved on, it cools from the level it had a move before (fully lit, for the room just left).
 */
function glow(node: SVGElement, className: string, n: number, cooling: boolean): void {
  node.classList.add(className);
  if (cooling) node.classList.add('map-cooling');
  node.style.setProperty('--glow', `${AFTERGLOW[n - 1]}%`);
  node.style.setProperty('--glow-from', `${n === 1 ? 100 : AFTERGLOW[n - 2]}%`);
}

/** A creature's mark at a room's centre: a diamond while it lives, a cross once slain. */
function mark(x: number, y: number, kind: 'creature' | 'slain', onCurrent: boolean): SVGElement {
  const r = 4.5;
  const d =
    kind === 'creature'
      ? `M 0 ${-r} L ${r} 0 L 0 ${r} L ${-r} 0 Z`
      : `M ${-r} ${-r} L ${r} ${r} M ${r} ${-r} L ${-r} ${r}`;
  const cls = `map-mark map-mark--${kind}${onCurrent ? ' map-mark--here' : ''}`;
  return el('path', { d, transform: `translate(${x} ${y})`, class: cls });
}

function showHere(svg: SVGSVGElement, caption: Caption): void {
  caption.label.textContent = 'You are in';
  caption.here.textContent = here.get(svg) ?? '–';
}

const named = new WeakSet<SVGSVGElement>();

/** Pointing at a room (or tapping it) names it in the caption; leaving the map restores it. */
function nameOnHover(svg: SVGSVGElement, caption: Caption): void {
  if (named.has(svg)) return;
  named.add(svg);
  svg.addEventListener('pointerover', (e) => {
    const cell = (e.target as Element).closest('.map-cell');
    const name = cell?.getAttribute('data-name');
    if (!cell || !name || cell.classList.contains('map-cell--current')) {
      showHere(svg, caption);
      return;
    }
    caption.label.textContent = 'That is the';
    caption.here.textContent = name;
  });
  // a finger lifting off counts as leaving, so a tapped name stays until the next tap or move
  svg.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'touch') showHere(svg, caption);
  });
}
