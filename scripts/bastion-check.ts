/**
 * Iron Wall (id bastion; bastionRev 2, 1 Nov 2026, and bastionRev 3, 3 Nov 2026; docs/arcade-standard/bastion.md): the
 * tank-defence shooter, and the original Bastion it replaces in rooms.
 *
 *  1. the original Bastion replays exactly as before: 40 unstamped runs recorded on main 9486004
 *     (scripts/fixtures/bastion-legacy.json, scripts/bastion-legacy-record.ts) give the same score, destroyed count,
 *     health, end tick and final checksum, through replayBastionRun and through gradeAnswer on an unstamped puzzle;
 *  2. the deal: rooms and practice deal bastionRev 2; Bastion is active (not retired), in the Action group, 200 a round;
 *  3. the plan comes from the seed alone and every seed deals the same 30 tanks (63 hit points, 38 weak-spot chances)
 *     in the same five wave shapes, inside each wave's window, never two in a row on one lane;
 *  4. the rules on built runs: a weak-spot hit does double damage while the spot is exposed (60 of every 90 ticks,
 *     a seeded phase per tank; closed, it is a hull hit), a hull hit one, the front-most tank takes the shell,
 *     shells land 18–30 ticks after the shot (higher = longer), five shells, the gun reloads itself when empty
 *     (120 ticks), a swipe reloads early (never when full), a tap in the green finishes at half time, outside it jams
 *     for 30 ticks more, one tap a reload; three base hits end the run;
 *  5. the parts: Armour 140 on a straight line (of 60), Weak spots 1 each to 30, Fast reloads 2 each to 10, Base intact
 *     10 / 5 / 0 (0 when it fell); no input 0, any input at least 1; the help states every part and 200;
 *  6. the oracle (scripts/bastion-oracle.ts) takes every tuning seed (0–59) and fresh seed (10000–10199) to exactly 200
 *     through the server replay and gradeAnswer; a replay is deterministic and a tampered claim is flagged;
 *  7. the skill-band bots rise weak → flawless on 40 seeds (medians strictly rising, flawless 200);
 *  8. art: every tank's drawn hull, turret and weak spot are the sim's rectangles (bastionTankRects), checked by
 *     recording the renderer's fills and paths on a fake context;
 *  9. bastionRev 3 (Iron Wall): rev-2 runs recorded on main 63261010 (scripts/fixtures/bastion-rev2-legacy.json,
 *     scripts/bastion-rev2-legacy-record.ts) replay and grade exactly as before; rev 3 keeps rev 2's plan with waves 4–5
 *     eased (80 % and 104 %, were 100 % and 134 %), a 45 ‰ (90 ms) green zone, three seeded drones (from the seed alone,
 *     each inside its window, flying straight at 4 px a tick, a shell on its rectangle downs it, never touching the base,
 *     the run waiting for the last one), its five parts (Armour 110, Weak spots 30, Fast reloads 20, Drones 10 each to 30,
 *     Base intact 10), the oracle at 200 on 260 seeds through the server, rising bands, the drone drawn on its rectangle
 *     and the lane-edge scenery outside the road.
 *
 *   bun scripts/bastion-check.ts
 */
import { readFileSync } from "node:fs";
import { recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { bastionGame, basCheckpoint } from "../src/lib/arcade/bastion";
import {
  bastionFlight,
  bastionPlan,
  bastionWeakOpen,
  BT2_WEAK_CYCLE,
  bastionStdParts,
  bastionTankCheckpoint,
  bastionTankGame,
  bastionTankRects,
  bastionTankScore,
  bastionZoneStart,
  BASTION_REV_DEALT,
  BASTION_REV_TANK,
  BT2_BASE,
  BT2_CHECKPOINT_INTERVAL,
  BT2_FAR,
  BT2_FLIGHT_MAX,
  BT2_FLIGHT_MIN,
  BT2_HP,
  BT2_HORIZON_Y,
  BT2_INPUT_AIM,
  BT2_INPUT_FIRE,
  BT2_INPUT_RANGES,
  BT2_INPUT_RELOAD,
  BT2_INPUT_TAP,
  BT2_MAG,
  BT2_RELOAD_TICKS,
  BT2_SPEED,
  BT2_TANKS,
  BT2_TOTAL_HP,
  BT2_WALL_Y,
  BT2_WAVES,
  BT2_WAVE_START,
  BT2_WAVE_WINDOW,
  BT2_WEAK_POSSIBLE,
  BT2_ZONE_W,
  type BastionTankState,
  type Bt2Tank,
} from "../src/lib/arcade/bastionTank";
import { paintDrone, paintTank, BT_SCENERY, BT2_PIP_BACK, BT2_PIP_EMPTY, BT2_PIP_FILL } from "../src/lib/arcade/bastionTank.renderer";
import {
  bastionDronePos,
  bastionDroneRect,
  bastionDrones,
  bastionDronesGone,
  bastionIronGame,
  bastionTankGameFor,
  bastionWavePace,
  bastionZoneW,
  BASTION_REV_IRON,
  BT2_WAVE_PACE,
  BT3_DRONES,
  BT3_DRONE_SPEED,
  BT3_DRONE_TICKS,
  BT3_DRONE_WINDOW,
  BT3_DRONE_WINDOW_AT,
  BT3_DRONE_Y_MAX,
  BT3_DRONE_Y_MIN,
  BT3_WAVE_PACE,
  BT3_ZONE_W,
} from "../src/lib/arcade/bastionTank";
import { encodeBastionTankRun, replayBastionRun, replayBastionTankRun } from "../src/lib/duel/bastion";
import { generateBastion } from "../src/lib/duel/arcade.server";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { PUZZLE_REGISTRY, isRetired } from "../src/lib/duel/registry";
import { arcadeGroupOf } from "../src/lib/duel/arcadeGroups";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { bastionPlay, bastionPlayLog } from "./bastion-oracle";
import { bot } from "./arcade-skill-bands/bots/bastion";
import { ALL_LEVELS, Human } from "./arcade-skill-bands/human";

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
const game = bastionTankGame;

/* 1. The original Bastion, unchanged. */
{
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/bastion-legacy.json", import.meta.url), "utf8")) as {
    runs: { seed: number; raw: string; score: number; destroyed: number; health: number; survived: boolean; flagged: boolean; checksum: number; tick: number }[];
  };
  ok(fixture.runs.length === 40, `40 legacy runs (${fixture.runs.length})`);
  for (const r of fixture.runs) {
    const out = replayBastionRun(r.seed, r.raw);
    const same = out.score === r.score && out.destroyed === r.destroyed && out.health === r.health && out.survived === r.survived && out.flagged === r.flagged && basCheckpoint(out.state).checksum === r.checksum && out.state.tick === r.tick;
    ok(same, `legacy seed ${r.seed}: replays as on main (score ${out.score} vs ${r.score})`);
    const g = gradeAnswer({ type: "bastion", seed: r.seed }, r.raw, 0);
    ok(g.score === r.score, `legacy seed ${r.seed}: gradeAnswer on an unstamped puzzle scores ${g.score} (main ${r.score})`);
  }
  ok(bastionGame.runTicks === 3600 && bastionGame.key === "bastion", "the original sim is still the original");
}

