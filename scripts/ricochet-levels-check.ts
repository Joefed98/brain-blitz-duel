/**
 * Moon Climb's difficulty levels (the Action overhaul, 15 Nov 2026; docs/arcade-standard/ricochet.md "Levels"):
 *
 *  1. Normal is today's game: Normal towers, witnesses and first states identical to those recorded before the levels
 *     (scripts/fixtures/action-levels-legacy.json.gz, recorded on de3bec96 by scripts/action-levels-legacy-record.ts),
 *     the recorded runs replaying through the server path to the same score and checkpoints; a Normal deal carries no
 *     level and is byte for byte the deal with no level asked for; ricoRev 3 ignores any level; junk reads as Normal;
 *  2. each level's rules and stamped settings: the deal stamps `level` on ricoRev 4, the state carries it, the registry's
 *     settings are the sim's, the lanterns (count, float speed), the knock-down, the hazards' density (and Expert's
 *     faster shurikens), the patches (Easy fewer, Hard more ice, Expert mostly ice), the parts summing to 200;
 *  3. the 120 s rule (the run 60 s at every level, the round's clock under 120 s);
 *  4. grace: no hit ends the run at any level;
 *  5. 200 reachable at every level: every sampled tower's witness scores exactly 200 through the server's grade, no hit;
 *  6. identical worlds for every player: the same seed and level deal the same tower however it is built; a level's
 *     towers are its own;
 *  7. "Moonwalker" ("Climb 245 m on Hard") is possible on every sampled Hard tower (its goal met by the witness's graded run).
 *
 *   bun scripts/ricochet-levels-check.ts [--verbose]   (CHECKS_FULL=1: 40 towers a level in 5, else 12)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  MOON_BIG_REV, MOON_LEVELS, MOON_REV, MOON_SCROLLS, MOON_SKY, MOON_SKY_VY, NINJA_CHECKPOINT_INTERVAL, NINJA_INPUT_TAP, NINJA_KNOCK,
  NINJA_PX_PER_M, NINJA_RUN_TICKS, SURF_ICE, moonBuildDeal, ninjaBodyFor, moonCheckpoint, moonDeal, moonGameFor, moonStdSpecFor, ninjaMetres,
  type MoonLevel, type MoonState,
} from "../src/lib/arcade/ricochetNinja";
import { encodeMoonRun, replayMoonRun } from "../src/lib/duel/ricochet";
import { gradeAnswer, generatePuzzle } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/catalogue";
import { withSeededRandom } from "../src/lib/duel/random";
import { challengesFor, goalMet } from "../src/lib/duel/practiceChallenges";
import { gameLevelSettings, levelsOf } from "../src/lib/levels/gameLevels";
import { MAX_ROUND_CLOCK_MS, puzzleLevel } from "../src/lib/levels/levels";
import { roomSeed } from "./arcade-skill-bands/games";

console.error = () => {};
let checks = 0;
const failures: string[] = [];
const VERBOSE = process.argv.includes("--verbose");
function ok(cond: boolean, label: string): void {
  checks++;
  if (VERBOSE) console.log(`${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) failures.push(label);
}
const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 24);
const json = (v: unknown) => JSON.stringify(v);
const tap = (t: number, a = 0): ArcadeInputEvent => ({ t, k: NINJA_INPUT_TAP, a, b: 0, c: 0, d: 0 });
const FULL = process.env.CHECKS_FULL === "1";
const LEVELS: MoonLevel[] = ["easy", "hard", "expert"];
const N = FULL ? 40 : 12;

/** A run as the phone sends it at a level (with checkpoints). */
function raw(seed: number, events: readonly ArcadeInputEvent[], level: MoonLevel | null, rev = MOON_BIG_REV): string {
  const game = moonGameFor(rev, level);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  const cps = [];
  while (!game.isOver(s)) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % NINJA_CHECKPOINT_INTERVAL === 0) cps.push(moonCheckpoint(s));
  }
  return encodeMoonRun({ seed, claimedScore: game.score(s), events: [...events], endTick: s.tick, checkpoints: cps });
}
/** A Moon Climb deal at a level, as rooms and practice deal it (seeded Math.random, the room path). */
const dealAt = (n: number, level?: string) => withSeededRandom(roomSeed(n), () => generatePuzzle("ricochet", { bankSeed: roomSeed(n), ...(level ? { level: level as never } : {}) })) as any;

