/**
 * Grappler's dark ledge runs (swingRev 16, 1 Nov 2026, docs/arcade-standard/swing.md "swingRev 16"): swingRev 15's
 * swinging course over 90 s (a longer course, six ledge runs, three squeezes), the dragon over the last quarter only,
 * and the ledge runs dark: past the next ledge (or the first hook after a run) the cave is dark and its hooks cannot be
 * grabbed. Scored as rev 15: course 140 + pars 30 + gates, gems and stars 30 = 200.
 *
 *  1. Old rounds: swingRev 14 and 15 runs recorded on unmodified main by scripts/swing-dark-legacy.ts
 *     (scripts/fixtures/swing-dark-legacy.json) replay through today's server path unflagged, to the same score, final
 *     state and result; their states carry no dark field and run the minute.
 *  2. Dealing: rooms deal swingRev 16 (one above swingRev 15) on any seed; a course is its seed's alone.
 *  3. The course: on sampled seeds, SWING_V16_BLOCKS blocks (swinging stretches of 3–5 hooks, the six ledge runs of
 *     SWING_V16_RUNS sections with three squeezes), about 80 % of its length swinging, the stretches end to end, five
 *     gates, gems and stars, and the dragon's stretch the first in the last quarter.
 *  4. The witness: every course's own planned route (swingDarkPlan), played as input through the real sim (the dark
 *     included) from tick 0, clears every stretch, each 30 or more ticks under its par, so the course's 200 is reachable,
 *     and every gate, gem and star is taken on its proved line.
 *  5. The dark: on a ledge section past its landing ledge, on the stretch before a run past the run's first ledge, after
 *     a run past the next stretch's first hook until it is grabbed, nowhere else; a landing lights the next part; a hook
 *     in the dark cannot be grabbed and every lit hook in range can, checked press by press along the witness (so what
 *     is drawn, swingHookLit, is exactly what the step lets the hero grab); swingRev 15 states have no dark.
 *  6. The clock: swingRev 16 runs 90 s (5,400 ticks), swingRev 15 still 60 s; the round clock is 93 s.
 *  7. Scores: the parts are 140 + 30 + 30 = 200 exactly (a full run's state scores 200); no input 0; any input at least
 *     1; random play low; the stored skill-band runs (scripts/fixtures/swing-dark-runs.json, `--record` to re-record)
 *     replay exactly, medians rise weak < average < good < great < near-perfect < elite < flawless with clear gaps at the
 *     top, and on every course flawless > great > good.
 *  8. Display and text: the world, the help (the dark, 90 seconds, the parts totalling 200), the intro, LIVE_BANDS, the
 *     demo held to rev 16, the renderer's dark from the sim's own rule.
 *  9. Building a course stays quick (RoundIntro builds it while the intro is up).
 *
 * Since swingRev 17 (3 Nov 2026, the sliding hooks and the clean-swing streak; swing-slide-check) this check deals
 * swingRev 16 through pinSwingPreSlide, and its live-revision assertions (LIVE_BANDS, the help's and intro's parts, the
 * intro demo's gate) read rev 17's (the dark's help lines are kept and still asserted).
 *
 *   bun scripts/swing-dark-check.ts          (CHECKS_FULL=1: more seeds in 3–5)
 *   bun scripts/swing-dark-check.ts --record (re-records the skill-band runs, about 10 minutes)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { hasScorePart } from "../src/lib/duel/scoreList";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";
import {
  swingCheckpoint,
  swingGameFor,
  swingAssaultCounts,
  swingReworkParts,
  swingReworkRange,
  swingDarkPlan,
  swingDarkFrom,
  swingHookLit,
  prepareSwingCourse,
  swingWorldHFor,
  swingWorldWFor,
  SWING_INPUT_HOLD,
  SWING_INPUT_REEL,
  SWING_REEL_UP,
  SWING_KIND_SWING,
  SWING_NO_DARK,
  SWING_REV_ASSAULT,
  SWING_REV_REWORK,
  SWING_REV_DARK,
  SWING_RUN_TICKS,
  SWING_V15_CHASE_FROM,
  SWING_V15_GATES,
  SWING_V15_GEMS,
  SWING_V15_PAR_FULL,
  SWING_V15_PAR_POINTS,
  SWING_V15_PICKUP_POINTS,
  SWING_V15_STARS,
  SWING_V16_BAND_CURVE,
  SWING_V16_BLOCKS,
  SWING_V16_CORE,
  SWING_V16_RUNS,
  SWING_V16_RUN_TICKS,
  SWING_V16_SQUEEZES,
  SWING_REV_SLIDE,
  SWING_V17_BAND_CURVE,
  type SwingState,
} from "../src/lib/arcade/swing";
import { bandPoints } from "../src/lib/arcade/scoreBands";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { generateSwing, pinSwingPreSlide } from "../src/lib/duel/arcade.server";
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
const game = swingGameFor(SWING_REV_DARK);
type Ev = { k: number; a: number; b: number; c: number; d: number };
const hold = (a: number): Ev => ({ k: SWING_INPUT_HOLD, a, b: 0, c: 0, d: 0 });
const reel: Ev = { k: SWING_INPUT_REEL, a: SWING_REEL_UP, b: 0, c: 0, d: 0 };
const step = (s: SwingState, ev: Ev | null) => game.step(s, ev ? { ...ev, t: s.tick + 1 } : null) as SwingState;
const seedsOf = (n: number) => Array.from({ length: n }, (_, i) => roomSeed(i));
// Rooms deal swingRev 17 since 3 Nov 2026 (swing-slide-check); this check proves swingRev 16 as dealt before it.
pinSwingPreSlide(true);

/* 1. Old rounds replay exactly. */
const LEGACY = "scripts/fixtures/swing-dark-legacy.json";
ok(existsSync(LEGACY), "the legacy fixture is there");
if (existsSync(LEGACY)) {
  const { recorded, runs } = JSON.parse(readFileSync(LEGACY, "utf8")) as { recorded: string; runs: { rev: number; style: string; seed: number; score: number; flagged: boolean; stateHash: number; extra: number; raw: string }[] };
  let same = 0;
  for (const run of runs) {
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const result = replaySwingRun(run.seed, raw, run.rev);
    const identical = result.score === run.score && Boolean(result.flagged) === run.flagged && !result.flagged && fnv(JSON.stringify(result.state)) === run.stateHash && fnv(JSON.stringify({ ...result, state: undefined, checkpoints: undefined })) === run.extra;
    ok(identical, `rev ${run.rev} ${run.style} ${run.seed}: replays ${result.score}${result.flagged ? " flagged" : ""} (stored ${run.score})`);
    ok(result.state.dark === undefined && result.state.tick <= SWING_RUN_TICKS, `rev ${run.rev} ${run.style}: no dark field, and the run ends inside the minute`);
    if (identical) same++;
  }
  ok(runs.filter((r) => r.rev === SWING_REV_REWORK).length >= 12 && runs.filter((r) => r.rev === SWING_REV_ASSAULT).length >= 12, "the legacy fixture covers swingRev 14 and 15 on three courses each");
  console.log(`old rounds: ${same} / ${runs.length} runs recorded on ${recorded} replay to the same score, state and result`);
}

