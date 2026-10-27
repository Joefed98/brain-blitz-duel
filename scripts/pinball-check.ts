/**
 * Pinball (practice only until PINBALL_IN_ROOMS) — rules, swept physics and replay.
 *
 *  1. Stored rounds keep their scores: real pinRev 1 runs (simulated players at
 *     every skill level, scripts/fixtures/pinball-rev1.json) replay through the
 *     server path to the stored score and final checkpoint, unflagged.
 *  2. Long replays match: full 60 s runs (a near-perfect player keeping the ball
 *     up the whole minute, and dense random flipping) replay on the server to the
 *     identical final state, score and every checkpoint; a run continued from a
 *     JSON copy of a mid-run state ends identically; every state field stays an
 *     integer.
 *  3. Swept contacts: one sweep call finds the contact of a move far longer than
 *     the thing it hits (bumper, thin drop target, flipper, even with the flipper
 *     turning during the move), at the right time; and in thousands of fast
 *     shots at bumpers, targets and swinging flippers the ball never ends a tick
 *     inside a collider or on the far side of one it could not have gone round.
 *  4. The table rules: auto-launch, three balls, drains end the run, the clock,
 *     a drain's lost bonuses, lane change, the bank and its reset, bumper points,
 *     the band curve (open, to 150), 0 with no input, 150 reachable through the
 *     server replay.
 *  5. The one switch: rooms deal it only when PINBALL_IN_ROOMS is on; practice
 *     always lists it (under New while it is practice only); the room
 *     generator stamps pinRev 1.
 *  6. Art matches collision: the drawn flipper tip sits within 2 px of the sim's.
 *  7. Multi-touch: two fingers (one on each half) raise both flippers; lifting
 *     one drops only its own flipper, through the phone's tracker, the recorded
 *     log and the server replay.
 *
 *   bun scripts/pinball-check.ts            # check
 *   bun scripts/pinball-check.ts --record   # rewrite scripts/fixtures/pinball-rev1.json (only when pinRev 1 is new)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";

import { inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  pinballGameFor,
  pinCheckpoint,
  pinFlipAngle,
  pinFlipTip,
  pinSweep,
  PINBALL_IN_ROOMS,
  PIN_BALLS,
  PIN_BAND_CURVE,
  PIN_BANK_RESET,
  PIN_BUMPERS,
  PIN_BUMPER_R,
  PIN_FIRST_LAUNCH,
  PIN_FLIP_LEN,
  PIN_FLIP_PIVOTS,
  PIN_FLIP_REST,
  PIN_FLIP_UP,
  PIN_GATE,
  PIN_INPUT_FLIPPERS,
  PIN_LANE_INNER,
  PIN_LEFT_WALL,
  PIN_PTS_BUMPER,
  PIN_REV,
  PIN_REV_TARGET,
  PIN_RUN_TICKS,
  PIN_SEGS,
  PIN_SLING,
  PIN_SPIN_LIT_TICKS,
  PIN_TARGET,
  PIN_TARGET_XS,
  PIN_TARGET_Y,
  PIN_WALL_R,
  type PinState,
} from "../src/lib/arcade/pinball";
import { bandPoints, bandTop } from "../src/lib/arcade/scoreBands";
import { pinHeldTracker, pinSideOf } from "../src/lib/arcade/pinballInput";
import { encodePinballRun, replayPinballRun } from "../src/lib/duel/pinball";
import { ACTIVE_ARCADE_GAMES, RETIRED_ARCADE_GAMES } from "../src/lib/arcade/arcadeFxGames.renderer";
import { allTypesInCategory, isRetired, PREVIEW_PUZZLE_TYPES, typesInCategory } from "../src/lib/duel/registry";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { bot } from "./arcade-skill-bands/bots/pinball";
import { Human, LEVELS, type SkillLevel } from "./arcade-skill-bands/human";
import { roomSeed } from "./arcade-skill-bands/games";

const failures: string[] = [];
let checks = 0;
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};

const game = pinballGameFor(PIN_REV);
const FP = 256;
const FIXTURE = new URL("./fixtures/pinball-rev1.json", import.meta.url);
const RECORD = process.argv.includes("--record");

/** Plays an input picker through the sim exactly as the phone records it; returns the encoded run. */
function play(seed: number, pick: (s: PinState, t: number) => number | null): { state: PinState; raw: string; events: ArcadeInputEvent[]; states: PinState[] } {
  let s = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: any[] = [];
  const states: PinState[] = [s];
  while (!game.isOver(s)) {
    const t = s.tick + 1;
    const mask = pick(s, t);
    if (mask !== null) recordInput(events, { t, k: PIN_INPUT_FLIPPERS, a: mask, b: 0, c: 0, d: 0 }, game.inputRanges);
    s = game.step(s, inputAt(events, t));
    states.push(s);
    if (s.tick % 300 === 0) checkpoints.push(pinCheckpoint(s));
  }
  const raw = encodePinballRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
  return { state: s, raw, events, states };
}

