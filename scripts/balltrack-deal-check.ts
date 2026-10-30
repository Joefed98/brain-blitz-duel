/**
 * Ball Tracker btRev 8's deal list (30 Oct 2026, docs/arcade-standard/balltrack.md "The deal"): rooms on btRev 8 deal
 * only the bank courses that can reach 200, so every dealt seed can.
 *  1. BT_V8_DEAL is the 300-course bank (ballTrackBankV7.server.ts) less BT_V8_EXCLUDED, in bank order, no repeats;
 *     btV8DealIndex maps any seed onto it (seed mod 300 as btRev 7, an excluded course moved to the next listed one).
 *  2. The generator never deals an excluded course: Math.random swept over every slot of the list (and 2,000 seeded
 *     draws) always gives a listed course, its stored course identical to the bank's and its seed the bank index + 1,
 *     on btRev 8; every listed course is dealt by some draw.
 *  3. Every course btRev 8 can deal reaches 200 with the boosted oracle (scripts/arcade-standard/balltrack.ts) through the
 *     server's encode + replay, unflagged: all of them at full depth (CHECKS_FULL=1 or --full, ~10 min), an evenly
 *     spread sample of 24 at quick depth.
 *
 * --part=k/n runs every n-th course of step 3 from the k-th (steps 1 and 2 run in every part; CI runs it in halves).
 *
 *   bun scripts/balltrack-deal-check.ts [--full] [--part=k/n]
 */
import { BT_REV_STD } from "../src/lib/arcade/ballTrack";
import { generateBallTrack } from "../src/lib/duel/ballTrack.server";
import { BALL_TRACK_BANK_V7 } from "../src/lib/duel/ballTrackBankV7.server";
import { btV8DealIndex, BT_V8_DEAL, BT_V8_EXCLUDED } from "../src/lib/duel/ballTrackDealV8.server";
import { boostedOracle, replayedBtStd } from "./arcade-standard/balltrack";

const FULL = process.env.CHECKS_FULL === "1" || process.argv.includes("--full");
const PART = process.argv.find((a) => a.startsWith("--part="))?.slice(7);
const [PART_K, PART_N] = PART ? PART.split("/").map(Number) as [number, number] : [1, 1];
if (!(PART_N >= 1 && PART_K >= 1 && PART_K <= PART_N)) throw new Error(`bad --part=${PART}`);
let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
const t0 = Date.now();

/* 1. The list. */
const excluded = new Set(BT_V8_EXCLUDED);
ok(BALL_TRACK_BANK_V7.length === 300, `the btRev 7/8 bank holds 300 courses (${BALL_TRACK_BANK_V7.length})`);
ok(excluded.size === BT_V8_EXCLUDED.length && BT_V8_EXCLUDED.every((i) => Number.isInteger(i) && i >= 0 && i < 300), "the excluded courses are distinct bank indices");
const expected = BALL_TRACK_BANK_V7.map((_, i) => i).filter((i) => !excluded.has(i));
ok(JSON.stringify(BT_V8_DEAL) === JSON.stringify(expected), `the deal list is the bank less the ${excluded.size} excluded courses, in bank order (${BT_V8_DEAL.length})`);
for (const i of BT_V8_DEAL) ok(!excluded.has(i), `the deal list holds no excluded course (${i})`);
for (let seed = 0; seed < 5000; seed++) {
  const i = btV8DealIndex(seed);
  if (excluded.has(i) || !BT_V8_DEAL.includes(i)) ok(false, `btV8DealIndex(${seed}) = ${i} is on the deal list`);
}
for (let seed = 0; seed < 600; seed++) {
  const i = seed % 300;
  const want = excluded.has(i) ? (BT_V8_DEAL.find((d) => d > i) ?? BT_V8_DEAL[0]) : i;
  if (btV8DealIndex(seed) !== want) ok(false, `btV8DealIndex(${seed}) is bank course ${want} (seed mod 300, or the next listed course)`);
}
ok(true, "btV8DealIndex keeps btRev 7's seed → course mapping but for the excluded courses");

/* 2. The generator. */
const random = Math.random;
const dealt = new Set<number>();
function draw(r: number): void {
  Math.random = () => r;
  try {
    const p = generateBallTrack();
    const index = p.seed - 1;
    ok(p.btRev === BT_REV_STD, `a draw deals btRev ${BT_REV_STD} (${p.btRev})`);
    ok(!excluded.has(index) && BT_V8_DEAL.includes(index), `draw ${r} deals a listed course (bank ${index})`);
    ok(JSON.stringify(p.course) === JSON.stringify(BALL_TRACK_BANK_V7[index]?.course), `draw ${r}: the stored course is bank course ${index}`);
    dealt.add(index);
  } finally {
    Math.random = random;
  }
}
const n = BT_V8_DEAL.length;
for (let k = 0; k < n; k++) for (const f of [0, 0.5, 0.999999]) draw((k + f) / n);
let x = 0x2545f491;
for (let k = 0; k < 2000; k++) {
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  draw((x >>> 0) / 2 ** 32);
}
draw(0);
draw(1 - 2 ** -53);
ok(dealt.size === n, `every listed course is dealt by some draw (${dealt.size} of ${n})`);

/* 3. Every dealt course reaches 200 (all at full depth, a spread sample at quick). */
const sample = (FULL ? BT_V8_DEAL : Array.from({ length: 24 }, (_, k) => BT_V8_DEAL[Math.floor((k * n) / 24)]!)).filter((_, k) => k % PART_N === PART_K - 1);
let reached = 0;
for (const i of sample) {
  const course = BALL_TRACK_BANK_V7[i]!.course;
  const r = replayedBtStd(course, i + 1, boostedOracle(course));
  ok(r.score === 200 && !r.flagged, `bank course ${i}: the boosted oracle scores 200 through the server replay (${r.score}: ${r.state.home} home, ${r.state.golds} gold, ${r.state.combos} combos, ${r.state.boosts} boosted${r.flagged ? ", flagged" : ""})`);
  if (r.score === 200) reached++;
}

const secs = ((Date.now() - t0) / 1000).toFixed(1);
if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  console.log(`FAIL: ${failures.length} of ${checks} Ball Tracker deal checks (${secs} s)`);
  process.exit(1);
}
console.log(
  `PASS: ${checks} Ball Tracker deal checks — btRev ${BT_REV_STD} deals ${n} of 300 bank courses (excluded ${BT_V8_EXCLUDED.join(", ")}); ${dealt.size} dealt by the swept draws, none excluded; the oracle reaches 200 through the server replay on ${reached} of ${sample.length} ${FULL ? "(every dealt course, full depth)" : "(a spread sample; --full or CHECKS_FULL=1 for all)"}${PART ? `, part ${PART}` : ""} (${secs} s)`,
);
