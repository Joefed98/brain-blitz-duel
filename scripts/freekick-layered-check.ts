/**
 * freekick-layered-check (15 Nov 2026, the Home Run and Top Bins overhaul; docs/arcade-standard/freekick.md
 * "freekickRev 5"): Top Bins' layered kick.
 *
 *  1. the deal: every Normal seed sampled (all, every level, with CHECKS_FULL=1, which also rebuilds
 *     freekickDealV5.server.ts byte for byte) scores the oracle's 200 through the server replay;
 *  2. the levels: wall sizes, wind strengths, the number of jumping walls, the keeper's numbers, the gold zone and the
 *     hoop's last size, each as FK_LEVEL_SETTINGS says; rev 4's plan carries none of it;
 *  3. the wind: a shot solved in calm air is carried the wind's way;
 *  4. the strikes: a drive reaches the goal sooner than a curler to the same point, a dip carries no curl and the
 *     keeper reads it later, a curler bends;
 *  5. the wall: on a jumping wall a low drive goes under (and is blocked by the same wall standing), the lift only on
 *     its kicks;
 *  6. the keeper's lean: his start shifted toward it;
 *  7. the stroke's shape: straight → driven, bent → curler, a flick at the end → dipping;
 *  8. the bands: on Normal, weak < average < good < great < near-perfect (medians) near their targets; Expert harder
 *     than Easy from good up; random strokes score little.
 */
import { recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  fkCalm,
  fkFlightStep,
  fkHoopRFor,
  fkSeedPlan,
  fkV3Solve,
  fkV5MeterError,
  fkV5Strike,
  FK_DIP_READ,
  FK_GOAL_Z,
  FK_HOOP_R,
  FK_KEEPER_VMAX,
  FK_LEVELS,
  FK_LEVEL_SETTINGS,
  FK_M,
  FK_OUT_NONE,
  FK_OUT_WALL,
  FK_STRIKE_CURL,
  FK_STRIKE_DIP,
  FK_STRIKE_DRIVE,
  FK_V2_KEEPER_START_MAX,
  FREEKICK_INPUT_POWER,
  FREEKICK_INPUT_RANGES_V5,
  FREEKICK_INPUT_SHOT,
  FREEKICK_INPUT_STRIKE,
  FREEKICK_REV_4,
  FREEKICK_REV_5,
  freekickGameFor,
  type FkKick,
  type FkLevel,
} from "../src/lib/arcade/freekick";
import { strikeFromStroke, STRIKE_CURL, STRIKE_DIP, STRIKE_DRIVE } from "../src/lib/arcade/freekickStroke";
import { FREEKICK_DEAL_V5 } from "../src/lib/duel/freekickDealV5.server";
import { oracleRunV5 } from "./freekick-oracle";
import { storedScoreFkV5 } from "./freekick-layered-deal";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";
import { botV5, randomBotV5 } from "./arcade-skill-bands/bots/freekick";

const FULL = process.env["CHECKS_FULL"] === "1";
let failures = 0;
let checks = 0;
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) {
    failures++;
    console.log(`  ✗ ${label}`);
  }
};

/* 1. The deal. */
{
  if (FULL) {
    const spawn = Bun.spawnSync(["bun", "scripts/freekick-layered-deal.ts", "--check"], { stdout: "pipe", stderr: "pipe" });
    ok(spawn.exitCode === 0, `freekickDealV5.server.ts rebuilds byte for byte (${spawn.stdout.toString().trim()})`);
  }
  for (const level of FK_LEVELS) {
    const list = FREEKICK_DEAL_V5[level];
    ok(list.length === 60 && new Set(list).size === 60, `${level}: 60 distinct proved seeds`);
    const pick = FULL ? list : level === "normal" ? list.filter((_, i) => i % 10 === 0) : list.slice(0, 1);
    for (const seed of pick) ok(storedScoreFkV5(seed, oracleRunV5(seed, level), level) === 200, `${level} seed ${seed}: the oracle's 200 through the server replay`);
  }
}