/* 2. Dealing and identity. */
{
  for (let k = 0; k < 12; k++) {
    const p = generateSwing();
    ok(p.type === "swing" && p.swingRev === SWING_REV_DARK && Number.isInteger(p.seed), `rooms deal swingRev 16 (got ${p.swingRev})`);
  }
  ok(SWING_REV_DARK === SWING_REV_REWORK + 1, "the dark ledge runs' stamp is one above swingRev 15");
  const seed = roomSeed(4);
  const a = JSON.stringify(game.init(seed));
  for (const other of seedsOf(24).slice(5)) game.init(other);
  ok(JSON.stringify(game.init(seed)) === a, "a course is its seed's alone (built again from an empty cache, it is the same)");
  const s0 = game.init(seed);
  ok(s0.dark === 1 && s0.rework === 1 && s0.assault === 1 && s0.band === 3, "a rev-16 state carries the dark marker on rev 15's machinery (band 3)");
  ok(swingGameFor(SWING_REV_REWORK).init(seed).dark === undefined, "a rev-15 state has no dark marker");
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
  ok((s.squeezes ?? []).length === SWING_V16_SQUEEZES && secs.filter((k) => k.kind === 2).length === SWING_V16_SQUEEZES, `${tag}: three squeezes`);
  let swingLen = 0;
  let length = 0;
  secs.forEach((sec, k) => {
    ok(sec.x1! > sec.x0! && (k === 0 || sec.x0 === secs[k - 1]!.x1), `${tag} stretch ${k}: runs on from the one before`);
    length += sec.x1! - sec.x0!;
    if (sec.kind === SWING_KIND_SWING) swingLen += sec.x1! - sec.x0!;
  });
  ok(swingLen / length >= 0.72 && swingLen / length <= 0.88, `${tag}: ${((100 * swingLen) / length).toFixed(0)} % of the course is swinging (about 80 %)`);
  const c = swingAssaultCounts(s);
  ok(c.gateTotal === SWING_V15_GATES && c.gemTotal === SWING_V15_GEMS && c.starTotal === SWING_V15_STARS, `${tag}: ${c.gateTotal}/${c.gemTotal}/${c.starTotal} gates, gems and stars`);
  const k = s.chaseFrom!;
  const x0 = secs[0]!.x0!;
  ok(k > 0 && k < secs.length && 1000 * (secs[k]!.x0! - x0) >= SWING_V15_CHASE_FROM * length && 1000 * (secs[k - 1]!.x0! - x0) < SWING_V15_CHASE_FROM * length, `${tag}: the dragon's stretch (${k}) is the first in the last quarter`);
  // The first and last blocks are swinging stretches (the runs sit between).
  ok(secs[0]!.kind === SWING_KIND_SWING && secs[secs.length - 1]!.kind === SWING_KIND_SWING, `${tag}: it starts and ends on swinging stretches`);
}

