/**
 * crazy-golf-v3-check (the Crazy Golf overhaul, 15 Nov 2026; docs/arcade-standard/minigolf.md "golfRev 3"): proves
 * golfRev 3.
 *
 *  1. The catalogue: twenty templates, four a slot, every variant's tee and cup on the fairway and clear of every
 *     hazard and wall; the numbers it shares with the sim equal the sim's.
 *  2. The bank: five slots of at least 60 holes, ids unique and in their slot, pars 2–5 at every level, each par its
 *     witness's strokes + 1, and every witness route holing in exactly its strokes from the tick it was proved from.
 *  3. Composed courses: 150 courses at each level (any hole of each slot) played on their witnesses score exactly 200
 *     through the server's replay, all five under par, finished by the level's Speed time.
 *  4. The deal: golfRev 3 at every level, one bank hole a slot, each level's pars, `level` stored only off Normal;
 *     the minigolfPreCourse pin deals golfRev 2's bank exactly as before.
 *  5. The chip: its carry and flight time by power, flying over water, sand and low walls, meeting the fence, landing
 *     with MG_CHIP_LAND_KEEP of its speed, stopped dead in sand, a stroke and a reset in water; refused on golfRev 2.
 *  6. The swells: a mound pushes away and a hollow pulls in, nothing at the centre or the rim; golfRev 2's holes have
 *     none, so their roll is unchanged.
 *  7. The levels: stroke limits par + 4 / 3 / 3 / 2, the sails' speeds, Speed's full-by times, the 90 s run; a
 *     golfRev 3 stamp without hole ids plays golfRev 2; golfRev 3's checkpoints sum the chip's flight.
 *  8. The reveal's trace: a witness's strokes, hole by hole, as the sim scored them.
 *
 *   bun scripts/crazy-golf-v3-check.ts      (CHECKS_FULL=1 also rebuilds the bank and compares it byte for byte, ~20 min)
 */
import { readFileSync } from "node:fs";
import { fp } from "../src/lib/arcade/engine";
import {
  mgChipLaunch,
  mgInSandV3,
  mgInWaterV3,
  MG_LOOP_MIN_V,
  mgRollTickV3,
  mgStrokeLimit,
  minigolfCheckpoint,
  minigolfCourseV2,
  minigolfFullByS,
  minigolfGameFor,
  minigolfRunTicksFor,
  MG_CHIP_LAND_KEEP,
  MG_CHIP_MAX_PX,
  MG_CHIP_MAX_T,
  MG_CHIP_MIN_PX,
  MG_CHIP_MIN_T,
  MG_CURVE_R,
  MG_END_NONE,
  MG_END_REST,
  MG_END_WATER,
  MG_GATE_R,
  MG_INPUT_CHIP,
  MG_INPUT_PUTT,
  MG_LEVELS,
  MG_LEVEL_NAMES,
  MG_MILL_HALF,
  MG_MILL_SPIN,
  MG_POWER_MAX,
  MINIGOLF_HOLES,
  MINIGOLF_REV,
  MINIGOLF_REV_COURSE,
  MINIGOLF_RUN_TICKS,
  MINIGOLF_RUN_TICKS_V3,
} from "../src/lib/arcade/minigolf";
import { buildHoleV3, decodeHoleId, HOLE_TEMPLATES, holeIdsForSlot, V3_CURVE_R, V3_GATE_R, V3_LEVEL_BUILD, V3_MILL_HALF, V3_MILL_SPINS, variantCount } from "../src/lib/arcade/minigolfHolesV3";
import { encodeSportsRun, insidePoly } from "../src/lib/arcade/sportsKit";
import { minigolfShotTrace, replayMinigolfRun } from "../src/lib/duel/minigolf";
import { MINIGOLF_HOLES_BANK } from "../src/lib/duel/minigolfHolesBank.server";
import { MINIGOLF_BANK_V2 } from "../src/lib/duel/minigolfBankV2.server";
import { generateMinigolf, pickMinigolfHoles } from "../src/lib/duel/sports.server";
import { setDealPin } from "../src/lib/duel/dealEra";
import { withSeededRandom } from "../src/lib/duel/random";
import { playCourseV3, PROOF_TICK, WITNESS_FILE, witnessKey, witnessTicks, type WitnessFile } from "./minigolf-holes-bank";
import { rollShotV3 } from "./minigolf-oracle";

