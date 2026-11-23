/**
 * D6's Normal scoring stamps (the polish plan's section 8.2, Joe's approval of 20 Nov 2026), proved on the stamps rooms
 * deal now; every older stamp is d6-legacy-check's (the rounds dealt before regrade exactly):
 *
 *   Five Hands fiveHandsRev 4 (I2): rev 3's game, deck, table and bonus column; 200 at 128 hand points (was × 1.4, 143).
 *   Cue Ball poolRev 5 (I7): poolRev 4's game; Speed from the fifth of your seven, full by 60 s; the bank re-proved at a
 *     person's pace (scripts/pool-bank.ts --rev=5: each witness shot 0.4 s after the balls stop).
 *   Tilt tiltRev 13 (I8): Normal plays tiltRev 12's first three mazes, the parts over three, speed full by 55 s; its deal
 *     re-proved by the oracle held to human limits (scripts/tilt-deal-v13.ts).
 *
 * Each stamp's era pin (fivehandsPre128, poolPreFifth, tiltPreThree) deals the stamp before it.
 *
 *   bun scripts/d6-normal-stamps-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";

import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { setDealPin } from "../src/lib/duel/dealEra";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { FH_CORE_FULL_V4, FH_REV, FH_REV_128, fhCoreFullFor, fhTotalV3, fiveHandsGameFor, fiveHandsStdParts, fhDeal, fhScoreV4 } from "../src/lib/arcade/cards/fiveHands";
import { poolFullByS, poolGameFor, poolRunTicksFor, poolStdParts, POOL_FULL_BY_S_V5, POOL_REV, POOL_V5_SPEED_AT, type PoolState } from "../src/lib/arcade/pool";
import { decodePoolRun, replayPoolRun } from "../src/lib/duel/pool";
import { POOL_BANK_V3 } from "../src/lib/duel/poolBankV3.server";
import { tiltGameFor, tiltMazesB, tiltMazesT, tiltParParts, TILT_P_CLEAN_POINTS, TILT_P_CORE_MAX, TILT_P_PAR_MAX, TILT_P_SPEED_POINTS, TILT_REV_BIG, TILT_REV_THREE, TILT_T_MAZES, TILT_T_SPEED_FULL_S, type TiltState } from "../src/lib/arcade/tilt";
import { replayTiltRun } from "../src/lib/duel/tilt";
import { TILT_DEAL_V12 } from "../src/lib/duel/tiltDealV12.server";
import { TILT_DEAL_V13 } from "../src/lib/duel/tiltDealV13.server";
import { POOL_HUMAN_WAIT } from "./pool-bank";
import { playDealt } from "./d6-ladder-lib";

console.error = () => {};
let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
const deal = (type: string, n: number) => withSeededRandom(1000 + n, () => generatePuzzle(type as never, { bankSeed: 1000 + n })) as any;
const pinned = <T>(pin: Parameters<typeof setDealPin>[0], fn: () => T): T => {
  const was = setDealPin(pin, true);
  try {
    return fn();
  } finally {
    setDealPin(pin, was);
  }
};

console.log("1. Five Hands fiveHandsRev 4: 200 at 128 hand points");
{
  ok(FH_REV === 4 && FH_REV_128 === 4 && FH_CORE_FULL_V4 === 128 && fhCoreFullFor(4) === 128 && fhCoreFullFor(3) === 143, "fivehands: rooms deal fiveHandsRev 4, full at 128 (rev 3 keeps 143)");
  for (let n = 0; n < 8; n++) ok(deal("fivehands", n).fiveHandsRev === 4, `fivehands: Normal deal ${n} is fiveHandsRev 4`);
  ok(pinned("fivehandsPre128", () => deal("fivehands", 0).fiveHandsRev) === 3, "fivehands: the era pin fivehandsPre128 deals fiveHandsRev 3");
  ok(LIVE_BANDS.fivehands.rev === 4 && LIVE_BANDS.fivehands.std?.rev === 4, "fivehands: LIVE_BANDS lists fiveHandsRev 4 with its spec");
  const g3 = fiveHandsGameFor(3);
  const g4 = fiveHandsGameFor(4);
  for (const seed of [0, 9, 77, 4242]) ok(JSON.stringify({ ...g4.init(seed), rev: 3 }) === JSON.stringify(g3.init(seed)) && fhDeal(seed, 4).deck.join() === fhDeal(seed, 3).deck.join(), `fivehands: seed ${seed}'s rev 4 opening is rev 3's exactly (deck and state)`);
  const line = (t: number) => Math.min(200, Math.floor((t * 200) / 128));
  let straight = true;
  for (let t = 0; t <= 260; t++) if (fhScoreV4(t) !== line(t)) straight = false;
  ok(straight && fhScoreV4(64) === 100 && fhScoreV4(127) === 198 && fhScoreV4(128) === 200, "fivehands: rev 4's points are floor(hand points × 200 ÷ 128), capped at 200 (64 → 100, 127 → 198, 128 → 200)");
  // Whole runs: the elite under HUMAN_LIMITS on real rev 4 deals, graded by the server, scored by the rev 4 line.
  for (let n = 0; n < 6; n++) {
    const p = deal("fivehands", n);
    const r = await playDealt("fivehands", p, "elite");
    const s = r.state;
    const parts = fiveHandsStdParts(s)!;
    const total = fhTotalV3(s);
    ok(s.rev === 4 && parts.length === 1 && parts[0]!.points === fhScoreV4(total) && r.score === Math.max(1, parts[0]!.points), `fivehands: deal ${n}'s elite run scores floor(${total} × 200 ÷ 128) through the server (${r.score})`);
  }
}

console.log("2. Cue Ball poolRev 5: Speed from the fifth pot");
{
  ok(POOL_REV === 5 && poolFullByS(5) === 60 && POOL_FULL_BY_S_V5 === 60 && POOL_V5_SPEED_AT === 5 && poolFullByS(4) === 69, "pool: rooms deal poolRev 5, Speed full by 60 s at the fifth pot (poolRev 4 keeps 69 s on the black)");
  for (let n = 0; n < 8; n++) {
    const p = deal("pool", n);
    ok(p.poolRev === 5 && POOL_BANK_V3.includes(p.seed), `pool: Normal deal ${n} is poolRev 5 from the poolRev 3 bank`);
  }
  ok(pinned("poolPreFifth", () => deal("pool", 0).poolRev) === 4, "pool: the era pin poolPreFifth deals poolRev 4");
  const g = poolGameFor(5);
  const seed = POOL_BANK_V3[0]!;
  const final = (over: Partial<PoolState>): PoolState => ({ ...g.init(seed), acted: 1, over: 1, ...over });
  const part = (s: PoolState, key: string) => poolStdParts(s)!.find((x) => x.key === key)!.points;
  ok(g.init(seed).fifthAt === 0 && poolGameFor(4).init(seed).fifthAt === undefined, "pool: only poolRev 5 states carry the fifth pot's clock");
  ok(part(final({ spotsDown: 5, fifthAt: 3600 }), "speed") === 20 && part(final({ spotsDown: 5, fifthAt: 3601 }), "speed") < 20 && part(final({ spotsDown: 5, fifthAt: poolRunTicksFor(5) }), "speed") === 0, "pool: the fifth by 60 s → 20, a tick later under 20, at the buzzer 0");
  ok(part(final({ spotsDown: 4 }), "speed") === 0 && part(final({ spotsDown: 6, fifthAt: 900, black: 2 }), "speed") === 0, "pool: no speed with four down, nor after the black too soon");
  ok(part(final({ spotsDown: 7, fifthAt: 900 }), "black") === 0 && part(final({ spotsDown: 7, fifthAt: 900, black: 1, finishAt: 2000 }), "black") === 10, "pool: the black 10 only after all seven, as poolRev 4");
  ok(part(final({ spotsDown: 5, fifthAt: 900 }), "core") === 140 && part(final({ spotsDown: 4 }), "core") === 112, "pool: the core as poolRev 4 (28 a ball, full at five)");
  const witnessV5 = JSON.parse(readFileSync(new URL("./fixtures/pool-witness-v5.json", import.meta.url), "utf8")) as Record<string, string>;
  let at200 = 0;
  let paced = 0;
  for (const s of POOL_BANK_V3) {
    const raw = witnessV5[String(s)] ?? "";
    const run = replayPoolRun(s, raw, 5);
    if (run.score === 200 && !run.flagged && run.fouls === 0) at200++;
    // The pace: each shot at least POOL_HUMAN_WAIT ticks after the one before settled (replayed shot by shot).
    const events = decodePoolRun(raw).events;
    let st = g.init(s);
    let stillSince = -1;
    let good = true;
    let k = 0;
    const by = new Map(events.map((e) => [e.t, e]));
    while (!g.isOver(st)) {
      const t = st.tick + 1;
      if (st.phase === 0 && stillSince < 0) stillSince = st.tick;
      const e = by.get(t) ?? null;
      if (e) {
        if (t - stillSince <= POOL_HUMAN_WAIT) good = false;
        stillSince = -1;
        k++;
      }
      st = g.step(st, e);
    }
    if (good && k === events.length) paced++;
  }
  ok(at200 === POOL_BANK_V3.length, `pool: every bank layout's poolRev 5 witness scores 200 with no foul through the server replay (${at200} of ${POOL_BANK_V3.length})`);
  ok(paced === POOL_BANK_V3.length, `pool: every witness shot comes more than ${POOL_HUMAN_WAIT} ticks (0.4 s) after the balls stopped (${paced} of ${POOL_BANK_V3.length})`);
  const rebuilt = spawnSync(process.execPath, [new URL("./pool-bank.ts", import.meta.url).pathname, "--rev=5", "--check"], { encoding: "utf8" });
  ok(rebuilt.status === 0, `pool: pool-bank.ts --rev=5 --check rebuilds the witnesses byte for byte (${(rebuilt.stdout ?? "").trim().split("\n").pop()})`);
}

console.log("3. Tilt tiltRev 13: Normal deals three mazes");
{
  ok(TILT_REV_THREE === 13 && TILT_T_MAZES === 3 && TILT_T_SPEED_FULL_S === 55 && LIVE_BANDS.tilt.rev === 13, "tilt: rooms deal tiltRev 13 (three mazes, speed full by 55 s); LIVE_BANDS lists it");
  for (let n = 0; n < 8; n++) {
    const p = deal("tilt", n);
    ok(p.tiltRev === 13 && TILT_DEAL_V13.includes(p.seed) && !("level" in p), `tilt: Normal deal ${n} is tiltRev 13 from TILT_DEAL_V13`);
  }
  const old = pinned("tiltPreThree", () => deal("tilt", 0));
  ok(old.tiltRev === TILT_REV_BIG && TILT_DEAL_V12.includes(old.seed), "tilt: the era pin tiltPreThree deals tiltRev 12 from TILT_DEAL_V12");
  ok(TILT_DEAL_V13.every((s) => TILT_DEAL_V12.includes(s)) && TILT_DEAL_V13.length >= 300, `tilt: the tiltRev 13 deal is ${TILT_DEAL_V13.length} of tiltRev 12's proved seeds`);
  for (const s of TILT_DEAL_V13.slice(0, 6)) {
    const three = tiltMazesT(s);
    const four = tiltMazesB(s);
    ok(three.length === 3 && JSON.stringify(three) === JSON.stringify(four.slice(0, 3)), `tilt: seed ${s}'s three mazes are tiltRev 12's first three exactly`);
  }
  const g = tiltGameFor(13);
  const s0 = g.init(TILT_DEAL_V13[0]!);
  ok(s0.three === 1 && s0.list.length === 3 && tiltGameFor(12).init(TILT_DEAL_V13[0]!).three === undefined, "tilt: only tiltRev 13 states carry three: 1 and three mazes");
  const done = (over: Partial<TiltState>): TiltState => ({ ...s0, acted: 1, ...over });
  const all = tiltParParts(done({ mazes: 3, parsMet: 3, endedTick: 55 * 60, ended: 1 }));
  ok(all.core === TILT_P_CORE_MAX && all.par === TILT_P_PAR_MAX && all.clean === TILT_P_CLEAN_POINTS && all.speed === TILT_P_SPEED_POINTS, "tilt: three mazes within par, no fall, done by 55 s fill every part (140 + 24 + 12 + 24)");
  const late = tiltParParts(done({ mazes: 3, parsMet: 3, endedTick: 55 * 60 + 60, ended: 1 }));
  ok(late.speed < TILT_P_SPEED_POINTS, "tilt: a second past 55 s is under the full speed part");
  const two = tiltParParts(done({ mazes: 2, parsMet: 2 }));
  ok(two.par === 16 && two.clean === 8 && two.speed === 0 && two.core === Math.trunc((140 * 2) / 3), `tilt: two of three mazes pay two thirds of core, par and clean, no speed (${two.core}/${two.par}/${two.clean}/${two.speed})`);
  // The deal's witnesses: every one replays to 200 with every part full, held to human limits (the builder's --check).
  const w = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/tilt-deal-v13-witness.json.gz", import.meta.url))).toString()) as { witnesses: { seed: number; raw: string }[] };
  ok(w.witnesses.length === TILT_DEAL_V13.length && JSON.stringify(w.witnesses.map((x) => x.seed)) === JSON.stringify(TILT_DEAL_V13), "tilt: the deal is exactly its witnessed seeds");
  for (const x of w.witnesses.slice(0, 12)) {
    const r = replayTiltRun(x.seed, x.raw, 13);
    ok(r.score === 200 && !r.flagged, `tilt: seed ${x.seed}'s witness replays to 200 (${r.score})`);
  }
  const rebuilt = spawnSync(process.execPath, [new URL("./tilt-deal-v13.ts", import.meta.url).pathname, "--check"], { encoding: "utf8" });
  ok(rebuilt.status === 0, `tilt: tilt-deal-v13.ts --check (${(rebuilt.stdout ?? "").trim().split("\n").pop()})`);
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  console.log(`FAIL d6-normal-stamps-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS d6-normal-stamps-check: ${checks} checks`);
