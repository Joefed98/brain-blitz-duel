/**
 * Grappler's sliding hooks and clean-swing streak (swingRev 17, 3 Nov 2026, docs/arcade-standard/swing.md "swingRev
 * 17"): swingRev 16's 90 s on its own seeded course without the gems and stars; some hooks slide back and forth on a
 * short rail (none in the first quarter, more further on, the dark rule kept); a clean-swing streak; scored course +
 * pars + gates + streak = 200.
 *
 *  1. Old rounds: swingRev 15 and 16 runs recorded on unmodified main by scripts/swing-slide-legacy.ts
 *     (scripts/fixtures/swing-slide-legacy.json) replay through today's server path unflagged, to the same score, final
 *     state and result; their states carry no slide field.
 *  2. Dealing: rooms deal swingRev 17 (one above swingRev 16) from its deal (src/lib/duel/swingSlideDeal.server.ts, built
 *     by scripts/swing-slide-deal.ts as Apex's): every dealt course's stored oracle log scores exactly 200 through the
 *     server replay (a sample; CHECKS_FULL=1 all); a course is its seed's alone.
 *  3. The course: on sampled seeds, rev 16's shape (42 blocks, six ledge runs, three squeezes), five gates in the first
 *     part of the course, no gems or stars, and the sliding hooks: SWING_V17_SLIDERS a quarter (none in the first), each
 *     a swinging stretch's own hook (not its first), never two in a row, rails clear of the roof, periods dividing 1800.
 *  4. The witness: every course's own planned route (swingSlidePlan().witness), played as input through the real sim
 *     from tick 0, clears every stretch without a miss, each 30 or more ticks under par, takes all five gates, grabs
 *     each sliding hook exactly when it is at home (as the build proved), and never stalls its streak.
 *  5. Sliding hooks: the triangle wave (home twice a period, within its rail, at most 4 × rail ÷ period px a tick); a
 *     press grabs one where it is drawn at that tick, and it stops there for good (anchors copied, never changed in place);
 *     the dark rule (a sliding hook is lit exactly where it is drawn; the dark's edge allows for the rail's far end); and
 *     fairness through the real step: from a restart's hang on the hook before, at several phases of the rail, three or
 *     more release ticks catch it.
 *  6. The streak: a new hook within SWING_V17_STALL ticks of the last grab or landing extends it; a longer wait starts it
 *     at 1; a miss ends it; a re-grab of a hook already held adds nothing; every SWING_V17_STREAK_BLOCK in a row pays.
 *  7. The clock: 90 s; the round clock 93 s.
 *  8. Scores: the parts are 140 + 30 + 10 + 20 = 200 exactly (a full state scores 200 with each part at its maximum); the
 *     core is a straight line full at SWING_V17_FULL per mille; no input 0, any input at least 1, random play low; a
 *     perfect run scores exactly 200 through the server replay; the stored skill-band runs
 *     (scripts/fixtures/swing-slide-runs.json, `--record` to re-record) replay exactly, their medians rise from weak to
 *     flawless.
 *  9. Display and text: the world, the help (sliding hooks, the streak, 90 seconds, the parts totalling 200), the intro,
 *     LIVE_BANDS, the demo held to rev 17, the renderer drawing sliding hooks where the sim has them, the HUD's streak.
 * 10. Building a course stays quick (RoundIntro builds it while the intro is up).
 *
 *   bun scripts/swing-slide-check.ts          (CHECKS_FULL=1: more seeds in 3–5)
 *   bun scripts/swing-slide-check.ts --record (re-records the skill-band runs, several minutes)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";
import {
  swingCheckpoint,
  swingGameFor,
  swingAssaultCounts,
  swingSlideParts,
  swingSlidePlan,
  swingSlideDx,
  swingAnchorAt,
  swingDarkFrom,
  swingHookLit,
  swingReworkRange,
  swingStreakNow,
  prepareSwingCourse,
  swingWorldHFor,
  swingWorldWFor,
  SWING_INPUT_HOLD,
  SWING_KIND_SWING,
  SWING_REV_REWORK,
  SWING_REV_DARK,
  SWING_REV_SLIDE,
  SWING_V15_PAR_FULL,
  SWING_V16_BLOCKS,
  SWING_V16_RUNS,
  SWING_V16_RUN_TICKS,
  SWING_V16_SQUEEZES,
  SWING_V17_BAND_CURVE,
  SWING_V17_CORE,
  SWING_V17_FULL,
  SWING_V17_GATES,
  SWING_V17_GATE_POINTS,
  SWING_V17_GATE_SPAN,
  SWING_V17_MAX,
  SWING_V17_PAR_POINTS,
  SWING_V17_PAR_STRETCHES,
  SWING_V17_SLIDERS,
  SWING_V17_STALL,
  SWING_V17_STREAK_BLOCK,
  SWING_V17_STREAK_EACH,
  SWING_V17_STREAK_MAX,
  type SwingState,
} from "../src/lib/arcade/swing";
import { bandPoints } from "../src/lib/arcade/scoreBands";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { generateSwing } from "../src/lib/duel/arcade.server";
import { SWING_SLIDE_DEAL } from "../src/lib/duel/swingSlideDeal.server";
import { SWING_SLIDE_DEAL_SIZE, SWING_SLIDE_WITNESS, swingSlideVerdict, type SwingWitness } from "./swing-slide-deal";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { SWING_TIME_MS } from "../src/lib/duel/types";
import { encodeSwingRun, replaySwingRun } from "../src/lib/duel/swing";
import { roomSeed } from "./arcade-skill-bands/games";
import { Human, ALL_LEVELS } from "./arcade-skill-bands/human";
import { bot, randomBot } from "./arcade-skill-bands/bots/swing";

const FP = 256;
const FULL = process.env.CHECKS_FULL === "1" || process.argv.includes("--full");
const RECORD = process.argv.includes("--record");
const failures: string[] = [];
let checks = 0;
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};
const started = performance.now();
const game = swingGameFor(SWING_REV_SLIDE);
type Ev = { k: number; a: number; b: number; c: number; d: number };
const hold = (a: number): Ev => ({ k: SWING_INPUT_HOLD, a, b: 0, c: 0, d: 0 });
const step = (s: SwingState, ev: Ev | null) => game.step(s, ev ? { ...ev, t: s.tick + 1 } : null) as SwingState;
const seedsOf = (n: number) => Array.from({ length: n }, (_, i) => roomSeed(i));
const bitCount = (n: number) => { let c = 0; for (let b = n; b; b &= b - 1) c++; return c; };

/* 1. Old rounds replay exactly. */
const LEGACY = "scripts/fixtures/swing-slide-legacy.json";
ok(existsSync(LEGACY), "the legacy fixture is there");
if (existsSync(LEGACY)) {
  const { recorded, runs } = JSON.parse(readFileSync(LEGACY, "utf8")) as { recorded: string; runs: { rev: number; style: string; seed: number; score: number; flagged: boolean; stateHash: number; extra: number; raw: string }[] };
  let same = 0;
  for (const run of runs) {
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const result = replaySwingRun(run.seed, raw, run.rev);
    const identical = result.score === run.score && Boolean(result.flagged) === run.flagged && !result.flagged && fnv(JSON.stringify(result.state)) === run.stateHash && fnv(JSON.stringify({ ...result, state: undefined, checkpoints: undefined })) === run.extra;
    ok(identical, `rev ${run.rev} ${run.style} ${run.seed}: replays ${result.score}${result.flagged ? " flagged" : ""} (stored ${run.score})`);
    ok(result.state.slide === undefined && result.state.sliders === undefined && result.state.streak === undefined, `rev ${run.rev} ${run.style}: no slide fields`);
    if (identical) same++;
  }
  ok(runs.filter((r) => r.rev === SWING_REV_DARK).length >= 12 && runs.filter((r) => r.rev === SWING_REV_REWORK).length >= 12, "the legacy fixture covers swingRev 15 and 16 on three courses each");
  console.log(`old rounds: ${same} / ${runs.length} runs recorded on ${recorded} replay to the same score, state and result`);
}