/* 2. The levels. */
{
  for (const level of FK_LEVELS) {
    const L = FK_LEVEL_SETTINGS[level];
    for (const seed of FREEKICK_DEAL_V5[level].slice(0, 12)) {
      const kicks = fkSeedPlan(seed, FREEKICK_REV_5, level).kicks;
      ok(kicks.every((k) => k.wallN >= L.wall[0] && k.wallN <= L.wall[1]), `${level} ${seed}: walls of ${L.wall[0]}–${L.wall[1]}`);
      ok(kicks.every((k) => Math.abs(k.wind) <= L.wind && (L.wind <= 1 || k.wind !== 0)), `${level} ${seed}: wind within ${L.wind}${L.wind > 1 ? ", never calm" : ""}`);
      ok(kicks.filter((k) => k.v5!.jump).length === L.jumps, `${level} ${seed}: ${L.jumps} jumping walls`);
      ok(kicks.every((k) => k.v5!.react === L.react && k.v5!.vmax === Math.trunc((FK_KEEPER_VMAX * L.speed) / 1000)), `${level} ${seed}: the keeper reacts in ${L.react} ticks at ${L.speed} ‰ speed`);
    }
    ok(fkV5MeterError(L.zoneLo, level) === 0 && fkV5MeterError(L.zoneHi, level) === 0 && fkV5MeterError(L.zoneHi + 1, level) === 1 && fkV5MeterError(L.zoneLo - 1, level) === -1, `${level}: the gold zone is ${L.zoneLo}–${L.zoneHi}`);
    ok(fkHoopRFor(FREEKICK_REV_5, 0, level) === FK_HOOP_R && fkHoopRFor(FREEKICK_REV_5, 9, level) === Math.trunc((FK_HOOP_R * L.hoopLast) / 1000), `${level}: the hoop shrinks to ${L.hoopLast / 10} %`);
  }
  ok(fkSeedPlan(FREEKICK_DEAL_V5.normal[0]!, FREEKICK_REV_4).kicks.every((k) => !k.v5 && k.wind === 0), "rev 4's plan has no wind, lean or jumping wall");
  ok(fkHoopRFor(FREEKICK_REV_4, 9) === Math.trunc((FK_HOOP_R * 700) / 1000), "rev 4's hoop still shrinks to 70 %");
}

const fly = (k: FkKick, shot: { x: number; y: number; b: number; st: number }, ghost = false) => {
  const sol = fkV3Solve(fkCalm(k), shot.x, shot.y, shot.b, shot.st);
  const kk = ghost ? fkCalm(k) : k;
  const f = fkV5Strike(kk, sol.a, shot.b, sol.c, shot.st);
  // A ghost flight (still air, no wall, no keeper, no woodwork): the strike's own path.
  if (ghost) {
    f.wallSide = 2;
    f.kx = 1000 * FK_M;
  }
  let crossT = -1;
  while (f.out === FK_OUT_NONE && f.t < 200) {
    fkFlightStep(kk, f, !ghost, !ghost);
    if (crossT < 0 && f.z >= FK_GOAL_Z) crossT = f.t;
  }
  return { f, crossT };
};

/* 3. The wind. */
{
  let n = 0;
  for (const seed of FREEKICK_DEAL_V5.hard.slice(0, 6))
    for (const k of fkSeedPlan(seed, FREEKICK_REV_5, "hard").kicks) {
      if (k.wind === 0) continue;
      const calm = fkV3Solve(fkCalm(k), 0, 200, 0, FK_STRIKE_CURL);
      const a = fkV5Strike(fkCalm(k), calm.a, 0, calm.c, FK_STRIKE_CURL);
      const b = fkV5Strike(k, calm.a, 0, calm.c, FK_STRIKE_CURL);
      a.wallSide = 2;
      b.wallSide = 2;
      a.kx = b.kx = 1000 * FK_M;
      for (let t = 0; t < 70; t++) {
        fkFlightStep(fkCalm(k), a, false, false);
        fkFlightStep(k, b, false, false);
      }
      ok(Math.sign(b.x - a.x) === Math.sign(k.wind), `hard ${seed}: the wind (${k.wind}) carries the ball its way`);
      n++;
    }
  ok(n > 20, `the wind tested on ${n} kicks`);
}

/* 4. The strikes. */
{
  const k = fkSeedPlan(FREEKICK_DEAL_V5.normal[2]!, FREEKICK_REV_5, "normal").kicks[0]!;
  const curl = fly(k, { x: 150, y: 120, b: 60, st: FK_STRIKE_CURL }, true);
  const drive = fly(k, { x: 150, y: 120, b: 60, st: FK_STRIKE_DRIVE }, true);
  const dip = fly(k, { x: 150, y: 120, b: 60, st: FK_STRIKE_DIP }, true);
  ok(drive.crossT > 0 && curl.crossT > 0 && drive.crossT < curl.crossT, `a drive reaches the goal sooner than a curler (${drive.crossT} vs ${curl.crossT} ticks)`);
  ok(dip.f.b === 0 && Math.abs(drive.f.b) < Math.abs(curl.f.b), "a dip carries no curl, a drive less than a curler");
  ok(Math.abs(curl.f.cu) > Math.abs(drive.f.cu), "a curler bends further than a drive");
  // The keeper reads a dip later, past the same wall.
  let found = false;
  for (const seed of FREEKICK_DEAL_V5.normal.slice(0, 10))
    for (const kk of fkSeedPlan(seed, FREEKICK_REV_5, "normal").kicks) {
      const a = fly(kk, { x: -kk.side * 200, y: 200, b: 0, st: FK_STRIKE_DIP }).f;
      const b = fly(kk, { x: -kk.side * 200, y: 200, b: 0, st: FK_STRIKE_DRIVE }).f;
      if (a.react > 0 && b.react > 0 && !found) {
        found = true;
        ok(a.react - b.react >= FK_DIP_READ - 3, `the keeper moves later on a dip (${a.react} vs ${b.react})`);
      }
    }
  ok(found, "a dip and a drive past the same wall were compared");
}

