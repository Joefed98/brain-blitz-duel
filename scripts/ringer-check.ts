/**
 * Ringer (Alley Roll alleyRollRev 2, 3 Nov 2026; docs/arcade-standard/alleyroll.md, "Ringer"):
 *
 *  1. the board: the cup tower (each cup higher and further back, nested in the one below), the 10 ring round it, the
 *     two 100 pockets in the top corners, the gold cup's track along the top;
 *  2. the gold cup: its path comes from the seed (the same seed the same path, seeds differ), stays on its track, moves
 *     at most its speed a tick, and catches a ball only when it is there (a timed roll scores 150, the same roll a
 *     quarter period later does not);
 *  3. the physics: integer only, seed-free for every target but the gold cup, the same roll the same landing on every
 *     seed, more power carries further (no tick-sized steps), the rails and the input's ranges;
 *  4. the swipe (the phone's mapping, which the bots use too): the same swipe the same input, the start sets the
 *     release, the angle the direction, the speed the power; rev 1's ranges unchanged;
 *  5. the parts: Ring points 140 (straight, full at AR2_CORE_FULL), Gold cup 10 a hit to 30, Roll streak 4 to 20 (30 or
 *     more after 30 or more), Pocket hits 5 to 10; a feature never costs core; no input 0, a played run at least 1;
 *  6. the run and the replay: one roll a ball, nine balls a finish, 60 s; deterministic, tamper-proof, rev 1's runs
 *     replay on rev 1's game;
 *  7. the oracle scores 200 through the server replay on every tuning seed (0–59) and fresh seed (10000–10199);
 *  8. the bands rise weak → flawless with gaps, flawless 200, every played level at least 1 (16 seeds);
 *  9. rooms deal alleyRollRev 2; the name, the help, the intro line and the reveal line.
 *
 *   bun scripts/ringer-check.ts
 */
import { inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  ALLEYROLL_REV_DEALT, ALLEYROLL_REV_RINGER, AR2_CORE_FULL, AR2_CUPS, AR2_GOLD_AMP_MAX, AR2_GOLD_AMP_MIN, AR2_GOLD_PERIOD_MAX, AR2_GOLD_PERIOD_MIN,
  AR2_GOLD_RIM, AR2_GOLD_R, AR2_GOLD_Y, AR2_POCKETS, AR2_VMAX, AR2_VMIN, AR_BALLS, AR_BALL_R, AR_BOARD_D, AR_CHECKPOINT_INTERVAL, AR_INPUT_ROLL, AR_RUN_TICKS,
  AR_VMAX, AR_VMIN, alleyRollGame, arLaunchV2, alleyRollGameFor, alleyRollStdParts, arCheckpoint, arGoldCrossing, arGoldX256, arInitV2, arSimulateBallV2,
  ringerGame, type ArBall,
} from "../src/lib/arcade/alleyroll";
import { arReleaseAt, arReleaseScreenX, ringerSwipeFor, ringerSwipeInput } from "../src/lib/arcade/alleyrollSwipe";
import { encodeAlleyRollRun, replayAlleyRollRun } from "../src/lib/duel/alleyroll";
import { generateAlleyRoll } from "../src/lib/duel/sports.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { ringerAim, ringerGoldAim, ringerGoldTick, ringerOracleRun, RINGER_GOLD_X, RINGER_RELEASE } from "./ringer-oracle";
import { alleyRollOracleRun } from "./alleyroll-oracle";
import { ALL_LEVELS, Human } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/alleyroll";

console.error = () => {};
let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}

/* 1. The board. */
{
  ok(AR2_CUPS.map((c) => c.points).join() === "50,40,30,20,10", "board: the cups run 50 (top) down to the 10 ring");
  ok(AR2_CUPS.every((c, i) => i === 0 || (c.h < AR2_CUPS[i - 1]!.h && c.r > AR2_CUPS[i - 1]!.r && c.cy < AR2_CUPS[i - 1]!.cy)), "board: each cup is lower, wider and nearer than the one above it");
  ok(AR2_CUPS.every((c, i) => i === 0 || Math.hypot(c.cx - AR2_CUPS[i - 1]!.cx, c.cy - AR2_CUPS[i - 1]!.cy) + AR2_CUPS[i - 1]!.r <= c.r), "board: each cup stands inside the one below (a tower)");
  ok(AR2_CUPS.at(-1)!.h === 0, "board: the 10 ring lies flat on the board");
  const ring = AR2_CUPS.at(-1)!;
  ok(AR2_POCKETS.every((p) => Math.hypot(p.x - ring.cx, p.y - ring.cy) > ring.r + 10 && p.y > AR_BOARD_D * 0.75 && Math.abs(p.x) > 100), "board: the two 100 pockets sit in the top corners, clear of the rings");
  ok(AR2_GOLD_Y > AR2_POCKETS[0]!.y && AR2_GOLD_Y + AR2_GOLD_R < AR_BOARD_D - AR_BALL_R, "board: the gold cup's track runs along the top, in front of the back wall");
  ok(AR2_GOLD_RIM === AR2_GOLD_R + AR_BALL_R, "board: the gold cup's drawn rim is its catch radius plus the ball's (the ball drops in whole)");
}

