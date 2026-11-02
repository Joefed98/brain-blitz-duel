/**
 * pool-check (the Sports group, 30 Oct 2026; docs/arcade-standard/pool.md): Cue Ball (`pool`) poolRev 1 and poolRev 2.
 *
 * poolRev 1 (stored rounds) keeps its bank, witnesses, encoding (c = power × 25 + spin) and physics exactly; poolRev 2
 * (31 Oct 2026, what rooms deal) has its own bank (poolBankV2.server.ts, witnesses pool-witness-v2.json), power in c
 * and the spin dot anywhere on the face in d (−100…100 each, inside the safe circle), continuous follow, draw and side,
 * and each potted ball's drop tick for the art. Both revisions are proved below:
 *
 *  - the bank: every layout's witness (scripts/fixtures/pool-witness.json) clears the table to exactly 200 through the
 *    server's replay, unflagged, with no foul and no miss; rooms deal only bank layouts;
 *  - the layouts: 7 spots, 4 stripes, the black and the cue ball, all on the cloth, apart and clear of the pockets;
 *    the same seed deals the same layout;
 *  - the rules: a shot straight at a stripe is a foul (−10) and breaks the run of pots; a shot while balls move does
 *    nothing; no input scores 0, any shot 1+;
 *  - determinism and input repair;
 *  - poolRev 3 (1 Nov 2026, what rooms deal; poolBankV3.server.ts, witnesses pool-witness-v3.json): a 25 % harder top
 *    speed, 1.75× the follow, draw and side, a shot touching no ball a foul; poolRev 2 runs recorded on main
 *    (scripts/fixtures/tuning-nov1-legacy.json) replay to the same score and final state.
 *
 *   bun scripts/pool-check.ts
 */
import { readFileSync } from "node:fs";
import { fp } from "../src/lib/arcade/engine";
import {
  poolCheckpoint,
  poolGameFor,
  poolIsSpot,
  poolIsStripe,
  poolLayout,
  poolShot2,
  poolShotC,
  poolSpin2Code,
  poolSpin2Of,
  poolSpinCode,
  poolStdParts,
  POOL_AIM,
  POOL_BALL_R,
  POOL_BLACK,
  POOL_CB,
  POOL_CL,
  POOL_CR,
  POOL_CT,
  POOL_CUE,
  POOL_POCKETS,
  POOL_REV,
  POOL_REV_V1,
  POOL_SPIN2_CENTRE,
  POOL_SPIN2_MAX,
  POOL_SPIN_SAFE,
  type PoolState,
} from "../src/lib/arcade/pool";
import { encodePoolRun, replayPoolRun } from "../src/lib/duel/pool";
import { POOL_BANK } from "../src/lib/duel/poolBank.server";
import { POOL_BANK_V2 } from "../src/lib/duel/poolBankV2.server";
import { POOL_BANK_V3 } from "../src/lib/duel/poolBankV3.server";
import { generatePool } from "../src/lib/duel/sports.server";

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
const witness = JSON.parse(readFileSync(new URL("./fixtures/pool-witness.json", import.meta.url), "utf8")) as Record<string, string>;
const witnessV2 = JSON.parse(readFileSync(new URL("./fixtures/pool-witness-v2.json", import.meta.url), "utf8")) as Record<string, string>;
const witnessV3 = JSON.parse(readFileSync(new URL("./fixtures/pool-witness-v3.json", import.meta.url), "utf8")) as Record<string, string>;

ok(POOL_REV === 3 && POOL_REV_V1 === 1, `rooms deal poolRev 3 (${POOL_REV})`);

