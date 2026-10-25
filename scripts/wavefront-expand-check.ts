/**
 * wavefront-expand-check (expansion E8, 25 Oct 2026; docs/expansions/e8.md): Wavefront wavRev 9.
 *
 *  1. Old rounds: 32 skill-band runs recorded on the code before wavRev 9 (rev 8 room logs) replay on every
 *     older revision (unstamped, 2–8) to the stored score and final-state digest, and no older state
 *     carries a wavRev 9 field.
 *  2. Rooms (and the practice definition) deal wavRev 9; LIVE_BANDS lists it with wavRev 8 as its
 *     score-bands revision; the round maximum is 200.
 *  3. Recorded wavRev 9 runs (bots at each level) replay to their stored score, unflagged and in sync,
 *     and the scripted look-ahead run scores 200 through the server replay.
 *  4. The rules on hand-built states: the 800 px world, 36-ship waves with escorts, the spread volley,
 *     the shield, the streak and its multiplier, the open and closed core, a cannon's hit points and its
 *     drop, the gunship counted as a wave, seeded drop kinds; scores stay within 0–200, the features' edge
 *     within 50 and the base within 150.
 *
 *   bun scripts/wavefront-expand-check.ts      (record new runs: bun scripts/wavefront-expand-bands.ts --record)
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  wavefrontGameFor,
  wavefrontBandParts,
  wavefrontWorldHFor,
  wavCoreOpen,
  wavShapeBox,
  wavShipY,
  wavStreakMult,
  WAV_BOSS_Y,
  WAV_CELL,
  WAV_DROP_SHIELD,
  WAV_DROP_SPREAD,
  WAV_FORMS_X,
  WAV_PAR_X,
  WAV_REV_EXPAND,
  WAV_REV_STRICT,
  WAV_V9_BAND_CURVE,
  WAV_X_CANNON_HP,
  WAV_X_CORE_DAMAGE,
  WAV_X_CORE_PERIOD,
  WAV_X_EDGE_CURVE,
  WAV_X_H,
  WAV_X_SHAPES,
  type WavState,
} from "../src/lib/arcade/wavefront";
import { bandPoints } from "../src/lib/arcade/scoreBands";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { replayWavefrontRun } from "../src/lib/duel/wavefront";
import { generateWavefront } from "../src/lib/duel/arcade.server";
import { wavefrontPuzzle } from "../src/puzzles/wavefront";
import { LEGACY_REVS, stateDigest } from "./wavefront-expand-record";

let checks = 0;
const failures: string[] = [];
const ok = (cond: unknown, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};
const section = (title: string) => console.log(`— ${title}`);
const quiet = <T>(fn: () => T): T => {
  const warn = console.warn;
  const err = console.error;
  console.error = () => {};
  const log = console.log;
  console.warn = () => {};
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.warn = warn;
    console.error = err;
    console.log = log;
  }
};

/* 1. Old rounds. */
section("Old rounds replay unchanged on every older revision");
{
  const legacy = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/wavefront-expand-legacy.json.gz")).toString()) as {
    runs: { name: string; seed: number; raw: string; revs: { rev: number | null; score: number; digest: string }[] }[];
  };
  ok(legacy.runs.length === 32, `32 legacy runs (got ${legacy.runs.length})`);
  for (const run of legacy.runs)
    for (const { rev, score, digest } of run.revs) {
      const r = quiet(() => replayWavefrontRun(run.seed, run.raw, rev));
      ok(r.score === score, `${run.name} on wavRev ${rev ?? "-"}: stored ${score}, replays ${r.score}`);
      ok(stateDigest(r.state) === digest, `${run.name} on wavRev ${rev ?? "-"}: final state differs`);
      ok(!("x9" in (r.state as object)) && !("streak" in (r.state as object)), `${run.name} on wavRev ${rev ?? "-"}: carries a wavRev 9 field`);
      if (rev === WAV_REV_STRICT) ok(!r.flagged && r.desyncTick == null, `${run.name}: unflagged on wavRev 8`);
    }
  for (const rev of LEGACY_REVS) ok(!("x9" in (wavefrontGameFor(rev).init(1) as object)), `wavRev ${rev ?? "-"} starts with no wavRev 9 field`);
}

