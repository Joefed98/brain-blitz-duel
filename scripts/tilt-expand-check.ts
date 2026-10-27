/**
 * Tilt's expansion, tiltRev 8 (26 Oct 2026, docs/expansions/x200-tilt.md; round maximum 200):
 *
 *  1. Stored rounds keep their play: 32 skill-bot runs recorded on tiltRev 6 before the change
 *     (scripts/fixtures/tilt-expand-legacy.json.gz) replay unflagged to the same score and final state,
 *     and the same logs on every older revision (1–5) give the same score and state as before.
 *  2. tiltRev 8 runs (scripts/fixtures/tilt-expand-runs.json.gz) replay unflagged to their stored score and state.
 *  3. The deal: rooms deal tiltRev 8; on 3,000 seeds the dealer's rule keeps every key and both cups
 *     reachable, and every dealt maze has exactly one key and gate, TILT_X_STARS gold stars and
 *     TILT_X_QUICK quick stars on ice, each a similar detour, the quick stars before the gate, and pars that
 *     fit the run; the mazes are bigger than tiltRev 6's.
 *  4. The arcade rule's ceiling, by play: rooms deal only bank seeds (TILT_BANK), each played to 200 by the
 *     oracle (scripts/tilt-oracle.ts); every stored oracle log replays to 200 through the server, taking every
 *     star and key (every passage entered and left). The measured seeds (tuning 0–59, fresh 10000–10199) are bank seeds.
 *  5. Room identity: idle, random, weak-bot and elite-bot logs on the same seed meet the identical mazes,
 *     items, windows and pars (scripts/room-identity/tilt.ts), over every maze both reached.
 *  6. Rules on hand-built states: a fall into a black hole sends the marble back to its start and holds it
 *     there TILT_X_FALL_HOLD ticks (the run goes on); quick-star and pace points; the skill pay; 200 caps.
 *  7. The score: 0 without input, 0–200 for random play through the server; the features exist on tiltRev 8
 *     only; the live bands list tiltRev 8 on its curve with tiltRev 6 as its score-bands revision.
 *
 *   bun scripts/tilt-expand-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  tiltCeilingX,
  tiltCheckpoint,
  tiltCupReachableX,
  tiltDealableX,
  tiltExpandGame,
  tiltGameFor,
  tiltMazesX,
  tiltPacePoints,
  tiltQuickPoints,
  tiltSkillPaid,
  tiltXBandParts,
  TILT_CHECKPOINT_INTERVAL,
  TILT_RUN_TICKS,
  TILT_REV_EXPAND,
  TILT_REV_STRICT,
  TILT_V8_BAND_CURVE,
  TILT_V9_BAND_CURVE,
  TILT_X_FALL_HOLD,
  TILT_X_MAZES,
  TILT_X_PACE_POINTS,
  TILT_X_PACE_SLOW,
  TILT_X_PAR_RUN,
  TILT_X_QUICK,
  TILT_X_QUICK_HOPS,
  TILT_X_QUICK_POINTS,
  TILT_X_QUICK_TAIL,
  TILT_X_SKILL_PAY,
  TILT_X_SKILL_RAW,
  TILT_X_STARS,
  TILT_X_STAR_HOPS,
  type Maze,
  type TiltState,
} from "../src/lib/arcade/tilt";
import { encodeTiltRun, replayTiltRun } from "../src/lib/duel/tilt";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { tiltStateDigest } from "./tilt-expand-record";
import { randomLog, roomIdentity, scheduleOf } from "./room-identity/tilt";
import { TILT_BANK } from "../src/lib/duel/tiltBank.server";
import { playRevOf } from "./scoring-targets-revs";

/** Cells on the way into a black hole (between it and the route) or within two cells of one. */
function nearHoles(m: Maze): Set<number> {
  const DX = [1, 0, -1, 0];
  const DY = [0, 1, 0, -1];
  const out = new Set<number>();
  const open = (a: number, d: number) => {
    const i = (a % m.n) + DX[d]!;
    const j = Math.trunc(a / m.n) + DY[d]!;
    if (i < 0 || j < 0 || i >= m.n || j >= m.n || !m.inside[j * m.n + i]) return -1;
    const nc = j * m.n + i;
    const wall = d === 0 ? m.wallR[a] : d === 1 ? m.wallD[a] : d === 2 ? m.wallR[nc] : m.wallD[nc];
    return wall ? -1 : nc;
  };
  for (const p of m.pits) {
    const dist = new Map<number, number>([[p, 0]]);
    const q = [p];
    for (let k = 0; k < q.length; k++)
      for (let d = 0; d < 4; d++) {
        const nc = open(q[k]!, d);
        if (nc >= 0 && !dist.has(nc)) {
          dist.set(nc, dist.get(q[k]!)! + 1);
          q.push(nc);
        }
      }
    for (const [c, d] of dist) if (d <= 2) out.add(c);
  }
  return out;
}

