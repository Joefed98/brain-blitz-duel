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
    case "tendrop":
      return remaining("cleared", 10, "target");
    case "wavefront":
      return remaining("wavesCleared", 5, "wave");
    case "flip": {
      const seconds = number("survivedSeconds");
      return extra["survived"] !== true && seconds !== null && seconds >= 0 && seconds < 60
        ? `${(60 - seconds).toFixed(1)} s short of the finish`
        : null;
    }
    case "clayshoot":
      return remaining("hits", number("total"), "clay");
    case "bullseye":
      return extra["finished"] === true ? null : remaining("arrows", 10, "dart");
    case "breaker": {
      const left = number("bricksLeft");
      return extra["cleared"] !== true && left !== null && left > 0
        ? `${left} brick${left === 1 ? "" : "s"} left to clear`
        : null;
    }
    case "bubble": {
      const left = number("bubblesLeft");
      return extra["cleared"] !== true && left !== null && left > 0
        ? `${left} bubble${left === 1 ? "" : "s"} left to clear`
        : null;
    }
    default:
      return null;
  }
}
