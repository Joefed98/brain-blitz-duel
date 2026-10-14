/**
 * Move limits check (13 Oct 2026; src/lib/duel/moveLimits.ts).
 *
 *   1. Legacy identity: every answer in scripts/fixtures/move-limits-legacy.json.gz
 *      (recorded on main before the change by move-limits-legacy-record.ts: the
 *      seven games' room puzzles as main stamped them, with empty drafts, spam,
 *      four solver levels and their unfinished states) grades exactly as main
 *      stored it: score, verdict, counts, errors, stored time and the whole extra.
 *   2. Stamps: every new Colour Flood, Polypotions, Topsy-Turvy, Counterweight,
 *      Operator and Brimful puzzle carries its own revision and a public limit
 *      (rounded to a 5 where the minimum is private), Tally carries countRev 1,
 *      and no other game carries any of these fields.
 *   3. Enforcement on the server: the solution inside the limit solves; the same
 *      solution pushed one move past the limit (wasted moves first) is an
 *      unfinished board scored on the existing unfinished rule; Polypotions'
 *      Undo and Reset never give a pour back; Counterweight and Operator refuse
 *      a scale / equation whose recorded count is over the limit.
 *   4. Generation: Counterweight's two small scales have exactly one balanced
 *      arrangement; Tally's counts stay inside the wider ranges and use them.
 *   5. Random play: over 24 room seeds no spam strategy finishes more than 2
 *      boards, and every spam median is at most 60. Colour Flood (floodRev 1,
 *      unfinished credit falls to 0 at the move limit): every random-colour and
 *      colour-cycling run that does not finish scores exactly 0, while the same
 *      answers on the stored shape (no floodRev) still score what they did.
 *   6. The counter is on the board: each Stage renders `data-move-limit`.
 *
 *   bun scripts/move-limits-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { ACTIVE_PUZZLE_TYPES, puzzleDef, puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { encodeFloodMoves, replayFlood } from "../src/lib/duel/flood";
import { unfinishedCredit, wasteFactor } from "../src/lib/duel/puzzleScoreRev";
import {
  decodeTubeMoves,
  encodeTubeLog,
  encodeTubeMoves,
  type TubeToken,
} from "../src/lib/duel/tubes";
import { decodeGravityTilts, encodeGravityTilts } from "../src/lib/duel/gravity";
import { BAL_REV2, BAL_REV2_TIME_MS, encodeBalance } from "../src/lib/duel/balance";
import { balancedArrangements } from "../src/lib/duel/numberRounds.server";
import {
  decodeMeasureActions,
  encodeMeasureRound,
  measureActions,
  measureApply,
  type MeasureAction,
} from "../src/lib/duel/measure";
import { joinStages } from "../src/lib/duel/stagedRounds";
import {
  COUNTUP_COUNT_REV,
  EQUATION_LIMIT_REV,
  FLOOD_LIMIT_REV,
  GRAVITY_LIMIT_REV,
  MEASURE_LIMIT_REV,
  TUBES_LIMIT_REV,
  joinCountSuffix,
} from "../src/lib/duel/moveLimits";
import { EQUATION_TRIES, FLOOD_SPARE_MOVES } from "../src/lib/duel/moveLimits.server";
import { COUNTUP_STAGE_COUNTS_REV1 } from "../src/puzzles/countUp";
import { stableExtra, type LegacyCase } from "./puzzle-score-legacy-record";
import { KITS } from "./puzzle-fairness/kits";
import { hashText, makeRng } from "./puzzle-fairness/kit";
import { roomPuzzle } from "./puzzle-fairness/run";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";

let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, msg: string) => {
  checks++;
  if (!cond) {
    failures.push(msg);
    if (failures.length <= 40) console.log(`FAIL ${msg}`);
  }
};
type Loose = Record<string, unknown>;

/* ------------------------------ 1. Legacy identity ------------------------------ */
{
  const fixture = JSON.parse(
    gunzipSync(readFileSync("scripts/fixtures/move-limits-legacy.json.gz")).toString("utf8"),
  ) as { recordedOn: string; cases: LegacyCase[] };
  let answers = 0;
  for (const c of fixture.cases) {
    for (const e of c.entries) {
      answers++;
      const g = gradeAnswer(c.puzzle, e.answer, e.ms);
      const got = {
        score: g.score,
        isCorrect: g.isCorrect,
        correctCount: g.correctCount,
        errors: g.errors,
        storedMs: g.storedMs,
        extra: stableExtra(g.extra),
      };
      const bad = (Object.keys(got) as (keyof typeof got)[]).find((key) => got[key] !== e[key]);
      ok(
        !bad,
        `legacy ${c.type} ${c.label} ms ${e.ms}: ${bad} ${JSON.stringify(bad ? got[bad] : "").slice(0, 100)} ≠ main ${JSON.stringify(bad ? e[bad] : "").slice(0, 100)}`,
      );
    }
  }
  console.log(
    `legacy identity: ${answers} answers over ${fixture.cases.length} stored puzzles (recorded on ${fixture.recordedOn})`,
  );
}

