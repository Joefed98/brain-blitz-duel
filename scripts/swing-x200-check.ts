/**
 * Grappler's 200 expansion (swingRev 13, 26 Oct 2026, docs/expansions/x200-swing.md): a wider, deeper cave
 * (450 × 844) with high-route gems, low-route speed gates, swing combos, set-route ledge sections (start ledge,
 * landing ledges, a collapsing one, the finish flag) and, new, a par time per section; scored to 200.
 *
 *  1. Old rounds: skill-band runs recorded on main before the change on swingRev 9, 10 and 11
 *     (scripts/fixtures/swing-x200-legacy.json; older revisions are in arcade-tuning-g3-legacy.json) replay through
 *     today's server path to the same score and the same final state; their states carry no expansion field.
 *  2. New rounds: rooms deal swingRev 13 from SWING_V13_BANK (SWING_V9_BANK courses re-proved with every feature:
 *     two or three full sections with their pars, twelve gems, eight gates, ten stars, a finishing witness); the
 *     start state keeps rev 9's ceiling, anchors, spikes and stalactites, the lava lower with each jet's top where
 *     it was; stored rev-13 runs (scripts/fixtures/swing-x200-runs.json) replay exactly.
 *  3. Sections: on sampled bank courses every ledge of every section is reached from the one before in the real sim
 *     (a kick off it and a release window of two or more ticks, as generation places each ledge;
 *     a few have exactly two), the flag's kick leads on to the open course, and a
 *     collapsing ledge gives way SWING_LEDGE_CRUMBLE ticks after the first landing; ledges are one-way.
 *  4. Gates light only at gate speed through the opening; gems are touch pickups; the chain grows only on fast,
 *     quick, forward grabs and every fifth link is a combo point.
 *  5. Par times: each section's par is fixed by the course (identical from init whatever is played); a section
 *     cleared with its flag under par pays its share scaled by the margin, the full share from SWING_PAR_FULL under;
 *     at or over par, a skipped ledge or no start landing pays nothing.
 *  6. Scores: the base curve (to 140, + 10 for 500 m) never above 150, the skill pay never above 50, the total never
 *     above 200; no input scores 0; random play stays near 0; the stored witness run reaches 200 through the server
 *     replay.
 *  7. The ceiling: every room-bank course's perfect-play ceiling (scripts/swing-x200-lib.ts, recorded by
 *     scripts/swing-x200-ceiling.ts in scripts/fixtures/swing-x200-ceiling.json; a sample recomputed, every course
 *     with CHECKS_FULL=1) is 200, so the lowest over the skill-band tool's tuning (0–59) and fresh (10000–10199)
 *     deals, which are bank courses, is too.
 *  8. Display and text: the effects and reveal sizes by revision, the intro line, the help, the intro demo held to
 *     swingRev 13, the par shown in the art.
 *
 *   bun scripts/swing-x200-check.ts          (CHECKS_FULL=1: every bank course's features, sections and ceiling)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";
import {
  expand13LedgeGone,
  swingFeaturePoints,
  swingGameFor,
  swingRevealHFor,
  swingRunningSection,
  swingSectionPar,
  swingWorldHFor,
  swingWorldWFor,
  SWING_COMBO_CAP,
  SWING_COMBO_EVERY,
  SWING_COMBO_SPEED,
  SWING_FEATURE_CAP,
  SWING_GATES,
  SWING_GATE_SPEED,
  SWING_GEMS,
  SWING_GEM_TOUCH,
  SWING_GUARANTEED_RAW,
  SWING_INPUT_HOLD,
  SWING_LEDGE_CRUMBLE,
  SWING_LEDGE_POINTS,
  SWING_PAR_FULL,
  SWING_PAR_MARGIN,
  SWING_PAR_POINTS,
  SWING_REV_EXPAND,
  SWING_REV_STRICT,
  SWING_SECTION_LEDGES,
  SWING_SKILL_PAY,
  SWING_STARS,
  SWING_V13_BAND_CURVE,
  SWING_V13_DROP,
  SWING_V13_H,
  SWING_V13_W,
  type SwingState,
} from "../src/lib/arcade/swing";
import { SWING_FX_V13, swingFxFor } from "../src/lib/arcade/arcadeFxGames.renderer";
import { ARCADE_REVEAL_RENDERERS, revealWorldH } from "../src/lib/arcade/revealRenderers";
import { bandPoints } from "../src/lib/arcade/scoreBands";
import { generateSwing } from "../src/lib/duel/arcade.server";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { replaySwingRun } from "../src/lib/duel/swing";
import { SWING_V9_BANK } from "../src/lib/duel/swingBankV9.server";
import { SWING_V13_BANK } from "../src/lib/duel/swingBankV13.server";
import { swingExpandComplete } from "../src/lib/duel/swingProof.server";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human } from "./arcade-skill-bands/human";
import { randomBot } from "./arcade-skill-bands/bots/swing";
import { swingCeiling, type SwingCeiling } from "./swing-x200-lib";

const FP = 256;
const FULL = process.env.CHECKS_FULL === "1" || process.argv.includes("--full");
const failures: string[] = [];
let checks = 0;
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};
const game = swingGameFor(SWING_REV_EXPAND);
const hold = (s: SwingState, a: number) => ({ t: s.tick + 1, k: SWING_INPUT_HOLD, a, b: 0, c: 0, d: 0 });
const started = performance.now();

/* 1–2. Stored runs replay exactly. */
let best200: { seed: number; score: number } | null = null;
for (const [file, label] of [["scripts/fixtures/swing-x200-legacy.json", "pre-change"], ["scripts/fixtures/swing-x200-runs.json", "swingRev 13"]] as const) {
  const { runs } = JSON.parse(readFileSync(file, "utf8")) as { runs: { rev: number | null; level: string; seed: number; score: number; stateHash: number; raw: string }[] };
  let same = 0;
  for (const run of runs) {
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const result = replaySwingRun(run.seed, raw, run.rev ?? undefined);
    const identical = !result.flagged && result.score === run.score && fnv(JSON.stringify(result.state)) === run.stateHash;
    if (identical) same++;
    else failures.push(`${label} run rev ${run.rev} ${run.level} ${run.seed}: replay ${result.score} (stored ${run.score})${result.flagged ? " flagged" : ""}`);
    checks++;
    if (run.rev !== SWING_REV_EXPAND) ok(result.state.expand === undefined && result.state.worldW === undefined && result.state.ledges === undefined && result.state.pars === undefined, `rev ${run.rev} state carries no expansion field`);
    else {
      ok(result.score <= 200 && swingFeaturePoints(result.state).total <= SWING_FEATURE_CAP, `rev 13 run ${run.level} ${run.seed}: within the caps (${result.score})`);
      if (result.score === 200 && identical) best200 = { seed: run.seed, score: result.score };
    }
  }
  console.log(`${label}: ${same} / ${runs.length} stored runs replay to the same score and state`);
}
ok(best200 !== null, "a stored swingRev 13 run (a strong-play witness, scripts/swing-x200-witness.ts) reaches 200 through the server replay");

