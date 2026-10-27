/**
 * Grappler's assault course (swingRev 14, 27 Oct 2026, docs/grappler-assault-oct-2026.md): sections of a start
 * ledge, one or two hooks and a landing ledge; two squeezes a course; a miss restarts the section; the dragon 40 %
 * slower; gates on the flight line, gems and stars on harder lines; a par per section; scored to 200.
 *
 *  1. Old rounds: runs on every earlier revision (no stamp, swingRev 2–13), recorded on unmodified main by
 *     scripts/swing-assault-legacy.ts (scripts/fixtures/swing-assault-legacy.json), replay through today's server
 *     path unflagged, to the same score, final state and result; their states carry no assault field.
 *  2. Dealing: rooms deal swingRev 14 (one above swingRev 13) on any seed; a course is its seed's alone (built twice,
 *     the cache emptied between, it is the same), so every player in a room plays the same one.
 *  3. The course: on sampled seeds, SWING_V14_SECTIONS sections, two squeezes, one or two hooks as the kind says,
 *     every hook under the roof and out of the squeeze's rock, every ledge between the roof and the lava and its
 *     landing ledge 170–400 px on, SWING_V14_GATES / GEMS / STARS features (one short on at most a few seeds).
 *  4. Every section played in the real sim: from the hero standing on its start ledge, a search of presses and
 *     releases (and the far hook's grab) clears it; its fastest beats par by SWING_V14_PAR_FULL or more, so every
 *     par's whole share can be won.
 *  5. Every gate, gem and star sits on a line that clears its section (a star's with the rope reeled in).
 *  6. Rules: a miss puts the hero back on the start ledge for the respawn hold (presses ignored), the clock runs on,
 *     the attempt's pickups go back; the dragon appears as section SWING_V14_CHASE_FROM starts, flies at 60 % of
 *     swingRev 4–13's pace, and a catch is a restart that holds it SWING_V14_CHASE_BACKOFF behind.
 *  7. Scores: no input 0; random play above 0 on every seed; never above 200; the stored skill-band runs
 *     (scripts/fixtures/swing-assault-runs.json, `--record` to re-record) replay exactly, every played run scores
 *     above 0, and the medians rise weak < average < good < great < near-perfect < elite ≤ flawless.
 *  8. Display and text: world, reveal and effect sizes, the help and intro on the new rules, the demo held to rev 14.
 *  9. Building a course stays quick (it runs on the phone at the round's start).
 *
 *   bun scripts/swing-assault-check.ts          (CHECKS_FULL=1: more seeds in 3–5)
 *   bun scripts/swing-assault-check.ts --record (re-records the skill-band runs, a few minutes)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";
import {
  swingCheckpoint,
  swingGameFor,
  swingInSqueeze,
  swingAssaultCounts,
  swingAssaultPar,
  swingWorldHFor,
  swingWorldWFor,
  swingRevealHFor,
  SWING_CHASE_PACE,
  SWING_INPUT_HOLD,
  SWING_INPUT_REEL,
  SWING_REEL_UP,
  SWING_REV_EXPAND,
  SWING_REV_ASSAULT,
  SWING_V14_CHASE_BACKOFF,
  SWING_V14_CHASE_FROM,
  SWING_V14_CHASE_PACE,
  SWING_V14_GATES,
  SWING_V14_GEMS,
  SWING_V14_PAR_FULL,
  SWING_V14_RESPAWN,
  SWING_V14_SECTIONS,
  SWING_V14_SQUEEZES,
  SWING_V14_STARS,
  type SwingState,
} from "../src/lib/arcade/swing";
import { swingFxFor, SWING_FX_V14 } from "../src/lib/arcade/arcadeFxGames.renderer";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { generateSwing } from "../src/lib/duel/arcade.server";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { encodeSwingRun, replaySwingRun } from "../src/lib/duel/swing";
import { roomSeed } from "./arcade-skill-bands/games";
import { Human, ALL_LEVELS } from "./arcade-skill-bands/human";
import { bot, randomBot } from "./arcade-skill-bands/bots/swing";

const FP = 256;
const RADIUS = 10 * FP;
const FULL = process.env.CHECKS_FULL === "1" || process.argv.includes("--full");
const RECORD = process.argv.includes("--record");
const failures: string[] = [];
let checks = 0;
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};
const started = performance.now();
const game = swingGameFor(SWING_REV_ASSAULT);
type Ev = { k: number; a: number; b: number; c: number; d: number };
const hold = (a: number): Ev => ({ k: SWING_INPUT_HOLD, a, b: 0, c: 0, d: 0 });
const reel: Ev = { k: SWING_INPUT_REEL, a: SWING_REEL_UP, b: 0, c: 0, d: 0 };
const step = (s: SwingState, ev: Ev | null) => game.step(s, ev ? { ...ev, t: s.tick + 1 } : null) as SwingState;
/** Plays from `from` with events at offsets until section `sec0` is cleared or missed: [cleared, ticks, state]. */
const play = (from: SwingState, events: Map<number, Ev>, max = 220): [boolean, number, SwingState] => {
  const sec = from.sec ?? 0;
  let s = from;
  for (let i = 1; i <= max; i++) {
    s = step(s, events.get(i) ?? null);
    if ((s.sec ?? 0) > sec) return [true, i, s];
    if ((s.restarts ?? 0) > (from.restarts ?? 0) || game.isOver(s)) return [false, i, s];
  }
  return [false, max, s];
};
/** The hero standing at section k's start ledge centre, the section just started (the state a landing leaves, walk done). */
const standingAt = (init: SwingState, k: number): SwingState => {
  const l = init.ledges![k]!;
  return { ...init, sec: k, secStart: 0, ledgeOn: k, x: l.x, y: l.top - RADIUS, maxX: l.x, secReach: l.x, camX: l.x - 70 * FP, chaseX: 0, chaseY: 0 };
};
const seedsOf = (n: number) => Array.from({ length: n }, (_, i) => roomSeed(i));