/* ---------------------------------- 2. Stamps ---------------------------------- */
const STAMPS: Partial<Record<PuzzleType, { rev: string; value: number; limit?: string }>> = {
  flood: { rev: "floodRev", value: FLOOD_LIMIT_REV, limit: "moveLimit" },
  tubes: { rev: "tubesRev", value: TUBES_LIMIT_REV, limit: "pourLimit" },
  gravity: { rev: "gravityRev", value: GRAVITY_LIMIT_REV, limit: "tiltLimit" },
  // Counterweight's four-scale puzzles (14 Oct 2026) are balanceRev 2, which keeps the rev-1 limits and adds the fourth.
  balance: { rev: "balanceRev", value: BAL_REV2, limit: "placeLimits" },
  equation: { rev: "equationRev", value: EQUATION_LIMIT_REV, limit: "tryLimit" },
  measure: { rev: "measureRev", value: MEASURE_LIMIT_REV, limit: "moveLimits" },
  countup: { rev: "countRev", value: COUNTUP_COUNT_REV },
};
const LIMIT_KEYS = [
  "floodRev",
  "moveLimit",
  "tubesRev",
  "pourLimit",
  "gravityRev",
  "tiltLimit",
  "balanceRev",
  "placeLimits",
  "equationRev",
  "tryLimit",
  "moveLimits",
  "countRev",
];
for (const type of ACTIVE_PUZZLE_TYPES) {
  const made = generatePuzzle(type, { bankSeed: 4242 }) as unknown as Loose;
  const want = STAMPS[type];
  if (!want) {
    const stray = LIMIT_KEYS.filter((k) => k in made);
    ok(stray.length === 0, `${type}: untouched game carries ${stray.join(", ")}`);
    continue;
  }
  ok(
    made[want.rev] === want.value,
    `${type}: ${want.rev} ${String(made[want.rev])}, want ${want.value}`,
  );
  if (want.limit) {
    const { pub } = splitPuzzle(made as unknown as PuzzleData);
    ok(want.limit in (pub as unknown as Loose), `${type}: ${want.limit} does not reach the phone`);
  }
}
for (let i = 0; i < 12; i++) {
  const seed = 7001 + i;
  const flood = roomPuzzle("flood", seed) as Loose & { par: number; moveLimit: number };
  ok(
    flood.moveLimit === flood.par + FLOOD_SPARE_MOVES,
    `flood ${seed}: limit ${flood.moveLimit} for par ${flood.par}`,
  );
  for (const [type, key] of [
    ["tubes", "pourLimit"],
    ["gravity", "tiltLimit"],
  ] as const) {
    const p = roomPuzzle(type, seed) as Loose & { minMoves: number };
    const lim = p[key] as number;
    ok(
      lim % 5 === 0 && lim >= p.minMoves + 5 && lim <= p.minMoves + 10,
      `${type} ${seed}: limit ${lim} for minimum ${p.minMoves}`,
    );
  }
  const m = roomPuzzle("measure", seed) as Loose & { minMoves: number[]; moveLimits: number[] };
  ok(
    m.moveLimits.every(
      (l, b) => l % 5 === 0 && l >= 3 * m.minMoves[b]! && l < 3 * m.minMoves[b]! + 5,
    ),
    `measure ${seed}: limits ${m.moveLimits} for minimums ${m.minMoves}`,
  );
  const e = roomPuzzle("equation", seed) as Loose;
  ok(e["tryLimit"] === EQUATION_TRIES, `equation ${seed}: tryLimit ${String(e["tryLimit"])}`);
}