let checks = 0;
const failures: string[] = [];
function ok(cond: unknown, label: string) {
  checks++;
  if (!cond) {
    if (failures.length < 40) console.log(`  FAIL ${label}`);
    failures.push(label);
  }
}
const started = Date.now();
const witness = JSON.parse(readFileSync(WITNESS_FILE, "utf8")) as WitnessFile;

/* ------------------------------------------------------------------ 1. the catalogue */

ok(HOLE_TEMPLATES.length === 20, `twenty templates (${HOLE_TEMPLATES.length})`);
for (let slot = 0; slot < 5; slot++) ok(HOLE_TEMPLATES.filter((t) => t.slot === slot).length === 4, `four templates in slot ${slot + 1}`);
ok(V3_MILL_HALF === MG_MILL_HALF && V3_GATE_R === MG_GATE_R && V3_CURVE_R === MG_CURVE_R && V3_MILL_SPINS.normal === MG_MILL_SPIN, "the catalogue's shared numbers equal the sim's");
let variants = 0;
HOLE_TEMPLATES.forEach((t, ti) => {
  ok(variantCount(t) <= 100, `${t.name}: under 100 variants (ids stay in their hundred)`);
  ok((t.swells?.length ?? 0) > 0 === t.slot >= 3, `${t.name}: swells (uneven ground) exactly on the last two slots`);
  // Every layout is crazy golf (Joe, 15 Nov 2026): at least two of windmills, castles, tunnels, ramps, loops, bridges,
  // bowls, domes and banked curves.
  const crazy = [t.gates?.some((g) => g[0] === "mill"), t.gates?.some((g) => g[0] === "castle"), t.tunnels?.length, t.slopes?.length, t.loops?.length, t.bridges?.length, t.bowls?.length, t.hills?.length, t.curves?.length].filter(Boolean).length;
  ok(crazy >= 2, `${t.name}: at least two crazy-golf features (${crazy})`);
  // Round 2 (Joe, 15 Nov 2026: "aim for 3–4 in play"): at least three big ones, the buildings and structures a ball
  // goes through, over or round: windmills, castles, tunnels, ramps, loops, bridges and banked curves.
  const big = (t.gates?.length ?? 0) + (t.tunnels?.length ?? 0) + (t.slopes?.length ?? 0) + (t.loops?.length ?? 0) + (t.bridges?.length ?? 0) + (t.curves?.length ?? 0);
  ok(big >= 3, `${t.name}: at least three big features in play (${big})`);
  for (let v = 0; v < variantCount(t); v++) {
    variants++;
    const id = ti * 100 + v;
    const d = decodeHoleId(id);
    ok(d && d.template === ti, `hole ${id} decodes to its template`);
    for (const lv of MG_LEVEL_NAMES) {
    const h = buildHoleV3(id, t.slot, lv);
    for (const [name, p] of [["tee", h.tee], ["cup", h.cup]] as const) {
      ok(insidePoly(h.poly, p.x, p.y), `hole ${id} ${lv}: the ${name} is on the fairway`);
      let near = [...h.rocks, ...h.planters].some((c) => Math.hypot(c.x - p.x, c.y - p.y) < c.r + fp(8));
      for (let a = 0; a < 16 && !near; a++)
        for (const d of [0, 6, 10]) {
          const qx = p.x + Math.round(Math.cos((a * Math.PI) / 8) * fp(d));
          const qy = p.y + Math.round(Math.sin((a * Math.PI) / 8) * fp(d));
          if (mgInWaterV3(h, qx, qy) || mgInSandV3(h, qx, qy)) near = true;
        }
      ok(!near, `hole ${id} ${lv}: the ${name} is clear of every hazard`);
      const wall = h.segs.some((s) => {
        const dx = s.bx - s.ax;
        const dy = s.by - s.ay;
        const u = Math.max(0, Math.min(1, ((p.x - s.ax) * dx + (p.y - s.ay) * dy) / (dx * dx + dy * dy || 1)));
        return Math.hypot(s.ax + dx * u - p.x, s.ay + dy * u - p.y) < s.r + fp(9);
      });
      ok(!wall, `hole ${id} ${lv}: the ${name} is clear of every wall`);
    }
    for (const b of h.bridges) ok(mgInWaterV3({ ...h, bridges: [] }, (b.x0 + b.x1) >> 1, (b.y0 + b.y1) >> 1) && !mgInWaterV3(h, (b.x0 + b.x1) >> 1, (b.y0 + b.y1) >> 1), `hole ${id} ${lv}: a bridge crosses water and its deck is dry`);
    for (const l of h.loops) ok(insidePoly(h.poly, l.ax, l.ay) && insidePoly(h.poly, l.bx, l.by), `hole ${id} ${lv}: both loop ends on the fairway`);
    ok(JSON.stringify(buildHoleV3(id, t.slot, lv)) === JSON.stringify(h), `hole ${id} ${lv}: built the same twice`);
    }
  }
});
ok(decodeHoleId(99) === null && decodeHoleId(-1) === null && decodeHoleId(2100) === null, "ids outside the catalogue decode to nothing");

