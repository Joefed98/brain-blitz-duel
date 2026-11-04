/**
 * Alley Roll (alleyRollRev 1, 1 Nov 2026; docs/arcade-standard/alleyroll.md):
 *
 *  1. the board: a landing point scores its pocket, else the innermost ring round it, else 0; the rings run 50 to 10
 *     from the centre out and the pockets sit in the top corners;
 *  2. the physics: integer only and seed-free (the same roll lands in the same place on every seed), a stronger roll
 *     goes further, the angle is held to 3/10 and the speed to its range, rails bounce a ball back, the back wall
 *     sends it back at half speed;
 *  3. the run: one roll a ball, a roll while a ball is moving is refused, nine balls end it (a finish), 60 s ends it
 *     too, and a ball still in the air at the buzzer scores nothing;
 *  4. a replay is deterministic and the server agrees with the sim; a tampered claimed score changes nothing;
 *  5. the oracle scores 200 on every tuning seed (0–59) and fresh seed (10000–10199) through the server replay; rev 1
 *     keeps its own game (rooms deal Ringer, alleyRollRev 2, since 3 Nov 2026: scripts/ringer-check.ts);
 *  6. no input 0, a run that rolled at least 1; the skill bands rise weak → flawless (12 seeds);
 *  7. the help states the parts' total and the controls (Ringer's help since 3 Nov 2026).
 *
 *   bun scripts/alleyroll-check.ts
 */
import { inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  ALLEYROLL_REV, AR_BALLS, AR_BOARD_D, AR_CHECKPOINT_INTERVAL, AR_FLY, AR_INPUT_ROLL, AR_POCKETS, AR_RINGS, AR_RING_CX, AR_RING_CY, AR_RUN_TICKS, AR_VMAX,
  AR_VMIN, AR_WAIT, alleyRollGame, alleyRollGameFor, arCheckpoint, arInit, arLaunch, arPointsAt, arSimulateBall, arTotals,
} from "../src/lib/arcade/alleyroll";
import { encodeAlleyRollRun, replayAlleyRollRun } from "../src/lib/duel/alleyroll";
import { generateAlleyRoll } from "../src/lib/duel/sports.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { alleyRollOracleRun, arAim } from "./alleyroll-oracle";
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
  ok(arPointsAt(AR_RING_CX, AR_RING_CY) === 50, "board: the centre scores 50");
  ok(AR_RINGS.every((r, i) => arPointsAt(AR_RING_CX, AR_RING_CY + r.r) === r.points && (i === 0 || r.points < AR_RINGS[i - 1]!.points)), "board: each ring's edge scores that ring, 50 down to 10 from the centre out");
  ok(arPointsAt(AR_RING_CX, AR_RING_CY + AR_RINGS.at(-1)!.r + 1) === 0, "board: outside the rings, the gutter (0)");
  ok(AR_POCKETS.every((p) => arPointsAt(p.x, p.y) === 100 && p.y > AR_BOARD_D * 0.8), "board: the two 100 pockets sit in the top corners");
}

/* 2. The physics. */
{
  const a = arSimulateBall(0, 0, 2400);
  const b = arSimulateBall(0, 0, 2600);
  ok(b.y > a.y && a.x === 0 && b.x === 0, "physics: a stronger roll goes further, a straight one stays on the centre line");
  ok(arLaunch(0, 5000, 2000).vx === Math.floor((2000 * 3) / 10) && arLaunch(0, 0, 1).vy === AR_VMIN && arLaunch(0, 0, 99999).vy === AR_VMAX && arLaunch(999, 0, 2000).x < 100, "physics: the angle, speed and release are held to their ranges");
  const left = arSimulateBall(-80, -600, 2600);
  ok(left.x > -130, "physics: a rail bounces the ball back onto the lane");
  const hard = arSimulateBall(0, 0, AR_VMAX);
  ok(hard.y < AR_BOARD_D, "physics: the back wall sends the ball back");
  let s1 = { ...arInit(1), acted: 1 };
  let s2 = { ...arInit(987654), acted: 1 };
  const roll = { t: 1, k: AR_INPUT_ROLL, a: 12, b: 140, c: 2700, d: 0 };
  s1 = alleyRollGame.step(s1, roll);
  s2 = alleyRollGame.step(s2, roll);
  while (s1.phase !== AR_WAIT || s1.balls.length === 0) s1 = alleyRollGame.step(s1, null);
  while (s2.phase !== AR_WAIT || s2.balls.length === 0) s2 = alleyRollGame.step(s2, null);
  ok(JSON.stringify(s1.balls) === JSON.stringify(s2.balls), "physics: the same roll lands in the same place on every seed");
  ok(Number.isInteger(s1.x) && Number.isInteger(s1.y) && s1.balls.every((x) => Number.isInteger(x.x) && Number.isInteger(x.y)), "physics: integers only");
}