/* 2. Dealing and identity. */
{
  for (let k = 0; k < 12; k++) {
    const p = generateSwing();
    ok(p.type === "swing" && p.swingRev === SWING_REV_SLIDE && Number.isInteger(p.seed), `rooms deal swingRev 17 (got ${p.swingRev})`);
    ok(SWING_SLIDE_DEAL.includes(p.seed), `rooms deal a course from the proved deal (seed ${p.seed})`);
  }
  // The deal (scripts/swing-slide-deal.ts, as Apex's): every dealt course has a stored oracle log that the server's
  // replay scores exactly 200 (quick: every eighth; CHECKS_FULL=1: all of them), and the deal is exactly those seeds.
  const witnesses = (JSON.parse(gunzipSync(readFileSync(SWING_SLIDE_WITNESS)).toString()) as { witnesses: SwingWitness[] }).witnesses;
  ok(SWING_SLIDE_DEAL.length === SWING_SLIDE_DEAL_SIZE && witnesses.length === SWING_SLIDE_DEAL.length && witnesses.every((w, i) => w.seed === SWING_SLIDE_DEAL[i]), `the deal holds ${SWING_SLIDE_DEAL.length} courses, each with its oracle's witness`);
  ok(new Set(SWING_SLIDE_DEAL).size === SWING_SLIDE_DEAL.length, "no course is dealt twice");
  let proved = 0;
  const sample = witnesses.filter((_, i) => FULL || i % 8 === 0);
  for (const w of sample) {
    const v = swingSlideVerdict(w.seed, w.events);
    const full = v.parts.core === SWING_V17_CORE && v.parts.par === SWING_V17_PAR_POINTS && v.parts.gates === SWING_V17_GATE_POINTS * SWING_V17_GATES && v.parts.streak === SWING_V17_STREAK_MAX;
    ok(v.score === 200 && !v.flagged && full, `dealt course ${w.seed}: its oracle log scores ${v.score} through the server replay, every part at its maximum`);
    if (v.score === 200 && full) proved++;
  }
  console.log(`deal: ${proved} / ${sample.length} sampled dealt courses proved at exactly 200 through the server replay (of ${SWING_SLIDE_DEAL.length})`);
  ok(SWING_REV_SLIDE === SWING_REV_DARK + 1, "the sliding hooks' stamp is one above swingRev 16");
  const seed = roomSeed(4);
  const a = JSON.stringify(game.init(seed));
  for (const other of seedsOf(24).slice(5)) game.init(other);
  ok(JSON.stringify(game.init(seed)) === a, "a course is its seed's alone (built again from an empty cache, it is the same)");
  const s0 = game.init(seed);
  ok(s0.slide === 1 && s0.dark === 1 && s0.rework === 1 && s0.assault === 1 && s0.band === 3, "a rev-17 state carries the slide marker on rev 16's machinery (band 3)");
  ok(s0.slideLock === 0 && s0.streak === 0 && s0.streakPaid === 0 && s0.bestHook === -1, "it starts with no sliding hook stopped and no streak");
  ok(swingGameFor(SWING_REV_DARK).init(seed).slide === undefined, "a rev-16 state has no slide marker");
}