/* 4. The witness, in the real sim (the dark included). */
/** As swing-rework-check's: a course's planned route from tick 0, the clock moved back (by SHIFT) wherever it would run past the end. */
const SHIFT = 1800;
const shifted = (s: SwingState): SwingState => ({ ...s, tick: s.tick - SHIFT, grabTick: s.grabTick - SHIFT, secStart: (s.secStart ?? 0) - SHIFT, missTick: (s.missTick ?? 0) - SHIFT, secTicks: s.secTicks!.map((t) => (t > 0 ? t - SHIFT : t)) });
/** Every press the witness makes, with the state before it (for the dark's press-by-press check). */
type Press = { before: SwingState; t: number };
function witness(seed: number) {
  const plan = swingDarkPlan(seed);
  let s = game.init(seed);
  const starts = new Map<string, { before: SwingState; ev: Ev | null; at: number }>();
  const presses: Press[] = [];
  const states: SwingState[] = [];
  let k = 0;
  let j = 0;
  let G = 1;
  let startEv: Ev | null = null;
  let release = -1;
  let press = -1;
  let mode: "rope" | "fly" | "land" | "ledge" = "rope";
  let moved = 0;
  let land = -1;
  let adj: [number, number] = [0, 0];
  const times: number[] = [];
  let since = 0;
  starts.set("0:0", { before: s, ev: null, at: 1 });
  while (!game.isOver(s) && s.tick < game.runTicks) {
    if (s.tick >= game.runTicks - 200) {
      s = shifted(s);
      G -= SHIFT;
      release -= SHIFT;
      press -= SHIFT;
      since -= SHIFT;
      moved += SHIFT;
    }
    const t = s.tick + 1;
    let ev: Ev | null = null;
    let pressed = false;
    const steps = plan.sections[k];
    if (!steps) break;
    if (mode === "ledge" && (s.ledgeOn ?? -1) >= 0 && s.x === s.ledges![s.ledgeOn!]!.x && (s.respawn ?? 0) === 0) {
      ev = hold(1);
      G = t;
      j = 0;
      mode = "rope";
      starts.set(`${k}:0`, { before: s, ev, at: t });
      presses.push({ before: s, t });
      adj = [0, 0];
      if (s.sections![k]!.kind !== SWING_KIND_SWING && steps.length === 2 && steps[0]![1] >= 0) adj = bestHop(step(s, ev), t, steps[0]!, steps[1]![0]);
      ev = null;
      pressed = true;
    } else if (mode === "rope" && steps[j]![1] < 0 && land < 0) {
      // A landing step (on to a ledge): the planned release, or an earlier or later one that lands sooner (the fastest
      // landing of the plan's swing; a ledge section's par counts from its fastest proved route).
      land = bestLanding(s, G, steps[j]![0])[0];
    }
    if (pressed) ev = hold(1);
    else if (mode === "rope" && t === G + (steps[j]![1] < 0 ? land : steps[j]![0] + (j === 0 ? adj[0] : 0))) {
      ev = hold(0);
      release = t;
      land = -1;
      mode = steps[j]![1] < 0 ? "land" : "fly";
      press = steps[j]![1] < 0 ? -1 : release + steps[j]![1] + (j === 0 ? adj[1] : 0);
    } else if (mode === "fly" && t === press) {
      ev = hold(1);
      G = t;
      startEv = ev;
      presses.push({ before: s, t });
    }
    const before = s;
    if (t % 7 === 0) states.push(s);
    s = step(s, ev);
    if ((s.restarts ?? 0) > 0) break;
    if (mode === "fly" && t === press) {
      j += 1;
      mode = "rope";
      if ((s.sec ?? 0) > k) {
        k = s.sec!;
        j = 0;
      }
      starts.set(`${k}:${j}`, { before, ev: startEv, at: G });
    } else if ((s.sec ?? 0) > k) {
      k = s.sec!;
      j = 0;
      mode = "ledge";
    }
    if ((s.sec ?? 0) > times.length) {
      times.push(s.tick - since);
      since = s.tick;
    }
  }
  return { plan, final: s, starts, times, presses, states, total: s.tick + moved };
}
/** From a state on a rope grabbed at tick G: the release (ticks after G) whose flight clears the stretch soonest, the planned one on a tie. */
function bestLanding(s: SwingState, G: number, planned: number): [number, number] {
  const sec = s.sec ?? 0;
  const clearAt = (r: number): number => {
    let q = s;
    while (q.tick < G + r - 1) {
      q = step(q, null);
      if ((q.restarts ?? 0) > (s.restarts ?? 0)) return Infinity;
    }
    q = step(q, hold(0));
    for (let n = 0; n < 200; n++) {
      if ((q.sec ?? 0) > sec) return q.tick;
      if ((q.restarts ?? 0) > (s.restarts ?? 0) || q.ended) return Infinity;
      q = step(q, null);
    }
    return Infinity;
  };
  let best = planned;
  let bestAt = clearAt(planned);
  for (let r = Math.max(1, s.tick + 1 - G); r <= planned + 40; r++) {
    const at = clearAt(r);
    if (at < bestAt) {
      best = r;
      bestAt = at;
    }
  }
  return [best, bestAt];
}
/**
 * A two-hook ledge section's quickest route near its plan (a ledge section's par counts from the fastest of its proved
 * routes: the planned one, grabs two ticks either side and releases a tick either side): from the state just after the
 * press at tick G, the release and grab offsets of its first hop that clear the section soonest.
 */