let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond && failures.length < 60) failures.push(label);
};
type Run = { level: string; n: number; seed: number; rev: number; raw: string; score: number; digest: string; older?: Record<string, [number, string]> };
const load = (path: string) => (JSON.parse(gunzipSync(readFileSync(path)).toString()) as { runs: Run[] }).runs;

/* 1. Legacy. */
const legacy = load("scripts/fixtures/tilt-expand-legacy.json.gz");
ok(legacy.length === 32, `32 legacy runs (got ${legacy.length})`);
for (const run of legacy) {
  const tag = `tiltRev ${run.rev} ${run.level} #${run.n}`;
  const r = replayTiltRun(run.seed, run.raw, run.rev);
  ok(!r.flagged && r.desyncTick === null, `${tag}: replays unflagged (${r.reason ?? ""})`);
  ok(r.score === run.score, `${tag}: stored ${run.score}, replays ${r.score}`);
  ok(tiltStateDigest(r.state) === run.digest, `${tag}: final state changed`);
  ok(!r.state.xp && r.state.keysGot === undefined && r.state.quickPts === undefined && r.state.falls === undefined, `${tag}: no expansion fields`);
  for (const [rev, [score, digest]] of Object.entries(run.older ?? {})) {
    const o = replayTiltRun(run.seed, run.raw, Number(rev) || null);
    ok(o.score === score && tiltStateDigest(o.state) === digest, `${tag} on tiltRev ${rev || "(none)"}: score or state changed`);
  }
}