/* 1. Normal is today's game. */
{
  const L = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/action-levels-legacy.json.gz", import.meta.url))).toString()) as {
    moon: { seed: number; tower: string; witness: string; init: string; runs: { level: string; events: ArcadeInputEvent[]; score: number; sums: number[] }[] }[];
  };
  const towerBad = L.moon.filter((m) => {
    const d = moonDeal(m.seed, MOON_BIG_REV);
    return digest(d.tower) !== m.tower || digest(d.witness) !== m.witness || digest(moonGameFor(MOON_BIG_REV).init(m.seed)) !== m.init;
  });
  ok(L.moon.length === 24 && towerBad.length === 0, `1a: 24 Normal towers, witnesses and first states as recorded before the levels${towerBad.length ? ` (differ: ${towerBad.map((m) => m.seed).join(", ")})` : ""}`);
  const runs = L.moon.flatMap((m) => m.runs.map((r) => ({ seed: m.seed, ...r })));
  const runBad = runs.filter((r) => {
    const out = replayMoonRun(r.seed, raw(r.seed, r.events, null), MOON_BIG_REV);
    const normal = replayMoonRun(r.seed, raw(r.seed, r.events, null), MOON_BIG_REV, "normal");
    const game = moonGameFor(MOON_BIG_REV);
    const at = new Map(r.events.map((e) => [e.t, e]));
    let s = game.init(r.seed);
    const sums: number[] = [];
    while (!game.isOver(s)) {
      s = game.step(s, at.get(s.tick + 1) ?? null);
      if (s.tick % NINJA_CHECKPOINT_INTERVAL === 0) sums.push(moonCheckpoint(s).checksum);
    }
    return out.flagged || out.score !== r.score || normal.score !== r.score || json(sums) !== json(r.sums);
  });
  ok(runs.length === 24 && runBad.length === 0, `1b: 24 Normal runs (average, great, elite on 8 towers) recorded before the levels replay to the same score and checkpoints${runBad.length ? ` (differ: ${runBad.map((r) => `${r.seed}/${r.level}`).join(", ")})` : ""}`);
  const plain = [0, 1, 2, 3].map((n) => dealAt(n));
  ok(plain.every((p, n) => json(p) === json(dealAt(n, "normal")) && !("level" in p) && p.ricoRev === MOON_BIG_REV), "1c: a Normal deal is byte for byte the deal with no level asked for, with no level field");
  const s3 = moonGameFor(MOON_REV, "hard").init(55) as MoonState;
  ok(!("lvl" in s3) && json(s3) === json(moonGameFor(MOON_REV).init(55)) && moonGameFor(MOON_REV, "expert") === moonGameFor(MOON_REV), "1d: ricoRev 3 has no levels (any level plays its own game)");
  ok(moonGameFor(MOON_BIG_REV, "junk") === moonGameFor(MOON_BIG_REV) && moonGameFor(MOON_BIG_REV, "normal") === moonGameFor(MOON_BIG_REV) && !("lvl" in (moonGameFor(MOON_BIG_REV).init(9) as object)), "1e: Normal or junk reads as today's game, and a Normal state carries no level");
}

