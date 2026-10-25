/**
 * hover-expand-check (Expansion E1, 25 Oct 2026): Hover hoverRev 8 — a 390 × 727 world, tight gates,
 * star chains and shields, scored to 200 (docs/scoring-200.md).
 *
 *  1. Legacy identity: 64 runs recorded on main before the change (hoverRev 7 and 2–6, unstamped;
 *     scripts/fixtures/hover-expand-legacy.json.gz) replay to the same score, gates, stars, survival,
 *     final checksum and every checkpoint checksum; older revisions' states carry no rev-8 field.
 *  2. Dealing and wiring: rooms and practice deal hoverRev 8; its world is 727 high everywhere the
 *     world size is read (stage, reveal, effects spec); the "?" help reads its curve; the round's
 *     maximum is 200; an older demo is stopped.
 *  3. Courses: over 1,500 seeds every course has 5 tight gates (80 px, narrower than any normal gap,
 *     on plain reachable barriers, solid wall to the main gap, clear of the floor and ceiling), up to
 *     5 star chains (5 on nearly every course; 5–7 stars, 16 px or more apart, on one flap's arc in the
 *     open space between two barriers) and 2 shield bubbles; the same seed builds the same course.
 *  4. Determinism and server = phone: random and skill-bot logs replay through the server path to
 *     the phone's own score and checkpoints, never flagged; integers only.
 *  5. The features work: a solved run threads all 5 tight gates and sweeps all 5 chains; a run kept
 *     out of the tight gates scores none; a shield is picked up by touch (not while one is held),
 *     takes a barrier, the floor and the ceiling crash once each in turn (pass-through, bounce,
 *     stop), the saucer untouchable for HOVER_SHIELD_INVULN ticks, then the next crash ends the run.
 *  6. Scoring: 200 is reached through the server replay (solved runs on three seeds); every barrier,
 *     star and the minute without the features scores exactly 150; the score is always
 *     min(200, base + bonus) with the base at most 150 and the bonus at most 50; no run exceeds 200.
 *  7. Bounds: drawn through the game's own renderer (reduced motion and effects, so no light or
 *     glow), a shield bubble, chain stars and the held shield ring paint only within 2 px of their
 *     collision circles, and a tight gate's gold rims sit on the barrier, none inside either gap.
 *
 *   bun scripts/hover-expand-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import {
  HOVER_CHAINS,
  HOVER_CHECKPOINT_INTERVAL,
  HOVER_DISC_R,
  HOVER_DISC_X,
  HOVER_EXPAND_H,
  HOVER_FEATURE_EDGE,
  HOVER_GAP_MIN,
  HOVER_IMPULSE,
  HOVER_PICKUPS,
  HOVER_PILLAR_W,
  HOVER_REACHABLE_GATES,
  HOVER_REV_EXPAND,
  HOVER_REV_STRICT,
  HOVER_RUN_TICKS,
  HOVER_SHIELD_INVULN,
  HOVER_SHIELD_R,
  HOVER_STAR_R,
  HOVER_TALL_H,
  HOVER_TIGHT_GATES,
  HOVER_TIGHT_H,
  HOVER_TIGHT_WALL,
  HOVER_V8_BAND_CURVE,
  hoverBottom,
  hoverCheckpoint,
  hoverExpandParts,
  hoverFeatureBonus,
  hoverGameFor,
  hoverGapTop,
  hoverWorldHFor,
  type HoverState,
} from "../src/lib/arcade/hover";
import { bandPoints } from "../src/lib/arcade/scoreBands";
import { encodeHoverRun, replayHoverRun } from "../src/lib/duel/hover";
import { generateHover } from "../src/lib/duel/hover.server";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { ARCADE_FX_SPECS, hoverFxFor } from "../src/lib/arcade/arcadeFxGames.renderer";
import { fixtureOf, type HoverFixtureRun } from "./hover-expand-record";
import { solveHover } from "./hover-expand-solver";

const failures: string[] = [];
let passes = 0;
const ok = (cond: boolean, message: string) => {
  if (cond) passes++;
  else failures.push(message);
};
const section = (name: string) => console.log(`— ${name}`);
const game = hoverGameFor(HOVER_REV_EXPAND);
const FP = 256;

/** Plays a tap log on hoverRev 8 the way the phone does and returns the encoded answer and final state. */
function play(seed: number, taps: Iterable<number>): { raw: string; state: HoverState } {
  const set = new Set(taps);
  let state = game.init(seed);
  const checkpoints = [];
  while (!game.isOver(state)) {
    state = game.step(state, set.has(state.tick + 1));
    if (state.tick % HOVER_CHECKPOINT_INTERVAL === 0) checkpoints.push(hoverCheckpoint(state));
  }
  return { raw: encodeHoverRun({ seed, claimedScore: game.score(state), inputs: [...set].sort((a, b) => a - b), endTick: state.tick, checkpoints }), state };
}
const integers = (s: HoverState) =>
  [s.tick, s.y, s.vy, s.distance, s.gates, s.tight ?? 0, s.chainsDone ?? 0, s.shield ?? 0, s.invuln ?? 0, s.shieldBreaks ?? 0, ...(s.chainHits ?? [])].every(Number.isInteger);