/* 2. tiltRev 8 runs and the 200s. */
const runs = load("scripts/fixtures/tilt-expand-runs.json.gz");
ok(runs.length >= 24, `24 or more tiltRev 8 runs (got ${runs.length})`);
for (const run of runs) {
  const tag = `tiltRev 8 ${run.level} #${run.n}`;
  const r = replayTiltRun(run.seed, run.raw, TILT_REV_EXPAND);
  ok(run.rev === TILT_REV_EXPAND && !r.flagged && r.desyncTick === null, `${tag}: replays unflagged (${r.reason ?? ""})`);
  ok(r.score === run.score && tiltStateDigest(r.state) === run.digest, `${tag}: stored ${run.score}, replays ${r.score}`);
  ok(r.state.xp === 1 && r.score > 0 && r.score <= 200, `${tag}: an expansion state scoring 1–200 (${r.score})`);
}
/* 3. The deal. */
const dealt = generatePuzzle("tilt") as unknown as { tiltRev: number; seed: number };
// Since 27 Oct 2026 rooms deal tiltRev 9, tiltRev 8's play on lifted curves (phone-notes-check proves it and its curve).
ok(playRevOf("tilt", dealt.tiltRev) === TILT_REV_EXPAND, `rooms deal tiltRev ${TILT_REV_EXPAND}'s play (got ${dealt.tiltRev})`);
ok(tiltDealableX(dealt.seed) && TILT_BANK.includes(dealt.seed), "rooms deal a bank seed, which passes the dealer's rule");
ok(TILT_BANK.length >= 260 && new Set(TILT_BANK).size === TILT_BANK.length, `the bank holds 260 or more distinct seeds (${TILT_BANK.length})`);
/** Hops from a cell to the nearest cell of a marble's route. */
function hopsOff(m: Maze, c: number, blueOnly = false): number {
  const DX = [1, 0, -1, 0];
  const DY = [0, 1, 0, -1];
  const open = (a: number, d: number) => {
    const i = (a % m.n) + DX[d]!;
    const j = Math.trunc(a / m.n) + DY[d]!;
    if (i < 0 || j < 0 || i >= m.n || j >= m.n || !m.inside[j * m.n + i]) return -1;
    const nc = j * m.n + i;
    const wall = d === 0 ? m.wallR[a] : d === 1 ? m.wallD[a] : d === 2 ? m.wallR[nc] : m.wallD[nc];
    return wall ? -1 : nc;
  };
  const bfs = (from: number) => {
    const dist = new Map<number, number>([[from, 0]]);
    const parent = new Map<number, number>([[from, -1]]);
    const q = [from];
    for (let k = 0; k < q.length; k++)
      for (let d = 0; d < 4; d++) {
        const nc = open(q[k]!, d);
        if (nc >= 0 && !dist.has(nc)) {
          dist.set(nc, dist.get(q[k]!)! + 1);
          parent.set(nc, q[k]!);
          q.push(nc);
        }
      }
    return parent;
  };
  const route = new Set<number>();
  const pa = bfs(m.start);
  for (let x = m.exit; x >= 0; x = pa.get(x)!) route.add(x);
  if (!blueOnly && (m.start2 ?? -1) >= 0) {
    const pb = bfs(m.start2!);
    for (let x = m.exit2!; x >= 0; x = pb.get(x)!) route.add(x);
  }
  let hops = 0;
  for (let x = c; x >= 0 && !route.has(x); x = pa.get(x)!) hops++;
  return hops;
}
let rerolled = 0;
let cellsX = 0;
let cells6 = 0;
for (let k = 0; k < 3000; k++) {
  const seed = (Math.imul(k + 1, 2654435761) ^ 0x5bd1e995) >>> 1 || 1;
  if (!tiltDealableX(seed)) {
    rerolled++;
    continue;
  }
  const list = tiltMazesX(seed);
  ok(list.length === TILT_X_MAZES, `seed ${seed}: ${TILT_X_MAZES} mazes`);
  ok(list.reduce((t, m) => t + m.par!, 0) <= TILT_X_PAR_RUN, `seed ${seed}: the pars fit the run`);
  list.forEach((m, i) => {
    const tag = `seed ${seed} maze ${i + 1}`;
    ok(tiltCupReachableX(m, 0) && tiltCupReachableX(m, 1), `${tag}: every key and both cups reachable`);
    ok(m.keys?.length === 1 && m.gates?.length === 2, `${tag}: one key and gate`);
    ok(m.stars?.length === TILT_X_STARS && m.stars.every((c) => hopsOff(m, c) >= TILT_X_STAR_HOPS[0] && hopsOff(m, c) <= TILT_X_STAR_HOPS[1]), `${tag}: ${TILT_X_STARS} gold star(s), each ${TILT_X_STAR_HOPS.join("–")} cells off a route`);
    ok(m.quick?.length === TILT_X_QUICK && m.quick.every((c) => m.ice?.[c] === 1 && hopsOff(m, c) >= TILT_X_QUICK_HOPS[0] && hopsOff(m, c) <= TILT_X_QUICK_HOPS[1]), `${tag}: ${TILT_X_QUICK} quick stars on ice, each ${TILT_X_QUICK_HOPS.join("–")} cells into its passage`);
    ok(m.quickAt?.length === TILT_X_QUICK && m.quickAt.every((t) => t > 0) && (m.par ?? 0) > 0, `${tag}: every quick star has its window and the maze its par`);
    const items = [...m.pits, ...m.stars!, ...m.quick!, ...m.keys!];
    ok(new Set(items).size === items.length, `${tag}: holes, stars and keys on separate cells`);
    ok(i + 1 < 3 ? (m.start2 ?? -1) < 0 : (m.start2 ?? -1) >= 0, `${tag}: the amber marble only in maze 3`);
    // Every passage can be entered and left: no star or key on the way into a black hole or within two cells
    // of one, and no ice there, so a marble that takes one at speed can always stop or turn back.
    const near = nearHoles(m);
    ok([...m.stars!, ...m.quick!, ...m.keys!].every((c) => !near.has(c)), `${tag}: no star or key on the way into a hole or within two cells of one`);
    // Holes are placed off the blue route when a maze is carved (maze 3's amber route is laid later; the oracle proofs below show it is played past them).
    ok(m.pits.every((p) => hopsOff(m, p, true) >= 2), `${tag}: every hole two or more cells off the blue route`);
    cellsX += m.inside.reduce((a, b) => a + b, 0);
  });
  if (k < 300) cells6 += tiltGameFor(TILT_REV_STRICT).init(seed).list.slice(0, 3).reduce((n, m) => n + m.inside.reduce((a, b) => a + b, 0), 0);
}
ok(rerolled < 1800, `the dealer passes 40 % or more of seeds (${rerolled} of 3,000)`);
ok(cellsX / (3000 - rerolled) > (1.4 * cells6) / 300, `tiltRev 8's mazes are bigger (${(cellsX / (3000 - rerolled)).toFixed(0)} cells a run vs ${(cells6 / 300).toFixed(0)} in tiltRev 6's first three)`);