/* 3. The course. */
const courseSeeds = seedsOf(FULL ? 30 : 6);
for (const seed of courseSeeds) {
  const s = game.init(seed);
  const secs = s.sections!;
  const tag = `course ${seed}`;
  const swings = secs.filter((k) => k.kind === SWING_KIND_SWING);
  const runSections = SWING_V16_RUNS.reduce((a, b) => a + b, 0);
  ok(swings.length === SWING_V16_BLOCKS - SWING_V16_RUNS.length && secs.length === swings.length + runSections, `${tag}: ${swings.length} swinging stretches and ${secs.length - swings.length} ledge sections`);
  ok((s.squeezes ?? []).length === SWING_V16_SQUEEZES, `${tag}: three squeezes`);
  secs.forEach((sec, k) => ok(sec.x1! > sec.x0! && (k === 0 || sec.x0 === secs[k - 1]!.x1), `${tag} stretch ${k}: runs on from the one before`));
  const c = swingAssaultCounts(s);
  ok(c.gateTotal === SWING_V17_GATES && c.gemTotal === 0 && c.starTotal === 0, `${tag}: ${c.gateTotal} gates and no gems or stars (${c.gemTotal}/${c.starTotal})`);
  const x0 = secs[0]!.x0!;
  const length = secs[secs.length - 1]!.x1! - x0;
  // Gates sit in the first part of the course (the hops' first SWING_V17_GATE_SPAN per mille: well inside what a fast run reaches).
  ok((s.gates ?? []).every((g) => 1000 * (g.x - x0) < (SWING_V17_GATE_SPAN + 100) * length), `${tag}: every gate inside the first ${(SWING_V17_GATE_SPAN + 100) / 10} % of the course`);
  const sliders = s.sliders ?? [];
  const quarters = [0, 0, 0, 0];
  for (const sl of sliders) quarters[Math.min(3, Math.trunc((4 * (s.anchors[sl.i]!.x - x0)) / length))]! += 1;
  ok(quarters.every((q, i) => q === SWING_V17_SLIDERS[i]), `${tag}: sliding hooks by quarter ${quarters.join(" / ")} (want ${SWING_V17_SLIDERS.join(" / ")})`);
  ok(sliders.every((sl, n) => n === 0 || sl.i > sliders[n - 1]!.i + 1), `${tag}: never two sliding hooks in a row`);
  for (const sl of sliders) {
    const k = secs.findIndex((sec) => sec.kind === SWING_KIND_SWING && sl.i > sec.hook0 && sl.i < sec.hook0 + sec.hooks);
    ok(k >= 0, `${tag} hook ${sl.i}: a swinging stretch's own hook, not its first`);
    ok(sl.x === s.anchors[sl.i]!.x && sl.amp >= 20 * FP && sl.amp < 33 * FP && sl.period % 4 === 0 && 1800 % sl.period === 0 && sl.off >= 0 && sl.off < sl.period, `${tag} hook ${sl.i}: home is the anchor, rail ${sl.amp / FP} px, period ${sl.period}`);
    const ceilAt = (x: number) => { const col = Math.trunc(x / (40 * FP)); const t = x - col * 40 * FP; return s.ceil[col]! + Math.trunc(((s.ceil[col + 1]! - s.ceil[col]!) * t) / (40 * FP)); };
    ok(s.anchors[sl.i]!.y >= ceilAt(sl.x - sl.amp) + 40 * FP && s.anchors[sl.i]!.y >= ceilAt(sl.x + sl.amp) + 40 * FP, `${tag} hook ${sl.i}: its rail stays clear of the roof`);
  }
  const k = s.chaseFrom!;
  ok(k > 0 && k < secs.length && 1000 * (secs[k]!.x0! - x0) >= 750 * length && 1000 * (secs[k - 1]!.x0! - x0) < 750 * length, `${tag}: the dragon's stretch (${k}) is the first in the last quarter`);
}