/* 2. Each level's rules and stamped settings. */
{
  ok(json(levelsOf("ricochet")) === json(["easy", "normal", "hard", "expert"]), "2a: Moon Climb offers all four levels");
  for (const lv of LEVELS) {
    const c = MOON_LEVELS[lv];
    const reg = gameLevelSettings<{ blades: number; knockM: number; lanterns: number; fullM: number }>("ricochet", lv)!;
    ok(reg.blades * 1000 === c.blades && reg.knockM * NINJA_PX_PER_M === c.knock && reg.lanterns === c.sky && reg.fullM === c.fullM, `2b ${lv}: the registry's settings are the sim's`);
    const p = dealAt(3, lv);
    ok(puzzleLevel(p) === lv && p.ricoRev === MOON_BIG_REV && json({ ...p, level: undefined }) === json({ ...dealAt(3), level: undefined }), `2c ${lv}: the deal stamps level "${lv}" on ricoRev 4's puzzle (seed and stamp as Normal's)`);
    const s = moonGameFor(p.ricoRev, p.level).init(p.seed) as MoonState;
    ok(s.lvl === lv && s.tower.sky.length === c.sky && s.tower.sky.every((k) => k.vy === c.skyVy), `2d ${lv}: the state carries its level; ${c.sky} sky lanterns floating at ${c.skyVy}/256 px a tick`);
    const spec = moonStdSpecFor(MOON_BIG_REV, lv);
    ok(spec.parts.reduce((a, q) => a + q.max, 0) === 200 && spec.parts[0]!.max === c.coreMax && spec.parts[0]!.of === c.fullM && spec.parts[2]!.max === c.rideEach * c.sky, `2e ${lv}: parts height ${c.coreMax} (full at ${c.fullM} m), flow 30, rides ${c.rideEach * c.sky}, scrolls 15 sum to 200`);
  }
  ok(MOON_LEVELS.easy.fullM === 200 && MOON_LEVELS.hard.fullM === 245 && MOON_LEVELS.expert.fullM === 260 && MOON_LEVELS.easy.knock === 2 * NINJA_PX_PER_M && MOON_LEVELS.hard.knock === NINJA_KNOCK && MOON_LEVELS.expert.knock === 4 * NINJA_PX_PER_M, "2f: Joe's full heights (200 / 245 / 260 m) and knock-downs (2 / 3 / 4 m)");
  ok(MOON_LEVELS.easy.sky === MOON_SKY && MOON_LEVELS.easy.skyVy < MOON_SKY_VY && MOON_LEVELS.expert.sky === 4 && MOON_LEVELS.expert.skyVy > MOON_SKY_VY && MOON_LEVELS.expert.pace < 1000, "2g: Easy six slower lanterns, Expert four faster ones and faster shurikens");
  // The hazards and patches, over the sample.
  const stats = (lv: MoonLevel | null) => {
    let blades = 0, patches = 0, ice = 0, period = 0, shur = 0;
    for (let n = 0; n < N; n++) {
      const t = moonDeal(roomSeed(n), MOON_BIG_REV, lv).tower;
      blades += t.katanas.length + t.shurikens.length;
      patches += t.patches.length;
      ice += t.patches.filter((q) => q.kind === SURF_ICE).length;
      period += t.shurikens.reduce((a, q) => a + q.period, 0);
      shur += t.shurikens.length;
    }
    return { blades: blades / N, patches: patches / N, ice: ice / Math.max(1, patches), period: period / Math.max(1, shur) };
  };
  const nm = stats(null);
  const [ez, hd, ex] = LEVELS.map(stats) as [ReturnType<typeof stats>, ReturnType<typeof stats>, ReturnType<typeof stats>];
  ok(ez.blades < 0.65 * nm.blades && hd.blades > 1.15 * nm.blades && ex.blades > 1.3 * nm.blades && ex.blades > hd.blades, `2h: blades about half on Easy, more on Hard, most on Expert (${ez.blades.toFixed(0)} / ${nm.blades.toFixed(0)} / ${hd.blades.toFixed(0)} / ${ex.blades.toFixed(0)} a tower)`);
  ok(ez.patches < 0.75 * nm.patches && ez.ice <= nm.ice && hd.ice > nm.ice + 0.15 && ex.ice >= 0.8 && ex.patches >= nm.patches, `2i: less moss and ice on Easy, more ice on Hard, mostly ice on Expert (patches ${ez.patches.toFixed(0)} / ${nm.patches.toFixed(0)} / ${hd.patches.toFixed(0)} / ${ex.patches.toFixed(0)}, ice ${(100 * nm.ice).toFixed(0)} → ${(100 * hd.ice).toFixed(0)} → ${(100 * ex.ice).toFixed(0)} %)`);
  ok(ex.period < 0.85 * nm.period, `2j: Expert's shurikens cross faster (${ex.period.toFixed(0)} ticks a crossing against Normal's ${nm.period.toFixed(0)})`);
  // The knock-down: the first hit of a careless run drops the ninja exactly the level's knock-down (or to the floor).
  for (const lv of [null, ...LEVELS] as (MoonLevel | null)[]) {
    const game = moonGameFor(MOON_BIG_REV, lv);
    let s = game.init(roomSeed(7)) as MoonState;
    let dropped = -1;
    while (!game.isOver(s) && dropped < 0) {
      const before = s;
      s = game.step(s, (s.tick + 1) % 9 === 0 ? tap(s.tick + 1) : null) as MoonState;
      if (s.hits > before.hits && s.knockTo > ninjaBodyFor(MOON_BIG_REV).start) dropped = s.y - s.knockTo;
    }
    const want = (lv ? MOON_LEVELS[lv].knock : NINJA_KNOCK) * 256;
    ok(dropped === want, `2k ${lv ?? "normal"}: a hit knocks the ninja down ${want / 256 / NINJA_PX_PER_M} m`);
  }
}

