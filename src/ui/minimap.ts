import { computeLayout, vector, type GameDef, type GameView } from '../engine';

const SVG = 'http://www.w3.org/2000/svg';
const BOX_W = 108;
const BOX_H = 42;
const CELL_X = 126;
const CELL_Y = 66;
/** How many grid cells are visible either side of the current room. */
const REACH = 1.5;
const VIEW_W = 2 * REACH * CELL_X;
const VIEW_H = 2 * REACH * CELL_Y;

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function label(name: string): string {
  return name.length > 13 ? `${name.slice(0, 12)}…` : name;
}

/** The persistent group that holds the rooms, so moving between rooms can animate. */
const worlds = new WeakMap<SVGSVGElement, SVGGElement>();

function worldGroup(svg: SVGSVGElement): SVGGElement {
  const existing = worlds.get(svg);
  if (existing) return existing;

  svg.setAttribute('viewBox', `${-VIEW_W / 2} ${-VIEW_H / 2} ${VIEW_W} ${VIEW_H}`);
  // Fade out towards the edges, like a radar.
  const gradient = el('radialGradient', { id: 'map-fade' });
  gradient.append(
    el('stop', { offset: '0.55', 'stop-color': 'white' }),
    el('stop', { offset: '1', 'stop-color': 'black' }),
  );
  const mask = el('mask', { id: 'map-mask' });
  mask.append(
    el('rect', {
      x: -VIEW_W / 2,
      y: -VIEW_H / 2,
      width: VIEW_W,
      height: VIEW_H,
      fill: 'url(#map-fade)',
    }),
  );
  const defs = el('defs');
  defs.append(gradient, mask);
  const masked = el('g', { mask: 'url(#map-mask)' });
  const world = el('g', { class: 'map-world' });
  masked.append(world);
  svg.replaceChildren(defs, masked);
  worlds.set(svg, world);
  return world;
}

/**
 * A close-up map centred on the player: only what's within about a room and a
 * half is in view, so the rest of the world stays a mystery.
 */
export function renderMinimap(svg: SVGSVGElement, def: GameDef, view: GameView): void {
  const world = worldGroup(svg);
  const layout = computeLayout(def);
  const { rooms, edges, stubs } = view.map;
  const centre = (id: string): [number, number] => {
    const [x, y] = layout[id] ?? [0, 0];
    return [x * CELL_X, y * CELL_Y];
  };

  const children: SVGElement[] = [];
  for (const { from, dir } of stubs) {
    const [x, y] = centre(from);
    const [dx, dy] = vector(dir);
    children.push(
      el('line', {
        x1: x,
        y1: y,
        x2: x + dx * CELL_X * 0.6,
        y2: y + dy * CELL_Y * 0.6,
        class: 'map-stub',
      }),
    );
  }
  for (const { from, to } of edges) {
    const [x1, y1] = centre(from);
    const [x2, y2] = centre(to);
    children.push(el('line', { x1, y1, x2, y2, class: 'map-edge' }));
  }
  for (const room of rooms) {
    const [x, y] = centre(room.id);
    const g = el('g', { class: room.current ? 'map-room map-room--current' : 'map-room' });
    const title = el('title');
    title.textContent = room.name;
    const text = el('text', { x, y: y + 6, 'text-anchor': 'middle' });
    text.textContent = label(room.name);
    g.append(
      title,
      el('rect', { x: x - BOX_W / 2, y: y - BOX_H / 2, width: BOX_W, height: BOX_H, rx: 4 }),
      text,
    );
    children.push(g);
  }
  world.replaceChildren(...children);

  const current = rooms.find((r) => r.current);
  const [cx, cy] = current ? centre(current.id) : [0, 0];
  world.style.transform = `translate(${-cx}px, ${-cy}px)`;

  svg.setAttribute(
    'aria-label',
    `Map of explored rooms: ${rooms.map((r) => r.name).join(', ')}. ` +
      `You are in ${current?.name ?? 'an unknown place'}.`,
  );
}