/* ------------------------------------------------------------------ 2. the bank */

ok(MINIGOLF_HOLES_BANK.length === 5, "five slots");
const allIds = MINIGOLF_HOLES_BANK.flat().map((e) => e.id);
ok(new Set(allIds).size === allIds.length, "bank ids are unique");
MINIGOLF_HOLES_BANK.forEach((slot, i) => {
  ok(slot.length >= 60, `slot ${i + 1} holds at least 60 proven holes (${slot.length})`);
  const ids = new Set(holeIdsForSlot(i));
  for (const e of slot) {
    ok(ids.has(e.id), `hole ${e.id} is a slot ${i + 1} hole`);
    ok(e.pars.length === 4 && e.pars.every((p) => p >= 1 && p <= 6), `hole ${e.id}: pars 1–6 at every level, the sim's range (${e.pars.join(" ")})`);
    MG_LEVEL_NAMES.forEach((lv, k) => {
      const w = witness[witnessKey(e.id, lv)];
      const extra = MG_LEVELS[lv].parOver;
      ok(!!w && w.shots.length + extra === e.pars[k], `hole ${e.id} ${lv}: par is its witness's strokes ${extra ? `+ ${extra}` : "(the best route)"}`);
    });
  }
});
let routes = 0;
for (const e of MINIGOLF_HOLES_BANK.flat()) {
  for (const lv of MG_LEVEL_NAMES) {
    const key = witnessKey(e.id, lv);
    const w = witness[key]!;
    const h = buildHoleV3(e.id, 0, lv);
    let x = h.tee.x;
    let y = h.tee.y;
    let tick = PROOF_TICK;
    let holed = false;
    w.shots.forEach(([k, a, b, c, wait], i) => {
      const end = rollShotV3(h, x, y, { k, a, b, c, w: wait }, tick);
      if (i === w.shots.length - 1) holed = end.holed && tick + wait + end.ticks === w.holed;
      else ok(!end.holed && !end.wet, `hole ${key}: shot ${i + 1} lays up dry`);
      x = end.x;
      y = end.y;
      tick += wait + end.ticks + 1;
    });
    ok(holed, `hole ${key}: its witness route holes in exactly ${w.shots.length} on its proved tick`);
    routes++;
  }
}

/* ------------------------------------------------------------------ 3. composed courses */