/* -------------------------------- 3. Enforcement -------------------------------- */
const LIMIT_MS = 30_000;
for (let i = 0; i < 12; i++) {
  const seed = 7101 + i;
  // Colour Flood: the par route solves at the stored limit (par + 2) and at a limit of par, and is cut one
  // tap short (unfinished, on the existing unfinished rule) at a limit of par − 1.
  {
    const p = roomPuzzle("flood", seed) as Extract<PuzzleData, { type: "flood" }>;
    const route = encodeFloodMoves(p.solution ?? []);
    for (const limit of [p.moveLimit!, p.par]) {
      const g = gradeAnswer({ ...p, moveLimit: limit }, route, LIMIT_MS);
      ok(
        g.isCorrect && g.score >= 120,
        `flood ${seed}: the par route does not solve at limit ${limit}`,
      );
    }
    const short = gradeAnswer({ ...p, moveLimit: p.par - 1 }, route, LIMIT_MS);
    const extra = short.extra as Loose;
    const unlimited = gradeAnswer(
      { ...p, floodRev: undefined },
      encodeFloodMoves((p.solution ?? []).slice(0, p.par - 1)),
      0,
    );
    ok(
      !short.isCorrect &&
        extra["outOfMoves"] === true &&
        extra["moves"] === p.par - 1 &&
        short.score === unlimited.score,
      `flood ${seed}: past the limit still counts, or the cut board is not scored as unfinished (${short.score} vs ${unlimited.score})`,
    );
  }
  // Polypotions: wrong pours undone still count; the solution after too many undone pours runs out.
  {
    const p = roomPuzzle("tubes", seed) as Extract<PuzzleData, { type: "tubes" }>;
    const plan = decodeTubeMoves(p.solution ?? "");
    const limit = p.pourLimit!;
    const spare = limit - plan.length;
    const first = plan[0]!;
    const wasted = (n: number): TubeToken[] =>
      Array.from({ length: n }, () => [first, "undo" as const]).flat();
    const solved = gradeAnswer(p, encodeTubeLog([...wasted(spare), ...plan]), LIMIT_MS);
    ok(
      solved.isCorrect,
      `tubes ${seed}: solution with ${spare} undone pours (limit ${limit}) does not solve`,
    );
    const over = gradeAnswer(p, encodeTubeLog([...wasted(spare + 1), ...plan]), LIMIT_MS);
    ok(
      !over.isCorrect && over.score <= 110 && (over.extra as Loose)["outOfPours"] === true,
      `tubes ${seed}: Undo gave a pour back`,
    );
    const reset = gradeAnswer(
      p,
      encodeTubeLog([...plan.slice(0, spare + 1), "reset", ...plan]),
      LIMIT_MS,
    );
    ok(!reset.isCorrect, `tubes ${seed}: Reset gave pours back`);
    // A stored-format answer (pours only) on the limited board is still replayed by the log rules.
    ok(
      gradeAnswer(p, encodeTubeMoves(plan), LIMIT_MS).isCorrect,
      `tubes ${seed}: plain solution not read`,
    );
  }
  // Topsy-Turvy: tilts undone still count.
  {
    const p = roomPuzzle("gravity", seed) as Extract<PuzzleData, { type: "gravity" }>;
    const plan = decodeGravityTilts(p.solution ?? "");
    const limit = p.tiltLimit!;
    const spare = limit - plan.length;
    const wasted = (n: number) => Array.from({ length: n }, () => [plan[0]!, "Y" as const]).flat();
    const solved = gradeAnswer(p, encodeGravityTilts([...wasted(spare), ...plan]), LIMIT_MS);
    ok(
      solved.isCorrect,
      `gravity ${seed}: solution with ${spare} reset tilts (limit ${limit}) does not solve`,
    );
    const over = gradeAnswer(p, encodeGravityTilts([...wasted(spare + 1), ...plan]), LIMIT_MS);
    ok(
      !over.isCorrect && over.score <= 110 && (over.extra as Loose)["outOfTilts"] === true,
      `gravity ${seed}: tilts past the limit still count`,
    );
  }
  // Brimful: a board past its limit ends the run (later boards score nothing).
  {
    const p = roomPuzzle("measure", seed) as Extract<PuzzleData, { type: "measure" }>;
    const sols = (p.solutions ?? []).map((s, b) =>
      decodeMeasureActions(s, p.boards[b]!.caps.length),
    );
    const solved = gradeAnswer(p, encodeMeasureRound(sols), LIMIT_MS);
    ok(solved.isCorrect, `measure ${seed}: the stored solutions do not solve`);
    // Waste moves on board 1 that change a jug and come back, (limit − min + 1) of them, before its solution.
    const b0 = p.boards[0]!;
    const filler: MeasureAction[] = [];
    let amounts = [...b0.start];
    const actions = measureActions(b0);
    while (filler.length < p.moveLimits![0]!) {
      const a = actions.find((x) => measureApply(b0, amounts, x) !== null)!;
      amounts = measureApply(b0, amounts, a)!;
      filler.push(a);
    }
    const over = gradeAnswer(
      p,
      encodeMeasureRound([[...filler, { kind: "reset" }, ...sols[0]!], ...sols.slice(1)]),
      LIMIT_MS,
    );
    ok(
      !over.isCorrect && over.correctCount === 0 && over.score === 0,
      `measure ${seed}: board 1 past its limit still counts (${over.score})`,
    );
  }
  // Counterweight: a balanced scale hung more often than its limit does not count.
  {
    const p = roomPuzzle("balance", seed) as Extract<PuzzleData, { type: "balance" }>;
    const sol = p.solutions ?? [];
    const limits = p.placeLimits!;
    const body = encodeBalance(sol);
    const at = gradeAnswer(p, joinCountSuffix(body, limits), LIMIT_MS);
    ok(at.isCorrect && at.score >= 120, `balance ${seed}: balanced at the limit does not finish`);
    const over = gradeAnswer(
      p,
      joinCountSuffix(
        body,
        limits.map((l, s) => (s === 0 ? l + 1 : l)),
      ),
      LIMIT_MS,
    );
    ok(
      !over.isCorrect && over.score === 110,
      `balance ${seed}: scale 1 over its limit still counts (${over.score})`,
    );
  }
  // Operator: an equation tried more often than the limit does not count.
  {
    const p = roomPuzzle("equation", seed) as Extract<PuzzleData, { type: "equation" }>;
    const body = joinStages(
      (p.operators ?? []).map((ops) => ops.join(",")),
      p.stages.length,
    );
    const at = gradeAnswer(
      p,
      joinCountSuffix(
        body,
        p.stages.map(() => EQUATION_TRIES),
      ),
      LIMIT_MS,
    );
    ok(at.isCorrect && at.score >= 120, `equation ${seed}: right on the last try does not finish`);
    const over = gradeAnswer(
      p,
      joinCountSuffix(
        body,
        p.stages.map((_, k) => (k === 1 ? EQUATION_TRIES + 1 : 1)),
      ),
      LIMIT_MS,
    );
    ok(
      !over.isCorrect && over.score === 100 && over.correctCount === 3,
      `equation ${seed}: stage 2 over the try limit still counts (${over.score})`,
    );
  }
}