/* 1. Legacy identity. */
section("legacy identity");
{
  const runs = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/hover-expand-legacy.json.gz")).toString()) as HoverFixtureRun[];
  ok(runs.length === 64 && runs.filter((r) => r.rev === HOVER_REV_STRICT).length === 32, `64 legacy runs, 32 on hoverRev 7 (${runs.length})`);
  let same = 0;
  for (const r of runs) {
    const now = fixtureOf(r.rev, r.level, r.seed, r.raw);
    if (JSON.stringify(now) === JSON.stringify(r)) same++;
    else failures.push(`legacy run rev ${r.rev} ${r.level} seed ${r.seed}: ${r.score} → ${now.score}, checksum ${r.checksum} → ${now.checksum}`);
  }
  ok(same === runs.length, `every legacy run replays identically (${same} of ${runs.length})`);
  for (const rev of [null, 2, 3, 4, 5, 6, 7]) {
    const s = hoverGameFor(rev).init(77) as HoverState;
    ok(s.xp === undefined && s.chains === undefined && s.pillars.every((p) => p.tightTop === undefined), `hoverRev ${rev}: no rev-8 field on its states`);
  }
  ok(hoverWorldHFor(HOVER_REV_STRICT) === HOVER_TALL_H && hoverWorldHFor(4) === 560, "older revisions keep their worlds (735, 560)");
}

/* 2. Dealing and wiring. */
section("dealing and wiring");
{
  ok(generateHover().hoverRev === HOVER_REV_EXPAND, "rooms deal hoverRev 8");
  const stage = readFileSync("src/puzzles/hover.tsx", "utf8");
  ok(/hoverRev: HOVER_REV_EXPAND \}\) satisfies HoverPuzzleData/.test(stage), "practice deals hoverRev 8");
  ok(/height=\{hoverWorldHFor\(data\.hoverRev\)\}/.test(stage), "the stage sizes its arena from the stored revision");
  ok(hoverWorldHFor(HOVER_REV_EXPAND) === 727 && HOVER_EXPAND_H === 727, "hoverRev 8's world is 390 × 727 (fills a 414 × 772 arena edge to edge)");
  ok(ARCADE_FX_SPECS.hover.height === HOVER_EXPAND_H && hoverFxFor(game.init(5) as HoverState).height === HOVER_EXPAND_H, "the effects spec draws at 727 for the rounds dealt now");
  ok(LIVE_BANDS.hover.rev === HOVER_REV_EXPAND && LIVE_BANDS.hover.curve === HOVER_V8_BAND_CURVE, "the help reads hoverRev 8's base curve");
  ok(roundMaxFor("hover") === 200, "Hover's round maximum is 200");
  ok(/data\.type === "hover" && demo\?\.puzzle\.type === "hover" && demo\.puzzle\.hoverRev !== HOVER_REV_EXPAND/.test(readFileSync("src/lib/duel/introDemo.functions.ts", "utf8")), "a demo recorded before hoverRev 8 is stopped");
  ok(/hoverRev 8|HOVER_REV_EXPAND/.test(readFileSync("src/lib/fx/gameSounds.ts", "utf8")) || /state\.xp/.test(readFileSync("src/lib/fx/gameSounds.ts", "utf8")), "the sound observer handles the new moments");
}