/* 2. The gold cup. */
{
  const a = arInitV2(12345);
  const b = arInitV2(12345);
  ok(a.gp === b.gp && a.gph === b.gph && a.ga === b.ga, "gold: the same seed, the same path");
  const paths = new Set(Array.from({ length: 50 }, (_, i) => { const s = arInitV2(i * 977 + 3); return `${s.gp}/${s.gph}/${s.ga}`; }));
  ok(paths.size >= 45, `gold: seeds give different paths (${paths.size} of 50)`);
  let inRange = true;
  let smooth = true;
  for (let seed = 0; seed < 40; seed++) {
    const s = arInitV2(seed);
    if (s.gp! < AR2_GOLD_PERIOD_MIN || s.gp! > AR2_GOLD_PERIOD_MAX || s.gp! % 2 || s.ga! < AR2_GOLD_AMP_MIN || s.ga! > AR2_GOLD_AMP_MAX) inRange = false;
    const most = Math.ceil((4 * s.ga! * 256) / s.gp!) + 1;
    for (let t = 0; t < 400; t++) {
      const x = arGoldX256(s, t);
      if (Math.abs(x) > s.ga! * 256) inRange = false;
      if (Math.abs(arGoldX256(s, t + 1) - x) > most) smooth = false;
    }
  }
  ok(inRange, "gold: period, phase and half-width in their ranges; the cup stays on its track");
  ok(smooth, "gold: the cup glides (at most its speed a tick, no jumps)");
  // A timed roll drops in; the same roll a quarter period later does not.
  const aim = ringerGoldAim(RINGER_GOLD_X);
  let timed = 0;
  let late = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const s = arInitV2(seed);
    const t0 = ringerGoldTick(s, aim, 40);
    if (arSimulateBallV2(aim.a, aim.b, aim.c, seed, t0).points === 150) timed++;
    if (arSimulateBallV2(aim.a, aim.b, aim.c, seed, t0 + Math.floor(s.gp! / 4)).points === 150) late++;
  }
  ok(timed === 30 && late === 0, `gold: a timed roll drops in (${timed}/30), a quarter period late it does not (${late}/30)`);
}

/* 3. The physics. */
{
  const roll = { a: 12, b: 140, c: 3000 };
  const seen = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(arSimulateBallV2(roll.a, roll.b, roll.c, i * 7919 + 1, 30)).replace(/"tick":\d+/, "")));
  ok(seen.size === 1, "physics: the same roll lands in the same place on every seed (away from the gold cup)");
  let monotone = true;
  let prev = -Infinity;
  let biggest = 0;
  for (let c = AR2_VMIN; c <= 3300; c += 8) {
    const g = arGoldCrossing(60, 0, c);
    if (!g) continue;
    if (g.y < prev - 0.5) monotone = false;
    if (prev > -Infinity) biggest = Math.max(biggest, g.y - prev);
    prev = g.y;
  }
  ok(monotone && biggest < 4, `physics: more power carries further, with no tick-sized steps (largest step ${biggest.toFixed(2)} px for 8 units)`);
  const l = arLaunchV2(999, 99999, 99999);
  const lo = arLaunchV2(-999, 0, 1);
  ok(l.vy === AR2_VMAX && l.vx === Math.floor((AR2_VMAX * 3) / 10) && l.x < 100 && lo.vy === AR2_VMIN && lo.x > -100, "physics: the release, angle and speed are held to their ranges");
  ok(ringerGame.inputRanges[0]!.c[0] === AR2_VMIN && alleyRollGame.inputRanges[0]!.c[0] === AR_VMIN && alleyRollGame.inputRanges[0]!.c[1] === AR_VMAX, "physics: Ringer's speed range is its own; rev 1's is unchanged");
  const r = arSimulateBallV2(-80, -900, 3000, 3, 30);
  ok(r.x > -130 && Number.isInteger(r.x) && Number.isInteger(r.y), "physics: a rail bounces the ball back; integers only");
}