/* --------------------------------- 4. Generation --------------------------------- */
{
  const used: Set<number>[] = [new Set(), new Set(), new Set()];
  for (let i = 0; i < 60; i++) {
    const seed = 7201 + i;
    const b = roomPuzzle("balance", seed) as Extract<PuzzleData, { type: "balance" }>;
    ok(
      balancedArrangements(b.scales[0]!) === 1 && balancedArrangements(b.scales[1]!) === 1,
      `balance ${seed}: a small scale has more than one balanced arrangement`,
    );
    // balanceRev 2: a fourth scale with 10 notches and five weights; 6 / 8 / 10 / 12 hangs; 120 s on the puzzle.
    ok(
      b.scales.length === 4 && b.scales[3]!.pegs === 10 && b.scales[3]!.tray.length === 5 &&
        b.scales.slice(0, 3).every((s) => s.pegs === undefined) &&
        balancedArrangements(b.scales[3]!) >= 1,
      `balance ${seed}: fourth scale not 10 notches with five weights`,
    );
    ok(
      (b.placeLimits ?? []).join(",") === "6,8,10,12" && b.timeLimitMs === BAL_REV2_TIME_MS,
      `balance ${seed}: limits ${b.placeLimits?.join("/")} / clock ${b.timeLimitMs}`,
    );
    const c = roomPuzzle("countup", seed) as Extract<PuzzleData, { type: "countup" }>;
    (c.counts ?? []).forEach((n, k) => {
      const [lo, hi] = COUNTUP_STAGE_COUNTS_REV1[k]!;
      ok(n >= lo && n <= hi, `countup ${seed}: tray ${k + 1} count ${n} outside ${lo}–${hi}`);
      used[k]!.add(n);
    });
  }
  used.forEach((set, k) =>
    ok(set.size >= 7, `countup: tray ${k + 1} used only ${set.size} counts over 60 seeds`),
  );
}