/* The bank (poolRev 1, stored rounds). */
ok(POOL_BANK.length >= 40 && new Set(POOL_BANK).size === POOL_BANK.length, `at least 40 unique bank layouts (${POOL_BANK.length})`);
let cleared = 0;
for (const seed of POOL_BANK) {
  const run = replayPoolRun(seed, witness[String(seed)] ?? "", POOL_REV_V1);
  if (run.score === 200 && !run.flagged && run.fouls === 0 && run.scratches === 0 && run.spots === 7 && run.black && run.streakBest === 8 && run.shots <= 8) cleared++;
}
ok(cleared === POOL_BANK.length, `every bank witness clears the table with every pot in one run (no miss), no foul or scratch, 200 through the server replay (${cleared} of ${POOL_BANK.length})`);
{
  // An unstamped round replays as poolRev 1 (the revision every round before the stamp was dealt on).
  const seed = POOL_BANK[0]!;
  const a = replayPoolRun(seed, witness[String(seed)]!, undefined);
  const b = replayPoolRun(seed, witness[String(seed)]!, POOL_REV_V1);
  ok(a.score === 200 && a.state.rev === 1 && JSON.stringify(a.checkpoints) === JSON.stringify(b.checkpoints), "an unstamped round replays as poolRev 1");
  ok(b.state.balls.every((x) => x.downAt === undefined), "poolRev 1 states carry no drop ticks (unchanged)");
}

/* The bank (poolRev 2, stored rounds since 1 Nov 2026). */
ok(POOL_BANK_V2.length >= 40 && new Set(POOL_BANK_V2).size === POOL_BANK_V2.length, `at least 40 unique poolRev 2 bank layouts (${POOL_BANK_V2.length})`);
let clearedV2 = 0;
let dropTicks = 0;
for (const seed of POOL_BANK_V2) {
  const run = replayPoolRun(seed, witnessV2[String(seed)] ?? "", 2);
  if (run.state.rev === 2 && run.score === 200 && !run.flagged && run.fouls === 0 && run.scratches === 0 && run.spots === 7 && run.black && run.streakBest === 8 && run.shots <= 8) clearedV2++;
  if (run.state.balls.filter((b) => b.id !== POOL_CUE).every((b) => !b.down || (typeof b.downAt === "number" && b.downAt > 0 && b.downAt <= run.state.tick))) dropTicks++;
}
ok(clearedV2 === POOL_BANK_V2.length, `every poolRev 2 bank witness clears the table with every pot in one run, no foul or scratch, 200 through the server replay on poolRev 2 (${clearedV2} of ${POOL_BANK_V2.length})`);
ok(dropTicks === POOL_BANK_V2.length, `poolRev 2: every potted ball carries its drop tick (${dropTicks} of ${POOL_BANK_V2.length})`);
{
  // The poolRev 2 witnesses are not poolRev 1 logs: on poolRev 1 their c (the bare power) is clamped and the run differs.
  const seed = POOL_BANK_V2[0]!;
  const r = replayPoolRun(seed, witnessV2[String(seed)]!, POOL_REV_V1);
  ok(r.score !== 200 || r.flagged, "a poolRev 2 witness does not pass as a poolRev 1 run");
}
/* The bank (poolRev 3, what rooms deal). */
ok(POOL_BANK_V3.length >= 40 && new Set(POOL_BANK_V3).size === POOL_BANK_V3.length, `at least 40 unique poolRev 3 bank layouts (${POOL_BANK_V3.length})`);
{
  let clearedV3 = 0;
  for (const seed of POOL_BANK_V3) {
    const run = replayPoolRun(seed, witnessV3[String(seed)] ?? "", 3);
    if (run.state.rev === 3 && run.score === 200 && !run.flagged && run.fouls === 0 && run.scratches === 0 && run.spots === 7 && run.black && run.streakBest === 8 && run.shots <= 8) clearedV3++;
  }
  ok(clearedV3 === POOL_BANK_V3.length, `every poolRev 3 bank witness clears the table with every pot in one run, no foul or scratch, 200 through the server replay on poolRev 3 (${clearedV3} of ${POOL_BANK_V3.length})`);
  const seed = POOL_BANK_V3[0]!;
  const r2 = replayPoolRun(seed, witnessV3[String(seed)]!, 2);
  const r3 = replayPoolRun(seed, witnessV3[String(seed)]!, 3);
  ok(JSON.stringify(poolCheckpoint(r2.state)) !== JSON.stringify(poolCheckpoint(r3.state)), "a poolRev 3 witness rolls differently on poolRev 2 (the physics are the stamp's)");
}
for (let i = 0; i < 50; i++) {
  const p = generatePool();
  ok(POOL_BANK_V3.includes(p.seed) && p.poolRev === POOL_REV, `rooms deal a poolRev 3 bank layout on poolRev 3 (${p.seed})`);
}