/* 4. The witness, in the real sim. */
const SHIFT = 1800;
const shifted = (s: SwingState): SwingState => ({ ...s, tick: s.tick - SHIFT, grabTick: s.grabTick - SHIFT, secStart: (s.secStart ?? 0) - SHIFT, missTick: (s.missTick ?? 0) - SHIFT, streakAt: (s.streakAt ?? 0) - SHIFT, secTicks: s.secTicks!.map((t) => (t > 0 ? t - SHIFT : t)) });
/** A course's planned route from tick 0 to the course's end (the clock moved back by SHIFT, a whole number of every rail's period, past the run's end), with its presses and the state at 90 s. */
function witness(seed: number) {
  const plan = swingSlidePlan(seed);
  const byT = new Map(plan.witness!.map((e) => [e.t, e]));
  let s = game.init(seed);
  let moved = 0;
  let at90: SwingState | null = null;
  const presses: { before: SwingState; after: SwingState; t: number }[] = [];
  const states: SwingState[] = [];
  const times: number[] = [];
  let since = 0;
  let maxGap = 0;
  let lastProgress = 0;
  while ((s.sec ?? 0) < s.sections!.length && s.tick + moved < 20000) {
    if (s.tick >= SWING_V16_RUN_TICKS - 200) {
      if (!at90) {
        let q = s;
        while (!game.isOver(q)) {
          const e = byT.get(q.tick + 1 + moved);
          q = step(q, e ? hold(e.a) : null);
        }
        at90 = q;
      }
      s = shifted(s);
      since -= SHIFT;
      lastProgress -= SHIFT;
      moved += SHIFT;
    }
    const e = byT.get(s.tick + 1 + moved);
    const before = s;
    if (s.tick % 7 === 0) states.push(s);
    s = step(s, e ? hold(e.a) : null);
    if (e && e.a === 1) presses.push({ before, after: s, t: s.tick + moved });
    if ((s.restarts ?? 0) > 0) break;
    if ((s.bestHook ?? -1) > (before.bestHook ?? -1) || (s.sec ?? 0) > (before.sec ?? 0)) {
      maxGap = Math.max(maxGap, s.tick - lastProgress);
      lastProgress = s.tick;
    }
    if ((s.sec ?? 0) > times.length) {
      times.push(s.tick - since);
      since = s.tick;
    }
  }
  return { plan, final: s, at90, presses, states, times, maxGap, total: s.tick + moved };
}
const playSeeds = courseSeeds.slice(0, FULL ? 12 : 3);
const witnessed: ReturnType<typeof witness>[] = [];
for (const seed of playSeeds) {
  const tag = `course ${seed}`;
  const w = witness(seed);
  witnessed.push(w);
  const total = w.final.sections!.length;
  ok((w.final.restarts ?? 0) === 0 && w.final.sec === total, `${tag}: the planned route clears all ${total} stretches without a miss, past the sliding hooks (in ${(w.total / 60).toFixed(1)} s)`);
  // (The route plays each ledge section's planned landing, not the fastest of its proved routes, which that par counts
  // from; swing-dark-check's witness searches those. So: every swinging stretch 30+ under, every stretch under par.)
  let worst = Infinity;
  let worstAll = Infinity;
  for (let k = 0; k < total; k++) {
    const beat = w.final.sections![k]!.par - (w.times[k] ?? Infinity);
    worstAll = Math.min(worstAll, beat);
    if (w.final.sections![k]!.kind === SWING_KIND_SWING) worst = Math.min(worst, beat);
  }
  ok(worst >= SWING_V15_PAR_FULL && worstAll > 0, `${tag}: every swinging stretch 30 or more ticks under its par (worst ${worst}), every stretch under par (worst ${worstAll})`);
  ok(bitCount(w.final.bankGates ?? 0) === SWING_V17_GATES, `${tag}: the planned route takes all ${SWING_V17_GATES} gates`);
  ok(w.at90 !== null && bitCount(w.at90.bankGates ?? 0) === SWING_V17_GATES, `${tag}: inside the 90 s too`);
  ok(w.maxGap <= SWING_V17_STALL && (w.final.streak ?? 0) === (w.final.bestHook ?? 0), `${tag}: the route never stalls (longest wait ${w.maxGap} ticks): one streak of every hook it grabs (${w.final.streak})`);
  // Each sliding hook is grabbed by the route exactly when it is at home (the build's phase), so the route is the fixed course's.
  const sliders = w.final.sliders ?? [];
  let atHome = 0;
  for (const p of w.presses) {
    const n = sliders.findIndex((sl) => sl.i === p.after.rope);
    if (n < 0) continue;
    if (swingSlideDx(sliders[n]!, p.before.tick) === 0 && p.after.anchors[sliders[n]!.i]!.x === sliders[n]!.x) atHome++;
  }
  ok(atHome === sliders.length && (w.plan.slideTicks ?? []).length === sliders.length && (w.final.slideLock ?? 0) === (1 << sliders.length) - 1, `${tag}: the route grabs all ${sliders.length} sliding hooks, each at home (${atHome})`);
  // The same route through the server's own replay (the first 90 s): the score it stores is its parts' sum.
  const events = w.plan.witness!.filter((e) => e.t <= SWING_V16_RUN_TICKS).map((e) => ({ ...hold(e.a), t: e.t }));
  // (As a phone sends it: the claimed score and a checkpoint every 300 ticks from its own run of the same input.)
  const byT90 = new Map(events.map((e) => [e.t, e]));
  let phone = game.init(seed);
  const checkpoints: unknown[] = [];
  while (!game.isOver(phone)) {
    phone = game.step(phone, byT90.get(phone.tick + 1) ?? null) as SwingState;
    if (phone.tick % 300 === 0) checkpoints.push(swingCheckpoint(phone));
  }
  const raw = encodeSwingRun({ seed, claimedScore: game.score(phone), events, inputs: [], taps: [], endTick: phone.tick, checkpoints } as never);
  const result = replaySwingRun(seed, raw, SWING_REV_SLIDE);
  const parts = swingSlideParts(result.state);
  ok(!result.flagged && result.score === parts.core + parts.par + parts.gates + parts.streak && parts.gates === SWING_V17_GATE_POINTS * SWING_V17_GATES && (result.state.restarts ?? 0) === 0 && parts.streak === Math.min(SWING_V17_STREAK_MAX, SWING_V17_STREAK_EACH * Math.trunc((result.state.streak ?? 0) / SWING_V17_STREAK_BLOCK)), `${tag}: through the server's replay the route's 90 s scores ${result.score} (${parts.core} + ${parts.par} + ${parts.gates} + ${parts.streak}): every gate, one unbroken streak`);
}
console.log(`witness: ${playSeeds.length} courses cleared by their own planned route, every sliding hook at home when grabbed`);

