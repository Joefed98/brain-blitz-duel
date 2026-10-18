import { createContext, useContext, useEffect, useRef, useState } from "react";

/**
 * PC and laptop browsers (17 Oct 2026, presentation and input only; docs/desktop-support.md).
 *
 * Desktop layout: a mouse or trackpad (hover and a fine primary pointer) in a window at least
 * 1180×560. Phones and tablets (coarse pointers) never match, whatever their size, so their
 * screens are exactly as before; polish-layout/desktop.css holds the same query.
 */
export const DESKTOP_QUERY = "(min-width: 1180px) and (min-height: 560px) and (hover: hover) and (pointer: fine)";

/**
 * Keyboard controls: any window with a mouse or trackpad (no size rule, so a narrow desktop
 * window keeps its keys). A phone's coarse pointer never matches, so no key listener is added there.
 */
export const KEYS_QUERY = "(hover: hover) and (pointer: fine)";

function matches(query: string): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

/** Whether a query matches now and on every change (false on the server and on the first render). */
function useMediaQuery(query: string): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(query);
    const update = () => setOn(list.matches);
    update();
    list.addEventListener?.("change", update);
    return () => list.removeEventListener?.("change", update);
  }, [query]);
  return on;
}

/** The desktop layout is showing (DESKTOP_QUERY). */
export function useDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}

/** Focus is somewhere text is typed (chat, a name field): keys belong to it, never to the game. */
function typing(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']"));
}

/** A key's game name: letters lower-case, everything else as KeyboardEvent.key gives it. */
export function gameKey(event: KeyboardEvent): string {
  return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}

export type GameKeyHandler = (kind: "down" | "up", key: string, event: KeyboardEvent) => boolean | void;

/** True inside an intro demo's stage (PuzzleDemo): its board never takes the player's keys. */
export const GameKeysOff = createContext(false);

/**
 * Keyboard controls for a game stage. The handler gets each key down and up (gameKey names:
 * arrows as "ArrowLeft" etc., letters lower-case, " " for Space, "Enter", "Backspace") and
 * returns true when it used the key, which then never scrolls the page or presses a focused
 * button. Keys typed into a text field, shortcuts with Ctrl, Alt or Cmd, and synthetic events
 * (an intro demo's replayed keys) are left alone. Listens only on a device with a mouse or
 * trackpad (KEYS_QUERY), while `enabled`, and never inside an intro demo (GameKeysOff); the
 * handler feeds the same refs and queues as the game's pointer handlers, so a key reaches
 * the same tick path as a tap and timing and scoring never change.
 */
export function useGameKeys(handler: GameKeyHandler, enabled = true): void {
  const off = useContext(GameKeysOff);
  const ref = useRef(handler);
  ref.current = handler;
  const on = enabled && !off;
  useEffect(() => {
    if (!on || !matches(KEYS_QUERY)) return;
    /** Keys held now, so leaving the window lets them go (a held key never sticks, as a finger never does). */
    const held = new Map<string, string>();
    const listen = (kind: "down" | "up") => (event: KeyboardEvent) => {
      if (!event.isTrusted || typing(event.target)) return;
      const key = gameKey(event);
      if (kind === "up") {
        if (!held.delete(key)) return;
      } else {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        held.set(key, event.key);
      }
      if (ref.current(kind, key, event) === true) event.preventDefault();
    };
    const down = listen("down");
    const up = listen("up");
    const blur = () => {
      for (const [key, raw] of [...held]) {
        held.delete(key);
        ref.current("up", key, new KeyboardEvent("keyup", { key: raw }));
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      blur();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [on]);
}

/** Left/right from the arrows or A/D (null for any other key). */
export function horizontalOf(key: string): -1 | 1 | null {
  if (key === "ArrowLeft" || key === "a") return -1;
  if (key === "ArrowRight" || key === "d") return 1;
  return null;
}

/** Up/down/left/right from the arrows or WASD (null for any other key). */
export function directionOf(key: string): "up" | "down" | "left" | "right" | null {
  if (key === "ArrowUp" || key === "w") return "up";
  if (key === "ArrowDown" || key === "s") return "down";
  if (key === "ArrowLeft" || key === "a") return "left";
  if (key === "ArrowRight" || key === "d") return "right";
  return null;
}

/**
 * Held left/right keys as one direction: the last key still down wins, so pressing the other
 * way and letting go returns to the first. `dir()` is -1, 0 or 1.
 */
export function heldHorizontal() {
  const down: (-1 | 1)[] = [];
  return {
    key(kind: "down" | "up", key: string): boolean {
      const d = horizontalOf(key);
      if (d === null) return false;
      const at = down.lastIndexOf(d);
      if (kind === "down") {
        if (at === -1) down.push(d);
      } else if (at !== -1) down.splice(at, 1);
      return true;
    },
    dir(): -1 | 0 | 1 {
      return down.length ? down[down.length - 1]! : 0;
    },
    clear() {
      down.length = 0;
    },
  };
}

/**
 * A drag-aimed throw on keys (Bin Toss, Bullseye, Coral Pop): a virtual drag vector, in world
 * px, nudged by the arrows (WASD) 4 px a press, 1 px with Shift; ← → steer, ↑ ↓ lengthen and
 * shorten an upward drag. The game turns it into a launch with the very function its drag uses.
 */
export function aimVector(start: { dx: number; dy: number } = { dx: 0, dy: -110 }) {
  let v: { dx: number; dy: number } | null = null;
  return {
    /** Nudges the vector for a direction key (returns false for any other key). */
    nudge(key: string, fine: boolean): boolean {
      const dir = directionOf(key);
      if (!dir) return false;
      const step = fine ? 1 : 4;
      const next = v ? { ...v } : { ...start };
      if (v) {
        if (dir === "left") next.dx -= step;
        else if (dir === "right") next.dx += step;
        else if (dir === "up") next.dy -= step;
        else next.dy += step;
      }
      next.dx = Math.max(-260, Math.min(260, next.dx));
      next.dy = Math.max(-260, Math.min(-20, next.dy));
      v = next;
      return true;
    },
    get(): { dx: number; dy: number } | null {
      return v;
    },
    /** Shows the vector again from where it was (or the start) without moving it. */
    show(): { dx: number; dy: number } {
      v ??= { ...start };
      return v;
    },
  };
}