/* 2. Generator, bank and start state. */
{
  for (let k = 0; k < 20; k++) {
    const p = generateSwing();
    ok(p.swingRev === SWING_REV_EXPAND && SWING_V13_BANK.some((e) => e.seed === p.seed), "rooms deal swingRev 13 on a bank course");
  }
  const v9 = new Set(SWING_V9_BANK.map((e) => e.seed));
  ok(SWING_V13_BANK.length >= 120 && SWING_V13_BANK.every((e) => v9.has(e.seed) && e.stars === SWING_STARS && e.ticks <= 3600), `the rev-13 bank holds ${SWING_V13_BANK.length} re-proved rev-9 courses, each with a ten-star witness to 500 m inside the minute`);
  const sample = FULL ? SWING_V13_BANK : SWING_V13_BANK.filter((_, i) => i % 30 === 0);
  for (const e of sample) ok(swingExpandComplete(e.seed), `bank course ${e.seed} carries every feature`);
  const e = SWING_V13_BANK[0]!;
  const old = swingGameFor(SWING_REV_STRICT).init(e.seed);
  const s = game.init(e.seed);
  ok(s.worldW === SWING_V13_W && s.worldH === SWING_V13_H && swingWorldWFor(SWING_REV_EXPAND) === 450 && swingWorldHFor(SWING_REV_EXPAND) === 844 && swingWorldWFor(SWING_REV_STRICT) === 390, "the view is 450 × 844 (390 wide on older revisions)");
  ok(JSON.stringify(s.ceil) === JSON.stringify(old.ceil) && JSON.stringify(s.anchors) === JSON.stringify(old.anchors) && JSON.stringify(s.spikes) === JSON.stringify(old.spikes), "ceiling, anchors and spikes are rev 9's");
  ok(s.floor.every((y, i) => y === old.floor[i]! - 110 * FP + SWING_V13_DROP), "the lava sits 224 px below rev 8's (114 below rev 9's)");
  ok((s.jets ?? []).every((j, i) => j.h - SWING_V13_DROP === old.jets![i]!.h - 110 * FP && j.x === old.jets![i]!.x), "every jet's top is where it was");
  ok((s.rocks ?? []).every((r, i) => r.x === old.rocks![i]!.x && r.trigger === old.rocks![i]!.trigger), "stalactites are rev 9's");
  ok(s.rng === old.rng && (s.starSpots ?? []).length === SWING_STARS, "the stored rng is unchanged and ten stars are re-proved");
  ok((s.gems ?? []).length === SWING_GEMS && (s.gates ?? []).length === SWING_GATES && (s.ledges ?? []).length >= 2 * SWING_SECTION_LEDGES, "twelve gems, eight gates and two or three sections");
  ok((s.gates ?? []).every((g) => g.y0 < g.y1), "each gate's opening runs top to bottom");
  const ids = [...new Set((s.ledges ?? []).map((l) => l.section))];
  ok(ids.every((k) => (s.pars?.[k] ?? 0) > SWING_PAR_MARGIN) && (s.pars ?? []).every((p, k) => p === 0 || ids.includes(k)), "every section has a par; a section the course has no room for has none");
}