/* 4. The swipe. */
{
  const one = ringerSwipeInput(150, 24, -120, 80);
  const two = ringerSwipeInput(150, 24, -120, 80);
  ok(JSON.stringify(one) === JSON.stringify(two) && one !== null, "swipe: the same swipe makes the same input");
  ok(ringerSwipeInput(150, 0, -6, 20) === null, "swipe: a swipe that does not climb rolls nothing");
  ok(ringerSwipeInput(arReleaseScreenX(-40), 0, -120, 80)!.a === -40 && arReleaseAt(arReleaseScreenX(33)) === 33, "swipe: where it starts sets the release point");
  const left = ringerSwipeInput(207, -30, -120, 80)!;
  const right = ringerSwipeInput(207, 30, -120, 80)!;
  ok(left.b < 0 && right.b > 0 && left.c === right.c, "swipe: its angle sets the direction");
  const slow = ringerSwipeInput(207, 0, -120, 160)!;
  const fast = ringerSwipeInput(207, 0, -120, 60)!;
  ok(fast.c > slow.c && slow.c >= AR2_VMIN && fast.c <= AR2_VMAX, "swipe: its speed sets the power");
  const back = ringerSwipeFor(ringerAim("fifty", 0).b, ringerAim("fifty", 0).c);
  const again = ringerSwipeInput(arReleaseScreenX(0), back.slope * 120, -120, Math.hypot(back.slope * 120, 120) / back.speed)!;
  ok(Math.abs(again.c - ringerAim("fifty", 0).c) <= 1, "swipe: the bots' inverse mapping makes the swipe that makes the aim");
  const v1 = ringerSwipeInput(207, 0, -120, 1, 1)!;
  ok(v1.c === AR_VMAX, "swipe: rev 1's rounds keep their own speed range");
}

/* 5. The parts. */
{
  const ball = (points: number): ArBall => ({ release: 0, points, x: 0, y: 0 });
  const st = (pts: number[]) => ({ ...arInitV2(1), acted: 1, ended: 1, balls: pts.map(ball) });
  const parts = (pts: number[]) => Object.fromEntries(alleyRollStdParts(st(pts))!.map((p) => [p.key, p.points]));
  const p = parts([150, 150, 150, 100, 100, 50, 50, 50, 50]);
  ok(p.core === 140 && p.gold === 30 && p.streak === 20 && p.pockets === 10, "parts: a perfect board is 140 + 30 + 20 + 10");
  ok(alleyRollStdParts(st([]))!.reduce((t, q) => t + q.max, 0) === 200, "parts: the maximums total 200");
  ok(parts([30, 30]).streak === 4 && parts([20, 30]).streak === 0 && parts([30, 20, 30]).streak === 0, "parts: the streak counts a 30 or more straight after another");
  ok(parts([150]).core === Math.floor((140 * 150) / AR2_CORE_FULL) && parts([100]).core === Math.floor((140 * 100) / AR2_CORE_FULL), "parts: a gold cup's 150 and a pocket's 100 count in the core too");
  ok(ringerGame.score(arInitV2(3)) === 0 && ringerGame.score(st([0])) === 1, "parts: no input 0, a played run at least 1");
}

/* 6. The run and the replay. */
{
  let s = { ...arInitV2(2), acted: 1 };
  s = ringerGame.step(s, { t: 1, k: AR_INPUT_ROLL, a: 0, b: 0, c: 3000, d: 0 });
  const before = s.rejects;
  s = ringerGame.step(s, { t: 2, k: AR_INPUT_ROLL, a: 0, b: 0, c: 3000, d: 0 });
  ok(s.rejects === before + 1 && s.balls.length === 1, "run: a roll while a ball is moving is refused");
  const o = ringerOracleRun(1).result;
  ok(o.finished && o.balls === AR_BALLS && o.state.ended === 1, "run: nine balls end it (a finish)");
  let idle = arInitV2(3);
  while (!ringerGame.isOver(idle)) idle = ringerGame.step(idle, null);
  ok(idle.ended === 2 && idle.tick === AR_RUN_TICKS, "run: 60 s ends it");
  let seed = 4242;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) >>> 8) / 16777216;
  const events: ArcadeInputEvent[] = [];
  let g = ringerGame.init(77);
  const cps = [];
  while (!ringerGame.isOver(g)) {
    const t = g.tick + 1;
    if (rnd() < 0.05) recordInput(events, { t, k: AR_INPUT_ROLL, a: Math.floor(rnd() * 240) - 120, b: Math.floor(rnd() * 2400) - 1200, c: 2000 + Math.floor(rnd() * 1800), d: 0 }, ringerGame.inputRanges);
    g = ringerGame.step(g, inputAt(events, t));
    if (g.tick % AR_CHECKPOINT_INTERVAL === 0) cps.push(arCheckpoint(g));
  }
  const raw = encodeAlleyRollRun({ seed: 77, claimedScore: ringerGame.score(g), events, endTick: g.tick, checkpoints: cps });
  const r1 = replayAlleyRollRun(77, raw, 2);
  const r2 = replayAlleyRollRun(77, raw, 2);
  ok(r1.score === ringerGame.score(g) && JSON.stringify(r1.state) === JSON.stringify(r2.state) && !r1.flagged, "replay: deterministic, and the server agrees with the sim");
  ok(replayAlleyRollRun(77, encodeAlleyRollRun({ seed: 77, claimedScore: 200, events, endTick: g.tick, checkpoints: cps }), 2).score === r1.score, "replay: a tampered claimed score changes nothing");
  const v1 = alleyRollOracleRun(1);
  ok(replayAlleyRollRun(1, v1.raw, 1).score === 200 && replayAlleyRollRun(1, v1.raw).score === 200 && alleyRollGameFor(1) === alleyRollGame, "replay: rev 1's runs replay on rev 1's game (unstamped too)");
  ok(alleyRollGameFor(2) === ringerGame && alleyRollGameFor(3) === ringerGame, "replay: rev 2 is Ringer's game");
}

