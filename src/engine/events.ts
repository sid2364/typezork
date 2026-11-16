import type { Direction } from './direction';
import type { RoomId, ThingId } from './types';
import type { World } from './world';

export interface GameEvents {
  /** Handlers may return a message to stop the move. */
  beforeMove: { from: RoomId; to: RoomId; dir: Direction };
  afterEnter: { room: RoomId; from: RoomId | null; firstVisit: boolean };
  take: { thing: ThingId };
  drop: { thing: ThingId };
  open: { thing: ThingId };
  kill: { thing: ThingId; weapon: ThingId };
  // fired after a thing is described by examine or look at
  examine: { thing: ThingId; first: boolean };
  turn: { turns: number };
}

export type EventName = keyof GameEvents;
export type Handler<K extends EventName> = (payload: GameEvents[K], w: World) => string | void;

/** A small typed event bus. Used for room hooks, quests, scoring and so on. */
export class EventBus {
  private handlers: { [K in EventName]?: Handler<K>[] } = {};

  on<K extends EventName>(name: K, handler: Handler<K>): () => void {
    const list = (this.handlers[name] ??= []) as Handler<K>[];
    list.push(handler);
    return () => {
      const i = list.indexOf(handler);
      if (i >= 0) list.splice(i, 1);
    };
  }

  /** Calls every handler. Returns the first veto message, if any. */
  emit<K extends EventName>(name: K, payload: GameEvents[K], w: World): string | undefined {
    let veto: string | undefined;
    for (const handler of (this.handlers[name] ?? []) as Handler<K>[]) {
      const result = handler(payload, w);
      if (typeof result === 'string' && veto === undefined) veto = result;
    }
    return veto;
  }
}
