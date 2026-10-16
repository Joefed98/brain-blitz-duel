/**
 * Batch-3 arcade upgrades (Oct 2026): Wavefront wavRev 2, Grappler swingRev 4,
 * Breaker brkRev 2, Fission burstRev 2.
 *
 *  1. Legacy identity: stored rounds of all four games (Wavefront, Breaker and
 *     Fission unstamped; Grappler unstamped, swingRev 2 and 3) replay and score
 *     exactly as before (digest saved from the code before the upgrades).
 *  2. Per game, the new rules: the stamp, determinism, each new element, and a
 *     real input log reaching 150 through the server replay.
 *  3. The intro's stated maximums are true, and the intro HOW / SCORE rules hold.
 *
 *   bun scripts/arcade-batch3-check.ts            (BATCH3_ONLY=wavefront,swing,breaker,burst)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { legacyDigest } from "./arcade-batch3-legacy";
import { playBreaker, playBurst, playWavefront } from "./arcade-batch3-bots";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { buildArcadeReveal } from "../src/lib/arcade/reveal";
import { puzzleDef } from "../src/lib/duel/registry";
import { WAVEFRONT_TIME_MS } from "../src/lib/duel/types";
import {
  wavefrontGame,
  wavefrontGameFor,
  wavDiveEvery,
  wavScoreV2,
  WAV_ARMOUR_BY_WAVE,
  WAV_BOSS_HP,
  WAV_BREATHER_TICKS,
  WAV_DIVE_FROM_WAVE,
  WAV_PAR_V2,
  WAV_POINTS_BOSS,
  WAV_POINTS_SAUCER,
  WAV_POINTS_WAVE,
  WAV_REV,
  WAV_REV_TUNEC,
  WAV_SHAPES,
  WAV_V2_RUN_TICKS,
  WAV_V2_WAVES,
  type WavState,
} from "../src/lib/arcade/wavefront";
import { replayWavefrontRun } from "../src/lib/duel/wavefront";
import {
  breakerGame,
  breakerGameFor,
  brkRowOffset,
  BRK_BRICKS,
  BRK_COLS,
  BRK_FIRE_TICKS,
  BRK_POWER_FIRE,
  BRK_POWER_LASER,
  BRK_POWER_MULTI,
  BRK_POWER_SPAM,
  BRK_REV,
  BRK_REV_BAND,
  BRK_REV_TUNED,
  BRK_REV_TUNEF,
  BRK_SLIDE_AMP,
  BRK_SLIDE_STARTS,
  BRK_V2_LASER_BRICKS,
  BRK_V2_SPAM_SHOTS,
  BRK_PADDLE_Y_FP,
  BRK_WALL_Y,
  BRK_ROW_PITCH,
  type BrkState,
} from "../src/lib/arcade/breaker";
import { replayBreakerRun } from "../src/lib/duel/breaker";
import {
  burstGame,
  burstGameFor,
  BURST_FREEZE_TICKS,
  BURST_ICON_FREEZE,
  BURST_REV,
  BURST_REV_BAND,
  BURST_V2_PARTIAL_MAX,
  type BurstState,
} from "../src/lib/arcade/burst";
import { replayBurstRun } from "../src/lib/duel/burst";
import {
  swingCheckpoint,
  swingGameFor,
  swingJetAt,
  swingMetres,
  swingScoreV4,
  SWING_CHASE_FROM_M,
  SWING_CHASE_GAP,
  SWING_JET_BUBBLE,
  SWING_REV,
  SWING_REV_TUNEC,
  SWING_REV_V2,
  SWING_REV_V3,
  SWING_ROCK_WARN,
  SWING_STARS,
  type SwingState,
} from "../src/lib/arcade/swing";
import { encodeSwingRun, replaySwingRun } from "../src/lib/duel/swing";
import { proveSwingSeedV4 } from "../src/lib/duel/swingProof.server";
import { SWING_V4_BANK } from "../src/lib/duel/swingBankV4.server";
import { generateBreaker, generateBurst, generateSwing, generateWavefront } from "../src/lib/duel/arcade.server";

let checks = 0;
const ok = (value: unknown, message: string) => {
  assert.ok(value, message);
  checks++;
};
const section = (name: string) => console.log(`— ${name}`);
const ONLY = process.env.BATCH3_ONLY?.split(",");
const want = (key: string) => !ONLY || ONLY.includes(key);
const SEEDS = (count: number, step = 104_729) => Array.from({ length: count }, (_, i) => 1 + i * step);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/* ============================ 1. Legacy identity ============================ */
section("legacy identity");
{
  const saved = JSON.parse(readFileSync(new URL("./fixtures/arcade-batch3-legacy.json", import.meta.url), "utf8"));
  const now = await legacyDigest(new URL("..", import.meta.url).pathname.replace(/\/$/, ""));
  assert.deepEqual(now, saved, "stored rounds must replay exactly as before");
  checks += saved.length;
  console.log(`  ${saved.length} stored-rule runs (wavefront, breaker, burst, swing 0/2/3) identical to the pre-upgrade code`);
}
// Tuning A moved new Wavefront and Grappler rounds on to wavRev 4 / swingRev 6, Tuning C on to wavRev 5 / swingRev 7 (arcade-tuning-c-check), and Tuning F Grappler on to swingRev 8 (swing-rev8-check).
// Taller worlds batch 1 (16 Oct 2026) moved Wavefront, Breaker and Fission on to wavRev 6, brkRev 6 and burstRev 4 (arcade-tuning-g1-check).
ok(generateWavefront().wavRev === WAV_REV_TUNEC + 1 && generateBreaker().brkRev === BRK_REV_TUNEF + 1 && generateBurst().burstRev === BURST_REV_BAND + 1 && generateSwing().swingRev === SWING_REV_TUNEC + 2, "new rounds are stamped with the score-band revisions (the batch-3 rules plus the Oct 2026 bands; Tuning A then Tuning C for Wavefront and Grappler, Tuning F's spread stars and taller worlds batch 3's taller cavern for Grappler; Breaker brkRev 4 adds Tuning B's 3.5 s Fireball, brkRev 5 Tuning F's 2.5 s one, arcade-tuning-f-check)");

