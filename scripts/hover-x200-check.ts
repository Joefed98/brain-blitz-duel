/**
 * hover-x200-check (the 200 expansion, 26 Oct 2026): Hover hoverRev 9 — a 390 × 727 world, tight gates with
 * their centre lines, star chains and shields, scored to 200 (docs/expansions/x200-hover.md, docs/scoring-200.md).
 * It folds in the parked, never-dealt hoverRev 8, which plays as hoverRev 7.
 *
 *  1. Legacy identity: 64 runs recorded on main before the change (hoverRev 7 and 2–6, unstamped;
 *     scripts/fixtures/hover-expand-legacy.json.gz) replay to the same score, gates, stars, survival,
 *     final checksum and every checkpoint checksum; older revisions' states carry no rev-9 field.
 *  2. Dealing and wiring: rooms and practice deal hoverRev 9; its world is 727 high everywhere the world
 *     size is read (stage, reveal, effects spec); the "?" help reads its curve; the round's maximum is 200;
 *     an older demo is stopped.
 *  3. Courses (the arcade rule's counts): every course of 1,500 seeds, the 60 tuning seeds and the 200 fresh
 *     ones has exactly 5 tight gates (80 px, on plain reachable barriers, solid wall to the main gap, clear of
 *     the floor and ceiling) with a centre line through each that can be flown dead centre out of the barrier
 *     before, exactly 5 star chains (5–7 stars, 16 px or more apart, between two barriers, never two in a row, none
 *     leading into a tight gate) and 2 shield bubbles; the first barrier is the 300 px warm-up gap.
 *  4. Determinism and server = phone: random logs replay through the server path to the phone's own score and
 *     checkpoints, never flagged; integers only.
 *  5. The centre line: a pass held on the line grades 3, 7 px off grades 2, 12 px off grades 1, further off or
 *     through the main gap nothing, a pass on a broken shield nothing; the grade is the furthest the saucer
 *     strayed across the barrier's columns.
 *  6. Scoring and the ceiling: base ≤ 150 (all barriers, stars and the minute = 150), paid skill ≤ 50 (the full 50
 *     only for every tight gate, chain and dead-centre line), total = min(200, base + skill); the perfect-play
 *     ceiling from the counts is 200 on every course, and a stored witness run on every tuning and fresh seed
 *     (scripts/fixtures/hover-x200-witness.json.gz) reaches 200 through the server replay; a run kept out of the
 *     tight gates scores 150 at most from the base; no input scores 0 and random play stays near 0.
 *  7. Shields: picked up by touch (not while one is held), take a barrier, the floor and the ceiling crash once
 *     each (pass-through, bounce, stop), the saucer untouchable for HOVER_SHIELD_INVULN ticks.
 *  8. Bounds: drawn through the game's own renderer (reduced motion and effects), a shield bubble, chain stars
 *     and the held shield ring paint only within 2 px of their collision circles, a tight gate's gold rims sit
 *     on the barrier, and the centre line (at rest and lit) paints only on the barrier's columns within 2 px of
 *     the line.
 *
 *   bun scripts/hover-x200-check.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import {
  HOVER_CENTRE_MAX_GRADE,
  HOVER_CENTRE_POINTS,
  HOVER_CENTRE_TOP,
  HOVER_SKILL_FULL,
  HOVER_CENTRE_TOL,
  HOVER_CHAIN_POINTS,
  HOVER_CHAINS,
  HOVER_CHECKPOINT_INTERVAL,
  HOVER_DISC_R,
  HOVER_DISC_X,
  HOVER_EXPAND_H,
  HOVER_FEATURE_EDGE,
  HOVER_GAP_MIN,
  HOVER_IMPULSE,
  HOVER_OPEN_H,
  HOVER_PICKUPS,
  HOVER_PILLAR_W,
  HOVER_REACHABLE_GATES,
  HOVER_REV_EXPAND,
  HOVER_REV_STRICT,
  HOVER_RUN_TICKS,
  HOVER_SHIELD_INVULN,
  HOVER_SHIELD_R,
  HOVER_SKILL_MAX,
  HOVER_SKILL_PAY,
  HOVER_SKILL_RAW_MAX,
  HOVER_STAR_R,
  HOVER_STARS,
  HOVER_TALL_H,
  HOVER_TIGHT_GATES,
  HOVER_TIGHT_H,
  HOVER_TIGHT_POINTS,
  HOVER_TIGHT_WALL,
  HOVER_V9_BAND_CURVE,
  HOVER_V9_MAX,
  hoverBottom,
  centreFlyable,
  hoverCentreGrade,
  hoverCentreY,
  hoverCheckpoint,
  hoverExpandParts,
  hoverExpandUnits,
  hoverReachedFirst,
  hoverFeatureBonus,
  hoverGameFor,
  hoverGapTop,
  hoverSkillRaw,
  hoverStrictGame,
  hoverWorldHFor,
  pillarX,
  type HoverState,
} from "../src/lib/arcade/hover";
import { bandPoints } from "../src/lib/arcade/scoreBands";
import { encodeHoverRun, replayHoverRun } from "../src/lib/duel/hover";
import { generateHover } from "../src/lib/duel/hover.server";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { ARCADE_FX_SPECS, hoverFxFor } from "../src/lib/arcade/arcadeFxGames.renderer";
import { fixtureOf, type HoverFixtureRun } from "./hover-x200-record";
import { solveHover } from "./hover-x200-solver";
import { replayWitness, WITNESS_FIXTURE, WITNESS_INDICES, type HoverWitness } from "./hover-x200-witness";
import { roomSeed } from "./arcade-skill-bands/games";
import { Human } from "./arcade-skill-bands/human";
import { randomBot } from "./arcade-skill-bands/bots/hover";

const failures: string[] = [];
let passes = 0;
const ok = (cond: boolean, message: string) => {
  if (cond) passes++;
  else failures.push(message);
};
const section = (name: string) => console.log(`— ${name}`);
const game = hoverGameFor(HOVER_REV_EXPAND);
const FP = 256;

/** Plays a tap log on hoverRev 9 the way the phone does and returns the encoded answer and final state. */
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
  [s.tick, s.y, s.vy, s.distance, s.gates, s.tight ?? 0, s.chainsDone ?? 0, s.shield ?? 0, s.invuln ?? 0, s.shieldBreaks ?? 0, s.ctrOn ?? 0, s.ctrDev ?? 0, s.ctrPts ?? 0, ...(s.chainHits ?? []), ...(s.ctrLog ?? [])].every(Number.isInteger);

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
    ok(s.xp === undefined && s.chains === undefined && s.ctrLog === undefined && s.pillars.every((p) => p.tightTop === undefined), `hoverRev ${rev}: no rev-9 field on its states`);
  }
  // The parked expansion stamp (hoverRev 8, never dealt) plays as hoverRev 7.
  ok(hoverGameFor(8) === hoverStrictGame && hoverGameFor(HOVER_REV_STRICT) === hoverStrictGame && hoverWorldHFor(8) === HOVER_TALL_H, "a round stamped hoverRev 8 (parked, never dealt) plays as hoverRev 7");
  ok(hoverWorldHFor(HOVER_REV_STRICT) === HOVER_TALL_H && hoverWorldHFor(4) === 560, "older revisions keep their worlds (735, 560)");
}