/* 2. The deal. */
{
  const dealt = Array.from({ length: 20 }, () => generateBastion());
  ok(dealt.every((p) => p.type === "bastion" && p.bastionRev === BASTION_REV_IRON && p.seed > 0), "rooms deal bastionRev 3 on a fresh seed");
  ok(BASTION_REV_DEALT === 3 && BASTION_REV_TANK === 2, "the dealt stamp is 3 (rev 2 still replays)");
  const def = PUZZLE_REGISTRY.bastion;
  ok((def.generate() as { bastionRev?: number }).bastionRev === 3, "the registry's practice puzzle is bastionRev 3");
  ok(!isRetired("bastion"), "Iron Wall is active (dealt in rooms)");
  ok(arcadeGroupOf("bastion") === "action", "Iron Wall is in the Action group");
  ok(roundMaxFor("bastion") === 200, "Iron Wall's round maximum is 200");
  ok(def.name === "Iron Wall", `shown as Iron Wall (${def.name})`);
}

/* 3. The plan. */
{
  const shapes = JSON.stringify(BT2_WAVES);
  ok(BT2_TANKS === 30 && BT2_TOTAL_HP === 63 && BT2_WEAK_POSSIBLE === 38, `30 tanks, 63 HP, 38 weak-spot chances (${BT2_TANKS}, ${BT2_TOTAL_HP}, ${BT2_WEAK_POSSIBLE})`);
  for (const seed of [1, 7, 42, 99999, 123456789, 2147483646, -5]) {
    const plan = bastionPlan(seed);
    ok(JSON.stringify(plan) === JSON.stringify(bastionPlan(seed)), `seed ${seed}: the plan is the seed's alone`);
    ok(plan.length === BT2_TANKS, `seed ${seed}: 30 tanks`);
    const counts = BT2_WAVES.map((_, w) => [0, 1, 2].map((k) => plan.filter((t) => t.wave === w && t.kind === k).length));
    ok(JSON.stringify(counts) === shapes, `seed ${seed}: the five wave shapes`);
    ok(plan.every((t) => t.spawn >= BT2_WAVE_START[t.wave]! && t.spawn < BT2_WAVE_START[t.wave]! + BT2_WAVE_WINDOW), `seed ${seed}: every tank in its wave's window`);
    ok(plan.every((t, i) => i === 0 || t.spawn > plan[i - 1]!.spawn), `seed ${seed}: spawns in order`);
    ok(plan.every((t, i) => i === 0 || t.lane !== plan[i - 1]!.lane), `seed ${seed}: never two in a row on one lane`);
    ok(plan.every((t) => (t.chg === 1 || t.chg === 2) && t.chgZ >= 400 && t.chgZ < 900), `seed ${seed}: every tank changes speed once, at a depth in range`);
    ok(plan.every((t) => t.wphase >= 0 && t.wphase < BT2_WEAK_CYCLE), `seed ${seed}: weak-spot phases in range`);
  }
}

