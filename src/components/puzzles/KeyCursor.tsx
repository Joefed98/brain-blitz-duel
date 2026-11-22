import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { directionOf, useGameKeys } from "@/lib/desktop";
import { BOARD_KEYS } from "@/lib/desktopKeys";
import type { PuzzleType } from "@/lib/duel/types";
import {
  HeldPress,
  boardTargets,
  firstTarget,
  gridCellCentre,
  hotPoint,
  liveStage,
  nearestTarget,
  nextTarget,
  pressAt,
  type Point,
} from "@/lib/gameFrame/boardKeys";

/**
 * The desktop keyboard's cursor over a board (17 Oct 2026, display only; docs/desktop-support.md):
 * a ring round one cell, placed in world units as percentages of the arena box, so it sits on the
 * drawn cell at any size. It takes no pointer events and is drawn only once a key has moved it,
 * so a phone (which never sends keys) never shows it.
 */
export function KeyCursor({ rect, worldW, worldH }: { rect: { x: number; y: number; w: number; h: number } | null; worldW: number; worldH: number }) {
  if (!rect) return null;
  return (
    <div
      aria-hidden="true"
      data-key-cursor=""
      className="pointer-events-none absolute rounded-md"
      style={{
        left: `${(rect.x / worldW) * 100}%`,
        top: `${(rect.y / worldH) * 100}%`,
        width: `${(rect.w / worldW) * 100}%`,
        height: `${(rect.h / worldH) * 100}%`,
        boxShadow: "0 0 0 3px #FFFFFF, 0 0 0 5px rgba(0, 0, 0, 0.7)",
      }}
    />
  );
}

/** A grid cursor moved by the arrows (WASD): null until the first key, then clamped to the grid. */
export function useGridCursor(rows: number, cols: number, start: { row: number; col: number } = { row: 0, col: 0 }) {
  const [cell, setCell] = useState<{ row: number; col: number } | null>(null);
  return {
    cell,
    /** Moves one step (showing the cursor first if hidden); returns the new cell. */
    move(dir: "up" | "down" | "left" | "right"): { row: number; col: number } {
      const from = cell ?? start;
      const next = cell
        ? {
            row: Math.max(0, Math.min(rows - 1, from.row + (dir === "up" ? -1 : dir === "down" ? 1 : 0))),
            col: Math.max(0, Math.min(cols - 1, from.col + (dir === "left" ? -1 : dir === "right" ? 1 : 0))),
          }
        : from;
      setCell(next);
      return next;
    },
    /** The cursor's cell, showing it if hidden. */
    show(): { row: number; col: number } {
      const at = cell ?? start;
      if (!cell) setCell(at);
      return at;
    },
    hide() {
      if (cell) setCell(null);
    },
  };
}

/**
 * Keyboard play for the board games that take only taps and drags (lib/gameFrame/boardKeys.ts; the spec per game is
 * desktopKeys.ts BOARD_KEYS): the cursor, crosshair or key cells for the live round's stage, pressing with the same
 * pointer and click events a mouse sends there. Mounted once beside the live round (the arena panel). Listens only on a
 * device with a mouse (useGameKeys) and only while the game's controls are Keyboard; draws nothing until a key is used.
 */
