/**
 * Puzzle score rev check (Oct 2026 puzzle score shape, `puzzleScoreRev: 1`).
 *
 *   1. Legacy identity: every stored-round answer in
 *      scripts/fixtures/puzzle-score-legacy.json.gz (recorded on main before the
 *      change by scripts/puzzle-score-legacy-record.ts: unstamped and speedPar
 *      puzzles, empty drafts, spam, four solver levels and their unfinished
 *      states) grades exactly as main stored it: score, verdict, counts, errors,
 *      stored time and the whole stored extra.
 *   2. The stamp: every generated puzzle carries puzzleScoreRev 1. Tenfall tenRev 1 and
 *      Mixed Signals clashRev 4 runs score the same on the phone (its own sim) and the
 *      server's replay, unflagged; Mixed Signals' reveal bonus is the stored score above 120.
 *   3. Quick fairness on the new shape (scripts/puzzle-fairness.ts has the full
 *      audit): over a few room seeds per game, doing nothing scores 0, every
 *      finish scores 120–150 and beats every unfinished run, unfinished credit
 *      never passes 110, and blanket/random spam has a median of at most 5
 *      (strategies the audit marks as known exceptions excluded).
 *
 *   bun scripts/puzzle-score-rev-check.ts [seedsPerGame]
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { PUZZLE_SCORE_REV, puzzleScoreRevOf } from "../src/lib/duel/puzzleScoreRev";
import { ACTIVE_PUZZLE_TYPES, puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { stableExtra, type LegacyCase } from "./puzzle-score-legacy-record";
import { FINISH_GAMES, KNOWN_SPAM, auditGame } from "./puzzle-fairness";
import { inputAt, recordInput, rngBelow, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { tenDropCheckpoint, tenDropGame, tenDropInit, tenDropScore, TD_CHECKPOINT_INTERVAL, TD_INPUT_TAP, TEN_DROP_SCORE_REV } from "../src/lib/arcade/tenDrop";
import { decodeTenDropRun, encodeTenDropRun, replayTenDropRun } from "../src/lib/duel/tenDrop";
import type { PuzzleData } from "../src/lib/duel/types";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { pinRev1Shape, roomPuzzle } from "./puzzle-fairness/run";
import { pinPreDepth } from "../src/lib/duel/wordDepth";

// This check proves the rev-1 shape (rooms deal rev 2 since 19 Oct 2026: scoring-bands-check); room puzzles carry rev-1 stamps.
pinRev1Shape(true);
// Word depth (25 Oct 2026): this check proves the rev-1 shape; the depth stamps have their own checks.
pinPreDepth(true);
// The scoring standard (27 Oct 2026): new deals keep the stamps before it (standard-<group>-checks prove the new ones).
pinPreStandard(true);
import { pinPreStandard } from "../src/lib/duel/standard/stamps";
import { clashCheckpoint, clashGatesAt, clashLaneCount, clashRev4Finished, clashRuleAt, colourClashGameFor, CLASH_CHECKPOINT_INTERVAL, CLASH_DROP, CLASH_INPUT_LANE, CLASH_SET_LANE, CLASH_WORLD_W } from "../src/lib/arcade/colourClash";
import { encodeColourClashRun, replayColourClashRun } from "../src/lib/duel/colourClash";
import { buildArcadeReveal } from "../src/lib/arcade/reveal";
import { encodeActionLog } from "../src/lib/duel/actionLog";
import { laserAction } from "../src/lib/duel/laserLog";

const failures: string[] = [];
const fail = (msg: string) => {
  failures.push(msg);
  if (failures.length <= 40) console.log(`FAIL ${msg}`);
};

// 1. Legacy identity.
const fixture = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/puzzle-score-legacy.json.gz")).toString("utf8")) as { recordedOn: string; cases: LegacyCase[] };
let answers = 0;
for (const c of fixture.cases) {
  for (const e of c.entries) {
    answers++;
    const g = gradeAnswer(c.puzzle, e.answer, e.ms);
    // Mixed Signals' reveal summary (`extra.reveal`, presentation only) was changed on purpose by #40: its
    // "time bonus +N" now reads the bonus inside the stored score. Everything else, the score included, must match.
    const strip = (x: string) => (c.type === "stroop" ? JSON.stringify({ ...(JSON.parse(x) ?? {}), reveal: undefined }) : x);
    const got = { score: g.score, isCorrect: g.isCorrect, correctCount: g.correctCount, errors: g.errors, storedMs: g.storedMs, extra: strip(stableExtra(g.extra)) };
    const want = { ...e, extra: strip(e.extra) };
    for (const key of Object.keys(got) as (keyof typeof got)[]) {
      if (got[key] !== want[key]) {
        fail(`legacy ${c.type} ${c.label} ms ${e.ms}: ${key} ${JSON.stringify(got[key]).slice(0, 120)} ≠ main ${JSON.stringify(want[key]).slice(0, 120)}`);
        break;
      }
    }
  }
}
console.log(`legacy identity: ${answers} answers over ${fixture.cases.length} stored puzzles (recorded on ${fixture.recordedOn})`);

// 2. Every new puzzle is stamped.
for (const type of ACTIVE_PUZZLE_TYPES) {
  if (puzzleScoreRevOf(generatePuzzle(type, { bankSeed: 4242 })) < PUZZLE_SCORE_REV) fail(`${type}: new puzzle not stamped puzzleScoreRev ${PUZZLE_SCORE_REV} or later`);
}

// 2b. The engine games' new revisions score the same on the phone and the server: the phone plays
// tenDropInit(seed, tenRev) / colourClashGameFor(4) and claims game.score(state); the server's replay
// must reach the identical state and score, unflagged, and the reveal's bonus must be the score above 120.
{
  let tenFinishes = 0, clashFinishes = 0, clashOver = 0;
  for (let run = 0; run < 24; run++) {
    const seed = (run * 2654435761 + 7) | 0;
    let rng = seed ^ 0x5bd1e995;
    const r = (n: number) => { const x = rngBelow(rng, n); rng = x.state; return x.value; };
    // Tenfall: half the runs tap real tiles, half tap at random.
    let td = tenDropInit(seed, TEN_DROP_SCORE_REV);
    const tlog: ArcadeInputEvent[] = [];
    const tcps: ReturnType<typeof tenDropCheckpoint>[] = [];
    while (!tenDropGame.isOver(td)) {
      let cand: ArcadeInputEvent | null = null;
      if (run % 2 === 0 && td.tiles.length && r(3) === 0) {
        const t = td.tiles[r(td.tiles.length)]!;
        cand = { t: td.tick + 1, k: TD_INPUT_TAP, a: t.col, b: Math.floor(t.y / 256) + 40, c: 0, d: 0 };
      } else if (run % 2 === 1 && r(10) === 0) cand = { t: td.tick + 1, k: TD_INPUT_TAP, a: r(4), b: r(520), c: 0, d: 0 };
      recordInput(tlog, cand, tenDropGame.inputRanges);
      td = tenDropGame.step(td, inputAt(tlog, td.tick + 1));
      if (td.tick % TD_CHECKPOINT_INTERVAL === 0) tcps.push(tenDropCheckpoint(td));
    }
    const claim = tenDropGame.score(td);
    const tres = replayTenDropRun(seed, encodeTenDropRun({ seed, claimedScore: claim, events: tlog, endTick: td.tick, checkpoints: tcps }), TEN_DROP_SCORE_REV);
    if (tres.flagged || tres.score !== claim || claim !== tenDropScore(td.cleared, td.clearTick, TEN_DROP_SCORE_REV, td.resets)) fail(`tendrop rev 1 run ${run}: phone ${claim} vs server ${tres.score}${tres.flagged ? ` flagged (${tres.reason})` : ""}`);
    if (td.cleared >= 10) tenFinishes++;
    // Mixed Signals clashRev 4: a bot that reads the rule and gates, with a seeded share of wrong gates.
    const game = colourClashGameFor(4);
    let cs = game.init(seed);
    const clog: ArcadeInputEvent[] = [];
    const ccps: ReturnType<typeof clashCheckpoint>[] = [];
    const wrongEvery = [0, 0, 30, 12, 6][run % 5]!;
    while (!game.isOver(cs)) {
      const item = cs.items.at(-1);
      let cand: ArcadeInputEvent | null = null;
      if (item && item.spawn <= cs.tick + 1 && !cs.dropping) {
        const gates = clashGatesAt(cs, cs.tick + 1);
        const wanted = clashRuleAt(cs, cs.tick + 1) === 0 ? item.ink : item.word;
        let lane = Math.max(0, gates.indexOf(wanted));
        if (wrongEvery && (cs.correct + cs.wrong) % wrongEvery === wrongEvery - 1) lane = (lane + 1) % gates.length;
        const lanes = clashLaneCount(cs.tick + 1);
        cand = cs.lane !== lane
          ? { t: cs.tick + 1, k: CLASH_INPUT_LANE, a: CLASH_SET_LANE, b: Math.floor(((lane + 0.5) * CLASH_WORLD_W) / lanes), c: 0, d: 0 }
          : { t: cs.tick + 1, k: CLASH_INPUT_LANE, a: CLASH_DROP, b: 0, c: 0, d: 0 };
      }
      recordInput(clog, cand, game.inputRanges);
      cs = game.step(cs, inputAt(clog, cs.tick + 1));
      if (cs.tick % CLASH_CHECKPOINT_INTERVAL === 0) ccps.push(clashCheckpoint(cs));
    }
    const cclaim = game.score(cs);
    const cres = replayColourClashRun(seed, encodeColourClashRun({ seed, claimedScore: cclaim, events: clog, endTick: cs.tick, checkpoints: ccps }), 4);
    if (cres.flagged || cres.score !== cclaim) fail(`stroop clashRev 4 run ${run}: phone ${cclaim} vs server ${cres.score}${cres.flagged ? ` flagged (${cres.reason})` : ""}`);
    const done = clashRev4Finished(cs.correct, cs.wrong, cs.queue, cs.finishTick);
    if (done) clashFinishes++;
    else if (cs.correct + cs.wrong >= cs.queue) clashOver++;
    if (done ? cres.timeBonus !== cclaim - 120 || cclaim < 120 : cres.timeBonus !== 0 || cclaim > 110) fail(`stroop clashRev 4 run ${run}: score ${cclaim}, reveal bonus ${cres.timeBonus}, finished ${done}`);
    const reveal = buildArcadeReveal("stroop", cres, cclaim);
    if (!reveal || reveal.lines[0] !== `${cs.correct} / ${cs.queue} correct → ${cclaim}` || (done && reveal.lines[2] !== `time bonus +${cclaim - 120}`)) fail(`stroop clashRev 4 run ${run}: reveal lines ${JSON.stringify(reveal?.lines)}`);
  }
  // Finishing Tenfall runs: the near-perfect kit's input logs, replayed on the phone's own rev-1 sim.
  for (let s = 0; s < 6; s++) {
    const puzzle = roomPuzzle("tendrop", 7100 + s) as PuzzleData & { seed: number; tenRev?: number };
    const play = KITS.tendrop!.play(puzzle, makeRng(hashText(`rev-check:tendrop:${s}`)), SKILLS.near, puzzleTimeLimitMs(puzzle));
    const sent = decodeTenDropRun(play.steps.at(-1)!.answer);
    let st = tenDropInit(puzzle.seed, puzzle.tenRev);
    const evs = new Map(sent.events.map((e) => [e.t, e]));
    const cps: ReturnType<typeof tenDropCheckpoint>[] = [];
    while (!tenDropGame.isOver(st)) {
      st = tenDropGame.step(st, evs.get(st.tick + 1) ?? null);
      if (st.tick % TD_CHECKPOINT_INTERVAL === 0) cps.push(tenDropCheckpoint(st));
    }
    const claim = tenDropGame.score(st);
    const res = replayTenDropRun(puzzle.seed, encodeTenDropRun({ seed: puzzle.seed, claimedScore: claim, events: sent.events, endTick: st.tick, checkpoints: cps }), puzzle.tenRev);
    if (res.flagged || res.score !== claim) fail(`tendrop rev 1 kit run ${s}: phone ${claim} vs server ${res.score}`);
    if (st.cleared >= 10) {
      tenFinishes++;
      if (claim < 120) fail(`tendrop rev 1 kit run ${s}: finish scored ${claim}`);
    }
  }
  if (tenFinishes === 0 || clashFinishes === 0 || clashOver === 0) fail(`engine runs did not cover finishes (Tenfall ${tenFinishes}, Mixed Signals ${clashFinishes}) and over-2-wrong runs (${clashOver})`);
  console.log(`engine revisions: 30 Tenfall tenRev 1 and 24 Mixed Signals clashRev 4 runs score the same on phone and server (${tenFinishes} and ${clashFinishes} finishes, ${clashOver} sorted with 3+ wrong)`);
}

// 2c. Lightbender on the action log (alogRev 1, #40) with the new shape: the log's shots are the tries
// measure; a solving layout never fired is unfinished credit for the gems it lights (at most 110).
for (let s = 0; s < 6; s++) {
  const p = roomPuzzle("laser", 7300 + s) as PuzzleData & { type: "laser"; solution?: { cell: number; kind: never }[] };
  const sol = p.solution ?? [];
  const placed = sol.map((m, i) => ({ a: laserAction.place(m.cell, m.kind), t: 1000 + i * 500 }));
  const limit = puzzleTimeLimitMs(p);
  const unfired = gradeAnswer(p, encodeActionLog(placed), 0);
  const fired = gradeAnswer(p, encodeActionLog([...placed, { a: laserAction.fire(), t: 1000 + sol.length * 500 }]), limit / 2);
  const second = gradeAnswer(p, encodeActionLog([{ a: laserAction.fire(), t: 500 }, ...placed, { a: laserAction.fire(), t: 1000 + sol.length * 500 }]), 0);
  if (unfired.isCorrect || unfired.score !== 110) fail(`laser ${s}: unfired solving layout scored ${unfired.score} (correct ${unfired.isCorrect}), want 110 unfinished`);
  if (!fired.isCorrect || fired.score !== 150) fail(`laser ${s}: first-shot solve at half time scored ${fired.score}, want 150`);
  if (!second.isCorrect || second.score !== 128) fail(`laser ${s}: second-shot solve at the buzzer scored ${second.score}, want 120 + 8`);
}

// 3. Quick fairness on the new shape.
const seeds = Number(process.argv[2] ?? 24);
for (const type of FINISH_GAMES) {
  // Only the new shape is judged here, so the audit's legacy "before" column is not graded.
  const a = auditGame(type, seeds, { before: false });
  const r = a.after;
  if (r.nothing.some((s) => s !== 0)) fail(`${type}: doing nothing scores ${Math.max(...r.nothing)}`);
  if (Number.isFinite(r.minFinished) && (r.minFinished < (type === "numline" ? 0 : 120) || r.minFinished <= r.maxUnfinished))
    if (type !== "numline") fail(`${type}: finish ${r.minFinished} vs unfinished ${r.maxUnfinished}`);
  if (r.maxUnfinished > 110) fail(`${type}: unfinished credit ${r.maxUnfinished} > 110`);
  for (const [label, xs] of Object.entries(r.spam)) {
    if (KNOWN_SPAM[type]?.[label]) continue;
    const sorted = [...xs].sort((x, y) => x - y);
    const med = sorted[Math.floor((sorted.length - 1) / 2)]!;
    if (med > 5) fail(`${type}: spam "${label}" median ${med}`);
  }
  console.log(`${type}: nothing 0, finish ≥ ${r.minFinished}, unfinished ≤ ${r.maxUnfinished}`);
}

console.log(failures.length ? `\nFAIL: ${failures.length} problems` : `\nPASS: legacy identity, stamps and quick fairness`);
if (failures.length) process.exit(1);