/* poolRev 2 runs recorded on main before poolRev 3: the same score and final state. */
{
  type LegacyRun = { type: string; rev: number; seed: number; label: string; raw: string; score: number; checksum: number; tick: number };
  const tuning = JSON.parse(readFileSync(new URL("./fixtures/tuning-nov1-legacy.json", import.meta.url), "utf8")) as { runs: LegacyRun[] };
  const mine = tuning.runs.filter((r) => r.type === "pool");
  let same = 0;
  for (const run of mine) {
    const r = replayPoolRun(run.seed, run.raw, run.rev);
    if (r.score === run.score && poolCheckpoint(r.state).checksum === run.checksum && r.state.tick === run.tick) same++;
    else failures.push(`pool rev ${run.rev}: seed ${run.seed} ${run.label} replays to ${r.score} (main ${run.score})`);
  }
  ok(same === mine.length && mine.length === 16, `poolRev 2: all ${mine.length} bot runs recorded on main replay to the same score and final state`);
}

/* poolRev 2's spin encoding: the dot anywhere inside the safe circle. */
{
  ok(poolSpin2Code(0, 0) === POOL_SPIN2_CENTRE, "the centre dot's code");
  let roundTrip = 0;
  let inside = 0;
  let total = 0;
  const lim = POOL_SPIN_SAFE * POOL_SPIN_SAFE;
  for (let x = -POOL_SPIN_SAFE; x <= POOL_SPIN_SAFE; x += 3)
    for (let y = -POOL_SPIN_SAFE; y <= POOL_SPIN_SAFE; y += 3) {
      total++;
      const d = poolSpin2Of(poolSpin2Code(x, y));
      if (x * x + y * y > lim || (d.x === x && d.y === y)) roundTrip++;
      if (d.x * d.x + d.y * d.y <= lim) inside++;
    }
  ok(roundTrip === total, `every dot inside the safe circle round-trips through its code (${roundTrip} of ${total})`);
  ok(inside === total, `every decoded dot is inside the safe circle (${inside} of ${total})`);
  let anyCode = 0;
  let codes = 0;
  for (let c = 0; c <= POOL_SPIN2_MAX; c += 13) {
    codes++;
    const d = poolSpin2Of(c);
    if (d.x * d.x + d.y * d.y <= lim && Number.isInteger(d.x) && Number.isInteger(d.y)) anyCode++;
  }
  ok(anyCode === codes, `any code in range decodes to a whole-number dot inside the circle (${anyCode} of ${codes})`);
  const far = poolSpin2Of(poolSpin2Code(100, 100));
  ok(far.x === far.y && far.x >= 70 && far.x <= 71, `a corner dot is held on the circle's edge (${far.x}, ${far.y})`);
  ok(poolShot2(5000, 0, 0).c === 1000 && poolShot2(-3, 0, 0).c === 1, "poolRev 2's power is clamped to 1…1000");
  ok(poolSpinCode(2, 0) === 22 && poolShotC(800, 12) === 20012, "poolRev 1's encoding is unchanged");
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

/* The rules, on every revision (poolRev 1's encoding on its game, poolRev 2's on 2 and 3). */
for (const REV of [POOL_REV_V1, 2, POOL_REV]) {
const game = poolGameFor(REV);
const BANK = REV === 3 ? POOL_BANK_V3 : REV === 2 ? POOL_BANK_V2 : POOL_BANK;
const W = REV === 3 ? witnessV3 : REV === 2 ? witnessV2 : witness;
const tag = `poolRev ${REV}: `;
const shoot = (s: PoolState, dx: number, dy: number, power: number) => {
  // The aim as the phone sends it: a direction inside the declared ±4096 range.
  const l = Math.hypot(dx, dy) || 1;
  const pay = REV >= 2 ? poolShot2(power, 0, 0) : { c: poolShotC(power, 12), d: 0 };
  return game.step(s, { t: s.tick + 1, k: 1, a: Math.round((dx * 4000) / l), b: Math.round((dy * 4000) / l), ...pay });
};
const settle = (s: PoolState) => {
  let x = s;
  while (x.phase !== POOL_AIM && !x.over) x = game.step(x, null);
  return x;
};
let fouled = 0;
let tried = 0;
for (const seed of BANK.slice(0, 30)) {
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
ok(tried >= 5 && fouled === tried, `${tag}a shot straight at a stripe is a foul and breaks the run (${fouled} of ${tried})`);
{
  const s0 = game.init(BANK[0]!);
  ok(s0.rev === REV, `${tag}the game deals its own revision`);
  const moving = shoot(s0, 0, -4000, 800);
  const again = shoot(moving, 4000, 0, 1000);
  ok(again.shots === 1, `${tag}a shot while the balls move is ignored`);
  let idle = game.init(BANK[0]!);
  while (!idle.over) idle = game.step(idle, null);
  ok(game.score(idle) === 0, `${tag}no input scores 0`);
  let played = settle(shoot(game.init(BANK[0]!), 4000, 1, 50));
  while (!played.over) played = game.step(played, null);
  ok(game.score(played) >= 1, `${tag}any shot scores at least 1 (${game.score(played)})`);
  ok((poolStdParts(played) ?? []).length === 4, `${tag}the standard's four parts`);
}

/* Determinism and input repair. */
{
  const seed = BANK[1]!;
  const a = replayPoolRun(seed, W[String(seed)]!, REV);
  const b = replayPoolRun(seed, W[String(seed)]!, REV);
  ok(JSON.stringify(a.checkpoints) === JSON.stringify(b.checkpoints) && JSON.stringify(poolCheckpoint(a.state)) === JSON.stringify(poolCheckpoint(b.state)) && JSON.stringify(a.state) === JSON.stringify(b.state), `${tag}the same log replays the same twice`);
  const r = replayPoolRun(seed, encodePoolRun({ seed, claimedScore: 0, events: [{ t: 3, k: 1, a: 99999, b: 0, c: -5, d: 0 }], endTick: 0, checkpoints: [] }), REV);
  ok(r.inputDiag.clamped === 1 && r.inputDiag.dropped === 0 && r.flagged, `${tag}an out-of-range shot is clamped, replayed and flagged`);
  if (REV >= 2) {
    const d = replayPoolRun(seed, encodePoolRun({ seed, claimedScore: 0, events: [{ t: 3, k: 1, a: 0, b: -4000, c: 500, d: 999999 }], endTick: 0, checkpoints: [] }), REV);
    ok(d.inputDiag.clamped === 1 && d.flagged, `${tag}an out-of-range spin code is clamped and flagged`);
  }
}
}

/* poolRev 2's spin: continuous follow, draw and side; the dot's strength scales the effect. */
{
  const game = poolGameFor(POOL_REV);
  // A straight shot up the table at a lone ball: where the cue ball comes to rest after the contact.
  const restAfter = (spinY: number) => {
    let s = game.init(POOL_BANK_V2[0]!);
    const cue = { ...s.balls.find((b) => b.id === POOL_CUE)!, x: fp((POOL_CL + POOL_CR) / 2), y: fp(POOL_CB - 120) };
    const ball = { ...s.balls.find((b) => b.id === 1)!, x: cue.x, y: cue.y - fp(160), down: 0 };
    s = { ...s, balls: [cue, ball, ...s.balls.filter((b) => b.id !== POOL_CUE && b.id !== 1).map((b) => ({ ...b, down: 1 }))] };
    s = game.step(s, { t: s.tick + 1, k: 1, a: 0, b: -4000, ...poolShot2(420, 0, spinY) });
    while (s.phase !== POOL_AIM && !s.over) s = game.step(s, null);
    return s.balls.find((b) => b.id === POOL_CUE)!.y;
  };
  const stun = restAfter(0);
  const half = restAfter(50);
  const full = restAfter(100);
  const halfDraw = restAfter(-50);
  const draw = restAfter(-100);
  ok(full < half && half < stun, `top spin follows through, further with the dot higher (${stun >> 8} > ${half >> 8} > ${full >> 8})`);
  ok(draw > halfDraw && halfDraw > stun, `back spin draws the cue ball back, more with the dot lower (${stun >> 8} < ${halfDraw >> 8} < ${draw >> 8})`);
  // Side: a shot into the side cushion bends off it by the side it carries.
  const bend = (spinX: number) => {
    let s = game.init(POOL_BANK_V2[0]!);
    s = { ...s, balls: s.balls.map((b) => (b.id === POOL_CUE ? { ...b, x: fp((POOL_CL + POOL_CR) / 2), y: fp(POOL_CB - 200) } : { ...b, down: 1 })) };
    s = game.step(s, { t: s.tick + 1, k: 1, a: 4000, b: -1000, ...poolShot2(380, spinX, 0) });
    while (s.phase !== POOL_AIM && !s.over) s = game.step(s, null);
    return s.balls.find((b) => b.id === POOL_CUE)!.y;
  };
  const left = bend(-100);
  const none = bend(0);
  const right = bend(100);
  const rightHalf = bend(50);
  ok(left !== none && right !== none && Math.sign(left - none) !== Math.sign(right - none), `side spin bends the cushion bounce either way (${left >> 8} / ${none >> 8} / ${right >> 8})`);
  ok(Math.abs(rightHalf - none) < Math.abs(right - none) && rightHalf !== none, `half side bends it less than full (${rightHalf >> 8} vs ${right >> 8})`);
}

/* poolRev 3: more power, more spin (draw, follow, side), a shot touching no ball a foul; poolRev 2 as before. */
{
  const lone = (rev: number) => {
    const game = poolGameFor(rev);
    const s = game.init(POOL_BANK_V2[0]!);
    return { game, s: { ...s, balls: s.balls.map((b) => (b.id === POOL_CUE ? { ...b, x: fp((POOL_CL + POOL_CR) / 2), y: fp(POOL_CB - 30) } : { ...b, down: 1 })) } };
  };
  // A full-power shot's launch speed and where a lone cue ball's first leg reaches.
  const launch = (rev: number) => {
    const { game, s } = lone(rev);
    const after = game.step(s, { t: 1, k: 1, a: 0, b: -4096, ...poolShot2(1000, 0, 0) });
    return -after.balls.find((b) => b.id === POOL_CUE)!.vy;
  };
  ok(launch(3) === fp(20) && launch(2) === fp(16), `a full-power shot leaves 25 % faster on poolRev 3 (${launch(3) >> 8} vs ${launch(2) >> 8} px a tick)`);
  const travel = (rev: number, power: number) => {
    const { game, s } = lone(rev);
    let st = game.step(s, { t: 1, k: 1, a: 1, b: -4096, ...poolShot2(power, 0, 0) });
    let path = 0;
    let prev = st.balls.find((b) => b.id === POOL_CUE)!;
    while (st.phase !== POOL_AIM && !st.over) {
      st = game.step(st, null);
      const c = st.balls.find((b) => b.id === POOL_CUE)!;
      path += Math.hypot(c.x - prev.x, c.y - prev.y);
      prev = c;
    }
    return path / 256;
  };
  const far2 = travel(2, 1000);
  const far3 = travel(3, 1000);
  ok(far3 > far2 * 1.2, `a full-power shot rolls noticeably further on poolRev 3 (${Math.round(far3)} px vs ${Math.round(far2)} px)`);
  ok(Math.abs(travel(3, 500) - travel(3, 500)) === 0, "poolRev 3's roll is deterministic");

  // Draw and follow after a straight hit, and side off a cushion: stronger on poolRev 3.
  const restAfter = (rev: number, spinY: number) => {
    const game = poolGameFor(rev);
    let s = game.init(POOL_BANK_V2[0]!);
    const cue = { ...s.balls.find((b) => b.id === POOL_CUE)!, x: fp((POOL_CL + POOL_CR) / 2), y: fp(POOL_CB - 120) };
    const ball = { ...s.balls.find((b) => b.id === 1)!, x: cue.x, y: cue.y - fp(160), down: 0 };
    s = { ...s, balls: [cue, ball, ...s.balls.filter((b) => b.id !== POOL_CUE && b.id !== 1).map((b) => ({ ...b, down: 1 }))] };
    const startY = cue.y;
    s = game.step(s, { t: s.tick + 1, k: 1, a: 0, b: -4096, ...poolShot2(rev === 3 ? 336 : 420, 0, spinY) });
    let contactY = startY;
    while (s.phase !== POOL_AIM && !s.over) {
      s = game.step(s, null);
      if (s.firstHit >= 0 && contactY === startY) contactY = s.balls.find((b) => b.id === POOL_CUE)!.y;
    }
    // How far the cue ball came back (+) or went on (−) from the contact.
    return (s.balls.find((b) => b.id === POOL_CUE)!.y - contactY) / 256;
  };
  const draw2 = restAfter(2, -100);
  const draw3 = restAfter(3, -100);
  const follow2 = -restAfter(2, 100);
  const follow3 = -restAfter(3, 100);
  ok(draw3 > draw2 * 1.4 && draw3 > 20, `back spin pulls the cue ball back much further on poolRev 3 (${Math.round(draw3)} px vs ${Math.round(draw2)} px)`);
  ok(follow3 > follow2 * 1.4, `top spin follows through much further on poolRev 3 (${Math.round(follow3)} px vs ${Math.round(follow2)} px)`);
  const bendAngle = (rev: number, spinX: number) => {
    const game = poolGameFor(rev);
    let s = game.init(POOL_BANK_V2[0]!);
    s = { ...s, balls: s.balls.map((b) => (b.id === POOL_CUE ? { ...b, x: fp((POOL_CL + POOL_CR) / 2), y: fp(POOL_CB - 200) } : { ...b, down: 1 })) };
    s = game.step(s, { t: s.tick + 1, k: 1, a: 4096, b: -1024, ...poolShot2(rev === 3 ? 304 : 380, spinX, 0) });
    // The direction the cue ball leaves the first cushion.
    let lastVx = 1;
    while (s.phase !== POOL_AIM && !s.over) {
      s = game.step(s, null);
      const c = s.balls.find((b) => b.id === POOL_CUE)!;
      if (c.vx < 0 && lastVx > 0) return (Math.atan2(c.vy, -c.vx) * 180) / Math.PI;
      lastVx = c.vx;
    }
    return 0;
  };
  const side2 = Math.abs(bendAngle(2, 100) - bendAngle(2, 0));
  const side3 = Math.abs(bendAngle(3, 100) - bendAngle(3, 0));
  ok(side3 > side2 * 1.5 && side3 > 12, `side spin turns the angle off a cushion much more on poolRev 3 (${side3.toFixed(1)}° vs ${side2.toFixed(1)}°)`);

  // The miss foul: a soft shot down the table touching no ball.
  const miss = (rev: number) => {
    const game = poolGameFor(rev);
    let s = game.init(rev === 3 ? POOL_BANK_V3[0]! : POOL_BANK_V2[0]!);
    s = game.step(s, { t: 1, k: 1, a: 0, b: 4096, ...poolShot2(40, 0, 0) });
    while (s.phase !== POOL_AIM && !s.over) s = game.step(s, null);
    return s;
  };
  const m3 = miss(3);
  const m2 = miss(2);
  ok(m3.firstHit === -1 && m3.fouls === 1 && m3.streak === 0, "poolRev 3: a shot whose cue ball touches no ball is a foul (−10)");
  ok(m2.firstHit === -1 && m2.fouls === 0, "poolRev 2: the same miss stays foul-free (stored rounds unchanged)");
  ok(poolGameFor(3).score({ ...m3, spotsDown: 2, acted: 1 }) === 30, "poolRev 3: two spots and a miss foul score 40 − 10 = 30");
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`FAIL: ${f}`);
  console.log(`FAIL: ${failures.length} of ${checks} pool checks`);
  process.exit(1);
}
console.log(`PASS: ${checks} pool checks`);