/* 5. The wall. */
{
  let under = 0;
  let blocked = 0;
  for (const seed of FREEKICK_DEAL_V5.normal.slice(0, 20))
    for (const k of fkSeedPlan(seed, FREEKICK_REV_5, "normal").kicks) {
      if (!k.v5!.jump) continue;
      for (const x of [-250, -150, -50, 50, 150, 250]) {
        const r = fly(k, { x, y: 15, b: 0, st: FK_STRIKE_DRIVE });
        if (r.f.under !== 1) continue;
        under++;
        const standing: FkKick = { ...k, v5: { ...k.v5!, jump: 0 } };
        const sol = fkV3Solve(fkCalm(standing), x, 15, 0, FK_STRIKE_DRIVE);
        const f = fkV5Strike(standing, sol.a, 0, sol.c, FK_STRIKE_DRIVE);
        while (f.out === FK_OUT_NONE) fkFlightStep(standing, f);
        if (f.out === FK_OUT_WALL) blocked++;
      }
    }
  ok(under >= 5, `low drives go under jumping walls (${under} found)`);
  ok(blocked >= 3, `the same drives are blocked by the wall standing (${blocked})`);
}

/* 6. The keeper's lean. */
{
  for (const seed of FREEKICK_DEAL_V5.normal.slice(0, 5)) {
    const v4 = fkSeedPlan(seed, FREEKICK_REV_4).kicks;
    fkSeedPlan(seed, FREEKICK_REV_5, "normal").kicks.forEach((k, i) => {
      const was = v4[i]!.keeperX;
      const capped = Math.abs(was + k.v5!.lean * 19661) > FK_V2_KEEPER_START_MAX;
      ok(capped || Math.sign(k.keeperX - was) === k.v5!.lean, `${seed} kick ${i + 1}: the keeper starts shifted toward his lean`);
    });
  }
}

/* 7. The stroke's shape. */
{
  const line = (pts: [number, number][]) => pts.map(([x, y]) => ({ x, y }));
  const straight = line([[195, 600], [195, 500], [196, 400], [196, 300]]);
  const bent = line([[195, 600], [215, 500], [222, 400], [210, 300]]);
  const flick = line([[195, 600], [195, 520], [195, 440], [195, 380], [195, 340], [230, 320]]);
  ok(strikeFromStroke(straight, 2) === STRIKE_DRIVE, "a straight stroke drives");
  ok(strikeFromStroke(bent, 70) === STRIKE_CURL, "a bent stroke curls");
  ok(strikeFromStroke(flick, 10) === STRIKE_DIP, "a flick at the end dips");
}

/* 8. The bands. */
{
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
  const band = (level: FkLevel, skill: SkillLevel, n = FULL ? 30 : 16) => {
    const game = freekickGameFor(FREEKICK_REV_5, level);
    return med(FREEKICK_DEAL_V5[level].slice(0, n).map((seed) => storedScoreFkV5(seed, botV5({ game, seed, rev: 5, human: new Human("freekick", seed, skill) }).events, level)));
  };
  const order: SkillLevel[] = ["weak", "average", "good", "great", "near"];
  const normal = order.map((k) => band("normal", k));
  ok(normal.every((v, i) => i === 0 || v > normal[i - 1]!), `Normal rises with skill: ${normal.join(" < ")}`);
  ok(normal[4]! >= 165 && normal[3]! >= 140 && normal[3]! <= 180 && normal[2]! >= 105 && normal[2]! <= 150, `Normal sits near its targets (near-perfect ${normal[4]}, great ${normal[3]}, good ${normal[2]})`);
  for (const skill of ["good", "great"] as SkillLevel[]) ok(band("expert", skill) < band("easy", skill), `${skill}: Expert is harder than Easy`);
  const seed = FREEKICK_DEAL_V5.normal[4]!;
  const game = freekickGameFor(FREEKICK_REV_5, "normal");
  ok(storedScoreFkV5(seed, randomBotV5({ game, seed, rev: 5, human: new Human("freekick", seed, "average") }).events, "normal") < 60, "random strokes score little");
  ok(storedScoreFkV5(seed, [], "normal") === 0, "no input scores 0");
  const one: ArcadeInputEvent[] = [];
  recordInput(one, { t: 40, k: FREEKICK_INPUT_SHOT, a: 0, b: 11, c: 0, d: 1 }, FREEKICK_INPUT_RANGES_V5);
  recordInput(one, { t: 41, k: FREEKICK_INPUT_POWER, a: 0, b: 0, c: 0, d: 0 }, FREEKICK_INPUT_RANGES_V5);
  recordInput(one, { t: 42, k: FREEKICK_INPUT_STRIKE, a: 0, b: 0, c: 0, d: 0 }, FREEKICK_INPUT_RANGES_V5);
  ok(storedScoreFkV5(seed, one, "normal") >= 1, "a played run scores at least 1");
}

if (failures) {
  console.log(`FAIL freekick-layered-check: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS freekick-layered-check: ${checks} checks`);