/* 3. The 120 s rule, and 4. grace. */
for (const lv of [null, ...LEVELS] as (MoonLevel | null)[]) {
  const game = moonGameFor(MOON_BIG_REV, lv);
  const p = dealAt(5, lv ?? undefined);
  ok(game.runTicks === NINJA_RUN_TICKS && NINJA_RUN_TICKS <= 120 * 60 && puzzleTimeLimitMs(p) - 3000 <= MAX_ROUND_CLOCK_MS, `3 ${lv ?? "normal"}: the run is ${NINJA_RUN_TICKS / 60} s and the round's clock under 120 s`);
  let s = game.init(31) as MoonState;
  while (!game.isOver(s)) s = game.step(s, (s.tick + 1) % 12 === 0 ? tap(s.tick + 1) : null) as MoonState;
  ok(s.hits >= 3 && s.tick === NINJA_RUN_TICKS, `4 ${lv ?? "normal"}: a careless run's ${s.hits} hits never end it (it lasts the minute)`);
}

/* 5. 200 reachable at every level, 6. identical worlds, 7. Moonwalker. */
const moonwalker = challengesFor("ricochet").find((c) => c.name === "Moonwalker")!;
ok(moonwalker?.level === "hard", "7a: Moonwalker is the Hard challenge");
for (const lv of LEVELS) {
  const bad: string[] = [];
  const walks: string[] = [];
  for (let n = 0; n < N; n++) {
    const p = dealAt(n, lv);
    const d = moonDeal(p.seed, p.ricoRev, lv);
    const graded = gradeAnswer(p, raw(p.seed, d.witness.map((e) => tap(e.t, e.a)), lv), 0);
    const extra = graded.extra as any;
    if (graded.score !== 200 || extra?.flagged || extra?.hits !== 0 || extra?.rideTotal !== MOON_LEVELS[lv].sky || extra?.fullM !== MOON_LEVELS[lv].fullM) bad.push(`${p.seed}: ${graded.score}`);
    if (lv === "hard" && !(goalMet(moonwalker.goal, { score: graded.score, extra: graded.extra as never }) && extra.metres >= 245)) walks.push(String(p.seed));
  }
  ok(bad.length === 0, `5 ${lv}: every sampled tower's witness scores exactly 200 through the server's grade, no hit (${N} towers)${bad.length ? `: ${bad.join(", ")}` : ""}`);
  if (lv === "hard") ok(walks.length === 0, `7b: Moonwalker's goal is met on every sampled Hard tower (${N})${walks.length ? `: not on ${walks.join(", ")}` : ""}`);
  const fresh = moonBuildDeal(roomSeed(2), MOON_BIG_REV, lv);
  ok(json(fresh) === json(moonDeal(roomSeed(2), MOON_BIG_REV, lv)) && json(dealAt(2, lv)) === json(dealAt(2, lv)), `6a ${lv}: the same seed and level deal the same puzzle and tower, built fresh or from the cache`);
  ok(json(moonDeal(roomSeed(2), MOON_BIG_REV, lv).tower) !== json(moonDeal(roomSeed(2), MOON_BIG_REV).tower), `6b ${lv}: the level's tower is its own (not Normal's)`);
  ok(ninjaMetres(moonGameFor(MOON_BIG_REV, lv).init(1) as MoonState) === 0 && MOON_SCROLLS === 3, `6c ${lv}: every run starts at the foot`);
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL ricochet-levels-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS ricochet-levels-check: ${checks} checks`);
