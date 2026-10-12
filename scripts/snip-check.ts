/**
 * Snip checks: per template, a search over cut times (at the pin wobble's
 * extremes and centre) proves the mouth is reachable and finds the most stars;
 * then the self-replay proof for Snip only.
 *
 *   bun scripts/snip-check.ts [runs] [templateIndex | replay]
 */
import { inputAt, recordInput, rngBelow, type ArcadeInputEvent } from "@/lib/arcade/engine";
import { appendClientCounters, arcadeCounters } from "@/lib/arcade/diagnostics";
import {
  snipCheckpoint,
  snipGame,
  snipGameFor,
  snipLevelOrder,
  snipLevelOrderV3,
  snipTestLevel,
  SNIP_BANDS,
  SNIP_BANDS_V3,
  SNIP_REV3,
  SNIP_REV,
  SNIP_CHECKPOINT_INTERVAL,
  SNIP_CONFIG,
  SNIP_INPUT_CUT,
  SNIP_LEVEL_TICKS,
  type SnipState,
} from "@/lib/arcade/snip";
import { encodeSnipRun, replaySnipRun } from "@/lib/duel/snip";
import { cutFor } from "./snip-check-lib";

const RUNS = Number(process.argv[2] ?? 200);
const ONLY = process.argv[3];
let failures = 0;
const fail = (m: string) => {
  failures++;
  console.error("FAIL", m);
};

/** Plays one level with the given (rope, level tick) cuts. Stars if eaten, else -1. */
function playLevel(t: number, jit: number, plan: [number, number][]): number {
  let s = snipTestLevel(t, jit);
  const log: ArcadeInputEvent[] = [];
  for (let k = 0; k < SNIP_LEVEL_TICKS; k++) {
    const due = plan.find(([, at]) => at === s.levelTick + 1);
    if (due) recordInput(log, cutFor(s, due[0]), snipGame.inputRanges);
    const eatenBefore = s.eaten;
    const starsBefore = s.stars;
    const level = s.level;
    s = snipGame.step(s, inputAt(log, s.tick + 1));
    if (s.level !== level) return s.eaten > eatenBefore ? s.stars - starsBefore : -1;
  }
  return -1;
}

const SPAN = 240;
const PERMS: Record<number, number[][]> = {
  1: [[0]],
  2: [[0, 1], [1, 0]],
  3: [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]],
};
// The 30 snipRev-3 orchard templates (30–59) are proven by stored plans in arcade-batch4-check.
const BRUTE_FORCE_TEMPLATES = 30;
for (let t = 0; t < BRUTE_FORCE_TEMPLATES; t++) {
  if (ONLY === "replay" || (ONLY && String(t) !== ONLY)) continue;
  const tpl = SNIP_CONFIG.templates[t]!;
  const n = tpl.pins.length;
  const step = n === 1 ? 2 : n === 2 ? 5 : 12;
  const line: string[] = [];
  let worst = 99;
  let worstStars = 99;
  for (const jit of [-SNIP_CONFIG.pinJitter, 0, SNIP_CONFIG.pinJitter]) {
    let best = -1;
    let wins = 0;
    let tries = 0;
    for (const perm of PERMS[n]!) {
      const go = (k: number, from: number, plan: [number, number][]) => {
        if (k === n) {
          tries++;
          const r = playLevel(t, jit, plan);
          if (r >= 0) {
            wins++;
            best = Math.max(best, r);
          }
          return;
        }
        for (let at = from; at <= SPAN; at += step) go(k + 1, at + 1, [...plan, [perm[k]!, at]]);
      };
      go(0, 1, []);
    }
    worst = Math.min(worst, wins);
    worstStars = Math.min(worstStars, best);
    line.push(`wobble ${jit}: ${wins}/${tries} win, best ${best}/${tpl.stars.length}★`);
  }
  if (worst <= 0) fail(`template ${t} ${tpl.name} unsolvable at some wobble`);
  if (worstStars < tpl.stars.length) console.log(`  note: ${tpl.name} not every star proven reachable`);
  console.log(`${t} ${tpl.name}: ${line.join(" · ")}`);
}
if (ONLY && ONLY !== "replay") process.exit(failures ? 1 : 0);

