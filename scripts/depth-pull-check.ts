/**
 * Pull! depth to 200 (clayRev 9, 25 Oct 2026; docs/depth/d3-speed-attention.md).
 *
 *   1. Legacy: every Pull! run recorded on main before the change (scripts/fixtures/depth-engine-legacy.json.gz)
 *      on clayRev none / 2–8 grades to its stored score and breakdown and replays to the same final state.
 *   2. Rooms deal clayRev 9; it plays clayRev 8 exactly (the same schedule, clays, birds and sky), and any shots
 *      score clayRev 8's score as the base.
 *   3. The features: doubles are the seven pairs, scored when both clays are hit; the hit streak's multiplier
 *      steps, a clay getting away or a bird ends it, a shot that hits nothing does not; both are paid by the run's
 *      quick credit; replays match the phone.
 *   4. 200: a scripted perfect quick run scores 200; without the features no run passes 150; a slow perfect run
 *      earns little of them.
 *   5. Old vs new distributions from the simulated players (median, top 10 %, best).
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  clayCheckpoint, clayDepthScore, clayDoublesHit, clayGameFor, clayGravity, clayPairOf, clayStreakMultiplier,
  CLAY_BIRD_STARTLED, CLAY_CONFIG, CLAY_DOUBLE_POINTS, CLAY_DOUBLES, CLAY_FLYING, CLAY_HIT, CLAY_INPUT_SHOT,
  CLAY_REV_DEPTH, CLAY_REV_QUICK, CLAY_STREAK_POINTS, type ClayState,
} from "../src/lib/arcade/clayShoot";
import { encodeClayRun, replayClayRun } from "../src/lib/duel/clayShoot";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import type { PuzzleData } from "../src/lib/duel/types";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { bandsTable, engineBands } from "./depth-engine-bands";

let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => { checks++; if (!cond) failures.push(label); };
const digest = (s: unknown) => createHash("sha256").update(JSON.stringify(s)).digest("hex").slice(0, 16);
const puzzleOf = (seed: number, rev?: number) => ({ type: "clayshoot", seed, ...(rev !== undefined ? { clayRev: rev } : {}) }) as unknown as PuzzleData;
const strip = (s: ClayState) => JSON.stringify({ ...s, dp: undefined });

/* 1. Legacy */
const legacy = (JSON.parse(gunzipSync(readFileSync("scripts/fixtures/depth-engine-legacy.json.gz")).toString()) as {
  type: string; rev: number | null; seed: number; label: string; answer: string; score: number; extra: string; state: string;
}[]).filter((r) => r.type === "clayshoot");
ok(legacy.length >= 80, `legacy: recorded Pull! runs (${legacy.length})`);
for (const r of legacy) {
  const g = gradeAnswer(puzzleOf(r.seed, r.rev ?? undefined), r.answer, 0);
  const tag = `legacy clayRev ${r.rev ?? "none"} ${r.label} ${r.seed}`;
  ok(g.score === r.score, `${tag}: grades to its stored ${r.score} (got ${g.score})`);
  ok(digest({ ...(g.extra ?? {}), diag: undefined }) === r.extra, `${tag}: the same stored breakdown`);
  ok(digest(replayClayRun(r.seed, r.answer, r.rev ?? undefined).state) === r.state, `${tag}: the same final state`);
}

/* 2. Stamp and identical play */
ok((generatePuzzle("clayshoot") as unknown as { clayRev: number }).clayRev === CLAY_REV_DEPTH, "rooms deal clayRev 9");
ok(roundMaxFor("clayshoot") === 200, "Pull!'s round maximum is 200");
ok(CLAY_DOUBLES === 7 && CLAY_DOUBLE_POINTS * CLAY_DOUBLES + CLAY_STREAK_POINTS === 50, "the features are worth the 50 past 150");
ok([0, 10, 11, 12, 13, 23, 24].map(clayPairOf).join() === "-1,-1,0,0,1,6,6", "the doubles are the last fourteen clays, in pairs");
ok([1, 4, 5, 9, 10, 14, 15, 25].map(clayStreakMultiplier).join() === "1,1,2,2,3,3,4,4", "the streak's multiplier: ×2 from the 5th, ×3 from the 10th, ×4 from the 15th");
const old = clayGameFor(CLAY_REV_QUICK);
const now = clayGameFor(CLAY_REV_DEPTH);
for (let n = 0; n < 200; n++) {
  const seed = (n * 2654435761 + 77) | 0;
  ok(strip(old.init(seed)) === strip(now.init(seed)), `seed ${seed}: clayRev 9 starts as clayRev 8`);
  const s = now.init(seed);
  for (let p = 0; p < CLAY_DOUBLES; p++) {
    const a = CLAY_CONFIG.singles + 2 * p;
    ok(s.schedule.side[a] !== s.schedule.side[a + 1] && s.schedule.launch[a + 1]! - s.schedule.launch[a]! <= 44, `seed ${seed}: double ${p} leaves from both sides together`);
  }
}

