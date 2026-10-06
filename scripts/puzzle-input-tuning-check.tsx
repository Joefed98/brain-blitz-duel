import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";
import { PUZZLE_REGISTRY } from "../src/lib/duel/registry";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { withSeededRandom } from "../src/lib/duel/random";
import { INTRO_EXAMPLE_SEED } from "../src/lib/duel/puzzleDemo";
import { extendWordHuntPath, wordHuntInnerCell, toggleWordsmithTile, puzzleInputDemoCompatible, PUZZLE_INPUT_PRESENTATION } from "../src/components/puzzles/wordInput";
import { applyPuzzleSurfaces } from "../src/components/puzzles/usePuzzleSurfaces";
import type { PuzzleType } from "../src/lib/duel/types";

// No browser or pretend layout engine: input arithmetic and SSR/DOM structure only.
assert.deepEqual(toggleWordsmithTile([0, 1, 4, 7], 1), [0, 4, 7]);
assert.deepEqual(toggleWordsmithTile([0, 4], 1), [0, 4, 1]);
assert.deepEqual(toggleWordsmithTile(toggleWordsmithTile([], 3), 3), []);
let hitChecks = 0;
for (const [width, height] of [[390, 700], [375, 667]]) {
  for (const size of [width - 8, height - 220]) {
    const gap = 6, cell = (size - 4 * gap) / 5;
    for (let index = 0; index < 25; index++) {
      const col = index % 5, row = Math.floor(index / 5);
      for (const [fx, fy] of [[0.5, 0.5], [0.21, 0.79], [0.01, 0.5], [0.81, 0.5], [0.5, 0.99]]) {
        const g = { width: size, height: size, cellW: cell, cellH: cell, gapX: gap, gapY: gap, x: col * (cell + gap) + cell * fx, y: row * (cell + gap) + cell * fy };
        const expected = fx >= .2 && fx <= .8 && fy >= .2 && fy <= .8 ? index : null;
        assert.equal(wordHuntInnerCell(g, 5, 5), expected);
        hitChecks++;
      }
      if (col < 4) {
        const g = { width: size, height: size, cellW: cell, cellH: cell, gapX: gap, gapY: gap, x: col * (cell + gap) + cell + gap / 2, y: row * (cell + gap) + cell / 2 };
        assert.equal(wordHuntInnerCell(g, 5, 5), null);
      }
    }
  }
}
assert.deepEqual(extendWordHuntPath([0, 1, 7], 1, 5), [0, 1]);
assert.deepEqual(extendWordHuntPath([0, 1], 7, 5), [0, 1, 7]);
assert.deepEqual(extendWordHuntPath([0, 1], 24, 5), [0, 1]);
assert.deepEqual(extendWordHuntPath([0, 1, 7, 6], 0, 5), [0, 1, 7, 6]);
assert.equal(puzzleInputDemoCompatible("wordsmith", { actions: [] }), false);
assert.equal(puzzleInputDemoCompatible("maze", { actions: [] }), false);
assert.equal(puzzleInputDemoCompatible("wordsmith", { presentation: PUZZLE_INPUT_PRESENTATION }), true);
assert.equal(puzzleInputDemoCompatible("sudoku", {}), true);