/* -------------------------------- 5. Random play -------------------------------- */
{
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
  for (const type of Object.keys(STAMPS) as PuzzleType[]) {
    const kit = KITS[type]!;
    const scores: Record<string, number[]> = {};
    const solved: Record<string, number> = {};
    for (let i = 0; i < 24; i++) {
      const seed = 5001 + i;
      const p = roomPuzzle(type, seed);
      const limit = puzzleTimeLimitMs(p);
      for (const sp of kit.spam(p, makeRng(hashText(`${type}:spam:${seed}`)), limit)) {
        const g = gradeAnswer(p, sp.answer, 0);
        (scores[sp.label] ??= []).push(g.score);
        if (type === "flood") {
          // floodRev 1: a board that runs out of moves (or stops past par + 1) unfinished scores 0.
          ok(g.isCorrect || g.score === 0, `flood ${seed}: spam "${sp.label}" unfinished scores ${g.score}, want 0`);
          // Stored rounds: the same answer without the stamp scores on the old waste factor (0 at 4× par).
          const stored = { ...(p as unknown as Loose) };
          delete stored["floodRev"];
          delete stored["moveLimit"];
          const old = gradeAnswer(stored as unknown as PuzzleData, sp.answer, 0);
          const extra = old.extra as Loose;
          const start = replayFlood((p as Extract<PuzzleData, { type: "flood" }>).grid, []).region;
          const par = (p as Extract<PuzzleData, { type: "flood" }>).par;
          const want = old.isCorrect ? old.score : unfinishedCredit(((110 * Math.max(0, (extra["region"] as number) - start)) / (196 - start)) * wasteFactor(extra["moves"] as number, par));
          ok(old.score === want && !("moveLimit" in extra), `flood ${seed}: spam "${sp.label}" on the stored shape scores ${old.score}, want ${want}`);
        }
        solved[sp.label] = (solved[sp.label] ?? 0) + (g.isCorrect ? 1 : 0);
      }
    }
    for (const [label, xs] of Object.entries(scores)) {
      ok(median(xs) <= 60, `${type}: spam "${label}" median ${median(xs)} > 60`);
      ok(
        (solved[label] ?? 0) <= 2,
        `${type}: spam "${label}" finished ${solved[label]} of 24 boards`,
      );
    }
    console.log(
      `${type}: ${Object.entries(scores)
        .map(([k, xs]) => `${k} median ${median(xs)}, ${solved[k] ?? 0}/24 finished`)
        .join("; ")}`,
    );
  }
}

/* --------------------------------- 6. Counters --------------------------------- */
for (const type of [
  "flood",
  "tubes",
  "gravity",
  "balance",
  "equation",
  "measure",
] as PuzzleType[]) {
  const { pub } = splitPuzzle(generatePuzzle(type, { bankSeed: 99 }));
  const html = renderToStaticMarkup(
    createElement(puzzleDef(type).Stage, {
      puzzle: pub,
      phaseStartedAt: 0,
      now: 0,
      locked: false,
      onSubmit: () => {},
      stateKey: `move-limits-${type}`,
    }),
  );
  ok(/data-move-limit="\d+"/.test(html), `${type}: the Stage shows no limit counter`);
  const { pub: old } = splitPuzzle(roomPuzzleWithout(type));
  const legacyHtml = renderToStaticMarkup(
    createElement(puzzleDef(type).Stage, {
      puzzle: old,
      phaseStartedAt: 0,
      now: 0,
      locked: false,
      onSubmit: () => {},
      stateKey: `move-limits-old-${type}`,
    }),
  );
  ok(!/data-move-limit/.test(legacyHtml), `${type}: a stored (unlimited) round shows a counter`);
}

/** The same room puzzle without its limit stamp, as a stored round has it. */
function roomPuzzleWithout(type: PuzzleType): PuzzleData {
  const p = { ...(generatePuzzle(type, { bankSeed: 99 }) as unknown as Loose) };
  for (const k of LIMIT_KEYS) delete p[k];
  if (type === "measure") p["measureRev"] = 1;
  return p as unknown as PuzzleData;
}

if (failures.length) {
  console.log(`FAIL: ${failures.length} of ${checks} move-limit checks`);
  process.exit(1);
}
console.log(
  `PASS: ${checks} move-limit checks (legacy identity, stamps, enforcement, generation, random play, counters)`,
);