/* ================================ 2a. Wavefront ================================ */
if (want("wavefront")) {
  section("Wavefront wavRev 2");
  const game = wavefrontGameFor(WAV_REV);
  ok(wavefrontGameFor(undefined) === wavefrontGame && wavefrontGame.init(5).rev === undefined, "unstamped Wavefront keeps the original game");
  ok(game.runTicks === WAV_V2_RUN_TICKS && WAV_V2_RUN_TICKS === 90 * 60, "the rev-2 sim runs 90 s");
  ok(WAVEFRONT_TIME_MS === 93_000 && puzzleDef("wavefront").timeLimitMs === 93_000, "registry round time is 90 s + 3 s slack");
  ok(same(game.init(77), game.init(77)), "rev-2 runs are seeded");
  // Par: every ship, armour hit and wave of five, every boss hit and the kill.
  let par = 0;
  for (let w = 1; w <= WAV_V2_WAVES; w++) {
    par += WAV_SHAPES + WAV_POINTS_WAVE;
    if (w >= 2) {
      const [cells, hits] = WAV_ARMOUR_BY_WAVE[Math.min(w - 2, WAV_ARMOUR_BY_WAVE.length - 1)]!;
      par += hits - cells;
    }
  }
  par += WAV_BOSS_HP + WAV_POINTS_BOSS;
  ok(par === WAV_PAR_V2, `WAV_PAR_V2 is every wave plus the boss (${WAV_PAR_V2})`);
  // 150 needs the boss: without the kill, even every saucer of a 90 s run stays under 150.
  const saucersMax = Math.trunc((WAV_V2_RUN_TICKS - 1) / (15 * 60));
  const shipsAll = par - WAV_BOSS_HP - WAV_POINTS_BOSS - WAV_POINTS_WAVE * WAV_V2_WAVES;
  ok(wavScoreV2(shipsAll, saucersMax, WAV_V2_WAVES, 0, WAV_BOSS_HP - 1, 0) < 150, "no boss kill: under 150 even with every saucer");
  ok(WAV_POINTS_BOSS > WAV_POINTS_SAUCER * saucersMax, "the kill is worth more than every saucer");
  ok(wavScoreV2(shipsAll, 0, WAV_V2_WAVES, 0, WAV_BOSS_HP, 1) === 150, "every wave plus the boss = 150");

  // Fly-in: no march and no enemy fire while entering, the formation glides down to its place.
  {
    let s = game.init(4242);
    ok(s.enter === WAV_BREATHER_TICKS && s.fy < 0, "wave 1 starts above the screen with a 2 s fly-in");
    const fys: number[] = [];
    for (let i = 0; i < WAV_BREATHER_TICKS; i++) {
      s = game.step(s, null);
      fys.push(s.fy);
      ok(s.reds.length === 0 && s.dir === 1, "no enemy fire or march during the fly-in");
    }
    ok(s.enter === 0 && s.fy === s.fyTarget, "the formation reaches its place as the breather ends");
    ok(fys.every((y, i) => i === 0 || (y >= fys[i - 1]! && y - fys[i - 1]! <= 4)), "the fly-in moves smoothly (≤ 4 px a tick)");
    // Clearing a wave starts the next fly-in at once, never a cut.
    const cleared = game.step({ ...s, shapes: s.shapes.map(() => 0), armour: null }, null);
    ok(cleared.wave === 2 && cleared.enter === WAV_BREATHER_TICKS && cleared.fy < 0 && cleared.shapes.some((c) => c > 0), "the next formation flies in as the last is cleared");
  }
  // Divers: none before wave 3; from wave 3 on the seeded timer; fly the curve, come home.
  {
    const base = game.init(90210);
    let s: WavState = { ...base, enter: 0, fy: base.fyTarget!, diveIn: 1 };
    s = game.step(s, null);
    ok((s.divers ?? []).length === 0, "no divers on wave 1");
    s = { ...base, enter: 0, fy: base.fyTarget!, wave: WAV_DIVE_FROM_WAVE, diveIn: 1, shipX: 100, aimX: 100 };
    s = game.step(s, { t: s.tick + 1, k: 7, a: 100, b: 0, c: 0, d: 0 });
    ok((s.divers ?? []).length === 1 && s.diveIn === wavDiveEvery(WAV_DIVE_FROM_WAVE), "wave 3: a diver peels off on the seeded timer");
    const again = game.step({ ...base, enter: 0, fy: base.fyTarget!, wave: WAV_DIVE_FROM_WAVE, diveIn: 1, shipX: 100, aimX: 100 }, { t: 1, k: 7, a: 100, b: 0, c: 0, d: 0 });
    ok(same(again.divers, s.divers), "the dive is seeded (same pick and path)");
    const d = s.divers![0]!;
    let k = s;
    let lastY = d.y;
    let home = false;
    // Keep the ship far from the path so it never rams; follow the diver until it is home.
    for (let i = 0; i < 260 && !game.isOver(k); i++) {
      k = game.step({ ...k, invuln: 999, lives: 3, aimX: 370 }, null);
      const now = (k.divers ?? []).find((x) => x.cell === d.cell);
      if (!now) { home = true; break; }
      if (now.t <= 150) ok(now.y >= lastY, "a diver keeps diving down");
      lastY = now.y;
    }
    ok(home && k.shapes[d.cell] !== 0, "a diver that is not shot flies home to its slot");
  }
  // Boss after the last wave: health bar, seeded pattern, the kill ends the run.
  {
    const base = game.init(31337);
    const s = game.step({ ...base, enter: 0, wave: WAV_V2_WAVES, shapes: base.shapes.map(() => 0), armour: null }, null);
    ok(s.boss && s.boss.hp === WAV_BOSS_HP && s.enter === WAV_BREATHER_TICKS && s.wavesCleared === base.wavesCleared + 1, "after wave 5 the boss flies in with full health");
    let b = s;
    for (let i = 0; i < WAV_BREATHER_TICKS + 200; i++) b = game.step({ ...b, invuln: 999 }, null);
    ok(b.reds.length > 0 && b.boss!.x !== s.boss!.x, "the boss moves and fires once it has arrived");
    const kill = game.step({ ...b, boss: { ...b.boss!, hp: 1 }, bolts: [{ x: (b.boss!.x + 64) * 256, y: (84 + 36) * 256 }] }, null);
    ok(kill.bossKilled === 1 && kill.ended === 1, "the last hit destroys the boss and ends the run");
  }
  // 150 through the server replay, and when the boss is reached.
  let best = 0;
  const bossAt: number[] = [];
  for (const seed of [1, 4242]) {
    const run = playWavefront(game, seed);
    const replay = replayWavefrontRun(seed, run.raw, WAV_REV);
    ok(replay.score === run.score && !replay.flagged, `seed ${seed}: server replay agrees (${replay.reason ?? "ok"})`);
    best = Math.max(best, replay.score);
    if (replay.bossKilled) bossAt.push(replay.endedSeconds);
  }
  ok(best === 150, `150 is reachable on wavRev 2 through the server replay (best ${best})`);
  ok(bossAt.every((t) => t < 90), `a strong player destroys the boss inside 90 s (${bossAt.join(", ")} s)`);
  // The reveal and the wording.
  const reveal = buildArcadeReveal("wavefront", { wavRev: 2, wavesCleared: 5, shapesDown: 150, armourHits: 40, saucers: 2, lives: 3, bossHits: WAV_BOSS_HP, bossKilled: 1 }, 150);
  ok(reveal?.tiles[0]?.value === "Destroyed" && reveal.outcome === "finish", "reveal: boss destroyed is a finish");
  const text = JSON.stringify(PUZZLE_INSTRUCTIONS.wavefront) + INTRO_SCORE.wavefront;
  ok(!/block/i.test(text) && /armoured ship/.test(text), "Wavefront text says armoured ships, never blocks");
  ok(/90 s/.test(PUZZLE_INSTRUCTIONS.wavefront.goal), "the intro says 90 seconds");
  // Tuning C (wavRev 5) times the kill: up to 10, sooner scores more.
  ok(/Destroy the boss fast for up to 10 more/.test(INTRO_SCORE.wavefront), "intro: destroying the boss adds up to 10 for speed (Tuning C)");
}

