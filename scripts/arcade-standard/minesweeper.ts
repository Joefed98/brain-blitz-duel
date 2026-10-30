/**
 * Minesweeper on the arcade scoring standard (minesRev 1, Cards & Board, 30 Oct 2026; docs/arcade-standard/minesweeper.md):
 * Safe squares 150 (a straight line on the safe squares revealed beyond the opening), No mines hit 20 (the same line,
 * only while no mine has been hit), Speed 30 (cleared only: full by 50 s, 0 at the buzzer); −5 a mine hit. Total 200.
 *
 * perfect(): the oracle (the deal's own logic-solver order, scripts/cards-board-oracles.ts) on room seeds 0–39, each
 * replayed through the server's replayMinesweeperRun and split into parts by minesStdParts (what the reveal reads).
 */
import { minesParts, minesStdParts, minesweeperGame, MINES_CLEAN_MAX, MINES_HIT_COST, MINES_INPUT_TAP, MINES_MODE_FLAG, MINES_REV_STD, MINES_SAFE, MINES_SPEED_FULL_TICKS, MINES_SPEED_MAX, MINES_STD_SPEC, MINES_HIDDEN, type MinesState } from "../../src/lib/arcade/minesweeper";
import { LIVE_BANDS } from "../../src/lib/arcade/liveBands";
import { replayMinesweeperRun } from "../../src/lib/duel/minesweeper";
import { PUZZLE_INSTRUCTIONS } from "../../src/lib/duel/instructions";
import { roomSeed } from "../arcade-skill-bands/games";
import { encodeOracle, minesOracle } from "../cards-board-oracles";
import type { StdEntry, StdRun } from "./entry";

const record = (s: MinesState) => Object.fromEntries((minesStdParts(s) ?? []).map((p) => [p.key, p.points]));
const maxes = (s: MinesState) => Object.fromEntries((minesStdParts(s) ?? []).map((p) => [p.key, p.max]));
const SEED = roomSeed(3);
const base = minesweeperGame.init(SEED);
const firstHidden = base.open.findIndex((v) => v === MINES_HIDDEN);

export const entry: StdEntry = {
  type: "minesweeper",
  field: "minesRev",
  rev: MINES_REV_STD,
  parts: MINES_STD_SPEC.parts,
  spec: MINES_STD_SPEC,
  liveSpec: true,
  perfect(): StdRun[] {
    return Array.from({ length: 40 }, (_, n) => {
      const seed = roomSeed(n);
      const r = replayMinesweeperRun(seed, encodeOracle(seed, minesOracle(seed), "minesweeper"), MINES_REV_STD);
      return { label: `the logic oracle on room seed ${n}, replayed`, score: r.score, parts: record(r.state), partMaxes: maxes(r.state) };
    });
  },
  played(): StdRun[] {
    const flag = replayMinesweeperRun(SEED, encodeOracle(SEED, [{ t: 30, k: MINES_INPUT_TAP, a: firstHidden, b: MINES_MODE_FLAG, c: 0, d: 0 }], "minesweeper"), MINES_REV_STD);
    return [{ label: "one flag placed and nothing revealed", score: flag.score, want: 1 }];
  },
  idle(): StdRun[] {
    return [{ label: "no input for the whole 90 s (room seed 3)", score: replayMinesweeperRun(SEED, encodeOracle(SEED, [], "minesweeper"), MINES_REV_STD).score }];
  },
  // The core's straight line on the squares revealed beyond the opening (room seed 3's opening): a state with one mine
  // hit, so No mines hit pays nothing, and no clear tick, so Speed pays nothing.
  core: {
    fullAt: MINES_SAFE - base.opening,
    at: (v: number): MinesState => ({ ...base, acted: 1, hits: 1, revealed: base.opening + v }),
    parts: minesStdParts,
  },
  extra(ok) {
    // No mines hit is the core's line scaled to 20, only with no hit; a hit costs 5 off the total.
    const of = MINES_SAFE - base.opening;
    for (const v of [0, 1, Math.floor(of / 2), of - 1, of]) {
      const clean = minesParts({ ...base, acted: 1, revealed: base.opening + v });
      ok(clean.clean === Math.floor((MINES_CLEAN_MAX * v) / of), `minesweeper: no mines hit at ${v} of ${of} pays ${Math.floor((MINES_CLEAN_MAX * v) / of)} (${clean.clean})`);
      const hit = minesParts({ ...base, acted: 1, revealed: base.opening + v, hits: 2 });
      ok(hit.clean === 0 && hit.penalty === 2 * MINES_HIT_COST && hit.total === hit.core - 2 * MINES_HIT_COST, `minesweeper: two mines hit cost ${2 * MINES_HIT_COST} and the clean part (${v})`);
    }
    // Speed only on a cleared board: full by the full-by time, 0 at the buzzer, a straight line between.
    const cleared = (tick: number) => minesParts({ ...base, acted: 1, revealed: MINES_SAFE, clearedTick: tick }).speed;
    ok(cleared(MINES_SPEED_FULL_TICKS) === MINES_SPEED_MAX && cleared(60) === MINES_SPEED_MAX && cleared(minesweeperGame.runTicks) === 0, "minesweeper: speed full by 50 s, 0 at the buzzer");
    ok(minesParts({ ...base, acted: 1, revealed: MINES_SAFE - 1, clearedTick: 0 }).speed === 0, "minesweeper: no speed without a clear");
    // The help names every part, its maximum and "Together 200 points."
    const help = PUZZLE_INSTRUCTIONS.minesweeper.score;
    ok(help.includes("Together 200 points.") && MINES_STD_SPEC.parts.every((p) => help.includes(p.label) && help.includes(String(p.max))) && help.includes("50 s"), `minesweeper: the help states every part and "Together 200 points.": ${help}`);
    ok((LIVE_BANDS.minesweeper as { std?: unknown }).std === MINES_STD_SPEC, "minesweeper: LIVE_BANDS carries the spec");
  },
};
