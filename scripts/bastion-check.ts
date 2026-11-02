/**
 * Bastion (bastionRev 2, 1 Nov 2026; docs/arcade-standard/bastion.md): the tank-defence shooter, and the original Bastion
 * it replaces in rooms.
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
 *     recording the renderer's fills and paths on a fake context.
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
import { paintTank, BT2_PIP_BACK, BT2_PIP_EMPTY, BT2_PIP_FILL } from "../src/lib/arcade/bastionTank.renderer";
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
  ok(dealt.every((p) => p.type === "bastion" && p.bastionRev === BASTION_REV_TANK && p.seed > 0), "rooms deal bastionRev 2 on a fresh seed");
  ok(BASTION_REV_DEALT === 2, "the dealt stamp is 2");
  const def = PUZZLE_REGISTRY.bastion;
  ok((def.generate() as { bastionRev?: number }).bastionRev === 2, "the registry's practice puzzle is bastionRev 2");
  ok(!isRetired("bastion"), "Bastion is active (dealt in rooms)");
  ok(arcadeGroupOf("bastion") === "action", "Bastion is in the Action group");
  ok(roundMaxFor("bastion") === 200, "Bastion's round maximum is 200");
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
  for (const want of ["Armour up to 140", "Weak spots up to 30", "Fast reloads up to 20", "Base intact up to 10", "Together 200 points."]) ok(help.includes(want), `help states "${want}"`);
}

/* 6. The oracle at 200 on every tuning and fresh seed. */
const serverReplay = (seed: number, events: ArcadeInputEvent[], claim?: number) => {
  const s = bastionPlayLog(seed, events);
  const checkpoints = [];
  const at = new Map(events.map((e) => [e.t, e]));
  for (let r = game.init(seed); !game.isOver(r); ) {
    r = game.step(r, at.get(r.tick + 1) ?? null);
    if (r.tick % BT2_CHECKPOINT_INTERVAL === 0) checkpoints.push(bastionTankCheckpoint(r));
  }
  const raw = encodeBastionTankRun({ seed, claimedScore: claim ?? game.score(s), events, endTick: s.tick, checkpoints });
  return { raw, out: replayBastionTankRun(seed, raw) };
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
  ok(at200 === seeds.length, `the oracle at 200 on ${at200} of ${seeds.length} seeds`);
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
  ok(medians.every((m, i) => i === 0 || m > medians[i - 1]!), `medians rise weak → flawless (${medians.join(" < ")})`);
  ok(medians[medians.length - 1] === 200, "flawless play scores 200");
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

if (failures.length) {
  console.log(`FAIL bastion-check: ${failures.length} of ${checks} checks failed`);
  for (const f of failures.slice(0, 30)) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`PASS bastion-check: ${checks} checks — the original Bastion replays as on main, bastionRev 2's plan, rules and parts, the oracle at 200 on 260 seeds, rising bands, art on its rectangles`);
