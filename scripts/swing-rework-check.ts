/**
 * Grappler's swinging course (swingRev 15, 29 Oct 2026, docs/arcade-standard/swing.md): mostly hook-to-hook
 * swinging with fewer hooks than the old cave, short ledge runs and two squeezes mixed in, the dragon over the last
 * quarter only; scored 140 for the course + 30 for pars + 30 for gates, gems and stars.
 *
 *  1. Old rounds: runs on every earlier revision (no stamp, swingRev 2–14), recorded on unmodified main by
 *     scripts/swing-rework-legacy.ts (scripts/fixtures/swing-rework-legacy.json), replay through today's server path
 *     unflagged, to the same score, final state and result; their states carry no rework field.
 *  2. Dealing: rooms deal swingRev 15 (one above swingRev 14) on any seed; a course is its seed's alone.
 *  3. The course: on sampled seeds, SWING_V15_BLOCKS blocks (swinging stretches of 3–5 hooks, the ledge runs of
 *     SWING_V15_RUNS sections with two squeezes), about 80 % of its length swinging, hooks at least 140 px apart and
 *     under the roof, ledges between the roof and the lava, the stretches end to end, exactly SWING_V15_GATES /
 *     GEMS / STARS features, and the dragon's stretch the first in the last quarter.
 *  4. The witness: every course's own planned route (swingReworkPlan), played as input through the real sim from
 *     tick 0, clears every stretch, each SWING_V15_PAR_FULL or more under its par (so every par's whole share can be
 *     won), inside the minute, and every gate, gem and star is taken on its proved line, which still catches the next
 *     hook. A restart hanging from a swinging stretch's hook (a real miss) has a window of release ticks on to the next.
 *  5. Rules: a miss puts the hero back hanging from the last hook of the stretch held (on a ledge section, its start
 *     ledge), held still for the respawn hold, the clock running on, what was picked up since then put back (a
 *     swinging stretch banks at each new hook); grabbing the next stretch's first hook clears a stretch; only the stretch's hooks and the next one's first can be grabbed; the dragon appears as the
 *     hero starts the first stretch past three quarters of the course.
 *  6. Scores: the parts are 140 + 30 + 30 = 200 exactly (a full run's state scores 200; the core is a straight line
 *     on the course's share); no input scores 0; any input at least 1; random play low; the stored skill-band runs
 *     (scripts/fixtures/swing-rework-runs.json, `--record` to re-record) replay exactly, every played run scores 1 or
 *     more and at most 200, the medians rise weak < average < good < great < near-perfect < elite < flawless with
 *     clear gaps at the top, and each level's best run sits below the next level's median from great up.
 *  7. Display and text: world, reveal and effect sizes, the help, intro and SCORE text on the new rules (the parts
 *     totalling 200), the demo held to rev 15, the HUD.
 *  8. Building a course stays quick (it runs on the phone at the round's start).
 *
 * Since swingRev 16 (1 Nov 2026, the dark ledge runs over 90 s; swing-dark-check) this check deals swingRev 15 through
 * pinSwingPreDark, and its live-revision assertions (LIVE_BANDS, the intro demo's gate) moved to swing-dark-check.
 *
 *   bun scripts/swing-rework-check.ts          (CHECKS_FULL=1: more seeds in 3–4)
 *   bun scripts/swing-rework-check.ts --record (re-records the skill-band runs, about 20 minutes)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";
import {
  swingCheckpoint,
  swingGameFor,
  swingAssaultCounts,
  swingAssaultPar,
  swingReworkParts,
  swingReworkPlan,
  prepareSwingCourse,
  swingReworkProgress,
  swingWorldHFor,
  swingWorldWFor,
  swingRevealHFor,
  SWING_INPUT_HOLD,
  SWING_INPUT_REEL,
  SWING_REEL_UP,
  SWING_KIND_SWING,
  SWING_REV_ASSAULT,
  SWING_REV_REWORK,
  SWING_REV_DARK,
  SWING_V14_CHASE_BACKOFF,
  SWING_V14_CHASE_PACE,
  SWING_V14_RESPAWN,
  SWING_V15_BLOCKS,
  SWING_V15_CHASE_FROM,
  SWING_V15_CORE,
  SWING_V15_GATES,
  SWING_V15_GEMS,
  SWING_V15_MAX,
  SWING_V15_PAR_FULL,
  SWING_V15_PAR_POINTS,
  SWING_V15_PICKUP_POINTS,
  SWING_V15_RUNS,
  SWING_V15_SQUEEZES,
  SWING_V15_STARS,
  type SwingState,
} from "../src/lib/arcade/swing";
import { bandPoints } from "../src/lib/arcade/scoreBands";
import { SWING_V15_BAND_CURVE } from "../src/lib/arcade/swing";
import { swingFxFor, SWING_FX_V14 } from "../src/lib/arcade/arcadeFxGames.renderer";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { generateSwing, pinSwingPreDark } from "../src/lib/duel/arcade.server";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { roundMaxFor } from "../src/lib/duel/roundMax";
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
// Rooms deal swingRev 16 since 1 Nov 2026 (swing-dark-check); this check proves swingRev 15 as dealt before it.
pinSwingPreDark(true);
const game = swingGameFor(SWING_REV_REWORK);
type Ev = { k: number; a: number; b: number; c: number; d: number };
const hold = (a: number): Ev => ({ k: SWING_INPUT_HOLD, a, b: 0, c: 0, d: 0 });
const reel: Ev = { k: SWING_INPUT_REEL, a: SWING_REEL_UP, b: 0, c: 0, d: 0 };
const step = (s: SwingState, ev: Ev | null) => game.step(s, ev ? { ...ev, t: s.tick + 1 } : null) as SwingState;
const seedsOf = (n: number) => Array.from({ length: n }, (_, i) => roomSeed(i));
const lerp = (arr: number[], x: number) => {
  const i = Math.max(0, Math.min(arr.length - 2, Math.trunc(x / (40 * FP))));
  return arr[i]! + Math.trunc(((arr[i + 1]! - arr[i]!) * (x - i * 40 * FP)) / (40 * FP));
};

/* 1. Old rounds replay exactly. */
ok(existsSync("scripts/fixtures/swing-rework-legacy.json"), "the legacy fixture is there");
if (existsSync("scripts/fixtures/swing-rework-legacy.json")) {
  const { recorded, runs } = JSON.parse(readFileSync("scripts/fixtures/swing-rework-legacy.json", "utf8")) as { recorded: string; runs: { rev: number | null; style: string; seed: number; score: number; flagged: boolean; stateHash: number; extra: number; raw: string }[] };
  let same = 0;
  const revs = new Set<number | null>();
  for (const run of runs) {
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const result = replaySwingRun(run.seed, raw, run.rev ?? undefined);
    const identical = result.score === run.score && Boolean(result.flagged) === run.flagged && !result.flagged && fnv(JSON.stringify(result.state)) === run.stateHash && fnv(JSON.stringify({ ...result, state: undefined, checkpoints: undefined })) === run.extra;
    ok(identical, `rev ${run.rev ?? "-"} ${run.style} ${run.seed}: replays ${result.score}${result.flagged ? " flagged" : ""} (stored ${run.score})`);
    ok(result.state.rework === undefined && result.state.chaseFrom === undefined, `rev ${run.rev ?? "-"} ${run.style}: no rework field on an older round`);
    if (identical) same++;
    revs.add(run.rev);
  }
  ok(revs.size === 13 && revs.has(SWING_REV_ASSAULT) && runs.filter((r) => r.rev === SWING_REV_ASSAULT).length >= 12, `the legacy fixture covers every earlier revision, swingRev 14 on three courses (${revs.size} of 13)`);
  console.log(`old rounds: ${same} / ${runs.length} runs recorded on ${recorded} replay to the same score, state and result`);
}

