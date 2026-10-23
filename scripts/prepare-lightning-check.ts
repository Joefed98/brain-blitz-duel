/**
 * Prepare to Duel lightning (Prompt Q, 23 Oct 2026; display only): src/lib/fx/prepareLightning.ts
 * and PrepareLightning.tsx. Proves, over 2,000 random plans:
 *  - strikes are at least 550 ms apart, so no second holds more than 2, and no second holds
 *    more than 3 flashes counting the moment's own gold flash (WCAG 2.3.1);
 *  - each strike fades to nothing in under 300 ms and the last one has faded 700 ms before the
 *    gold flash; all inside the 6 s screen;
 *  - the brightening is a dim gold glow (peak alpha ≤ 0.2), never a white full-screen fill;
 *  - bolts branch (2+ lines) and stay across the screen's width;
 * and, from the source: nothing is drawn under prefers-reduced-motion, the canvas never takes
 * taps and stops above the home-bar strip, and the screen's timing file is untouched by it.
 *
 *   bun scripts/prepare-lightning-check.ts
 */
import { readFileSync } from "node:fs";

import { DUEL_START_MS } from "../src/lib/duel/startPresentation";
import { PREPARE_FLASH_MS } from "../src/lib/fx/roomMoments";
import {
  LIGHTNING_BOLTS,
  LIGHTNING_FADE_MS,
  LIGHTNING_GLOW_ALPHA,
  LIGHTNING_MIN_GAP_MS,
  buildBolt,
  liveStrike,
  planStrikes,
  strikeStrength,
} from "../src/lib/fx/prepareLightning";

let failures = 0;
const ok = (cond: unknown, msg: string) => {
  if (cond) return;
  failures++;
  console.log(`FAIL ${msg}`);
};

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}

ok(LIGHTNING_FADE_MS < 300, `a strike fades in under 300 ms (${LIGHTNING_FADE_MS})`);
ok(LIGHTNING_MIN_GAP_MS > 500, `strikes over 500 ms apart (${LIGHTNING_MIN_GAP_MS})`);
ok(LIGHTNING_GLOW_ALPHA <= 0.2, `brightening peak alpha ≤ 0.2 (${LIGHTNING_GLOW_ALPHA})`);
ok(LIGHTNING_BOLTS >= 2 && LIGHTNING_BOLTS <= 3, "two or three bolt shapes");
for (let t = LIGHTNING_FADE_MS; t < LIGHTNING_FADE_MS + 100; t++)
  ok(strikeStrength(t) === 0, `strength 0 at ${t} ms`);
ok(strikeStrength(-1) === 0 && strikeStrength(0) === 1, "strength 1 on landing, 0 before");