function bestHop(s: SwingState, G: number, step0: [number, number], landing: number): [number, number] {
  let best: [number, number] = [0, 0];
  let bestAt = Infinity;
  for (const [dr, dg] of [[0, 0], [0, -2], [0, 2], [-1, 0], [1, 0]] as const) {
    const R = G + step0[0] + dr;
    const P = R + step0[1] + dg;
    let q = s;
    let lost = false;
    while (q.tick < P && !lost) {
      q = step(q, q.tick + 1 === R ? hold(0) : q.tick + 1 === P ? hold(1) : null);
      if ((q.restarts ?? 0) > (s.restarts ?? 0)) lost = true;
    }
    if (lost || q.rope < 0) continue;
    const [, at] = bestLanding(q, P, landing);
    if (at < bestAt) {
      bestAt = at;
      best = [dr, dg];
    }
  }
  return best;
}
function goodSwing(after: SwingState): boolean {
  if (after.om <= 0) return false;
  let s = after;
  const ax = s.anchors[s.rope]!.x;
  let length = 2;
  let rising = 0;
  for (let r = 2; r <= 160; r++) {
    const py = s.y;
    s = step(s, null);
    if ((s.restarts ?? 0) > (after.restarts ?? 0) || s.rope !== after.rope) return false;
    length += 1;
    if (r >= 4 && s.om > 0 && s.y < py && s.x > ax) rising += 1;
    if (s.om <= 0) break;
  }
  return length >= 16 && rising >= 6;
}
const playSeeds = courseSeeds.slice(0, FULL ? 12 : 3);
let worstBeat = Infinity;
let featuresProved = 0;
let witnessTicks = 0;
const witnessed: ReturnType<typeof witness>[] = [];
for (const seed of playSeeds) {
  const tag = `course ${seed}`;
  const w = witness(seed);
  witnessed.push(w);
  const { plan, final, starts, times, total: ticks } = w;
  witnessTicks = Math.max(witnessTicks, ticks);
  const total = final.sections!.length;
  ok((final.restarts ?? 0) === 0 && final.sec === total && times.length === total, `${tag}: the witness clears all ${total} stretches without a miss, through the dark (its steady line in ${(ticks / 60).toFixed(1)} s)`);
  for (let k = 0; k < total; k++) {
    const beat = final.sections![k]!.par - (times[k] ?? Infinity);
    worstBeat = Math.min(worstBeat, beat);
    ok(beat >= SWING_V15_PAR_FULL, `${tag} stretch ${k}: the witness beats its par by ${beat} ticks (the full share needs ${SWING_V15_PAR_FULL})`);
  }
  ok(swingReworkParts(final).core === SWING_V16_CORE, `${tag}: the witness earns the whole core`);
  for (const f of plan.features) {
    const start = starts.get(`${f.sec}:${f.step}`);
    const next = final.sections![f.sec]!.hook0 + f.step + 1;
    if (!start) {
      ok(false, `${tag}: the witness reached stretch ${f.sec} step ${f.step} (the ${f.kind} ${f.index})`);
      continue;
    }
    let s = start.before;
    const G = start.at;
    const events = new Map<number, Ev>();
    if (start.ev) events.set(G, start.ev);
    if (f.reel >= 0) events.set(G + f.reel, reel);
    const R = G + (f.reel >= 0 ? f.reel : 0) + f.r;
    events.set(R, hold(0));
    while (s.tick < R) s = step(s, events.get(s.tick + 1) ?? null);
    let caught: SwingState | null = null;
    for (let g = 1; g <= 60 && !caught; g++) {
      const on = step(s, hold(1));
      if (on.rope === next && (on.restarts ?? 0) === 0 && goodSwing(on)) caught = on;
      s = step(s, null);
      if ((s.restarts ?? 0) > 0) break;
    }
    const taken = caught && (f.kind === "gate" ? ((caught.gatesLit ?? 0) & (1 << f.index)) !== 0 : f.kind === "gem" ? ((caught.gemsTaken ?? 0) & (1 << f.index)) !== 0 : (caught.starsTaken ?? []).includes(f.index));
    ok(Boolean(taken), `${tag}: ${f.kind} ${f.index} is taken on its proved line (stretch ${f.sec}, step ${f.step}), which then catches hook ${next}`);
    if (taken) featuresProved++;
  }
}
console.log(`witness: ${playSeeds.length} courses cleared through the dark by their own planned route (every stretch ${worstBeat} or more ticks under par), ${featuresProved} gates, gems and stars on their lines`);