/* 4. The ceiling, by play: every bank seed was played to 200 by the oracle (scripts/tilt-oracle.ts); its stored
   log replays to 200 through the server. The measured seeds are the bank's first 260 (tuning 0–59, fresh 60–259). */
const spec = GAME_BY_TYPE.get("tilt" as never)!;
const proofs = (JSON.parse(gunzipSync(readFileSync("scripts/fixtures/tilt-bank-runs.json.gz")).toString()) as { runs: { seed: number; raw: string }[] }).runs;
const proofBySeed = new Map(proofs.map((p) => [p.seed, p.raw]));
ok(TILT_BANK.every((seed) => proofBySeed.has(seed)), "every bank seed has its oracle proof");
let lowestBank = 999;
const proofScore = new Map<number, number>();
for (let n = 0; n < TILT_BANK.length; n++) {
  const seed = TILT_BANK[n]!;
  const raw = proofBySeed.get(seed);
  if (!raw) continue;
  const r = replayTiltRun(seed, raw, TILT_REV_EXPAND);
  ok(!r.flagged && r.score === 200, `bank seed ${n} (${seed}): the oracle's run replays to 200 (${r.score}${r.reason ? `, ${r.reason}` : ""})`);
  ok(r.state.mazes === 3 && r.state.quickTaken === 6 && r.state.stars === 3 && r.state.keysTaken === 3, `bank seed ${n}: every quick star, gold star and key taken, every passage entered and left`);
  proofScore.set(seed, r.flagged ? -1 : r.score);
  lowestBank = Math.min(lowestBank, r.score);
}
const lowest = { tuning: 999, fresh: 999 };
const sets: [keyof typeof lowest, number[]][] = [["tuning", Array.from({ length: 60 }, (_, i) => i)], ["fresh", Array.from({ length: 200 }, (_, i) => 10000 + i)]];
for (const [set, indices] of sets) {
  const seen = new Set<number>();
  for (const n of indices) {
    const seed = spec.seedFor(n);
    ok(TILT_BANK.includes(seed) && !seen.has(seed), `${set} seed index ${n}: a bank seed, not repeated in its set`);
    seen.add(seed);
    ok(tiltCeilingX(seed) === 200, `${set} seed index ${n}: the items at par add up to 200`);
    lowest[set] = Math.min(lowest[set], proofScore.get(seed) ?? -1);
  }
}
const tuningSeeds = new Set(sets[0]![1].map((n) => spec.seedFor(n)));
ok(sets[1]![1].every((n) => !tuningSeeds.has(spec.seedFor(n))), "the fresh seeds share none with the tuning seeds");
ok(lowest.tuning === 200 && lowest.fresh === 200 && lowestBank === 200, `the oracle reaches 200 on every measured seed (lowest: tuning ${lowest.tuning}, fresh ${lowest.fresh}, whole bank ${lowestBank})`);