/* 4. The rules, on built runs. */
const run = (seed: number, events: ArcadeInputEvent[], until = Infinity): BastionTankState => {
  let s = game.init(seed);
  const at = new Map(events.map((e) => [e.t, e]));
  while (!game.isOver(s) && s.tick < until) s = game.step(s, at.get(s.tick + 1) ?? null);
  return s;
};
const ev = (t: number, k: number, a = 0, b = 0): ArcadeInputEvent => ({ t, k, a, b, c: 0, d: 0 });
const run3 = (seed: number, events: ArcadeInputEvent[]): BastionTankState => {
  let s = bastionIronGame.init(seed);
  const at = new Map(events.map((e) => [e.t, e]));
  while (!bastionIronGame.isOver(s)) s = bastionIronGame.step(s, at.get(s.tick + 1) ?? null);
  return s;
};
const BT2_RUN_TICKS_LOCAL = bastionTankGame.runTicks;
{
  ok(bastionFlight(BT2_WALL_Y) === BT2_FLIGHT_MIN && bastionFlight(BT2_HORIZON_Y) === BT2_FLIGHT_MAX && bastionFlight(400) > bastionFlight(550), "flight: 18 ticks at the wall's line, 30 at the horizon, longer the higher");
  // A state with one tank of each kind placed by hand, nothing else spawning (the plan's spawns pushed out of reach).
  // The weak spot of seed 5's first tank: a start tick whose shell (aimed at z 300's weak spot) lands while it is
  // exposed, and one that lands while it is closed.
  const p0 = bastionPlan(5)[0]!;
  const startFor = (open: boolean, kind: number) => {
    const r = bastionTankRects(kind, 1, 300 * 256);
    const fl = bastionFlight(Math.floor((r.weak[1] + r.weak[3]) / 2));
    for (let t = 400; ; t++) if (bastionWeakOpen(p0, t + 1 + fl) === open) return t;
  };
  const placed = (kind: number, z: number, tick = 400): BastionTankState => {
    const s = game.init(5);
    const t: Bt2Tank = { i: 0, kind, lane: 1, z: z * 256, v: 0, hp: BT2_HP[kind]!, changed: 1, flash: 0 };
    return { ...s, tick, nextSpawn: BT2_TANKS, tanks: [t] };
  };
  const shoot = (s0: BastionTankState, x: number, y: number) => {
    let s = game.step(s0, ev(s0.tick + 1, BT2_INPUT_FIRE, x, y));
    const lands = s.shells[0]?.at ?? 0;
    while (s.tick < lands && !game.isOver(s)) s = game.step(s, null);
    return s;
  };
  for (const kind of [0, 1, 2]) {
    const s0 = placed(kind, 300, startFor(true, kind));
    const r = bastionTankRects(kind, 1, 300 * 256);
    const wx = Math.floor((r.weak[0] + r.weak[2]) / 2);
    const wy = Math.floor((r.weak[1] + r.weak[3]) / 2);
    const weak = shoot(s0, wx, wy);
    ok(weak.weak === 1 && weak.destroyedHp === Math.min(2, BT2_HP[kind]!), `kind ${kind}: a weak-spot hit does 2 (${weak.destroyedHp})`);
    const shut = shoot(placed(kind, 300, startFor(false, kind)), wx, wy);
    ok(shut.weak === 0 && shut.hits === 1 && shut.destroyedHp === 1, `kind ${kind}: the weak spot closed, the same shot is a hull hit (1)`);
    const hx = r.hull[0] + 2;
    const hy = r.hull[3] - 2;
    const hull = shoot(s0, hx, hy);
    ok(hull.weak === 0 && hull.destroyedHp === 1 && hull.hits === 1, `kind ${kind}: a hull hit does 1`);
    const miss = shoot(s0, 10, 300);
    ok(miss.hits === 0 && miss.destroyedHp === 0 && miss.impacts.some((m) => m.r === 0), `kind ${kind}: a miss does nothing`);
    ok(weak.shells.length === 0 && weak.mag === BT2_MAG - 1, `kind ${kind}: one shell spent`);
  }
  {
    // The front-most tank takes the shell: two in one lane, the near one covering the far one's point.
    const s = game.init(5);
    const near: Bt2Tank = { i: 0, kind: 2, lane: 1, z: 200 * 256, v: 0, hp: 4, changed: 1, flash: 0 };
    const far: Bt2Tank = { i: 1, kind: 0, lane: 1, z: 500 * 256, v: 0, hp: 1, changed: 1, flash: 0 };
    const rn = bastionTankRects(2, 1, near.z);
    const rf = bastionTankRects(0, 1, far.z);
    const x = Math.floor((rf.hull[0] + rf.hull[2]) / 2);
    const y = Math.floor((rf.hull[1] + rf.hull[3]) / 2);
    const covered = x >= rn.hull[0] && x <= rn.hull[2] && y >= rn.turret[1] && y <= rn.hull[3];
    let st = game.step({ ...s, tick: 400, nextSpawn: BT2_TANKS, tanks: [near, far] }, ev(401, BT2_INPUT_FIRE, x, y));
    while (st.shells.length) st = game.step(st, null);
    ok(!covered || (st.tanks.find((t) => t.i === 0)!.hp < 4 && st.tanks.some((t) => t.i === 1)), `the front tank takes a shell aimed through it (covered ${covered})`);
  }
  {
    // Magazine and reloads.
    // A parked tank far off keeps the field from emptying (an empty field ends the run).
    const parked: Bt2Tank = { i: 0, kind: 0, lane: 0, z: BT2_FAR * 256, v: 0, hp: 1, changed: 1, flash: 0 };
    const s0 = { ...game.init(5), tick: 400, nextSpawn: BT2_TANKS, tanks: [parked] };
    let s = s0;
    const fireAt = (st: BastionTankState, t: number) => game.step(st, ev(t, BT2_INPUT_FIRE, 195, 400));
    for (let i = 0; i < 5; i++) {
      s = fireAt(s, s.tick + 1);
      for (let k = 0; k < 15; k++) s = game.step(s, null);
    }
    ok(s.mag === 0 && s.reloadAt >= 0 && s.shots === 5, `five shells, then it reloads by itself (${s.mag}, ${s.reloadAt})`);
    const start = s.reloadAt;
    let t = s;
    while (t.reloadAt >= 0) t = game.step(t, null);
    ok(t.tick === start + BT2_RELOAD_TICKS && t.mag === BT2_MAG, `a plain reload takes 120 ticks (${t.tick - start})`);
    // Fire during a reload: dry.
    const dry = fireAt(s, s.tick + 1);
    ok(dry.dry === 1 && dry.shots === 5, "no shot while reloading (a dry click)");
    // A tap in the zone: finishes at half time.
    const inZone = start + Math.ceil(((s.zone + BT2_ZONE_W / 2) * BT2_RELOAD_TICKS) / 1000);
    let f = s;
    while (f.tick < inZone - 1) f = game.step(f, null);
    f = game.step(f, ev(f.tick + 1, BT2_INPUT_TAP));
    ok(f.fast === 1 && f.reloadTap === 1, "a tap in the green is a fast reload");
    const second = game.step(f, ev(f.tick + 1, BT2_INPUT_TAP));
    ok(second.jams === 0 && second.fast === 1, "one tap a reload");
    while (f.reloadAt >= 0) f = game.step(f, null);
    ok(f.tick === start + 60, `a fast reload finishes at half time (${f.tick - start})`);
    ok(Array.from({ length: 200 }, (_, n) => bastionZoneStart(n * 37, n)).every((z) => z >= 250 && z + BT2_ZONE_W < 500), "every green zone ends before half time");
    // A tap outside: jams 30 more.
    let j = s;
    while (j.tick < start + 5) j = game.step(j, null);
    j = game.step(j, ev(j.tick + 1, BT2_INPUT_TAP));
    ok(j.jams === 1 && j.fast === 0, "a tap outside the green jams");
    while (j.reloadAt >= 0) j = game.step(j, null);
    ok(j.tick === start + BT2_RELOAD_TICKS + 30, `a jam adds 30 ticks (${j.tick - start})`);
    // Swipe reload: early only.
    const full = game.step(s0, ev(401, BT2_INPUT_RELOAD));
    ok(full.reloadAt < 0 && full.reloads === 0, "a swipe with a full magazine does nothing");
    let one = fireAt(s0, 401);
    one = game.step(one, ev(402, BT2_INPUT_RELOAD));
    ok(one.reloadAt === 402 && one.reloads === 1, "a swipe reloads early");
  }
  {
    // No input: three tanks reach the wall, the run ends, the base part is 0 and the score 0.
    const idle = run(77, []);
    ok(idle.ended === 2 && idle.base === 0 && idle.breached === BT2_BASE, `no input: the base falls (${idle.ended}, ${idle.breached})`);
    ok(bastionTankScore(idle) === 0, "no input scores 0");
    const parts = bastionStdParts(idle)!;
    ok(parts.find((p) => p.key === "base")!.points === 0, "a fallen base scores 0 for Base intact");
    const events: ArcadeInputEvent[] = [];
    recordInput(events, ev(10, BT2_INPUT_AIM, 195, 400), BT2_INPUT_RANGES);
    const touched = run(77, events);
    ok(bastionTankScore(touched) === 1, `one input that did nothing scores 1 (${bastionTankScore(touched)})`);
  }
}