/* 3. Sections play in the real sim. */
{
  const sample = FULL ? SWING_V13_BANK : SWING_V13_BANK.filter((_, i) => i % 60 === 0);
  let pairs = 0;
  for (const e of sample) {
    const s0 = game.init(e.seed);
    const ledges = s0.ledges ?? [];
    for (let i = 0; i < ledges.length; i++) {
      const l = ledges[i]!;
      const stand: SwingState = { ...s0, x: l.x, y: l.top - 10 * FP, rope: -1, vx: 0, vy: 0, ledgeOn: i, maxX: l.x, acted: 1, ledgeTicks: ledges.map((_, k) => (k === i ? 1 : 0)), tick: 1 };
      const next = ledges.findIndex((q) => q.section === l.section && q.order === l.order + 1);
      const window: number[] = [];
      for (let r = 1; r < 240; r++) {
        let t = game.step(stand, hold(stand, 1));
        for (let k = 0; k < r && !t.ended; k++) t = game.step(t, null);
        t = game.step(t, hold(t, 0));
        if (next < 0) {
          let alive = true;
          for (let k = 0; k < 110 && alive; k++) {
            t = game.step(t, null);
            if (t.ended === 2) alive = false;
            else if (t.anchors.some((a) => a.x > l.x + 60 * FP && (a.x - t.x) ** 2 + (a.y - t.y) ** 2 < (180 * FP) ** 2)) break;
          }
          if (alive) window.push(r);
        } else {
          for (let k = 0; k < 110 && !t.ended && (t.ledgeOn ?? -1) < 0; k++) t = game.step(t, null);
          if (t.ledgeOn === next) window.push(r);
        }
      }
      let run = 0;
      let longest = 0;
      for (let k = 0; k < window.length; k++) {
        run = k > 0 && window[k] === window[k - 1]! + 1 ? run + 1 : 1;
        longest = Math.max(longest, run);
      }
      ok(longest >= (next < 0 ? 1 : 2), `course ${e.seed} ledge ${i} (section ${l.section}, order ${l.order}): ${next < 0 ? "the flag leads on" : `next ledge reached with a ${longest}-tick window`}`);
      pairs++;
      if (l.crumble) {
        let t: SwingState = stand;
        for (let k = 0; k < SWING_LEDGE_CRUMBLE + 2; k++) t = game.step(t, null);
        ok(expand13LedgeGone(t, i, t.tick) && (t.ledgeOn ?? -1) < 0 && t.rope < 0, `course ${e.seed} ledge ${i}: a collapsing ledge gives way ${SWING_LEDGE_CRUMBLE} ticks after the landing`);
      }
    }
  }
  console.log(`sections: ${pairs} ledges checked in the real sim`);
  const e = SWING_V13_BANK[0]!;
  const s0 = game.init(e.seed);
  const l = s0.ledges![0]!;
  let up: SwingState = { ...s0, x: l.x, y: l.top + 40 * FP, rope: -1, vx: 0, vy: -8 * FP, acted: 1 };
  for (let k = 0; k < 8; k++) up = game.step(up, null);
  ok((up.ledgeOn ?? -1) < 0 && up.ended === 0, "rising through a ledge passes it");
  let down: SwingState = { ...s0, x: l.x, y: l.top - 40 * FP, rope: -1, vx: 0, vy: 2 * FP, acted: 1 };
  for (let k = 0; k < 12; k++) down = game.step(down, null);
  ok(down.ledgeOn === 0 && down.ended === 0 && down.y === l.top - 10 * FP, "falling on to a ledge lands on its top line");
}

