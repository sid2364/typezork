import type { Direction } from '../engine';

const SVG = 'http://www.w3.org/2000/svg';

/** The eight drawn points: [direction, label, angle in degrees clockwise from north]. */
const POINTS: readonly [Direction, string, number][] = [
  ['north', 'N', 0],
  ['northeast', 'NE', 45],
  ['east', 'E', 90],
  ['southeast', 'SE', 135],
  ['south', 'S', 180],
  ['southwest', 'SW', 225],
  ['west', 'W', 270],
  ['northwest', 'NW', 315],
];

const MAIN_LENGTH = 92;
const DIAGONAL_LENGTH = 62;
const MAIN_WIDTH = 19;
const DIAGONAL_WIDTH = 14;

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

const polar = (deg: number, r: number): string => {
  const a = (deg * Math.PI) / 180;
  return `${(Math.sin(a) * r).toFixed(2)},${(-Math.cos(a) * r).toFixed(2)}`;
};

/** [direction, label, x, y, 1 to point up or -1 to point down] */
const STAIRS: readonly [Direction, string, number, number, 1 | -1][] = [
  ['up', 'UP', 100, -108, 1],
  ['down', 'DN', 100, 108, -1],
];

// an open point goes that way on click, or on Enter or Space when focused
function clickable(g: SVGGElement, dir: Direction, onGo: (dir: Direction) => void): void {
  const go = () => {
    if (g.classList.contains('compass__point--open')) onGo(dir);
  };
  g.addEventListener('click', go);
  g.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      go();
    }
  });
}

interface CompassParts {
  points: Map<Direction, SVGGElement>;
}

const built = new WeakMap<SVGSVGElement, CompassParts>();

/**
 * An engraved-style eight-point compass rose. Each point is two slim triangles:
 * one hatched, one plain, like the old woodcut roses. Directions with an exit
 * light up and can be clicked.
 */
function build(svg: SVGSVGElement, onGo: (dir: Direction) => void): CompassParts {
  svg.setAttribute('viewBox', '-125 -125 250 250');
  const defs = el('defs');
  const layers = { diagonal: el('g'), main: el('g') };
  const points = new Map<Direction, SVGGElement>();

  for (const [dir, label, angle] of POINTS) {
    const main = angle % 90 === 0;
    const length = main ? MAIN_LENGTH : DIAGONAL_LENGTH;
    const width = main ? MAIN_WIDTH : DIAGONAL_WIDTH;

    // Hatching runs along the point, as on an engraving.
    const pattern = el('pattern', {
      id: `hatch-${dir}`,
      width: 2.2,
      height: 2.2,
      patternUnits: 'userSpaceOnUse',
      patternTransform: `rotate(${angle})`,
    });
    pattern.append(el('line', { x1: 0, y1: 0, x2: 0, y2: 2.2, class: 'compass__hatch' }));
    defs.append(pattern);

    const tip = polar(angle, length);
    const g = el('g', { class: 'compass__point' });
    g.append(
      el('polygon', {
        points: `${tip} 0,0 ${polar(angle - 90, width)}`,
        class: 'compass__plain',
      }),
      el('polygon', {
        points: `${tip} 0,0 ${polar(angle + 90, width)}`,
        fill: `url(#hatch-${dir})`,
        class: 'compass__shade',
      }),
    );
    const text = el('text', {
      class: 'compass__label',
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
    });
    const [lx, ly] = polar(angle, length + (main ? 18 : 22)).split(',');
    text.setAttribute('x', lx!);
    text.setAttribute('y', ly!);
    text.textContent = label;
    // An invisible disc around the label widens the tap target beyond the slim point.
    g.append(el('circle', { cx: lx!, cy: ly!, r: 20, class: 'compass__hit' }), text);
    clickable(g, dir, onGo);
    points.set(dir, g);
    (main ? layers.main : layers.diagonal).append(g);
  }

  // up and down sit on the right, ▲ top and ▼ bottom, and only show when there is a stair
  const stairs = el('g');
  for (const [dir, label, x, y, flip] of STAIRS) {
    const g = el('g', {
      class: 'compass__point compass__stair',
      transform: `translate(${x} ${y})`,
    });
    const h = 8 * flip;
    g.append(
      el('polygon', { points: `0,${-h} 9,${h} -9,${h}`, class: 'compass__plain' }),
      Object.assign(
        el('text', {
          class: 'compass__label',
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
          y: 20 * flip,
        }),
        { textContent: label },
      ),
    );
    clickable(g, dir, onGo);
    points.set(dir, g);
    stairs.append(g);
  }

  const hub = el('circle', { r: 3.5, class: 'compass__hub' });
  svg.replaceChildren(defs, layers.diagonal, layers.main, hub, stairs);
  const parts = { points };
  built.set(svg, parts);
  return parts;
}

export function renderCompass(
  svg: SVGSVGElement,
  exits: readonly Direction[],
  onGo: (dir: Direction) => void,
): void {
  const { points } = built.get(svg) ?? build(svg, onGo);
  for (const [dir, g] of points) {
    const open = exits.includes(dir);
    g.classList.toggle('compass__point--open', open);
    g.setAttribute('role', open ? 'button' : 'presentation');
    if (open) {
      g.setAttribute('aria-label', `Go ${dir}`);
      g.setAttribute('tabindex', '0');
    } else {
      g.removeAttribute('aria-label');
      g.removeAttribute('tabindex');
    }
  }
  svg.setAttribute(
    'aria-label',
    exits.length ? `Compass. You can go ${exits.join(', ')}.` : 'Compass. No exits.',
  );
}
