import type { PuzzleType } from "./types";

/**
 * A near miss's line and its gap: `left` of `total` to go (`total` null where the stored facts
 * don't say), `measure` when the gap is a distance, time or points rather than a count of things.
 */
export interface NearMissInfo {
  line: string;
  left: number;
  total: number | null;
  measure: boolean;
}

/** Display only: no replay, grading, defaults for missing facts, or stored writes. */
export function nearMiss(
  type: PuzzleType,
  extra: Record<string, unknown> | null | undefined,
): string | null {
  return nearMissInfo(type, extra)?.line ?? null;
}

/**
 * Whether a near miss is genuinely close (18 Oct 2026, the So Close award; podiumAwards.ts): one
 * thing left to do, or (with a known total) at most CLOSE_SHARE of it left; a distance, time or
 * points gap needs at most CLOSE_MEASURE_SHARE of the way left. Results lines are unchanged.
 */
export const CLOSE_SHARE = 0.2;
export const CLOSE_MEASURE_SHARE = 0.1;
export function isGenuinelyClose(info: NearMissInfo | null): boolean {
  if (!info || !(info.left > 0)) return false;
  if (info.measure) return info.total !== null && info.total > 0 && info.left / info.total <= CLOSE_MEASURE_SHARE;
  if (info.left <= 1) return true;
  return info.total !== null && info.total > 0 && info.left / info.total <= CLOSE_SHARE;
}

export function nearMissInfo(
  type: PuzzleType,
  extra: Record<string, unknown> | null | undefined,
): NearMissInfo | null {
  if (!extra) return null;
  const number = (key: string) =>
    typeof extra[key] === "number" && Number.isFinite(extra[key]) ? (extra[key] as number) : null;
  const remaining = (key: string, total: number | null, noun: string) => {
    const count = number(key);
    if (count === null || total === null || total <= 0 || count < 0 || count >= total) return null;
    const left = Math.ceil(total - count);
    return info(`${left} ${noun}${left === 1 ? "" : "s"} from the end`, left, total);
  };
  const info = (line: string, left: number, total: number | null, measure = false): NearMissInfo => ({ line, left, total, measure });
  switch (type) {
    case "hover":
      return remaining("gates", number("totalGates"), "barrier");
    case "orbit":
      return extra["finished"] === true ? null : remaining("passed", 40, "planet");
    case "swing": {
      const metres = number("metres");
      return metres !== null && metres >= 0 && metres < 500
        ? info(`${Math.ceil(500 - metres)} m short of the finish`, 500 - metres, 500, true)
        : null;
    }
    case "inkbridge": {
      const levels = number("levels"),
        total = number("total");
      return levels !== null && total !== null && total > 0 && levels >= 0 && levels < total
        ? info(`Reached level ${levels + 1} of ${total}`, total - levels, total)
        : null;
    }
    case "snip": {
      const eaten = number("eaten"),
        level = number("levels");
      if (eaten === null || eaten < 0 || eaten >= 10 || level === null || level < 0) return null;
      return level < 10 ? info(`Level ${level + 1} of 10`, 10 - level, 10) : info(`${eaten} of 10 apples collected`, 10 - eaten, 10);
    }
    case "bintoss":
      return remaining("baskets", 10, "basket");
    case "tilt":
      return remaining("mazes", 4, "maze");
    case "balltrack":
      return remaining("home", 30, "marble");
    case "wordfall": {
      const points = number("points"),
        par = number("par");
      if (points === null || par === null || par <= 0 || points < 0 || points >= par) return null;
      const left = par - points;
      return info(`${left} word point${left === 1 ? "" : "s"} short of 150`, left, par, true);
    }
    case "tendrop":
      return remaining("cleared", 10, "target");
    case "wavefront":
      // wavRev 2: all five waves cleared leaves the boss.
      if (extra["wavRev"] !== undefined && number("wavesCleared") === 5) return extra["bossKilled"] ? null : remaining("bossHits", 36, "boss hit");
      return remaining("wavesCleared", 5, "wave");
    case "flip": {
      const seconds = number("survivedSeconds");
      return extra["survived"] !== true && seconds !== null && seconds >= 0 && seconds < 60
        ? info(`${(60 - seconds).toFixed(1)} s short of the finish`, 60 - seconds, 60, true)
        : null;
    }
    case "clayshoot":
      // clayRev 4's empty shots and their cost show only in their own reveal rows (storedCostRows).
      return remaining("hits", number("total"), "clay");
    case "bullseye":
      return extra["finished"] === true ? null : remaining("arrows", 10, "dart");
    case "breaker": {
      const left = number("bricksLeft");
      return extra["cleared"] !== true && left !== null && left > 0
        ? info(`${left} brick${left === 1 ? "" : "s"} left to clear`, left, null)
        : null;
    }
    case "measure":
      return remaining("solved", 4, "puzzle");
    case "checkout": {
      const solved = number("solved");
      return solved !== null && solved >= 0 && solved < 5
        ? info(`${5 - solved} board${5 - solved === 1 ? "" : "s"} short of all five`, 5 - solved, 5)
        : null;
    }
    case "numline":
      return remaining("placed", 15, "number");
    case "bubble": {
      const left = number("bubblesLeft");
      return extra["cleared"] !== true && left !== null && left > 0
        ? info(`${left} bubble${left === 1 ? "" : "s"} left to clear`, left, null)
        : null;
    }
    case "strikeout":
      return extra["done"] === true ? null : remaining("solvedRows", 5, "word");
    case "codeword":
      return extra["solved"] === true ? null : remaining("correct", number("hidden"), "letter");
    case "swapword": {
      const left = number("tilesLeft");
      return extra["solved"] !== true && left !== null && left > 0
        ? info(`${left} tile${left === 1 ? "" : "s"} from solved`, left, null)
        : null;
    }
    default:
      return null;
  }
}