/* 4. Gates, gems and combos (synthetic bodies on a bank course). */
{
  const e = SWING_V13_BANK[0]!;
  const s0 = game.init(e.seed);
  const g = s0.gates![0]!;
  const mid = Math.trunc((g.y0 + g.y1) / 2);
  const pass = (speed: number, y: number) => {
    let t: SwingState = { ...s0, x: g.x - 3 * speed * FP, y, rope: -1, vx: speed * FP, vy: -77, acted: 1 };
    for (let k = 0; k < 6; k++) t = game.step(t, null);
    return ((t.gatesLit ?? 0) & 1) === 1;
  };
  ok(pass(SWING_GATE_SPEED + 1, mid), "a fast pass through the opening lights the gate");
  ok(!pass(SWING_GATE_SPEED - 2, mid), "a slow pass does not");
  ok(!pass(SWING_GATE_SPEED + 1, g.y0 - 30 * FP), "a fast pass above the opening does not");
  const [gx, gy] = s0.gems![0]!;
  let t: SwingState = { ...s0, x: gx - 4 * FP, y: gy, rope: -1, vx: 2 * FP, vy: -77, acted: 1 };
  t = game.step(t, null);
  ok(((t.gemsTaken ?? 0) & 1) === 1 && SWING_GEM_TOUCH === 22 * FP, "touching a gem takes it");
  let c: SwingState = { ...s0, chain: 0, comboPts: 0, acted: 1 };
  let links = 0;
  for (let k = 0; k < 10; k++) {
    const target = c.anchors.findIndex((a) => a.x > (c.lastGrabX ?? 0) + 40 * FP);
    const a = c.anchors[target]!;
    c = { ...c, x: a.x - 50 * FP, y: a.y + 40 * FP, rope: -1, vx: SWING_COMBO_SPEED * FP + 64, vy: 0, grabTick: c.tick - 30 };
    c = game.step(c, hold(c, 1));
    if (c.rope === target) links++;
  }
  ok(links === 10 && c.chain === 10 && c.comboPts === 10 / SWING_COMBO_EVERY, `ten fast quick grabs make a ten-link chain and two combo points (${c.chain}, ${c.comboPts})`);
  const slow: SwingState = { ...c, x: c.x + 100 * FP, rope: -1, vx: 3 * FP, vy: 0, grabTick: c.tick - 30 };
  const afterSlow = game.step(slow, hold(slow, 1));
  ok(afterSlow.chain === 0 && afterSlow.comboPts === c.comboPts, "a slow grab ends the chain");
}