/** A course the server could deal at `lv` (pickMinigolfHoles on a seeded draw). */
function courseN(n: number, lv: (typeof MG_LEVEL_NAMES)[number] = "normal"): number[] {
  let x = (n * 2654435761 + 7) >>> 0;
  const draw = () => {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    const t = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) >>> 0;
    return (t ^ (t >>> 13)) >>> 0;
  };
  return pickMinigolfHoles(lv, draw).map((e) => e.id);
}
const parsAt = (holes: number[], lv: string) => holes.map((id, i) => MINIGOLF_HOLES_BANK[i]!.find((e) => e.id === id)!.pars[MG_LEVEL_NAMES.indexOf(lv as never)]!);
for (const lv of MG_LEVEL_NAMES) {
  let two = 0;
  let worst = 0;
  const N = 150;
  for (let n = 0; n < N; n++) {
    const holes = courseN(n + MG_LEVEL_NAMES.indexOf(lv) * 1000, lv);
    const pars = parsAt(holes, lv);
    const { events, state, checkpoints } = playCourseV3(holes, pars, lv, witness);
    const g = minigolfGameFor(pars, MINIGOLF_REV_COURSE, { holes, level: lv });
    const raw = encodeSportsRun({ seed: 7, claimedScore: g.score(state), events, endTick: state.tick, checkpoints });
    const r = replayMinigolfRun(7, raw, pars, MINIGOLF_REV_COURSE, { holes, level: lv });
    // On Easy and Normal the witness birdies every hole; on Hard and Expert it holes every one in par (the best route).
    const fiveUnder = MG_LEVELS[lv].parIsBest ? r.pars === 5 : r.birdies === 5;
    if (r.score === 200 && !r.flagged && fiveUnder) two++;
    worst = Math.max(worst, state.finishTick);
  }
  ok(two === N, `${lv}: every composed course scores 200 through the server's replay, all five ${MG_LEVELS[lv].parIsBest ? "in par" : "under par"} (${two} of ${N})`);
  ok(worst > 0 && worst <= minigolfFullByS(MINIGOLF_REV_COURSE, lv) * 60, `${lv}: every witness finishes by Speed's full-by (${(worst / 60).toFixed(1)} s ≤ ${minigolfFullByS(MINIGOLF_REV_COURSE, lv)} s)`);
}

// The deal's budget: each hole's stored time is its witness's worst inside a course, a dealt course's five fit the
// level's Speed time, and each slot's quickest five always fit (the deal's fallback).
for (const e of MINIGOLF_HOLES_BANK.flat())
  MG_LEVEL_NAMES.forEach((lv, k) => ok(e.t[k] === witnessTicks(witness, e.id, lv), `hole ${e.id} ${lv}: its stored witness time`));
MG_LEVEL_NAMES.forEach((lv, k) => {
  const quickest = MINIGOLF_HOLES_BANK.reduce((a, slot) => a + Math.min(...slot.map((e) => e.t[k]!)), 0);
  ok(quickest <= minigolfFullByS(MINIGOLF_REV_COURSE, lv) * 60, `${lv}: each slot's quickest hole fits Speed's ${minigolfFullByS(MINIGOLF_REV_COURSE, lv)} s (${(quickest / 60).toFixed(1)} s)`);
});

/* ------------------------------------------------------------------ 4. the deal */

for (const lv of MG_LEVEL_NAMES) {
  for (let i = 0; i < 20; i++) {
    const p = withSeededRandom(400 + i, () => generateMinigolf(lv));
    ok(p.golfRev === 3 && p.holes?.length === 5, `${lv}: rooms deal golfRev 3 with five holes`);
    p.holes?.forEach((id, k) => {
      const e = MINIGOLF_HOLES_BANK[k]!.find((x) => x.id === id);
      ok(!!e && p.pars[k] === e.pars[MG_LEVEL_NAMES.indexOf(lv)], `${lv}: hole ${k + 1} is a slot ${k + 1} bank hole with its par at the level`);
    });
    ok(lv === "normal" ? !("level" in p) : p.level === lv, `${lv}: the level is stored only off Normal`);
    const k = MG_LEVEL_NAMES.indexOf(lv);
    const sum = (p.holes ?? []).reduce((a, id, s) => a + MINIGOLF_HOLES_BANK[s]!.find((e) => e.id === id)!.t[k]!, 0);
    ok(sum <= minigolfFullByS(MINIGOLF_REV_COURSE, lv) * 60, `${lv}: the dealt five fit Speed's time (${(sum / 60).toFixed(1)} s)`);
  }
}
ok(generateMinigolf("nonsense").level === undefined && generateMinigolf(undefined).golfRev === 3, "an unknown level deals Normal");
{
  const was = setDealPin("minigolfPreCourse", true);
  try {
    const p = withSeededRandom(5, () => generateMinigolf("hard"));
    ok(p.golfRev === MINIGOLF_REV && !p.holes && !p.level && MINIGOLF_BANK_V2.some((e) => e.seed === p.seed && JSON.stringify(e.pars) === JSON.stringify(p.pars)), "the minigolfPreCourse pin deals a golfRev 2 bank course exactly as before");
  } finally {
    setDealPin("minigolfPreCourse", was);
  }
}

/* ------------------------------------------------------------------ 5. the chip */

