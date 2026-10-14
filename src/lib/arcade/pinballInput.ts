/**
 * Pinball's thumb zones on the phone: which flippers are held, from any number
 * of fingers (and keys) at once. Each pointer holds the side of the arena it
 * went down on until it lifts, so holding both halves raises both flippers and
 * lifting one finger drops only its own flipper (another finger still on that
 * side keeps it up). A press shorter than a tick is latched so its flipper still
 * rises for one tick. Phone-side only: the sim sees just the held bitmask the
 * Stage records (PIN_INPUT_FLIPPERS).
 */
import { PIN_LEFT, PIN_RIGHT } from "./pinball";

export interface PinHeldTracker {
  /** A finger or key went down on side 0 (left) or 1 (right). */
  down: (id: number | string, side: number) => void;
  /** That finger or key lifted (or was cancelled). */
  up: (id: number | string) => void;
  /** Everything lifted (a new run). */
  clear: () => void;
  /** The mask to send for the next tick: held now, plus anything pressed since the last tick. */
  takeTick: () => number;
  /** The mask held right now (no latch). */
  held: () => number;
}

export function pinHeldTracker(): PinHeldTracker {
  const pointers = new Map<number | string, number>();
  let latched = 0;
  const bit = (side: number) => (side === 0 ? PIN_LEFT : PIN_RIGHT);
  const held = () => {
    let mask = 0;
    for (const side of pointers.values()) mask |= bit(side);
    return mask;
  };
  return {
    down: (id, side) => {
      pointers.set(id, side === 0 ? 0 : 1);
      latched |= bit(side);
    },
    up: (id) => {
      pointers.delete(id);
    },
    clear: () => {
      pointers.clear();
      latched = 0;
    },
    takeTick: () => {
      const mask = held() | latched;
      latched = 0;
      return mask;
    },
    held,
  };
}

/** Which flipper a screen x drives: the left or right half of the arena box. */
export function pinSideOf(box: { left: number; width: number } | undefined, clientX: number): number {
  if (!box || box.width < 1) return 0;
  return clientX < box.left + box.width / 2 ? 0 : 1;
}
