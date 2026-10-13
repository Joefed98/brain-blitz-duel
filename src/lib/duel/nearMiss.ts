import type { PuzzleType } from "./types";

/** Display only: no replay, grading, defaults for missing facts, or stored writes. */
export function nearMiss(
  type: PuzzleType,
  extra: Record<string, unknown> | null | undefined,
): string | null {
  if (!extra) return null;
  const number = (key: string) =>
    typeof extra[key] === "number" && Number.isFinite(extra[key]) ? (extra[key] as number) : null;
  const remaining = (key: string, total: number | null, noun: string) => {
    const count = number(key);
    if (count === null || total === null || total <= 0 || count < 0 || count >= total) return null;
    const left = Math.ceil(total - count);
    return `${left} ${noun}${left === 1 ? "" : "s"} from the end`;
  };
  switch (type) {
    case "hover":
      return remaining("gates", number("totalGates"), "barrier");
    case "orbit":
      return extra["finished"] === true ? null : remaining("passed", 40, "planet");
    case "swing": {
      const metres = number("metres");
      return metres !== null && metres >= 0 && metres < 500
        ? `${Math.ceil(500 - metres)} m short of the finish`
        : null;
    }
    case "inkbridge": {
      const levels = number("levels"),
        total = number("total");
      return levels !== null && total !== null && total > 0 && levels >= 0 && levels < total
        ? `Reached round ${levels + 1} of ${total}`
        : null;
    }
    case "snip": {
      const eaten = number("eaten"),
        level = number("levels");
      if (eaten === null || eaten < 0 || eaten >= 10 || level === null || level < 0) return null;
      return level < 10 ? `Level ${level + 1} of 10` : `${eaten} of 10 apples collected`;
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
      return `${left} word point${left === 1 ? "" : "s"} short of 150`;
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
        ? `${(60 - seconds).toFixed(1)} s short of the finish`
        : null;
    }
    case "clayshoot": {
      const clays = remaining("hits", number("total"), "clay");
      // clayRev 4: the stored empty-shot cost.
      const cost = number("emptyShotCost"),
        empty = number("emptyShots");
      const wasted = cost !== null && cost > 0 && empty !== null ? `${empty} shots hit nothing: −${cost}` : null;
      return clays && wasted ? `${clays} · ${wasted}` : (clays ?? wasted);
    }
    case "bullseye":
      return extra["finished"] === true ? null : remaining("arrows", 10, "dart");
    case "breaker": {
      const left = number("bricksLeft");
      return extra["cleared"] !== true && left !== null && left > 0
        ? `${left} brick${left === 1 ? "" : "s"} left to clear`
        : null;
    }
    case "measure":
      return remaining("solved", 4, "puzzle");
    case "checkout": {
      const solved = number("solved");
      return solved !== null && solved >= 0 && solved < 5
        ? `${5 - solved} board${5 - solved === 1 ? "" : "s"} short of all five`
        : null;
    }
    case "numline":
      return remaining("placed", 15, "number");
    case "bubble": {
      const left = number("bubblesLeft");
      return extra["cleared"] !== true && left !== null && left > 0
        ? `${left} bubble${left === 1 ? "" : "s"} left to clear`
        : null;
    }
    case "strikeout":
      return extra["done"] === true ? null : remaining("solvedRows", 5, "word");
    case "codeword":
      return extra["solved"] === true ? null : remaining("correct", number("hidden"), "letter");
    case "swapword": {
      const left = number("tilesLeft");
      return extra["solved"] !== true && left !== null && left > 0
        ? `${left} tile${left === 1 ? "" : "s"} from solved`
        : null;
    }
    default:
      return null;
  }
}