/* 5. Sliding hooks. */
{
  const s0 = game.init(roomSeed(1));
  const sl = s0.sliders![0]!;
  // The wave: home at a quarter and three quarters of the period, at most the rail's half-length, never faster than 4 × rail ÷ period.
  let homes = 0;
  let within = true;
  let slow = true;
  for (let t = 0; t < sl.period; t++) {
    const dx = swingSlideDx(sl, t);
    if (dx === 0) homes++;
    if (Math.abs(dx) > sl.amp) within = false;
    if (Math.abs(dx - swingSlideDx(sl, t + 1)) > Math.ceil((4 * sl.amp) / sl.period) + 1) slow = false;
  }
  ok(homes >= 2 && within && slow, `a rail's wave: home ${homes} times a period, within ±${sl.amp / FP} px, at most ${((4 * sl.amp) / sl.period / FP).toFixed(2)} px a tick`);
  ok(swingSlideDx(sl, 7) === swingSlideDx(sl, 7 + SHIFT) && swingSlideDx(sl, 7 - sl.period) === swingSlideDx(sl, 7), "the wave repeats every period (and every 1800 ticks)");
  // A press grabs it where it is at that tick (not at home), and it stops there for good.
  const k = s0.sections!.findIndex((sec) => sec.kind === SWING_KIND_SWING && sl.i > sec.hook0 && sl.i < sec.hook0 + sec.hooks);
  const tick = (((Math.trunc(sl.period / 2) - sl.off) % sl.period) + sl.period) % sl.period; // at the rail's far end
  const live = swingAnchorAt(s0, sl.i, tick);
  ok(Math.abs(live.x - sl.x) === sl.amp, `at its far end the hook is ${(live.x - sl.x) / FP} px from home`);
  const probe: SwingState = { ...s0, tick, sec: k, hangHook: sl.i - 1, x: live.x, y: live.y + 50 * FP, vx: 0, vy: 0, rope: -1, respawn: 0, ledgeOn: -1, grabTick: 0 };
  const grabbed = step(probe, hold(1));
  ok(grabbed.rope === sl.i && grabbed.anchors[sl.i]!.x === live.x && (grabbed.slideLock ?? 0) === 1 && s0.anchors[sl.i]!.x === sl.x, "a press grabs the sliding hook where it is drawn, stops it there (copied anchors; the course's own untouched)");
  let later = grabbed;
  for (let n = 0; n < 200; n++) later = step(later, null);
  ok(swingAnchorAt(later, sl.i, later.tick).x === live.x && later.anchors[sl.i]!.x === live.x, "once grabbed it stays where it stopped");
  // The dark rule: lit exactly where drawn (swingHookLit reads the live hook), and the dark's edge allows for the rail's far end.
  ok(swingHookLit(probe, sl.i) === swingAnchorAt(probe, sl.i, probe.tick).x < swingDarkFrom(probe), "a sliding hook is lit where it is drawn");
  let darkChecked = 0;
  for (const seed of seedsOf(6)) {
    const st = game.init(seed);
    st.sections!.forEach((sec, kk) => {
      if (sec.kind !== SWING_KIND_SWING || !((sec.to ?? -1) >= 0 && st.sections![kk + 1] && st.sections![kk + 1]!.kind !== SWING_KIND_SWING)) return;
      for (const s of st.sliders ?? []) {
        if (s.i < sec.hook0 || s.i >= sec.hook0 + sec.hooks) continue;
        const on = { ...st, sec: kk, hangHook: s.i - 1 };
        let lit = true;
        for (let t = 0; t < s.period; t++) if (!swingHookLit({ ...on, tick: t }, s.i)) lit = false;
        ok(lit, `course ${seed} stretch ${kk}: a sliding hook before a ledge run stays lit along its whole rail`);
        darkChecked++;
      }
    });
  }
  console.log(`sliding hooks: wave, grab, stop and dark checked (${darkChecked} before a ledge run)`);
  // Fairness through the real step: from a restart's hang on the hook before, at four phases of the rail, three or more
  // release ticks (then a press each tick of the flight until the hook is caught) catch it.
  let fair = 0;
  const fairSeeds = FULL ? seedsOf(4) : seedsOf(2);
  for (const seed of fairSeeds) {
    const st = game.init(seed);
    for (const s of (st.sliders ?? []).filter((_, n) => FULL || n % 3 === 0)) {
      const kk = st.sections!.findIndex((sec) => sec.kind === SWING_KIND_SWING && s.i > sec.hook0 && s.i < sec.hook0 + sec.hooks);
      const [lo, hi] = swingReworkRange(st, kk);
      for (let f = 0; f < 4; f++) {
        const t0 = Math.trunc((f * s.period) / 4) + 1000;
        // The restart: the rev-15 hang from the hook before (a miss puts the hero there; a state with one restart).
        // (No dragon in the probe: chaseFrom past the course; the lava under the hero, a miss on the next tick.)
        const missed = { ...st, tick: t0 - 1, sec: kk, hangHook: s.i - 1, chaseFrom: st.sections!.length, x: st.anchors[s.i - 1]!.x, y: 830 * FP, vx: 0, vy: 4 * FP, rope: -1, respawn: 0, ledgeOn: -1, secStart: 0, secTicks: st.secTicks!.map(() => 0) };
        let base = step(missed, null);
        if ((base.restarts ?? 0) !== 1 || base.rope !== s.i - 1) {
          ok(false, `course ${seed} hook ${s.i}: the probe's miss restarts on the hook before`);
          continue;
        }
        while ((base.respawn ?? 0) > 0) base = step(base, null);
        let caught = 0;
        let rope = base;
        for (let r = 0; r < 240 && caught < 3; r++) {
          let q = step(rope, hold(0));
          for (let g = 0; g < 60 && q.rope < 0 && (q.restarts ?? 0) === 1; g++) {
            const tryIt = step(q, hold(1));
            if (tryIt.rope === s.i) {
              caught++;
              break;
            }
            if (tryIt.rope > s.i) break;
            q = step(q, null);
          }
          rope = step(rope, null);
          if ((rope.restarts ?? 0) !== 1) break;
        }
        ok(caught >= 3, `course ${seed} hook ${s.i} phase ${f}: from the restart's hang on the hook before, ${caught} release ticks catch it`);
        if (caught >= 3) fair++;
        void lo;
        void hi;
      }
    }
  }
  console.log(`fairness: ${fair} restart phases catch their sliding hook through the real step`);
}

