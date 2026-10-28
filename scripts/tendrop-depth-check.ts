/**
 * Tenfall depth to 200 (`tenRev 4`, 25 Oct 2026, docs/depth/d2-number-tenfall.md).
 *
 *   1. Legacy identity: runs recorded on main before tenRev 4 (unstamped, tenRev 1, 2 and 3; kit players at
 *      every level plus the two spam strategies, `scripts/fixtures/tendrop-rev3-legacy.json.gz`) replay to
 *      the same score and the same final state (a hash of the whole state) on today's code.
 *
 *   2. tenRev 4's plan (targets, queues, proofs, tries) and rng are tenRev 3's on 500 seeds; every gold position is
 *      a digit that can make its ten (tdMinArrivals), and the rev-4 init adds only `plan.gold`, `scoreRev`, `goldTens`.
 *   3. tenRev 4 runs (kit-style players with and without gold play, random taps) replay to the same state and score
 *      as the phone's, unflagged; goldTens counts exactly the targets made by tapping a gold tile; a finish scores
 *      120 + speed + stretch + gold (cap 200) and an unfinished run exactly its tenRev 3 score (≤ 110).
 *   4. The formulas: older revisions ignore gold, rev 4 never passes 200, never drops with an earlier clear or
 *      another gold ten; rooms deal tenRev 4; a scripted run reaches 200 through the server's gradeAnswer.
 *
 *   bun scripts/tendrop-depth-check.ts            # check
 *   bun scripts/tendrop-depth-check.ts --record   # re-record the legacy fixture (only on code before tenRev 4)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { encodeTenDropRun, replayTenDropRun } from "@/lib/duel/tenDrop";
import { KITS_ENGINE } from "./puzzle-fairness/kits-engine";
import { hashText, makeRng, SKILLS } from "./puzzle-fairness/kit";
import { roomPuzzle } from "./puzzle-fairness/run";
import { ELITE, playTenDrop, playTenDropPerfect } from "./tendrop-depth-player";
import type { PuzzleData } from "@/lib/duel/types";
import { gradeAnswer } from "@/lib/duel/generate.server";
import { speedBonusCurve } from "@/lib/duel/speedPar";
import { inputAt, recordInput, rngBelow, type ArcadeInputEvent } from "@/lib/arcade/engine";
import {
  tdKind,
  tdGoldBonus,
  tdMinArrivals,
  tdStretchBonus,
  tenDropCheckpoint,
  tenDropGame,
  tenDropInit,
  tenDropScore,
  TD_ARRIVALS_NONE,
  TD_CHECKPOINT_INTERVAL,
  TD_DEPTH_MAX,
  TD_DIGIT,
  TD_INPUT_TAP,
  TD_RUN_TICKS,
  TD_TARGETS,
  TEN_DROP_DEPTH_REV,
  TEN_DROP_RAW_REV,
  type TenDropState,
} from "@/lib/arcade/tenDrop";
import { pinPreStandard } from "@/lib/duel/standard/stamps";

// Written for tenRev 4: rooms deal the scoring standard's tenRev 5 since 27 Oct 2026 (standard-number-check proves it);
// new deals here keep tenRev 4.
pinPreStandard(true);

const FIXTURE = "scripts/fixtures/tendrop-rev3-legacy.json.gz";
const REVS: (number | undefined)[] = [undefined, 1, 2, 3];
const SEEDS = Array.from({ length: 10 }, (_, n) => (Math.imul(n + 1, 2654435761) ^ 0x7e4d) | 0);
const LIMIT_MS = 90_000;

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error("FAIL", msg);
};
const ok = (cond: boolean, msg: string) => (cond ? undefined : fail(msg));
const quiet = <T>(fn: () => T): T => {
  const error = console.error;
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.error = error;
  }
};

/** FNV-1a over the state's JSON: any field changing (tiles, rng, plan, counters, log) changes it. */
export function stateHash(state: unknown): number {
  const text = JSON.stringify(state);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

interface LegacyRun { seed: number; rev: number | null; label: string; answer: string; score: number; hash: number; cleared: number; resets: number; tick: number }

const kit = KITS_ENGINE.find((k) => k.type === "tendrop")!;

if (process.argv.includes("--record")) {
  const runs: LegacyRun[] = [];
  for (const seed of SEEDS) {
    const p = { type: "tendrop", seed } as PuzzleData;
    const answers: [string, string][] = [];
    for (const [lv, skill] of Object.entries(SKILLS)) {
      const steps = kit.play(p, makeRng(hashText(`tendrop-depth:${seed}:${lv}`)), skill, LIMIT_MS).steps;
      answers.push([lv, steps.at(-1)?.answer ?? kit.nothing(p)]);
    }
    for (const s of kit.spam(p, makeRng(hashText(`tendrop-depth:spam:${seed}`)), LIMIT_MS)) answers.push([`spam:${s.label}`, s.answer]);
    answers.push(["nothing", kit.nothing(p)]);
    for (const rev of REVS) {
      for (const [label, answer] of answers) {
        const r = quiet(() => replayTenDropRun(seed, answer, rev));
        runs.push({ seed, rev: rev ?? null, label, answer, score: r.score, hash: stateHash(r.state), cleared: r.cleared, resets: r.resets, tick: r.state.tick });
      }
    }
  }
  writeFileSync(FIXTURE, gzipSync(JSON.stringify({ recordedOn: "main before tenRev 4, 25 Oct 2026", runs })));
  console.log(`recorded ${runs.length} runs → ${FIXTURE}`);
}

/* ============================ 1. Legacy identity ============================ */
const fixture = JSON.parse(gunzipSync(readFileSync(FIXTURE)).toString()) as { runs: LegacyRun[] };
const byRev = new Map<string, number>();
for (const run of fixture.runs) {
  const r = quiet(() => replayTenDropRun(run.seed, run.answer, run.rev ?? undefined));
  const h = stateHash(r.state);
  ok(r.score === run.score && h === run.hash && r.cleared === run.cleared && r.resets === run.resets && r.state.tick === run.tick,
    `legacy tenRev ${run.rev ?? "—"} ${run.label} seed ${run.seed}: stored ${run.score}/${run.hash}, replay ${r.score}/${h}`);
  byRev.set(String(run.rev ?? "—"), (byRev.get(String(run.rev ?? "—")) ?? 0) + 1);
}
console.log(`legacy: ${fixture.runs.length} stored runs (${[...byRev].map(([k, v]) => `tenRev ${k}: ${v}`).join(", ")}) replay to the same score and state`);

/* ===================== 2. The rev-4 plan is rev 3's plan ===================== */
{
  let golds = 0;
  for (let i = 1; i <= 500; i++) {
    const seed = (Math.imul(i, 0x2545f491) ^ 0x1234) | 0;
    const a = tenDropInit(seed, TEN_DROP_RAW_REV);
    const b = tenDropInit(seed, TEN_DROP_DEPTH_REV);
    const { gold, ...planB } = b.plan;
    const { scoreRev: _ra, ...restA } = a;
    const { scoreRev: _rb, goldTens, plan: _pb, ...restB } = b;
    const { plan: _pa, ...restA2 } = restA;
    ok(JSON.stringify(planB) === JSON.stringify(a.plan), `seed ${seed}: rev-4 plan differs from rev 3's`);
    ok(JSON.stringify(restB) === JSON.stringify(restA2) && goldTens === 0 && b.scoreRev === TEN_DROP_DEPTH_REV, `seed ${seed}: rev-4 start state adds more than gold`);
    ok("gold" in a.plan === false && a.goldTens === undefined, `seed ${seed}: rev 3 carries gold`);
    ok(Array.isArray(gold) && gold.length === TD_TARGETS, `seed ${seed}: no gold plan`);
    for (let st = 0; st < TD_TARGETS; st++) {
      const g = gold![st]!;
      if (g < 0) continue;
      golds++;
      const q = b.plan.queues[st]!;
      ok(g < q.length && tdKind(q[g]!) === TD_DIGIT, `seed ${seed} target ${st}: gold ${g} is not a digit`);
      ok(tdMinArrivals(q, b.plan.targets[st]!, g) < TD_ARRIVALS_NONE, `seed ${seed} target ${st}: gold ten unreachable`);
    }
    ok(JSON.stringify(tenDropInit(seed, TEN_DROP_DEPTH_REV)) === JSON.stringify(b), `seed ${seed}: rev-4 init not pure`);
  }
  // A target whose every ten ends on an operator (×2, ÷) has no gold tile (about 6 %); 5 gold tens fill the gold part.
  ok(golds >= 4500, `gold targets ${golds} of 5000`);
  console.log(`plan: 500 seeds, tenRev 4 = tenRev 3's plan and start state plus gold (${golds} / 5000 targets have a gold tile, each a provable gold ten)`);
}

/* ======================= 3. tenRev 4 runs and gold tens ======================= */
/** Drives a run tick by tick (as the phone), counting gold tens independently of the sim. */
function driveRev4(seed: number, pick: (s: TenDropState, t: number) => Omit<ArcadeInputEvent, "t"> | null) {
  let state = tenDropInit(seed, TEN_DROP_DEPTH_REV);
  const events: ArcadeInputEvent[] = [];
  const cps: ReturnType<typeof tenDropCheckpoint>[] = [];
  let mine = 0;
  while (!tenDropGame.isOver(state)) {
    const t = state.tick + 1;
    const ev = pick(state, t);
    if (ev) recordInput(events, { ...ev, t }, tenDropGame.inputRanges);
    const before = state;
    state = tenDropGame.step(state, inputAt(events, t));
    if (state.cleared > before.cleared) {
      const gone = before.tiles.filter((x) => !state.tiles.some((y) => y.id === x.id) && x.y + 1 < 520 * 256);
      // The clearing tap took one tile on that tick (tiles falling off the bottom are excluded above).
      if (gone.some((x) => x.gold)) mine++;
    }
    if (state.tick % TD_CHECKPOINT_INTERVAL === 0) cps.push(tenDropCheckpoint(state));
  }
  const score = tenDropGame.score(state);
  return { state, mine, raw: encodeTenDropRun({ seed, claimedScore: score, events, endTick: state.tick, checkpoints: cps }) };
}
{
  let runs = 0;
  let finishes = 0;
  let goldPaid = 0;
  let unfinished = 0;
  const check = (label: string, seed: number, raw: string, phone: TenDropState, mine: number | null) => {
    runs++;
    const r = quiet(() => replayTenDropRun(seed, raw, TEN_DROP_DEPTH_REV));
    ok(stateHash(r.state) === stateHash(phone) && r.score === tenDropGame.score(phone) && !r.flagged,
      `${label} seed ${seed}: replay ${r.score} vs phone ${tenDropGame.score(phone)} ${r.flagged ? `flagged (${r.reason})` : ""}`);
    if (mine !== null) ok(r.state.goldTens === mine, `${label} seed ${seed}: goldTens ${r.state.goldTens}, counted ${mine}`);
    ok(r.goldTens === r.state.goldTens, `${label} seed ${seed}: result goldTens`);
    const s = r.state;
    const rev3 = quiet(() => replayTenDropRun(seed, raw, TEN_DROP_RAW_REV));
    ok(rev3.cleared === s.cleared && rev3.resets === s.resets && rev3.state.tick === s.tick, `${label} seed ${seed}: rev-4 play differs from rev 3's`);
    if (s.cleared >= TD_TARGETS) {
      finishes++;
      if ((s.goldTens ?? 0) > 0) goldPaid++;
      const left = TD_RUN_TICKS - s.clearTick;
      const want = Math.min(TD_DEPTH_MAX, 120 + speedBonusCurve(30, left, TD_RUN_TICKS) + tdStretchBonus(left) + tdGoldBonus(s.goldTens ?? 0));
      ok(r.score === want, `${label} seed ${seed}: finish ${r.score}, formula ${want}`);
      ok(r.score >= rev3.score, `${label} seed ${seed}: finish below rev 3 (${r.score} < ${rev3.score})`);
    } else {
      unfinished++;
      ok(r.score === rev3.score && r.score <= 110, `${label} seed ${seed}: unfinished ${r.score}, rev 3 ${rev3.score}`);
    }
  };
  for (let n = 0; n < 12; n++) {
    const seed = (Math.imul(n + 3, 0x6c8e9cf5) ^ 0x51) | 0;
    for (const [lv, skill] of [["good", SKILLS.good], ["near", SKILLS.near], ["elite", ELITE]] as const) {
      for (const w of [0, 4]) {
        const rng = makeRng(hashText(`depth-rev4:${seed}:${lv}:${w}`));
        const run = playTenDrop(seed, TEN_DROP_DEPTH_REV, rng, skill, w);
        check(`${lv}/w${w}`, seed, run.raw, run.state, null);
      }
    }
    // Random taps (some on real tiles) through the phone's recorder, with gold tens counted here.
    let rng = seed ^ 0x5bd1e995;
    const r = (k: number) => {
      const x = rngBelow(rng, k);
      rng = x.state;
      return x.value;
    };
    const random = driveRev4(seed, (s) => {
      if (s.tiles.length && r(5) === 0) {
        const t = s.tiles[r(s.tiles.length)]!;
        return { k: TD_INPUT_TAP, a: t.col, b: Math.max(0, Math.floor(t.y / 256) + 34), c: 0, d: 0 };
      }
      return null;
    });
    check("random", seed, random.raw, random.state, random.mine);
    const best = playTenDropPerfect(seed, TEN_DROP_DEPTH_REV, 100);
    check("scripted", seed, best.raw, best.state, null);
  }
  ok(goldPaid > 0 && unfinished > 0, `rev-4 runs cover gold tens (${goldPaid}) and unfinished runs (${unfinished})`);
  console.log(`rev 4: ${runs} runs replay as played (${finishes} finishes, ${goldPaid} with gold tens, ${unfinished} unfinished at their tenRev 3 score)`);
}

/* ============================ 4. The formulas ============================ */
{
  for (const rev of [0, 1, 2, 3]) {
    for (let n = 0; n <= TD_TARGETS; n++)
      for (let tick = 0; tick <= TD_RUN_TICKS; tick += 97)
        for (const resets of [0, 5, 12]) ok(tenDropScore(n, tick, rev, resets, 10) === tenDropScore(n, tick, rev, resets), `rev ${rev}: gold changes the score`);
  }
  let top = 0;
  for (let tick = 0; tick <= TD_RUN_TICKS; tick += 7) {
    for (let g = 0; g <= TD_TARGETS; g++) {
      const v = tenDropScore(TD_TARGETS, tick, TEN_DROP_DEPTH_REV, 9, g);
      top = Math.max(top, v);
      ok(v <= TD_DEPTH_MAX && v >= 120, `rev 4 finish at ${tick} with ${g} gold: ${v}`);
      if (tick > 0) ok(v <= tenDropScore(TD_TARGETS, tick - 7, TEN_DROP_DEPTH_REV, 9, g), `rev 4: an earlier clear scores less (${tick})`);
      if (g > 0) ok(v >= tenDropScore(TD_TARGETS, tick, TEN_DROP_DEPTH_REV, 9, g - 1), `rev 4: a gold ten scores less (${tick}, ${g})`);
    }
    for (let n = 0; n < TD_TARGETS; n++)
      for (const resets of [0, 6, 20]) ok(tenDropScore(n, tick, TEN_DROP_DEPTH_REV, resets, 10) === tenDropScore(n, tick, TEN_DROP_RAW_REV, resets), `rev 4 unfinished ${n} differs from rev 3`);
  }
  ok(top === TD_DEPTH_MAX, `rev 4 formula top ${top}`);
  ok(tenDropScore(TD_TARGETS, TD_RUN_TICKS / 2, TEN_DROP_DEPTH_REV, 0, 0) === 175 && tenDropScore(TD_TARGETS, TD_RUN_TICKS, TEN_DROP_DEPTH_REV) === 120, "rev 4 anchors: 175 by 45 s without gold, 120 at the buzzer");

  const dealt = quiet(() => roomPuzzle("tendrop", 777)) as PuzzleData & { tenRev?: number };
  ok(dealt.tenRev === TEN_DROP_DEPTH_REV, `rooms deal tenRev ${dealt.tenRev}`);

  // 200 is reachable: a scripted run (every needed tile tapped the tick it arrives, gold tens first), graded by the server.
  let found: { seed: number; score: number } | null = null;
  for (let n = 0; n < 40 && !found; n++) {
    const p = quiet(() => roomPuzzle("tendrop", 4401 + n * 13)) as PuzzleData & { seed: number };
    for (const w of [6, 100]) {
      const run = playTenDropPerfect(p.seed, TEN_DROP_DEPTH_REV, w);
      const g = quiet(() => gradeAnswer(p, run.raw, 0));
      if (g.score === TD_DEPTH_MAX) {
        found = { seed: 4401 + n * 13, score: g.score };
        break;
      }
    }
  }
  ok(!!found, "no scripted run reached 200");
  console.log(`formulas: older revisions ignore gold, rev 4 capped at ${TD_DEPTH_MAX}, monotone; rooms deal tenRev ${dealt.tenRev}; 200 reached by a scripted run on room seed ${found?.seed}`);
}

if (failures) {
  console.error(`FAIL tendrop-depth-check: ${failures} failure(s)`);
  process.exitCode = 1;
} else console.log("tendrop-depth-check: all passed");
