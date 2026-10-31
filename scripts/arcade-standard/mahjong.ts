/**
 * Mahjong Solitaire on the arcade scoring standard (mahjongRev 1, Cards & Board, 30 Oct 2026;
 * docs/arcade-standard/mahjong.md): Pairs 150 (a straight line on the 36 pairs), No shuffles 20 (the same line, only
 * while no Shuffle has been used), Speed 30 (cleared only: full by 65 s, 0 at the buzzer); −5 a Shuffle. Total 200.
 *
 * mahjongRev 2 (31 Oct 2026): the same deal and parts with Undo and Reset; rooms deal it. Rev 1 runs replay as before
 * (extra() proves the oracle at 200 on rev 1 too).
 *
 * perfect(): the oracle (the deal's own backwards-build order, scripts/cards-board-oracles.ts) on room seeds 0–39,
 * each replayed through the server's replayMahjongRun and split into parts by mahjongStdParts (what the reveal reads).
 */
import { mahjongGame, mahjongGameFor, mahjongParts, mahjongStdParts, MAHJONG_CLEAN_MAX, MAHJONG_INPUT_SHUFFLE, MAHJONG_PAIRS, MAHJONG_REV_DEALT, MAHJONG_REV_STD, MAHJONG_SHUFFLE_COST, MAHJONG_SPEED_FULL_TICKS, MAHJONG_SPEED_MAX, MAHJONG_STD_SPEC, type MahjongState } from "../../src/lib/arcade/mahjong";
import { LIVE_BANDS } from "../../src/lib/arcade/liveBands";
import { replayMahjongRun } from "../../src/lib/duel/mahjong";
import { PUZZLE_INSTRUCTIONS } from "../../src/lib/duel/instructions";
import { roomSeed } from "../arcade-skill-bands/games";
import { encodeOracle, mahjongOracle } from "../cards-board-oracles";
import type { StdEntry, StdRun } from "./entry";

const record = (s: MahjongState) => Object.fromEntries((mahjongStdParts(s) ?? []).map((p) => [p.key, p.points]));
const maxes = (s: MahjongState) => Object.fromEntries((mahjongStdParts(s) ?? []).map((p) => [p.key, p.max]));
const SEED = roomSeed(3);
const base = mahjongGameFor(MAHJONG_REV_DEALT).init(SEED);

export const entry: StdEntry = {
  type: "mahjong",
  field: "mahjongRev",
  rev: MAHJONG_REV_DEALT,
  parts: MAHJONG_STD_SPEC.parts,
  spec: MAHJONG_STD_SPEC,
  liveSpec: true,
  perfect(): StdRun[] {
    return Array.from({ length: 40 }, (_, n) => {
      const seed = roomSeed(n);
      const r = replayMahjongRun(seed, encodeOracle(seed, mahjongOracle(seed), "mahjong", MAHJONG_REV_DEALT), MAHJONG_REV_DEALT);
      return { label: `the build-order oracle on room seed ${n}, replayed`, score: r.score, parts: record(r.state), partMaxes: maxes(r.state) };
    });
  },
  played(): StdRun[] {
    // One tap on a free tile (a selection) and nothing taken away.
    const tap = replayMahjongRun(SEED, encodeOracle(SEED, [{ ...mahjongOracle(SEED, 30)[0]! }], "mahjong", MAHJONG_REV_DEALT), MAHJONG_REV_DEALT);
    // A Shuffle and nothing else: −5 from nothing, still 1 for playing.
    const shuffle = replayMahjongRun(SEED, encodeOracle(SEED, [{ t: 20, k: MAHJONG_INPUT_SHUFFLE, a: 0, b: 0, c: 0, d: 0 }], "mahjong", MAHJONG_REV_DEALT), MAHJONG_REV_DEALT);
    return [
      { label: "one tile selected and nothing taken away", score: tap.score, want: 1 },
      { label: "one Shuffle and nothing taken away", score: shuffle.score, want: 1 },
    ];
  },
  idle(): StdRun[] {
    return [{ label: "no input for the whole 2 minutes (room seed 3)", score: replayMahjongRun(SEED, encodeOracle(SEED, [], "mahjong", MAHJONG_REV_DEALT), MAHJONG_REV_DEALT).score }];
  },
  // The core's straight line on pairs: a state with one Shuffle, so No shuffles pays nothing, and no clear tick.
  core: {
    fullAt: MAHJONG_PAIRS,
    at: (v: number): MahjongState => ({ ...base, acted: 1, shuffles: 1, pairs: v }),
    parts: mahjongStdParts,
  },
  extra(ok) {
    for (const v of [0, 1, 18, 35, 36]) {
      const clean = mahjongParts({ ...base, acted: 1, pairs: v });
      ok(clean.clean === Math.floor((MAHJONG_CLEAN_MAX * v) / MAHJONG_PAIRS), `mahjong: no shuffles at ${v} pairs pays ${Math.floor((MAHJONG_CLEAN_MAX * v) / MAHJONG_PAIRS)} (${clean.clean})`);
      const shuffled = mahjongParts({ ...base, acted: 1, pairs: v, shuffles: 3 });
      ok(shuffled.clean === 0 && shuffled.penalty === 3 * MAHJONG_SHUFFLE_COST && shuffled.total === shuffled.core - 3 * MAHJONG_SHUFFLE_COST, `mahjong: three Shuffles cost ${3 * MAHJONG_SHUFFLE_COST} and the no-shuffle part (${v})`);
    }
    const cleared = (tick: number) => mahjongParts({ ...base, acted: 1, pairs: MAHJONG_PAIRS, clearedTick: tick }).speed;
    ok(cleared(MAHJONG_SPEED_FULL_TICKS) === MAHJONG_SPEED_MAX && cleared(60) === MAHJONG_SPEED_MAX && cleared(mahjongGame.runTicks) === 0, "mahjong: speed full by 65 s, 0 at the buzzer");
    ok(mahjongParts({ ...base, acted: 1, pairs: MAHJONG_PAIRS - 1 }).speed === 0, "mahjong: no speed without a clear");
    for (let n = 0; n < 10; n++) {
      const seed = roomSeed(n);
      const r1 = replayMahjongRun(seed, encodeOracle(seed, mahjongOracle(seed), "mahjong", MAHJONG_REV_STD), MAHJONG_REV_STD);
      ok(r1.score === 200 && mahjongStdParts(r1.state)?.length === 3, `mahjong: rev 1's oracle still scores 200 in parts on room seed ${n} (${r1.score})`);
    }
    ok(mahjongGame.init(SEED).face.join() === base.face.join(), "mahjong: rev 2 deals rev 1's stack");
    const help = PUZZLE_INSTRUCTIONS.mahjong.score;
    ok(help.includes("Together 200 points.") && MAHJONG_STD_SPEC.parts.every((p) => help.includes(p.label) && help.includes(String(p.max))) && help.includes("65 s"), `mahjong: the help states every part and "Together 200 points.": ${help}`);
    ok((LIVE_BANDS.mahjong as { std?: unknown }).std === MAHJONG_STD_SPEC, "mahjong: LIVE_BANDS carries the spec");
  },
};