/* 6. The streak. */
{
  const st = game.init(roomSeed(3));
  const k0 = st.sections![0]!;
  const h1 = st.anchors[k0.hook0 + 1]!;
  const near = (s: SwingState, tick: number): SwingState => ({ ...s, tick, x: h1.x, y: h1.y + 60 * FP, vx: 0, vy: 0, rope: -1, respawn: 0, ledgeOn: -1 });
  const a = step(near({ ...st, streak: 3, streakAt: 100, bestHook: k0.hook0 }, 100 + SWING_V17_STALL - 1), hold(1));
  ok(a.rope === k0.hook0 + 1 && a.streak === 4 && a.bestHook === k0.hook0 + 1 && a.streakAt === a.tick, "a new hook within the stall limit extends the streak");
  ok((a.streakPaid ?? 0) === (4 % SWING_V17_STREAK_BLOCK === 0 ? 1 : 0), "a whole block in a row pays");
  const b = step(near({ ...st, streak: 3, streakAt: 100, bestHook: k0.hook0 }, 100 + SWING_V17_STALL + 5), hold(1));
  ok(b.rope === k0.hook0 + 1 && b.streak === 1, "after a longer wait the streak starts again at 1");
  const c = step(near({ ...st, streak: 3, streakAt: 100, bestHook: k0.hook0 + 1 }, 110), hold(1));
  ok(c.rope === k0.hook0 + 1 && c.streak === 3 && c.streakAt === 100, "re-grabbing a hook already held adds nothing");
  const blk = step(near({ ...st, streak: SWING_V17_STREAK_BLOCK - 1, streakAt: 100, bestHook: k0.hook0, streakPaid: 2 }, 120), hold(1));
  ok(blk.streak === SWING_V17_STREAK_BLOCK && blk.streakPaid === 3, `the ${SWING_V17_STREAK_BLOCK}th clean grab in a row pays a block`);
  const lava = step({ ...st, tick: 200, streak: 7, streakAt: 190, x: h1.x, y: 830 * FP, vx: 0, vy: 6 * FP, rope: -1, respawn: 0, ledgeOn: -1 }, null);
  ok((lava.restarts ?? 0) === 1 && lava.streak === 0, "a miss ends the streak");
  ok(swingStreakNow({ ...a, tick: a.tick + SWING_V17_STALL + 1 }) === 0 && swingStreakNow(a) === 4, "the HUD's streak drops to 0 once the wait passes the stall limit");
  let paid = 0;
  for (let n = 1; n <= 3 * SWING_V17_STREAK_BLOCK; n++) if (n % SWING_V17_STREAK_BLOCK === 0) paid++;
  ok(paid === 3, "three blocks in a row pay three times");
}

/* 7. The clock. */
{
  ok(game.runTicks === 5400 && SWING_TIME_MS === 93_000, "swingRev 17 runs 90 s; the round clock is 93 s");
  let s = game.init(roomSeed(2));
  while (!game.isOver(s)) s = step(s, null);
  ok(s.tick === 5400 && game.score(s) === 0, "an idle rev-17 run lasts 90 s and scores 0");
}