/* 5. The parts. */
{
  const base = (over: Partial<BastionTankState>): BastionTankState => ({ ...game.init(3), acted: 1, ended: 1, ...over });
  const pts = (s: BastionTankState, k: string) => bastionStdParts(s)!.find((p) => p.key === k)!.points;
  for (let hp = 0; hp <= BT2_TOTAL_HP; hp += 7) ok(pts(base({ destroyedHp: hp, base: 0 }), "core") === Math.floor((140 * hp) / BT2_TOTAL_HP), `Armour: ${hp} HP → ${Math.floor((140 * hp) / BT2_TOTAL_HP)}`);
  for (const w of [0, 1, 15, 30, 36]) ok(pts(base({ weak: w }), "weak") === Math.min(30, w), `Weak spots: ${w} → ${Math.min(30, w)}`);
  for (const f of [0, 1, 5, 10, 14]) ok(pts(base({ fast: f }), "fast") === Math.min(20, 2 * f), `Fast reloads: ${f} → ${Math.min(20, 2 * f)}`);
  ok(pts(base({ base: 3 }), "base") === 10 && pts(base({ base: 2 }), "base") === 5 && pts(base({ base: 1 }), "base") === 0, "Base intact: 10 / 5 / 0");
  ok(bastionTankScore(base({ destroyedHp: BT2_TOTAL_HP, weak: 30, fast: 10, base: 3 })) === 200 && bastionTankScore(base({ destroyedHp: BT2_TOTAL_HP - 1, weak: 30, fast: 10, base: 3 })) < 200, "everything in full → 200, one hit point short less");
  ok(bastionStdParts({ ...game.init(3), rev: 1 } as BastionTankState) === null, "a state of another revision has no standard parts");
  const help = PUZZLE_INSTRUCTIONS.bastion?.score ?? "";
  // The help states the dealt revision's parts (bastionRev 3's; section 9).
  for (const want of ["Armour up to 110", "Weak spots up to 30", "Fast reloads up to 20", "Drones up to 30", "Base intact up to 10", "Together 200 points."]) ok(help.includes(want), `help states "${want}"`);
}

/* 6. The oracle at 200 on every tuning and fresh seed. */
const serverReplay = (seed: number, events: ArcadeInputEvent[], claim?: number, rev = BASTION_REV_TANK) => {
  const g = bastionTankGameFor(rev);
  const s = bastionPlayLog(seed, events, rev);
  const checkpoints = [];
  const at = new Map(events.map((e) => [e.t, e]));
  for (let r = g.init(seed); !g.isOver(r); ) {
    r = g.step(r, at.get(r.tick + 1) ?? null);
    if (r.tick % BT2_CHECKPOINT_INTERVAL === 0) checkpoints.push(bastionTankCheckpoint(r));
  }
  const raw = encodeBastionTankRun({ seed, claimedScore: claim ?? g.score(s), events, endTick: s.tick, checkpoints });
  return { raw, out: replayBastionTankRun(seed, raw, rev) };
};
{
  const seeds = [...Array.from({ length: 60 }, (_, i) => i), ...Array.from({ length: 200 }, (_, i) => 10000 + i)];
  let at200 = 0;
  for (const seed of seeds) {
    const { events } = bastionPlay(seed);
    const { raw, out } = serverReplay(seed, events);
    const full = out.parts.every((p) => p.points === p.max);
    if (out.score === 200 && !out.flagged && full) at200++;
    else failures.push(`oracle seed ${seed}: ${out.score} (${out.parts.map((p) => `${p.key} ${p.points}`).join(" ")}, flagged ${out.flagged})`);
    if (seed % 50 === 0) {
      const g = gradeAnswer({ type: "bastion", seed, bastionRev: 2 }, raw, 0);
      ok(g.score === 200, `seed ${seed}: gradeAnswer scores the oracle's run 200 (${g.score})`);
    }
  }
  checks++;
  ok(at200 === seeds.length, `rev 2: the oracle at 200 on ${at200} of ${seeds.length} seeds`);
  const { events } = bastionPlay(4321);
  const a = bastionPlayLog(4321, events);
  const b = bastionPlayLog(4321, events);
  ok(bastionTankCheckpoint(a).checksum === bastionTankCheckpoint(b).checksum, "a replay is deterministic");
  ok(serverReplay(4321, events, 150).out.flagged, "a tampered claimed score is flagged");
  ok(serverReplay(4321, events, 150).out.score === 200, "the server keeps its own score");
}

