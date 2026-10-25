/**
 * Tilt's expansion, tiltRev 7 (25 Oct 2026, docs/expansions/e8.md; round maximum 200):
 *
 *  1. Stored rounds keep their play: 32 skill-bot runs recorded on tiltRev 6 before the change
 *     (scripts/fixtures/tilt-expand-legacy.json.gz) replay unflagged to the same score and final state,
 *     and the same logs on every older revision (1–5) give the same score and state as before.
 *  2. tiltRev 7 runs (scripts/fixtures/tilt-expand-runs.json.gz) replay unflagged to their stored score
 *     and state, and flawless runs (scripts/fixtures/tilt-expand-best.json.gz) reach 200 through the
 *     server's replay.
 *  3. The deal: rooms deal tiltRev 7; on 3,000 seeds the dealer's rule keeps every key and both cups
 *     reachable (gates opening as their keys are taken) with a key in every maze; every maze has its
 *     quick stars on ice; the mazes are bigger than tiltRev 6's.
 *  4. The features exist on tiltRev 7 only: older revisions' mazes and states carry no keys, gates,
 *     ice or quick stars.
 *  5. The score: 0 without input, 0–200 for any play (random drags), the base to 150 and the quick
 *     stars to 50; the quick-star points fall from 8 to 0 over the window; the live bands list tiltRev 7
 *     on its own curve with tiltRev 6 as its score-bands revision.
 *
 *   bun scripts/tilt-expand-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  tiltCheckpoint,
  tiltCupReachableX,
  tiltExpandGame,
  tiltExpandHasKeys,
  tiltGameFor,
  tiltQuickPoints,
  tiltSeedReachableX,
  tiltXBandParts,
  TILT_CHECKPOINT_INTERVAL,
  TILT_INPUT_DRAG,
  TILT_REV_EXPAND,
  TILT_REV_STRICT,
  TILT_V6_BAND_CURVE,
  TILT_V7_BAND_CURVE,
  TILT_X_MAZES,
  TILT_X_QUICK,
  TILT_X_QUICK_FULL,
  TILT_X_QUICK_POINTS,
  TILT_X_QUICK_WINDOW,
  type TiltState,
} from "../src/lib/arcade/tilt";
import { encodeTiltRun, replayTiltRun } from "../src/lib/duel/tilt";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { tiltStateDigest } from "./tilt-expand-record";

let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond && failures.length < 60) failures.push(label);
};
type Run = { level: string; n: number; seed: number; rev: number; raw: string; score: number; digest: string; older?: Record<string, [number, string]> };
const load = (path: string) => (JSON.parse(gunzipSync(readFileSync(path)).toString()) as { runs: Run[] }).runs;

/* 1. Legacy. */
const legacy = load("scripts/fixtures/tilt-expand-legacy.json.gz");
ok(legacy.length === 32, `32 legacy runs (got ${legacy.length})`);
for (const run of legacy) {
  const tag = `tiltRev ${run.rev} ${run.level} #${run.n}`;
  const r = replayTiltRun(run.seed, run.raw, run.rev);
  ok(!r.flagged && r.desyncTick === null, `${tag}: replays unflagged (${r.reason ?? ""})`);
  ok(r.score === run.score, `${tag}: stored ${run.score}, replays ${r.score}`);
  ok(tiltStateDigest(r.state) === run.digest, `${tag}: final state changed`);
  ok(!r.state.xp && r.state.keysGot === undefined && r.state.quickPts === undefined, `${tag}: no expansion fields`);
  for (const [rev, [score, digest]] of Object.entries(run.older ?? {})) {
    const o = replayTiltRun(run.seed, run.raw, Number(rev) || null);
    ok(o.score === score && tiltStateDigest(o.state) === digest, `${tag} on tiltRev ${rev || "(none)"}: score or state changed`);
  }
}

