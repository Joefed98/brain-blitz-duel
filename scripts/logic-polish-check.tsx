/**
 * Logic polish (13 Oct 2026), presentation only: every Logic stage renders inside the
 * centred Logic arena with its reduced-motion glow, every completion effect fits its
 * 1.2 s budget, and docs/sound-cues/logic.md lists exactly the cues the code fires.
 * Markup and source arithmetic only (no browser): device look and feel is Joe's to test.
 *
 *   bun scripts/logic-polish-check.tsx
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import { generatePuzzle } from "../src/lib/duel/generate.server";
import { bankedIntroExample } from "../src/lib/duel/puzzleBank.server";
import { INTRO_EXAMPLE_SEED } from "../src/lib/duel/puzzleDemo";
import { withSeededRandom } from "../src/lib/duel/random";
import { PUZZLE_REGISTRY } from "../src/lib/duel/registry";
import { splitPuzzle } from "../src/lib/duel/secrets";
import type { PuzzleType } from "../src/lib/duel/types";
import { LOGIC_SOLVE_FX_MS } from "../src/puzzles/logicFx";
import { LOGIC_POLISH_DEMOS, puzzleInputDemoCompatible, LOGIC_POLISH_PRESENTATION } from "../src/components/puzzles/wordInput";

const GAMES: { type: PuzzleType; file: string }[] = [
  { type: "lightsout", file: "lightsOut" },
  { type: "sudoku", file: "miniSudoku" },
  { type: "tower", file: "tower" },
  { type: "tubes", file: "sortTubes" },
  { type: "safe", file: "safeCracker" },
  { type: "bomb", file: "bombDefusal" },
  { type: "nonogram", file: "nonogram" },
  { type: "flood", file: "colourFlood" },
  { type: "tents", file: "tents" },
  { type: "shikaku", file: "shikaku" },
  { type: "lightup", file: "lightUp" },
];
let failures = 0;
const check = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures++;
    console.log(`FAIL ${name}: ${(error as Error).message}`);
  }
};

check("solve effect window is 1.2 s", () => assert.equal(LOGIC_SOLVE_FX_MS, 1200));

// 1. Every live stage sits in the centred Logic arena; a solved stage carries the calm glow.
for (const { type } of GAMES) {
  check(`${type}: stage in the Logic arena`, () => {
    const full = bankedIntroExample(type) ?? withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(type, { unblockRow: null }));
    const { pub } = splitPuzzle(full);
    const Stage = PUZZLE_REGISTRY[type].Stage;
    const html = renderToStaticMarkup(<Stage puzzle={pub} phaseStartedAt={0} now={0} locked={false} onSubmit={() => undefined} stateKey={`logic-check-${type}`} />);
    assert.match(html, new RegExp(`data-logic-stage="${type}"`));
    assert.match(html, /data-game-arena="logic"/);
    assert.doesNotMatch(html, /data-polish=/, "Logic stages leave the old data-polish centring");
    if (type !== "bomb") assert.match(html, /logic-calm-glow/);
  });
  check(`${type}: older coordinate demos rejected`, () => {
    assert.ok(LOGIC_POLISH_DEMOS.has(type));
    assert.equal(puzzleInputDemoCompatible(type, { presentation: "oct10-polish-b" }), false);
    assert.equal(puzzleInputDemoCompatible(type, { presentation: LOGIC_POLISH_PRESENTATION }), true);
  });
}

// 2. Completion effects: the latest-ending animation of each game ends by 1,200 ms.
//    Worst cases from the stagger maxima each game can reach (largest boards).
const css = readFileSync("src/polish-logic/logic.css", "utf8");
const ms = (pattern: RegExp) => {
  const m = css.match(pattern);
  assert.ok(m, `css: ${pattern}`);
  return m.slice(1).map(Number);
};
const budgets: [string, () => number][] = [
  ["lightsout", () => { const [d] = ms(/logic-bulb-solve (\d+)ms/); return d! + 150; }],
  ["sudoku", () => { const [d, base, step] = ms(/logic-sudoku-light (\d+)ms ease-out calc\((\d+)ms \+ var\(--logic-box\) \* (\d+)ms\)/); return base! + 5 * step! + d!; }],
  ["tower", () => { const [d, step] = ms(/logic-hanoi-light (\d+)ms ease-out calc\(var\(--logic-i, 0\) \* (\d+)ms\)/); const [rise, at] = ms(/logic-hanoi-rise (\d+)ms ease-out (\d+)ms/); return Math.max(8 * step! + d!, rise! + at! + 60); }],
  ["tubes", () => { const [d, base, step] = ms(/logic-potion-shimmer (\d+)ms ease-in-out calc\((\d+)ms \+ var\(--logic-i, 0\) \* (\d+)ms\)/); return base! + 7 * step! + d!; }],
  ["safe", () => { const [d, step] = ms(/logic-drum-lock (\d+)ms ease-out calc\(var\(--logic-i, 0\) \* (\d+)ms\)/); const [door, wait] = ms(/transition: transform (\d+)ms cubic-bezier\([^)]*\) (\d+)ms/); return Math.max(3 * step! + d!, door! + wait!); }],
  ["nonogram", () => { const [d, step] = ms(/logic-nono-colour (\d+)ms ease-out calc\(var\(--logic-diag, 0\) \* (\d+)ms\)/); return 12 * step! + d!; }],
  ["flood", () => { const [d, step] = ms(/logic-flood-wave (\d+)ms ease-out calc\(var\(--logic-diag, 0\) \* (\d+)ms\)/); return 26 * step! + d!; }],
  ["tents", () => { const [d, base, step] = ms(/logic-lantern (\d+)ms ease-out calc\((\d+)ms \+ var\(--logic-i, 0\) \* (\d+)ms\)/); return base! + 11 * step! + d!; }],
  ["shikaku", () => { const [d, step] = ms(/logic-pane-stained (\d+)ms ease-out calc\(var\(--logic-i, 0\) \* (\d+)ms\)/); return 17 * step! + d!; }],
  ["lightup", () => { const [d, step] = ms(/\[data-logic-solved\] \.logic-lamp-cell::after \{\s*animation: logic-light-in (\d+)ms ease-out calc\(var\(--logic-diag, 0\) \* (\d+)ms\)/); return 16 * step! + d!; }],
];
for (const [game, end] of budgets) check(`${game}: completion ends by 1,200 ms`, () => {
  const last = end();
  assert.ok(last <= LOGIC_SOLVE_FX_MS, `${game} ends at ${last} ms`);
});
check("reduced motion: moves snap and solves become one still glow", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\[data-logic-stage\] \*:not\(\.logic-calm-glow\)/);
  assert.match(css, /\[data-logic-solved\] > \.logic-calm-glow \{[^}]*display: block/);
});
check("styles.css imports the Logic sheet", () => assert.match(readFileSync("src/styles.css", "utf8"), /@import "\.\/polish-logic\/logic\.css";/));

// 3. Sound cues: the doc lists exactly what the code dispatches.
check("docs/sound-cues/logic.md matches the code", () => {
  const fired = new Set<string>();
  for (const { file } of GAMES) {
    const source = readFileSync(`src/puzzles/${file}.tsx`, "utf8");
    for (const m of source.matchAll(/"((?:lightsout|sudoku|tower|tubes|safe|bomb|nonogram|flood|tents|shikaku|lightup)\.[a-z]+)"/g)) fired.add(m[1]!);
    for (const m of source.matchAll(/useSolveFx\("([a-z]+)"/g)) fired.add(`${m[1]}.solve`);
  }
  const doc = readFileSync("docs/sound-cues/logic.md", "utf8");
  const listed = new Set([...doc.matchAll(/^\| `([a-z]+\.[a-z]+)` \|/gm)].map((m) => m[1]!));
  assert.deepEqual([...fired].sort(), [...listed].sort());
  assert.equal(fired.size, 34);
});

if (failures) {
  console.log(`FAIL ${failures} logic polish check(s)`);
  process.exit(1);
}
console.log("PASS logic polish: arena markup, demo revision, effect budgets, reduced motion and cue list.");