/* 7. The skill-band bots rise. */
{
  const medians: number[] = [];
  for (const level of ALL_LEVELS) {
    const scores = Array.from({ length: 40 }, (_, n) => {
      const seed = 500 + n * 104729;
      const { events } = bot({ game, seed, rev: 2, human: new Human("bastion", seed, level) });
      return game.score(bastionPlayLog(seed, events!));
    }).sort((x, y) => x - y);
    medians.push(scores[20]!);
  }
  ok(medians.every((m, i) => i === 0 || m > medians[i - 1]!), `rev 2: medians rise weak → flawless (${medians.join(" < ")})`);
  ok(medians[medians.length - 1] === 200, "rev 2: flawless play scores 200");
}

/* 8. Art on the sim's rectangles. */
{
  // A fake context recording every rectangle and path point drawn while a tank paints (shadow and pips excluded by
  // their own colours: the shadow is inside the hull, the pips above the turret are its HUD).
  let bad = 0;
  for (const kind of [0, 1, 2])
    for (const z of [0, 120, 400, 900, BT2_FAR]) {
      const r = bastionTankRects(kind, kind, z * 256);
      const pts: [number, number][] = [];
      let fill = "";
      const note = (x: number, y: number) => {
        if (fill !== BT2_PIP_BACK && fill !== BT2_PIP_FILL && fill !== BT2_PIP_EMPTY) pts.push([x, y]);
      };
      const ctx = new Proxy(
        {},
        {
          get(_, k) {
            if (k === "fillRect") return (x: number, y: number, w: number, h: number) => (note(x, y), note(x + w, y + h));
            if (k === "moveTo" || k === "lineTo") return (x: number, y: number) => note(x, y);
            if (k === "arc") return (x: number, y: number, rr: number) => (note(x - rr, y - rr), note(x + rr, y + rr));
            if (k === "ellipse") return (x: number, y: number, rx: number, ry: number) => (note(x - rx, y - ry), note(x + rx, y + ry));
            if (k === "createLinearGradient" || k === "createRadialGradient") return () => ({ addColorStop() {} });
            return () => {};
          },
          set(_, k, v) {
            if (k === "fillStyle") fill = String(v);
            return true;
          },
        },
      ) as unknown as CanvasRenderingContext2D;
      paintTank(ctx, kind, kind, z * 256, BT2_HP[kind]!, 0, 0, true, z % 3 === 0);
      const x0 = Math.min(r.hull[0], r.turret[0]) - 2;
      const x1 = Math.max(r.hull[2], r.turret[2]) + 2;
      const y0 = r.turret[1] - 2;
      const y1 = r.hull[3] + 2;
      for (const [x, y] of pts) if (x < x0 || x > x1 || y < y0 || y > y1) bad++;
    }
  ok(bad === 0, `every tank's drawn art sits within 2 px of its collision rectangles (${bad} points outside)`);
}

