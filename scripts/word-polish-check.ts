/**
 * Word polish (13 Oct 2026): presentation-only guards for the ten word games.
 *  - every sound cue the word games dispatch is documented in docs/sound-cues/word.md, and vice versa;
 *  - completion effects never run past 1.2 s (delays included) and fall back to one still glow with reduced motion;
 *  - Letterfall's end-of-run shimmer is earned only at the end of a run worth 120+, and only the live stage starts it;
 *  - boards that moved reject coordinate demos recorded before the move;
 *  - reveals keep their score lines (the text the reveal prints is unchanged).
 * Source and module level only: no browser (scripts/shots/capture.ts measures layouts in Chromium).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { WORD_FINISH_MAX_MS, playFinish, goldFlip, goldPulse } from "../src/components/puzzles/wordFinish";
import { WORD_BATCH_DEMOS, WORD_BATCH_PRESENTATION, WORD_POLISH_DEMOS, WORD_POLISH_PRESENTATION, puzzleInputDemoCompatible, puzzlePresentation } from "../src/components/puzzles/wordInput";
import { wordfallGame, WF_PAR, WF_RUN_TICKS, type WordfallState } from "../src/lib/arcade/wordfall";
import { wordfallEarnsShimmer } from "../src/lib/arcade/wordfall.renderer";

let checks = 0;
const ok = (cond: unknown, message: string) => {
  assert.ok(cond, message);
  checks++;
};

// 1. Cues: source ↔ doc.
const FILES = [
  "src/components/puzzles/WordsmithPuzzle.tsx",
  "src/components/puzzles/WordHuntPuzzle.tsx",
  "src/puzzles/tileGrid.tsx",
  "src/puzzles/wordSlide.tsx",
  "src/puzzles/wordSearch.tsx",
  "src/puzzles/letterWheel.tsx",
  "src/puzzles/strikeout.tsx",
  "src/puzzles/codeword.tsx",
  "src/puzzles/swapword.tsx",
  "src/puzzles/wordfall.tsx",
];
const used = new Set<string>();
for (const file of FILES) {
  const src = readFileSync(file, "utf8");
  const cues = [...src.matchAll(/wordCue\("([a-z]+\.[a-z]+)"\)/g)].map((m) => m[1]!);
  ok(cues.length > 0, `${file}: dispatches a completion cue`);
  cues.forEach((cue) => used.add(cue));
}
const doc = readFileSync("docs/sound-cues/word.md", "utf8");
const documented = new Set([...doc.matchAll(/^\| `([a-z]+\.[a-z]+)` \|/gm)].map((m) => m[1]!));
for (const cue of used) ok(documented.has(cue), `${cue} is listed in docs/sound-cues/word.md`);
for (const cue of documented) ok(used.has(cue), `${cue} in the doc is dispatched somewhere`);
ok(used.size === 10, `one completion cue per word game (got ${used.size})`);
const finishSrc = readFileSync("src/components/puzzles/wordFinish.ts", "utf8");
ok(/from "@\/lib\/fx\/soundCues"/.test(finishSrc) && /if \(demoHushed\(\)\) return;\s*dispatchSoundCue\(cue\)/.test(finishSrc), "cues go through the shared soundCue helper, silent in hushed intro demos");
ok(!/new CustomEvent\("duelz-sound"/.test(FILES.map((f) => readFileSync(f, "utf8")).join("\n")), "no game dispatches duelz-sound by hand");

// 2. Effects: clamped to 1.2 s; reduced motion is a still glow.
class FakeEl {
  calls: { keyframes: Keyframe[]; options: KeyframeAnimationOptions }[] = [];
  animate(keyframes: Keyframe[], options: KeyframeAnimationOptions) {
    this.calls.push({ keyframes, options });
    return { cancel() {} } as unknown as Animation;
  }
}
const g = globalThis as Record<string, unknown>;
let reduce = false;
g["HTMLElement"] = FakeEl;
g["SVGElement"] = class {};
g["window"] = { matchMedia: () => ({ matches: reduce }), dispatchEvent: () => true };
const els = Array.from({ length: 30 }, () => new FakeEl());
playFinish(els.map((el, i) => ({ el: el as unknown as Element, keyframes: i % 2 ? goldPulse() : goldFlip(), delay: i * 80, duration: 600 })));
for (const el of els) {
  const { options, keyframes } = el.calls[0]!;
  ok(Number(options.delay) + Number(options.duration) <= WORD_FINISH_MAX_MS, "an effect step ends by 1.2 s");
  ok(options.fill === "none", "effects leave no lasting style");
  ok(JSON.stringify(keyframes[0]) === JSON.stringify(keyframes.at(-1)), "an effect ends where it started");
}
reduce = true;
const still = new FakeEl();
playFinish([{ el: still as unknown as Element, keyframes: goldFlip(), delay: 700, duration: 600 }]);
ok(still.calls.length === 1 && !("delay" in still.calls[0]!.options) && !JSON.stringify(still.calls[0]!.keyframes).includes("transform"), "reduced motion: one still glow, no stagger, no movement");
ok(WORD_FINISH_MAX_MS === 1200, "the cap is 1.2 s");

// 3. Letterfall shimmer: end of run and 120+ only (150 × points ÷ par).
const base = wordfallGame.init(7) as WordfallState;
const need = Math.ceil((120 * WF_PAR) / 150);
ok(!wordfallEarnsShimmer({ ...base, points: WF_PAR }), "no shimmer mid-run");
ok(wordfallEarnsShimmer({ ...base, tick: WF_RUN_TICKS, points: need }), "shimmer at the buzzer with 120+");
ok(!wordfallEarnsShimmer({ ...base, tick: WF_RUN_TICKS, points: need - 1 }), "no shimmer below 120");
ok(wordfallEarnsShimmer({ ...base, over: 1, points: WF_PAR }), "shimmer when a full column ends a 120+ run");
const renderer = readFileSync("src/lib/arcade/wordfall.renderer.ts", "utf8");
ok(!/shimmerStart\.set\([^)]*\)/.test(renderer.split("export function wordfallStartShimmer")[0]!), "only wordfallStartShimmer starts a shimmer (the reveal replay never does)");
ok(!/from "\.\/wordfall\.renderer"/.test(readFileSync("src/lib/arcade/wordfall.ts", "utf8")), "the sim never imports the renderer");

// 4. Demo revisions for the boards that moved.
// The word batch (14 Oct 2026) moved some of these boards again; those take its newer revision.
for (const type of new Set([...WORD_POLISH_DEMOS, ...WORD_BATCH_DEMOS])) {
  const current = WORD_BATCH_DEMOS.has(type) ? WORD_BATCH_PRESENTATION : WORD_POLISH_PRESENTATION;
  ok(puzzlePresentation(type) === current, `${type}: current word presentation`);
  ok(!puzzleInputDemoCompatible(type, {}), `${type}: unstamped coordinate demos are rejected`);
  ok(!puzzleInputDemoCompatible(type, { presentation: "oct10-polish-a" }), `${type}: older demos are rejected`);
  if (WORD_BATCH_DEMOS.has(type)) ok(!puzzleInputDemoCompatible(type, { presentation: WORD_POLISH_PRESENTATION }), `${type}: word polish demos are rejected after the word batch`);
  ok(puzzleInputDemoCompatible(type, { presentation: current }), `${type}: new demos replay`);
}

// 5. Reveal score lines kept.
const keep: Record<string, string[]> = {
  "src/puzzles/strikeout.tsx": ["`5 / 5 words · ${state.strikes} strike${state.strikes === 1 ? \"\" : \"s\"} · ${(elapsed / 1000).toFixed(1)}s`"],
  "src/puzzles/codeword.tsx": ["`Cracked · ${(elapsed / 1000).toFixed(1)}s`", "`${tally.correct} / ${tally.hidden} letters decoded`"],
  "src/puzzles/swapword.tsx": ["`Solved · ${run.swaps} swaps (min ${puzzle.minSwaps}) · ${(elapsed / 1000).toFixed(1)}s`"],
  "src/puzzles/wordSearch.tsx": ["`6 / 6 · ${(elapsed / 1000).toFixed(1)}s`"],
  "src/puzzles/tileGrid.tsx": ["`${count} / ${TG_TILES} tiles · valid`"],
  "src/puzzles/wordSlide.tsx": ["Par {puzzle.par} – you used {replay.moves}"],
};
for (const [file, lines] of Object.entries(keep)) {
  const src = readFileSync(file, "utf8");
  for (const line of lines) ok(src.includes(line), `${file}: reveal line kept: ${line}`);
}

console.log(`PASS: word polish — ${checks} checks (10 cues documented, effects ≤ ${WORD_FINISH_MAX_MS} ms with a reduced-motion glow, Letterfall shimmer at 120+, ${WORD_POLISH_DEMOS.size} demo revisions, reveal score lines kept)`);