/** Plays a scripted run. */
function play(game: typeof now, seed: number, pick: (s: ClayState, t: number) => { x: number; y: number } | null): { state: ClayState; raw: string; oldState: ClayState } {
  let state = game.init(seed);
  let shadow = old.init(seed);
  const events: ArcadeInputEvent[] = [];
  const cps: ReturnType<typeof clayCheckpoint>[] = [];
  while (!game.isOver(state)) {
    const t = state.tick + 1;
    const at = pick(state, t);
    if (at) recordInput(events, { t, k: CLAY_INPUT_SHOT, a: Math.round(Math.max(0, Math.min(360, at.x))), b: Math.round(Math.max(0, Math.min(680, at.y))), c: 0, d: 0 }, game.inputRanges);
    state = game.step(state, inputAt(events, t));
    shadow = old.step(shadow, inputAt(events, t));
    if (state.tick % 300 === 0) cps.push(clayCheckpoint(state));
  }
  return { state, oldState: shadow, raw: encodeClayRun({ seed, claimedScore: game.score(state), events, endTick: state.tick, checkpoints: cps }, CLAY_REV_DEPTH) };
}
/** Where clay i is judged on the next tick. */
const next = (s: ClayState, i: number) => ({ x: (s.x[i]! + s.schedule.vx[i]!) / 256, y: (s.y[i]! + s.vy[i]! + clayGravity(s)) / 256 });
/** Shoots every flying clay `delay` ticks after its launch (oldest first); `skip` clays are let go. */
const shooter = (delay: number, skip: Set<number> = new Set()) => (s: ClayState, t: number) => {
  for (let i = 0; i < s.status.length; i++) if (s.status[i] === CLAY_FLYING && !skip.has(i) && t >= s.schedule.launch[i]! + delay) return next(s, i);
  return null;
};
for (let n = 0; n < 10; n++) {
  const seed = 0x6a1 + n * 9973;
  const fast = play(now, seed, shooter(6));
  const parts = clayDepthScore(fast.state);
  const g = gradeAnswer(puzzleOf(seed, CLAY_REV_DEPTH), fast.raw, 0);
  ok(fast.state.hits === 25 && (fast.state.birdHits ?? 0) === 0, `seed ${seed}: the scripted run hits every clay (${fast.state.hits})`);
  ok(g.score === 200 && parts.base === 150 && clayDoublesHit(fast.state) === CLAY_DOUBLES && fast.state.dp!.best === 25, `seed ${seed}: a perfect quick run scores 200 (got ${g.score}: ${JSON.stringify(parts)})`);
  ok(old.score(fast.oldState) === parts.base, `seed ${seed}: the base is clayRev 8's score for the same shots`);
  const r = replayClayRun(seed, fast.raw, CLAY_REV_DEPTH);
  ok(!r.flagged && r.desyncTick === null && r.score === 200, `seed ${seed}: the phone's run replays on the server (${r.reason ?? "ok"})`);
  // A slow perfect run (every clay hit after the quick window): base and features both small.
  const slow = play(now, seed, shooter(24));
  const sp = clayDepthScore(slow.state);
  ok(slow.state.hits === 25 && sp.doubles + sp.streak === 0 && sp.score <= 150, `seed ${seed}: a slow perfect run earns no feature points (${JSON.stringify(sp)})`);
  // Let one clay of the first pair go: that double is lost and the streak restarts.
  const a = CLAY_CONFIG.singles;
  const lose = play(now, seed, shooter(6, new Set([a + 1])));
  ok(clayDoublesHit(lose.state) === CLAY_DOUBLES - 1 && lose.state.dp!.best < 25, `seed ${seed}: a clay let go loses its double and ends the streak (${lose.state.dp!.best})`);
  ok(clayDepthScore(lose.state).score < 200, `seed ${seed}: one clay short is below 200`);
  ok(old.score(lose.oldState) === clayDepthScore(lose.state).base, `seed ${seed}: the base is clayRev 8's score (one clay short)`);
  // Shots that hit nothing do not end the streak.
  let spare = 0;
  const shooterF = shooter(6);
  const wild = play(now, seed, (s, t) => { const at = shooterF(s, t); if (at) return at; if (t % 40 === 0 && spare < 20) { spare++; return { x: 5, y: 5 }; } return null; });
  ok(wild.state.dp!.best === 25 || (wild.state.birdHits ?? 0) > 0, `seed ${seed}: shots that hit nothing keep the streak (${wild.state.dp!.best})`);
}
// Simulated players on clayRev 9: the server replays, base ≤ 150, parts add up, a bird ends the streak.
for (let n = 0; n < 6; n++) for (const level of ["average", "good", "great", "near"] as const) {
  const seed = 0x9b0 + n * 131;
  const p = puzzleOf(seed, CLAY_REV_DEPTH);
  const raw = KITS.clayshoot!.play(p, makeRng(hashText(`clay:check:${seed}:${level}`)), SKILLS[level], 60_000).steps.at(-1)!.answer;
  const r = replayClayRun(seed, raw, CLAY_REV_DEPTH);
  const parts = clayDepthScore(r.state);
  ok(!r.flagged && r.desyncTick === null, `${level} ${seed}: no desync (${r.reason ?? "ok"})`);
  ok(parts.base <= 150 && parts.score === Math.min(200, parts.base + parts.doubles + parts.streak), `${level} ${seed}: base ≤ 150 and the parts add up`);
  // The run's checkpoints are clayRev 9's (they fold in the streak), so clayRev 8's replay reports a desync; quiet it.
  const quiet = console.error;
  console.error = () => {};
  const asOld = gradeAnswer({ ...(p as object), clayRev: CLAY_REV_QUICK } as unknown as PuzzleData, raw, 0).score;
  console.error = quiet;
  ok(asOld === parts.base, `${level} ${seed}: the base is clayRev 8's grade of the same run`);
  const g = gradeAnswer(p, raw, 0);
  ok(g.score === parts.score && (g.extra as { depth?: { base: number } }).depth?.base === parts.base, `${level} ${seed}: the stored breakdown matches the score`);
  if ((r.state.birdStatus ?? []).some((st) => st === CLAY_BIRD_STARTLED)) ok(r.state.dp!.best < 25, `${level} ${seed}: a startled bird broke the streak`);
  ok(r.state.status.filter((st) => st === CLAY_HIT).length === r.state.hits, `${level} ${seed}: hits counted`);
}