/* 7. The oracle on every tuning and fresh seed. */
{
  const seeds = [...Array.from({ length: 60 }, (_, i) => i), ...Array.from({ length: 200 }, (_, i) => 10000 + i)];
  const bad = seeds.filter((seed) => {
    const r = ringerOracleRun(seed).result;
    return r.score !== 200 || r.flagged;
  });
  ok(bad.length === 0, `oracle: 200 through the server replay on all ${seeds.length} tuning and fresh seeds${bad.length ? ` (not on ${bad.slice(0, 5).join(", ")})` : ""}`);
  for (const t of ["fifty", "left", "right"] as const) {
    const aim = ringerAim(t, RINGER_RELEASE[t]);
    ok(arSimulateBallV2(aim.a, aim.b, aim.c, 9, 30).points === (t === "fifty" ? 50 : 100), `oracle: its ${t} aim lands in its target`);
  }
}

/* 8. The bands. */
{
  const medians: number[] = [];
  for (const level of ALL_LEVELS) {
    const scores: number[] = [];
    for (let n = 0; n < 16; n++) {
      const seed = 2000 + n * 31;
      const ev = bot({ game: ringerGame, seed, rev: 2, human: new Human("alleyroll", seed, level), fixes: true }).events ?? [];
      scores.push(replayAlleyRollRun(seed, encodeAlleyRollRun({ seed, claimedScore: 0, events: ev, endTick: 0, checkpoints: [] }), 2).score);
    }
    if (level === "perfect") ok(scores.every((x) => x === 200), "bands: flawless play scores 200 on every seed");
    else ok(scores.every((x) => x >= 1), `bands: every ${level} run scores at least 1`);
    medians.push([...scores].sort((a, b) => a - b)[8]!);
  }
  ok(medians.every((m, i) => i === 0 || m > medians[i - 1]! || (i === 6 && m >= medians[i - 1]!)), `bands: medians rise weak → flawless (${medians.join(" / ")})`);
  ok(medians[0]! <= 75 && medians[1]! >= 70 && medians[1]! <= 110 && medians[2]! >= 105 && medians[4]! >= 160 && medians[4]! < 200, `bands: weak low, average about 90, good past 105, near-perfect 160–199 (${medians.join(" / ")})`);
}

/* 9. Rooms, the name and the words. */
{
  const dealt = generateAlleyRoll();
  ok(dealt.alleyRollRev === ALLEYROLL_REV_RINGER && ALLEYROLL_REV_DEALT === 2 && dealt.seed > 0, "rooms deal alleyRollRev 2 (Ringer)");
  ok(LIVE_BANDS.alleyroll.rev === 2 && LIVE_BANDS.alleyroll.std?.rev === 2, "LIVE_BANDS carries Ringer's stamp and spec");
  ok(gameDisplayName("alleyroll") === "Ringer", "the game is shown as Ringer (id alleyroll)");
  const help = PUZZLE_INSTRUCTIONS.alleyroll!;
  const how = JSON.stringify(help.how);
  ok(/Swipe up/.test(how) && /gold cup/i.test(how) && /100/.test(how) && !/Slide the ball/.test(how), "help: the swipe, the gold cup and the pockets are named; no slide step");
  ok(/Gold cup/.test(help.score) && /Roll streak/.test(help.score) && /Pocket hits/.test(help.score) && /200/.test(help.score), `help: the four parts and 200: ${help.score}`);
  const intro = INTRO_SCORE.alleyroll ?? "";
  ok(intro.replace("{max}", "200").length <= 90 && /gold cup/.test(intro), `intro: the score line names the gold cup within 90 characters (${intro})`);
  ok(!/skee/i.test(JSON.stringify(help) + intro), "help: no borrowed names");
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL ringer-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS ringer-check: ${checks} checks`);