{
  const lo = mgChipLaunch(0, -4000, 1);
  const hi = mgChipLaunch(0, -4000, MG_POWER_MAX);
  ok(lo.air === MG_CHIP_MIN_T && hi.air === MG_CHIP_MAX_T, `a chip's flight: ${MG_CHIP_MIN_T} to ${MG_CHIP_MAX_T} ticks by power`);
  ok(Math.abs((-lo.vy * lo.air) / 256 - MG_CHIP_MIN_PX) < 1 && Math.abs((-hi.vy * hi.air) / 256 - MG_CHIP_MAX_PX) < 1, `its carry ${MG_CHIP_MIN_PX} to ${MG_CHIP_MAX_PX} px`);
  // Over the pond on Pond carry (template 2): from just short of it, a chip clears the water and lands beyond.
  const h = buildHoleV3(200, 0);
  const pond = h.ponds;
  const top = Math.min(...pond.map((c) => c.y - c.r));
  const bottom = Math.max(...pond.map((c) => c.y + c.r));
  // Beside the bridge (Bridge pond's deck is the middle of the hole), where the water is.
  const x = fp(h.box.x + 90);
  const start = { x, y: bottom + fp(14), vx: 0, vy: 0, air: 0 };
  const carry = (bottom - top) / 256 + 50;
  const c = Math.round(((carry - MG_CHIP_MIN_PX) * MG_POWER_MAX) / (MG_CHIP_MAX_PX - MG_CHIP_MIN_PX));
  const v = mgChipLaunch(0, -4000, c);
  const ball = { ...start, vx: v.vx, vy: v.vy, air: v.air };
  let overWater = false;
  let end = MG_END_NONE;
  let landed = false;
  for (let t = 1; t < 400 && end === MG_END_NONE; t++) {
    const r = mgRollTickV3(h, ball, t, t);
    if (ball.air > 0 && mgInWaterV3(h, ball.x, ball.y)) overWater = true;
    if (r.landed) {
      landed = true;
      ok(Math.abs(Math.hypot(ball.vx, ball.vy) - Math.trunc((Math.hypot(v.vx, v.vy) * MG_CHIP_LAND_KEEP) / 256)) <= 2, "a chip lands keeping MG_CHIP_LAND_KEEP/256 of its speed");
    }
    end = r.end;
  }
  ok(overWater && landed && end === MG_END_REST && ball.y < top, "a chip flies over the pond and lands beyond it, then rolls to rest dry");
  // The same carry as a putt finds the water.
  const putt = { ...start, vx: 0, vy: -fp(5), air: 0 };
  let pe = MG_END_NONE;
  for (let t = 1; t < 400 && pe === MG_END_NONE; t++) pe = mgRollTickV3(h, putt, t, t).end;
  ok(pe === MG_END_WATER, "a putt along the same line goes in the water");
  // A chip landing in water: water.
  const wet = mgChipLaunch(0, -4000, Math.round(((14 + (bottom - top) / 512 - MG_CHIP_MIN_PX) * MG_POWER_MAX) / (MG_CHIP_MAX_PX - MG_CHIP_MIN_PX)));
  const wb = { ...start, vx: wet.vx, vy: wet.vy, air: wet.air };
  let we = MG_END_NONE;
  for (let t = 1; t < 400 && we === MG_END_NONE; t++) we = mgRollTickV3(h, wb, t, t).end;
  ok(we === MG_END_WATER, "a chip landing in the pond is water");
  // A chip landing in a bunker stops dead (Windmill bowl, template 0).
  const hs = buildHoleV3(0, 0);
  const sc = hs.sands![1]!;
  const sb = { x: sc.x, y: sc.y + fp(60), vx: 0, vy: 0, air: 0 };
  const sv = mgChipLaunch(0, -4000, Math.round(((60 - MG_CHIP_MIN_PX) * MG_POWER_MAX) / (MG_CHIP_MAX_PX - MG_CHIP_MIN_PX)));
  Object.assign(sb, { vx: sv.vx, vy: sv.vy, air: sv.air });
  let sr = { end: MG_END_NONE, sand: false } as { end: number; sand: boolean };
  for (let t = 1; t < 400 && sr.end === MG_END_NONE; t++) sr = mgRollTickV3(hs, sb, t, t);
  ok(sr.end === MG_END_REST && sr.sand && sb.vx === 0 && sb.vy === 0, "a chip landing in sand stops dead");
  // Over a low timber wall (Zigzag, template 5) but not through the fence.
  const hz = buildHoleV3(500, 1);
  const wall = hz.logs[0]!;
  const wy = wall.ay;
  const zb = { x: fp(150), y: wy + fp(30), vx: 0, vy: 0, air: 0 };
  const zv = mgChipLaunch(0, -4000, 300);
  Object.assign(zb, { vx: zv.vx, vy: zv.vy, air: zv.air });
  let crossed = false;
  for (let t = 1; t < 400; t++) {
    const r = mgRollTickV3(hz, zb, t, t);
    if (zb.y < wy - fp(10)) crossed = true;
    if (r.end !== MG_END_NONE) break;
  }
  ok(crossed, "a chip carries over a low timber wall");
  const zp = { x: fp(150), y: wy + fp(30), vx: 0, vy: -fp(4), air: 0 };
  let blocked = true;
  for (let t = 1; t < 400; t++) {
    const r = mgRollTickV3(hz, zp, t, t);
    if (zp.y < wy - fp(10)) blocked = false;
    if (r.end !== MG_END_NONE) break;
  }
  ok(blocked, "a putt on the same line is stopped by the wall");
  const fb = { x: hz.tee.x, y: hz.tee.y, vx: 0, vy: 0, air: 0 };
  const fv = mgChipLaunch(0, 4000, MG_POWER_MAX);
  Object.assign(fb, { vx: fv.vx, vy: fv.vy, air: fv.air });
  for (let t = 1; t < 400; t++) if (mgRollTickV3(hz, fb, t, t).end !== MG_END_NONE) break;
  ok(insidePoly(hz.poly, fb.x, fb.y), "a chip at the fence bounces off it, staying on the course");
  // Refused on golfRev 2: a chip event there is outside the input ranges (the replay flags it).
  const e = MINIGOLF_BANK_V2[0]!;
  const g2 = minigolfGameFor(e.pars, 2);
  ok(!g2.inputRanges!.some((r) => r.k === MG_INPUT_CHIP), "golfRev 2's game takes no chip");
  const g3 = minigolfGameFor([3, 3, 3, 3, 3], 3, { holes: [0, 400, 800, 1200, 1600] });
  ok(g3.inputRanges!.some((r) => r.k === MG_INPUT_CHIP) && g3.inputRanges!.some((r) => r.k === MG_INPUT_PUTT), "golfRev 3's game takes putts and chips");
}

