import type { GameDef } from './definitions';
import { DIRECTIONS, vector, type Direction } from './direction';
import type { RoomId } from './types';
import type { World } from './world';

export type Layout = Readonly<Record<RoomId, readonly [number, number]>>;

const layouts = new WeakMap<GameDef, Layout>();

/**
 * Give every room a grid position. Rooms with a `pos` keep it; the rest are
 * placed by walking out from the start room along exit directions. If a cell
 * is taken, the room is pushed further along the same direction, then to the
 * nearest free cell.
 */
export function computeLayout(def: GameDef): Layout {
  const cached = layouts.get(def);
  if (cached) return cached;

  const pos: Record<RoomId, [number, number]> = {};
  const taken = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;
  const place = (id: RoomId, x: number, y: number) => {
    pos[id] = [x, y];
    taken.add(key(x, y));
  };
  for (const room of Object.values(def.rooms)) {
    if (room.pos) place(room.id, room.pos[0], room.pos[1]);
  }

  const free = (x: number, y: number): [number, number] => {
    for (let r = 0; ; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) === r && !taken.has(key(x + dx, y + dy))) {
            return [x + dx, y + dy];
          }
        }
      }
    }
  };

  const roots = [def.start, ...Object.keys(def.rooms)];
  for (const root of roots) {
    if (!pos[root]) {
      // Unconnected rooms go to the right of everything placed so far.
      const maxX = Math.max(0, ...Object.values(pos).map(([x]) => x));
      const [x, y] = free(Object.keys(pos).length ? maxX + 2 : 0, 0);
      place(root, x, y);
    }
    const queue: RoomId[] = [root];
    while (queue.length) {
      const id = queue.shift()!;
      const [x, y] = pos[id]!;
      const room = def.rooms[id]!;
      for (const dir of DIRECTIONS) {
        const exit = room.exits[dir];
        if (!exit || pos[exit.to]) continue;
        const [dx, dy] = vector(dir);
        let target: [number, number] | undefined;
        for (let step = 1; step <= 3 && !target; step++) {
          if (!taken.has(key(x + dx * step, y + dy * step)))
            target = [x + dx * step, y + dy * step];
        }
        target ??= free(x + dx, y + dy);
        place(exit.to, target[0], target[1]);
        queue.push(exit.to);
      }
    }
  }

  layouts.set(def, pos);
  return pos;
}

export interface MapRoom {
  readonly id: RoomId;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly current: boolean;
}

export interface MapView {
  /** Visited rooms only. */
  readonly rooms: readonly MapRoom[];
  /** Connections between visited rooms. */
  readonly edges: readonly { readonly from: RoomId; readonly to: RoomId }[];
  /** Known exits leading somewhere not yet visited. */
  readonly stubs: readonly { readonly from: RoomId; readonly dir: Direction }[];
}

export function mapView(w: World): MapView {
  const layout = computeLayout(w.def);
  const visited = new Set(w.state.visited);
  const rooms: MapRoom[] = [];
  const edges: { from: RoomId; to: RoomId }[] = [];
  const stubs: { from: RoomId; dir: Direction }[] = [];
  const seen = new Set<string>();
  for (const id of w.state.visited) {
    const [x, y] = layout[id] ?? [0, 0];
    rooms.push({ id, name: w.room(id).name, x, y, current: id === w.here });
    for (const [dir, exit] of w.exits(id)) {
      if (visited.has(exit.to)) {
        const k = [id, exit.to].sort().join('|');
        if (!seen.has(k)) {
          seen.add(k);
          edges.push({ from: id, to: exit.to });
        }
      } else {
        stubs.push({ from: id, dir });
      }
    }
  }
  return { rooms, edges, stubs };
}