export function BoardKeys({ type, enabled }: { type: PuzzleType; enabled: boolean }) {
  const spec = BOARD_KEYS[type];
  const ring = useRef<HTMLDivElement | null>(null);
  const cur = useRef<Element | null>(null);
  const last = useRef<Point | null>(null);
  const held = useRef<HeldPress | null>(null);
  /** Pull!'s crosshair, as fractions of the board (so a resize keeps its place). */
  const aim = useRef<{ fx: number; fy: number } | null>(null);
  const arrows = useRef(new Set<string>());
  const [shown, setShown] = useState(false);
  const [heldOn, setHeldOn] = useState(false);

  // The ring follows its piece (boards re-render and move): read each frame only while it is shown.
  useEffect(() => {
    if (!shown || !spec) return;
    let frame = 0;
    let speed = 0;
    const place = () => {
      frame = requestAnimationFrame(place);
      const el = ring.current;
      if (!el) return;
      const stage = liveStage();
      let r: { left: number; top: number; width: number; height: number } | null = null;
      if (spec.kind === "aim") {
        const board = stage?.querySelector(spec.board)?.getBoundingClientRect();
        const a = aim.current;
        if (board && a) {
          // Held arrows move the crosshair, faster the longer they are held (as a thumbstick would).
          const dx = (arrows.current.has("right") ? 1 : 0) - (arrows.current.has("left") ? 1 : 0);
          const dy = (arrows.current.has("down") ? 1 : 0) - (arrows.current.has("up") ? 1 : 0);
          speed = dx || dy ? Math.min(14, speed + 0.5) : 0;
          if (dx || dy) {
            // Kept a pixel inside the board's edge, where a press still lands on the board (as a mouse's must).
            const inX = 1 / board.width;
            const inY = 1 / board.height;
            a.fx = Math.max(inX, Math.min(1 - inX, a.fx + (dx * (3 + speed)) / board.width));
            a.fy = Math.max(inY, Math.min(1 - inY, a.fy + (dy * (3 + speed)) / board.height));
          }
          r = { left: board.left + a.fx * board.width - 18, top: board.top + a.fy * board.height - 18, width: 36, height: 36 };
        }
      } else if (cur.current?.isConnected) {
        const b = cur.current.getBoundingClientRect();
        r = { left: b.left, top: b.top, width: b.width, height: b.height };
      }
      if (!r) {
        el.style.display = "none";
        return;
      }
      el.style.display = "";
      const next = `translate(${Math.round(r.left)}px, ${Math.round(r.top)}px)`;
      if (el.style.transform !== next) el.style.transform = next;
      if (el.style.width !== `${Math.round(r.width)}px`) el.style.width = `${Math.round(r.width)}px`;
      if (el.style.height !== `${Math.round(r.height)}px`) el.style.height = `${Math.round(r.height)}px`;
    };
    place();
    return () => cancelAnimationFrame(frame);
  }, [shown, spec]);

  // Leaving the round (or the Keyboard controls) lets a held press go, as lifting a finger would.
  useEffect(
    () => () => {
      held.current?.release();
      held.current = null;
    },
    [],
  );

  const point = (): Point | null => {
    if (!spec || spec.kind !== "cursor" || !cur.current?.isConnected) return null;
    return hotPoint(cur.current, spec.hit);
  };

  useGameKeys((kind, key, event) => {
    const stage = liveStage();
    if (!spec || !stage) return false;
    if (spec.kind === "press") {
      if (!spec.keys.includes(key)) return false;
      if (kind === "down" && !event.repeat) {
        const target = stage.querySelector(spec.target);
        if (target) pressAt(hotPoint(target));
      }
      return true;
    }
    if (spec.kind === "grid") {
      const row = spec.keys.findIndex((line) => line.includes(key));
      if (row < 0) return false;
      if (kind === "down" && !event.repeat) {
        const board = stage.querySelector(spec.board);
        if (board) pressAt(gridCellCentre(board, spec.keys.length, spec.keys[row]!.length, row, spec.keys[row]!.indexOf(key)));
      }
      return true;
    }
    const dir = directionOf(key);
    if (spec.kind === "aim") {
      if (dir) {
        if (kind === "down") {
          if (!aim.current) aim.current = { fx: 0.5, fy: 0.5 };
          arrows.current.add(dir);
          setShown(true);
        } else arrows.current.delete(dir);
        return true;
      }
      if (key !== " " && key !== "Enter") return false;
      if (kind === "down" && !event.repeat) {
        const board = stage.querySelector(spec.board)?.getBoundingClientRect();
        if (!aim.current) {
          aim.current = { fx: 0.5, fy: 0.5 };
          setShown(true);
        } else if (board) pressAt({ x: board.left + aim.current.fx * board.width, y: board.top + aim.current.fy * board.height });
      }
      return true;
    }
    // The cursor.
    const button = spec.buttons?.[key];
    if (button) {
      if (kind === "down" && !event.repeat) {
        const el = stage.querySelector<HTMLElement>(button);
        if (el && !(el as HTMLButtonElement).disabled) el.click();
      }
      return true;
    }
    if (dir) {
      if (kind === "up") return true;
      const targets = boardTargets(stage, spec.targets);
      const from = point() ?? last.current;
      if (!cur.current?.isConnected || !targets.includes(cur.current as HTMLElement)) {
        cur.current = from ? nearestTarget(from, targets) : firstTarget(targets);
        if (!shown || !from) {
          setShown(true);
          if (!held.current) return true;
        }
      } else {
        const next = nextTarget(point() ?? from!, dir, targets, cur.current);
        if (next) cur.current = next;
      }
      const at = point();
      if (at) {
        last.current = at;
        held.current?.move(at);
      }
      return true;
    }
    if (key === "Escape") {
      if (kind === "down") {
        held.current?.release();
        held.current = null;
        setHeldOn(false);
        setShown(false);
      }
      return Boolean(shown);
    }
    if (key !== " " && key !== "Enter") return false;
    if (kind === "down") {
      if (event.repeat) return true;
      const targets = boardTargets(stage, spec.targets);
      if (!cur.current?.isConnected || !targets.includes(cur.current as HTMLElement)) {
        // The first press shows the cursor where it would press; the next one presses.
        cur.current = last.current ? nearestTarget(last.current, targets) : firstTarget(targets);
        setShown(true);
        if (!shown) return true;
      }
      const at = point();
      if (!at) return true;
      last.current = at;
      held.current?.release();
      held.current = new HeldPress(at, Boolean(spec.secondary && event.shiftKey));
      setHeldOn(true);
    } else if (held.current) {
      const at = point();
      if (at) held.current.move(at);
      held.current.release();
      held.current = null;
      setHeldOn(false);
    }
    return true;
  }, enabled && Boolean(spec));

  if (!spec || !shown || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={ring}
      aria-hidden="true"
      data-board-key-cursor={spec.kind}
      data-held={heldOn ? "" : undefined}
      className={`board-key-cursor${spec.kind === "aim" ? " board-key-aim" : ""}`}
    />,
    document.body,
  );
}