/* ------------------------------ Bands ------------------------------ */
{
  const all = [...SNIP_BANDS.easy, ...SNIP_BANDS.medium, ...SNIP_BANDS.hard].sort((a, b) => a - b);
  if (all.join() !== Array.from({ length: BRUTE_FORCE_TEMPLATES }, (_, i) => i).join()) fail("rev-2 bands must cover the first 30 templates exactly once");
  const all3 = [...SNIP_BANDS_V3.easy, ...SNIP_BANDS_V3.medium, ...SNIP_BANDS_V3.hard].sort((a, b) => a - b);
  if (all3.join() !== Array.from({ length: SNIP_CONFIG.templates.length }, (_, i) => i).join()) fail("rev-3 bands must cover every template exactly once");
  for (let seed = 1; seed < 2000; seed += 7) {
    const o = snipLevelOrderV3(seed);
    const okBand = (i: number, band: readonly number[]) => band.includes(o[i]!);
    if (new Set(o).size !== 10 || ![0, 1, 2].every((i) => okBand(i, SNIP_BANDS_V3.easy)) || ![3, 4, 5, 6].every((i) => okBand(i, SNIP_BANDS_V3.medium)) || ![7, 8, 9].every((i) => okBand(i, SNIP_BANDS_V3.hard)))
      fail(`rev-3 seed ${seed} order ${o}`);
  }
  for (let seed = 1; seed < 2000; seed += 7) {
    const o = snipLevelOrder(seed);
    const okBand = (i: number, band: readonly number[]) => band.includes(o[i]!);
    if (new Set(o).size !== 10 || ![0, 1, 2].every((i) => okBand(i, SNIP_BANDS.easy)) || ![3, 4, 5, 6].every((i) => okBand(i, SNIP_BANDS.medium)) || ![7, 8, 9].every((i) => okBand(i, SNIP_BANDS.hard)))
      fail(`seed ${seed} order ${o}`);
    if (snipLevelOrder(seed).join() !== o.join()) fail("order not repeatable");
  }
  if (snipGame.init(5).order.join() !== "0,1,2,3,4,5,6,7,8,9") fail("legacy order changed");
  console.log("bands: every seed draws 3 easy + 4 medium + 3 hard distinct templates; legacy order intact");
}

/* ------------------------------ Self-replay ------------------------------ */
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
let slow = 0;
let bestScore = 0;
let maxLevels = 0;
for (let run = 0; run < RUNS; run++) {
  const seed = (run * 2246822519 + 3) | 0;
  let rng = seed ^ 0x2545f491;
  const r = (k: number) => {
    const x = rngBelow(rng, k);
    rng = x.state;
    return x.value;
  };
  const rev = run % 6 < 2 ? SNIP_REV3 : run % 6 < 4 ? SNIP_REV : undefined;
  const game = snipGameFor(rev);
  let s = game.init(seed);
  const log: ArcadeInputEvent[] = [];
  const cps: ReturnType<typeof snipCheckpoint>[] = [];
  const aimed = run % 2 === 0;
  while (!game.isOver(s)) {
    let cand: ArcadeInputEvent | null = null;
    if (aimed) {
      const alive = s.ropes.map((x, i) => (x.alive ? i : -1)).filter((i) => i >= 0);
      if (alive.length && r(25) === 0) cand = cutFor(s, alive[r(alive.length)]!);
    } else if (r(5) === 0) {
      cand = { t: s.tick + 1, k: r(30) === 0 ? 4 : SNIP_INPUT_CUT, a: r(480) - 60, b: r(680) - 60, c: r(480) - 60, d: r(680) - 60 };
    }
    recordInput(log, cand, game.inputRanges);
    s = game.step(s, inputAt(log, s.tick + 1));
    if (s.tick % SNIP_CHECKPOINT_INTERVAL === 0) cps.push(snipCheckpoint(s));
  }
  bestScore = Math.max(bestScore, game.score(s));
  maxLevels = Math.max(maxLevels, s.level);
  const raw = appendClientCounters(
    encodeSnipRun({ seed, claimedScore: game.score(s), events: log, endTick: s.tick, checkpoints: cps }),
    arcadeCounters("snip", s, game.score(s)),
  );
  const t0 = performance.now();
  const res = replaySnipRun(seed, raw, rev);
  slow = Math.max(slow, performance.now() - t0);
  if (!same(res.state, s) || res.score !== game.score(s) || res.flagged || res.inputDiag.clamped || res.inputDiag.dropped)
    fail(`snip run ${run} replay mismatch ${res.reason ?? ""} ${res.desyncTick}`);
}
console.log(`snip self-replay ${RUNS} runs; slowest replay ${slow.toFixed(1)}ms; best bot score ${bestScore}; most levels ${maxLevels}`);
console.log(failures ? `${failures} FAILURES` : "ALL OK");
process.exit(failures ? 1 : 0);