/* 5. The dark. */
{
  const lit = (s: SwingState, i: number) => swingHookLit(s, i);
  const edgeOf = (s: SwingState, i: number) => s.ledges![i]!.x + s.ledges![i]!.half;
  const s0 = game.init(roomSeed(1));
  const secs = s0.sections!;
  ok(swingDarkFrom(s0) === SWING_NO_DARK && secs[0]!.kind === SWING_KIND_SWING, "the course starts lit (a swinging stretch, no dark)");
  let runs = 0;
  for (let k = 1; k < secs.length; k++) {
    const sec = secs[k]!;
    const prev = secs[k - 1]!;
    // A run's first ledge section: the stretch before it is dark past the run's first ledge.
    if (sec.kind !== SWING_KIND_SWING && prev.kind === SWING_KIND_SWING) {
      runs++;
      const before = { ...s0, sec: k - 1, hangHook: prev.hook0 };
      ok(swingDarkFrom(before) === edgeOf(s0, prev.to!), `stretch ${k - 1}: as a ledge run comes up, the dark starts at its first ledge's far edge`);
      ok(Array.from({ length: prev.hooks }, (_, i) => prev.hook0 + i).every((i) => lit(before, i)), `stretch ${k - 1}: its own hooks stay lit`);
      ok(!lit(before, sec.hook0), `stretch ${k - 1}: the run's first hook is in the dark`);
    }
    if (sec.kind !== SWING_KIND_SWING) {
      const on = { ...s0, sec: k, ledgeOn: sec.from!, hangHook: -1 };
      ok(swingDarkFrom(on) === edgeOf(s0, sec.to!) && Array.from({ length: sec.hooks }, (_, i) => sec.hook0 + i).every((i) => lit(on, i)), `ledge section ${k}: lit up to its landing ledge (its hooks lit), dark past it`);
      const nxt = secs[k + 1];
      if (nxt) ok(!lit(on, nxt.hook0), `ledge section ${k}: the next part's first hook is in the dark until the landing`);
    }
    // After a run: dark past the next stretch's first hook until it is grabbed, then lit.
    if (sec.kind === SWING_KIND_SWING && prev.kind !== SWING_KIND_SWING) {
      const landed = { ...s0, sec: k, ledgeOn: sec.from!, hangHook: -1 };
      ok(lit(landed, sec.hook0) && !lit(landed, sec.hook0 + 1) && swingDarkFrom(landed) < s0.anchors[sec.hook0 + 1]!.x, `stretch ${k}: after the run, only its first hook is lit`);
      ok(swingDarkFrom({ ...landed, ledgeOn: -1, hangHook: sec.hook0 }) === SWING_NO_DARK, `stretch ${k}: grabbing its first hook lights the stretch`);
    }
    // A swinging stretch on hooks (not before or after a run): no dark.
    if (sec.kind === SWING_KIND_SWING && prev.kind === SWING_KIND_SWING && !(secs[k + 1] && secs[k + 1]!.kind !== SWING_KIND_SWING)) {
      ok(swingDarkFrom({ ...s0, sec: k, hangHook: sec.hook0 }) === SWING_NO_DARK, `stretch ${k}: a swinging stretch away from the runs is lit`);
    }
  }
  ok(runs === SWING_V16_RUNS.length, `six ledge runs go dark (${runs})`);
  ok(swingDarkFrom({ ...s0, dark: undefined, sec: secs.findIndex((x) => x.kind !== SWING_KIND_SWING) }) === SWING_NO_DARK, "a state without the dark marker (swingRev 15) is never dark");
  // The grab rule itself: just under the stretch's second hook after a run (in reach of it, out of reach of the first),
  // a press grabs nothing while it is dark and the hook once the first hook has been held.
  const k = secs.findIndex((x, i) => i > 0 && x.kind === SWING_KIND_SWING && secs[i - 1]!.kind !== SWING_KIND_SWING);
  const sec = secs[k]!;
  const h1 = s0.anchors[sec.hook0 + 1]!;
  const near = { ...s0, sec: k, ledgeOn: -1, hangHook: -1, x: h1.x, y: h1.y + 100 * FP, vx: 0, vy: 0, rope: -1, respawn: 0 };
  const h0 = s0.anchors[sec.hook0]!;
  ok((h0.x - near.x) ** 2 + (h0.y - near.y) ** 2 > (220 * FP) ** 2, "the probe is out of the first hook's reach");
  ok(step(near, hold(1)).rope < 0, "a hook in the dark cannot be grabbed");
  ok(step({ ...near, hangHook: sec.hook0 }, hold(1)).rope === sec.hook0 + 1, "the same hook, lit (its first hook held), can");
  // The same press on swingRev 15's rule (no dark marker) grabs it: only the dark stops it.
  ok(step({ ...near, dark: undefined }, hold(1)).rope === sec.hook0 + 1, "without the dark (swingRev 15's rule) the press grabs it");
  // Press by press along the witnesses: from each state, a press next to each hook of the grab range grabs it exactly when it is lit.
  let probed = 0;
  let darkProbed = 0;
  for (const w of witnessed) {
    for (const before of w.states) {
      // (States standing on a ledge are probed too, the hero lifted off it: the stretch after a run is dark there.)
      if ((before.respawn ?? 0) > 0) continue;
      const kk = Math.min(before.sec ?? 0, before.sections!.length - 1);
      const [lo, hi] = swingReworkRange(before, kk);
      for (let i = lo; i < hi; i++) {
        const a = before.anchors[i]!;
        // Right under the hook, nearer to it than to any other in the range.
        // (The dragon is taken away: a probe behind the hero would otherwise be caught, a restart, not a grab.)
        const probe = { ...before, x: a.x, y: a.y + 60 * FP, vx: 0, vy: 0, rope: -1, chaseX: 0, chaseY: 0, ledgeOn: -1, ledgeHold: 0 };
        let nearest = true;
        for (let m = lo; m < hi; m++) if (m !== i && (before.anchors[m]!.x - probe.x) ** 2 + (before.anchors[m]!.y - probe.y) ** 2 <= (60 * FP) ** 2) nearest = false;
        if (!nearest) continue;
        const after = step(probe, hold(1));
        const got = after.rope === i;
        ok(got === lit(before, i), `stretch ${kk}, hook ${i}: grabbed ${got}, drawn lit ${lit(before, i)} (the drawn hooks are exactly the grabbable ones; rope ${after.rope} restarts ${after.restarts}/${before.restarts} chase ${before.chaseX} x ${before.x} tick ${before.tick})`);
        probed++;
        if (!lit(before, i)) darkProbed++;
      }
    }
  }
  ok(probed > 200, `the press-by-press probe covered ${probed} presses (${darkProbed} in the dark)`);
  // The witness's own presses are always on lit hooks.
  let litPresses = 0;
  for (const w of witnessed) for (const p of w.presses) {
    const after = step(p.before, hold(1));
    if (after.rope >= 0 && lit(p.before, after.rope)) litPresses++;
  }
  ok(litPresses === witnessed.reduce((n, w) => n + w.presses.length, 0), "every press of a planned route takes a lit hook");
  console.log(`dark: ${runs} runs, ${probed} presses probed (${darkProbed} in the dark)`);
}

