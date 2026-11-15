/**
 * The Number overhaul's screen fixtures (15 Nov 2026): each Number game's dealt puzzle (seeded, so every run draws the
 * same board) and a played answer for its reveal. Helpers only (scripts/area-screens.ts skips `-fixture.ts` files);
 * scripts/screens/number.ts draws them.
 */
import { generatePuzzle } from "../../src/lib/duel/generate.server";
import { withSeededRandom } from "../../src/lib/duel/random";
import { splitPuzzle } from "../../src/lib/duel/secrets";
import type { PuzzleData, PuzzleType } from "../../src/lib/duel/types";
import { decodeMeasureActions, encodeMeasureRound } from "../../src/lib/duel/measure";
import { encodeNumline } from "../../src/lib/duel/numline";
import { encodeBalance } from "../../src/lib/duel/balance";
import { joinCountSuffix } from "../../src/lib/duel/moveLimits";
import { encodeSteps } from "../../src/lib/duel/target";
import { gapSlots, joinGapSegment, splitGapSegment } from "../../src/lib/duel/operatorGaps";
import { joinStages } from "../../src/lib/duel/stagedRounds";
import { npEncodeRound, type NpPlacements } from "../../src/lib/duel/numberPyramid";

export const NUMBER_GAMES = ["balance", "target", "equation", "numpyramid", "measure", "checkout", "numline", "kakuro"] as const satisfies readonly PuzzleType[];
export type NumberGame = (typeof NUMBER_GAMES)[number];

/**
 * A part-played answer per game, built from the full deal (its private half included); "" is a timed-out round. Each
 * game's entry is the answer its stage would send part-way through.
 */
export const NUMBER_REVEAL_ANSWERS: Partial<Record<NumberGame, (full: PuzzleData) => string>> = {};

// Counterweight: scales 1 and 2 balanced (every weight hung once), scale 3 with one weight hung, scale 4 untouched.
NUMBER_REVEAL_ANSWERS.balance = (full) => {
  if (full.type !== "balance") return "";
  const sol = full.solutions ?? [];
  const placements = full.scales.map((scale, i) =>
    i < 2 ? (sol[i] ?? scale.tray.map(() => null)) : i === 2 ? scale.tray.map((_, t) => (t === 0 ? (sol[i]?.[0] ?? null) : null)) : scale.tray.map(() => null),
  );
  return joinCountSuffix(encodeBalance(placements), full.scales.map((s, i) => (i < 2 ? s.tray.length : i === 2 ? 1 : 0)));
};
// Exact: the first two steps of the stored way (the target not reached).
NUMBER_REVEAL_ANSWERS.target = (full) => (full.type === "target" ? encodeSteps((full.solution ?? []).slice(0, 2)) : "");

// Operator: equations 1 and 3 right, equation 2 a wrong full fill (three tries), equation 4 skipped.
NUMBER_REVEAL_ANSWERS.equation = (full) => {
  if (full.type !== "equation") return "";
  const right = full.stages.map((_, i) => full.gapAnswers?.[i] ?? "");
  const n = full.stages[1] ? gapSlots(full.stages[1]).length : 0;
  const two = splitGapSegment(right[1], n);
  const wrong = joinGapSegment([...two].reverse());
  return joinCountSuffix(joinStages([right[0] ?? "", wrong, right[2] ?? "", ""], full.stages.length), [1, 3, 1, 0]);
};
// Integer Pyramid: pyramid 1 complete, pyramid 2 with half its stones set (its first two swapped, so two are wrong),
// 3 and 4 untouched.
NUMBER_REVEAL_ANSWERS.numpyramid = (full) => {
  if (full.type !== "numpyramid") return "";
  const placed = (b: number, share: number): NpPlacements => {
    const board = full.pyramids[b]!;
    const solution = full.solutions?.[b] ?? [];
    const used = new Set<number>();
    const out: NpPlacements = {};
    const empties = board.givens.map((g, cell) => (g == null ? cell : -1)).filter((c) => c >= 0);
    empties.slice(0, Math.ceil(empties.length * share)).forEach((cell) => {
      const t = board.tray.findIndex((v, i) => !used.has(i) && v === solution[cell]);
      if (t >= 0) {
        used.add(t);
        out[cell] = t;
      }
    });
    return out;
  };
  const second = placed(1, 0.5);
  const cells = Object.keys(second).map(Number);
  const [a, b] = cells;
  const tray = full.pyramids[1]!.tray;
  if (a !== undefined && b !== undefined && tray[second[a]!] !== tray[second[b]!]) [second[a], second[b]] = [second[b]!, second[a]!];
  return npEncodeRound(1, [placed(0, 1), second, {}, {}]);
};

// Brimful: puzzle 1 solved on its best line, puzzle 2 part-played (one fill), the rest untouched.
NUMBER_REVEAL_ANSWERS.measure = (full) => {
  if (full.type !== "measure") return "";
  const first = decodeMeasureActions(full.solutions?.[0] ?? "", full.boards[0]!.caps.length);
  return encodeMeasureRound([first, [{ kind: "fill", jug: 0 }], [], []]);
};
// Ballpark: seven numbers placed, the first line and two of the second (near the middle of the line).
NUMBER_REVEAL_ANSWERS.numline = () => encodeNumline([4100, 2600, 7400, 1300, 8800, 5200, 3300]);

// Checkout: boards 1 and 2 checked out on their fewest-darts routes, board 3 with one dart of its route (not checked
// out), the rest not reached.
NUMBER_REVEAL_ANSWERS.checkout = (full) => {
  if (full.type !== "checkout") return "";
  const third = full.routes?.[2] ?? "";
  // One dart of board 3's route (darts are "wedge:ring", comma-separated): its first dart only, when it has more.
  const darts = third.split(",");
  return [full.routes?.[0] ?? "", full.routes?.[1] ?? "", darts.length > 1 ? darts[0]! : "", "", ""].join("|");
};
// Kakuro: every other white square of the solution filled, and one square with a digit that is not the solution's.
NUMBER_REVEAL_ANSWERS.kakuro = (full) => {
  if (full.type !== "kakuro") return "";
  const cells = Array.from({ length: full.size * full.size }, () => "0");
  full.white.forEach((c, i) => {
    if (i % 2 === 0) cells[c] = String(full.solution?.[c] ?? 0);
  });
  const odd = full.white[1];
  if (odd !== undefined) cells[odd] = String(((full.solution?.[odd] ?? 1) % 9) + 1);
  return cells.join("");
};

/** The game's live deal at a fixed seed: its public half for the room, and the answer for my stored result. */
export function numberRevealFixture(type: NumberGame, seed = 41): { pub: PuzzleData; answer: string } {
  const full = withSeededRandom(seed, () => generatePuzzle(type));
  const answer = NUMBER_REVEAL_ANSWERS[type]?.(full) ?? "";
  return { pub: splitPuzzle(full).pub as PuzzleData, answer };
}
