/**
 * Lightbender's action log (puzzles stamped `alogRev: 1`; format in
 * actionLog.ts and docs/puzzle-action-log.md). The phone logs every change to
 * the board and every FIRE; the server replays the log against the stored
 * puzzle, counts the shots itself and takes the layout at each shot from the
 * log. A solve happens only on a FIRE whose layout lights all six gems without
 * a bomb; a solving layout that was never fired is not a solve.
 *
 * Verbs (cells 0–99; kinds s = "/", b = "\", v = "S|", h = "S-"):
 *   p<cell><kind>   place a piece from the tray        p23s
 *   r<cell>         turn the piece on a cell           r23
 *   m<from>-<to>    move a piece to an empty cell      m23-45
 *   x<cell>         take a piece back to the tray      x23
 *   c               Reset: every piece back to the tray
 *   f               FIRE
 *
 * The replay holds the board to the phone's own rules: a piece on a fixed
 * cell or an occupied one, beyond its tray count, or a turn, move or removal
 * of a piece that isn't there is ignored and counted; FIREs after the third
 * are ignored and counted; nothing after the solving FIRE counts.
 */
import { decodeActionLog, noteRepair, type ActionLogDiag, type LoggedAction } from "./actionLog";
import { flipMirror, isSplitter, verifyLaser } from "./laser";
import {
  LASER_CELLS,
  LASER_MAX_FIRES,
  type LaserPuzzleData,
  type MirrorKind,
  type MirrorPlacement,
} from "./types";

const KIND_CODE: Record<MirrorKind, string> = { "/": "s", "\\": "b", "S|": "v", "S-": "h" };
const CODE_KIND: Record<string, MirrorKind> = { s: "/", b: "\\", v: "S|", h: "S-" };

export const laserAction = {
  place: (cell: number, kind: MirrorKind) => `p${cell}${KIND_CODE[kind]}`,
  turn: (cell: number) => `r${cell}`,
  move: (from: number, to: number) => `m${from}-${to}`,
  remove: (cell: number) => `x${cell}`,
  reset: () => "c",
  fire: () => "f",
};

type LaserBoard = Pick<
  LaserPuzzleData,
  | "source"
  | "dir"
  | "gems"
  | "bombs"
  | "blocks"
  | "splitters"
  | "directionalGems"
  | "mirrors"
  | "splitterPieces"
>;

export interface LaserShot {
  t: number;
  gemsLit: number;
  hitBomb: boolean;
  solved: boolean;
}

export interface LaserLogReplay {
  /** A FIRE lit every gem without a bomb. */
  solved: boolean;
  /** FIREs the server counted (at most three). */
  shots: number;
  /** The solving shot's number (1–3), or null. */
  solvedShot: number | null;
  /** Round-clock ms of the solving FIRE, or null. */
  solvedAt: number | null;
  /** The layout fired on the solving shot, else the board after the last action. */
  layout: MirrorPlacement[];
  /** Gems that layout lights (the unfinished credit when there was no solve). */
  gemsLit: number;
  /** That layout's beam ends on a bomb. */
  hitBomb: boolean;
  shotLog: LaserShot[];
  diag: ActionLogDiag;
}

function cellOf(raw: string): number | null {
  if (!/^\d{1,2}$/.test(raw)) return null;
  const cell = Number(raw);
  return cell >= 0 && cell < LASER_CELLS ? cell : null;
}

/** Replays decoded actions (time order) on the stored board. */
export function replayLaserActions(
  puzzle: LaserBoard,
  actions: readonly LoggedAction[],
  diag: ActionLogDiag,
): LaserLogReplay {
  const fixed = new Set([
    puzzle.source,
    ...puzzle.gems,
    ...puzzle.bombs,
    ...puzzle.blocks,
    ...(puzzle.splitters ?? []),
  ]);
  const trayFor = (kind: MirrorKind) =>
    isSplitter(kind) ? (puzzle.splitterPieces ?? 0) : puzzle.mirrors;
  let placed: MirrorPlacement[] = [];
  const shotLog: LaserShot[] = [];
  let solvedShot: number | null = null;
  let solvedAt: number | null = null;
  const refuse = (reason: string) => noteRepair(diag, "dropped", reason);

  for (const { a, t } of actions) {
    if (solvedShot !== null) {
      refuse("action after the solve");
      continue;
    }
    const verb = a[0];
    const rest = a.slice(1);
    if (verb === "f" && rest === "") {
      if (shotLog.length >= LASER_MAX_FIRES) {
        refuse("fire beyond the third shot");
        continue;
      }
      const verdict = verifyLaser(puzzle, placed, shotLog.length + 1);
      shotLog.push({
        t,
        gemsLit: verdict.gemsLit,
        hitBomb: verdict.trace.hitBomb,
        solved: verdict.solved,
      });
      if (verdict.solved) {
        solvedShot = shotLog.length;
        solvedAt = t;
      }
      continue;
    }
    if (verb === "c" && rest === "") {
      placed = [];
      continue;
    }
    if (verb === "p") {
      const kind = CODE_KIND[rest.slice(-1)];
      const cell = cellOf(rest.slice(0, -1));
      if (!kind || cell === null) {
        refuse("unreadable action");
        continue;
      }
      if (fixed.has(cell) || placed.some((piece) => piece.cell === cell)) {
        refuse("piece on a taken cell");
        continue;
      }
      if (
        placed.filter((piece) => isSplitter(piece.kind) === isSplitter(kind)).length >=
        trayFor(kind)
      ) {
        refuse("piece beyond the tray");
        continue;
      }
      placed = [...placed, { cell, kind }];
      continue;
    }
    if (verb === "r" || verb === "x") {
      const cell = cellOf(rest);
      if (cell === null) {
        refuse("unreadable action");
        continue;
      }
      if (!placed.some((piece) => piece.cell === cell)) {
        refuse("no piece on that cell");
        continue;
      }
      placed =
        verb === "r"
          ? placed.map((piece) =>
              piece.cell === cell ? { cell, kind: flipMirror(piece.kind) } : piece,
            )
          : placed.filter((piece) => piece.cell !== cell);
      continue;
    }
    if (verb === "m") {
      const [fromRaw = "", toRaw = "", extra] = rest.split("-");
      const from = cellOf(fromRaw);
      const to = cellOf(toRaw);
      if (from === null || to === null || extra !== undefined || from === to) {
        refuse("unreadable action");
        continue;
      }
      const piece = placed.find((p) => p.cell === from);
      if (!piece) {
        refuse("no piece on that cell");
        continue;
      }
      if (fixed.has(to) || placed.some((p) => p.cell === to)) {
        refuse("piece on a taken cell");
        continue;
      }
      // The phone moves a piece to the end of its list, as here.
      placed = [...placed.filter((p) => p.cell !== from), { cell: to, kind: piece.kind }];
      continue;
    }
    refuse("unreadable action");
  }

  const final = verifyLaser(puzzle, placed);
  return {
    solved: solvedShot !== null,
    shots: shotLog.length,
    solvedShot,
    solvedAt,
    layout: placed,
    gemsLit: solvedShot !== null ? puzzle.gems.length : final.gemsLit,
    hitBomb: solvedShot !== null ? false : final.trace.hitBomb,
    shotLog,
    diag,
  };
}

/** Decodes and replays a Lightbender log; `latestMs` as decodeActionLog. */
export function replayLaserLog(
  puzzle: LaserBoard,
  answer: string,
  latestMs: number,
): LaserLogReplay {
  const { actions, diag } = decodeActionLog(answer, latestMs);
  return replayLaserActions(puzzle, actions, diag);
}
