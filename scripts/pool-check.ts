/**
 * pool-check (the Sports group, 30 Oct 2026; docs/arcade-standard/pool.md): Speed Pool poolRev 1.
 *
 *  - the bank: every layout's witness (scripts/fixtures/pool-witness.json) clears the table to exactly 200 through the
 *    server's replay, unflagged, with no foul and no miss; rooms deal only bank layouts;
 *  - the layouts: 7 spots, 4 stripes, the black and the cue ball, all on the cloth, apart and clear of the pockets;
 *    the same seed deals the same layout;
 *  - the rules: a shot straight at a stripe is a foul (−10) and breaks the run of pots; a shot while balls move does
 *    nothing; no input scores 0, any shot 1+;
 *  - determinism and input repair.
 *
 *   bun scripts/pool-check.ts
 */
import { readFileSync } from "node:fs";
import { fp } from "../src/lib/arcade/engine";
import { poolCheckpoint, poolGameFor, poolIsSpot, poolIsStripe, poolLayout, poolShotC, POOL_AIM, POOL_BALL_R, POOL_BLACK, POOL_CB, POOL_CL, POOL_CR, POOL_CT, POOL_CUE, POOL_POCKETS, POOL_REV, type PoolState } from "../src/lib/arcade/pool";
import { encodePoolRun, replayPoolRun } from "../src/lib/duel/pool";
import { POOL_BANK } from "../src/lib/duel/poolBank.server";
import { generatePool } from "../src/lib/duel/sports.server";

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
const witness = JSON.parse(readFileSync(new URL("./fixtures/pool-witness.json", import.meta.url), "utf8")) as Record<string, string>;

/* The bank. */
ok(POOL_BANK.length >= 40 && new Set(POOL_BANK).size === POOL_BANK.length, `at least 40 unique bank layouts (${POOL_BANK.length})`);
let cleared = 0;
for (const seed of POOL_BANK) {
  const run = replayPoolRun(seed, witness[String(seed)] ?? "", POOL_REV);
  if (run.score === 200 && !run.flagged && run.fouls === 0 && run.scratches === 0 && run.spots === 7 && run.black && run.streakBest === 8 && run.shots <= 8) cleared++;
}
ok(cleared === POOL_BANK.length, `every bank witness clears the table with every pot in one run (no miss), no foul or scratch, 200 through the server replay (${cleared} of ${POOL_BANK.length})`);
for (let i = 0; i < 50; i++) {
  const p = generatePool();
  ok(POOL_BANK.includes(p.seed) && p.poolRev === POOL_REV, `rooms deal a bank layout (${p.seed})`);
}

/* The layouts. */
for (const seed of POOL_BANK) {
  const l = poolLayout(seed);
  ok(JSON.stringify(l) === JSON.stringify(poolLayout(seed)), `layout ${seed}: the same seed deals the same layout`);
  const ids = l.balls.map((b) => b.id);
  ok(ids.filter(poolIsSpot).length === 7 && ids.filter(poolIsStripe).length === 4 && ids.filter((i) => i === POOL_BLACK).length === 1 && ids.filter((i) => i === POOL_CUE).length === 1, `layout ${seed}: 7 spots, 4 stripes, the black and the cue ball`);
  const r = fp(POOL_BALL_R);
  ok(l.balls.every((b) => b.x - r >= fp(POOL_CL) && b.x + r <= fp(POOL_CR) && b.y - r >= fp(POOL_CT) && b.y + r <= fp(POOL_CB)), `layout ${seed}: every ball on the cloth`);
  ok(l.balls.every((a, i) => l.balls.every((b, j) => i >= j || Math.hypot(a.x - b.x, a.y - b.y) >= 2 * r)), `layout ${seed}: no two balls touch`);
  ok(l.balls.every((b) => POOL_POCKETS.every((p) => Math.hypot(p.x - b.x, p.y - b.y) > fp(20))), `layout ${seed}: no ball in a pocket's mouth`);
}

/* The rules. */
const game = poolGameFor(POOL_REV);
const shoot = (s: PoolState, dx: number, dy: number, power: number) => {
  // The aim as the phone sends it: a direction inside the declared ±4096 range.
  const l = Math.hypot(dx, dy) || 1;
  return game.step(s, { t: s.tick + 1, k: 1, a: Math.round((dx * 4000) / l), b: Math.round((dy * 4000) / l), c: poolShotC(power, 12), d: 0 });
};
const settle = (s: PoolState) => {
  let x = s;
  while (x.phase !== POOL_AIM && !x.over) x = game.step(x, null);
  return x;
};
let fouled = 0;
let tried = 0;
for (const seed of POOL_BANK.slice(0, 30)) {
  const s0 = game.init(seed);
  const cue = s0.balls.find((b) => b.id === POOL_CUE)!;
  // A stripe with a clear straight line from the cue ball (no other ball within two radii of the line).
  const stripe = s0.balls.find((b) => poolIsStripe(b.id) && s0.balls.every((o) => {
    if (o === b || o.id === POOL_CUE) return true;
    const vx = b.x - cue.x, vy = b.y - cue.y, wx = o.x - cue.x, wy = o.y - cue.y;
    const t = (wx * vx + wy * vy) / (vx * vx + vy * vy);
    if (t <= 0 || t >= 1) return true;
    return Math.hypot(wx - vx * t, wy - vy * t) > fp(2 * POOL_BALL_R + 1);
  }));
  if (!stripe) continue;
  tried++;
  const after = settle(shoot(s0, stripe.x - cue.x, stripe.y - cue.y, 900));
  if (after.fouls >= 1 && after.streak === 0) fouled++;
}
ok(tried >= 5 && fouled === tried, `a shot straight at a stripe is a foul and breaks the run (${fouled} of ${tried})`);
{
  const s0 = game.init(POOL_BANK[0]!);
  const moving = shoot(s0, 0, -4000, 800);
  const again = shoot(moving, 4000, 0, 1000);
  ok(again.shots === 1, "a shot while the balls move is ignored");
  let idle = game.init(POOL_BANK[0]!);
  while (!idle.over) idle = game.step(idle, null);
  ok(game.score(idle) === 0, "no input scores 0");
  let played = settle(shoot(game.init(POOL_BANK[0]!), 4000, 1, 50));
  while (!played.over) played = game.step(played, null);
  ok(game.score(played) >= 1, `any shot scores at least 1 (${game.score(played)})`);
}

/* Determinism and input repair. */
{
  const seed = POOL_BANK[1]!;
  const a = replayPoolRun(seed, witness[String(seed)]!, POOL_REV);
  const b = replayPoolRun(seed, witness[String(seed)]!, POOL_REV);
  ok(JSON.stringify(a.checkpoints) === JSON.stringify(b.checkpoints) && JSON.stringify(poolCheckpoint(a.state)) === JSON.stringify(poolCheckpoint(b.state)), "the same log replays the same twice");
  const r = replayPoolRun(seed, encodePoolRun({ seed, claimedScore: 0, events: [{ t: 3, k: 1, a: 99999, b: 0, c: -5, d: 0 }], endTick: 0, checkpoints: [] }), POOL_REV);
  ok(r.inputDiag.clamped === 1 && r.inputDiag.dropped === 0 && r.flagged, "an out-of-range shot is clamped, replayed and flagged");
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`FAIL: ${f}`);
  console.log(`FAIL: ${failures.length} of ${checks} pool checks`);
  process.exit(1);
}
console.log(`PASS: ${checks} pool checks`);