/* 2. Dealing. */
section("Rooms deal wavRev 9, scored to 200");
ok(generateWavefront().wavRev === WAV_REV_EXPAND, "rooms deal wavRev 9");
ok((wavefrontPuzzle.generate() as { wavRev?: number }).wavRev === WAV_REV_EXPAND, "practice's definition deals wavRev 9");
ok(LIVE_BANDS.wavefront.rev === WAV_REV_EXPAND && LIVE_BANDS.wavefront.curve === WAV_V9_BAND_CURVE && (LIVE_BANDS.wavefront as { bands?: { rev: number } }).bands?.rev === WAV_REV_STRICT, "LIVE_BANDS: wavRev 9 on WAV_V9_BAND_CURVE, wavRev 8 its score-bands revision");
ok(roundMaxFor("wavefront") === 200, "Wavefront's round maximum is 200");
ok(wavefrontWorldHFor(WAV_REV_EXPAND) === WAV_X_H && WAV_X_H === 800, "wavRev 9 plays in the 390 × 800 world");

/* 3. Recorded wavRev 9 runs and the 200. */
section("Recorded wavRev 9 runs replay to their stored scores; 200 is reachable");
{
  const data = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/wavefront-expand-runs.json.gz")).toString()) as {
    runs: { level: string; n: number; seed: number; score: number; raw: string; digest: string }[];
    ace: { seed: number; raw: string; score: number };
  };
  ok(data.runs.length === 16, `16 recorded wavRev 9 runs (got ${data.runs.length})`);
  for (const run of data.runs) {
    const r = replayWavefrontRun(run.seed, run.raw, WAV_REV_EXPAND);
    ok(!r.flagged && r.desyncTick == null, `${run.level} #${run.n}: replays unflagged (${r.reason ?? ""})`);
    ok(r.score === run.score && stateDigest(r.state) === run.digest, `${run.level} #${run.n}: stored ${run.score}, replays ${r.score}`);
    ok(r.score >= 0 && r.score <= 200, `${run.level} #${run.n}: score within 0–200`);
  }
  const ace = replayWavefrontRun(data.ace.seed, data.ace.raw, WAV_REV_EXPAND);
  ok(!ace.flagged && ace.desyncTick == null && ace.score === 200, `the scripted run scores 200 through the server replay (got ${ace.score})`);
  ok((ace.state as WavState).bossKilled === 1, "the 200 run destroys the boss");
  // The same log on wavRev 8 scores at most 150 (old scoring untouched).
  ok(replayWavefrontRun(data.ace.seed, data.ace.raw, WAV_REV_STRICT).score <= 150, "the 200 run's log scores at most 150 on wavRev 8");
}