/* 3. Courses. */
section("courses");
{
  const H = HOVER_EXPAND_H * FP;
  let five = 0;
  let worst = "";
  for (let n = 1; n <= 1500; n++) {
    const seed = (n * 2654435761) >>> 1 || 1;
    const s = game.init(seed) as HoverState;
    const tight = s.pillars.map((p, i) => ({ p, i })).filter(({ p }) => p.tightTop !== undefined);
    const bad = (msg: string) => {
      if (!worst) worst = `seed ${seed}: ${msg}`;
    };
    if (tight.length !== HOVER_TIGHT_GATES) bad(`${tight.length} tight gates`);
    for (const { p, i } of tight) {
      if (i >= HOVER_REACHABLE_GATES - 1 || i < 4) bad(`tight gate on barrier ${i}`);
      if (p.tightH !== HOVER_TIGHT_H || HOVER_TIGHT_H >= HOVER_GAP_MIN) bad("tight gate size");
      if (p.gap2Top !== undefined || p.movePhase !== undefined || p.starDy !== undefined) bad(`tight gate on a special barrier ${i}`);
      const wall = Math.max(p.tightTop! - (p.gapTop + p.gapH), p.gapTop - (p.tightTop! + HOVER_TIGHT_H));
      if (wall < HOVER_TIGHT_WALL) bad(`tight gate ${i} wall ${wall / FP}`);
      if (p.tightTop! < HOVER_FEATURE_EDGE || p.tightTop! + HOVER_TIGHT_H > H - HOVER_FEATURE_EDGE) bad(`tight gate ${i} off the edge`);
    }
    const chains = s.chains ?? [];
    if (chains.length === HOVER_CHAINS) five++;
    if (chains.length < 3) bad(`${chains.length} chains`);
    for (const c of chains) {
      if (c.stars.length < 5 || c.stars.length > 7) bad(`chain of ${c.stars.length}`);
      const a = s.pillars[c.after]!;
      const b = s.pillars[c.after + 1]!;
      for (const [j, st] of c.stars.entries()) {
        if (st.x0 - HOVER_STAR_R < a.x0 + HOVER_PILLAR_W || st.x0 + HOVER_STAR_R > b.x0) bad(`chain after ${c.after}: star ${j} not between the barriers`);
        if (st.y - HOVER_STAR_R < HOVER_FEATURE_EDGE || st.y + HOVER_STAR_R > H - HOVER_FEATURE_EDGE) bad(`chain after ${c.after}: star ${j} off the edge`);
        if (j > 0 && st.x0 - c.stars[j - 1]!.x0 < 16 * FP) bad(`chain after ${c.after}: stars ${j - 1}/${j} closer than 16 px`);
      }
      if (c.after + 1 >= HOVER_REACHABLE_GATES) bad(`chain after ${c.after} beyond the reachable course`);
    }
    if ((s.pickups ?? []).length !== HOVER_PICKUPS) bad(`${s.pickups?.length} pickups`);
    for (const p of s.pickups ?? []) if (p.x0 - HOVER_SHIELD_R < s.pillars[p.after]!.x0 + HOVER_PILLAR_W || p.x0 + HOVER_SHIELD_R > s.pillars[p.after + 1]!.x0) bad("pickup not between barriers");
    if (n <= 40 && JSON.stringify(game.init(seed)) !== JSON.stringify(s)) bad("the same seed built a different course");
    if (worst) break;
  }
  ok(!worst, worst || "1,500 courses");
  ok(five >= 1490, `5 chains on nearly every course (${five} of 1,500)`);
}

/* 4. Determinism and server = phone. */
section("determinism, server replay = phone");
{
  let rand = 12345;
  const next = () => ((rand = (Math.imul(rand, 1103515245) + 12345) >>> 0) >>> 8) / 0x1000000;
  let agree = 0;
  let ints = true;
  for (let n = 0; n < 40; n++) {
    const seed = 1 + Math.floor(next() * 2e9);
    const taps: number[] = [];
    for (let t = 5; t <= HOVER_RUN_TICKS; t += 12 + Math.floor(next() * 12)) taps.push(t);
    const a = play(seed, taps);
    const b = play(seed, taps);
    const r = replayHoverRun(seed, a.raw, HOVER_REV_EXPAND);
    if (a.raw === b.raw && !r.flagged && r.score === game.score(a.state) && hoverCheckpoint(r.state).checksum === hoverCheckpoint(a.state).checksum) agree++;
    else if (a.raw !== b.raw) failures.push(`seed ${seed}: the same log played twice differs`);
    let s = game.init(seed);
    const set = new Set(taps);
    while (!game.isOver(s)) {
      s = game.step(s, set.has(s.tick + 1));
      if (!integers(s)) ints = false;
    }
  }
  ok(agree === 40, `40 random logs: the server replay reproduces the phone's score and checkpoints, unflagged (${agree})`);
  ok(ints, "every sim value stays an integer");
}