/* 2. Dealing and identity. */
{
  for (let k = 0; k < 12; k++) {
    const p = generateSwing();
    ok(p.type === "swing" && p.swingRev === SWING_REV_REWORK && Number.isInteger(p.seed), `rooms deal swingRev 15 (got ${p.swingRev})`);
  }
  ok(SWING_REV_REWORK === SWING_REV_ASSAULT + 1, "the swinging course's stamp is one above swingRev 14");
  const seed = roomSeed(4);
  const a = JSON.stringify(game.init(seed));
  for (const other of seedsOf(24).slice(5)) game.init(other);
  ok(JSON.stringify(game.init(seed)) === a, "a course is its seed's alone (built again from an empty cache, it is the same)");
  ok(JSON.stringify(swingGameFor(SWING_REV_REWORK).init(seed)) === a, "the same game object builds the same course");
}

/* 3. The course. */
const courseSeeds = seedsOf(FULL ? 40 : 8);
let swingShareMin = 1;
let swingShareMax = 0;
for (const seed of courseSeeds) {
  const s = game.init(seed);
  const secs = s.sections!;
  const tag = `course ${seed}`;
  const swings = secs.filter((k) => k.kind === SWING_KIND_SWING);
  const runSections = SWING_V15_RUNS.reduce((a, b) => a + b, 0);
  ok(swings.length === SWING_V15_BLOCKS - SWING_V15_RUNS.length && secs.length === swings.length + runSections, `${tag}: ${swings.length} swinging stretches and ${secs.length - swings.length} ledge sections`);
  ok((s.squeezes ?? []).length === SWING_V15_SQUEEZES && secs.filter((k) => k.kind === 2).length === SWING_V15_SQUEEZES, `${tag}: two squeezes`);
  let swingLen = 0;
  let length = 0;
  secs.forEach((sec, k) => {
    ok(sec.x1! > sec.x0! && (k === 0 || sec.x0 === secs[k - 1]!.x1), `${tag} stretch ${k}: runs on from the one before`);
    ok(sec.par > 0, `${tag} stretch ${k}: a par`);
    length += sec.x1! - sec.x0!;
    if (sec.kind === SWING_KIND_SWING) {
      swingLen += sec.x1! - sec.x0!;
      const own = sec.hooks + ((sec.to ?? -1) < 0 ? 1 : 0);
      ok(sec.hooks >= 2 && sec.hooks <= 5 && own >= 3, `${tag} stretch ${k}: ${sec.hooks} hooks of its own`);
      for (let i = sec.hook0; i < sec.hook0 + sec.hooks; i++) {
        const h = s.anchors[i]!;
        const below = i === sec.hook0 && (sec.from ?? -1) >= 0 ? s.ledges![sec.from!]!.top : 440 * FP;
        ok(h.y > lerp(s.ceil, h.x) + 40 * FP && h.y < below, `${tag} stretch ${k}: hook ${i} under the roof, well above the lava (and above its start ledge)`);
        if (i > sec.hook0 || (sec.from ?? -1) < 0) {
          const next = s.anchors[i + 1];
          if (next && i + 1 <= sec.hook0 + sec.hooks) ok(next.x - h.x >= 140 * FP, `${tag} stretch ${k}: hooks ${i} and ${i + 1} ${(next.x - h.x) / FP} px apart (140 or more: fewer hooks)`);
        }
      }
    } else {
      ok(sec.hooks === (sec.kind === 0 ? 1 : 2) && (sec.kind === 2) === (sec.sq >= 0) && (sec.from ?? -1) >= 0 && (sec.to ?? -1) >= 0, `${tag} stretch ${k}: a ledge section of kind ${sec.kind}`);
    }
  });
  const share = swingLen / length;
  swingShareMin = Math.min(swingShareMin, share);
  swingShareMax = Math.max(swingShareMax, share);
  ok(share >= 0.72 && share <= 0.88, `${tag}: ${(share * 100).toFixed(0)} % of the course is swinging (about 80 %)`);
  s.ledges!.forEach((l, i) => ok(l.top > lerp(s.ceil, l.x) + 200 * FP && l.top < lerp(s.floor, l.x) - 120 * FP, `${tag} ledge ${i}: between the roof and the lava`));
  const c = swingAssaultCounts(s);
  ok(c.gateTotal === SWING_V15_GATES && c.gemTotal === SWING_V15_GEMS && c.starTotal === SWING_V15_STARS, `${tag}: ${c.gateTotal}/${c.gemTotal}/${c.starTotal} gates, gems and stars`);
  const k = s.chaseFrom!;
  const x0 = secs[0]!.x0!;
  ok(k > 0 && k < secs.length && 1000 * (secs[k]!.x0! - x0) >= SWING_V15_CHASE_FROM * length && 1000 * (secs[k - 1]!.x0! - x0) < SWING_V15_CHASE_FROM * length, `${tag}: the dragon's stretch (${k}) is the first in the last quarter`);
}
console.log(`courses: ${courseSeeds.length} built, ${(swingShareMin * 100).toFixed(0)}–${(swingShareMax * 100).toFixed(0)} % of each swinging`);