/* 4. Rules. */
section("Rules: world, waves, spread, shield, streak, weak points, gunship");
const game = wavefrontGameFor(WAV_REV_EXPAND);
const step = (s: WavState, n = 1): WavState => {
  for (let k = 0; k < n; k++) s = game.step(s, null) as WavState;
  return s;
};
const base = game.init(12345) as WavState;
ok(base.x9 === 1 && base.worldH === WAV_X_H && base.shapes.length === WAV_X_SHAPES && WAV_X_SHAPES === 36, "wave 1 is a 36-ship grid in the 800 px world");
ok(wavShipY(base) === WAV_X_H - 66, "the ship sits 66 px above the bottom");
for (let wave = 2; wave <= 5; wave++) ok(WAV_FORMS_X[wave]!.length === 36, `wave ${wave}'s shape has 36 slots (30 and six escorts)`);
ok(wavStreakMult(0) === 1 && wavStreakMult(7) === 1 && wavStreakMult(8) === 2 && wavStreakMult(16) === 3 && wavStreakMult(24) === 4 && wavStreakMult(99) === 4, "streak multiplier ×1 / ×2 at 8 / ×3 at 16 / ×4 at 24 and on");
{
  // Spread: a volley is the centre bolt and two angled ones.
  let s: WavState = { ...base, enter: 0, fy: 84, spread: 2, fireIn: 1, bolts: [] };
  s = step(s);
  ok(s.bolts.length === 3 && s.bolts.filter((b) => b.sd).length === 2 && s.spread === 1, "a spread volley fires three bolts and uses one volley");
  ok(s.bolts.some((b) => (b.v ?? 0) < 0) && s.bolts.some((b) => (b.v ?? 0) > 0), "the spread bolts angle out both ways");
}
{
  // Shield: a red bolt on the ship is absorbed; no life lost, the streak kept.
  const y = wavShipY(base);
  let s: WavState = { ...base, enter: 0, fy: 84, shield: 100, streak: 9, reds: [{ x: base.shipX * 256, y: (y - 8) * 256 }], invuln: 0 };
  s = step(s);
  ok(s.lives === base.lives && s.shieldBlocks === 1 && s.shield === 0 && s.streak === 9, "the shield absorbs a hit, keeps the streak and is spent");
  let t: WavState = { ...base, enter: 0, fy: 84, shield: 0, streak: 9, reds: [{ x: base.shipX * 256, y: (y - 8) * 256 }], invuln: 0 };
  t = step(t);
  ok(t.lives === base.lives - 1 && t.streak === 0, "without it the hit costs a life and the streak");
}
{
  // Streak: a hit adds its multiplier less one; a centre bolt flying off breaks it, a spread bolt never does.
  const box = wavShapeBox({ ...base, fy: 84 }, 0);
  let s: WavState = { ...base, enter: 0, fy: 84, streak: 15, streakPts: 0, fireIn: 99, bolts: [{ x: (box.x + WAV_CELL / 2) * 256, y: (box.y + WAV_CELL + 2) * 256 }] };
  s = step(s);
  ok(s.streak === 16 && s.streakPts === 2 && s.shapesDown === 1, "a hit grows the streak and pays ×3 less one");
  let m: WavState = { ...base, enter: 0, fy: 84, streak: 5, fireIn: 99, bolts: [{ x: 5 * 256, y: 40 * 256 }] };
  m = step(m);
  ok(m.streak === 0, "a centre bolt leaving the top breaks the streak");
  let sd: WavState = { ...base, enter: 0, fy: 84, streak: 5, fireIn: 99, bolts: [{ x: 5 * 256, y: 40 * 256, sd: 1, v: -512 }] };
  sd = step(sd);
  ok(sd.streak === 5, "a spread bolt leaving does not");
}
{
  // Weak points on the mothership: the open core takes 3, the closed core 1, a cannon its own hit points then drops a power-up.
  const boss = { x: 131, dir: 1, hp: 36, fireIn: 999, mid: 0, maxHp: 36, guns: [WAV_X_CANNON_HP, WAV_X_CANNON_HP], at: 0 };
  const at = (bx: number, tick: number, extra: Partial<WavState> = {}) => step({ ...base, enter: 0, tick, shapes: base.shapes.map(() => 0), wave: 6, boss: { ...boss, guns: [...boss.guns] }, fireIn: 99, bolts: [{ x: bx * 256, y: (WAV_BOSS_Y + 40) * 256 }], redIn: 999, ...extra });
  const open = at(131 + 64, 10);
  ok(wavCoreOpen(boss, 11) && open.boss!.hp === 36 - WAV_X_CORE_DAMAGE && open.weakHits === 1, "a hit on the open core takes 3");
  const shut = at(131 + 64, WAV_X_CORE_PERIOD / 2 + 10);
  ok(!wavCoreOpen(boss, WAV_X_CORE_PERIOD / 2 + 11) && shut.boss!.hp === 35 && (shut.weakHits ?? 0) === 0, "a hit on the closed core takes 1");
  const gun = at(131 + 8, 10, { boss: { ...boss, guns: [1, WAV_X_CANNON_HP] } });
  ok(gun.boss!.guns![0] === 0 && gun.cannonsDown === 1 && gun.drop !== null && gun.boss!.hp === 35, "a cannon's last hit destroys it (the boss takes one) and drops a power-up");
}
{
  // Drop kinds are seeded: over many saucer kills all three appear.
  const kinds = new Set<number>();
  for (let seed = 1; seed < 60; seed++) {
    const s0 = game.init(seed) as WavState;
    const s = step({ ...s0, enter: 0, fy: 84, saucerDir: 1, saucerX: 100 * 256, fireIn: 99, bolts: [{ x: 102 * 256, y: 60 * 256 }] });
    if (s.drop) kinds.add(s.drop.k ?? -1);
  }
  ok(kinds.has(0) && kinds.has(WAV_DROP_SPREAD) && kinds.has(WAV_DROP_SHIELD), `saucer drops are laser, spread and shield (${[...kinds].join(",")})`);
  // Catching a shield.
  const y = wavShipY(base);
  const c = step({ ...base, enter: 0, fy: 84, drop: { x: base.shipX * 256, y: (y - 4) * 256, wait: 0, k: WAV_DROP_SHIELD } });
  ok((c.shield ?? 0) > 0 && c.powerups === 1 && c.drop === null, "catching a shield raises it and counts a power-up");
}
{
  // The gunship after wave 3 counts as a wave; then wave 4 flies in.
  let s: WavState = { ...base, enter: 0, wave: 4, wavesCleared: 3, shapes: base.shapes.map(() => 0), boss: { x: 147, dir: 1, hp: 1, fireIn: 999, mid: 1, maxHp: 16, guns: [0, 0], at: 0 }, fireIn: 99, bolts: [{ x: (147 + 48) * 256, y: (WAV_BOSS_Y + 40) * 256 }], redIn: 999 };
  s = step(s);
  ok(s.midKilled === 1 && s.wavesCleared === 4 && s.boss === null && s.wave === 4 && s.shapes.some((c) => c !== 0) && (s.enter ?? 0) > 0, "the gunship down counts a wave and wave 4 flies in");
}
{
  // Scoring parts: base within 150, edge within 50, total within 200.
  ok(bandPoints(WAV_V9_BAND_CURVE, WAV_PAR_X) === 140 && bandPoints(WAV_X_EDGE_CURVE, 1e6) === 50, "the base curve tops at 140 at a perfect run, the edge at 50");
  let prev = -1;
  for (let u = 0; u <= WAV_PAR_X + 5; u++) {
    const p = bandPoints(WAV_V9_BAND_CURVE, u);
    if (p < prev) ok(false, `the base curve falls at ${u}`);
    prev = p;
  }
  const full = wavefrontBandParts({ ...base, shapesDown: 999, armourHits: 99, saucers: 9, wavesCleared: 6, bossDmg: 52, bossKilled: 1, bossAt: 3000, tick: 3100, streakPts: 9999, acted: 1 });
  ok(full.points === 140 && full.bonus === 60, "a perfect fast run: 140 + 10 + 50");
  ok(game.score({ ...base, shapesDown: 999, armourHits: 99, saucers: 9, wavesCleared: 6, bossDmg: 52, bossKilled: 1, bossAt: 3000, tick: 3100, streakPts: 9999, acted: 1 }) === 200, "…which is exactly 200");
  ok(game.score({ ...base, acted: 0 }) === 0, "no input scores 0");
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  ✗ ${f}`);
  console.log(`FAIL wavefront-expand-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS wavefront-expand-check: ${checks} checks — old rounds unchanged on every revision, rooms deal wavRev 9, recorded runs and a 200 replay, the new rules`);