function botRun(seed: number, level: SkillLevel) {
  const out = bot({ game, seed, rev: PIN_REV, human: new Human("pinball", seed, level) });
  const byTick = new Map((out.events ?? []).map((e) => [e.t, e]));
  return play(seed, (_s, t) => byTick.get(t)?.a ?? null);
}

/* ------------------------------------------------------------------ 1 */
{
  if (RECORD) {
    const runs = LEVELS.flatMap((level) => [0, 1].map((n) => {
      const seed = roomSeed(100 + n);
      const r = botRun(seed, level);
      return { level, seed, score: game.score(r.state), points: r.state.points, checksum: pinCheckpoint(r.state).checksum, raw: gzipSync(r.raw).toString("base64") };
    }));
    writeFileSync(FIXTURE, JSON.stringify({ note: "pinRev 1 runs recorded when the revision was new (scripts/pinball-check.ts --record); they must replay to these scores for ever", runs }, null, 1) + "\n");
    console.log(`recorded ${runs.length} pinRev 1 runs`);
  }
  const fixture = JSON.parse(readFileSync(FIXTURE, "utf8")) as { runs: { level: string; seed: number; score: number; points: number; checksum: number; raw: string }[] };
  ok(fixture.runs.length >= 8, "fixture holds runs at every level");
  for (const run of fixture.runs) {
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const r = replayPinballRun(run.seed, raw, PIN_REV);
    ok(r.score === run.score && r.state.points === run.points && pinCheckpoint(r.state).checksum === run.checksum && !r.flagged, `stored ${run.level} run (seed ${run.seed}): ${run.score}/${run.points} replays as ${r.score}/${r.state.points}${r.flagged ? " (flagged)" : ""}`);
    // An unstamped copy plays the same rules (there is only one revision).
    ok(replayPinballRun(run.seed, raw, undefined).score === run.score, `stored ${run.level} run: unstamped replay differs`);
  }
}

/* ------------------------------------------------------------------ 2 */
const sameState = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
let longest = 0;
let replayMs = 0;
{
  // A near-perfect player keeping the ball up the whole minute.
  let found = false;
  for (let n = 0; n < 12 && !found; n++) {
    const seed = roomSeed(n);
    const r = botRun(seed, "near");
    if (r.state.lost > 0 || r.state.tick < PIN_RUN_TICKS) continue;
    found = true;
    const t0 = performance.now();
    const back = replayPinballRun(seed, r.raw, PIN_REV);
    replayMs = performance.now() - t0;
    longest = r.states.length - 1;
    ok(sameState(back.state, r.state), "near-perfect full minute: server final state differs");
    ok(back.score === game.score(r.state) && !back.flagged && back.desyncTick === null, `near-perfect full minute: score ${back.score}, flagged ${back.flagged}, desync ${back.desyncTick}`);
    ok(back.checkpoints.length === PIN_RUN_TICKS / 300, `near-perfect full minute: ${back.checkpoints.length} checkpoints`);
    // Continue from a JSON copy of the state at 30 s: no hidden state.
    const mid = r.states[1800]!;
    let copy = JSON.parse(JSON.stringify(mid)) as PinState;
    const byTick = new Map(r.events.map((e) => [e.t, e]));
    while (!game.isOver(copy)) copy = game.step(copy, byTick.get(copy.tick + 1) ?? null);
    ok(sameState(copy, r.state), "a run continued from a JSON copy at 30 s differs");
  }
  ok(found, "no near-perfect simulated run kept the ball up for the whole minute in 12 seeds");

  // Dense random flipping, both flippers, many runs.
  let rng = 7;
  const rand = (n: number) => ((rng = (Math.imul(rng, 1103515245) + 12345) >>> 0) % n);
  for (let run = 0; run < 30; run++) {
    const seed = 1 + run * 7919;
    const r = play(seed, () => (rand(100) < 12 ? rand(4) : null));
    const back = replayPinballRun(seed, r.raw, PIN_REV);
    ok(sameState(back.state, r.state) && back.score === game.score(r.state) && !back.flagged, `random run ${run}: server replay differs`);
    for (const s of r.states)
      for (const [key, value] of Object.entries(s)) {
        const vals = Array.isArray(value) ? value : [value];
        if (!vals.every((v) => Number.isInteger(v))) {
          ok(false, `random run ${run}: ${key} is not an integer at tick ${s.tick}`);
          break;
        }
      }
  }
}