/* 2. tiltRev 7 runs and the 200s. */
const runs = load("scripts/fixtures/tilt-expand-runs.json.gz");
ok(runs.length === 32, `32 tiltRev 7 runs (got ${runs.length})`);
for (const run of runs) {
  const tag = `tiltRev 7 ${run.level} #${run.n}`;
  const r = replayTiltRun(run.seed, run.raw, TILT_REV_EXPAND);
  ok(run.rev === TILT_REV_EXPAND && !r.flagged && r.desyncTick === null, `${tag}: replays unflagged (${r.reason ?? ""})`);
  ok(r.score === run.score && tiltStateDigest(r.state) === run.digest, `${tag}: stored ${run.score}, replays ${r.score}`);
  ok(r.state.xp === 1 && r.score >= 0 && r.score <= 200, `${tag}: an expansion state scoring 0–200`);
}
const best = (JSON.parse(gunzipSync(readFileSync("scripts/fixtures/tilt-expand-best.json.gz")).toString()) as { runs: { seed: number; raw: string; score: number }[] }).runs;
let twoHundred = 0;
for (const b of best) {
  const r = replayTiltRun(b.seed, b.raw, TILT_REV_EXPAND);
  ok(!r.flagged && r.score === b.score, `best run ${b.seed}: stored ${b.score}, replays ${r.score}`);
  if (r.score === 200) twoHundred++;
  ok(r.score >= 190, `best run ${b.seed}: 190 or more (${r.score})`);
}
ok(twoHundred >= 1, `a stored run reaches 200 (${twoHundred})`);

/* 3. The deal. */
const dealt = generatePuzzle("tilt") as unknown as { tiltRev: number; seed: number };
ok(dealt.tiltRev === TILT_REV_EXPAND, `rooms deal tiltRev ${TILT_REV_EXPAND} (got ${dealt.tiltRev})`);
ok(tiltSeedReachableX(dealt.seed) && tiltExpandHasKeys(dealt.seed), "the dealt seed passes the dealer's rule");
let rerolled = 0;
let cells7 = 0;
let cells6 = 0;
for (let k = 0; k < 3000; k++) {
  const seed = (Math.imul(k + 1, 2654435761) ^ 0x5bd1e995) | 0;
  const pass = tiltSeedReachableX(seed) && tiltExpandHasKeys(seed);
  if (!pass) {
    rerolled++;
    continue;
  }
  const s = tiltExpandGame.init(seed);
  ok(s.list.length === TILT_X_MAZES, `seed ${seed}: ${TILT_X_MAZES} mazes`);
  s.list.forEach((m, i) => {
    ok(tiltCupReachableX(m, 0) && tiltCupReachableX(m, 1), `seed ${seed} maze ${i + 1}: every key and both cups reachable`);
    ok((m.keys?.length ?? 0) >= 1 && (m.gates?.length ?? 0) === 2 * (m.keys?.length ?? 0), `seed ${seed} maze ${i + 1}: a key per gate`);
    ok((m.quick?.length ?? 0) === TILT_X_QUICK && m.quick!.every((c) => m.ice?.[c] === 1), `seed ${seed} maze ${i + 1}: ${TILT_X_QUICK} quick stars, each on ice`);
    ok(!m.quick!.some((c) => m.pits.includes(c) || (m.keys ?? []).includes(c)), `seed ${seed} maze ${i + 1}: quick stars clear of holes and keys`);
    ok(i + 1 < 3 ? (m.start2 ?? -1) < 0 : (m.start2 ?? -1) >= 0, `seed ${seed} maze ${i + 1}: the amber marble only in maze 3`);
    cells7 += m.inside.reduce((a, b) => a + b, 0);
  });
  if (k < 300) cells6 += tiltGameFor(TILT_REV_STRICT).init(seed).list.slice(0, 3).reduce((n, m) => n + m.inside.reduce((a, b) => a + b, 0), 0);
}
ok(rerolled < 600, `the dealer re-deals under a fifth of seeds (${rerolled} of 3,000)`);
ok(cells7 / (3000 - rerolled) > (1.4 * cells6) / 300, `tiltRev 7's mazes are bigger (${(cells7 / (3000 - rerolled)).toFixed(0)} cells a run vs ${(cells6 / 300).toFixed(0)} in tiltRev 6's first three)`);