// Spam (random shots, mashing on movers) earns nothing more on clayRev 9 than on clayRev 8: the features are scaled by the total.
for (const seed of [0x51, 0x52, 0x53]) {
  const p9 = puzzleOf(seed, CLAY_REV_DEPTH);
  for (const sp of KITS.clayshoot!.spam(p9, makeRng(hashText(`clay:spam:${seed}`)), 60_000)) {
    const quiet = console.error;
    console.error = () => {};
    const s8 = gradeAnswer(puzzleOf(seed, CLAY_REV_QUICK), sp.answer, 0).score;
    console.error = quiet;
    const s9 = gradeAnswer(p9, sp.answer, 0).score;
    ok(s9 === s8, `spam ${sp.label} ${seed}: clayRev 9 scores what clayRev 8 does (${s8} → ${s9})`);
  }
}

/* 5. Distributions */
const rows = engineBands("clayshoot", 40, CLAY_REV_QUICK, CLAY_REV_DEPTH);
console.log("Pull!, 40 room seeds per level\n" + bandsTable(rows, "clayRev 8", "clayRev 9"));
const by = Object.fromEntries(rows.map((r) => [r.level, r]));
for (const level of ["average", "good"]) {
  const r = by[level]!;
  ok(Math.abs(r.now.median - r.old.median) <= 0.1 * r.old.median, `${level}: median within 10 % of clayRev 8 (${r.old.median} → ${r.now.median})`);
}
ok(by["elite"]!.now.median >= 180, `elite: median near the top of the scale (${by["elite"]!.now.median})`);
ok(rows.every((r) => r.now.best <= 200 && r.old.best <= 150), "no score past its maximum");

if (failures.length) {
  console.log(failures.slice(0, 40).map((f) => `  ✗ ${f}`).join("\n"));
  console.log(`FAIL depth-pull-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS depth-pull-check: ${checks} checks — legacy runs identical, clayRev 9 plays clayRev 8, doubles and the streak, 200 only through them`);