/* 3. The run. */
{
  let s = { ...arInit(2), acted: 1 };
  s = alleyRollGame.step(s, { t: 1, k: AR_INPUT_ROLL, a: 0, b: 0, c: 2600, d: 0 });
  const before = s.rejects;
  s = alleyRollGame.step(s, { t: 2, k: AR_INPUT_ROLL, a: 0, b: 0, c: 2600, d: 0 });
  ok(s.rejects === before + 1 && s.balls.length === 1, "run: a roll while a ball is moving is refused");
  const oracle = alleyRollOracleRun(1).result;
  ok(oracle.state.ended === 1 && oracle.balls === AR_BALLS && oracle.finished, "run: nine balls end it (a finish)");
  // Idle to the buzzer, then a ball in the air when it sounds.
  let idle = arInit(3);
  while (!alleyRollGame.isOver(idle)) idle = alleyRollGame.step(idle, null);
  ok(idle.ended === 2 && idle.tick === AR_RUN_TICKS && alleyRollGame.score(idle) === 0, "run: 60 s ends it; no input scores 0");
  let late = { ...arInit(3), acted: 1, tick: AR_RUN_TICKS - 40 };
  late = alleyRollGame.step(late, { t: late.tick + 1, k: AR_INPUT_ROLL, a: 0, b: 0, c: 2600, d: 0 });
  while (!alleyRollGame.isOver(late)) late = alleyRollGame.step(late, null);
  ok(late.ended === 2 && arTotals(late).balls === 0 && alleyRollGame.score(late) === 1, "run: a ball still moving at the buzzer scores nothing (the roll still counts as played: 1)");
  ok(late.phase === AR_FLY || late.phase === 1, "run: that ball was still on its way");
}

/* 4. Replay. */
{
  let seed = 777;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) >>> 8) / 16777216;
  const events: ArcadeInputEvent[] = [];
  let s = alleyRollGame.init(55);
  const checkpoints = [];
  while (!alleyRollGame.isOver(s)) {
    const t = s.tick + 1;
    if (rnd() < 0.05) recordInput(events, { t, k: AR_INPUT_ROLL, a: Math.floor(rnd() * 240) - 120, b: Math.floor(rnd() * 2400) - 1200, c: Math.floor(rnd() * 4000), d: 0 }, alleyRollGame.inputRanges);
    s = alleyRollGame.step(s, inputAt(events, t));
    if (s.tick % AR_CHECKPOINT_INTERVAL === 0) checkpoints.push(arCheckpoint(s));
  }
  const raw = encodeAlleyRollRun({ seed: 55, claimedScore: alleyRollGame.score(s), events, endTick: s.tick, checkpoints });
  const r1 = replayAlleyRollRun(55, raw);
  const r2 = replayAlleyRollRun(55, raw);
  ok(r1.score === alleyRollGame.score(s) && JSON.stringify(r1.state) === JSON.stringify(r2.state) && !r1.flagged, "replay: deterministic and the server agrees with the sim");
  const tampered = encodeAlleyRollRun({ seed: 55, claimedScore: 200, events, endTick: s.tick, checkpoints });
  ok(replayAlleyRollRun(55, tampered).score === r1.score, "replay: a tampered claimed score changes nothing");
}

/* 5. The oracle on every tuning and fresh seed. */
{
  const seeds = [...Array.from({ length: 60 }, (_, i) => i), ...Array.from({ length: 200 }, (_, i) => 10000 + i)];
  const bad = seeds.filter((seed) => {
    const r = alleyRollOracleRun(seed).result;
    return r.score !== 200 || r.flagged;
  });
  ok(bad.length === 0, `oracle: 200 through the server replay on all ${seeds.length} tuning and fresh seeds${bad.length ? ` (not on ${bad.slice(0, 5).join(", ")})` : ""}`);
  for (const t of ["centre", "left", "right"] as const) {
    const aim = arAim(t, t === "centre" ? 0 : t === "left" ? 40 : -40);
    ok(arSimulateBall(aim.a, aim.b, aim.c).points === (t === "centre" ? 50 : 100), `oracle: its ${t} aim lands in its target`);
  }
  // Rooms deal Ringer (alleyRollRev 2) since 3 Nov 2026 (ringer-check proves it); rev 1 keeps its own game and stamp.
  const dealt = generateAlleyRoll();
  ok(ALLEYROLL_REV === 1 && alleyRollGameFor(1) === alleyRollGame && alleyRollGameFor(null) === alleyRollGame && dealt.seed > 0, "rev 1 (stored rounds) keeps alleyRollRev 1's game; rooms still deal any seed");
}

/* 6. The bands. */
{
  const medians: number[] = [];
  for (const level of ALL_LEVELS) {
    const scores: number[] = [];
    for (let n = 0; n < 12; n++) {
      const seed = 1000 + n * 17;
      const ev = bot({ game: alleyRollGame, seed, rev: 1, human: new Human("alleyroll", seed, level) }).events ?? [];
      const raw = encodeAlleyRollRun({ seed, claimedScore: 0, events: ev, endTick: 0, checkpoints: [] });
      scores.push(replayAlleyRollRun(seed, raw).score);
    }
    if (level === "perfect") ok(scores.every((x) => x === 200), "bands: flawless play scores 200 on every seed");
    else ok(scores.every((x) => x >= 1), `bands: every ${level} run scores at least 1`);
    medians.push([...scores].sort((a, b) => a - b)[6]!);
  }
  ok(medians.every((m, i) => i === 0 || m >= medians[i - 1]!) && medians[0]! < medians[3]! && medians[3]! < medians[4]!, `bands: medians rise weak → flawless (${medians.join(" / ")})`);
}

/* 7. The help (Ringer's since 3 Nov 2026: one swipe, no slide step; ringer-check proves its words). */
{
  const help = PUZZLE_INSTRUCTIONS.alleyroll;
  ok(!!help && help.score.includes("Total 200"), `help: the parts total 200: ${help?.score}`);
  const how = JSON.stringify(help?.how ?? []);
  ok(/Swipe up/.test(how) && /100/.test(how), "help: the swipe up and the 100 pockets are named");
  ok(!/skee/i.test(JSON.stringify(help)), "help: no borrowed names");
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL alleyroll-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS alleyroll-check: ${checks} checks`);