/* 4. The witness, the features and the restart, in the real sim. */
/**
 * Plays a course's planned route from tick 0; the snapshot (state before, and the event on) each step's start tick.
 * The planned route is a steady line, not a fast one, and can run past the minute: where it would, the clock is moved
 * back (every tick the state holds, by SHIFT) so each stretch is still played and timed in the real sim.
 */
const SHIFT = 1800;
const shifted = (s: SwingState): SwingState => ({ ...s, tick: s.tick - SHIFT, grabTick: s.grabTick - SHIFT, secStart: (s.secStart ?? 0) - SHIFT, missTick: (s.missTick ?? 0) - SHIFT, secTicks: s.secTicks!.map((t) => (t > 0 ? t - SHIFT : t)) });
function witness(seed: number) {
  const plan = swingReworkPlan(seed);
  let s = game.init(seed);
  const starts = new Map<string, { before: SwingState; ev: Ev | null; at: number }>();
  let k = 0;
  let j = 0;
  let G = 1;
  let startEv: Ev | null = null;
  let release = -1;
  let press = -1;
  let mode: "rope" | "fly" | "land" | "ledge" = "rope";
  let moved = 0;
  /** Each stretch's time (the sim's, from its start to its clear), kept across the clock moves. */
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
    const steps = plan.sections[k];
    if (!steps) break;
    if (mode === "ledge" && (s.ledgeOn ?? -1) >= 0 && s.x === s.ledges![s.ledgeOn!]!.x && (s.respawn ?? 0) === 0) {
      ev = hold(1);
      G = t;
      j = 0;
      mode = "rope";
      starts.set(`${k}:0`, { before: s, ev, at: t });
    } else if (mode === "rope" && t === G + steps[j]![0]) {
      ev = hold(0);
      release = t;
      mode = steps[j]![1] < 0 ? "land" : "fly";
      press = steps[j]![1] < 0 ? -1 : release + steps[j]![1];
    } else if (mode === "fly" && t === press) {
      ev = hold(1);
      G = t;
      startEv = ev;
    }
    const before = s;
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
      // Cleared by a landing: the next stretch starts on that ledge.
      k = s.sec!;
      j = 0;
      mode = "ledge";
    }
    if ((s.sec ?? 0) > times.length) {
      times.push(s.tick - since);
      since = s.tick;
    }
  }
  return { plan, final: s, starts, times, total: s.tick + moved };
}