/* 1. Old rounds replay exactly. */
{
  const { recorded, runs } = JSON.parse(readFileSync("scripts/fixtures/swing-assault-legacy.json", "utf8")) as { recorded: string; runs: { rev: number | null; style: string; seed: number; score: number; flagged: boolean; stateHash: number; extra: number; raw: string }[] };
  let same = 0;
  const revs = new Set<number | null>();
  for (const run of runs) {
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const result = replaySwingRun(run.seed, raw, run.rev ?? undefined);
    const identical = result.score === run.score && Boolean(result.flagged) === run.flagged && !result.flagged && fnv(JSON.stringify(result.state)) === run.stateHash && fnv(JSON.stringify({ ...result, state: undefined, checkpoints: undefined })) === run.extra;
    ok(identical, `rev ${run.rev ?? "-"} ${run.style} ${run.seed}: replays ${result.score}${result.flagged ? " flagged" : ""} (stored ${run.score})`);
    ok(result.state.assault === undefined && result.state.sections === undefined && result.state.squeezes === undefined, `rev ${run.rev ?? "-"} ${run.style}: no assault field on an older round`);
    if (identical) same++;
    revs.add(run.rev);
  }
  ok(revs.size === 12 && runs.length >= 48, `the legacy fixture covers every earlier revision (${revs.size} of 12)`);
  console.log(`old rounds: ${same} / ${runs.length} runs recorded on ${recorded} replay to the same score, state and result`);
}

/* 2. Dealing and identity. */
{
  for (let k = 0; k < 12; k++) {
    const p = generateSwing();
    ok(p.type === "swing" && p.swingRev === SWING_REV_ASSAULT && Number.isInteger(p.seed), `rooms deal swingRev 14 (got ${p.swingRev})`);
  }
  ok(SWING_REV_ASSAULT === SWING_REV_EXPAND + 1, "the assault course's stamp is one above swingRev 13");
  const seed = roomSeed(4);
  const a = JSON.stringify(game.init(seed));
  for (const other of seedsOf(20).slice(5)) game.init(other);
  ok(JSON.stringify(game.init(seed)) === a, "a course is its seed's alone (built again from an empty cache, it is the same)");
  ok(JSON.stringify(swingGameFor(SWING_REV_ASSAULT).init(seed)) === a, "the same game object builds the same course");
}