/* 5. Par times. */
{
  const e = SWING_V13_BANK.find((x) => new Set(game.init(x.seed).ledges!.map((l) => l.section)).size === 2)!;
  const s0 = game.init(e.seed);
  const ids = [...new Set(s0.ledges!.map((l) => l.section))];
  const k = ids[0]!;
  const par = s0.pars![k]!;
  const mine = s0.ledges!.map((l, i) => ({ l, i })).filter(({ l }) => l.section === k);
  /** A state with section k's ledges landed: start at tick 100, the flag `time` later, the rest in between (or `skip` left out). */
  const run = (time: number, skip = -1): SwingState => {
    const ticks = s0.ledges!.map(() => 0);
    for (const { l, i } of mine) if (i !== skip) ticks[i] = l.kind === 0 ? 100 : l.kind === 2 ? 100 + time : 100 + Math.trunc((time * l.order) / (SWING_SECTION_LEDGES - 1));
    return { ...s0, acted: 1, tick: 100 + time + 1, ledgeTicks: ticks };
  };
  const share = SWING_PAR_POINTS / ids.length;
  const parPts = (st: SwingState) => swingFeaturePoints(st).parPts;
  ok(swingSectionPar(run(par - SWING_PAR_FULL), k).beat === SWING_PAR_FULL && parPts(run(par - SWING_PAR_FULL)) === Math.trunc(share), `finishing ${SWING_PAR_FULL} ticks under par pays the section's full share (${Math.trunc(share)})`);
  ok(parPts(run(par - SWING_PAR_FULL - 120)) === Math.trunc(share), "more than that pays no more (capped)");
  ok(parPts(run(par - Math.trunc(SWING_PAR_FULL / 2))) === Math.trunc(share / 2) && parPts(run(par - 1)) === Math.trunc(share / SWING_PAR_FULL), "beating par by less pays less, in proportion to the margin");
  ok(parPts(run(par)) === 0 && parPts(run(par + 50)) === 0 && swingSectionPar(run(par), k).beat === 0, "at or over par pays nothing");
  ok(parPts(run(par - SWING_PAR_FULL, mine[2]!.i)) === 0 && swingSectionPar(run(par - SWING_PAR_FULL, mine[2]!.i), k).time === -1, "a skipped ledge: no par");
  ok(parPts(run(par - SWING_PAR_FULL, mine[0]!.i)) === 0, "no start landing: no par");
  // The running clock (display) reads the section while it runs and stops at the flag.
  const mid: SwingState = { ...run(par), x: mine[1]!.l.x, ledgeTicks: s0.ledges!.map((_, i) => (i === mine[0]!.i || i === mine[1]!.i ? 100 : 0)), tick: 160 };
  const clock = swingRunningSection(mid);
  ok(clock !== null && clock.section === k && clock.par === par && clock.elapsed === 60, "the HUD clock runs from the start-ledge landing");
  ok(swingRunningSection(run(par - 10)) === null, "it stops once the flag is landed");
  // Par comes from the course alone: the same in every run and fixed for the whole run.
  const deal = s0.pars!.join(",");
  let idle = game.init(e.seed);
  while (!idle.ended) idle = game.step(idle, null);
  ok(idle.pars!.join(",") === deal && game.init(e.seed).pars!.join(",") === deal, "a course's pars are fixed by its seed, whatever is played");
  // The real route beats par by at least the full margin (sectionRoute, the ceiling's own proof).
  const c = swingCeiling(e.seed);
  ok(c.routes.every((t, i) => t > 0 && c.pars[i]! - t >= SWING_PAR_FULL), `the fastest proved route of each section finishes ${SWING_PAR_FULL}+ ticks under par in the real sim (${c.routes.join(", ")} vs par ${c.pars.join(", ")})`);
}