/* 5 and 6. The features and the score. */
section("features and scoring");
{
  const seeds = [301794028, 992653281, 77];
  for (const seed of seeds) {
    const taps = solveHover(seed, { features: true, stars: true });
    ok(taps !== null, `seed ${seed}: a run through every gate, star, tight gate and chain exists`);
    if (!taps) continue;
    const { raw, state } = play(seed, taps);
    const r = replayHoverRun(seed, raw, HOVER_REV_EXPAND);
    ok(!r.flagged && r.score === 200 && r.survived, `seed ${seed}: 200 through the server replay (${r.score}${r.flagged ? ", flagged" : ""})`);
    ok(state.tight === HOVER_TIGHT_GATES && state.chainsDone === HOVER_CHAINS && state.gates === state.totalGates && state.stars === state.totalStars, `seed ${seed}: every tight gate (${state.tight}), chain (${state.chainsDone}), barrier and star`);
    ok((state.chainHits ?? []).length === (state.chains ?? []).reduce((n, c) => n + c.stars.length, 0), `seed ${seed}: every chain star collected`);
  }
  {
    const seed = seeds[0]!;
    const taps = solveHover(seed, { features: false, stars: true });
    ok(taps !== null, "a run through the main gaps only exists");
    if (taps) {
      const { raw, state } = play(seed, taps);
      const r = replayHoverRun(seed, raw, HOVER_REV_EXPAND);
      ok(state.tight === 0, "kept out of the tight gates, none is counted");
      ok(r.score === 150 + 5 * (state.chainsDone ?? 0) && r.score - hoverFeatureBonus(state) === 150, `every barrier, star and the minute without the features: 150 (${r.score}, chains swept by chance ${state.chainsDone})`);
    }
  }
  // The score is the base (≤ 150) plus the feature bonus (≤ 50), capped at 200, for any run.
  let formula = true;
  let maxSeen = 0;
  for (let n = 0; n < 60; n++) {
    const seed = 1000 + n * 7919;
    const taps: number[] = [];
    for (let t = 3 + (n % 5); t <= HOVER_RUN_TICKS; t += 10 + ((t * 7 + n) % 11)) taps.push(t);
    const { state } = play(seed, taps);
    const parts = hoverExpandParts(state);
    const base = parts.points + (parts.finished ? 10 : 0);
    const score = game.score(state);
    maxSeen = Math.max(maxSeen, score);
    if (score !== Math.min(200, base + hoverFeatureBonus(state)) || base > 150 || hoverFeatureBonus(state) > 50 || score > 200) formula = false;
    if (parts.points !== bandPoints(HOVER_V8_BAND_CURVE, 3 * state.gates + 2 * (state.stars ?? 0))) formula = false;
  }
  ok(formula && maxSeen <= 200, `60 runs: score = min(200, base ≤ 150 + bonus ≤ 50) (max ${maxSeen})`);
  ok(bandPoints(HOVER_V8_BAND_CURVE, 3 * HOVER_REACHABLE_GATES + 20) + 10 === 150, "the base tops out at 150 (all barriers and stars, 140, plus the minute)");

  // Shields, by hand: a state with a shield, flown into the floor, the ceiling and a barrier.
  const seed = 4242;
  const s0 = game.init(seed) as HoverState;
  const bottom = hoverBottom(s0);
  let s: HoverState = { ...s0, shield: 1, acted: 1 };
  while (!s.shieldBreaks && !s.crashed) s = game.step(s, false) as HoverState;
  ok(!s.crashed && s.shieldBreaks === 1 && s.shield === 0 && s.invuln === HOVER_SHIELD_INVULN && s.vy === HOVER_IMPULSE && s.y === bottom - HOVER_DISC_R - FP, "a shield takes a floor crash: it breaks and the saucer bounces up with a tap's kick");
  let ticks = 0;
  while (!s.crashed && ticks < 400) {
    s = game.step(s, false) as HoverState;
    ticks++;
  }
  ok(s.crashed && s.shieldBreaks === 1 && ticks >= HOVER_SHIELD_INVULN, `with the shield gone the next floor crash ends the run (${ticks} ticks later)`);
  s = { ...s0, shield: 1, acted: 1 };
  let guard = 0;
  while (!s.shieldBreaks && !s.crashed && guard++ < 200) s = game.step(s, true) as HoverState;
  ok(!s.crashed && s.shieldBreaks === 1 && s.y === HOVER_DISC_R + FP && s.vy === 0, "a shield takes a ceiling crash: the climb stops at the top");
  // A barrier: put the saucer level with a wall just before the first barrier and hold that height.
  {
    const p = s0.pillars[0]!;
    const wallY = p.gapTop - 40 * FP > HOVER_DISC_R + 20 * FP ? p.gapTop - 40 * FP : p.gapTop + p.gapH + 40 * FP;
    let b: HoverState = { ...s0, shield: 1, acted: 1, y: wallY, vy: 0, distance: p.x0 - (HOVER_DISC_X + HOVER_DISC_R) - 4 * FP };
    let broke = -1;
    for (let t = 0; t < 40 && !b.crashed; t++) {
      b = game.step({ ...b, y: wallY, vy: 0 }, false) as HoverState;
      if (b.shieldBreaks && broke < 0) broke = t;
    }
    ok(broke >= 0 && !b.crashed && b.gates === 1, `a shield takes a barrier: the saucer flies through the wall and the barrier counts (broke at +${broke}, gates ${b.gates})`);
    ok((b.tight ?? 0) === 0, "a barrier passed on a broken shield is no tight gate");
  }
  // Pickup by touch, and not while a shield is held.
  {
    const pk = s0.pickups![0]!;
    const at: HoverState = { ...s0, acted: 1, y: pk.y, vy: -HOVER_IMPULSE >> 3, distance: pk.x0 - HOVER_DISC_X - 2 * FP };
    const one = game.step({ ...at, vy: -90 }, false) as HoverState;
    ok(one.shield === 1 && (one.pickupsTaken ?? []).includes(0), "touching a shield bubble gives a shield");
    const held = game.step({ ...at, vy: -90, shield: 1 }, false) as HoverState;
    ok(!(held.pickupsTaken ?? []).includes(0), "a bubble is left alone while a shield is held");
  }
}