/* 3–5. Courses, sections played in the real sim, features on lines that clear. */
const courseSeeds = seedsOf(FULL ? 40 : 6);
const playSeeds = courseSeeds.slice(0, FULL ? 12 : 2);
let short = 0;
let sectionsPlayed = 0;
let worstBeat = Infinity;
for (const seed of courseSeeds) {
  const s = game.init(seed);
  const secs = s.sections!;
  const ledges = s.ledges!;
  const tag = `course ${seed}`;
  ok(secs.length === SWING_V14_SECTIONS && ledges.length === SWING_V14_SECTIONS + 1, `${tag}: ${secs.length} sections`);
  ok((s.squeezes ?? []).length === SWING_V14_SQUEEZES && secs.filter((k) => k.kind === 2).length === SWING_V14_SQUEEZES, `${tag}: two squeezes`);
  const lerp = (arr: number[], x: number) => {
    const i = Math.max(0, Math.min(arr.length - 2, Math.trunc(x / (40 * FP))));
    return arr[i]! + Math.trunc(((arr[i + 1]! - arr[i]!) * (x - i * 40 * FP)) / (40 * FP));
  };
  secs.forEach((sec, k) => {
    const from = ledges[k]!;
    const to = ledges[k + 1]!;
    ok(sec.hooks === (sec.kind === 0 ? 1 : 2) && (sec.kind === 2) === (sec.sq >= 0), `${tag} section ${k}: kind ${sec.kind} has ${sec.hooks} hooks`);
    ok(to.x - from.x >= 170 * FP && to.x - from.x <= 400 * FP, `${tag} section ${k}: the landing ledge ${(to.x - from.x) / FP} px on`);
    ok(sec.par > 0, `${tag} section ${k}: a par`);
    for (let i = sec.hook0; i < sec.hook0 + sec.hooks; i++) {
      const h = s.anchors[i]!;
      ok(h.y > lerp(s.ceil, h.x) + 30 * FP && h.y < from.top && h.x > from.x, `${tag} section ${k}: hook ${i} under the roof, above and ahead of the start ledge`);
      if (sec.sq >= 0) ok(!swingInSqueeze(s.squeezes![sec.sq]!, h.x, h.y), `${tag} section ${k}: hook ${i} out of the squeeze's rock`);
    }
    if (sec.sq >= 0) {
      const q = s.squeezes![sec.sq]!;
      ok(q.x0 > s.anchors[sec.hook0]!.x && q.x1 < s.anchors[sec.hook0 + 1]!.x && q.bottom - q.top >= 2 * RADIUS + 28 * FP && q.bottom - q.top <= 2 * RADIUS + 64 * FP, `${tag} section ${k}: the squeeze sits between its hooks, its gap ${(q.bottom - q.top) / FP} px`);
    }
  });
  ledges.forEach((l, i) => ok(l.top > lerp(s.ceil, l.x) + 200 * FP && l.top < lerp(s.floor, l.x) - 120 * FP, `${tag} ledge ${i}: between the roof and the lava`));
  const c = swingAssaultCounts(s);
  const counts = [c.gateTotal, c.gemTotal, c.starTotal];
  ok(counts.every((n, i) => n <= [SWING_V14_GATES, SWING_V14_GEMS, SWING_V14_STARS][i]! && n >= [SWING_V14_GATES, SWING_V14_GEMS, SWING_V14_STARS][i]! - 1), `${tag}: ${counts.join("/")} gates, gems and stars`);
  if (counts.some((n, i) => n < [SWING_V14_GATES, SWING_V14_GEMS, SWING_V14_STARS][i]!)) short++;
}
ok(short <= Math.max(1, Math.trunc(courseSeeds.length / 10)), `at most one course in ten is a feature short (${short} of ${courseSeeds.length})`);