/* 4. Older revisions carry no features. */
for (const rev of [null, 2, 3, 4, 5, 6]) {
  const s = tiltGameFor(rev).init(12345);
  ok(!s.xp && s.list.every((m) => !m.keys && !m.gates && !m.ice && !m.quick), `tiltRev ${rev ?? "(none)"}: no keys, gates, ice or quick stars`);
}

/* 5. The score. */
{
  const seed = 4242;
  const idle = tiltExpandGame.init(seed);
  let s = idle;
  while (!tiltExpandGame.isOver(s)) s = tiltExpandGame.step(s, null);
  ok(tiltExpandGame.score(s) === 0, `no input scores 0 (${tiltExpandGame.score(s)})`);
  for (let k = 0; k < 6; k++) {
    let st: TiltState = tiltExpandGame.init(seed + k);
    let x = 220;
    let touch = 0;
    let v = (seed + k) | 0;
    const events: { t: number; k: number; a: number; b: number; c: number; d: number }[] = [];
    const checkpoints: unknown[] = [];
    while (!tiltExpandGame.isOver(st)) {
      v = (Math.imul(v, 1103515245) + 12345) | 0;
      let input = null;
      if ((v >>> 8) % 4 === 0) {
        x += ((v >>> 12) % 21) - 10;
        if (x < 10 || x > 430) {
          x = 220;
          touch = (touch + 1) % 256;
        }
        input = { k: TILT_INPUT_DRAG, a: x, b: 0, c: touch, d: 0 };
        events.push({ t: st.tick + 1, ...input });
      }
      st = tiltExpandGame.step(st, input);
      if (st.tick % TILT_CHECKPOINT_INTERVAL === 0) checkpoints.push(tiltCheckpoint(st));
    }
    const score = tiltExpandGame.score(st);
    const parts = tiltXBandParts(st);
    ok(score >= 0 && score <= 200 && parts.points <= 140 && parts.bonus <= 60, `random play ${k}: ${score} in 0–200 (${parts.points} + ${parts.bonus})`);
    const raw = encodeTiltRun({ seed: seed + k, claimedScore: score, events, endTick: st.tick, checkpoints: checkpoints as never });
    const r = replayTiltRun(seed + k, raw, TILT_REV_EXPAND);
    ok(!r.flagged && r.score === score, `random play ${k}: the server replays ${r.score} (phone ${score})`);
  }
  ok(tiltQuickPoints(0) === TILT_X_QUICK_POINTS && tiltQuickPoints(TILT_X_QUICK_FULL) === TILT_X_QUICK_POINTS && tiltQuickPoints(TILT_X_QUICK_FULL + 1) <= TILT_X_QUICK_POINTS && tiltQuickPoints(TILT_X_QUICK_WINDOW) === 0, "a quick star is worth 8 up to its full time, 0 at the window's end");
  let last = 99;
  let falls = true;
  for (let t = 0; t <= TILT_X_QUICK_WINDOW; t++) {
    const p = tiltQuickPoints(t);
    if (p > last) falls = false;
    last = p;
  }
  ok(falls, "quick-star points never rise as the window runs");
  ok(TILT_V7_BAND_CURVE.points.at(-1) === 140 && TILT_V7_BAND_CURVE.units.at(-1) === 150, "the base curve tops out at 140 at 150 units");
  ok(roundMaxFor("tilt") === 200, "Tilt's round maximum is 200");
  const live = LIVE_BANDS.tilt as { rev: number; curve: unknown; bands?: { rev: number; curve: unknown } };
  ok(live.rev === TILT_REV_EXPAND && live.curve === TILT_V7_BAND_CURVE && live.bands?.rev === TILT_REV_STRICT && live.bands.curve === TILT_V6_BAND_CURVE, "LIVE_BANDS lists tiltRev 7 on its curve, tiltRev 6 as the score-bands revision");
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL tilt-expand-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS tilt-expand-check: ${checks} checks — tiltRev 6 and older replay as before, tiltRev 7 runs and 200s replay, every key and cup reachable, the score 0–200`);
