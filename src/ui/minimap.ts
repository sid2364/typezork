import { computeLayout, vector, type GameDef, type GameView } from '../engine';

const SVG = 'http://www.w3.org/2000/svg';
const CELL_X = 92;
const CELL_Y = 44;
const BOX_W = 80;
const BOX_H = 26;
const PAD = 14;
/** Smallest area shown, so a lone room isn't drawn huge. */
const MIN_W = 300;
const MIN_H = 220;

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function label(name: string): string {
  return name.length > 14 ? `${name.slice(0, 13)}…` : name;
}

/** Draws visited rooms, the passages between them and stubs for unexplored exits. */
export function renderMinimap(svg: SVGSVGElement, def: GameDef, view: GameView): void {
  const layout = computeLayout(def);
  const { rooms, edges, stubs } = view.map;
  const centre = (id: string): [number, number] => {
    const [x, y] = layout[id] ?? [0, 0];
    return [x * CELL_X, y * CELL_Y];
  };

  const xs = rooms.map((r) => r.x * CELL_X);
  const ys = rooms.map((r) => r.y * CELL_Y);
  const width = Math.max(MIN_W, Math.max(...xs) - Math.min(...xs) + BOX_W + PAD * 2);
  const height = Math.max(MIN_H, Math.max(...ys) - Math.min(...ys) + BOX_H + PAD * 2);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  svg.setAttribute('viewBox', `${cx - width / 2} ${cy - height / 2} ${width} ${height}`);

  const children: SVGElement[] = [];
  for (const { from, dir } of stubs) {
    const [x, y] = centre(from);
    const [dx, dy] = vector(dir);
    children.push(
      el('line', {
        x1: x,
        y1: y,
        x2: x + dx * CELL_X * 0.5,
        y2: y + dy * CELL_Y * 0.5,
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
    const title = el('title', {});
    title.textContent = room.name;
    g.append(
      title,
      el('rect', { x: x - BOX_W / 2, y: y - BOX_H / 2, width: BOX_W, height: BOX_H, rx: 3 }),
    );
    const text = el('text', { x, y: y + 4, 'text-anchor': 'middle' });
    text.textContent = label(room.name);
    g.appendChild(text);
    children.push(g);
  }
  svg.replaceChildren(...children);

  const here = rooms.find((r) => r.current)?.name ?? '';
  svg.setAttribute(
    'aria-label',
    `Map of ${rooms.length} explored rooms: ${rooms.map((r) => r.name).join(', ')}. You are in ${here}.`,
  );
}