/* 8. Scores. */
{
  ok(SWING_V17_CORE + SWING_V17_PAR_POINTS + SWING_V17_GATE_POINTS * SWING_V17_GATES + SWING_V17_STREAK_MAX === 200 && SWING_V17_MAX === 200 && roundMaxFor("swing") === 200, `the parts are ${SWING_V17_CORE} + ${SWING_V17_PAR_POINTS} + ${SWING_V17_GATE_POINTS * SWING_V17_GATES} + ${SWING_V17_STREAK_MAX} = 200 exactly`);
  let straight = true;
  for (let u = 0; u <= 1000; u += 7) if (bandPoints(SWING_V17_BAND_CURVE, u) !== Math.floor((SWING_V17_CORE * Math.min(u, SWING_V17_FULL)) / SWING_V17_FULL)) straight = false;
  ok(straight, `the core pays in a straight line, full at ${SWING_V17_FULL} per mille of the course`);
  const init = game.init(roomSeed(5));
  const total = init.sections!.length;
  const partial = (permilleSec: number): SwingState => ({ ...init, acted: 1, sec: permilleSec });
  let line = true;
  for (let k = 0; k <= total; k += 5) {
    const st = partial(k);
    const p = swingSlideParts(st);
    if (p.core !== Math.max(1, Math.trunc((SWING_V17_CORE * Math.min(p.permille, SWING_V17_FULL)) / SWING_V17_FULL)) || p.gates || p.streak) line = false;
  }
  ok(line, "the sim's core is that line, with no feature points on it");
  const full: SwingState = { ...init, acted: 1, sec: total, secTicks: init.sections!.reduce((ts: number[], sec, k) => [...ts, (ts[k - 1] ?? 0) + Math.max(1, sec.par - SWING_V15_PAR_FULL)], []), bankGates: (1 << SWING_V17_GATES) - 1, streakPaid: Math.ceil(SWING_V17_STREAK_MAX / SWING_V17_STREAK_EACH) };
  const parts = swingSlideParts(full);
  ok(parts.core === SWING_V17_CORE && parts.par === SWING_V17_PAR_POINTS && parts.gates === SWING_V17_GATE_POINTS * SWING_V17_GATES && parts.streak === SWING_V17_STREAK_MAX && game.score(full) === 200, `a full run scores 200 (${parts.core} + ${parts.par} + ${parts.gates} + ${parts.streak})`);
  const fullAtF = { ...full, sec: init.sections!.findIndex((sec) => 1000 * (sec.x0! - init.sections![0]!.x0!) >= SWING_V17_FULL * (init.sections![total - 1]!.x1! - init.sections![0]!.x0!)) };
  ok(swingSlideParts(fullAtF).core === SWING_V17_CORE, `the core is full from ${SWING_V17_FULL} per mille on (not only at the course's end)`);
  /** n stretches cleared, each exactly 30 ticks under its par. */
  const parAt = (n: number) => {
    const ts: number[] = [];
    init.sections!.forEach((sec, k) => ts.push(k < n ? (ts[k - 1] ?? 0) + sec.par - SWING_V15_PAR_FULL : 0));
    return swingSlideParts({ ...init, acted: 1, sec: n, secTicks: ts }).par;
  };
  const half = Math.trunc(SWING_V17_PAR_STRETCHES / 2);
  ok(parAt(SWING_V17_PAR_STRETCHES) === SWING_V17_PAR_POINTS && parAt(total) === SWING_V17_PAR_POINTS && parAt(half) === Math.trunc((SWING_V17_PAR_POINTS * half) / SWING_V17_PAR_STRETCHES), `pars: ${SWING_V17_PAR_STRETCHES} stretches 30 under par pay all ${SWING_V17_PAR_POINTS} (more pay no more), ${half} of them ${parAt(half)}`);
  ok(swingSlideParts({ ...init, acted: 1, streakPaid: 3 }).streak === Math.min(SWING_V17_STREAK_MAX, 3 * SWING_V17_STREAK_EACH) && swingSlideParts({ ...init, acted: 1, bankGates: 0b101 }).gates === 2 * SWING_V17_GATE_POINTS, "gates and streak blocks pay fixed amounts");
  ok(game.score({ ...init, acted: 1 }) === 1 && game.score({ ...init }) === 0, "any input scores at least 1; none scores 0");
  for (const seed of seedsOf(FULL ? 8 : 3)) {
    const human = new Human("swing", seed, "weak");
    const res = randomBot({ game, seed, rev: SWING_REV_SLIDE, human });
    const byTick = new Map((res.events ?? []).map((e) => [e.t, e]));
    let r = game.init(seed);
    while (!game.isOver(r) && r.tick < game.runTicks) r = game.step(r, byTick.get(r.tick + 1) ?? null);
    const score = game.score(r);
    ok(score >= 1 && score <= 45, `random play on ${seed} scores 1 or more and stays low (${score})`);
  }
  const FIXTURE = "scripts/fixtures/swing-slide-runs.json";
  if (RECORD) {
    const runs: unknown[] = [];
    for (const seed of seedsOf(6)) {
      for (const level of [...ALL_LEVELS, "random"] as const) {
        const human = new Human("swing", seed, level === "random" ? "weak" : level);
        const ctx = { game, seed, rev: SWING_REV_SLIDE, human };
        const res = level === "random" ? randomBot(ctx) : bot(ctx);
        const events = res.events ?? [];
        const byTick = new Map(events.map((e) => [e.t, e]));
        let r = game.init(seed);
        const checkpoints: unknown[] = [];
        while (!game.isOver(r) && r.tick < game.runTicks) {
          r = game.step(r, byTick.get(r.tick + 1) ?? null);
          if (r.tick % 300 === 0) checkpoints.push(swingCheckpoint(r));
        }
        const raw = encodeSwingRun({ seed, claimedScore: game.score(r), events, inputs: [], taps: [], endTick: r.tick, checkpoints } as never);
        const result = replaySwingRun(seed, raw, SWING_REV_SLIDE);
        runs.push({ level, seed, score: result.score, stateHash: fnv(JSON.stringify(result.state)), raw: gzipSync(raw).toString("base64") });
        console.log(`recorded ${level} ${seed}: ${result.score}`);
      }
    }
    writeFileSync(FIXTURE, JSON.stringify({ recorded: "swing-slide-check --record (the skill-band bots, scripts/arcade-skill-bands/bots/swingRework.ts, sliding hooks seen through swingBotKit)", runs }));
  }
  ok(existsSync(FIXTURE), "the skill-band runs are recorded");
  const { runs } = JSON.parse(existsSync(FIXTURE) ? readFileSync(FIXTURE, "utf8") : '{"runs":[]}') as { runs: { level: string; seed: number; score: number; stateHash: number; raw: string }[] };
  const by = new Map<string, number[]>();
  let perfect200 = 0;
  for (const run of runs) {
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const result = replaySwingRun(run.seed, raw, SWING_REV_SLIDE);
    ok(!result.flagged && result.score === run.score && fnv(JSON.stringify(result.state)) === run.stateHash, `${run.level} ${run.seed}: replays ${result.score} (stored ${run.score})`);
    ok(result.score >= 1 && result.score <= 200, `${run.level} ${run.seed}: scores 1 or more and at most 200 (${result.score})`);
    if (result.score === 200) {
      const p = swingSlideParts(result.state);
      if (p.core === SWING_V17_CORE && p.par === SWING_V17_PAR_POINTS && p.gates === SWING_V17_GATE_POINTS * SWING_V17_GATES && p.streak === SWING_V17_STREAK_MAX) perfect200++;
    }
    by.set(run.level, [...(by.get(run.level) ?? []), result.score]);
  }
  // A perfect run: 200 through the server's replay, every part at its maximum (stored runs that reached it).
  ok(perfect200 >= 1, `${perfect200} stored run(s) score exactly 200 through the server replay, every part at its maximum`);
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.trunc(xs.length / 2)]!;
  const order = ALL_LEVELS.map((l) => [l, median(by.get(l) ?? [0])] as const);
  for (let i = 1; i < order.length - 1; i++) {
    const [lo, a] = order[i - 1]!;
    const [hi, b] = order[i]!;
    ok(b > a, `the ${hi} median (${b}) is above the ${lo} median (${a})`);
  }
  ok(order[order.length - 1]![1] >= order[order.length - 2]![1], `the flawless median (${order[order.length - 1]![1]}) is at least the elite median (${order[order.length - 2]![1]})`);
  const avg = by.get("average") ?? [0];
  ok(Math.max(...avg) - Math.min(...avg) <= 55, `an ordinary (average) player's scores stay close across courses (${Math.min(...avg)}–${Math.max(...avg)})`);
  console.log(`scores by level (median of ${runs.length / 8} courses): ${order.map(([l, m]) => `${l} ${m}`).join(" · ")} · random ${median(by.get("random") ?? [0])}`);
}

