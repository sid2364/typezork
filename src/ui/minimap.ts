import { computeLayout, vector, type GameDef, type GameView } from '../engine';

const SVG = 'http://www.w3.org/2000/svg';
/** Burst radii: spike tips reach the outer ellipse, the valleys sit on the inner one. */
const OUTER_RX = 66;
const OUTER_RY = 33;
const INNER = 0.8;
const SPIKES = 14;
const CELL_X = 146;
const CELL_Y = 76;
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

const FONT = 16;
/** Rough width of a monospace character, as a fraction of the font size. */
const CHAR_W = 0.62;
/** Text has to fit inside the burst's inner ellipse. */
const TEXT_W = OUTER_RX * INNER * 2 - 14;

/**
 * Fit a room name into its box: wrap onto two lines at word breaks, then shrink
 * the font if a line is still too wide.
 */
function fitLabel(name: string): { lines: string[]; size: number } {
  const perLine = Math.floor(TEXT_W / (FONT * CHAR_W));
  const lines: string[] = [];
  for (const word of name.split(' ')) {
    const last = lines[lines.length - 1];
    if (last !== undefined && last.length + 1 + word.length <= perLine) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else lines.push(word);
  }
  if (lines.length > 2) lines.splice(1, lines.length, lines.slice(1).join(' '));
  const longest = Math.max(...lines.map((l) => l.length));
  const size = Math.min(FONT, TEXT_W / (longest * CHAR_W), lines.length > 1 ? 15 : FONT);
  return { lines, size };
}

/** Small deterministic pseudo-random numbers, so each room keeps its own spikes. */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** A comic-book starburst around (0, 0), slightly irregular per room. */
function burstPoints(id: string): string {
  const rand = seeded(id);
  const offset = rand() * Math.PI;
  const points: string[] = [];
  for (let i = 0; i < SPIKES * 2; i++) {
    const angle = offset + (i / (SPIKES * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? 0.92 + rand() * 0.16 : INNER + rand() * 0.04;
    points.push(
      `${(Math.cos(angle) * OUTER_RX * r).toFixed(1)},${(Math.sin(angle) * OUTER_RY * r).toFixed(1)}`,
    );
  }
  return points.join(' ');
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
    const { lines, size } = fitLabel(room.name);
    const lineHeight = size * 1.05;
    const text = el('text', {
      x,
      y: y + size * 0.35 - ((lines.length - 1) * lineHeight) / 2,
      'text-anchor': 'middle',
      'font-size': size.toFixed(1),
    });
    lines.forEach((l, i) => {
      const tspan = el('tspan', { x, dy: i === 0 ? 0 : lineHeight });
      tspan.textContent = l;
      text.append(tspan);
    });
    // The burst sits in its own group so it can pulse without moving the label.
    const burst = el('g', { transform: `translate(${x} ${y})` });
    burst.append(el('polygon', { points: burstPoints(room.id), class: 'map-burst' }));
    g.append(title, burst, text);
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