/**
 * A grab worth having, in the real sim: from the state just after it, the rope's first forward pass (no input) stays
 * clear of a miss for 16 ticks or more and rises ahead of its hook for 6 or more (the build's v15Good, tick by tick).
 */
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
const playSeeds = courseSeeds.slice(0, FULL ? 16 : 4);
let worstBeat = Infinity;
let featuresProved = 0;
for (const seed of playSeeds) {
  const tag = `course ${seed}`;
  const { plan, final, starts, times, total: ticks } = witness(seed);
  const total = final.sections!.length;
  ok((final.restarts ?? 0) === 0 && final.sec === total && times.length === total, `${tag}: the witness clears all ${total} stretches without a miss (its steady line in ${(ticks / 60).toFixed(1)} s)`);
  for (let k = 0; k < total; k++) {
    const par = final.sections![k]!.par;
    const beat = par - (times[k] ?? Infinity);
    worstBeat = Math.min(worstBeat, beat);
    ok(beat >= SWING_V15_PAR_FULL, `${tag} stretch ${k}: the witness beats its par (${par}) by ${beat} ticks (the full share needs ${SWING_V15_PAR_FULL})`);
  }
  ok(swingReworkParts(final).core === SWING_V15_CORE, `${tag}: the witness earns the whole core`);
  // Each gate, gem and star on its proved line: from the step's start, the line takes it and then catches the next hook.
  for (const f of plan.features) {
    const start = starts.get(`${f.sec}:${f.step}`);
    const sec = final.sections![f.sec]!;
    const next = sec.hook0 + f.step + 1;
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
    // The line's grab: the first press that takes the next hook with a good swing after it (the proof's own rule).
    let caught: SwingState | null = null;
    for (let g = 1; g <= 60 && !caught; g++) {
      const on = step(s, hold(1));
      if (on.rope === next && (on.restarts ?? 0) === 0 && goodSwing(on)) caught = on;
      s = step(s, null);
      if ((s.restarts ?? 0) > 0) break;
    }
    const taken = caught && (f.kind === "gate" ? ((caught.gatesLit ?? 0) & (1 << f.index)) !== 0 : f.kind === "gem" ? ((caught.gemsTaken ?? 0) & (1 << f.index)) !== 0 : (caught.starsTaken ?? []).includes(f.index));
    ok(Boolean(taken), `${tag}: ${f.kind} ${f.index} is taken on its proved line (stretch ${f.sec}, step ${f.step}${f.reel >= 0 ? ", reeled in" : ""}), which then catches hook ${next}`);
    if (taken) featuresProved++;
  }
  // A real miss on a swinging stretch that starts on a hook: back hanging from that hook; a release then reaches the next hook.
  const hookStarts = final.sections!.map((sec, k) => ({ sec, k })).filter(({ sec, k }) => k > 0 && sec.kind === SWING_KIND_SWING && (sec.from ?? -1) < 0);
  for (const { sec, k } of hookStarts.slice(0, FULL ? hookStarts.length : 3)) {
    const start = starts.get(`${k}:0`);
    if (!start) continue;
    let s = step(start.before, start.ev);
    s = step(s, hold(0));
    for (let i = 0; i < 400 && (s.restarts ?? 0) === 0; i++) s = step(s, null);
    const h = s.anchors[sec.hook0]!;
    ok(s.restarts === 1 && s.sec === k && s.rope === sec.hook0 && s.respawn === SWING_V14_RESPAWN && Math.abs(s.x - (h.x - 87 * FP)) < 2 * FP, `${tag} stretch ${k}: a miss just after its first hook puts the hero back hanging from it, held`);
    let held = s;
    for (let i = 0; i < SWING_V14_RESPAWN; i++) held = step(held, i === 3 ? hold(0) : null);
    ok(held.rope === sec.hook0 && held.x === s.x && held.y === s.y, `${tag} stretch ${k}: still for the respawn hold (inputs wait)`);
    let window = 0;
    let rope = held;
    for (let r = 1; r <= 150 && window < 4; r++) {
      let f = step(rope, hold(0));
      if (f.vx > 0) {
        for (let g = 1; g <= 60; g++) {
          if (step(f, hold(1)).rope === sec.hook0 + 1) {
            window += 1;
            break;
          }
          f = step(f, null);
          if ((f.restarts ?? 0) > 1) break;
        }
      }
      rope = step(rope, null);
      if ((rope.restarts ?? 0) > 1) break;
    }
    ok(window >= 4, `${tag} stretch ${k}: from the restart's hang four or more release ticks reach the next hook (${window})`);
  }
}
console.log(`witness: ${playSeeds.length} courses cleared by their own planned route (every stretch ${worstBeat} or more ticks under par), ${featuresProved} gates, gems and stars taken on their lines`);