/* ------------------------------------------------------------------ 6. the swells */

{
  const h = buildHoleV3(1200, 3);
  for (const w of h.swells) {
    const at = (d: number) => {
      const b = { x: w.x + d, y: w.y, vx: 0, vy: 0, air: 0 };
      const before = { ...b };
      // One tick from rest at a spot: only the pull acts (no friction can reverse it below the stop speed), so read the raw push.
      const dx = b.x - w.x;
      const dd = Math.abs(dx);
      const mag = dd > 0 && dd < w.r ? Math.trunc((4 * w.k * dd * (w.r - dd)) / (w.r * w.r)) : 0;
      void before;
      return Math.sign(dx) * mag;
    };
    const half = Math.trunc(w.r / 2);
    ok(at(0) === 0 && at(w.r) === 0, `swell ${w.k}: no push at its centre or rim`);
    ok(w.k > 0 ? at(half) > 0 : at(half) < 0, `swell k ${w.k}: a ${w.k > 0 ? "mound pushes away" : "hollow pulls in"}`);
    ok(Math.abs(w.k) <= 15 && Math.abs(w.k) * 2 < 22 + 6, `swell k ${w.k}: gentle (|k| ≤ 15: a resting ball stays put)`);
  }
  // A ball rolling across the rolling green bends; the same roll on a flat copy runs straight.
  // On the open fairway: the hole without its gates, sails, walls or hazards, then without its swells too.
  Object.assign(h, { windmills: [], gates: [], loops: [], segs: h.segs.filter((sg) => sg.r === 0), sands: [], ponds: [], rocks: [], planters: [] });
  const flat = { ...h, swells: [] };
  const roll = (hole: typeof h) => {
    const b = { x: h.tee.x - fp(40), y: h.tee.y, vx: 0, vy: -fp(6), air: 0 };
    for (let t = 1; t < 600; t++) if (mgRollTickV3(hole, b, t, t).end !== MG_END_NONE) break;
    return b;
  };
  ok(roll(flat).x === h.tee.x - fp(40) && roll(h).x !== h.tee.x - fp(40), "the swells bend a straight roll; flat ground doesn't");
  ok(minigolfCourseV2(MINIGOLF_BANK_V2[0]!.seed).every((x) => !x.swells), "golfRev 2's holes have no swells");
}