/* 2. Dealing and wiring. */
section("dealing and wiring");
{
  ok(generateHover().hoverRev === HOVER_REV_EXPAND && HOVER_REV_EXPAND === 9, "rooms deal hoverRev 9");
  const stage = readFileSync("src/puzzles/hover.tsx", "utf8");
  ok(/hoverRev: HOVER_REV_EXPAND \}\) satisfies HoverPuzzleData/.test(stage), "practice deals hoverRev 9");
  ok(/height=\{hoverWorldHFor\(data\.hoverRev\)\}/.test(stage), "the stage sizes its arena from the stored revision");
  ok(hoverWorldHFor(HOVER_REV_EXPAND) === 727 && HOVER_EXPAND_H === 727, "hoverRev 9's world is 390 × 727 (fills a 414 × 772 arena edge to edge)");
  ok(ARCADE_FX_SPECS.hover.height === HOVER_EXPAND_H && hoverFxFor(game.init(5) as HoverState).height === HOVER_EXPAND_H, "the effects spec draws at 727 for the rounds dealt now");
  ok(LIVE_BANDS.hover.rev === HOVER_REV_EXPAND && LIVE_BANDS.hover.curve === HOVER_V9_BAND_CURVE, "the help reads hoverRev 9's base curve");
  ok(roundMaxFor("hover") === 200, "Hover's round maximum is 200");
  ok(/data\.type === "hover" && demo\?\.puzzle\.type === "hover" && demo\.puzzle\.hoverRev !== HOVER_REV_EXPAND/.test(readFileSync("src/lib/duel/introDemo.functions.ts", "utf8")), "a demo recorded before hoverRev 9 is stopped");
  ok(/state\.ctrLog/.test(readFileSync("src/lib/fx/gameSounds.ts", "utf8")) && /state\.xp/.test(readFileSync("src/lib/fx/gameSounds.ts", "utf8")), "the sound observer handles the new moments, the centre line included");
}