/* ================================ 2b. Breaker ================================ */
if (want("breaker")) {
  section("Breaker brkRev 2");
  const game = breakerGameFor(BRK_REV);
  ok(breakerGameFor(undefined) === breakerGame && breakerGame.init(5).rev === undefined, "unstamped Breaker keeps the original game");
  for (const seed of SEEDS(200, 7919)) {
    const s = game.init(seed);
    const kinds = s.gold.filter((g) => g > 0).map((g) => g - 1).sort();
    ok(same(kinds, [BRK_POWER_MULTI, BRK_POWER_SPAM, BRK_POWER_LASER, BRK_POWER_FIRE].sort()), `seed ${seed}: one each of ×2, ×3, laser and Fireball`);
    ok(s.slide!.length === 2 && s.slide![0] !== s.slide![1] && s.slide!.every((r) => r >= 3 && r <= 7), "two distinct sliding rows from rows 3-7");
    ok(s.bricks.length === BRK_BRICKS, "still 80 bricks");
  }
  // Sliding rows: still before their start, slow, continuous, at most half a brick.
  {
    const s = game.init(77);
    for (const [slot, row] of s.slide!.entries()) {
      ok(brkRowOffset(s, row, BRK_SLIDE_STARTS[slot]! - 1) === 0, `sliding row ${slot + 1} is still before ${BRK_SLIDE_STARTS[slot]! / 60} s`);
      for (let t = 0; t < 5400; t++) {
        const a = brkRowOffset(s, row, t), b = brkRowOffset(s, row, t + 1);
        ok(Math.abs(a) <= BRK_SLIDE_AMP && Math.abs(b - a) <= 1, "slides at most 1 px a tick within half a brick");
      }
    }
    ok(brkRowOffset(s, 0, 4000) === 0 || s.slide!.includes(0), "other rows never slide");
  }
  // Weaker laser (4 bricks), ×3 shots, Fireball smashes through.
  {
    const s = game.init(4242);
    const held: BrkState = { ...s, held: BRK_POWER_LASER + 1, charges: 1, pause: 0, balls: [] };
    const fired = game.step(held, { t: 1, k: 10, a: 0, b: 0, c: 0, d: 0 });
    ok(fired.hits - s.hits === BRK_V2_LASER_BRICKS, `the laser hits ${BRK_V2_LASER_BRICKS} bricks (was a whole column)`);
    const spam = game.step({ ...s, capsules: [{ x: s.paddleX * 256, y: BRK_PADDLE_Y_FP - 512, kind: BRK_POWER_SPAM }] }, null);
    ok(spam.charges === BRK_V2_SPAM_SHOTS && BRK_V2_SPAM_SHOTS === 3, "the silver capsule now holds 3 shots");
    const lit = game.step({ ...s, capsules: [{ x: s.paddleX * 256, y: BRK_PADDLE_Y_FP - 512, kind: BRK_POWER_FIRE }] }, null);
    ok(lit.fire === BRK_FIRE_TICKS && lit.fireballs === 1, "catching the Fireball lights it for 5 s");
    // A burning ball flying up through the wall keeps going up and destroys what it touches.
    const y = (BRK_WALL_Y + 9 * BRK_ROW_PITCH + 30) * 256;
    let b: BrkState = { ...lit, balls: [{ x: 200 * 256, y, vx: 0, vy: -1024, spam: 0 }] };
    let destroyed = 0;
    for (let i = 0; i < 40; i++) {
      b = game.step(b, null);
      destroyed = b.bricks.filter((h) => h === 0).length;
      ok(b.balls[0] === undefined || b.balls[0].vy < 0 || b.balls[0].y < (44 + 8 + 10) * 256, "a Fireball does not bounce off bricks");
    }
    ok(destroyed >= 4, `a Fireball smashes straight through (${destroyed} bricks gone)`);
    const legacy = breakerGame.step({ ...breakerGame.init(4242), held: BRK_POWER_LASER + 1, charges: 1, pause: 0, balls: [] }, { t: 1, k: 10, a: 0, b: 0, c: 0, d: 0 });
    ok(legacy.hits - breakerGame.init(4242).hits === 10, "original rounds keep the full-column laser");
  }
  // The reveal tile shows hits landed, not the wall's total.
  const tile = buildArcadeReveal("breaker", { destroyed: 6, hits: 9, totalHits: 130, powerUps: 0, losses: 0, cleared: false, bricksLeft: 74, endedSeconds: 90 }, 10)!.tiles.find((t) => t.label === "Brick hits");
  ok(tile?.value === "9", "reveal: Brick hits is the hits the run landed (was 130 for 6 bricks)");
  // 150 through the server replay.
  let best = 0;
  for (const seed of [4242, 77]) {
    const run = playBreaker(game, seed);
    const replay = replayBreakerRun(seed, run.raw, BRK_REV);
    ok(replay.score === run.score && !replay.flagged, `seed ${seed}: server replay agrees (${replay.reason ?? "ok"})`);
    best = Math.max(best, replay.score);
  }
  ok(best === 150, `150 is reachable on brkRev 2 through the server replay (best ${best})`);
  ok(game.score({ ...game.init(1), bricks: game.init(1).bricks.map((_, i) => (i === 0 ? 1 : 0)) }) === 128 && !INTRO_SCORE.breaker.includes("otherwise up to"), "stored rounds keep the 128 partial maximum; the band intro states none");
  const help = JSON.stringify(PUZZLE_INSTRUCTIONS.breaker);
  ok(/×3/.test(help) && /shots/.test(help) && !/×5 balls/.test(help), "help names ×3 shots, not ×5 balls");
}