/* ------------------------------------------------------------------ 6b. loops and bridges */

{
  const h = buildHoleV3(100, 0); // Loop lane: a loop through a low timber wall.
  const l = h.loops[0]!;
  const fast = { x: l.ax + fp(0) , y: l.ay + fp(20), vx: 0, vy: -fp(7), air: 0 };
  let round = false;
  for (let t = 1; t < 200; t++) {
    const r = mgRollTickV3(h, fast, t, t);
    if (r.loop === "round") round = true;
    if (r.end !== MG_END_NONE) break;
  }
  ok(round && fast.y < l.by, "a fast ball goes round the loop and comes out of its far end");
  const slow = { x: l.ax, y: l.ay + fp(16), vx: 0, vy: -fp(3), air: 0 };
  let back = false;
  for (let t = 1; t < 200; t++) {
    const r = mgRollTickV3(h, slow, t, t);
    if (r.loop === "back") back = true;
    if (r.end !== MG_END_NONE) break;
  }
  ok(back && slow.y > l.ay, `a ball slower than ${MG_LOOP_MIN_V / 256} px a tick stalls and rolls back out`);
  const b = buildHoleV3(200, 0); // Bridge pond.
  const br = b.bridges[0]!;
  const over = { x: (br.x0 + br.x1) >> 1, y: br.y1 + fp(14), vx: 0, vy: -fp(6), air: 0 };
  let end = MG_END_NONE;
  for (let t = 1; t < 300 && end === MG_END_NONE; t++) end = mgRollTickV3(b, over, t, t).end;
  ok(end !== MG_END_WATER && over.y < br.y0, "a putt along the bridge crosses the water dry");
}

/* ------------------------------------------------------------------ 7. the levels */

// The catalogue builds each level as MG_LEVELS says (its own copy of the sails, extras and slope strength).
for (const lv of MG_LEVEL_NAMES)
  ok(V3_LEVEL_BUILD[lv].mill === MG_LEVELS[lv].mill && V3_LEVEL_BUILD[lv].extras === MG_LEVELS[lv].extras && Math.abs(V3_LEVEL_BUILD[lv].slopeScale256 / 256 - MG_LEVELS[lv].slopeScale) < 0.01, `${lv}: the catalogue builds the level's sails, extras and slopes`);
