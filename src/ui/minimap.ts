import { computeLayout, vector, type GameDef, type GameView } from '../engine';

const SVG = 'http://www.w3.org/2000/svg';
/** Distance between cell centres. */
const PITCH = 34;
/** Side of a room square; the rest of the pitch is the gap that corridors and chevrons sit in. */
const SIZE = 24;
const GAP = PITCH - SIZE;
/** Cells visible across and down. */
const COLS = 7;
const ROWS = 6;
const VIEW_W = COLS * PITCH;
const VIEW_H = ROWS * PITCH;
/** How far the background grid extends around the explored area, in cells. */
const GRID_MARGIN = Math.max(COLS, ROWS);

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** The persistent group that holds the rooms, so moving between rooms can animate. */
const worlds = new WeakMap<SVGSVGElement, SVGGElement>();

function worldGroup(svg: SVGSVGElement): SVGGElement {
  const existing = worlds.get(svg);
  if (existing) return existing;

  svg.setAttribute('viewBox', `${-VIEW_W / 2} ${-VIEW_H / 2} ${VIEW_W} ${VIEW_H}`);
  // One empty cell outline per grid square, aligned so cells are centred on multiples of PITCH.
  const pattern = el('pattern', {
    id: 'map-grid',
    patternUnits: 'userSpaceOnUse',
    x: -PITCH / 2,
    y: -PITCH / 2,
    width: PITCH,
    height: PITCH,
  });
  pattern.append(
    el('rect', { x: GAP / 2, y: GAP / 2, width: SIZE, height: SIZE, class: 'map-grid-cell' }),
  );
  const defs = el('defs');
  defs.append(pattern);
  const world = el('g', { class: 'map-world' });
  svg.replaceChildren(defs, world);
  worlds.set(svg, world);
  return world;
}

/**
 * Where to centre the view along one axis. If the explored rooms (plus a cell of
 * margin for exit chevrons) fit, centre on them; otherwise follow the player,
 * but stop at the edge of the explored area so the view isn't wasted on blank grid.
 */
function frame(player: number, min: number, max: number, cells: number): number {
  const half = (cells - 1) / 2;
  if (max - min + 2 > cells - 1) return Math.min(Math.max(player, min - 1 + half), max + 1 - half);
  // Snap so the edge of the view falls between cells rather than through them.
  const offset = cells % 2 === 0 ? 0.5 : 0;
  return Math.round((min + max) / 2 - offset) + offset;
}

/**
 * A grid map that frames the explored area: each explored room is a square, corridors
 * join neighbouring squares, and chevrons mark exits that haven't been taken.
 */
export function renderMinimap(
  svg: SVGSVGElement,
  def: GameDef,
  view: GameView,
  caption?: { here: Element; count: Element },
): void {
  const world = worldGroup(svg);
  const layout = computeLayout(def);
  const { rooms, edges, stubs } = view.map;
  const centre = (id: string): [number, number] => {
    const [x, y] = layout[id] ?? [0, 0];
    return [x * PITCH, y * PITCH];
  };

  const cells = rooms.map((r) => layout[r.id] ?? [0, 0]);
  const xs = cells.map(([x]) => x);
  const ys = cells.map(([, y]) => y);
  const minX = Math.min(0, ...xs) - GRID_MARGIN;
  const minY = Math.min(0, ...ys) - GRID_MARGIN;
  const children: SVGElement[] = [
    el('rect', {
      x: minX * PITCH - PITCH / 2,
      y: minY * PITCH - PITCH / 2,
      width: (Math.max(0, ...xs) + GRID_MARGIN - minX + 1) * PITCH,
      height: (Math.max(0, ...ys) + GRID_MARGIN - minY + 1) * PITCH,
      fill: 'url(#map-grid)',
    }),
  ];

  for (const { from, to } of edges) {
    const [x1, y1] = centre(from);
    const [x2, y2] = centre(to);
    children.push(el('line', { x1, y1, x2, y2, class: 'map-corridor' }));
  }

  for (const room of rooms) {
    const [x, y] = centre(room.id);
    const cell = el('rect', {
      x: x - SIZE / 2,
      y: y - SIZE / 2,
      width: SIZE,
      height: SIZE,
      class: room.current ? 'map-cell map-cell--current' : 'map-cell',
    });
    const title = el('title');
    title.textContent = room.name;
    cell.append(title);
    children.push(cell);
  }

  for (const { from, dir } of stubs) {
    const [x, y] = centre(from);
    const [dx, dy] = vector(dir);
    // Sit the chevron in the gap just outside the square's edge (or corner, for diagonals).
    const reach = SIZE / 2 + GAP / 2;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    children.push(
      el('path', {
        d: 'M -2.5 -4 L 2 0 L -2.5 4',
        transform: `translate(${x + dx * reach} ${y + dy * reach}) rotate(${angle})`,
        class: 'map-stub',
      }),
    );
  }

  world.replaceChildren(...children);

  const current = rooms.find((r) => r.current);
  const [px, py] = current ? (layout[current.id] ?? [0, 0]) : [0, 0];
  const cx = frame(px, Math.min(...xs), Math.max(...xs), COLS) * PITCH;
  const cy = frame(py, Math.min(...ys), Math.max(...ys), ROWS) * PITCH;
  world.style.transform = `translate(${-cx}px, ${-cy}px)`;

  if (caption) {
    caption.here.textContent = current?.name ?? '–';
    caption.count.textContent = `${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'}`;
  }

  svg.setAttribute(
    'aria-label',
    `Map of explored rooms: ${rooms.map((r) => r.name).join(', ')}. ` +
      `You are in ${current?.name ?? 'an unknown place'}.`,
  );
}
