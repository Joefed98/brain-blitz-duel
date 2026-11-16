/**
 * Lightbender's effects (the Pattern overhaul stage 2, 15 Nov 2026; docs/design/game-fx/README.md). Presentation only:
 * these observe what the stage and board already decided (a piece placed or turned, the beam reaching a gem, a
 * splitter or a bomb, a shot's verdict) and animate the pieces' own art (the mirror's sprite group, a gem's or bomb's
 * own svg, the emitter, a pill). Nothing here reads or writes a placement, the log, the shots, the clock or the grade,
 * and nothing waits on an animation: the board's hit testing is by coordinates on the board, so the next press is
 * taken at once.
 *
 * Every effect is the kit's (`gameFx`) but the turn, a two-click ratchet on the mirror's own sprite (transform only).
 * The game plays its own recordings (laser.place, laser.turn, laser.fire, pz_laser_gem, pz_laser_split, laser.bomb,
 * laser.nearMiss, laser.outOfShots, laser.solve), so every kit call here is `silent`.
 */
import { useEffect, useLayoutEffect, useRef } from "react";

import { gameFx, gameFxVariant, type GameFxVariant } from "@/lib/fx/kit";
import { isSplitter } from "@/lib/duel/laser";
import type { MirrorPlacement } from "@/lib/duel/types";

const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** The turn's length (Joe's spec: a crisp ratchet). */
export const LASER_TURN_MS = 170;
/** How long the "1 gem dark" pill stays after a near miss (it never covers the board). */
export const LASER_NEAR_MISS_MS = 2200;

/** The variant the turn plays in (the kit's rule: reduced motion first). */
export function laserFxVariant(): GameFxVariant {
  return gameFxVariant("slide");
}

/** A piece set down on a square: the kit's drop on its own art. */
export function laserPlaceFx(el: Element | null | undefined): Animation | undefined {
  return el ? gameFx("drop", el, { silent: true }) : undefined;
}

/**
 * A piece turned to its other diagonal: the new sprite swings in from the old one's angle (a quarter turn back) in two
 * clicks with a small overshoot. Reduced motion: the kit's 120 ms crossfade to the new state.
 */
export function laserTurnFx(el: Element | null | undefined): Animation | undefined {
  if (!el) return undefined;
  const variant = laserFxVariant();
  if (variant === "reduced") return gameFx("tap", el, { silent: true });
  const node = el as HTMLElement;
  if (typeof node.animate !== "function") return undefined;
  const ms = variant === "lite" ? 120 : LASER_TURN_MS;
  try {
    return node.animate(
      [
        { transform: "rotate(-90deg)", easing: "cubic-bezier(.4,0,.6,1)" },
        { transform: "rotate(-47deg)", offset: 0.38, easing: "linear" },
        { transform: "rotate(-43deg)", offset: 0.5, easing: "cubic-bezier(.3,.9,.4,1)" },
        { transform: "rotate(5deg)", offset: 0.84, easing: "ease-out" },
        { transform: "rotate(0deg)" },
      ],
      { duration: ms },
    );
  } catch {
    return undefined;
  }
}

/** The beam leaving the emitter: a short pulse on the housing. */
export function laserFireFx(el: Element | null | undefined): Animation | undefined {
  return el ? gameFx("tap", el, { silent: true }) : undefined;
}

/** A gem the beam reaches: it lights up with a pop that grows gem by gem and a few gold sparks (n = 1 for the first). */
export function laserGemFx(el: Element | null | undefined, n: number): Animation | undefined {
  return el ? gameFx("combo", el, { count: n, silent: true }) : undefined;
}

/** The beam reaching a splitter: the prism pulses as it forks the beam (the chord is pz_laser_split). */
export function laserSplitFx(el: Element | null | undefined): Animation | undefined {
  return el ? gameFx("tap", el, { silent: true }) : undefined;
}

/** The beam hitting a bomb: the kit's short jolt on the bomb (the blast is laser.bomb). */
export function laserBombFx(el: Element | null | undefined): Animation | undefined {
  return el ? gameFx("wrong", el, { silent: true }) : undefined;
}

/** A refused drop: the kit's shake on the square's own art (playWrong is the stage's). */
export function laserRefuseFx(el: Element | null | undefined): Animation | undefined {
  return el ? gameFx("wrong", el, { silent: true, noHaptic: true }) : undefined;
}