/* ------------------------------------------------------------------ 3 */
{
  const T = pinSweep.T_ONE;
  // A bumper: a move of 120 px straight through its centre finds the contact at the near edge.
  const [bx, by] = PIN_BUMPERS[0]!;
  const rr = pinSweep.bumperRR;
  const t = pinSweep.circle((bx - 60) * FP, by * FP, (bx + 60) * FP, by * FP, bx * FP, by * FP, rr);
  ok(t >= 0 && Math.abs((bx - 60) * FP + Math.trunc((120 * FP * t) / T) - (bx * FP - rr)) <= FP, `bumper: one 120 px sweep finds the edge (t ${t})`);
  // A drop target (8 px thick): a 60 px move straight up through it.
  const target = PIN_SEGS.find((s) => s.kind === PIN_TARGET)!;
  const tx = (target.a[0] + target.b[0]) / 2;
  const trr = pinSweep.ballR + target.r * FP;
  const hit = pinSweep.capsule(tx * FP, (PIN_TARGET_Y + 30) * FP, tx * FP, (PIN_TARGET_Y - 30) * FP, target.a[0] * FP, target.a[1] * FP, (target.b[0] - target.a[0]) * FP, 0, (target.b[0] - target.a[0]) * FP, ((target.b[0] - target.a[0]) * FP) ** 2, trr);
  ok(!!hit && Math.abs(hit.y - (PIN_TARGET_Y * FP + trr)) <= FP && hit.ny < 0 === false && hit.ny > 0, `drop target: one 60 px sweep stops below it (${hit ? hit.y / FP : "none"})`);
  // A resting flipper: a ball moving 80 px straight down onto the middle of the left flipper.
  const [px0, py0] = PIN_FLIP_PIVOTS[0]!;
  const a = pinFlipAngle(0, PIN_FLIP_REST);
  const mid = { x: px0 + (PIN_FLIP_LEN / 2) * Math.cos((a / 65536) * 2 * Math.PI), y: py0 + (PIN_FLIP_LEN / 2) * Math.sin((a / 65536) * 2 * Math.PI) };
  const f = pinSweep.flipper(0, Math.round(mid.x * FP), Math.round((mid.y - 60) * FP), Math.round(mid.x * FP), Math.round((mid.y + 20) * FP), a, a);
  ok(!!f && f.y < mid.y * FP && f.ny < 0, `flipper at rest: one 80 px sweep lands on top (${f ? (f.y / FP).toFixed(1) : "none"})`);
  // A swinging flipper: the ball still, the flipper turning from rest to raised in one move: it meets the ball.
  const still = { x: Math.round((px0 + 40) * FP), y: Math.round((py0 + 4) * FP) };
  const sw = pinSweep.flipper(0, still.x, still.y, still.x, still.y, pinFlipAngle(0, PIN_FLIP_REST), pinFlipAngle(0, PIN_FLIP_UP));
  ok(!!sw && sw.t > 0 && sw.t < T && sw.ny < 0, `swinging flipper: one sweep over the whole swing meets a still ball (t ${sw?.t})`);
  // And misses a ball well clear of its arc.
  ok(pinSweep.flipper(0, (px0 + 40) * FP, (py0 - 80) * FP, (px0 + 40) * FP, (py0 - 80) * FP, pinFlipAngle(0, PIN_FLIP_REST), pinFlipAngle(0, PIN_FLIP_UP)) === null, "swinging flipper: no contact far above its arc");

  // Thousands of fast shots: never inside a collider, never through a flipper or a wall.
  let rng = 99;
  const rand = (n: number) => ((rng = (Math.imul(rng, 1103515245) + 12345) >>> 0) % n);
  const inside: string[] = [];
  const through: string[] = [];
  const segDist2 = (x: number, y: number, ax: number, ay: number, bx2: number, by2: number) => {
    const sx = bx2 - ax, sy = by2 - ay;
    const len2 = sx * sx + sy * sy;
    let u = len2 > 0 ? ((x - ax) * sx + (y - ay) * sy) / len2 : 0;
    u = Math.max(0, Math.min(1, u));
    const qx = ax + sx * u, qy = ay + sy * u;
    return (x - qx) ** 2 + (y - qy) ** 2;
  };
  const flipLocal = (side: number, lift: number, x: number, y: number) => {
    const [fx, fy] = PIN_FLIP_PIVOTS[side]!;
    const ang = (pinFlipAngle(side, lift) / 65536) * 2 * Math.PI;
    const dx = x - fx, dy = y - fy;
    return { lx: dx * Math.cos(ang) + dy * Math.sin(ang), ly: -dx * Math.sin(ang) + dy * Math.cos(ang) };
  };
  const audit = (prev: PinState, s: PinState, label: string) => {
    if (!s.live || !prev.live) return;
    const x = s.x / FP, y = s.y / FP;
    const R = pinSweep.ballR / FP;
    for (const seg of PIN_SEGS) {
      if (seg.kind === PIN_TARGET && ((s.targets >> (seg.id ?? 0)) & 1) === 1) continue;
      if (seg.kind === PIN_GATE && y >= seg.a[1]) continue;
      const need = R + seg.r - 1;
      if (segDist2(x, y, seg.a[0], seg.a[1], seg.b[0], seg.b[1]) < need * need) inside.push(`${label}: inside a wall at (${x.toFixed(1)}, ${y.toFixed(1)}) tick ${s.tick}`);
    }
    for (const [cx, cy] of PIN_BUMPERS) {
      const need = R + PIN_BUMPER_R - 1;
      if ((x - cx) ** 2 + (y - cy) ** 2 < need * need) inside.push(`${label}: inside a bumper tick ${s.tick}`);
    }
    for (let side = 0; side < 2; side++) {
      const now = flipLocal(side, s.flips[side]!, x, y);
      const before = flipLocal(side, prev.flips[side]!, prev.x / FP, prev.y / FP);
      const need = R + pinSweep.flipRR / FP - R - 1 + R;
      const lx = Math.max(0, Math.min(PIN_FLIP_LEN, now.lx));
      if ((now.lx - lx) ** 2 + now.ly ** 2 < (need - 0) ** 2 && (now.lx - lx) ** 2 + now.ly ** 2 < (pinSweep.flipRR / FP - 1) ** 2) inside.push(`${label}: inside flipper ${side} tick ${s.tick}`);
      // Crossing the flipper's line within its length, from one side to the other, in one tick.
      const span = (p: { lx: number }) => p.lx > 2 && p.lx < PIN_FLIP_LEN - 2;
      if (span(now) && span(before) && Math.sign(now.ly) !== Math.sign(before.ly) && Math.abs(now.ly) > 2 && Math.abs(before.ly) > 2) through.push(`${label}: through flipper ${side} tick ${s.tick}`);
    }
    // Walls (not the one-way gate, which a launch crosses upwards): no side change within a segment's span.
    for (const seg of PIN_SEGS) {
      if (seg.kind === PIN_GATE) continue;
      if (seg.kind === PIN_TARGET && (((s.targets | prev.targets) >> (seg.id ?? 0)) & 1) === 1) continue;
      const sx = seg.b[0] - seg.a[0], sy = seg.b[1] - seg.a[1];
      const len2 = sx * sx + sy * sy;
      const side = (px: number, py: number) => sx * (py - seg.a[1]) - sy * (px - seg.a[0]);
      const along = (px: number, py: number) => ((px - seg.a[0]) * sx + (py - seg.a[1]) * sy) / len2;
      const a0 = along(prev.x / FP, prev.y / FP), a1 = along(x, y);
      if (a0 <= 0.02 || a0 >= 0.98 || a1 <= 0.02 || a1 >= 0.98) continue;
      if (Math.sign(side(prev.x / FP, prev.y / FP)) !== Math.sign(side(x, y))) through.push(`${label}: through a wall at (${x.toFixed(1)}, ${y.toFixed(1)}) tick ${s.tick}`);
    }
    if (x < PIN_LEFT_WALL + PIN_WALL_R + R - 1 || x > PIN_LANE_INNER + 40 || y < 30) inside.push(`${label}: off the table at (${x.toFixed(1)}, ${y.toFixed(1)})`);
  };
  // A start point for a synthetic shot: on the playfield, clear of every collider and outside the slingshots' solid triangles.
  const inTriangle = (x: number, y: number, t: readonly (readonly [number, number])[]) => {
    const sign = (p: readonly [number, number], q: readonly [number, number]) => (x - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (y - q[1]);
    const d1 = sign(t[0]!, t[1]!), d2 = sign(t[1]!, t[2]!), d3 = sign(t[2]!, t[0]!);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };
  const slingTriangles = PIN_SEGS.filter((sg) => sg.kind === PIN_SLING).map((face) => {
    const corner = PIN_SEGS.find((sg) => sg.kind !== PIN_SLING && sg.a[0] === face.a[0] && sg.a[1] === face.a[1] && sg.b[0] === face.a[0])!;
    return [face.a, corner.b, face.b] as const;
  });
  const freeSpot = (x: number, y: number) => {
    const R = pinSweep.ballR / FP;
    if (x < PIN_LEFT_WALL + 15 || x > PIN_LANE_INNER - 15 || y < 140 || y > 600) return false;
    if (slingTriangles.some((t) => inTriangle(x, y, t))) return false;
    if (x < 52 && y < 525) return false; // the left orbit lane: shots start on the main playfield
    for (const seg of PIN_SEGS) if (segDist2(x, y, seg.a[0], seg.a[1], seg.b[0], seg.b[1]) < (R + seg.r + 2) ** 2) return false;
    for (const [cx, cy] of PIN_BUMPERS) if ((x - cx) ** 2 + (y - cy) ** 2 < (R + PIN_BUMPER_R + 2) ** 2) return false;
    for (let side = 0; side < 2; side++) {
      const p = flipLocal(side, PIN_FLIP_REST, x, y);
      const lx = Math.max(0, Math.min(PIN_FLIP_LEN, p.lx));
      if ((p.lx - lx) ** 2 + p.ly ** 2 < (pinSweep.flipRR / FP + 2) ** 2) return false;
    }
    return true;
  };
  // Fast shots from random places in the lower playfield: at bumpers, targets and the flippers, flippers swinging.
  const base = game.step(game.init(1), null);
  let shots = 0;
  for (let n = 0; n < 2500; n++) {
    const kind = n % 3;
    let x: number, y: number, vx: number, vy: number;
    const speed = 10 + rand(9);
    if (kind === 0) {
      // At a bumper from anywhere around it.
      const [cx, cy] = PIN_BUMPERS[rand(PIN_BUMPERS.length)]!;
      const ang = (rand(360) * Math.PI) / 180;
      x = cx + Math.cos(ang) * 60;
      y = cy + Math.sin(ang) * 60;
      vx = (cx - x) / 60 * speed;
      vy = (cy - y) / 60 * speed;
    } else if (kind === 1) {
      // Up at the drop targets.
      x = PIN_TARGET_XS[rand(4)]! + rand(21) - 10;
      y = PIN_TARGET_Y + 40 + rand(60);
      vx = rand(7) - 3;
      vy = -speed;
    } else {
      // Down onto a flipper, which swings at a random moment.
      const side = rand(2);
      const [fx, fy] = PIN_FLIP_PIVOTS[side]!;
      x = fx + (side === 0 ? 1 : -1) * (10 + rand(46));
      y = fy - 60 - rand(60);
      vx = rand(5) - 2;
      vy = speed;
    }
    if (!freeSpot(x, y)) continue;
    let s: PinState = { ...base, x: Math.round(x * FP), y: Math.round(y * FP), vx: Math.round(vx * FP), vy: Math.round(vy * FP), live: 1, wait: 0, acted: 1 };
    const pressAt = s.tick + 1 + rand(14);
    const mask = rand(3) + 1;
    for (let k = 0; k < 40 && s.live && !game.isOver(s); k++) {
      const t = s.tick + 1;
      const ev = t === pressAt ? { t, k: PIN_INPUT_FLIPPERS, a: mask, b: 0, c: 0, d: 0 } : null;
      const prev = s;
      s = game.step(s, ev);
      audit(prev, s, `shot ${n} from (${x.toFixed(0)}, ${y.toFixed(0)}) v(${vx.toFixed(1)}, ${vy.toFixed(1)}) press +${pressAt - base.tick} mask ${mask} k${k}`);
    }
    shots++;
  }
  // And whole runs: random flipping and simulated players.
  for (let run = 0; run < 12; run++) {
    const r = run < 8 ? play(run + 1, () => (rand(100) < 10 ? rand(4) : null)) : botRun(roomSeed(run), LEVELS[run % 4]!);
    for (let i = 1; i < r.states.length; i++) audit(r.states[i - 1]!, r.states[i]!, `run ${run}`);
  }
  if (inside.length) console.log(inside.slice(0, 8).join("\n"));
  if (through.length) console.log(through.slice(0, 8).join("\n"));
  ok(inside.length === 0, `the ball ended a tick inside a collider ${inside.length} times, e.g. ${inside[0]}`);
  ok(through.length === 0, `the ball passed through a flipper or wall ${through.length} times, e.g. ${through[0]}`);
  ok(shots > 2000, `only ${shots} fast shots tested`);
}

/* ------------------------------------------------------------------ 4 */
{
  const idle = play(1, () => null);
  ok(idle.state.launched === PIN_BALLS && idle.state.lost === PIN_BALLS && idle.state.endedTick > 0 && idle.state.endedTick < PIN_RUN_TICKS, `idle: three balls launch and drain, ending early (tick ${idle.state.endedTick})`);
  ok(game.score(idle.state) === 0 && idle.state.points > 0, `idle: table points ${idle.state.points} but score ${game.score(idle.state)} (no input scores 0)`);
  // (An empty log carries no checkpoints, so the server logs a desync: expected here, kept quiet.)
  const error = console.error;
  console.error = () => {};
  const empty = replayPinballRun(1, encodePinballRun({ seed: 1, claimedScore: 0, events: [], endTick: 0, checkpoints: [] }), PIN_REV);
  console.error = error;
  ok(empty.score === 0, "the server scores an empty log 0");
  const first = idle.states.find((s) => s.live === 1)!;
  ok(first.tick === PIN_FIRST_LAUNCH && first.vy < 0, `the first ball launches by itself at tick ${first.tick}`);
  // Launches are the same for everyone: two seeds, the same table, the same idle run.
  ok(sameState({ ...play(2, () => null).state }, idle.state), "the table differs between seeds");

  // A drain loses the multiplier, lit lanes, dropped targets and the lit spinner.
  let s: PinState = { ...game.init(1), live: 1, wait: 0, x: 181 * FP, y: 707 * FP, vx: 0, vy: 1024, mult: 3, lanes: 5, targets: 6, spinLit: 9999 };
  s = game.step(s, null);
  ok(s.lost === 1 && s.live === 0 && s.mult === 1 && s.lanes === 0 && s.targets === 0 && s.spinLit === 0, "a drain resets the multiplier, lanes, targets and spinner");
  // Lane change: a fresh left press shifts the lit lanes left, a right press right.
  const lanes = (start: number, mask: number) => game.step({ ...game.init(1), lanes: start }, { t: 1, k: PIN_INPUT_FLIPPERS, a: mask, b: 0, c: 0, d: 0 }).lanes;
  ok(lanes(0b001, 1) === 0b100 && lanes(0b100, 2) === 0b001 && lanes(0b011, 2) === 0b110 && lanes(0b010, 3) === 0b010, "lane change rotates the lit lanes");
  // A bumper strike scores PIN_PTS_BUMPER × the multiplier, once per strike.
  const [bx, by] = PIN_BUMPERS[2]!;
  let b: PinState = { ...game.init(1), live: 1, wait: 0, x: bx * FP, y: (by + PIN_BUMPER_R + 30) * FP, vx: 0, vy: -6 * FP, mult: 2, tick: 600 };
  let gained = -1;
  for (let k = 0; k < 20 && gained < 0; k++) {
    const before = b;
    b = game.step(b, null);
    if (b.bumps > before.bumps) gained = b.points - before.points;
  }
  ok(b.bumps === 1 && gained === PIN_PTS_BUMPER * 2 && b.bumperAt[2] === b.tick && b.vy > 0, `a bumper strike: ${b.bumps} hits, +${gained} points, kicked back down`);
  // The bank: four targets down score a bonus and pop back up PIN_BANK_RESET later.
  let k: PinState = { ...game.init(1), live: 1, wait: 0, targets: 0b0111, x: PIN_TARGET_XS[3]! * FP, y: (PIN_TARGET_Y + 30) * FP, vx: 0, vy: -8 * FP, tick: 300 };
  let doneAt = -1;
  for (let i = 0; i < 10 && doneAt < 0; i++) {
    k = game.step(k, null);
    if (k.banks > 0) doneAt = k.tick;
  }
  ok(k.targets === 15 && k.banks === 1 && k.bankUp === doneAt + PIN_BANK_RESET && k.spinLit === doneAt + PIN_SPIN_LIT_TICKS, `the last target completes the bank (targets ${k.targets}, banks ${k.banks}, up at ${k.bankUp})`);
  const upAt = k.bankUp;
  while (k.tick < upAt && !game.isOver(k)) k = game.step({ ...k, live: 0, wait: 9999 }, null);
  ok(k.targets === 0 && k.tick === upAt, "the bank is back up after PIN_BANK_RESET");
  // The clock: a run with the ball kept alive ends at 60 s.
  ok(PIN_RUN_TICKS === 3600, "a 60 s run");

  // The band curve: open, to 150, never falling.
  const top = bandTop(PIN_BAND_CURVE);
  ok(bandPoints(PIN_BAND_CURVE, top) === 150 && bandPoints(PIN_BAND_CURVE, 0) === 0, "the curve runs from 0 to 150");
  let prev = 0;
  for (let u = 0; u <= top + 1000; u += 50) {
    const p = bandPoints(PIN_BAND_CURVE, u);
    ok(p >= prev, `the curve falls at ${u}`);
    prev = p;
  }
}

/* ------------------------------------------------------------------ 5 */
{
  // The one switch: off, rooms never deal Pinball and practice lists it on its own; on, it is an active arcade game.
  ok(isRetired("pinball") === !PINBALL_IN_ROOMS, `the registry ${PINBALL_IN_ROOMS ? "deals" : "keeps practice only"} Pinball`);
  ok(typesInCategory("arcade").includes("pinball") === PINBALL_IN_ROOMS && allTypesInCategory("arcade").includes("pinball"), "rooms deal Pinball only when switched on; practice always lists it");
  ok(PREVIEW_PUZZLE_TYPES.includes("pinball") === !PINBALL_IN_ROOMS, "practice lists Pinball under New while it is practice only");
  ok(RETIRED_ARCADE_GAMES.includes("pinball") === !PINBALL_IN_ROOMS && ACTIVE_ARCADE_GAMES.includes("pinball") === PINBALL_IN_ROOMS && ACTIVE_ARCADE_GAMES.length === 20 + (PINBALL_IN_ROOMS ? 1 : 0), "the active arcade list follows the switch");
  const puzzle = generatePuzzle("pinball") as any;
  // pinRev 4 (E4, 25 Oct 2026): the taller table's expansion follows the score-bands pinRev 3 (e4-expansion-check).
  ok(puzzle.type === "pinball" && puzzle.pinRev === PIN_REV_TARGET + 2 && Number.isInteger(puzzle.seed), "the generator stamps pinRev 4 (the expansion, after pinRev 1 play on the scoring targets pinRev 2, scoring-targets-check, and on the score bands pinRev 3, scoring-bands-check)");
}

/* ------------------------------------------------------------------ 6 */
{
  let worst = 0;
  for (let side = 0; side < 2; side++)
    for (let lift = PIN_FLIP_UP; lift <= PIN_FLIP_REST; lift += 97) {
      const sim = pinFlipTip(side, lift);
      const [px0, py0] = PIN_FLIP_PIVOTS[side]!;
      const a = (pinFlipAngle(side, lift) / 65536) * Math.PI * 2;
      const art = { x: px0 + Math.cos(a) * PIN_FLIP_LEN, y: py0 + Math.sin(a) * PIN_FLIP_LEN };
      worst = Math.max(worst, Math.hypot(art.x - sim.x, art.y - sim.y));
    }
  ok(worst <= 2, `drawn flipper tip ${worst.toFixed(2)} px from the sim's`);
}

/* ------------------------------------------------------------------ 7 */
{
  // The halves: left of the arena's middle drives the left flipper, the rest the right.
  const box = { left: 10, width: 390 };
  ok(pinSideOf(box, 10) === 0 && pinSideOf(box, 204) === 0 && pinSideOf(box, 205) === 1 && pinSideOf(box, 399) === 1, "thumb zones: left half → left flipper, right half → right flipper");

  // Drive the phone's tracker tick by tick, record the log the way the Stage does, and step the sim.
  const thumbs = pinHeldTracker();
  const events: ArcadeInputEvent[] = [];
  let s: PinState = game.init(1);
  let sent = 0;
  const tick = (n = 1) => {
    for (let i = 0; i < n; i++) {
      const t = s.tick + 1;
      const mask = thumbs.takeTick();
      if (mask !== sent && recordInput(events, { t, k: PIN_INPUT_FLIPPERS, a: mask, b: 0, c: 0, d: 0 }, game.inputRanges)) sent = mask;
      s = game.step(s, inputAt(events, t));
    }
  };
  tick(5);
  thumbs.down(101, 0); // left thumb
  thumbs.down(102, 1); // right thumb, both on the glass together
  tick(10);
  ok(s.held === 3 && s.flips[0] === PIN_FLIP_UP && s.flips[1] === PIN_FLIP_UP, `two fingers: both flippers up (held ${s.held}, ${s.flips.join("/")})`);
  thumbs.up(101); // lift the left thumb only
  tick(12);
  ok(s.held === 2 && s.flips[0] === PIN_FLIP_REST && s.flips[1] === PIN_FLIP_UP, `left finger lifted: left drops, right stays up (held ${s.held}, ${s.flips.join("/")})`);
  thumbs.down(103, 1); // a second finger on the right half
  thumbs.up(102); // the first right finger lifts: the second still holds it
  tick(3);
  ok(s.held === 2 && s.flips[1] === PIN_FLIP_UP, "another finger on the same half keeps that flipper up");
  thumbs.down(104, 0);
  thumbs.up(104); // a tap shorter than a tick
  tick(1);
  ok(s.held === 3, "a tap shorter than a tick still raises its flipper for one tick");
  tick(1);
  ok(s.held === 2, "…and drops it on the next");
  thumbs.up(103);
  tick(12);
  ok(s.held === 0 && s.flips[0] === PIN_FLIP_REST && s.flips[1] === PIN_FLIP_REST, "all fingers lifted: both flippers down");
  // The server replays the same log to the same flippers.
  const back = replayPinballRun(1, encodePinballRun({ seed: 1, claimedScore: game.score(s), events, endTick: s.tick, checkpoints: [] }), PIN_REV);
  ok(back.state.held === s.held && back.state.flips.join() === s.flips.join() && back.state.tick === s.tick, "the server replays the two-finger log to the same flippers");
}

/* ------------------------------------------------------------------ 150 */
{
  // 150 is reachable: a near-perfect simulated player scores it through the server replay.
  let best = 0;
  for (let n = 0; n < 30 && best < 150; n++) {
    const seed = roomSeed(n);
    const r = botRun(seed, "near");
    best = Math.max(best, replayPinballRun(seed, r.raw, PIN_REV).score);
  }
  ok(best === 150, `the best near-perfect run in 30 scores ${best}, not 150`);
}

if (failures.length) {
  console.log(failures.slice(0, 30).join("\n"));
  console.log(`FAIL: ${failures.length} of ${checks} pinball checks`);
  process.exit(1);
}
console.log(`Pinball: ${checks} checks passed — stored pinRev 1 runs replay unchanged; a ${longest}-tick near-perfect run replays identically (${replayMs.toFixed(0)} ms); swept contacts and thousands of fast shots never tunnel; table rules, bands, practice-only switch, art bounds and two-finger flippers`);