/* 9. Display and text. */
{
  ok(swingWorldWFor(SWING_REV_SLIDE) === 450 && swingWorldHFor(SWING_REV_SLIDE) === 844, "rev 17 plays in rev 13's 450 × 844 view");
  ok(LIVE_BANDS.swing.rev === SWING_REV_SLIDE && LIVE_BANDS.swing.curve === SWING_V17_BAND_CURVE, "the help's numbers come from the revision rooms deal (swingRev 17)");
  const help = PUZZLE_INSTRUCTIONS.swing!;
  const text = help.how.map((h) => `${h.action} ${h.detail}`).join(" ");
  // The jungle canopy (3 Nov 2026): sliding hooks are shown as swinging vines on the same paths.
  ok(/Swinging vines/.test(text) && /time the grab/.test(text) && /stops where you grab it/.test(text) && /none in the first quarter/.test(text), "the help explains the sliding hooks (swinging vines)");
  ok(/clean-swing streak/i.test(text) && new RegExp(`Every ${SWING_V17_STREAK_BLOCK} in a row`).test(text) && /A miss, or hanging about longer, starts it again/.test(text), "the help explains the streak");
  ok(!/Gems/.test(text) && !/stars/i.test(text) && /Speed gates/.test(text) && /Par times/.test(text) && /Platform runs are in deep shade/.test(text) && /swinging ones included/.test(text), "no gems or stars; gates, pars and the dark (swinging vines included) kept");
  ok(/The run lasts 90 seconds/.test(text) && /last quarter a pterodactyl/.test(text) && /same course, vines, swinging vines, gates and par times/.test(text) && !/lava|dragon/i.test(text), "90 seconds, the pterodactyl's last quarter, the same course for everyone; no lava or dragon left in the help");
  const intro = help.how.filter((h) => !h.helpOnly);
  ok(intro.length === 3 && intro.every((h) => `${h.action} ${h.detail}`.length <= 46) && help.goal.length <= 34, "the intro's goal and three lines fit");
  ok(/^90 seconds\./.test(help.score) && new RegExp(`course ${SWING_V17_CORE} \\+ par ${SWING_V17_PAR_POINTS} \\+ gates ${SWING_V17_GATE_POINTS * SWING_V17_GATES} \\+ streak ${SWING_V17_STREAK_MAX} = 200`).test(help.score) && /Up to 200/.test(help.score) && /clean-swing streak/.test(help.score), `the help's SCORE text says 90 seconds and the parts totalling 200: "${help.score}"`);
  ok(/^90 s\./.test(INTRO_SCORE.swing) && /streak/.test(INTRO_SCORE.swing) && /gates/.test(INTRO_SCORE.swing) && !/gems/.test(INTRO_SCORE.swing) && /up to (\{max\}|200)/.test(INTRO_SCORE.swing) && INTRO_SCORE.swing.replace("{max}", "200").length <= 90, `the intro score line (90 characters at most): "${INTRO_SCORE.swing}"`);
  const demo = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
  ok(/data\.type === "swing" && demo\?\.puzzle\.type === "swing" && demo\.puzzle\.swingRev !== SWING_REV_SLIDE\) return null/.test(demo), "Grappler's intro demo stays stopped until one is recorded on swingRev 17");
  const introSrc = readFileSync("src/components/duel/RoundIntro.tsx", "utf8");
  ok(/setTimeout\(\(\) => prepareSwingCourse\(seed, swingRev\)/.test(introSrc), "the round's intro builds the course ahead");
  const art = readFileSync("src/lib/arcade/swing.renderer.ts", "utf8");
  ok(/const a = state\.slide \? swingAnchorAt\(state, i, state\.tick\) : home;/.test(art) && /if \(state\.slide\) drawRails\(/.test(art) && /STREAK ×\$\{streak\}/.test(art), "the renderer draws each sliding hook where the sim has it, its rail, and the streak in the HUD");
  // swingRev 17 draws the jungle canopy (3 Nov 2026): the same rules in its own file, and the streak as an Action HUD chip.
  const jungle = readFileSync("src/lib/arcade/swingJungle.renderer.ts", "utf8");
  ok(/if \(state\.slide\) \{\n    drawSwingJungleWorld\(/.test(art) && /const a = state\.slide \? swingAnchorAt\(state, i, state\.tick\) : home;/.test(jungle) && /state\.dark && !swingHookLit\(state, i\)/.test(jungle) && /if \(state\.slide\) drawJungleVinePaths\(/.test(art) && /label: "STREAK", value: `×\$\{streak\}`/.test(art), "the jungle draws each swinging vine where the sim has it (none in the shade), its path, and the streak chip");
  const sim = readFileSync("src/lib/arcade/swing.ts", "utf8");
  ok(/s\.slide \? rangeTargetAt\(s, lo, hi, s\.x, s\.y, state\.tick, lim\)/.test(sim) && /if \(s\.slide\) return rangeTargetAt\(s, lo, hi, x, y, tick, s\.dark \? swingDarkFrom\(s\) : SWING_NO_DARK\)/.test(sim), "the step and the bots' look-ahead read the same sliding hooks");
}

/* 10. Building a course stays quick. */
{
  const seed = roomSeed(9) ^ 0x2468ace;
  prepareSwingCourse(seed, SWING_REV_SLIDE);
  const t1 = performance.now();
  const s1 = game.init(seed);
  ok(performance.now() - t1 < 5 && s1.slide === 1, "after prepareSwingCourse the round's init takes under 5 ms");
  const t0 = performance.now();
  const seeds = seedsOf(26).slice(20);
  for (const s of seeds) game.init(s ^ 0x5a5a5a);
  const ms = (performance.now() - t0) / seeds.length;
  ok(ms < 900, `a course builds in ${ms.toFixed(0)} ms on average (under 900)`);
  console.log(`build: ${ms.toFixed(0)} ms a course`);
}

if (failures.length) {
  console.log(`\nFAIL: ${failures.length} of ${checks} checks failed:`);
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`\nPASS: ${checks} swingRev 17 checks (${((performance.now() - started) / 1000).toFixed(0)} s)`);