/* ================================ 2c. Fission ================================ */
if (want("burst")) {
  section("Fission burstRev 2");
  const game = burstGameFor(BURST_REV);
  ok(burstGameFor(undefined) === burstGame && burstGame.init(5).rev === undefined, "unstamped Fission keeps the original game");
  // Drop rates, from many pops of each size on the seeded stream.
  const counts = [[0, 0], [0, 0], [0, 0]] as [number, number][];
  for (const seed of SEEDS(60, 7919)) {
    for (const size of [0, 1, 2]) {
      let s: BurstState = { ...game.init(seed), wave: 1, nextWaveAt: 1e9 };
      for (let k = 0; k < 40; k++) {
        s = { ...s, balls: [{ size, x: 195 * 256, y: 300 * 256, vx: 0, vy: 0 }], shots: [{ x: 195 * 256, top: 305 * 256, short: 0 }], icons: [] };
        s = game.step(s, null);
        counts[size]![0] += 1;
        if (s.icons.length > 0) counts[size]![1] += 1;
        if (size === 2 && s.icons.length > 0) ok(s.icons[0]!.kind === BURST_ICON_FREEZE, "green atoms drop FREEZE");
      }
    }
  }
  const rate = (i: number) => counts[i]![1] / counts[i]![0];
  ok(Math.abs(rate(0) - 1 / 2) < 0.06, `BURST from about 1 in 2 purple atoms (${rate(0).toFixed(3)}; was every one)`);
  ok(Math.abs(rate(1) - 1 / 8) < 0.03, `SHIELD from about 1 in 8 blue atoms (${rate(1).toFixed(3)}; was 1 in 4)`);
  ok(Math.abs(rate(2) - 1 / 12) < 0.025, `FREEZE from about 1 in 12 green atoms (${rate(2).toFixed(3)})`);
  console.log(`  drop rates: BURST ${rate(0).toFixed(3)}, SHIELD ${rate(1).toFixed(3)}, FREEZE ${rate(2).toFixed(3)} over ${counts[0]![0]} pops each`);
  // Freeze: catching it stops every atom for 3 s, then they move again.
  {
    let s: BurstState = { ...game.init(9), wave: 1, nextWaveAt: 1e9, balls: [{ size: 1, x: 60 * 256, y: 200 * 256, vx: 495, vy: 0 }], icons: [{ x: 195 * 256, y: (560 - 40) * 256, kind: BURST_ICON_FREEZE }] };
    s = game.step(s, null);
    ok(s.freeze === BURST_FREEZE_TICKS && s.freezes === 1, "catching FREEZE starts a 3 s freeze");
    const at = { x: s.balls[0]!.x, y: s.balls[0]!.y };
    for (let i = 0; i < BURST_FREEZE_TICKS - 1; i++) s = game.step(s, null);
    ok(s.balls[0]!.x === at.x && s.balls[0]!.y === at.y, "every atom stays put for 3 s");
    s = game.step(game.step(s, null), null);
    ok(s.balls[0]!.x !== at.x, "then the atoms move again");
  }
  // 150 only for the flawless finish; otherwise at most 130.
  const v2 = game.init(1);
  ok(game.score({ ...v2, hits: 500, ended: 2, lives: 0 }) <= BURST_V2_PARTIAL_MAX && game.score({ ...v2, hits: 500, ended: 1, lives: 2, cleared: 9 }) === BURST_V2_PARTIAL_MAX, "without the flawless finish: up to 130");
  ok(game.score({ ...v2, hits: 10, ended: 1, lives: 3, cleared: 4 }) === 150 && game.score({ ...v2, hits: 500, ended: 1, lives: 3, cleared: 3 }) === 130, "150 needs the full run, no life lost and 4+ waves");
  let best = 0;
  for (const seed of [1, 4242]) {
    const run = playBurst(game, seed);
    const replay = replayBurstRun(seed, run.raw, BURST_REV);
    ok(replay.score === run.score && !replay.flagged, `seed ${seed}: server replay agrees (${replay.reason ?? "ok"})`);
    if (replay.score === 150) ok(replay.livesLost === 0 && replay.cleared >= 4 && replay.state.ended === 1, "a 150 is a flawless full run");
    best = Math.max(best, replay.score);
  }
  ok(best === 150, `150 is reachable on burstRev 2 through the server replay (best ${best})`);
  ok(/90 s for 10 more/.test(INTRO_SCORE.burst) && /lost life/.test(INTRO_SCORE.burst), "intro: atoms, lives, 10 more for the 90 s (score bands)");
}