/* 6. Scores. */
{
  ok(roundMaxFor("swing") === 200, "Grappler's round maximum is 200");
  const pts = SWING_V13_BAND_CURVE.points;
  ok(SWING_V13_BAND_CURVE.units.every((u, i) => i === 0 || u > SWING_V13_BAND_CURVE.units[i - 1]!) && pts.every((p, i) => i === 0 || p >= pts[i - 1]!) && pts.at(-1) === 140, "the base curve rises to 140 at 550 units");
  ok(bandPoints(SWING_V13_BAND_CURVE, 550) + 10 === 150 && bandPoints(SWING_V13_BAND_CURVE, 10_000) === 140, "500 m with every star is 150 before skill, and the base never more");
  const payPts = SWING_SKILL_PAY.points;
  ok(payPts.at(-1) === SWING_FEATURE_CAP && payPts.every((p, i) => i === 0 || p >= payPts[i - 1]!) && bandPoints(SWING_SKILL_PAY, 1000) === SWING_FEATURE_CAP, "skill pays on a rising scale, never more than 50");
  ok(bandPoints(SWING_SKILL_PAY, 12) <= 12 && bandPoints(SWING_SKILL_PAY, 6) <= 4, "light use pays little");
  ok(SWING_GUARANTEED_RAW === SWING_GEMS + SWING_GATES + SWING_LEDGE_POINTS + SWING_PAR_POINTS && bandPoints(SWING_SKILL_PAY, SWING_GUARANTEED_RAW) === SWING_FEATURE_CAP && SWING_COMBO_CAP === 10, "what every course guarantees pays the full 50 (combos on top)");
  const e = SWING_V13_BANK[0]!;
  let idle = game.init(e.seed);
  while (!idle.ended) idle = game.step(idle, null);
  ok(game.score(idle) === 0, "a run with no input scores 0");
  const maxed: SwingState = { ...idle, acted: 1, ended: 1, maxX: idle.maxX + 600 * 40 * FP, stars: SWING_STARS, comboPts: 40, gemsTaken: 0xfff, gatesLit: 0xff, ledgeTicks: (idle.ledges ?? []).map((l) => (l.kind === 0 ? 5 : 6)) };
  ok(game.score(maxed) === 200 && swingFeaturePoints(maxed).total === 50, "everything scores exactly 200, never more");
  // Random play stays near 0 (a few courses through the server replay).
  const spec = GAME_BY_TYPE.get("swing")!;
  let worst = 0;
  for (let n = 0; n < 6; n++) {
    const seed = spec.seedForRev!(n, SWING_REV_EXPAND)!;
    const out = randomBot({ game, seed, rev: SWING_REV_EXPAND, human: new Human("swing", seed, "weak") });
    const by = new Map((out.events ?? []).map((ev) => [ev.t, ev]));
    let st = game.init(seed);
    while (!game.isOver(st) && st.tick < game.runTicks) st = game.step(st, by.get(st.tick + 1) ?? null);
    worst = Math.max(worst, game.score(st));
  }
  ok(worst <= 20, `random play stays near 0 (best ${worst} on 6 room courses)`);
}