/* 5. Room identity. */
for (const n of [0, 1, 2]) {
  const seed = spec.seedFor(n);
  const logs = roomIdentity.logs(seed);
  const lists = logs.map((log) => scheduleOf(seed, TILT_REV_EXPAND, log));
  const reached = lists.map((l) => new Set(l.map((e) => Math.floor(e.t / 100_000))));
  for (let a = 0; a < lists.length; a++)
    for (let b = a + 1; b < lists.length; b++) {
      const both = [...reached[a]!].filter((x) => reached[b]!.has(x));
      const pick = (l: { t: number; what: string }[]) => l.filter((e) => both.includes(Math.floor(e.t / 100_000))).map((e) => `${e.t} ${e.what}`).join("\n");
      ok(both.length >= 1 && pick(lists[a]!) === pick(lists[b]!), `seed index ${n}: logs ${a} and ${b} meet the same items over mazes ${both.map((x) => x + 1).join(", ")}`);
    }
  ok(Math.max(...reached.map((r) => r.size)) >= 2, `seed index ${n}: some log reaches a second maze (${reached.map((r) => r.size).join("/")})`);
}

/* 6. Rules on hand-built states. */
{
  const seed = spec.seedFor(5);
  const s0 = tiltExpandGame.init(seed);
  const m = s0.list[0]!;
  const pit = m.pits[0]!;
  const centre = { x: (pit % m.n) * m.cs + Math.trunc(m.cs / 2), y: Math.trunc(pit / m.n) * m.cs + Math.trunc(m.cs / 2) };
  const start = { x: (m.start % m.n) * m.cs + Math.trunc(m.cs / 2), y: Math.trunc(m.start / m.n) * m.cs + Math.trunc(m.cs / 2) };
  let s: TiltState = tiltExpandGame.step({ ...s0, x: centre.x, y: centre.y, vx: 0, vy: 0 }, null);
  ok(s.ended === 0 && s.falls === 1 && s.x === start.x && s.y === start.y && s.vx === 0 && s.vy === 0, "a fall sends the blue marble back to its start, the run goes on");
  ok(s.holdA === s.tick + TILT_X_FALL_HOLD, "and holds it there");
  const held = s;
  for (let t = 0; t < TILT_X_FALL_HOLD; t++) s = tiltExpandGame.step({ ...s, angle: 16384 }, null);
  ok(s.x === held.x && s.y === held.y, "a held marble does not roll");
  s = tiltExpandGame.step({ ...s, angle: 16384 }, null);
  s = tiltExpandGame.step({ ...s, angle: 16384 }, null);
  ok(s.vx !== 0 || s.vy !== 0 || s.x !== held.x, "after its hold the marble rolls again");
  // The old revisions still end the run on a fall.
  const old = tiltGameFor(TILT_REV_STRICT);
  const o0 = old.init(seed);
  const om = o0.list[0]!;
  const op = om.pits[0];
  if (op !== undefined) {
    const oc = { x: (op % om.n) * om.cs + Math.trunc(om.cs / 2), y: Math.trunc(op / om.n) * om.cs + Math.trunc(om.cs / 2) };
    const o1 = old.step({ ...o0, x: oc.x, y: oc.y, vx: 0, vy: 0 }, null);
    ok(o1.ended === 2, "tiltRev 6 still ends the run in a black hole");
  }
  // Points.
  ok(tiltQuickPoints(0, 300) === TILT_X_QUICK_POINTS && tiltQuickPoints(300, 300) === TILT_X_QUICK_POINTS && tiltQuickPoints(301, 300) <= TILT_X_QUICK_POINTS && tiltQuickPoints(300 + TILT_X_QUICK_TAIL, 300) === 0, "a quick star is worth its full points to its window, 0 at the tail's end");
  let last = 99;
  let falling = true;
  for (let t = 0; t <= 300 + TILT_X_QUICK_TAIL; t++) {
    const p = tiltQuickPoints(t, 300);
    if (p > last) falling = false;
    last = p;
  }
  ok(falling, "quick-star points never rise as the window runs");
  ok(tiltPacePoints(1000, 1000) === TILT_X_PACE_POINTS && tiltPacePoints(1, 1000) === TILT_X_PACE_POINTS && tiltPacePoints(Math.trunc((1000 * TILT_X_PACE_SLOW) / 100), 1000) === 0 && tiltPacePoints(1300, 1000) < TILT_X_PACE_POINTS, "pace: full at par, none at the slow mark");
  ok(TILT_X_SKILL_PAY.points.at(-1) === 50 && TILT_X_SKILL_PAY.units.at(-1) === TILT_X_SKILL_RAW, "the skill pay tops out at 50 at every skill point");
  const full: TiltState = { ...s0, mazes: TILT_X_MAZES, stars: TILT_X_MAZES * TILT_X_STARS, quickPts: TILT_X_MAZES * TILT_X_QUICK * TILT_X_QUICK_POINTS, pace: TILT_X_MAZES * TILT_X_PACE_POINTS, ended: 1, endedTick: 4000, acted: 1 };
  ok(tiltExpandGame.score(full) === 200 && tiltSkillPaid(full) === 50, `everything at par scores 200 (${tiltExpandGame.score(full)})`);
  ok(tiltExpandGame.score({ ...full, quickPts: 999, pace: 999 }) === 200, "the score caps at 200");
  ok(tiltExpandGame.score({ ...full, acted: 0 }) === 0, "no input scores 0");
  const noSkill: TiltState = { ...full, quickPts: 0, pace: 0 };
  ok(tiltExpandGame.score(noSkill) === 150, `every maze and star without skill points scores 150 (${tiltExpandGame.score(noSkill)})`);
}