/* 6. The clock. */
{
  ok(SWING_V16_RUN_TICKS === 5400 && game.runTicks === 5400 && swingGameFor(SWING_REV_REWORK).runTicks === SWING_RUN_TICKS && SWING_RUN_TICKS === 3600, "swingRev 16 runs 90 s; swingRev 15 still the minute");
  ok(SWING_TIME_MS === 93_000, "the round clock is 93 s (90 s and three of slack)");
  let s = game.init(roomSeed(2));
  while (!game.isOver(s)) s = step(s, null);
  ok(s.tick === 5400 && game.score(s) === 0, "an idle rev-16 run lasts 90 s and scores 0");
  const old = swingGameFor(SWING_REV_REWORK);
  let r = old.init(roomSeed(2));
  while (!old.isOver(r)) r = old.step(r, null) as SwingState;
  ok(r.tick === 3600, "an idle rev-15 run still ends at 60 s");
}

/* 7. Scores. */
{
  ok(SWING_V16_CORE + SWING_V15_PAR_POINTS + SWING_V15_PICKUP_POINTS * (SWING_V15_GATES + SWING_V15_GEMS + SWING_V15_STARS) === 200 && roundMaxFor("swing") === 200, "the parts are 140 + 30 + 30 = 200 exactly");
  let straight = true;
  for (let u = 0; u <= 1000; u += 7) if (bandPoints(SWING_V16_BAND_CURVE, u) !== Math.floor((SWING_V16_CORE * u) / 1000)) straight = false;
  ok(straight, "the core pays in a straight line: 140 × the share of the course");
  const init = game.init(roomSeed(5));
  const total = init.sections!.length;
  const full: SwingState = { ...init, acted: 1, sec: total, secTicks: init.sections!.reduce((ts: number[], sec, k) => [...ts, (ts[k - 1] ?? 0) + Math.max(1, sec.par - SWING_V15_PAR_FULL)], []), bankGates: (1 << SWING_V15_GATES) - 1, bankGems: (1 << SWING_V15_GEMS) - 1, bankStars: Array.from({ length: SWING_V15_STARS }, (_, i) => i) };
  const parts = swingReworkParts(full);
  ok(parts.core === 140 && parts.par === 30 && parts.pickups === 30 && game.score(full) === 200, `a full run scores 200 (${parts.core} + ${parts.par} + ${parts.pickups})`);
  ok(game.score({ ...init, acted: 1 }) === 1 && game.score({ ...init }) === 0, "any input scores at least 1; none scores 0");
  for (const seed of seedsOf(FULL ? 8 : 3)) {
    const human = new Human("swing", seed, "weak");
    const res = randomBot({ game, seed, rev: SWING_REV_DARK, human });
    const byTick = new Map((res.events ?? []).map((e) => [e.t, e]));
    let r = game.init(seed);
    while (!game.isOver(r) && r.tick < game.runTicks) r = game.step(r, byTick.get(r.tick + 1) ?? null);
    const score = game.score(r);
    ok(score >= 1 && score <= 45, `random play on ${seed} scores 1 or more and stays low (${score})`);
  }
  const FIXTURE = "scripts/fixtures/swing-dark-runs.json";
  if (RECORD) {
    const runs: unknown[] = [];
    for (const seed of seedsOf(6)) {
      for (const level of [...ALL_LEVELS, "random"] as const) {
        const human = new Human("swing", seed, level === "random" ? "weak" : level);
        const ctx = { game, seed, rev: SWING_REV_DARK, human };
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
        const result = replaySwingRun(seed, raw, SWING_REV_DARK);
        runs.push({ level, seed, score: result.score, stateHash: fnv(JSON.stringify(result.state)), raw: gzipSync(raw).toString("base64") });
        console.log(`recorded ${level} ${seed}: ${result.score}`);
      }
    }
    writeFileSync(FIXTURE, JSON.stringify({ recorded: "swing-dark-check --record (the skill-band bots, scripts/arcade-skill-bands/bots/swingRework.ts, the dark through swingBotKit)", runs }));
  }
  ok(existsSync(FIXTURE), "the skill-band runs are recorded");
  const { runs } = JSON.parse(existsSync(FIXTURE) ? readFileSync(FIXTURE, "utf8") : '{"runs":[]}') as { runs: { level: string; seed: number; score: number; stateHash: number; raw: string }[] };
  const by = new Map<string, number[]>();
  for (const run of runs) {
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const result = replaySwingRun(run.seed, raw, SWING_REV_DARK);
    ok(!result.flagged && result.score === run.score && fnv(JSON.stringify(result.state)) === run.stateHash, `${run.level} ${run.seed}: replays ${result.score} (stored ${run.score})`);
    ok(result.score >= 1 && result.score <= 200, `${run.level} ${run.seed}: scores 1 or more and at most 200 (${result.score})`);
    by.set(run.level, [...(by.get(run.level) ?? []), result.score]);
  }
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.trunc(xs.length / 2)]!;
  const order = ALL_LEVELS.map((l) => [l, median(by.get(l) ?? [0])] as const);
  for (let i = 1; i < order.length; i++) {
    const [lo, a] = order[i - 1]!;
    const [hi, b] = order[i]!;
    ok(b > a, `the ${hi} median (${b}) is above the ${lo} median (${a})`);
  }
  for (const [lo, hi] of [["great", "near"], ["near", "elite"], ["elite", "perfect"]] as const) {
    const a = median(by.get(lo) ?? [0]);
    const b = median(by.get(hi) ?? [0]);
    ok(b - a >= 3, `a clear gap from ${lo} (${a}) to ${hi} (${b})`);
  }
  const bySeed = (level: string, seed: number) => runs.find((r) => r.level === level && r.seed === seed)?.score ?? -1;
  for (const seed of new Set(runs.map((r) => r.seed))) {
    ok(bySeed("perfect", seed) > bySeed("great", seed) && bySeed("great", seed) > bySeed("good", seed), `course ${seed}: flawless (${bySeed("perfect", seed)}) > great (${bySeed("great", seed)}) > good (${bySeed("good", seed)})`);
  }
  const avg = by.get("average") ?? [0];
  ok(Math.max(...avg) - Math.min(...avg) <= 45, `an ordinary (average) player's scores stay close across courses (${Math.min(...avg)}–${Math.max(...avg)})`);
  console.log(`scores by level (median of ${runs.length / 8} courses): ${order.map(([l, m]) => `${l} ${m}`).join(" · ")} · random ${median(by.get("random") ?? [0])}`);
}