/** A shot one gem short: two soft pulses on the dark gem and on the "1 gem dark" pill (the sound is laser.nearMiss). */
export function laserNearMissFx(gem: Element | null | undefined, pill: Element | null | undefined): void {
  if (gem) gameFx("nearMiss", gem, { silent: true });
  if (pill) gameFx("nearMiss", pill, { silent: true, noHaptic: true });
}

/** The solve's payoff on the reveal's result card (no haptic outside a live board). */
export function laserWinFx(card: Element | null | undefined): Animation | undefined {
  return card ? gameFx("win", card, { silent: true, inGame: false }) : undefined;
}

/** The one gem a shot left dark, when it lit every other (a near miss), else null. */
export function laserDarkGem(gems: number[], lit: number[], hitBomb: boolean): number | null {
  if (hitBomb || gems.length < 2) return null;
  const litSet = new Set(lit);
  const dark = gems.filter((gem) => !litSet.has(gem));
  return dark.length === 1 ? dark[0]! : null;
}

/** A square's own art on the board: a placed mirror's sprite group, else the piece drawn in the cell, else the cell. */
export function laserCellArt(board: Element | null | undefined, cell: number): Element | null {
  if (!board) return null;
  return (
    board.querySelector(`[data-mirror-cell="${cell}"]`) ??
    board.querySelector(`[data-laser-cell="${cell}"] svg`) ??
    board.querySelector(`[data-laser-cell="${cell}"]`)
  );
}

/** The splitters a board holds: fixed ones and placed ones. */
export function laserSplitterCells(fixed: number[], placed: MirrorPlacement[]): number[] {
  return [...fixed, ...placed.filter((piece) => isSplitter(piece.kind)).map((piece) => piece.cell)];
}

/**
 * The live board's effects, read from what it draws (the first draw, a seeded or remounted board, plays nothing):
 * a piece new on a square drops in, a piece whose diagonal changed turns, the emitter pulses as a shot leaves it, each
 * gem the beam reaches lights up in turn, each splitter it reaches pulses, a bomb it hits jolts.
 */
export function useLaserPieceFx({
  live,
  board,
  placed,
  firing,
  litGems,
  reached,
  splitterCells,
  bombHit,
}: {
  live: boolean;
  board: { current: Element | null };
  placed: MirrorPlacement[];
  firing: boolean;
  litGems: number[];
  /** Every cell the beam on screen has reached, as a key ("3,4,14"), so a redraw with nothing new plays nothing. */
  reached: string;
  /** The board's splitter cells, as a key. */
  splitterCells: string;
  bombHit: boolean;
}) {
  const prev = useRef<{ placed: MirrorPlacement[]; firing: boolean; lit: Set<number>; reached: Set<string>; bombHit: boolean } | null>(null);
  const litKey = litGems.join(",");
  useBeforePaint(() => {
    const before = prev.current;
    const lit = litKey ? litKey.split(",").map(Number) : [];
    const now = { placed, firing, lit: new Set(lit), reached: new Set(reached ? reached.split(",") : []), bombHit };
    prev.current = now;
    if (!live || !before) return;
    const root = board.current;
    if (!root) return;
    if (placed !== before.placed) {
      const was = new Map(before.placed.map((piece) => [piece.cell, piece.kind]));
      for (const piece of placed) {
        const art = laserCellArt(root, piece.cell);
        if (!was.has(piece.cell)) laserPlaceFx(art);
        else if (was.get(piece.cell) !== piece.kind) laserTurnFx(art);
      }
    }
    if (firing && !before.firing) laserFireFx(root.querySelector(".laser-emitter"));
    lit.forEach((gem, i) => {
      if (!before.lit.has(gem)) laserGemFx(root.querySelector(`[data-laser-cell="${gem}"] .laser-gem`), i + 1);
    });
    for (const cell of splitterCells ? splitterCells.split(",") : []) {
      if (now.reached.has(cell) && !before.reached.has(cell)) laserSplitFx(laserCellArt(root, Number(cell)));
    }
    if (bombHit && !before.bombHit) for (const bomb of Array.from(root.querySelectorAll(".laser-bomb-hit"))) laserBombFx(bomb);
  }, [live, board, placed, firing, litKey, reached, splitterCells, bombHit]);
}