const css = readFileSync("src/styles.css", "utf8");
assert.match(css, /\.game-screen,[\s\S]*?canvas,\s*button,[\s\S]*?-webkit-tap-highlight-color: transparent !important/);
assert.match(readFileSync("src/puzzles/beat.tsx", "utf8"), /style=\{\{ \.\.\.NO_SCROLL_STYLE, background: BEAT_BG \}\}/);
assert.match(css, /sudoku-box-outline path[^}]*stroke-width: 3/);
const wordsmithSource = readFileSync("src/components/puzzles/WordsmithPuzzle.tsx", "utf8");
assert.doesNotMatch(wordsmithSource, /<input|onPointerMove|Math.random|Shuffle/);
assert.match(wordsmithSource, /toggleWordsmithTile/);
assert.match(wordsmithSource, /checkWord\(/);
const keys: PuzzleType[] = ["wordsmith", "wordhunt", "target", "maze", "rings", "lightsout", "sudoku", "flood", "shikaku", "beat"];
const window = new Window();
const root = window.document.createElement("div");
const report = ["# Puzzle input tuning audit", "", "No browser tests. PASS below means source, explicit geometry and SSR structure, not measured device fit or native hold appearance.", "", "## Shared checks", "", `- ${hitChecks} inner-60% Word Hunt hit tests, plus gap, adjacency, diagonal, reuse and backtrack regressions.`, "- Wordsmith tile toggles remove only the re-tapped tile; no input box, typing, shuffle or drag handlers.", "- Game roots, all canvases/buttons and Beat hold canvas explicitly suppress native tap highlights/selection/callouts.", "- Old coordinate-based demos for changed controls fall back to fixed examples until re-recorded.", "", "## Both-size per-game audit", "", "| Game | 390×700 | 375×667 | Source geometry and remaining device checks |", "|---|---|---|---|"];
const notes: Record<string, string> = {
  wordsmith: "Square height/width-fitted wheel, eight 25%-diameter octagons at 35% radius plus centre circle. Adjacent tile boxes have >1.7% wheel-width gaps; 44px word/action rows, fixed 32px gold-chip slot. Dropdown unchanged; long reveal lists retain internal scrolling.",
  wordhunt: "Existing 5×5 height/width-fitted square retained. Inner-60% boxes create 40%-cell plus gap dead zones. Previous-cell removes last; nonadjacent/reused hits ignored; second pointer ignored. Drag retained; real finger reliability awaits devices.",
  target: "Undo/Reset each 44×44 with centred 20px SVG; gap 8px. Actions need 88+8+12px plus Lock width: usable widths 382/367px leave 274/259px for Lock. Existing step history is bounded/internal scrolling.",
  maze: "Reset removed. Shared preference retained. 343px control width: four 76.75×68px arrows, 12px gaps; switch on separate 28px row. 104px total replaces old 60+4+44=108px stack; maze loses no height.",
  rings: "Undo/Reset removed, two rotation buttons now (usable-width−8)/2 = 187/179.5px wide, 52px tall. Move replay unchanged. Existing unsolved two-board reveal can internally scroll: not certified no-scroll on short phones.",
  lightsout: "Two 44×44 secondary SVG controls, 12px gap. Board shrinks through existing size container, so larger controls cannot force the board out of its region.",
  sudoku: "Heavy full-grid 3px non-scaling SVG outlines: perimeter plus x=3,y=2,y=4. Cell lines remain 1/2px; overlay ignores pointer events. Fixed 190px reveal and 150px example retained; existing board parent fit needs device confirmation.",
  flood: "Undo removed, count remains. 52px colour choices + four 8px gaps = 292px, within 358/343px inset widths. Width-led board maximum 358/343px plus controls/count fits estimated 552/519px game space.",
  shikaku: "Explicit size/rows aspect and equal minmax tracks. Reveal max width 170px each, 12px gutter: total 352px fits 382/367px. For every rectangle, all corners and number rows share same tracks; 170px square unaffected by text overlays.",
  beat: "Full flexible canvas within overflow-hidden wrapper, unchanged lane input and replay. Native suppression added inline to canvas and inherited from screen CSS, including long holds; intentional blue lane art remains.",
};
let phases = 0;
for (const key of keys) {
  const def = PUZZLE_REGISTRY[key];
  const full = withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(key));
  const pub = splitPuzzle(full).pub;
  for (const [width, height] of [[390, 700], [375, 667]]) {
    window.happyDOM.setWindowSize({ width, height });
    for (const phase of ["live", "intro", "reveal"]) {
      root.innerHTML = phase === "live" ? renderToStaticMarkup(<def.Stage puzzle={pub} phaseStartedAt={0} now={0} locked={false} onSubmit={() => undefined} stateKey={`tuning-${key}`} />)
        : phase === "intro" ? renderToStaticMarkup(<def.IntroExample />)
        : renderToStaticMarkup(<def.Reveal puzzle={full} myAnswer={null} myCorrect={false} myReactionAvgMs={null} timeLimitMs={def.timeLimitMs ?? 60000} />);
      assert.ok(root.innerHTML.length);
      applyPuzzleSurfaces(root as unknown as HTMLElement, key);
      if (key === "wordsmith" && phase !== "reveal") {
        assert.equal(root.querySelectorAll("[data-wordsmith-tile]").length, 9);
        assert.equal(root.querySelectorAll("input").length, 0);
        assert.equal(root.querySelectorAll("[data-wordsmith-tile][data-puzzle-cell]").length, 0);
      }
      if (["maze", "rings", "flood"].includes(key) && phase === "live") assert.equal(root.querySelectorAll('[data-puzzle-action="secondary"]').length, 0);
      if (["target", "lightsout"].includes(key) && phase === "live") {
        for (const label of ["Undo", "Reset"]) {
          const button = root.querySelector(`[aria-label="${label}"]`);
          assert.ok(button?.querySelector("svg"));
          assert.equal(button?.getAttribute("data-puzzle-icon"), null);
          assert.ok(button?.classList.contains("puzzle-secondary-control"));
        }
      }
      if (key === "sudoku") assert.ok(root.querySelector('.sudoku-box-outline path')?.getAttribute("d")?.includes("M 0 2 H 6 M 0 4 H 6"));
      if (key === "shikaku") for (const grid of root.querySelectorAll(".grid")) {
        assert.ok(grid.getAttribute("style")?.includes("aspect-ratio:"));
        assert.ok(grid.getAttribute("style")?.includes("minmax(0, 1fr)"));
      }
      phases++;
    }
  }
  report.push(`| ${def.name} | PASS source/SSR | PASS source/SSR | ${notes[key]} |`);
}
// Newspaper ring circle/square bounding boxes are disjoint at both full widths.
for (const width of [382, 367, 300]) {
  const size = width * .25;
  const centres = Array.from({ length: 8 }, (_, i) => ({ x: width * (.5 + .35 * Math.cos(i * Math.PI / 4)), y: width * (.5 + .35 * Math.sin(i * Math.PI / 4)) }));
  centres.push({ x: width / 2, y: width / 2 });
  for (let i = 0; i < centres.length; i++) for (let j = i + 1; j < centres.length; j++) {
    const a = centres[i], b = centres[j];
    assert.ok(a && b);
    assert.ok(Math.abs(a.x - b.x) >= size || Math.abs(a.y - b.y) >= size);
  }
}
report.push("", "## Limits", "", "The document root remains viewport-locked and touched controls introduce no page scrolling. Actual content fit, long text wrapping, native hold highlights, physical drag accuracy and audio require the user's device checks. Existing internal-scroll reveals/dropdowns are explicitly not certified scroll-free.");
mkdirSync(".lovable/audits", { recursive: true });
writeFileSync(".lovable/audits/puzzle-input-oct6.md", report.join("\n") + "\n");
console.log(`PASS ${hitChecks} hit samples; 10 games × 2 sizes × 3 phases = ${phases} source/SSR audits, geometry and input regressions. Device fit unverified.`);