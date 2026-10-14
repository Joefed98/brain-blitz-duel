import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";
import { PUZZLE_REGISTRY } from "../src/lib/duel/registry";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { withSeededRandom } from "../src/lib/duel/random";
import { INTRO_EXAMPLE_SEED } from "../src/lib/duel/puzzleDemo";
import { applyPuzzleSurfaces } from "../src/components/puzzles/usePuzzleSurfaces";
import { surfaceState, pathWidth, MEANINGFUL_SURFACE_GAMES } from "../src/lib/puzzleSurface";
import { PhoneShell } from "../src/components/duel/PhoneShell";
import type { PuzzleType } from "../src/lib/duel/types";

// DOM parsing only: Happy DOM does not compute layout. Never label this a fit test.
const active = Object.entries(PUZZLE_REGISTRY).filter(([, d]) => !d.retired && !d.arcadeRun && d.category !== "arcade");
assert.equal(active.length, 47);
assert.equal(surfaceState("bg-card ring-2 ring-primary"), "selected");
assert.equal(surfaceState("bg-primary"), "active");
assert.equal(surfaceState("text-destructive"), "error");
assert.equal(surfaceState("bg-card", true), "given");
assert.equal(pathWidth(50), 8);
const records: Record<string, unknown>[] = [];
const risks: Record<string, string> = {
  wordsmith: "Found-word list and answer controls need short-screen checks; reveal lists can scroll.",
  tilegrid: "Fixed 318px tray fits both usable widths; board/tray height and small rack tiles need checks.",
  wordslide: "Five-row board and row locks; 36px locks cannot overlap adjacent rows.",
  balance: "Beam pegs retain exact spacing; multi-board reveal can scroll.",
  target: "Number/operator stack and step history need short-screen checks.",
  equation: "Equation row, controls and fixed confirmation slot need checks.",
  reaction: "Flexible single-button arena; timing state kept intact.",
  numhunt: "Scattered numbered nodes retain coordinates and sizes; small nodes remain exact-hit.",
  symscan: "Measured square grid; coloured shapes retain meaning.",
  spotdiff: "Two fitted panels; symbols and click coordinates untouched.",
  stopwatch: "Moving target bars and stop controls retain geometry; vertical stack needs checks.",
  countup: "Scene plus 11-column compact keypad; keypad keys cannot all be 44px wide.",
  wordhunt: "Five-column word board, confirmation row and word list; long reveal lists can scroll.",
  unblock: "Measured square board and exit preserve multi-cell pieces and exact drag mapping.",
  blockparty: "Board plus tray pieces; tiny tray pieces keep exact hit geometry.",
  lightsout: "Container-sized square; on/off fills preserved.",
  pipes: "Square board; pipe connection/source/leak meanings preserved.",
  sudoku: "Six-by-six board plus keypad; box lines and compact pencil marks preserved.",
  flow: "Measured coloured endpoints and walls preserved; dense board cells keep exact hits.",
  iceslide: "Square board plus shared direction controls; terrain and portals preserved.",
  push: "Square board plus directions; crates, walls and targets retain geometry.",
  laser: "Square beam board plus rack; mirrors, splitters and gems retain geometry.",
  tower: "Three/four pegs and varying disc widths; exact objects preserved.",
  maze: "Square SVG maze and directions; wall widths and coordinate mapping untouched.",
  tubes: "Two-row 80%-height arena; tube/ball geometry and colour order preserved.",
  safe: "Clue/dial split; longer clues need 375x667 checks.",
  bomb: "Six-rule panel plus actions; 14px text wrapping needs both-size device checks.",
  gravity: "Square board plus directions; ball/target colours and tilt preserved.",
  chain: "Scattered nodes and rule strip; small nodes cannot gain overlapping hit areas.",
  intruder: "Measured symbol grid; glyph semantics preserved.",
  nonogram: "Clue alignment tracks unchanged; 14px clues and dense cells need checks.",
  pairmatch: "Six-by-five grid; pair colours/symbols and face states preserved.",
  flood: "Square coloured region board; colour choices retain exact meaning.",
  tiles: "Three-by-three sliding grid; blank slot and slide coordinates unchanged.",
  rings: "Concentric SVG clues/arrows keep exact arcs and target geometry.",
  tents: "Grid with row/column counts; 14px clues and dense cells need checks.",
  shikaku: "Rectangle partitions retain borders/colours; clue coordinates unchanged.",
  lightup: "Walls, lit cells and lamps retain meanings; dense board needs touch checks.",
  wordsearch: "Container-sized letter square and list; dense letter cells keep exact mapping.",
  letterwheel: "Crossword/wheel split; radial letter nodes retain geometry; short-screen check needed.",
  numpyramid: "Height-fitted pyramid and bank; small cells and fixed drag ghost need device checks.",
  trail: "Six-by-six sequential board; fixed small reveal grids and given slots preserved.",
  strikeout: "Five-row board fitted by container height above the shared QWERTY keypad; gold/red key fills meaningful.",
  codeword: "Container-fitted 7 × 7 number grid, key strip and shared QWERTY keypad; tiny cell numbers by design.",
  swapword: "Container-fitted 6 × 6 figure-eight board; gold/teal/grey tile fills carry the marks.",
  measure: "Two or three glass jugs on one litre scale, height-fitted; four-row reveal needs short-screen checks.",
  checkout: "Square fitted dartboard plus ring and action rows; wedge numbers and 44px controls need device checks.",
  numline: "Full-width drag line with magnifier above the finger; three-line reveal needs short-screen checks.",
};
const window = new Window();
const root = window.document.createElement("div");
window.document.body.append(root);
// Exercise measured branches with explicit geometry, not a pretend layout engine.
root.innerHTML = '<div class="grid"><div data-cell="0" class="rounded-lg bg-primary ring-2 ring-primary font-mono">7</div></div><button class="h-9">Undo</button><svg class="absolute" viewBox="0 0 100 100"><polyline points="10,10 30,10" stroke="var(--primary)" /></svg>';
for (const node of root.querySelectorAll("[data-cell], button")) {
  node.getBoundingClientRect = () => ({ x: node.tagName === "BUTTON" ? 100 : 0, y: 0, left: node.tagName === "BUTTON" ? 100 : 0, top: 0, right: node.tagName === "BUTTON" ? 136 : 50, bottom: node.tagName === "BUTTON" ? 36 : 50, width: node.tagName === "BUTTON" ? 36 : 50, height: node.tagName === "BUTTON" ? 36 : 50, toJSON: () => ({}) });
}
applyPuzzleSurfaces(root as unknown as HTMLElement, "wordhunt");
assert.equal(root.querySelector("[data-cell]")?.getAttribute("data-puzzle-state"), "selected");
assert.equal(root.querySelector("button")?.getAttribute("data-puzzle-hit"), "halo");
assert.equal(root.querySelector("button")?.getAttribute("aria-label"), "Undo");
assert.equal(root.querySelector("polyline")?.getAttribute("data-puzzle-path"), "true");
assert.equal(root.querySelector("polyline")?.getAttribute("points"), "10,10 30,10");
let phases = 0;
for (const [key, definition] of active) {
  const type = key as PuzzleType;
  const full = withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(type));
  const pub = splitPuzzle(full).pub;
  for (const [width, height] of [[390, 700], [375, 667]]) {
    window.happyDOM.setWindowSize({ width, height });
    const phaseCounts: string[] = [];
    for (const phase of ["live", "recorded-intro-stage", "static-intro", "reveal"] as const) {
      const stageProps = { puzzle: pub, phaseStartedAt: 0, now: 0, locked: false, onSubmit: () => undefined, onDraftAnswer: () => undefined, stateKey: `surface-audit-${key}`, checkWord: async (word: string) => ({ word, valid: false, points: 0 }) };
      const revealProps = { puzzle: full, myAnswer: null, myCorrect: false, myReactionAvgMs: null, timeLimitMs: definition.timeLimitMs ?? 60000 };
      // Type-specific props remain in the unmodified component. A component union needs split rendering.
      const markup = phase === "reveal"
        ? renderToStaticMarkup(<definition.Reveal {...revealProps} />)
        : phase === "static-intro" ? renderToStaticMarkup(<definition.IntroExample />)
        : renderToStaticMarkup(<definition.Stage {...stageProps} />);
      assert.ok(markup.length > 0, `${key} ${phase} rendered empty`);
      root.innerHTML = markup;
      const before = root.querySelectorAll("*").length;
      const text = root.textContent;
      const classes = [...root.querySelectorAll("*")].map(n => n.getAttribute("class"));
      const pathCoords = [...root.querySelectorAll("polyline,path,line")].map(n => [n.getAttribute("points"), n.getAttribute("d"), n.getAttribute("x1"), n.getAttribute("y1")]);
      applyPuzzleSurfaces(root as unknown as HTMLElement, key);
      assert.equal(root.querySelectorAll("*").length, before, `${key}: added layout elements`);
      assert.equal(root.textContent, text, `${key}: text changed`);
      assert.deepEqual([...root.querySelectorAll("*")].map(n => n.getAttribute("class")), classes, `${key}: layout class changed`);
      assert.deepEqual([...root.querySelectorAll("polyline,path,line")].map(n => [n.getAttribute("points"), n.getAttribute("d"), n.getAttribute("x1"), n.getAttribute("y1")]), pathCoords, `${key}: path coordinates changed`);
      const once = root.innerHTML;
      applyPuzzleSurfaces(root as unknown as HTMLElement, key);
      assert.equal(root.innerHTML, once, `${key}: adapter is not idempotent`);
      phaseCounts.push(`${phase}: ${root.querySelectorAll("[data-puzzle-cell]").length} cells / ${root.querySelectorAll("[data-puzzle-action]").length} actions`);
      phases++;
    }
    const shell = renderToStaticMarkup(<PhoneShell constrained gameScreen gameType={type}><span /></PhoneShell>);
    assert.ok(shell.includes(`data-puzzle-surface="${key}"`));
    // Play shells are the dynamic viewport (.game-viewport, 100dvh in CSS) and the column fills them.
    assert.ok(shell.includes("no-overscroll game-viewport overflow-hidden"));
    assert.ok(shell.includes("no-overscroll h-full overflow-hidden"));
    assert.ok(!shell.includes("100dvh") && !shell.includes("100vh"));
    records.push({ key, name: definition.name, viewport: `${width}x${height}`, result: "PASS markup/geometry invariants; rendered fit UNVERIFIED", coverage: phaseCounts.join("; "), exception: MEANINGFUL_SURFACE_GAMES.has(key) ? "Meaningful fills/objects retained; shared edge, text and selection only" : "Shared surfaces; existing control dimensions retained", sizing: risks[key] });
  }
}
assert.equal(phases, 376);
mkdirSync("/tmp/puzzle-polish", { recursive: true });
writeFileSync("/tmp/puzzle-polish/audit.json", JSON.stringify(records, null, 2));
const lines = ["# Duelz puzzle surface audit", "", "47 active non-engine games; 390×700 and 375×667; 376 live/static-intro/recorded-intro-stage/reveal markup checks.", "", "**PASS means markup/geometry invariants, not rendered no-scroll.** No browser tests ran. Happy DOM parses markup but does not calculate layout; these dimensions label the source/geometry review only. Font wrapping, fit, actual touch behaviour, drag animation and performance await device checks.", "", "## Shared coverage and exceptions", "", "All games share the PhoneShell presentation scope for play, recorded Stage demos, static examples and reveals. The adapter changes surface roles only: no elements, layout classes, path coordinates, text or game handlers are replaced. Existing in-puzzle command heights are preserved to avoid layout changes. Meaningful coloured/physical objects retain fills and shapes. Dense grid/keypad/radial targets keep their original hit ownership; isolated commands receive a 44px halo only when it does not intersect other controls. Existing errors remain the only errors. No new drag or drop verdicts are introduced.", "", "Compact glyphs and inline fonts may remain below 14px. Sudoku box edges, Shikaku partition edges, maze walls, rings, tubes, balance beams, tower discs and specialised SVG symbols are intentionally not generic rectangular tiles. Some reveal lists already use a scroll container; this pass does not claim to remove those existing layout risks.", "", "## Per-game results", "", "| Game | Size | Audit result | Applied roles | Difference / reason | Sizing review |", "|---|---|---|---|---|---|"];
for (const row of records) lines.push(`| ${row["name"]} | ${row["viewport"]} | ${row["result"]} | ${row["coverage"]} | ${row["exception"]} | ${row["sizing"]} |`);
writeFileSync("/tmp/puzzle-polish/audit.md", lines.join("\n") + "\n");
console.log(`PASS: ${active.length} games, ${records.length} size-labelled source audits, ${phases} phase markup/invariant checks. Rendered no-scroll remains UNVERIFIED.`);