/* 9. bastionRev 3 (Iron Wall). */
{
  // Rev 2 unchanged: runs recorded on main before rev 3 existed.
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/bastion-rev2-legacy.json", import.meta.url), "utf8")) as {
    runs: { seed: number; raw: string; score: number; parts: [string, number][]; flagged: boolean; checksum: number; tick: number }[];
  };
  ok(fixture.runs.length === 48, `48 recorded rev-2 runs (${fixture.runs.length})`);
  for (const r of fixture.runs) {
    for (const rev of [undefined, 2] as const) {
      const out = replayBastionTankRun(r.seed, r.raw, rev);
      const same = out.score === r.score && out.flagged === r.flagged && bastionTankCheckpoint(out.state).checksum === r.checksum && out.state.tick === r.tick && JSON.stringify(out.parts.map((p) => [p.key, p.points])) === JSON.stringify(r.parts);
      ok(same, `rev-2 seed ${r.seed} (rev ${rev ?? "absent"}): replays as on main (score ${out.score} vs ${r.score})`);
    }
    const g = gradeAnswer({ type: "bastion", seed: r.seed, bastionRev: 2 }, r.raw, 0);
    ok(g.score === r.score, `rev-2 seed ${r.seed}: gradeAnswer scores ${g.score} (main ${r.score})`);
  }

  // The plan is rev 2's; the paces and the zone.
  const iron = bastionIronGame;
  ok(iron.init(5).rev === 3 && game.init(5).rev === 2 && bastionTankGameFor(3) === iron && bastionTankGameFor(2) === game, "rev 3's game inits rev-3 states; rev 2's rev-2");
  ok(JSON.stringify(BT3_WAVE_PACE) === JSON.stringify([44, 50, 56, 80, 104]) && JSON.stringify(BT2_WAVE_PACE) === JSON.stringify([44, 50, 56, 100, 134]), "rev 3 eases waves 4 and 5 (80 % and 104 %, were 100 % and 134 %); waves 1–3 as rev 2");
  ok(BT3_WAVE_PACE[4] / BT2_WAVE_PACE[4] < BT3_WAVE_PACE[3] / BT2_WAVE_PACE[3], "wave 5 is eased the most");
  ok([0, 1, 2, 3, 4].every((w) => bastionWavePace(2, w) === BT2_WAVE_PACE[w] && bastionWavePace(3, w) === BT3_WAVE_PACE[w]), "each revision spawns at its own paces");
  ok(BT3_ZONE_W === 45 && bastionZoneW(3) === 45 && bastionZoneW(2) === BT2_ZONE_W, "rev 3's green zone is 45 ‰ (90 ms); rev 2's 30 ‰");
  ok(Array.from({ length: 200 }, (_, n) => bastionZoneStart(n * 37, n)).every((z) => z + BT3_ZONE_W < 500), "every rev-3 green zone still ends before half time");
  {
    // A spawned rev-3 wave-5 tank moves at 104 % of its type's speed; a rev-2 one at 134 %.
    const plan = bastionPlan(8);
    const w5 = plan.findIndex((t) => t.wave === 4);
    const until = (g: typeof game) => {
      let st = g.init(8);
      // (Earlier tanks are cleared each tick, so none reaches the wall.)
      while (st.nextSpawn <= w5) {
        st = g.step(st, null);
        if (st.nextSpawn <= w5) st = { ...st, tanks: [] };
      }
      return st.tanks.find((t) => t.i === w5);
    };
    const t2 = until(game);
    const t3 = until(iron);
    ok(!!t2 && !!t3 && t3.v === Math.floor((BT2_SPEED[t3.kind]! * 104) / 100) && t2.v === Math.floor((BT2_SPEED[t2.kind]! * 134) / 100), `a wave-5 tank rolls on at 104 % on rev 3, 134 % on rev 2 (${t3?.v}, ${t2?.v})`);
  }
  {
    // The wider zone: a tap 40 ‰ into the zone is a fast reload on rev 3 and a jam on rev 2.
    const parked: Bt2Tank = { i: 0, kind: 0, lane: 0, z: BT2_FAR * 256, v: 0, hp: 1, changed: 1, flash: 0 };
    for (const g of [game, iron]) {
      let s = { ...g.init(5), tick: 400, nextSpawn: BT2_TANKS, tanks: [parked] };
      s = g.step(s, ev(401, BT2_INPUT_FIRE, 195, 400));
      s = g.step(s, ev(402, BT2_INPUT_RELOAD));
      const want = s.reloadAt + Math.ceil(((s.zone + 40) * BT2_RELOAD_TICKS) / 1000);
      while (s.tick < want - 1) s = g.step(s, null);
      s = g.step(s, ev(s.tick + 1, BT2_INPUT_TAP));
      ok(g === iron ? s.fast === 1 && s.jams === 0 : s.jams === 1 && s.fast === 0, `rev ${s.rev}: a tap 40 ‰ into the zone is ${g === iron ? "a fast reload" : "a jam"}`);
    }
  }

  // The drones: from the seed alone, three, each inside its window, straight across the sky.
  for (const seed of [1, 7, 42, 99999, 123456789, 2147483646, -5]) {
    const ds = bastionDrones(seed);
    ok(JSON.stringify(ds) === JSON.stringify(bastionDrones(seed)), `seed ${seed}: the drones are the seed's alone`);
    ok(ds.length === BT3_DRONES, `seed ${seed}: three drones`);
    ok(ds.every((d, n) => d.at >= BT3_DRONE_WINDOW_AT[n]! && d.at < BT3_DRONE_WINDOW_AT[n]! + BT3_DRONE_WINDOW), `seed ${seed}: each drone inside its window`);
    ok(ds.every((d) => (d.dir === 1 || d.dir === -1) && d.y0 >= BT3_DRONE_Y_MIN && d.y0 <= BT3_DRONE_Y_MAX && d.y1 >= BT3_DRONE_Y_MIN && d.y1 <= BT3_DRONE_Y_MAX), `seed ${seed}: directions and heights in range`);
    ok(ds.every((d) => {
      const a = bastionDronePos(d, d.at + 10)!;
      const b = bastionDronePos(d, d.at + 11)!;
      return b.x - a.x === d.dir * BT3_DRONE_SPEED && bastionDronePos(d, d.at - 1) === null && bastionDronePos(d, d.at + BT3_DRONE_TICKS + 1) === null;
    }), `seed ${seed}: each flies ${BT3_DRONE_SPEED} px a tick, in the sky only for its crossing`);
    ok(ds.every((d) => {
      for (let k = 0; k <= BT3_DRONE_TICKS; k++) if (bastionDroneRect(bastionDronePos(d, d.at + k)!.x, bastionDronePos(d, d.at + k)!.y)[3] >= BT2_HORIZON_Y) return false;
      return true;
    }), `seed ${seed}: drones stay in the sky (above the horizon)`);
    ok(JSON.stringify(bastionPlan(seed)) === JSON.stringify(bastionPlan(seed)) && bastionDronesGone(seed) < BT2_RUN_TICKS_LOCAL, `seed ${seed}: the last drone has gone before the clock ends`);
  }
  {
    // A shell on a drone downs it; one already down is gone; a drone never touches the base.
    const seed = 21;
    const d = bastionDrones(seed)[0]!;
    const fireAt = d.at + 40;
    const flight = bastionFlight(150);
    const at = bastionDronePos(d, fireAt + flight)!;
    const parked: Bt2Tank = { i: 0, kind: 0, lane: 0, z: BT2_FAR * 256, v: 0, hp: 1, changed: 1, flash: 0 };
    const start = (): BastionTankState => ({ ...iron.init(seed), tick: fireAt - 1, nextSpawn: BT2_TANKS, tanks: [parked] });
    const shoot = (s0: BastionTankState, x: number, y: number) => {
      let s = iron.step(s0, ev(s0.tick + 1, BT2_INPUT_FIRE, x, y));
      const lands = s.shells[0]?.at ?? 0;
      while (s.tick < lands && !iron.isOver(s)) s = iron.step(s, null);
      return s;
    };
    const hit = shoot(start(), at.x, at.y);
    ok(flight === 30 && hit.drones === 1 && (hit.droneMask & 1) === 1 && hit.impacts.some((m) => m.r === 5), `a shell landing on a drone downs it (${hit.drones})`);
    const r = bastionDroneRect(at.x, at.y);
    const edge = shoot(start(), r[2], r[3]);
    ok(edge.drones === 1, "a shell on the drone's rectangle's corner downs it");
    const off = shoot(start(), r[2] + 3, at.y);
    ok(off.drones === 0 && off.impacts.some((m) => m.r === 0), "3 px past its rectangle is a miss");
    ok(hit.destroyedHp === 0 && hit.hits === 0, "a drone is not a tank hit");
    const again = shoot({ ...hit, shells: [], cool: 0 }, bastionDronePos(d, hit.tick + 1 + flight)!.x, bastionDronePos(d, hit.tick + 1 + flight)!.y);
    ok(again.drones === 1, "a downed drone cannot be downed twice");
    // Idle: the drones cross and leave; the base falls only to tanks (three hits, as rev 2).
    const idle = run3(77, []);
    ok(idle.ended === 2 && idle.breached === BT2_BASE && idle.drones === 0, `no input on rev 3: the base falls to the tanks alone (${idle.breached})`);
    ok(iron.score(idle) === 0, "no input on rev 3 scores 0");
    let fly = iron.init(seed);
    let baseOk = true;
    // Through every drone's crossing with the tanks kept off the field: the base is never touched.
    fly = { ...fly, nextSpawn: BT2_TANKS, tanks: [parked] };
    while (fly.tick < bastionDronesGone(seed) + 2 && !iron.isOver(fly)) {
      fly = iron.step(fly, null);
      if (fly.base !== BT2_BASE || fly.breached) baseOk = false;
    }
    ok(baseOk, "the drones never hit the base");
    // The run waits for the last drone: a cleared field before it has gone does not end the run.
    let cleared = { ...iron.init(seed), tick: 2000, nextSpawn: BT2_TANKS, tanks: [] as Bt2Tank[] };
    while (!iron.isOver(cleared)) cleared = iron.step(cleared, null);
    ok(cleared.ended === 3 && cleared.endedTick >= bastionDronesGone(seed), `a cleared rev-3 field ends only once the last drone has gone (${cleared.endedTick} ≥ ${bastionDronesGone(seed)})`);
    let cleared2 = { ...game.init(seed), tick: 2000, nextSpawn: BT2_TANKS, tanks: [] as Bt2Tank[] };
    while (!game.isOver(cleared2)) cleared2 = game.step(cleared2, null);
    ok(cleared2.ended === 3 && cleared2.endedTick === 2001 + 45, `rev 2's cleared field ends 45 ticks after it cleared, as before (${cleared2.endedTick})`);
  }

  // The parts.
  {
    const base = (over: Partial<BastionTankState>): BastionTankState => ({ ...iron.init(3), acted: 1, ended: 1, ...over });
    const pts = (s: BastionTankState, k: string) => bastionStdParts(s)!.find((p) => p.key === k)!.points;
    const keys = bastionStdParts(base({}))!.map((p) => `${p.key}:${p.max}`).join(" ");
    ok(keys === "core:110 weak:30 fast:20 drone:30 base:10", `rev 3's parts (${keys})`);
    for (let hp = 0; hp <= BT2_TOTAL_HP; hp += 7) ok(pts(base({ destroyedHp: hp, base: 0 }), "core") === Math.floor((110 * hp) / BT2_TOTAL_HP), `rev 3 Armour: ${hp} HP → ${Math.floor((110 * hp) / BT2_TOTAL_HP)}`);
    for (const n of [0, 1, 2, 3]) ok(pts(base({ drones: n }), "drone") === 10 * n, `rev 3 Drones: ${n} → ${10 * n}`);
    for (const w of [0, 15, 30, 36]) ok(pts(base({ weak: w }), "weak") === Math.min(30, w), `rev 3 Weak spots: ${w} → ${Math.min(30, w)}`);
    for (const f of [0, 5, 10, 14]) ok(pts(base({ fast: f }), "fast") === Math.min(20, 2 * f), `rev 3 Fast reloads: ${f} → ${Math.min(20, 2 * f)}`);
    ok(pts(base({ base: 3 }), "base") === 10 && pts(base({ base: 2 }), "base") === 5 && pts(base({ base: 3, ended: 2 }), "base") === 0, "rev 3 Base intact: 10 / 5 / 0 once it fell");
    ok(iron.score(base({ destroyedHp: BT2_TOTAL_HP, weak: 30, fast: 10, drones: 3, base: 3 })) === 200 && iron.score(base({ destroyedHp: BT2_TOTAL_HP, weak: 30, fast: 10, drones: 2, base: 3 })) === 190, "rev 3: everything in full → 200, a drone short 190");
    const v2 = bastionStdParts({ ...game.init(3), acted: 1, ended: 1, drones: 3 })!;
    ok(v2.map((p) => p.key).join(" ") === "core weak fast base" && !v2.some((p) => p.key === "drone"), "rev 2 states keep rev 2's four parts");
    const events: ArcadeInputEvent[] = [];
    recordInput(events, ev(10, BT2_INPUT_AIM, 195, 400), BT2_INPUT_RANGES);
    ok(iron.score(run3(77, events)) === 1, "rev 3: one input that did nothing scores 1");
    ok(bastionTankCheckpoint(run3(77, events)).checksum !== bastionTankCheckpoint({ ...run3(77, events), droneMask: 1 }).checksum, "rev 3's checksum covers the drones");
    const r2 = bastionPlayLog(77, events);
    ok(bastionTankCheckpoint(r2).checksum === bastionTankCheckpoint({ ...r2, droneMask: 1, drones: 1 }).checksum, "rev 2's checksum is unchanged (no drone fields)");
  }

  // The oracle at 200 on every tuning and fresh seed, rev 3.
  {
    const seeds = [...Array.from({ length: 60 }, (_, i) => i), ...Array.from({ length: 200 }, (_, i) => 10000 + i)];
    let at200 = 0;
    for (const seed of seeds) {
      const { events } = bastionPlay(seed, undefined, undefined, BASTION_REV_IRON);
      const { raw, out } = serverReplay(seed, events, undefined, BASTION_REV_IRON);
      const full = out.parts.every((p) => p.points === p.max) && out.parts.length === 5;
      if (out.score === 200 && !out.flagged && full && out.drones === 3) at200++;
      else failures.push(`rev 3 oracle seed ${seed}: ${out.score} (${out.parts.map((p) => `${p.key} ${p.points}`).join(" ")}, flagged ${out.flagged})`);
      if (seed % 50 === 0) {
        const g = gradeAnswer({ type: "bastion", seed, bastionRev: 3 }, raw, 0);
        ok(g.score === 200, `rev 3 seed ${seed}: gradeAnswer scores the oracle's run 200 (${g.score})`);
      }
    }
    checks++;
    ok(at200 === seeds.length, `rev 3: the oracle at 200 (all three drones) on ${at200} of ${seeds.length} seeds`);
    const { events } = bastionPlay(4321, undefined, undefined, 3);
    ok(serverReplay(4321, events, 150, 3).out.flagged && serverReplay(4321, events, 150, 3).out.score === 200, "rev 3: a tampered claim is flagged and the server keeps its own score");
    ok(replayBastionTankRun(4321, serverReplay(4321, events, undefined, 3).raw, 2).flagged, "a rev-3 run replayed as rev 2 does not pass for it");
  }

  // The bands rise on rev 3.
  {
    const medians: number[] = [];
    for (const level of ALL_LEVELS) {
      const scores = Array.from({ length: 40 }, (_, n) => {
        const seed = 500 + n * 104729;
        const { events } = bot({ game: iron, seed, rev: 3, human: new Human("bastion", seed, level) });
        return iron.score(bastionPlayLog(seed, events!, 3));
      }).sort((x, y) => x - y);
      medians.push(scores[20]!);
    }
    ok(medians.every((m, i) => i === 0 || m > medians[i - 1]!), `rev 3: medians rise weak → flawless (${medians.join(" < ")})`);
    ok(medians[medians.length - 1] === 200, "rev 3: flawless play scores 200");
  }

  // Art: the drone on its rectangle; the scenery outside the road.
  {
    let bad = 0;
    for (const dir of [1, -1])
      for (const [x, y] of [
        [100, 120],
        [37, 188],
        [300, 101],
      ] as const) {
        const r = bastionDroneRect(x, y);
        const pts: [number, number][] = [];
        const ctx = new Proxy(
          {},
          {
            get(_, k) {
              if (k === "fillRect") return (px: number, py: number, w: number, h: number) => (pts.push([px, py]), pts.push([px + w, py + h]));
              if (k === "moveTo" || k === "lineTo") return (px: number, py: number) => pts.push([px, py]);
              if (k === "arc") return (px: number, py: number, rr: number) => (pts.push([px - rr, py - rr]), pts.push([px + rr, py + rr]));
              if (k === "ellipse") return (px: number, py: number, rx: number, ry: number) => (pts.push([px - rx, py - ry]), pts.push([px + rx, py + ry]));
              if (k === "createLinearGradient" || k === "createRadialGradient") return () => ({ addColorStop() {} });
              return () => {};
            },
            set: () => true,
          },
        ) as unknown as CanvasRenderingContext2D;
        paintDrone(ctx, x, y, dir, 3, false);
        for (const [px, py] of pts) if (px < r[0] - 2 || px > r[2] + 2 || py < r[1] - 2 || py > r[3] + 2) bad++;
      }
    ok(bad === 0, `the drone's drawn art sits within 2 px of its rectangle (${bad} points outside)`);
    // Each item's half-width at scale 1 (the painters' widest reach); the road's edge is 192 px out at the wall and the
    // outer lanes' hulls end 175 px out.
    const half: Record<string, number> = { rock: 16, wall: 28, scrub: 18, trap: 12, wreck: 40 };
    ok(BT_SCENERY.every(([, out, , kind]) => out - half[kind]! > 200), "every scenery item sits outside the road's edges (nothing covers a lane or a shot)");
  }
}

if (failures.length) {
  console.log(`FAIL bastion-check: ${failures.length} of ${checks} checks failed`);
  for (const f of failures.slice(0, 30)) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`PASS bastion-check: ${checks} checks — the original Bastion and bastionRev 2 replay as on main, the plan, rules and parts of rev 2 and rev 3 (Iron Wall: eased waves, the 90 ms zone, the drones), the oracle at 200 on 260 seeds each, rising bands, art on its rectangles, scenery off the road`);