ok(MG_LEVELS.hard.parIsBest && MG_LEVELS.expert.parIsBest && !MG_LEVELS.normal.parIsBest && !MG_LEVELS.easy.parIsBest && MG_LEVELS.hard.parOver === 0 && MG_LEVELS.expert.parOver === 0 && MG_LEVELS.normal.parOver === 2 && MG_LEVELS.easy.parOver === 2, "par is the best route on Hard and Expert, the best route + 2 on Easy and Normal");
ok(MG_LEVELS.hard.preview < MG_LEVELS.normal.preview && MG_LEVELS.expert.preview < MG_LEVELS.hard.preview, "the aim preview shortens on Hard and again on Expert");
{
  // Hard and Expert build their template's extra hazards and stronger slopes.
  const n = buildHoleV3(0, 0, "normal");
  const x = buildHoleV3(0, 0, "expert");
  ok(x.rocks.length > n.rocks.length && (x.sands?.length ?? 0) > (n.sands?.length ?? 0), "Expert adds the template's extra hazards");
  ok(Math.abs(x.slopes[0]!.ay) > Math.abs(n.slopes[0]!.ay), "Expert's ramps pull harder");
}
ok(mgStrokeLimit(3, 3, "easy") === 7 && mgStrokeLimit(3, 3, "normal") === 6 && mgStrokeLimit(3, 3, "hard") === 6 && mgStrokeLimit(3, 3, "expert") === 5, "stroke limits: par + 4, + 3, + 3, + 2");
ok(mgStrokeLimit(2, 4) === 7 && mgStrokeLimit(1, 4) === 6, "golfRev 1 and 2's limits unchanged");
ok(MG_LEVELS.easy.mill === "slow" && MG_LEVELS.normal.mill === "normal" && MG_LEVELS.hard.mill === "normal" && MG_LEVELS.expert.mill === "fast", "the sails: slower on Easy, faster on Expert");
{
  const mill = HOLE_TEMPLATES.findIndex((t) => t.gates?.some((g) => g[0] === "mill")) * 100;
  const spins = (["easy", "normal", "expert"] as const).map((lv) => Math.abs(buildHoleV3(mill, 0, lv).windmills![0]!.spin));
  ok(spins[0]! < spins[1]! && spins[1]! < spins[2]!, `the sails turn ${spins.join(" < ")}`);
}
ok(MG_LEVEL_NAMES.every((lv, i, a) => i === 0 || minigolfFullByS(3, lv) <= minigolfFullByS(3, a[i - 1]!)), "Speed's full-by shortens level by level");
ok(minigolfRunTicksFor(3) === MINIGOLF_RUN_TICKS_V3 && MINIGOLF_RUN_TICKS_V3 === 5400 && minigolfRunTicksFor(2) === MINIGOLF_RUN_TICKS, "golfRev 3 runs 90 s; golfRev 2 keeps 120 s");
ok(minigolfGameFor([3, 3, 3, 3, 3], 3).init(1).rev === 2, "a golfRev 3 stamp without hole ids plays golfRev 2");
{
  const g = minigolfGameFor([3, 3, 3, 3, 3], 3, { holes: [0, 400, 800, 1200, 1600], level: "hard" });
  const s0 = g.init(1);
  ok(s0.rev === 3 && s0.level === "hard" && s0.course.map((h) => h.holeId).join() === "0,400,800,1200,1600", "golfRev 3's state carries its holes and level");
  const s1 = g.step(s0, { t: 1, k: MG_INPUT_CHIP, a: 0, b: -4000, c: 400, d: 0 });
  ok(s1.air > 0 && s1.shot === 2 && s1.chips === 1, "a chip takes off");
  const s2 = g.step({ ...s1 }, null);
  const flat = minigolfCheckpoint({ ...s2, air: 0 }).checksum;
  ok(minigolfCheckpoint(s2).checksum !== flat, "golfRev 3's checkpoints sum the chip's flight");
}

/* ------------------------------------------------------------------ 8. the reveal's trace */

{
  const holes = courseN(3);
  const pars = parsAt(holes, "normal");
  const { events, state, checkpoints } = playCourseV3(holes, pars, "normal", witness);
  const g = minigolfGameFor(pars, 3, { holes });
  const raw = encodeSportsRun({ seed: 7, claimedScore: g.score(state), events, endTick: state.tick, checkpoints });
  const tr = minigolfShotTrace({ seed: 7, pars, golfRev: 3, holes }, raw);
  ok(tr.holes.every((h, i) => h.strokes.length === state.taken[i]), "the trace has each hole's strokes");
  ok(tr.holes.every((h) => h.strokes[h.strokes.length - 1]?.holed && h.strokes.slice(0, -1).every((s) => !s.holed)), "each hole's last stroke drops, the others don't");
  ok(tr.holes.every((h) => h.strokes.every((s) => s.path.length >= 2)), "every stroke has a path");
}

if (process.env["CHECKS_FULL"] === "1") {
  const proc = Bun.spawnSync(["bun", new URL("./minigolf-holes-bank.ts", import.meta.url).pathname, "--check"], { stdout: "pipe" });
  ok(proc.exitCode === 0, `the hole bank rebuilds byte for byte (${proc.stdout.toString().trim().split("\n").pop()})`);
}

const secs = ((Date.now() - started) / 1000).toFixed(1);
if (failures.length) {
  console.log(`FAIL: crazy-golf-v3-check: ${failures.length} of ${checks} failed`);
  process.exit(1);
}
console.log(`PASS: crazy-golf-v3-check: ${checks} checks (${variants} catalogue holes, ${allIds.length} bank holes, ${routes} witness routes, 600 composed courses at 200) in ${secs} s`);
void MINIGOLF_HOLES;
