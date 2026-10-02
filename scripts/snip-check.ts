/**
 * Snip checks: per template, a search over cut times (at the pin wobble's
 * extremes and centre) proves the mouth is reachable and finds the most stars;
 * then the self-replay proof for Snip only.
 *
 *   bun scripts/snip-check.ts [runs] [templateIndexOnly]
 */
import { inputAt, recordInput, rngBelow, type ArcadeInputEvent } from "@/lib/arcade/engine";
import { appendClientCounters, arcadeCounters } from "@/lib/arcade/diagnostics";
import {
  snipCheckpoint,
  snipGame,
  snipTestLevel,
  SNIP_CHECKPOINT_INTERVAL,
  SNIP_CONFIG,
  SNIP_INPUT_CUT,
  SNIP_LEVEL_TICKS,
  type SnipState,
} from "@/lib/arcade/snip";
import { encodeSnipRun, replaySnipRun } from "@/lib/duel/snip";

const RUNS = Number(process.argv[2] ?? 200);
const ONLY = process.argv[3];
let failures = 0;
const fail = (m: string) => {
  failures++;
  console.error("FAIL", m);
};

/** A short swipe across rope i, perpendicular to its first segment. */
export function cutFor(s: SnipState, i: number): ArcadeInputEvent {
  const r = s.ropes[i]!;
  const x = (r.x[0]! + r.x[1]!) / 512;
  const y = (r.y[0]! + r.y[1]!) / 512;
  const dx = (r.y[1]! - r.y[0]!) / 256;
  const dy = (r.x[0]! - r.x[1]!) / 256;
  const L = Math.max(1, Math.hypot(dx, dy));
  return {
    t: s.tick + 1,
    k: SNIP_INPUT_CUT,
    a: Math.round(x - (dx / L) * 15),
    b: Math.round(y - (dy / L) * 15),
    c: Math.round(x + (dx / L) * 15),
    d: Math.round(y + (dy / L) * 15),
  };
}

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
for (let t = 0; t < SNIP_CONFIG.templates.length; t++) {
  if (ONLY && String(t) !== ONLY) continue;
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
if (ONLY) process.exit(failures ? 1 : 0);

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
  let s = snipGame.init(seed);
  const log: ArcadeInputEvent[] = [];
  const cps: ReturnType<typeof snipCheckpoint>[] = [];
  const aimed = run % 2 === 0;
  while (!snipGame.isOver(s)) {
    let cand: ArcadeInputEvent | null = null;
    if (aimed) {
      const alive = s.ropes.map((x, i) => (x.alive ? i : -1)).filter((i) => i >= 0);
      if (alive.length && r(25) === 0) cand = cutFor(s, alive[r(alive.length)]!);
    } else if (r(5) === 0) {
      cand = { t: s.tick + 1, k: r(30) === 0 ? 4 : SNIP_INPUT_CUT, a: r(480) - 60, b: r(680) - 60, c: r(480) - 60, d: r(680) - 60 };
    }
    recordInput(log, cand, snipGame.inputRanges);
    s = snipGame.step(s, inputAt(log, s.tick + 1));
    if (s.tick % SNIP_CHECKPOINT_INTERVAL === 0) cps.push(snipCheckpoint(s));
  }
  bestScore = Math.max(bestScore, snipGame.score(s));
  maxLevels = Math.max(maxLevels, s.level);
  const raw = appendClientCounters(
    encodeSnipRun({ seed, claimedScore: snipGame.score(s), events: log, endTick: s.tick, checkpoints: cps }),
    arcadeCounters("snip", s, snipGame.score(s)),
  );
  const t0 = performance.now();
  const res = replaySnipRun(seed, raw);
  slow = Math.max(slow, performance.now() - t0);
  if (!same(res.state, s) || res.score !== snipGame.score(s) || res.flagged || res.inputDiag.clamped || res.inputDiag.dropped)
    fail(`snip run ${run} replay mismatch ${res.reason ?? ""} ${res.desyncTick}`);
}
console.log(`snip self-replay ${RUNS} runs; slowest replay ${slow.toFixed(1)}ms; best bot score ${bestScore}; most levels ${maxLevels}`);
console.log(failures ? `${failures} FAILURES` : "ALL OK");
process.exit(failures ? 1 : 0);