for (const seed of playSeeds) {
  const init = game.init(seed);
  const tag = `course ${seed}`;
  const featureLine = new Map<string, boolean>();
  init.sections!.forEach((sec, k) => {
    const s = standingAt(init, k);
    let fastest = Infinity;
    /** Records a line's outcome: its time, and which features it took while clearing the section. */
    const note = ([cleared, ticks, end]: [boolean, number, SwingState]) => {
      if (!cleared) return;
      fastest = Math.min(fastest, ticks);
      (end.gems ?? []).forEach((_, i) => { if ((end.bankGems ?? 0) & (1 << i)) featureLine.set(`gem${i}`, true); });
      (end.gates ?? []).forEach((_, i) => { if ((end.bankGates ?? 0) & (1 << i)) featureLine.set(`gate${i}`, true); });
      for (const i of end.bankStars ?? []) featureLine.set(`star${i}`, true);
    };
    if (sec.kind === 0) {
      for (let r = 2; r <= 110; r++) note(play(s, new Map([[1, hold(1)], [r, hold(0)]])));
      if ((init.starSpots ?? []).length)
        for (const u of [6, 8, 10, 12, 14, 16, 18]) for (let r = u + 2; r <= 110; r++) note(play(s, new Map([[1, hold(1)], [u + 1, reel], [r, hold(0)]])));
    } else {
      // The rope's states after the press, each candidate release forked from one; then the far hook's grab and release.
      const rope: SwingState[] = [step(s, hold(1))];
      for (let i = 1; i < 70; i++) rope.push(step(rope[i - 1]!, null));
      for (let r1 = 1; r1 < 70; r1++) {
        let f = step(rope[r1 - 1]!, hold(0));
        if (f.vx <= 0) continue;
        for (let g = 1; g <= 32; g++) {
          if ((f.restarts ?? 0) > 0) break;
          const on = step(f, hold(1));
          if (on.rope === sec.hook0 + 1 && (on.restarts ?? 0) === 0) {
            let seen = false;
            for (let r2 = 1; r2 <= 90; r2++) {
              const out = play(on, new Map([[r2, hold(0)]]));
              if (out[0]) {
                seen = true;
                note([true, r1 + g + 1 + out[1], out[2]]);
              } else if (seen) break;
            }
          }
          f = step(f, null);
        }
      }
    }
    sectionsPlayed++;
    ok(fastest < Infinity, `${tag} section ${k} (kind ${sec.kind}): a line clears it in the real sim`);
    // Time from the section's start: the press is the tick after it (the hero is at the ledge's centre).
    const beat = sec.par - fastest;
    worstBeat = Math.min(worstBeat, beat);
    ok(beat >= SWING_V14_PAR_FULL, `${tag} section ${k}: its fastest line (${fastest} ticks) beats par (${sec.par}) by ${beat}, the full share needs ${SWING_V14_PAR_FULL}`);
  });
  (init.gates ?? []).forEach((_, i) => ok(featureLine.has(`gate${i}`), `${tag}: gate ${i} is lit by a line that clears its section`));
  (init.gems ?? []).forEach((_, i) => ok(featureLine.has(`gem${i}`), `${tag}: gem ${i} is taken by a line that clears its section`));
  (init.starSpots ?? []).forEach((_, i) => ok(featureLine.has(`star${i}`), `${tag}: star ${i} is taken by a (reeled-in) line that clears its section`));
}
console.log(`courses: ${courseSeeds.length} built, ${sectionsPlayed} sections played in the real sim (fastest beats par by ${worstBeat} ticks or more)`);