let strikes = 0;
let maxPerSecond = 0;
let maxFlashesPerSecond = 0;
for (let seed = 1; seed <= 2_000; seed++) {
  const plan = planStrikes(lcg(seed));
  strikes += plan.length;
  ok(plan.length >= 3, `seed ${seed}: at least 3 strikes (${plan.length})`);
  for (let i = 0; i < plan.length; i++) {
    const s = plan[i]!;
    ok(Number.isInteger(s.atMs) && s.atMs >= 0, `seed ${seed}: whole-ms start`);
    ok(s.bolt >= 0 && s.bolt < LIGHTNING_BOLTS, `seed ${seed}: bolt index`);
    ok(s.atMs + LIGHTNING_FADE_MS <= PREPARE_FLASH_MS - 700, `seed ${seed}: faded before the gold flash`);
    ok(s.atMs + LIGHTNING_FADE_MS <= DUEL_START_MS, `seed ${seed}: inside the screen`);
    if (i) {
      ok(s.atMs - plan[i - 1]!.atMs >= LIGHTNING_MIN_GAP_MS, `seed ${seed}: gap ≥ ${LIGHTNING_MIN_GAP_MS} ms`);
      ok(s.bolt !== plan[i - 1]!.bolt, `seed ${seed}: never the same bolt twice running`);
    }
  }
  // Every one-second window (1 ms steps): strikes, and strikes plus the gold flash.
  const flashes = [...plan.map((s) => s.atMs), PREPARE_FLASH_MS];
  for (let from = -1_000; from <= DUEL_START_MS; from += 1) {
    const inWindow = (t: number) => t >= from && t < from + 1_000;
    const n = plan.filter((s) => inWindow(s.atMs)).length;
    const f = flashes.filter(inWindow).length;
    if (n > maxPerSecond) maxPerSecond = n;
    if (f > maxFlashesPerSecond) maxFlashesPerSecond = f;
    if (seed > 50) from += 49; // a coarser sweep past the first 50 seeds keeps it quick
  }
  // liveStrike agrees with the plan.
  for (const s of plan) {
    ok(liveStrike(plan, s.atMs) === s, `seed ${seed}: live on landing`);
    ok(liveStrike(plan, s.atMs + LIGHTNING_FADE_MS) === null, `seed ${seed}: gone after the fade`);
  }
}
ok(maxPerSecond <= 2, `at most 2 strikes in any second (${maxPerSecond})`);
ok(maxFlashesPerSecond <= 2, `at most 2 flashes in any second with the gold flash (${maxFlashesPerSecond})`);

for (const [w, h] of [
  [414, 846],
  [375, 617],
  [1366, 718],
]) {
  for (let seed = 1; seed <= 200; seed++) {
    for (let i = 0; i < LIGHTNING_BOLTS; i++) {
      const bolt = buildBolt(lcg(seed * 7 + i), w, h, i);
      ok(bolt.lines.length >= 3, `${w}×${h} seed ${seed}: bolt ${i} branches`);
      ok(bolt.lines.every((l) => l.width <= 2), `${w}×${h}: thin lines`);
      const xs = bolt.lines.flatMap((l) => l.points.map((p) => p[0]));
      const ys = bolt.lines.flatMap((l) => l.points.map((p) => p[1]));
      ok(Math.min(...xs) > -w * 0.4 && Math.max(...xs) < w * 1.4, `${w}×${h}: bolt ${i} near the screen`);
      ok(Math.max(...ys) < h * 1.4, `${w}×${h}: bolt ${i} ends near the screen`);
    }
  }
}

const component = readFileSync("src/components/duel/PrepareLightning.tsx", "utf8");
const screen = readFileSync("src/components/duel/DuelStart.tsx", "utf8");
const css = readFileSync("src/styles.css", "utf8");
ok(/prefers-reduced-motion: reduce/.test(component) && /if \(still\) return null/.test(component), "nothing drawn under reduced motion");
ok(/new ResizeObserver\(build\)/.test(component), "bolts built once per size");
const rule = css.slice(css.indexOf(".duel-start-screen > .prepare-lightning"));
ok(/pointer-events: none/.test(rule.slice(0, 600)), "the canvas never takes taps");
ok(/safe-area-inset-bottom, 0px\) \+ 16px\)/.test(rule.slice(0, 600)), "the canvas stops above the home-bar strip");
ok(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.duel-start-logo \{ filter: drop-shadow/.test(css), "reduced motion: a static glow round the logo");
ok(/<PrepareLightning startedAt=\{startedAt\} \/>/.test(screen), "DuelStart mounts the lightning");
ok(!/prepareLightning|PrepareLightning/.test(readFileSync("src/lib/duel/startPresentation.ts", "utf8")), "screen timing untouched");

console.log(`${strikes} strikes over 2,000 plans; max ${maxPerSecond} a second, ${maxFlashesPerSecond} with the gold flash.`);
if (failures) {
  console.log(`FAIL: ${failures} problem(s)`);
  process.exit(1);
}
console.log("PASS: Prepare to Duel lightning: ≤ 2 strikes a second, < 300 ms fades, dim brightening, clear of the gold flash, none with reduced motion.");
