/**
 * Moment cards for rounds that don't replay well (display only), built from
 * the round winner's STORED answer and stored extra — never recomputed into a
 * score: Flash (fastest reaction), Bang On (closest stop), Nucleus and Forage
 * (best word). Weights come from the one moment table (moments.ts).
 */
import {
  REACTION_MISS_MS,
  STOPWATCH_MISS_MS,
  wordHuntPoints,
  wordsmithPoints,
  type PuzzleData,
} from "@/lib/duel/types";
import { momentWeight } from "./pick";

export const CARD_TYPES = ["reaction", "stopwatch", "wordsmith", "wordhunt"] as const;

export interface MomentCard {
  game: string;
  id: string;
  weight: number;
  /** Small heading, e.g. "Fastest reaction". */
  title: string;
  /** The big figure, e.g. "187 ms" or "PLANTED". */
  value: string;
  /** One line under it. */
  detail: string;
}

const nums = (value: unknown): number[] =>
  Array.isArray(value)
    ? value.filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    : [];
const strs = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];

function bestWord(
  words: string[],
  points: (word: string) => number,
): { word: string; points: number } | null {
  let best: { word: string; points: number } | null = null;
  for (const word of words) {
    const p = points(word);
    // Highest points, then the longer word, then alphabetical: the same pick on every phone.
    if (
      !best ||
      p > best.points ||
      (p === best.points &&
        (word.length > best.word.length || (word.length === best.word.length && word < best.word)))
    )
      best = { word, points: p };
  }
  return best;
}

export function momentCard(
  puzzle: PuzzleData,
  answer: string | null,
  extra: Record<string, unknown> | null,
): MomentCard | null {
  switch (puzzle.type) {
    case "reaction": {
      // tapRev 1 rounds store per-flash times in extra; older rounds store "ms,ms,ms|falseStarts".
      let times = nums(extra?.["times"]);
      if (times.length === 0 && answer && !answer.startsWith("log"))
        times = (answer.split("|")[0] ?? "")
          .split(",")
          .map(Number)
          .filter((v) => Number.isFinite(v) && v > 0);
      const hits = times.filter((t) => t > 0 && t < REACTION_MISS_MS);
      if (hits.length === 0) return null;
      const fastest = Math.min(...hits);
      const id = fastest < 200 ? "lightning" : "fastest";
      return {
        game: "reaction",
        id,
        weight: momentWeight("reaction", id),
        title: "Fastest reaction",
        value: `${Math.round(fastest)} ms`,
        detail: `Flash ${times.indexOf(fastest) + 1} of ${times.length}`,
      };
    }
    case "stopwatch": {
      let distances = nums(extra?.["distances"]);
      if (distances.length === 0 && answer && !answer.startsWith("log"))
        distances = answer
          .split(",")
          .map(Number)
          .filter((v) => Number.isFinite(v) && v >= 0);
      const settled = distances.filter((d) => d < STOPWATCH_MISS_MS);
      if (settled.length === 0) return null;
      const closest = Math.min(...settled);
      const index = distances.indexOf(closest);
      const signed = Array.isArray(extra?.["signed"])
        ? (extra!["signed"] as (number | null)[])[index]
        : null;
      const side =
        closest === 0
          ? "dead on"
          : typeof signed === "number"
            ? signed < 0
              ? "early"
              : "late"
            : "off";
      const id = closest <= 10 ? "dead-on" : "closest";
      return {
        game: "stopwatch",
        id,
        weight: momentWeight("stopwatch", id),
        title: "Closest stop",
        value: `${Math.round(closest)} ms`,
        detail: `Watch ${index + 1}, ${side}`,
      };
    }
    case "wordsmith": {
      const words = strs(extra?.["words"]).length
        ? strs(extra?.["words"])
        : (answer ?? "").split(",").filter(Boolean);
      const best = bestWord(words, wordsmithPoints);
      if (!best) return null;
      const letters = (puzzle as unknown as { letters?: string[] }).letters ?? [];
      const pangram = letters.length > 0 && best.word.length >= letters.length;
      const id = pangram ? "pangram" : "best-word";
      return {
        game: "wordsmith",
        id,
        weight: momentWeight("wordsmith", id),
        title: pangram ? "Pangram" : "Best word",
        value: best.word.toUpperCase(),
        detail: `${best.points} points, ${words.length} words`,
      };
    }
    case "wordhunt": {
      const words = strs(extra?.["words"]).length
        ? strs(extra?.["words"])
        : (answer ?? "").split(",").filter(Boolean);
      const best = bestWord(words, wordHuntPoints);
      if (!best) return null;
      const id = best.word.length >= 7 ? "long-word" : "best-word";
      return {
        game: "wordhunt",
        id,
        weight: momentWeight("wordhunt", id),
        title: "Best word",
        value: best.word.toUpperCase(),
        detail: `${best.points} points, ${words.length} words`,
      };
    }
    default:
      return null;
  }
}