/* 6. Rules. */
{
  const init = game.init(roomSeed(1));
  // A press, then letting go at once: the hero drops into the lava and is back on the start ledge.
  let s = init;
  const log = new Map<number, Ev>([[1, hold(1)], [2, hold(0)]]);
  let missAt = 0;
  for (let t = 1; t <= 200 && !missAt; t++) {
    s = step(s, log.get(t) ?? null);
    if ((s.restarts ?? 0) === 1) missAt = t;
  }
  const l0 = init.ledges![0]!;
  ok(missAt > 0 && s.sec === 0 && s.ledgeOn === 0 && s.x === l0.x && s.y === l0.top - RADIUS && s.rope < 0 && s.respawn === SWING_V14_RESPAWN && s.ended === 0 && s.missTick === missAt, `a miss puts the hero back on the start ledge (restart at tick ${missAt}), the run going on`);
  const held = step(s, hold(1));
  ok(held.rope < 0 && held.ledgeOn === 0, "a press during the respawn hold does nothing");
  let after = held;
  for (let i = 0; i < SWING_V14_RESPAWN; i++) after = step(after, null);
  const pressed = step(after, hold(1));
  ok(pressed.rope === init.sections![0]!.hook0 && pressed.tick === s.tick + SWING_V14_RESPAWN + 2, "after the hold a press kicks off again; the clock never stopped");
  // The attempt's pickups go back on a miss (only cleared sections bank them).
  const taken = { ...standingAt(init, 2), gemsTaken: 0b101, gatesLit: 0b10, starsTaken: [1], stars: 1, bankGems: 0b100, bankGates: 0, bankStars: [] as number[], ledgeOn: -1, rope: -1, y: 830 * FP, vy: 3 * FP };
  const missed = step(taken, null);
  ok(missed.restarts === 1 && missed.gemsTaken === 0b100 && missed.gatesLit === 0 && (missed.starsTaken ?? []).length === 0 && missed.stars === 0, "a miss puts the attempt's pickups back (the banked ones stay)");
  // The dragon: 40 % slower, from section SWING_V14_CHASE_FROM, and its catch is a restart.
  ok(SWING_V14_CHASE_PACE === Math.trunc((SWING_CHASE_PACE * 3) / 5), "the dragon flies 40 % slower than swingRev 4–13's");
  const before = standingAt(init, SWING_V14_CHASE_FROM - 1);
  const into = standingAt(init, SWING_V14_CHASE_FROM);
  ok((step(before, null).chaseX ?? 0) === 0 && (step(into, null).chaseX ?? 0) !== 0, `the dragon appears as section ${SWING_V14_CHASE_FROM + 1} starts`);
  const flying = step(into, null);
  ok(step(flying, null).chaseX! - flying.chaseX! === SWING_V14_CHASE_PACE, "it flies at its pace");
  const close = { ...flying, chaseX: flying.x - 40 * FP };
  const caught = step(close, null);
  const start = init.ledges![SWING_V14_CHASE_FROM]!;
  ok(caught.restarts === 1 && caught.caught === 1 && caught.ended === 0 && caught.chaseX! <= start.x - SWING_V14_CHASE_BACKOFF && caught.ledgeOn === SWING_V14_CHASE_FROM, "a catch is a restart (the run goes on), the dragon held off behind the start ledge");
  // Only the section's hooks: from a state flying near the next section's first hook, a press grabs nothing of it.
  const k = 4;
  const next = init.anchors[init.sections![k + 1]!.hook0]!;
  const near = { ...standingAt(init, k), ledgeOn: -1, x: next.x - 40 * FP, y: next.y + 80 * FP, vx: 0, vy: 0, rope: -1 };
  const grabbed = step(near, hold(1));
  ok(grabbed.rope < 0 || (grabbed.rope >= init.sections![k]!.hook0 && grabbed.rope < init.sections![k]!.hook0 + init.sections![k]!.hooks), "only the section's own hooks can be grabbed");
}

/* 7. Scores. */
{
  const idle = game.init(roomSeed(2));
  let s = idle;
  while (!game.isOver(s)) s = step(s, null);
  ok(game.score(s) === 0 && s.tick === game.runTicks, "no input scores 0 (and the run lasts the minute)");
  for (const seed of seedsOf(FULL ? 12 : 4)) {
    const human = new Human("swing", seed, "weak");
    const res = randomBot({ game, seed, rev: SWING_REV_ASSAULT, human });
    const byTick = new Map((res.events ?? []).map((e) => [e.t, e]));
    let r = game.init(seed);
    while (!game.isOver(r) && r.tick < game.runTicks) r = game.step(r, byTick.get(r.tick + 1) ?? null);
    const score = game.score(r);
    ok(score > 0 && score <= 40, `random play on ${seed} scores above 0 and stays low (${score})`);
  }
  const FIXTURE = "scripts/fixtures/swing-assault-runs.json";
  if (RECORD) {
    const runs: unknown[] = [];
    for (const seed of seedsOf(5)) {
      for (const level of [...ALL_LEVELS, "random"] as const) {
        const human = new Human("swing", seed, level === "random" ? "weak" : level);
        const ctx = { game, seed, rev: SWING_REV_ASSAULT, human };
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
        const result = replaySwingRun(seed, raw, SWING_REV_ASSAULT);
        runs.push({ level, seed, score: result.score, stateHash: fnv(JSON.stringify(result.state)), raw: gzipSync(raw).toString("base64") });
        console.log(`recorded ${level} ${seed}: ${result.score}`);
      }
    }
    writeFileSync(FIXTURE, JSON.stringify({ recorded: "swing-assault-check --record (the skill-band bots, scripts/arcade-skill-bands/bots/swingAssault.ts)", runs }));
  }
  const { runs } = JSON.parse(readFileSync(FIXTURE, "utf8")) as { runs: { level: string; seed: number; score: number; stateHash: number; raw: string }[] };
  const by = new Map<string, number[]>();
  for (const run of runs) {
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const result = replaySwingRun(run.seed, raw, SWING_REV_ASSAULT);
    ok(!result.flagged && result.score === run.score && fnv(JSON.stringify(result.state)) === run.stateHash, `${run.level} ${run.seed}: replays ${result.score} (stored ${run.score})`);
    ok(result.score > 0 && result.score <= roundMaxFor("swing"), `${run.level} ${run.seed}: scores above 0 and at most ${roundMaxFor("swing")} (${result.score})`);
    by.set(run.level, [...(by.get(run.level) ?? []), result.score]);
  }
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.trunc(xs.length / 2)]!;
  const order = ALL_LEVELS.map((l) => [l, median(by.get(l) ?? [0])] as const);
  for (let i = 1; i < order.length; i++) {
    const [lo, a] = order[i - 1]!;
    const [hi, b] = order[i]!;
    ok(hi === "perfect" ? b >= a : b > a, `the ${hi} median (${b}) is above the ${lo} median (${a})`);
  }
  const avg = by.get("average") ?? [0];
  ok(Math.max(...avg) - Math.min(...avg) <= 45, `an ordinary (average) player's scores stay close across courses (${Math.min(...avg)}–${Math.max(...avg)})`);
  console.log(`scores by level (median of ${runs.length / 8} courses): ${order.map(([l, m]) => `${l} ${m}`).join(" · ")} · random ${median(by.get("random") ?? [0])}`);
}