/* 5. Rules. */
{
  const seed = roomSeed(1);
  const init = game.init(seed);
  ok(init.rework === 1 && init.assault === 1 && init.sec === 0 && init.rope === 0 && (init.ledgeOn ?? -1) < 0, "the course starts hanging from its first hook");
  // Letting go at once drops the hero into the lava: back hanging from the first hook, the run going on.
  let s = step(init, hold(0));
  let missAt = 0;
  for (let t = 2; t <= 400 && !missAt; t++) {
    s = step(s, null);
    if ((s.restarts ?? 0) === 1) missAt = t;
  }
  ok(missAt > 0 && s.sec === 0 && s.rope === 0 && s.ended === 0 && s.missTick === missAt && s.respawn === SWING_V14_RESPAWN, `a miss before any other hook puts the hero back on the stretch's first hook (restart at tick ${missAt}), the run going on`);
  // After the witness grabs the stretch's second hook, a miss puts the hero back on that one, and what was banked there stays.
  {
    const w1 = witness(seed);
    const start = w1.starts.get("0:1");
    if (!start) ok(false, "the witness grabs the first stretch's second hook");
    else {
      let t = step(start.before, start.ev);
      t = { ...t, gemsTaken: 0b1, bankGems: 0b1 };
      t = step(t, hold(0));
      for (let i = 0; i < 400 && (t.restarts ?? 0) === 0; i++) t = step(t, null);
      ok(t.restarts === 1 && t.rope === init.sections![0]!.hook0 + 1 && t.hangHook === t.rope && t.sec === 0 && t.gemsTaken === 0b1, "a miss after the stretch's second hook puts the hero back hanging from that hook (its banked pickups kept)");
    }
  }
  // The attempt's pickups go back on a miss (only cleared stretches bank them).
  const taken = { ...s, respawn: 0, gemsTaken: 0b101, gatesLit: 0b10, starsTaken: [1], stars: 1, bankGems: 0b100, bankGates: 0, bankStars: [] as number[], rope: -1, y: 830 * FP, vy: 3 * FP };
  const missed = step(taken, null);
  ok(missed.restarts === 2 && missed.gemsTaken === 0b100 && missed.gatesLit === 0 && (missed.starsTaken ?? []).length === 0 && missed.stars === 0, "a miss puts the attempt's pickups back (the banked ones stay)");
  // Only the stretch's hooks and the next stretch's first can be grabbed: next to a hook two stretches on, a press grabs nothing.
  const secs = init.sections!;
  const far = secs.findIndex((sec, k) => k >= 2 && sec.kind === SWING_KIND_SWING);
  const h = init.anchors[secs[far]!.hook0 + 1]!;
  const near = { ...init, x: h.x - 30 * FP, y: h.y + 90 * FP, vx: 0, vy: 0, rope: -1 };
  ok(step(near, hold(1)).rope < 0, "a hook beyond the next stretch's first cannot be grabbed");
  // Grabbing the next stretch's first hook clears the stretch.
  const w = witness(seed);
  ok(w.final.secTicks![0]! > 0 && secs[1]!.kind === SWING_KIND_SWING && (secs[1]!.from ?? -1) < 0 ? w.starts.has("1:0") : true, "grabbing the next stretch's first hook clears the stretch");
  // The dragon: absent until the hero starts stretch chaseFrom, then at rev 14's pace; a catch is a restart, held off behind.
  const kd = init.chaseFrom!;
  const pre = { ...init, sec: kd - 1 };
  const at = { ...init, sec: kd };
  ok((step(pre, null).chaseX ?? 0) === 0 && (step(at, null).chaseX ?? 0) !== 0, `the dragon appears as stretch ${kd + 1} starts (the last quarter), not before`);
  const flying = step(at, null);
  ok(step(flying, null).chaseX! - flying.chaseX! === SWING_V14_CHASE_PACE, "it flies at rev 14's pace");
  const close = { ...flying, chaseX: flying.x - 40 * FP };
  const caught = step(close, null);
  ok(caught.restarts === 1 && caught.caught === 1 && caught.ended === 0 && caught.chaseX! <= caught.x - SWING_V14_CHASE_BACKOFF + 2 * FP, "a catch is a restart (the run goes on), the dragon held off behind");
}