/* 3. Courses. */
section("courses");
{
  const H = HOVER_EXPAND_H * FP;
  let worst = "";
  const seeds = [...Array.from({ length: 1500 }, (_, n) => ((n + 1) * 2654435761) >>> 1 || 1), ...WITNESS_INDICES.map((n) => roomSeed(n))];
  for (const seed of seeds) {
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
      if (hoverCentreY(p) !== p.tightTop! + (HOVER_TIGHT_H >> 1)) bad(`tight gate ${i}: centre line off the middle`);
      if (!centreFlyable(s.pillars[i - 1]!, p, hoverCentreY(p), H)) bad(`tight gate ${i}: its centre line can't be flown out of the barrier before`);
      if ((s.chains ?? []).some((c) => c.after === i - 2 || c.after === i - 1 || c.after === i)) bad(`tight gate ${i}: a chain leads into it`);
    }
    const chains = s.chains ?? [];
    if (chains.length !== HOVER_CHAINS) bad(`${chains.length} chains`);
    if (chains.some((c, k) => k > 0 && c.after - chains[k - 1]!.after < 2)) bad("two chains in a row");
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
    const first = s.pillars[0]!;
    if (first.gapH !== HOVER_OPEN_H || first.gapTop + (HOVER_OPEN_H >> 1) !== s.y) bad("the first barrier is not the warm-up gap round the start");
    if (s.totalGates !== HOVER_REACHABLE_GATES || s.totalStars !== HOVER_STARS) bad(`${s.totalGates} barriers, ${s.totalStars} stars`);
    if (worst) break;
  }
  ok(!worst, worst || `${seeds.length} courses: exactly ${HOVER_TIGHT_GATES} tight gates with centre lines, ${HOVER_CHAINS} star chains, ${HOVER_PICKUPS} shields, ${HOVER_REACHABLE_GATES} barriers and ${HOVER_STARS} gold stars each`);
  ok(JSON.stringify(game.init(4242)) === JSON.stringify(game.init(4242)), "the same seed builds the same course");
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

