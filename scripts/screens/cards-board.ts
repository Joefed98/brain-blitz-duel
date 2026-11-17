/**
 * The Cards & Board overhaul's screens (phase 2 step 4, 15 Nov 2026; docs/design/pages-review/cards-board/GALLERY.md)
 * for theme-check and no-wrap-check: each game's answer reveal in a room, mid-run, with its reveal picture (the final
 * table large, three key numbers and the run summary) at every size. Runs come from the flawless lines in
 * scripts/cards/flawless.ts, cut part-way (a cleared table is mostly empty felt), and an untouched Mahjong stack.
 */
import { decodeFreecellRun, decodeFiveHandsRun, decodePyramidRun, decodeTripeaksRun, encodeFreecellRun, encodeFiveHandsRun, encodePyramidRun, encodeTripeaksRun } from "../../src/lib/duel/cards";
import type { PuzzleData } from "../../src/lib/duel/types";
import { freecellFlawless, fiveHandsFlawless, pyramidFlawless, tripeaksFlawless } from "../cards/flawless";
import { ALL_SIZES, room, type ThemeScreen } from "../theme-screens";

/** The run's first `keep` share of inputs (the rest of the round idle), re-encoded without checkpoints. */
function cut<R extends { events: { t: number }[]; checkpoints?: unknown[]; endTick?: number }>(raw: string, decode: (r: string) => R, encode: (r: R) => string, keep: number): string {
  const run = decode(raw);
  const events = run.events.slice(0, Math.max(1, Math.floor(run.events.length * keep)));
  return encode({ ...run, events, checkpoints: [], endTick: 0 });
}

export default function cardsBoardScreens(): ThemeScreen[] {
  const screens: [string, PuzzleData, string][] = [
    ["freecell", { type: "freecell", seed: 3, freecellRev: 5 } as PuzzleData, cut(freecellFlawless(3, 20, 5).raw, decodeFreecellRun as never, encodeFreecellRun as never, 0.4)],
    ["tripeaks", { type: "tripeaks", seed: 3, tripeaksRev: 3 } as PuzzleData, cut(tripeaksFlawless(3, 15, 3).raw, decodeTripeaksRun as never, encodeTripeaksRun as never, 0.5)],
    ["pyramid", { type: "pyramid", seed: 3, pyramidRev: 3 } as PuzzleData, cut(pyramidFlawless(3, 15, 3).raw, decodePyramidRun as never, encodePyramidRun as never, 0.5)],
    ["fivehands", { type: "fivehands", seed: 4, fiveHandsRev: 3 } as PuzzleData, fiveHandsFlawless(4, 20, 3).raw],
    ["mahjong", { type: "mahjong", seed: 3, mahjongRev: 2 } as PuzzleData, "3|0||600|"],
  ];
  return screens.map(([type, puzzle, answer]) => ({
    name: `answer reveal (${type}, the overhaul's picture)`,
    mode: "room",
    plain: true,
    room: room("in_progress", "reveal", { arcade: true, arcadeType: type, arcadePuzzle: puzzle, players: 4, answer }),
    sizes: ALL_SIZES,
  }));
}