/* 6. Scores. */
{
  ok(SWING_V15_CORE + SWING_V15_PAR_POINTS + SWING_V15_PICKUP_POINTS * (SWING_V15_GATES + SWING_V15_GEMS + SWING_V15_STARS) === SWING_V15_MAX && SWING_V15_MAX === 200 && roundMaxFor("swing") === 200, "the parts are 140 + 30 + 30 = 200 exactly");
  ok(SWING_V15_PICKUP_POINTS * SWING_V15_GATES === SWING_V15_PICKUP_POINTS * SWING_V15_GEMS && SWING_V15_GEMS === SWING_V15_STARS && SWING_V15_PICKUP_POINTS * SWING_V15_GATES === 10, "gates, gems and stars split the 30 evenly (10 each)");
  // The core is a straight line on the course's share.
  let straight = true;
  for (let u = 0; u <= 1000; u += 7) if (bandPoints(SWING_V15_BAND_CURVE, u) !== Math.floor((SWING_V15_CORE * u) / 1000)) straight = false;
  ok(straight, "the core pays in a straight line: 140 × the share of the course");
  // A full run's state: every stretch cleared well under par, every pickup banked.
  const init = game.init(roomSeed(5));
  const total = init.sections!.length;
  const full: SwingState = { ...init, acted: 1, sec: total, secTicks: init.sections!.reduce((ts: number[], sec, k) => [...ts, (ts[k - 1] ?? 0) + Math.max(1, sec.par - SWING_V15_PAR_FULL)], []), bankGates: (1 << SWING_V15_GATES) - 1, bankGems: (1 << SWING_V15_GEMS) - 1, bankStars: Array.from({ length: SWING_V15_STARS }, (_, i) => i) };
  const parts = swingReworkParts(full);
  ok(parts.core === 140 && parts.par === 30 && parts.pickups === 30 && game.score(full) === 200, `a full run scores 200 (${parts.core} + ${parts.par} + ${parts.pickups})`);
  const slow = init.sections!.reduce((ts: number[], sec, k) => [...ts, (ts[k - 1] ?? 0) + sec.par + 1], []);
  ok(game.score({ ...full, bankGates: 0 }) === 190 && game.score({ ...full, secTicks: slow }) === 170, "each part counts on its own (no gates: 190; every stretch over par: 170)");
  const half = { ...init, acted: 1, sec: Math.trunc(total / 2) };
  const p = swingReworkProgress(half);
  ok(swingReworkParts(half).core === Math.floor((140 * p.permille) / 1000), "half the course pays its share of the core");
  ok(game.score({ ...init, acted: 1 }) === 1 && game.score({ ...init }) === 0, "any input scores at least 1; none scores 0");
  const idle = game.init(roomSeed(2));
  let s = idle;
  while (!game.isOver(s)) s = step(s, null);
  ok(game.score(s) === 0 && s.tick === game.runTicks, "no input scores 0 (and the run lasts the minute)");
  for (const seed of seedsOf(FULL ? 12 : 4)) {
    const human = new Human("swing", seed, "weak");
    const res = randomBot({ game, seed, rev: SWING_REV_REWORK, human });
    const byTick = new Map((res.events ?? []).map((e) => [e.t, e]));
    let r = game.init(seed);
    while (!game.isOver(r) && r.tick < game.runTicks) r = game.step(r, byTick.get(r.tick + 1) ?? null);
    const score = game.score(r);
    ok(score >= 1 && score <= 45, `random play on ${seed} scores 1 or more and stays low (${score})`);
  }
  const FIXTURE = "scripts/fixtures/swing-rework-runs.json";
  if (RECORD) {
    const runs: unknown[] = [];
    for (const seed of seedsOf(6)) {
      for (const level of [...ALL_LEVELS, "random"] as const) {
        const human = new Human("swing", seed, level === "random" ? "weak" : level);
        const ctx = { game, seed, rev: SWING_REV_REWORK, human };
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
        const result = replaySwingRun(seed, raw, SWING_REV_REWORK);
        runs.push({ level, seed, score: result.score, stateHash: fnv(JSON.stringify(result.state)), raw: gzipSync(raw).toString("base64") });
        console.log(`recorded ${level} ${seed}: ${result.score}`);
      }
    }
    writeFileSync(FIXTURE, JSON.stringify({ recorded: "swing-rework-check --record (the skill-band bots, scripts/arcade-skill-bands/bots/swingRework.ts)", runs }));
  }
  ok(existsSync(FIXTURE), "the skill-band runs are recorded");
  const { runs } = JSON.parse(existsSync(FIXTURE) ? readFileSync(FIXTURE, "utf8") : '{"runs":[]}') as { runs: { level: string; seed: number; score: number; stateHash: number; raw: string }[] };
  const by = new Map<string, number[]>();
  for (const run of runs) {
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const result = replaySwingRun(run.seed, raw, SWING_REV_REWORK);
    ok(!result.flagged && result.score === run.score && fnv(JSON.stringify(result.state)) === run.stateHash, `${run.level} ${run.seed}: replays ${result.score} (stored ${run.score})`);
    ok(result.score >= 1 && result.score <= roundMaxFor("swing"), `${run.level} ${run.seed}: scores 1 or more and at most ${roundMaxFor("swing")} (${result.score})`);
    by.set(run.level, [...(by.get(run.level) ?? []), result.score]);
  }
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.trunc(xs.length / 2)]!;
  const order = ALL_LEVELS.map((l) => [l, median(by.get(l) ?? [0])] as const);
  for (let i = 1; i < order.length; i++) {
    const [lo, a] = order[i - 1]!;
    const [hi, b] = order[i]!;
    ok(b > a, `the ${hi} median (${b}) is above the ${lo} median (${a})`);
  }
  // Clear gaps at the top: great → near-perfect → elite → flawless each at least 3 apart.
  for (const [lo, hi] of [["great", "near"], ["near", "elite"], ["elite", "perfect"]] as const) {
    const a = median(by.get(lo) ?? [0]);
    const b = median(by.get(hi) ?? [0]);
    ok(b - a >= 3, `a clear gap from ${lo} (${a}) to ${hi} (${b})`);
  }
  // A brilliant run beats a great run, which beats a good run: on every course, flawless > great > good.
  const bySeed = (level: string, seed: number) => runs.find((r) => r.level === level && r.seed === seed)?.score ?? -1;
  for (const seed of new Set(runs.map((r) => r.seed))) {
    ok(bySeed("perfect", seed) > bySeed("great", seed) && bySeed("great", seed) > bySeed("good", seed), `course ${seed}: flawless (${bySeed("perfect", seed)}) > great (${bySeed("great", seed)}) > good (${bySeed("good", seed)})`);
  }
  const avg = by.get("average") ?? [0];
  ok(Math.max(...avg) - Math.min(...avg) <= 45, `an ordinary (average) player's scores stay close across courses (${Math.min(...avg)}–${Math.max(...avg)})`);
  console.log(`scores by level (median of ${runs.length / 8} courses): ${order.map(([l, m]) => `${l} ${m}`).join(" · ")} · random ${median(by.get("random") ?? [0])}`);
}

