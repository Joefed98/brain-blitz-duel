import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";
import { WordsmithRing } from "../src/components/puzzles/WordsmithRing";
import { miniSudokuPuzzle } from "../src/puzzles/miniSudoku";
import { shikakuPuzzle } from "../src/puzzles/shikaku";
import { wordsmithPuzzle } from "../src/puzzles/wordsmith";

// Markup and analytic geometry only: no browser and no simulated layout engine.
const window = new Window();
const root = window.document.createElement("div");
const letters = ["C", "A", "R", "E", "P", "N", "T", "E", "R"];
const css = readFileSync("src/styles.css", "utf8");
const backdrop = readFileSync("src/components/duel/ArcadeReveal.tsx", "utf8").split("function Track")[0] ?? "";
assert.match(backdrop, /const ring = outcome === "finish" \? "var\(--me\)" : null/);
assert.doesNotMatch(backdrop, /outcome === "crash"|var\(--warn\)/);
assert.match(backdrop, /<circle[\s\S]*<rect/); // finish position and fallback retained
assert.match(css, /font-size: 52px/);
assert.match(css, /wordsmith-ring-example[^}]*font-size: 32px/);
assert.match(css, /sudoku-grid > button[^}]*border-radius: 0 !important/);
const parse = (s: string) => [...s.matchAll(/([\d.]+)% ([\d.]+)%/g)].map(m => [Number(m[1]), Number(m[2])]);
const area = (p: number[][]) => Math.abs(p.reduce((sum, a, i) => {
  const b = p[(i + 1) % p.length];
  return b ? sum + (a[0] ?? 0) * (b[1] ?? 0) - (b[0] ?? 0) * (a[1] ?? 0) : sum;
}, 0)) / 2;
const rows: string[] = [];
let checks = 0;
for (const [width, height] of [[390, 700], [375, 667]]) {
  window.happyDOM.setWindowSize({ width, height });
  root.innerHTML = renderToStaticMarkup(<WordsmithRing letters={letters} selected={[0, 4]} disabled={false} />);
  const tiles = [...root.querySelectorAll<HTMLButtonElement>("[data-wordsmith-tile]")];
  assert.equal(tiles.length, 9);
  assert.equal(root.querySelectorAll('[aria-pressed="true"]').length, 2);
  const wedgeAreas = tiles.filter(n => !n.classList.contains("wordsmith-ring-centre")).map(n => area(parse(n.style.clipPath)));
  assert.ok(wedgeAreas.every(a => Math.abs(a - (wedgeAreas[0] ?? 0)) < 1e-8));
  const polygons = [...root.querySelectorAll("polygon")].map(n => (n.getAttribute("points") ?? "").split(" ").map(s => s.split(",").map(Number)));
  const outer = polygons[0];
  assert.ok(outer);
  const edges = outer.map((a, i) => {
    const b = outer[(i + 1) % outer.length] ?? [];
    return Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0));
  });
  assert.ok(edges.every(e => Math.abs(e - (edges[0] ?? 0)) < 1e-8));
  assert.equal(root.querySelectorAll("line").length, 8);
  assert.ok(Math.abs(wedgeAreas.reduce((s, a) => s + a, 0) + area(polygons[1] ?? []) - area(outer)) < 1e-8);
  root.innerHTML = renderToStaticMarkup(<wordsmithPuzzle.Reveal puzzle={{ type: "wordsmith", letters }} myAnswer={null} myCorrect={false} myReactionAvgMs={null} timeLimitMs={100000} />);
  assert.equal(root.querySelectorAll("[data-wordsmith-tile]").length, 9);
  checks += 2;
  for (const phase of ["intro", "live", "reveal"]) {
    const sudoku = { type: "sudoku" as const, givens: Array(36).fill(0), solution: Array(36).fill(1) };
    root.innerHTML = phase === "intro" ? renderToStaticMarkup(<miniSudokuPuzzle.IntroExample />)
      : phase === "live" ? renderToStaticMarkup(<miniSudokuPuzzle.Stage puzzle={sudoku} phaseStartedAt={0} now={0} locked={false} onSubmit={() => undefined} />)
      : renderToStaticMarkup(<miniSudokuPuzzle.Reveal puzzle={sudoku} myAnswer={null} myCorrect={false} myReactionAvgMs={null} timeLimitMs={90000} />);
    const cells = [...root.querySelectorAll(".sudoku-grid > button")];
    assert.equal(cells.length, 36);
    cells.forEach((cell, i) => {
      const r = Math.floor(i / 6), c = i % 6;
      assert.equal(cell.classList.contains("sudoku-box-top"), r % 2 === 0);
      assert.equal(cell.classList.contains("sudoku-box-left"), c % 3 === 0);
      assert.equal(cell.classList.contains("sudoku-box-bottom"), r === 5);
      assert.equal(cell.classList.contains("sudoku-box-right"), c === 5);
    });
    assert.equal(root.querySelectorAll(".sudoku-grid > svg").length, 0);
    checks++;
  }
  const puzzle = { type: "shikaku" as const, size: 10, clues: [{cell: 0, n: 10}, {cell: 9, n: 20}, {cell: 99, n: 1}], solution: [] };
  root.innerHTML = renderToStaticMarkup(<shikakuPuzzle.Reveal puzzle={puzzle} myAnswer={null} myCorrect={false} myReactionAvgMs={null} timeLimitMs={90000} />);
  const grids = [...root.querySelectorAll<HTMLElement>(".shikaku-board")];
  assert.equal(grids.length, 2);
  // Test each individual grid as well as the pair: clipping belongs to the board, not its parent.
  for (const grid of grids) {
    assert.ok(grid.classList.contains("overflow-hidden"));
    assert.equal(grid.style.gridTemplateRows, "repeat(10, minmax(0, 1fr))");
    assert.equal(grid.style.aspectRatio, "10 / 10");
    for (const label of grid.querySelectorAll<HTMLElement>(".shikaku-clue")) {
      assert.ok(label.classList.contains("min-h-0") && label.classList.contains("overflow-hidden"));
      assert.ok(label.style.fontSize.includes("100cqw"));
      assert.ok(label.querySelector(".leading-none"));
    }
    checks++;
  }
  const pairedWidth = Math.min(170, (width - 8 - 12) / 2);
  const cell = (pairedWidth - 9) / 10;
  const font = Math.max(12, Math.min(20, cell * .8));
  assert.ok(font <= cell);
  assert.ok(font * 1.2 <= cell); // two mono digits, each approximately .6em
  rows.push(`| ArcadeReveal | ${width}x${height} | PASS source: crash marker absent; finish circles/fallback unchanged |`);
  rows.push(`| Wordsmith | ${width}x${height} | PASS shared markup + geometry: regular outer/inner octagons, eight equal wedges, area conservation, nine controls, 52px live / 32px example/reveal letters |`);
  rows.push(`| Mini Sudoku | ${width}x${height} | PASS live/intro/reveal: 36 equal-track cells; heavy strokes are borders of those exact cells, no overlay |`);
  rows.push(`| Shikaku | ${width}x${height} | PASS both individual grids and pair: clipped board/labels, equal tracks; ${pairedWidth}px grid, ${cell.toFixed(2)}px cells, ${font.toFixed(2)}px labels |`);
}
mkdirSync(".lovable/audits", { recursive: true });
writeFileSync(".lovable/audits/presentation-geometry-oct6.md", [
  "# Presentation geometry audit", "", "No browser tests. PASS means source/SSR and analytic geometry, not measured device rendering or no-scroll certification.", "",
  "| Presentation | Size | Result |", "|---|---|---|", ...rows, "",
  "The live Wordsmith board retains its height/width-fitting square and all existing fixed chip/action slots. Its reveal now adds a 160px shared board; existing long word lists can still require internal scrolling. Sudoku retains its previous board dimensions; Shikaku remains two 170px-max squares with a 12px gutter. No generators, grading or scoring changed. Actual fit and appearance remain for user device checks.", "",
].join("\n"));
console.log(`PASS ${checks} source/SSR phase checks plus both-size polygon/cell/label geometry; crash marker source check passed. Device fit unverified.`);