/* 7. Bounds (the renderer, reduced motion and effects). */
section("bounds rule");
{
  const g = globalThis as Record<string, unknown>;
  g.window = { matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }), __duelzEffects: 1, sessionStorage: { getItem: () => null, setItem() {} } };
  const { installOffscreenCanvas, createCanvas } = await import("./hover-expand-render");
  installOffscreenCanvas();
  const { hoverRevealGame } = await import("../src/lib/arcade/hover.renderer");
  const W = 390;
  const H = HOVER_EXPAND_H;
  const frame = (state: HoverState) => {
    const c = createCanvas(W, H);
    const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    hoverRevealGame.draw(ctx, state, { width: W, height: H });
    return (ctx as unknown as { getImageData: (x: number, y: number, w: number, h: number) => { data: Uint8ClampedArray } }).getImageData(0, 0, W, H).data;
  };
  const diff = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
    const out: [number, number][] = [];
    for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) out.push([(i / 4) % W, Math.floor(i / 4 / W)]);
    return out;
  };
  const seed = 301794028;
  const base = game.init(seed) as HoverState;
  // A shield bubble at x = 220 on screen.
  {
    const pk = base.pickups![0]!;
    const s: HoverState = { ...base, distance: pk.x0 - 220 * FP, y: 120 * FP, pickups: [pk], chains: [] };
    const d = diff(frame(s), frame({ ...s, pickups: [] }));
    const cy = pk.y / FP;
    const far = d.filter(([x, y]) => Math.hypot(x + 0.5 - 220, y + 0.5 - cy) > HOVER_SHIELD_R / FP + 2);
    ok(d.length > 50 && far.length === 0, `a shield bubble paints ${d.length} px, none past 2 px of its circle (${far.length} outside)`);
  }
  // A star chain on screen.
  {
    const chain = base.chains![0]!;
    const s: HoverState = { ...base, distance: chain.stars[0]!.x0 - 180 * FP, y: 650 * FP, chains: [chain], pickups: [] };
    // The same chain far off to the right (the HUD's chain count stays the same).
    const d = diff(frame(s), frame({ ...s, chains: [{ ...chain, stars: chain.stars.map((st) => ({ ...st, x0: st.x0 + 4000 * FP })) }] }));
    const far = d.filter(([x, y]) => !chain.stars.some((st) => Math.hypot(x + 0.5 - (st.x0 - s.distance) / FP, y + 0.5 - st.y / FP) <= HOVER_STAR_R / FP + 2));
    if (far.length) console.log("    chain outside e.g.", far.slice(0, 6).map(([x, y]) => `${x},${y} d=${Math.min(...chain.stars.map((st) => Math.hypot(x + 0.5 - (st.x0 - s.distance) / FP, y + 0.5 - st.y / FP))).toFixed(2)}`).join(" "));
    ok(d.length > 50 && far.length === 0, `chain stars paint ${d.length} px, none past 2 px of their circles (${far.length} outside)`);
  }
  // The held shield ring.
  {
    const s: HoverState = { ...base, distance: 0, y: 300 * FP, chains: [], pickups: [] };
    const d = diff(frame({ ...s, shield: 1 }), frame({ ...s, shield: 0 }));
    const far = d.filter(([x, y]) => Math.hypot(x + 0.5 - HOVER_DISC_X / FP, y + 0.5 - 300) > HOVER_DISC_R / FP + 2);
    if (far.length) console.log("    ring outside e.g.", far.slice(0, 6).map(([x, y]) => `${x},${y} d=${Math.hypot(x + 0.5 - HOVER_DISC_X / FP, y + 0.5 - 300).toFixed(2)}`).join(" "));
    ok(d.length > 30 && far.length === 0, `the held shield ring paints ${d.length} px, none past 2 px of the saucer (${far.length} outside)`);
  }
  // A tight gate's rims.
  {
    const i = base.pillars.findIndex((p) => p.tightTop !== undefined);
    const p = base.pillars[i]!;
    const s: HoverState = { ...base, gates: i, distance: p.x0 - 250 * FP, y: 650 * FP, chains: [], pickups: [] };
    const away: HoverState = { ...s, pillars: s.pillars.map((q, k) => (k === i ? { ...q, x0: q.x0 + 4000 * FP } : q)) };
    const a = frame(s);
    const d = diff(a, frame(away));
    const left = 250;
    const right = left + HOVER_PILLAR_W / FP;
    const gaps = [
      [hoverGapTop(p, s.tick) / FP, (hoverGapTop(p, s.tick) + p.gapH) / FP],
      [p.tightTop! / FP, (p.tightTop! + p.tightH!) / FP],
    ];
    const outside = d.filter(([x, y]) => x < left - 2 || x >= right + 2 || gaps.some(([t, b]) => y > t + 2 && y < b - 2));
    ok(d.length > 1000 && outside.length === 0, `a tight-gate barrier paints only on its columns, nothing inside either gap (${outside.length} px outside)`);
    let gold = 0;
    for (const y of [Math.floor(gaps[1]![0]!) - 6, Math.floor(gaps[1]![1]!) + 5])
      for (let x = left + 1; x < right - 1; x++) {
        const k = (y * W + x) * 4;
        if (a[k]! > 200 && a[k + 1]! > 150 && a[k + 2]! < 120) gold++;
      }
    ok(gold > 40, `the tight gate's rims are gold (${gold} gold px on the rim rows)`);
  }
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  ✗ ${f}`);
  console.log(`FAIL hover-expand-check: ${failures.length} of ${passes + failures.length} checks failed`);
  process.exit(1);
}
console.log(`PASS hover-expand-check: ${passes} checks — hoverRev 8 (390 × 727, tight gates, star chains, shields, up to 200); older revisions replay unchanged`);