/* ================================ 2d. Grappler ================================ */
if (want("swing")) {
  section("Grappler swingRev 4");
  const game = swingGameFor(SWING_REV);
  ok(SWING_REV === 4 && swingGameFor(SWING_REV_V3).init(5).dragons?.length && swingGameFor(SWING_REV_V2).init(5).dragons?.length, "swingRev 2 and 3 keep their dragons");
  const init = game.init(SWING_V4_BANK[0]?.seed ?? 1);
  ok(init.dragons === undefined && init.rev === SWING_REV, "swingRev 4 has no fixed dragons");
  ok(same(game.init(4242), game.init(4242)), "rev-4 courses are seeded");
  for (const seed of SEEDS(12, 7919)) {
    const s = game.init(seed);
    ok((s.starAnchors ?? []).length <= SWING_STARS && (s.rocks ?? []).length === 8 && (s.jets ?? []).length === 8, `seed ${seed}: stars, 8 stalactites and 8 lava jets`);
    ok(s.anchors.every((a, i) => i === 0 || a.x >= s.anchors[i - 1]!.x), "anchors stay in order");
  }
  // The chasing dragon: appears at 200 m behind the ninja, catches a staller.
  {
    const s0 = game.init(SWING_V4_BANK[0]?.seed ?? 1);
    const far = { ...s0, maxX: s0.x + (SWING_CHASE_FROM_M + 4) * 40 * 256, rope: -1, vx: 0, vy: 0, y: 300 * 256 };
    let s = game.step(far, null);
    ok(s.chaseX === s.x - SWING_CHASE_GAP, "at 200 m the dragon appears 400 px behind");
    // Hold the ninja still in the air (no gravity) and let the dragon come.
    let caught = -1;
    for (let i = 0; i < 400 && caught < 0; i++) {
      s = game.step({ ...s, vx: 0, vy: -77, rocks: [], jets: [] }, null);
      if (s.ended === 2) caught = i;
    }
    ok(caught > 0 && s.cause === 1, `stalling lets the dragon catch you (after ${caught} ticks)`);
  }
  // Stalactites warn for 1 s before falling; jets bubble before erupting.
  {
    const s0 = game.init(4242);
    const rock = s0.rocks![0]!;
    let s: SwingState = { ...s0, x: rock.x - rock.trigger, maxX: rock.x - rock.trigger, rope: -1, vx: 0, vy: -77, y: 300 * 256 };
    s = game.step(s, null);
    ok(s.rocks![0]!.phase === 1, "a stalactite starts its shadow warning as the ninja comes within range");
    for (let i = 0; i < SWING_ROCK_WARN - 1; i++) s = game.step({ ...s, vx: 0, vy: -77 }, null);
    ok(s.rocks![0]!.phase === 1, "it is still warning just before 1 s");
    s = game.step({ ...s, vx: 0, vy: -77 }, null);
    ok(s.rocks![0]!.phase === 2, "it falls after 1 s of warning");
    for (const jet of s0.jets!) {
      let bubbling = 0;
      let erupted = false;
      for (let t = 0; t < jet.period * 2; t++) {
        const j = swingJetAt(jet, t);
        if (j.bubbling) bubbling += 1;
        if (j.h > 0 && !erupted && swingJetAt(jet, t - 1).h === 0 && t > 0) { erupted = true; ok(swingJetAt(jet, t - 1).bubbling, "every eruption follows its bubbling warning"); }
      }
      ok(bubbling >= SWING_JET_BUBBLE, "jets bubble for a full second each cycle");
    }
  }
  // Scoring: distance up to 120, stars up to 10 (130 unfinished), 500 m adds 20.
  ok(swingScoreV4(499, 10) === 130 && swingScoreV4(250, 0) === 60 && swingScoreV4(500, 10) === 150 && swingScoreV4(500, 3) === 143, "120 × m ÷ 500 + stars; 500 m adds 20");
  ok(INTRO_SCORE.swing.includes("500 metres for 10 more") && !INTRO_SCORE.swing.includes("otherwise"), "intro states the 10 for 500 m and no partial cap (score bands)");
  // The bank: every entry has 10 stars; sampled entries reach 150 through the server replay.
  ok(SWING_V4_BANK.length >= 200 && SWING_V4_BANK.every((e) => e.stars === SWING_STARS), `${SWING_V4_BANK.length} banked courses, each proved with all 10 stars`);
  let reached = 0;
  for (const entry of SWING_V4_BANK.slice(0, 3)) {
    const witness = proveSwingSeedV4(entry.seed);
    ok(witness && witness.stars === SWING_STARS, `bank seed ${entry.seed}: the proof still takes all 10 stars`);
    const byTick = new Map(witness!.log.map((e) => [e.t, e]));
    let s = game.init(entry.seed);
    const checkpoints: ReturnType<typeof swingCheckpoint>[] = [];
    while (!s.ended) {
      s = game.step(s, byTick.get(s.tick + 1) ?? null);
      if (s.tick % 300 === 0) checkpoints.push(swingCheckpoint(s));
    }
    const raw = encodeSwingRun({ seed: entry.seed, claimedScore: game.score(s), events: witness!.log, endTick: s.tick, checkpoints });
    const replay = replaySwingRun(entry.seed, raw, SWING_REV);
    ok(!replay.flagged && same(replay.state, s), `bank seed ${entry.seed}: server replay identical`);
    if (replay.score === 150 && swingMetres(replay.state) >= 500) reached++;
  }
  ok(reached > 0, `150 is reachable on swingRev 4 through the server replay (${reached} of 3 sampled bank courses)`);
  const text = JSON.stringify(PUZZLE_INSTRUCTIONS.swing) + INTRO_SCORE.swing + readFileSync(new URL("../src/puzzles/swing.tsx", import.meta.url), "utf8") + readFileSync(new URL("../src/components/duel/IntroDemo.tsx", import.meta.url), "utf8") + readFileSync(new URL("../src/lib/arcade/reveal.ts", import.meta.url), "utf8");
  ok(!/dragons near the end/i.test(text), "no 'Watch out for dragons near the end' anywhere (intro, HOW, demo, help, reveal)");
  ok(/dragon chases/i.test(JSON.stringify(PUZZLE_INSTRUCTIONS.swing)), "the intro describes the chasing dragon");
}

/* ============================ 3. Intro text rules ============================ */
section("intro text");
for (const type of (["wavefront", "swing", "breaker", "burst"] as const).filter(want)) {
  const help = PUZZLE_INSTRUCTIONS[type];
  const intro = help.how.filter((line) => !line.helpOnly);
  ok(intro.length <= 3, `${type}: intro HOW has at most three lines (${intro.length})`);
  // One phone line each at 375 px, as batch 2 measured in Chromium (READY visible at 375×667).
  for (const line of intro) ok(`${line.action} ${line.detail}`.length <= 46, `${type}: intro HOW line fits one line: ${line.action} ${line.detail}`);
  ok(help.goal.length <= 34, `${type}: intro GOAL fits one line: ${help.goal}`);
  ok(INTRO_SCORE[type].length <= 90, `${type}: intro SCORE within 90 characters (${INTRO_SCORE[type].length})`);
}

console.log(`arcade batch 3: ${checks} checks passed`);