/* 5. The centre line. */
section("centre line");
{
  const seed = 4242;
  const s0 = game.init(seed) as HoverState;
  const i = s0.pillars.findIndex((p) => p.tightTop !== undefined);
  const p = s0.pillars[i]!;
  const c = hoverCentreY(p);
  // Fly level at a fixed height from just before the barrier until it is passed (the sim's own step each tick).
  const fly = (height: (k: number) => number, extra: Partial<HoverState> = {}) => {
    let st: HoverState = { ...s0, ...extra, acted: 1, gates: i, distance: p.x0 - (HOVER_DISC_X + HOVER_DISC_R) - 4 * FP, y: height(0), vy: 0 };
    for (let k = 1; k < 60 && st.gates === i && !st.crashed; k++) st = game.step({ ...st, y: height(k), vy: 0 }, false) as HoverState;
    return st;
  };
  const on = fly(() => c);
  ok(on.tight === 1 && on.ctrPts === 4 && on.ctrLog?.[0] === i * 4 + 3, `held on the line: a tight gate, grade 3 and 4 centre points (${on.tight}, ${on.ctrPts})`);
  const off7 = fly(() => c + 7 * FP);
  ok(off7.tight === 1 && off7.ctrPts === 2, `7 px off the line: 2 (${off7.ctrPts})`);
  const off12 = fly(() => c - 12 * FP);
  ok(off12.tight === 1 && off12.ctrPts === 1, `12 px off: 1 (${off12.ctrPts})`);
  const off20 = fly(() => c + 20 * FP);
  ok(off20.tight === 1 && (off20.ctrPts ?? 0) === 0, `20 px off: a tight gate but no centre points (${off20.ctrPts})`);
  // The furthest the saucer strays across the columns grades it: on the line but 7 px off for one tick in the middle.
  const spike = fly((k) => (k === 10 ? c + 7 * FP : c));
  const spikeIn = (() => {
    let st: HoverState = { ...s0, acted: 1, gates: i, distance: p.x0 - (HOVER_DISC_X + HOVER_DISC_R) - 4 * FP, y: c, vy: 0 };
    for (let k = 1; k <= 10; k++) st = game.step({ ...st, y: c, vy: 0 }, false) as HoverState;
    const left = pillarX(p, st.distance);
    return left <= HOVER_DISC_X && HOVER_DISC_X <= left + HOVER_PILLAR_W;
  })();
  ok(!spikeIn || spike.ctrPts === 2, `a stray 7 px within the columns grades the pass 2 (${spike.ctrPts})`);
  const main = fly(() => hoverGapTop(p, 0) + (p.gapH >> 1));
  ok((main.tight ?? 0) === 0 && (main.ctrPts ?? 0) === 0 && main.gates === i + 1, "through the main gap: no tight gate, no centre points");
  const broken = fly(() => c, { invuln: 30 });
  ok((broken.tight ?? 0) === 0 && (broken.ctrPts ?? 0) === 0, "on a broken shield's moment: no tight gate, no centre points");
  ok(HOVER_CENTRE_TOL[0] === 6 * FP && HOVER_CENTRE_TOL[1] === 10 * FP && HOVER_CENTRE_TOL[2] === 15 * FP && hoverCentreGrade(6 * FP) === 3 && hoverCentreGrade(6 * FP + 1) === 2 && hoverCentreGrade(15 * FP) === 1 && hoverCentreGrade(15 * FP + 1) === 0, "grades: within 6 px 3, 10 px 2, 15 px 1");
}