/* 8. Display and text. */
{
  ok(swingWorldWFor(SWING_REV_ASSAULT) === 450 && swingWorldHFor(SWING_REV_ASSAULT) === 844 && swingRevealHFor(SWING_REV_ASSAULT) === 731, "rev 14 plays in rev 13's 450 × 844 view (its reveal in the 390-wide box)");
  ok(swingFxFor({ assault: 1 } as SwingState) === SWING_FX_V14 && SWING_FX_V14.width === 450, "rev-14 effects use their own spec in that view");
  ok(LIVE_BANDS.swing.rev === SWING_REV_ASSAULT, "the help's numbers come from the revision rooms deal");
  const help = PUZZLE_INSTRUCTIONS.swing!;
  const text = help.how.map((h) => `${h.action} ${h.detail}`).join(" ");
  ok(/section/i.test(text) && /Squeezes/.test(text) && /far hook/.test(text) && /start ledge/.test(text) && /Par times/.test(text) && /gates/i.test(text) && /Gems/.test(text) && /stars/i.test(text) && /dragon/.test(text) && /same course/.test(text), "the help explains sections, squeezes, the far hook, restarts, par times, gates, gems, stars and the dragon");
  const intro = help.how.filter((h) => !h.helpOnly);
  ok(intro.length === 3 && intro.every((h) => `${h.action} ${h.detail}`.length <= 46) && help.goal.length <= 34, "the intro's goal and three lines fit");
  ok(/Up to 200/.test(help.score) && /under par/.test(help.score) && /gate, gem and star/.test(help.score) && /section/i.test(help.score), "the help's score line states sections, pars, the pickups and the 200");
  ok(/pars/.test(INTRO_SCORE.swing) && /gems/.test(INTRO_SCORE.swing) && /Sections/.test(INTRO_SCORE.swing) && /up to (\{max\}|200)/.test(INTRO_SCORE.swing), `the intro score line: "${INTRO_SCORE.swing}"`);
  const demo = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
  ok(/data\.type === "swing" && demo\?\.puzzle\.type === "swing" && demo\.puzzle\.swingRev !== SWING_REV_ASSAULT\) return null/.test(demo), "Grappler's intro demo stays stopped until one is recorded on swingRev 14");
  const art = readFileSync("src/lib/arcade/swing.renderer.ts", "utf8");
  ok(/SECTION \$\{/.test(art) && /PAR \$\{/.test(art) && /drawAssault/.test(art), "the HUD shows SECTION x / y and the section's par");
  const s = game.init(roomSeed(3));
  ok(swingAssaultPar(s, 0).time === -1, "an uncleared section has no time");
}

/* 9. Building a course stays quick. */
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
console.log(`\nPASS: ${checks} swingRev 14 checks (${((performance.now() - started) / 1000).toFixed(0)} s)`);