/* 7. The score. */
{
  const seed = spec.seedFor(7);
  let s = tiltExpandGame.init(seed);
  while (!tiltExpandGame.isOver(s)) s = tiltExpandGame.step(s, null);
  ok(tiltExpandGame.score(s) === 0, `no input scores 0 (${tiltExpandGame.score(s)})`);
  const scores: number[] = [];
  for (let k = 0; k < 8; k++) {
    const sd = spec.seedFor(10 + k);
    const events = randomLog(sd);
    const byTick = new Map(events.map((e) => [e.t, e]));
    let st: TiltState = tiltExpandGame.init(sd);
    const checkpoints: unknown[] = [];
    while (!tiltExpandGame.isOver(st) && st.tick < TILT_RUN_TICKS) {
      st = tiltExpandGame.step(st, byTick.get(st.tick + 1) ?? null);
      if (st.tick % TILT_CHECKPOINT_INTERVAL === 0) checkpoints.push(tiltCheckpoint(st));
    }
    const score = tiltExpandGame.score(st);
    const parts = tiltXBandParts(st);
    ok(score >= 0 && score <= 200 && parts.points <= 140 && parts.bonus <= 60, `random play ${k}: ${score} in 0–200 (${parts.points} + ${parts.bonus})`);
    const raw = encodeTiltRun({ seed: sd, claimedScore: score, events, endTick: st.tick, checkpoints: checkpoints as never });
    const r = replayTiltRun(sd, raw, TILT_REV_EXPAND);
    ok(!r.flagged && r.score === score, `random play ${k}: the server replays ${r.score} (phone ${score})`);
    scores.push(score);
  }
  scores.sort((a, b) => a - b);
  ok(scores[scores.length >> 1]! <= 40, `random play stays low (median ${scores[scores.length >> 1]}, max ${scores.at(-1)})`);
  for (const rev of [null, 2, 3, 4, 5, 6]) {
    const o = tiltGameFor(rev).init(12345);
    ok(!o.xp && o.list.every((mz) => !mz.keys && !mz.gates && !mz.ice && !mz.quick && mz.par === undefined), `tiltRev ${rev ?? "(none)"}: no keys, gates, ice, quick stars or par`);
  }
  ok(TILT_V8_BAND_CURVE.points.at(-1) === 140 && TILT_V8_BAND_CURVE.units.at(-1) === 150, "the base curve tops out at 140 at 150 units");
  ok(roundMaxFor("tilt") === 200, "Tilt's round maximum is 200");
  const live = LIVE_BANDS.tilt as { rev: number; curve: unknown; strictRev?: number };
  ok(playRevOf("tilt", live.rev) === TILT_REV_EXPAND && live.curve === TILT_V9_BAND_CURVE && TILT_V9_BAND_CURVE.units.join() === TILT_V8_BAND_CURVE.units.join() && live.strictRev === TILT_REV_STRICT, "LIVE_BANDS lists tiltRev 8's play on the dealt curve (its units), tiltRev 6 as its strict revision");
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL tilt-expand-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS tilt-expand-check: ${checks} checks — tiltRev 6 and older replay as before, tiltRev 8 runs and a 200 replay, every dealt seed's ceiling is 200, rooms identical, the score 0–200`);
