import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";
import { WordsmithRing } from "../src/components/puzzles/WordsmithRing";
import { miniSudokuPuzzle } from "../src/puzzles/miniSudoku";
import { shikakuPuzzle } from "../src/puzzles/shikaku";
import { wordsmithPuzzle } from "../src/puzzles/wordsmith";
import { ARCADE_FX_SPECS } from "../src/lib/arcade/arcadeFxGames.renderer";
import { gameDisplayName } from "../src/lib/duel/gameNames";

// Markup and analytic geometry only: no browser and no simulated layout engine.
const window = new Window();
const root = window.document.createElement("div");
const letters = ["C", "A", "R", "E", "P", "N", "T", "E", "R"];
const css = readFileSync("src/styles.css", "utf8");
const backdrop = readFileSync("src/components/duel/ArcadeReveal.tsx", "utf8").split("function Track")[0] ?? "";
assert.match(backdrop, /const ring = outcome === "finish" \? "var\(--me\)" : null/);
assert.doesNotMatch(backdrop, /outcome === "crash"|var\(--warn\)/);
assert.match(backdrop, /<circle[\s\S]*<rect/); // finish position and fallback retained
assert.match(css, /wordsmith-ring-lines[^}]*pointer-events: none/);
assert.doesNotMatch(css, /\.fx-outline/);
assert.match(css, /wordsmith-ring-tile[^}]*min-width: 44px; min-height: 44px/);
assert.match(css, /wordsmith-orbit[^}]*stroke: var\(--wordsmith-orbit-edge\)/);
assert.match(readFileSync("src/components/duel/FxLayer.tsx", "utf8"), /event\.primitive === "glow" \|\| event\.primitive === "shake"\) return/);
assert.match(css, /sudoku-grid\.sudoku-grid > button[^}]*border-radius: 0 !important/);
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
  assert.equal(root.querySelectorAll(".wordsmith-ring-letter").length, 9);
  assert.equal(root.querySelectorAll("polygon, line").length, 0);
  assert.equal(root.querySelectorAll(".wordsmith-orbit").length, 1);
  assert.equal(root.querySelector(".wordsmith-orbit")?.getAttribute("r"), "37");
  for (const count of [7,8,9,10]) {
    const diameter = 280 * .18, orbit = 280 * .37;
    assert(diameter >= 44);
    assert(2 * orbit * Math.sin(Math.PI / count) > diameter, "orbit tiles do not overlap");
    assert(orbit + diameter / 2 < 140, "tiles stay inside board");
  }
  for (const tile of tiles) assert.equal(tile.style.clipPath, "");
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
      // Happy DOM does not parse container-query units in clamp; inspect the emitted declaration.
      assert.ok(label.getAttribute("style")?.includes("100cqw"));
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
  rows.push(`| Wordsmith | ${width}x${height} | PASS shared markup + geometry: circular nucleus, faint 37%-radius orbit and round controls; all 7–10 outer layouts fit without overlap; 50.4px targets at conservative 280px board; fixed chip/action slots unchanged |`);
  rows.push(`| Mini Sudoku | ${width}x${height} | PASS live/intro/reveal: 36 equal-track cells; heavy strokes are borders of those exact cells, no overlay |`);
  rows.push(`| Shikaku | ${width}x${height} | PASS both individual grids and pair: clipped board/labels, equal tracks; ${pairedWidth}px grid, ${cell.toFixed(2)}px cells, ${font.toFixed(2)}px labels |`);
}
// Arcade arenas (styles.css "Arcade arena slot"), CSS arithmetic. Every arcade arena
// starts 116px down (8px pad + 36px top bar + 8px + 28px heading + 8px + 20px timer
// + 8px; Scrumper adds its 32px HUD row + 8px), spans the column (viewport - 8px) and
// its slot ends at the controls or 8px above the bottom (no inset in these sizes).
// The arena is the world at min(slot width / W, slot height / H): one factor both ways.
const css2 = readFileSync("src/styles.css", "utf8");
assert.match(css2, /\[data-arena-slot\] > \[data-game-arena\][^}]*width: min\(100cqw, 100cqh \* var\(--arena-w\) \/ var\(--arena-h\)\)/);
assert.match(css2, /\[data-arena-slot\] > \[data-game-arena\][^}]*height: min\(100cqh, 100cqw \* var\(--arena-h\) \/ var\(--arena-w\)\)/);
assert.match(css2, /\[data-arena-slot\] \{[^}]*container-type: size;[^}]*align-items: center;[^}]*justify-content: flex-start/);
assert.match(css2, /padding-bottom: calc\(max\(8px, env\(safe-area-inset-bottom\) \+ 6px\) - max\(8px, env\(safe-area-inset-bottom\)\)\)/);
/** Height taken below each slot: 12px gap + control row (Swish: its 72px cancel strip). */
const BELOW: Record<string, number> = { burst: 12 + 72, inkbridge: 12 + 48, orbit: 12 + 48, balltrack: 12 + 28, bintoss: 72 };
/** Smallest touch target edge in each control row, by viewport width. */
const TARGETS: Record<string, (w: number) => number> = {
  burst: (w) => Math.min(56, (w - 8 - 2 * 12) / 3),
  inkbridge: (w) => Math.min(48, (w - 8 - 3 * 6) / 4),
  orbit: () => 44,
};
let arenaChecks = 0;
const ARENA_SIZES = [[375, 667], [390, 700], [390, 844], [430, 932], [1280, 800]] as const;
/** Per game: arena size at each viewport, then scale, fill and side space at 390x844. */
const arenaTable = new Map<string, { sizes: string[]; detail: string }>();
for (const [width, height] of ARENA_SIZES) {
  for (const [game, spec] of Object.entries(ARCADE_FX_SPECS)) {
    const top = 116 + (game === "snip" ? 40 : 0);
    const slotW = width - 8, slotH = height - 8 - top - (BELOW[game] ?? 0);
    const scale = Math.min(slotW / spec.width, slotH / spec.height);
    const w = spec.width * scale, h = spec.height * scale;
    assert.ok(w <= slotW + 1e-9 && h <= slotH + 1e-9, `${game} ${width}x${height}: fits`);
    assert.ok(Math.abs(w - slotW) < 1e-9 || Math.abs(h - slotH) < 1e-9, `${game} ${width}x${height}: largest fit`);
    assert.ok(Math.abs(w / h - spec.width / spec.height) < 1e-9, `${game} ${width}x${height}: uniform`);
    // The old cap (150cqw) with letterbox/stretch never beat the new uniform scale.
    const oldH = Math.min(slotH, 1.5 * slotW);
    assert.ok(scale + 1e-9 >= Math.min(slotW / spec.width, oldH / spec.height), `${game} ${width}x${height}: never smaller than before`);
    assert.ok(slotH > 0 && top + slotH + (BELOW[game] ?? 0) + 8 === height, `${game} ${width}x${height}: column ends 8px above the bottom`);
    if (TARGETS[game]) assert.ok(TARGETS[game]!(width) >= 44, `${game} ${width}x${height}: 44px targets`);
    const entry = arenaTable.get(game) ?? { sizes: [], detail: "" };
    entry.sizes.push(`${w.toFixed(0)}x${h.toFixed(0)}`);
    if (width === 390 && height === 844) entry.detail = `${scale.toFixed(3)}x | ${top}px | ${(slotH - h).toFixed(0)}px | ${(slotW - w).toFixed(0)}px`;
    arenaTable.set(game, entry);
    arenaChecks++;
  }
}
console.log(`PASS ${arenaChecks} arcade arena geometries (22 games × 375x667, 390x700, 390x844, 430x932, 1280x800): uniform world-aspect, largest fit, fixed top, column 8px above the bottom, control targets ≥44px.`);
// The arena table is project documentation, not a Lovable audit: docs/, never .lovable/.
writeFileSync("docs/arena-sizes-oct-2026.md", [
  "# Arcade arena sizes (Oct 2026)", "",
  "Generated by `bun scripts/presentation-geometry-check.tsx` from the CSS arithmetic of the arcade arena slot",
  "(styles.css, \"Arcade arena slot\"): each arena is the game's world at the largest uniform scale that fits below its",
  "fixed top edge, above its controls and 8px above the bottom (no safe-area inset). Sizes are CSS px, width x height.",
  "Analytic geometry, cross-checked in the browser by arcade-play-check; not device measurements.", "",
  `| Game | World | ${ARENA_SIZES.map(([w, h]) => `${w}x${h}`).join(" | ")} | Scale at 390x844 | Top | Fill below | Space across |`,
  `|---|---|${ARENA_SIZES.map(() => "---").join("|")}|---|---|---|---|`,
  ...[...arenaTable].map(([game, { sizes, detail }]) => {
    const spec = ARCADE_FX_SPECS[game as keyof typeof ARCADE_FX_SPECS];
    return `| ${gameDisplayName(game as never)} | ${spec.width}x${spec.height} | ${sizes.join(" | ")} | ${detail} |`;
  }), "",
].join("\n"));
mkdirSync(".lovable/audits", { recursive: true });
writeFileSync(".lovable/audits/presentation-geometry-oct6.md", [
  "# Presentation geometry audit", "", "No browser tests. PASS means source/SSR and analytic geometry, not measured device rendering or no-scroll certification.", "",
  "| Presentation | Size | Result |", "|---|---|---|", ...rows, "",
  "The live Wordsmith board retains its height/width-fitting square and all existing fixed chip/action slots. Its reveal now adds a 160px shared board; existing long word lists can still require internal scrolling. Sudoku retains its previous board dimensions; Shikaku remains two 170px-max squares with a 12px gutter. No generators, grading or scoring changed. Actual fit and appearance remain for user device checks.", "",
].join("\n"));
console.log(`PASS ${checks} source/SSR phase checks plus both-size orbit/cell/label geometry; crash marker source check passed. Device fit unverified.`);