/* 7. Display and text. */
{
  ok(swingWorldWFor(SWING_REV_REWORK) === 450 && swingWorldHFor(SWING_REV_REWORK) === 844 && swingRevealHFor(SWING_REV_REWORK) === 731, "rev 15 plays in rev 13's 450 × 844 view (its reveal in the 390-wide box)");
  ok(swingFxFor({ assault: 1, rework: 1 } as SwingState) === SWING_FX_V14, "rev-15 effects use rev 14's spec (its gates, gems, stars, clears and restarts)");
  // LIVE_BANDS follows the revision rooms deal: swingRev 16 since 1 Nov 2026 (swing-dark-check proves it), on rev 15's straight line.
  ok(LIVE_BANDS.swing.rev === SWING_REV_REWORK + 1 && LIVE_BANDS.swing.curve.units.every((u, i) => bandPoints(SWING_V15_BAND_CURVE, u) === LIVE_BANDS.swing.curve.points[i]), "the help's numbers come from the revision rooms deal (rev 16, on rev 15's straight line)");
  const help = PUZZLE_INSTRUCTIONS.swing!;
  const text = help.how.map((h) => `${h.action} ${h.detail}`).join(" ");
  ok(/swinging/i.test(text) && /fewer hooks/.test(text) && /ledge runs/.test(text) && /Squeezes/.test(text) && /far hook/.test(text) && /back hanging from the last hook you held/.test(text) && /Par times/.test(text) && /gates/i.test(text) && /Gems/.test(text) && /stars/i.test(text) && /last quarter a dragon/.test(text) && /same course/.test(text), "the help explains the swinging, fewer hooks, ledge runs, squeezes, restarts, par times, gates, gems, stars and the dragon's last quarter");
  const intro = help.how.filter((h) => !h.helpOnly);
  ok(intro.length === 3 && intro.every((h) => `${h.action} ${h.detail}`.length <= 46) && help.goal.length <= 34, "the intro's goal and three lines fit");
  ok(/course 140 \+ par 30 \+ gates, gems and stars 30 = 200/.test(help.score) && /Up to 200/.test(help.score) && /under par/.test(help.score) && /gate, gem and star/.test(help.score) && /adds nothing more/.test(help.score), `the help's SCORE text states the parts totalling 200: "${help.score}"`);
  ok(/140/.test(INTRO_SCORE.swing) && /pars \(30\)/.test(INTRO_SCORE.swing) && /gems/.test(INTRO_SCORE.swing) && /up to (\{max\}|200)/.test(INTRO_SCORE.swing), `the intro score line: "${INTRO_SCORE.swing}"`);
  // The intro demo's gate moved to swing-dark-check (only a demo recorded on swingRev 16 plays, so none on swingRev 15).
  const demo = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
  ok(/data\.type === "swing" && demo\?\.puzzle\.type === "swing" && demo\.puzzle\.swingRev !== SWING_REV_DARK\) return null/.test(demo), "Grappler's intro demo stays stopped (a swingRev 15 one too) until one is recorded on swingRev 16");
  const introSrc = readFileSync("src/components/duel/RoundIntro.tsx", "utf8");
  ok(/puzzle\?\.type !== "swing"\) return;[\s\S]{0,200}setTimeout\(\(\) => prepareSwingCourse\(seed, swingRev\)/.test(introSrc), "the round's intro builds the course ahead (the round's own init is a cache hit)");
  {
    const seed = roomSeed(9) ^ 0x2468ace;
    prepareSwingCourse(seed, SWING_REV_REWORK);
    const t0 = performance.now();
    const s0 = game.init(seed);
    ok(performance.now() - t0 < 5 && s0.rework === 1, "after prepareSwingCourse the round's init takes under 5 ms");
  }
  const art = readFileSync("src/lib/arcade/swing.renderer.ts", "utf8");
  ok(/STRETCH \$\{/.test(art) && /PAR \$\{/.test(art) && /state\.assault && !state\.rework \? assaultLimit/.test(art), "the HUD shows the stretch count and par; the swinging course has no veil");
  const s = game.init(roomSeed(3));
  ok(swingAssaultPar(s, 0).time === -1, "an uncleared stretch has no time");
}

/* 8. Building a course stays quick. */
{
  const t0 = performance.now();
  const seeds = seedsOf(30).slice(20);
  for (const seed of seeds) game.init(seed ^ 0x5a5a5a);
  const ms = (performance.now() - t0) / seeds.length;
  ok(ms < 400, `a course builds in ${ms.toFixed(0)} ms on average (under 400)`);
  console.log(`build: ${ms.toFixed(0)} ms a course`);
}

if (failures.length) {
  console.log(`\nFAIL: ${failures.length} of ${checks} checks failed:`);
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`\nPASS: ${checks} swingRev 15 checks (${((performance.now() - started) / 1000).toFixed(0)} s)`);