/* 7. The ceiling over every room-bank course (and so every tuning and fresh deal). */
{
  const { courses } = JSON.parse(readFileSync("scripts/fixtures/swing-x200-ceiling.json", "utf8")) as { courses: SwingCeiling[] };
  ok(courses.length === SWING_V13_BANK.length && courses.every((c, i) => c.seed === SWING_V13_BANK[i]!.seed), `the ceiling fixture covers every bank course (${courses.length})`);
  const recheck = FULL ? courses : courses.filter((_, i) => i % 45 === 0);
  for (const c of recheck) ok(JSON.stringify(swingCeiling(c.seed)) === JSON.stringify(c), `course ${c.seed}: its ceiling recomputes identically`);
  const lowest = Math.min(...courses.map((c) => c.ceiling));
  ok(lowest === 200 && courses.every((c) => c.stars === SWING_STARS && c.raw >= SWING_GUARANTEED_RAW), `the lowest perfect-play ceiling over the room bank is ${lowest}`);
  const spec = GAME_BY_TYPE.get("swing")!;
  const byseed = new Map(courses.map((c) => [c.seed, c.ceiling]));
  const dealt = (from: number, n: number) => Array.from({ length: n }, (_, i) => spec.seedForRev!(from + i, SWING_REV_EXPAND)!);
  const tuning = dealt(0, 60);
  const fresh = dealt(10000, 200);
  ok([...tuning, ...fresh].every((s) => byseed.get(s) === 200), `every tuning (0–59) and fresh (10000–10199) deal is a bank course with a ceiling of 200`);
  console.log(`ceiling: lowest ${lowest} over ${courses.length} bank courses (${recheck.length} recomputed); tuning ${new Set(tuning).size} courses, fresh ${new Set(fresh).size}`);
}

/* 8. Display and text. */
{
  ok(swingFxFor({ expand: 1 } as SwingState) === SWING_FX_V13 && SWING_FX_V13.width === 450 && SWING_FX_V13.height === 844, "rev-13 effects use the 450 × 844 view");
  ok(swingFxFor({ worldH: 730 } as SwingState).width === 390, "older effects keep 390 wide");
  ok(SWING_FX_V13.events.some((ev: any) => ev.label?.({ ledges: [], pars: [] } as unknown as SwingState)?.includes("PAR")), "a section under par has its own effect pop");
  const reveal = ARCADE_REVEAL_RENDERERS.swing!;
  ok(revealWorldH(reveal, { type: "swing", seed: 1, swingRev: SWING_REV_EXPAND } as any) === swingRevealHFor(SWING_REV_EXPAND) && swingRevealHFor(SWING_REV_EXPAND) === 731, "the reveal keeps the 450 × 844 view's shape in its 390-wide box");
  ok(revealWorldH(reveal, { type: "swing", seed: 1, swingRev: SWING_REV_STRICT } as any) === 730, "older reveals keep 390 × 730");
  ok(/up to \{max\}|\b200\b/.test(INTRO_SCORE.swing) && /pars/.test(INTRO_SCORE.swing) && /gems/i.test(INTRO_SCORE.swing), `the intro score line states the new top and the features: "${INTRO_SCORE.swing}"`);
  const help = PUZZLE_INSTRUCTIONS.swing!;
  const text = help.how.map((h) => `${h.action} ${h.detail}`).join(" ");
  ok(/gems/.test(text) && /speed gates/.test(text) && /ledges/.test(text) && /combo/.test(text) && /collapses/.test(text) && /Par times/.test(text) && /par time/.test(text), "the help explains gems, gates, ledges, combos, the collapsing ledge and par times");
  ok(help.how.filter((h) => !h.helpOnly).length === 3 && help.how.some((h) => !h.helpOnly && /par time/.test(h.detail)), "the intro's three lines name the par time");
  ok(/Skill adds up to 50 more/.test(help.score) && /under par/.test(help.score) && /Up to 200/.test(help.score), "the help's score line states the skill points, the par and the 200");
  const demo = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
  ok(/data\.type === "swing" && demo\?\.puzzle\.type === "swing" && demo\.puzzle\.swingRev !== SWING_REV_EXPAND\) return null/.test(demo), "Grappler's intro demo stays stopped until one is recorded on swingRev 13");
  const art = readFileSync("src/lib/arcade/swing.renderer.ts", "utf8");
  ok(/PAR \$\{/.test(art) && /swingRunningSection/.test(art), "the art shows each section's par and its running clock");
}

if (failures.length) {
  console.log(`\nFAIL: ${failures.length} of ${checks} checks failed:`);
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`\nPASS: ${checks} swingRev 13 checks (${((performance.now() - started) / 1000).toFixed(0)} s)`);