/* 8. Display and text. */
{
  ok(swingWorldWFor(SWING_REV_DARK) === 450 && swingWorldHFor(SWING_REV_DARK) === 844, "rev 16 plays in rev 13's 450 × 844 view");
  // LIVE_BANDS follows the revision rooms deal: swingRev 17 since 3 Nov 2026 (swing-slide-check), on its own line.
  ok(LIVE_BANDS.swing.rev === SWING_REV_SLIDE && LIVE_BANDS.swing.curve === SWING_V17_BAND_CURVE && SWING_V16_BAND_CURVE.points[1] === 140, "the help's numbers come from the revision rooms deal (swingRev 17, after 16)");
  const help = PUZZLE_INSTRUCTIONS.swing!;
  const text = help.how.map((h) => `${h.action} ${h.detail}`).join(" ");
  // The jungle canopy (3 Nov 2026): ledges are tree platforms and the dark is the canopy's deep shade, the same rule.
  ok(/Platform runs are in deep shade/.test(text) && /lost in the canopy's shade, vines and all/.test(text) && /Land on a platform to light the next part/.test(text) && /Vines in the shade can't be grabbed/.test(text), "the help explains the dark ledge runs (the jungle's deep shade)");
  ok(/The run lasts 90 seconds/.test(text) && /6 short platform runs/.test(text) && /3 of them with a squeeze/.test(text), "the help says 90 seconds, six ledge (platform) runs and three squeezes");
  const intro = help.how.filter((h) => !h.helpOnly);
  ok(intro.length === 3 && intro.every((h) => `${h.action} ${h.detail}`.length <= 46) && help.goal.length <= 34, "the intro's goal and three lines fit");
  // (swingRev 17's parts since 3 Nov 2026: course 110 + par 40 + gates 10 + streak 40.)
  // Text pass (4 Nov 2026): the help is a list, one line a part, then the total; the intro is one plain sentence naming
  // the bonuses (the round's 90 seconds is the intro's time line).
  ok(hasScorePart(help.score, "Course", 110) && hasScorePart(help.score, "Pars", 40) && hasScorePart(help.score, "Gates", 10) && hasScorePart(help.score, "Clean-swing streak", 40) && help.score.endsWith("Total 200."), `the help's SCORE text states the parts totalling 200: "${help.score}"`);
  ok(/pars/.test(INTRO_SCORE.swing) && /gates/.test(INTRO_SCORE.swing) && /Up to 200/.test(INTRO_SCORE.swing), `the intro score line: "${INTRO_SCORE.swing}"`);
  const demo = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
  ok(/data\.type === "swing" && demo\?\.puzzle\.type === "swing" && demo\.puzzle\.swingRev !== SWING_REV_SLIDE\) return null/.test(demo), "Grappler's intro demo stays stopped until one is recorded on swingRev 17 (after 16)");
  const introSrc = readFileSync("src/components/duel/RoundIntro.tsx", "utf8");
  ok(/setTimeout\(\(\) => prepareSwingCourse\(seed, swingRev\)/.test(introSrc), "the round's intro builds the course ahead");
  const art = readFileSync("src/lib/arcade/swing.renderer.ts", "utf8");
  ok(/if \(state\.dark\) drawDark\(/.test(art) && /state\.dark && !swingHookLit\(state, i\)/.test(art) && /const from = swingDarkFrom\(state\)/.test(art), "the renderer draws the dark from the sim's own rule and skips the hooks in it");
  const sim = readFileSync("src/lib/arcade/swing.ts", "utf8");
  ok(/const lim = s\.dark \? swingDarkFrom\(state\) : SWING_NO_DARK;/.test(sim) && /rangeTarget\(s\.anchors, lo, hi, x, y, s\.dark \? swingDarkFrom\(s\) : SWING_NO_DARK\)/.test(sim), "the step and the bots' look-ahead read the same dark");
}

/* 9. Building a course stays quick. */
{
  const seed = roomSeed(9) ^ 0x2468ace;
  prepareSwingCourse(seed, SWING_REV_DARK);
  const t1 = performance.now();
  const s1 = game.init(seed);
  ok(performance.now() - t1 < 5 && s1.dark === 1, "after prepareSwingCourse the round's init takes under 5 ms");
  const t0 = performance.now();
  const seeds = seedsOf(30).slice(20);
  for (const s of seeds) game.init(s ^ 0x5a5a5a);
  const ms = (performance.now() - t0) / seeds.length;
  ok(ms < 600, `a course builds in ${ms.toFixed(0)} ms on average (under 600)`);
  console.log(`build: ${ms.toFixed(0)} ms a course`);
}

if (failures.length) {
  console.log(`\nFAIL: ${failures.length} of ${checks} checks failed:`);
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`\nPASS: ${checks} swingRev 16 checks (${((performance.now() - started) / 1000).toFixed(0)} s)`);