/* 6. Scoring and the ceiling. */
section("scoring and the ceiling");
{
  // Caps and the pay scale.
  ok(HOVER_SKILL_RAW_MAX === HOVER_TIGHT_GATES * (HOVER_TIGHT_POINTS + HOVER_CENTRE_TOP) + HOVER_CHAINS * HOVER_CHAIN_POINTS && HOVER_SKILL_RAW_MAX === 70 && HOVER_CENTRE_TOP === 4, `raw skill at most 70, a dead-centre line 4 (${HOVER_SKILL_RAW_MAX})`);
  ok(JSON.stringify(HOVER_CENTRE_POINTS) === "[0,1,2,4]", "centre-line points by grade: 1, 2, and 4 for dead centre");
  ok(bandPoints(HOVER_SKILL_PAY, HOVER_SKILL_RAW_MAX) === HOVER_SKILL_MAX && HOVER_SKILL_MAX === 50 && bandPoints(HOVER_SKILL_PAY, HOVER_SKILL_FULL) === HOVER_SKILL_MAX && HOVER_SKILL_FULL === HOVER_SKILL_RAW_MAX - 12 && bandPoints(HOVER_SKILL_PAY, HOVER_SKILL_FULL - 1) < HOVER_SKILL_MAX, "the full 50 from 12 raw short of everything (one slip forgiven), not before");
  // A flawless human-paced run may lose two gold stars: every barrier, eight stars and the flight unit still make the base's 140.
  ok(bandPoints(HOVER_V9_BAND_CURVE, 3 * HOVER_REACHABLE_GATES + 2 * (HOVER_STARS - 2) + 1) === 140 && bandPoints(HOVER_V9_BAND_CURVE, 3 * HOVER_REACHABLE_GATES + 2 * (HOVER_STARS - 2)) < 140, "base 140 for every barrier and eight of ten stars, not fewer");
  let rising = true;
  for (let u = 1; u <= HOVER_SKILL_RAW_MAX; u++) if (bandPoints(HOVER_SKILL_PAY, u) < bandPoints(HOVER_SKILL_PAY, u - 1)) rising = false;
  ok(rising && bandPoints(HOVER_SKILL_PAY, 15) <= 8 && bandPoints(HOVER_SKILL_PAY, 30) <= 24 && bandPoints(HOVER_SKILL_PAY, HOVER_SKILL_FULL - 8) <= 39, "the pay scale rises, light use pays little (15 raw → ≤ 8, 30 → ≤ 24) and the last 8 raw before the full pay are worth 11 or more (elite precision)");
  ok(bandPoints(HOVER_V9_BAND_CURVE, 3 * HOVER_REACHABLE_GATES + 2 * HOVER_STARS + 1) + 10 === 150 && bandPoints(HOVER_V9_BAND_CURVE, 3 * HOVER_REACHABLE_GATES + 2 * HOVER_STARS) === 140, "the base tops out at 150 (all barriers and stars, 140, plus the minute)");
  // Ceiling from the counts: every course offers the same features (section 3), so a perfect run scores
  // base 150 + pay(full raw) 50, capped at 200, on every course.
  const ceiling = Math.min(HOVER_V9_MAX, bandPoints(HOVER_V9_BAND_CURVE, 3 * HOVER_REACHABLE_GATES + 2 * HOVER_STARS + 1) + 10 + bandPoints(HOVER_SKILL_PAY, HOVER_TIGHT_GATES * (HOVER_TIGHT_POINTS + HOVER_CENTRE_TOP) + HOVER_CHAINS * HOVER_CHAIN_POINTS));
  ok(ceiling === 200, `perfect-play ceiling from the counts: ${ceiling}`);
  // Reachability: a stored witness run on every tuning and fresh seed reaches 200 through the server replay.
  const witness = existsSync(WITNESS_FIXTURE) ? (JSON.parse(gunzipSync(readFileSync(WITNESS_FIXTURE)).toString()) as HoverWitness[]) : [];
  let hit = 0;
  let lowest = 200;
  for (const n of WITNESS_INDICES) {
    const w = witness.find((x) => x.n === n);
    if (!w || w.seed !== roomSeed(n)) {
      failures.push(`seed index ${n}: no witness run`);
      lowest = 0;
      continue;
    }
    const r = replayWitness(w.seed, w.taps);
    const st = r.state as HoverState;
    if (!r.flagged && r.score === 200 && st.tight === HOVER_TIGHT_GATES && st.chainsDone === HOVER_CHAINS && st.ctrPts === HOVER_TIGHT_GATES * HOVER_CENTRE_TOP && st.gates === st.totalGates && st.stars === st.totalStars && r.survived) hit++;
    else failures.push(`seed index ${n}: witness scores ${r.score}${r.flagged ? " (flagged)" : ""}`);
    lowest = Math.min(lowest, r.score);
  }
  ok(hit === WITNESS_INDICES.length, `${hit} of ${WITNESS_INDICES.length} witness runs (60 tuning, 200 fresh seeds) reach 200 through the server replay: every barrier, star, tight gate dead centre and chain (lowest ${lowest})`);
  {
    const seed = roomSeed(0);
    const taps = solveHover(seed, { features: false, stars: true });
    ok(taps !== null, "a run through the main gaps only exists");
    if (taps) {
      const { raw, state } = play(seed, taps);
      const r = replayHoverRun(seed, raw, HOVER_REV_EXPAND);
      ok(state.tight === 0 && (state.ctrPts ?? 0) === 0, "kept out of the tight gates, none is counted and no centre line");
      ok(r.score - hoverFeatureBonus(state) === 150 && r.score === Math.min(200, 150 + hoverFeatureBonus(state)), `every barrier, star and the minute without the tight gates: base 150 (${r.score}, chains swept by chance ${state.chainsDone})`);
    }
  }
  // The score is the base (≤ 150) plus the paid skill (≤ 50), capped at 200, for any run.
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
    if (parts.points !== bandPoints(HOVER_V9_BAND_CURVE, hoverExpandUnits(state)) || hoverExpandUnits(state) !== 3 * state.gates + 2 * (state.stars ?? 0) + (hoverReachedFirst(state) || state.tick >= 30 ? 1 : 0)) formula = false;
    if (hoverFeatureBonus(state) !== bandPoints(HOVER_SKILL_PAY, hoverSkillRaw(state))) formula = false;
  }
  ok(formula && maxSeen <= 200, `60 runs: score = min(200, base ≤ 150 + paid skill ≤ 50) (max ${maxSeen})`);
  // No input scores 0; random play stays near 0.
  {
    const { state } = play(roomSeed(3), []);
    ok(game.score(state) === 0, "no input scores 0");
    // A run that tried (two taps) and crashed at the warm-up gate still scores: flying up to it counts 1.
    {
      const seed = roomSeed(5);
      const s0 = game.init(seed) as HoverState;
      let s1: HoverState = s0;
      const tapAt = new Set([14, 48]);
      while (!game.isOver(s1)) s1 = game.step(s1, tapAt.has(s1.tick + 1)) as HoverState;
      ok(s1.crashed && s1.gates === 0 && hoverReachedFirst(s1) && game.score(s1) > 0, `two taps then nothing: ${s1.gates} barriers, reached the first ${hoverReachedFirst(s1)}, scores ${game.score(s1)}`);
    }
    const scores: number[] = [];
    for (let n = 0; n < 60; n++) {
      const seed = roomSeed(n);
      const taps = randomBot({ game, seed, rev: HOVER_REV_EXPAND, human: new Human("hover", seed, "weak") }).taps ?? [];
      scores.push(game.score(play(seed, taps).state));
    }
    scores.sort((a, b) => a - b);
    ok(scores[30]! <= 5 && scores[59]! <= 30, `random play near 0 (median ${scores[30]}, max ${scores[59]} over 60 seeds)`);
  }

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
  const { installOffscreenCanvas, createCanvas } = await import("./hover-x200-render");
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
    // The tight gate's centre line is the one thing drawn inside its gap (on the columns, within 2 px of the line).
    const lineY = hoverCentreY(p) / FP;
    const outside = d.filter(([x, y]) => x < left - 2 || x >= right + 2 || (gaps.some(([t, b]) => y > t + 2 && y < b - 2) && Math.abs(y + 0.5 - lineY) > 2));
    ok(d.length > 1000 && outside.length === 0, `a tight-gate barrier paints only on its columns, nothing inside either gap (${outside.length} px outside)`);
    let gold = 0;
    for (const y of [Math.floor(gaps[1]![0]!) - 6, Math.floor(gaps[1]![1]!) + 5])
      for (let x = left + 1; x < right - 1; x++) {
        const k = (y * W + x) * 4;
        if (a[k]! > 200 && a[k + 1]! > 150 && a[k + 2]! < 120) gold++;
      }
    ok(gold > 40, `the tight gate's rims are gold (${gold} gold px on the rim rows)`);
    // The centre line, at rest and lit with the saucer on it mid-barrier: only on the columns, within 2 px of the line.
    const cy = hoverCentreY(p) / FP;
    const restLine = d.filter(([x, y]) => x >= left && x < right && Math.abs(y + 0.5 - cy) <= 1 && gaps[1]![0]! + 2 < y && y < gaps[1]![1]! - 2);
    ok(restLine.length >= 30, `the centre line at rest is drawn across the barrier's columns (${restLine.length} px on the line's row)`);
    const litDist = p.x0 + (HOVER_PILLAR_W >> 1) - HOVER_DISC_X;
    const lit: HoverState = { ...s, distance: litDist, y: hoverCentreY(p), ctrOn: i, ctrDev: 0, tightOn: i, gates: i };
    const litLeft = (p.x0 - litDist) / FP;
    const litOff: HoverState = { ...lit, ctrOn: -1, tightOn: -1 };
    const ld = diff(frame(lit), frame(litOff));
    const ldOut = ld.filter(([x, y]) => x < litLeft - 2 || x >= litLeft + HOVER_PILLAR_W / FP + 2 || Math.abs(y + 0.5 - cy) > 2.5);
    ok(ld.length >= 8 && ldOut.length === 0, `the lit centre line paints ${ld.length} px, all on the barrier's columns within 2 px of the line (${ldOut.length} outside)`);
  }
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  ✗ ${f}`);
  console.log(`FAIL hover-x200-check: ${failures.length} of ${passes + failures.length} checks failed`);
  process.exit(1);
}
console.log(`PASS hover-x200-check: ${passes} checks — hoverRev 9 (390 × 727, tight gates with centre lines, star chains, shields, up to 200; every tuning and fresh seed reaches 200); older revisions replay unchanged`);
