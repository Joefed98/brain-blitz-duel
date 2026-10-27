import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";
import { WordsmithRing } from "../src/components/puzzles/WordsmithRing";
import { miniSudokuPuzzle } from "../src/puzzles/miniSudoku";
import { shikakuPuzzle } from "../src/puzzles/shikaku";
import { wordsmithPuzzle } from "../src/puzzles/wordsmith";
import { ARCADE_FX_SPECS, ENGINE_FX_SPECS } from "../src/lib/arcade/arcadeFxGames.renderer";
import { TD_H, TD_W } from "../src/lib/arcade/tenDrop";
import { CLAY_TALL_H, CLAY_W } from "../src/lib/arcade/clayShoot";
import { CLASH_TALL_H, CLASH_WORLD_W } from "../src/lib/arcade/colourClash";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import { ARENA_SCENE_GAMES } from "../src/lib/arcade/arenaScene.renderer";

/** Arena scenes (15 Oct 2026): each scene game's stage file and what fills its box beyond the world. */
const SCENE_FILES: Record<(typeof ARENA_SCENE_GAMES)[number], string> = {
  matchup: "matchup", tilt: "tilt", whack: "whack", tendrop: "tenDrop", bullseye: "bullseye",
  bintoss: "binToss", clayshoot: "clayShoot", flip: "flip", inkbridge: "inkBridge", cross: "cross",
  hover: "hover", breaker: "breaker", rally: "rally", beat: "beat", snake: "snake", burst: "burst",
  wavefront: "wavefront", orbit: "orbit", skyline: "skyline", slice: "slice", bubble: "bubble",
  swing: "swing", snip: "snip", balltrack: "ballTrack", pinball: "pinball", stroop: "stroop",
};
const ARENA_SCENE_NOTES: Record<(typeof ARENA_SCENE_GAMES)[number], string> = {
  matchup: "the sparkly purple velvet over the whole screen, behind the header too (world centred)",
  tilt: "the board's oak runs on to the screen's edges, settling darker (no rim)",
  whack: "the meadow below the 4x4 field starts in the field's green, then soft tufts, a few faded flowers and small stones on a faint band of soil (static); the field centred, the meadow above it too",
  tendrop: "a sill closing the columns, then the frame's rails and a shaded backing to a foot rail",
  bullseye: "the counter's front, a kick board and the fairground floor",
  bintoss: "the counter's front, a kick board and the fairground floor (sky and counter beside the world)",
  clayshoot: "more field below, starting in the world's own bottom grass; sky, treeline and field beside the world (no seam)",
  flip: "deep rock below the floor's rock, faint lava streaks drifting and bubbling (still under reduced motion)",
  inkbridge: "grass and hillside below the ground (sky, hills and ground beside the world)",
  cross: "the start pavement runs on between grass verges to a grass strip, two or three people strolling along it (none under reduced motion)",
  hover: "the black night sky with faint still stars",
  breaker: "the black screen runs on into a dark retro floor (a faint horizon grid)",
  rally: "the court's dark floor, five retro lamps lit by Rally's good moments",
  beat: "the four lanes' tints fade into the dark, a few small notes drifting and slowly changing colour",
  snake: "a faint starfield round the board, its stars stepping through the border's colours (world centred)",
  burst: "the black arena runs on under the arrows, small faint reactions drifting together and bursting",
  wavefront: "the night sky's stars below and beside the world",
  orbit: "black space with light stars (SET CHECKPOINT laid over the world)",
  skyline: "a dark road under the tower's base block, softly lit by street lamps",
  slice: "a faded marble worktop under the chopping board",
  bubble: "the deep water settles onto soft sand",
  swing: "more lava under the cavern's lava, then dark rock",
  snip: "the orchard grass runs on below, a deeper green (world centred)",
  balltrack: "the wooden board runs on across the sides and to the bottom",
  pinball: "the dark table, five retro lamps lit by the table's good moments (world centred)",
  stroop: "the night board runs on under the arrows: its faint dot grid, lifting from the board's black to a soft indigo glow",
};

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
// Arcade play screens (15 Oct 2026, display only; polish-layout/bottom.css "Arcade play screen"), CSS
// arithmetic. The live round of every arcade game and every engine game on the arcade stage has one
// header: since Polish 2 (24 Oct 2026) the game frame's 60px header at the top (or just under a notch's
// safe-area inset; until then a 44px row 4px down with 4px under it, 52px), so the arena slot starts 60px
// down, below any of the game's own HUD rows (Scrumper's 20px line, Tenfall's
// 56px HUD, Bonk's rule box and hit line, Pull!'s hit line and pips). The slot runs the full width, edge
// to edge, down to its controls (8px above them) or 16px above the bottom, and the lowest control row ends
// exactly 16px above the bottom, whatever the home-bar inset. The arena is the world at
// min(slot width / W, slot height / H): one factor both ways, top-anchored and centred across.
// Until 15 Oct 2026 the arena started 116px down (8px pad + 36px top bar + 8px + 28px heading + 8px + 20px
// timer + 8px; Scrumper +40px for its 32px HUD row, Tilt +40px drop) inside 4px side insets and ended at
// the controls or 8px above the bottom; that arithmetic is kept below as OLD_* to prove every arena grew.
const css2 = readFileSync("src/styles.css", "utf8");
assert.match(css2, /\[data-arena-slot\] > \[data-game-arena\][^}]*width: min\(100cqw, 100cqh \* var\(--arena-w\) \/ var\(--arena-h\)\)/);
assert.match(css2, /\[data-arena-slot\] > \[data-game-arena\][^}]*height: min\(100cqh, 100cqw \* var\(--arena-h\) \/ var\(--arena-w\)\)/);
assert.match(css2, /\[data-arena-slot\] \{[^}]*container-type: size;[^}]*align-items: center;[^}]*justify-content: flex-start/);
assert.match(css2, /\[data-arena-slot\] \{[^}]*background: var\(--screen-edge\);/, "slot paints the screen edge's black");
assert.match(css2, /\[data-arena-slot\]::after \{[^}]*background: var\(--screen-edge\);/, "the space below the world is the screen edge's black");
assert.doesNotMatch(css2, /--arena-fill/, "no per-game arena fill");
assert.match(css2, /--screen-edge: #070709;/);
// Arena scenes (15 Oct 2026; on the play screen itself since 17 Oct 2026): an untouchable layer under the column.
assert.match(css2, /\[data-arcade-play\] > :is\(\[data-arena-scene\], \[data-arena-ambient\]\) \{[^}]*position: absolute;[^}]*z-index: 0;[^}]*pointer-events: none;/, "arena scene is an untouchable layer on the play screen");
assert.match(css2, /\[data-arcade-play\] > \[data-game-column\] \{\s*z-index: 1;\s*\}/, "the world, header and controls paint over the scene");
assert.match(css2, /\[data-arcade-play\] \[data-arena-slot\] \[data-play-area\] \{\s*box-shadow: none;\s*\}/, "no ring round an arcade world");
{
  const slotSrc = readFileSync("src/components/puzzles/ArcadeArenaSlot.tsx", "utf8");
  assert.match(slotSrc, /data-arena-scene="" aria-hidden="true"/);
  assert.match(slotSrc, /closest<HTMLElement>\("\[data-arcade-play\]"\)/, "the scene paints on the arcade play screen only");
  assert.doesNotMatch(slotSrc, /onPointer|onClick|onTouch/, "the arena slot and its scene have no input handlers");
  for (const game of ARENA_SCENE_GAMES) {
    const file = readFileSync(`src/puzzles/${SCENE_FILES[game]}.tsx`, "utf8");
    assert.match(file, /scene=\{/, `${game}: stage passes its arena scene`);
  }
}
assert.match(css2, /@utility pad-game-safe \{[^}]*padding-bottom: calc\(env\(safe-area-inset-bottom, 0px\) \+ 16px\);/, "puzzles keep inset + 16px");
const bottomCss = readFileSync("src/polish-layout/bottom.css", "utf8");
assert.match(bottomCss, /\[data-arcade-play\] > \[data-game-column\] \{\s*padding-top: max\(4px, env\(safe-area-inset-top, 0px\)\);\s*padding-bottom: 16px;\s*padding-left: env\(safe-area-inset-left, 0px\);\s*padding-right: env\(safe-area-inset-right, 0px\);\s*\}/, "arcade play column: 4px or the notch on top, 16px at the bottom whatever the inset, no side insets");
assert.match(bottomCss, /html:has\(\[data-arcade-play\]\),\s*html:has\(\[data-arcade-play\]\) body,\s*\[data-arcade-play\] \{\s*background-color: var\(--screen-edge\);\s*\}/, "page and screen are the screen edge's black");
assert.match(bottomCss, /\[data-arcade-play\] > \.screen-background \{\s*display: none;\s*\}/);
assert.match(bottomCss, /\[data-arcade-play\] \[data-game-stage\] \{\s*row-gap: 8px;\s*\}/);
assert.match(bottomCss, /\[data-arcade-play\] \.game-column \[data-stage-column\] > \[data-arena-slot\] \+ \* \{\s*margin-top: calc\(8px - var\(--stage-gap\)\);\s*\}/);
assert.match(bottomCss, /\[data-arcade-play\] \[data-game-stage\] \[data-game-controls="arrows"\] \{\s*height: 52px;\s*padding-top: 0;\s*padding-bottom: 0;\s*align-items: end;\s*\}/);
assert.doesNotMatch(bottomCss, /padding-bottom: 8px;/, "the 8px arcade bottom is gone");
// iOS home-screen apps (15 Oct 2026): laid out in a viewport short by the top inset (WebKit bug 254868), the play
// screen adds the measured shortfall to its 100dvh height, so the column still ends 16px above the screen's bottom.
assert.match(bottomCss, /\[data-arcade-play\]\.game-viewport \{\s*height: min\(calc\(100dvh \+ var\(--standalone-short, 0px\)\), var\(--standalone-screen, 100000px\)\);\s*\}/, "the play screen reaches the bottom of the screen in an iOS home-screen app, never past it");
// Fix-up: html and body (100% of the short viewport, overflow hidden under game-lock) grow by the same shortfall,
// or they clip tall worlds and the lowest controls 48px above the screen's bottom.
assert.match(bottomCss, /html:has\(\[data-arcade-play\]\) \{\s*height: min\(calc\(100% \+ var\(--standalone-short, 0px\)\), var\(--standalone-screen, 100000px\)\);\s*\}/, "the page's root grows by the shortfall too (never past the screen), so html and body clip nothing above the screen's bottom");
assert.match(css2, /html,\s*body \{\s*height: 100%;\s*\}/, "body is 100% of html, so it grows with it");
assert.match(css2, /html\.game-lock,\s*body\.game-lock \{\s*overflow: hidden;\s*\}/, "the locked page clips at its own boxes");
assert.match(css2, /\[data-arena-slot\]\[data-arena-centred\]::before \{[^}]*flex: 1 1 0;[^}]*background: var\(--screen-edge\);/, "a centred slot splits its spare height evenly");
assert.match(readFileSync("src/puzzles/tilt.tsx", "utf8"), /fitWorld\s+centreWorld/, "Tilt's world is centred in its box");
const shell = readFileSync("src/components/duel/PhoneShell.tsx", "utf8");
// The game frame (Polish 2, 24 Oct 2026): every live round, arcade or puzzle, has one 60px header
// (polish-layout/game-frame.css): three columns, the timer's 48px column exactly centred, and the arena
// directly under it. It replaced the 44px arcade row (4px under the top, 4px to the arena: 52px) and the
// room's RoundLabel beside the timer (the frame's context line says "Round n of N").
const frameCss = readFileSync("src/polish-layout/game-frame.css", "utf8");
assert.match(frameCss, /\.game-frame-header \{[^}]*grid-template-columns: minmax\(0, 1fr\) 48px minmax\(0, 1fr\);[^}]*height: 60px;/, "one 60px header, the timer in the centre column");
assert.match(frameCss, /\.game-screen:is\(\[data-puzzle-play\], \[data-arcade-play\]\) > \[data-game-column\] \{\s*padding-top: env\(safe-area-inset-top, 0px\);\s*\}/, "the header starts just under the notch, or at the top");
assert.match(shell, /<div data-round-layout data-frame=\{arcade \? "arcade" : "puzzle"\} className="flex min-h-0 flex-1 flex-col animate-round-in">\s*\{header\}/, "no gap from the header to the arena");
assert.match(shell, /data-arcade-header=\{arcade \? "" : undefined\}/, "arcade play screens keep the header's data-arcade-header");
// Prompt R (23 Oct 2026): the four tab screens (never a game screen) draw AppHeader instead; every other screen
// keeps the old top bar, which gives way on every live round (the frame's header replaces it).
assert.match(shell, /\{tabs && !gameScreen \? <AppHeader \/> : !bare && !framePlay && \(/, "the shell's own top bar gives way on live rounds");
// The live "finished" ping (17 Oct 2026) is laid over the header's left half (relative, the ping absolute), never in its flow.
assert.match(shell, /<div data-header-left className="game-frame-left">[\s\S]*?\{ping\}\s*<\/div>/, "the ping lies over the left half");
assert.match(frameCss, /\.game-frame-left \{\s*position: relative;/, "the left half holds the ping");
assert.match(shell, /useStandaloneShortfall\(arcadePlay && constrained\);/, "the play screen measures an iOS home-screen app's shortfall");
assert.match(shell, /\(navigator as Navigator & \{ standalone\?: boolean \}\)\.standalone !== true\) return null;/, "only in an iOS home-screen app");
assert.match(shell, /shortfall\.px = geometry && shortfall\.screen > 0 \? Math\.round\(geometry\.inset\) : 0;/, "the growth is the top inset, capped by the screen's height (18 Oct 2026)");
assert.match(shell, /setRootVar\("--standalone-screen", want \? `\$\{shortfall\.screen\}px` : ""\);/, "the screen's height caps the grown play screen");
// No feedback (16 Oct 2026): measured once per geometry with the root's growth taken off first, written only on a change.
assert.match(shell, /if \(key !== shortfall\.key\) \{/, "the shortfall is measured once per screen size, orientation and inset");
assert.doesNotMatch(shell.split("function applyShortfall")[1]?.split("function useStandaloneShortfall")[0] ?? "", /getBoundingClientRect|100dvh|innerHeight/, "the growth and cap never read the layout, so they cannot feed back");
assert.match(shell, /if \(root\.style\.getPropertyValue\(name\) === value\) return;/, "an unchanged value writes nothing");
assert.match(readFileSync("src/components/puzzles/ArcadeArenaSlot.tsx", "utf8"), /if \(at === painted\) return;/, "the arena scene repaints only when its integer canvas size or the world's place changes");
/** Px from the top of the screen to the arena slot: the notch's inset (or 0) + the frame's 60px header (Polish 2). */
const HEADER_AT = (inset: number) => inset + 60;
const HEADER = HEADER_AT(0);
/** Games whose world sits centred vertically in its box (the spare height split above and below). */
const CENTRED = new Set(["tilt"]);
/** Since the screen fill-ins (17 Oct 2026): also centred on the play screen (ARENA_FILL_CENTRED; history above keeps CENTRED). */
const PLAY_CENTRED = new Set<string>(["tilt", "pinball", "snake", "snip", "matchup", "whack"]);
/** Px from the bottom of the visible screen to the end of an arcade play column, inset or not. */
const ARCADE_BOTTOM = 16;
/** The game's own HUD rows between the header and the slot (each with the stage column's gap under it). */
const ABOVE: Record<string, number> = {
  snip: 20 + 4,
  tendrop: 56,
  // Bonk: the rule box (10px padding each side, 36px text at line-height 1.1, 2px border each side) and the 20px hit line, 8px gaps.
  whack: (10 + 36 * 1.1 + 10 + 4) + 8 + 20 + 8,
  // Pull!: the 12px hit line and 6px pips, 4px gaps.
  clayshoot: 12 + 4 + 6 + 4,
};
/** Height taken below each slot: 8px gap + control row (Swish: its 72px cancel strip, flush). */
// Orbit: none since 27 Oct 2026 (SET CHECKPOINT is laid over the play area; its 450 x 839 view reaches the bottom).
const BELOW: Record<string, number> = { burst: 8 + 76, inkbridge: 8 + 48, balltrack: 8 + 28, bintoss: 72, stroop: 8 + 52 };
const BELOW_CONTROLS: Record<string, string> = {
  burst: "Fission's two 76px arrows", inkbridge: "Rainbow Bridge's Undo / Reset / Release / Drop again (48px)", orbit: "Orbit's SET CHECKPOINT (44px row)",
  balltrack: "Ball Tracker's status row (28px)", bintoss: "Swish's cancel strip (72px)", stroop: "Mixed Signals' arrows (44px) and joystick (52px), bottom-aligned",
};
/** Until 15 Oct 2026: arena top, the bottom term and the rows below (OLD_BELOW), 4px side insets. */
const OLD_TOP = (game: string) => 116 + (game === "snip" ? 40 : 0) + (game === "tilt" ? 40 : 0);
const OLD_BELOW: Record<string, number> = { burst: 12 + 80, inkbridge: 12 + 48, orbit: 12 + 76, balltrack: 12 + 28, bintoss: 72 };
/** Smallest touch target edge in each control row, by viewport width. */
const TARGETS: Record<string, (w: number) => number> = {
  burst: (w) => (w - 8 - 16) / 2,
  inkbridge: (w) => Math.min(48, (w - 8 - 3 * 6) / 4),
  orbit: () => 44,
  stroop: (w) => Math.min(44, (w - 16 - 44 - 12 - 2 * 12) / 3),
};
/** Engine games on the arcade stage: their world (view) size. Bonk's world is its square board. */
const ENGINE_WORLDS: Record<string, { width: number; height: number }> = {
  wordfall: ENGINE_FX_SPECS.wordfall,
  tendrop: { width: TD_W, height: TD_H },
  whack: { width: 1, height: 1 },
  // Taller worlds batch 2 (16 Oct 2026): the worlds rooms deal today (clayRev 6, clashRev 5).
  clayshoot: { width: CLAY_W, height: CLAY_TALL_H },
  stroop: { width: CLASH_WORLD_W, height: CLASH_TALL_H },
};
let arenaChecks = 0;
/** Viewports; the third number is the top safe-area inset (414x896: an iPhone 11 with its 48px notch and 34px home bar). */
const ARENA_SIZES = [[375, 667, 0], [390, 700, 0], [390, 844, 0], [414, 896, 48], [430, 932, 0], [1280, 800, 0]] as const;
/** iPhone 11 home-screen app before the 15 Oct 2026 fix: laid out 48px short (100dvh 848 of 896), ending 64px up. */
const IPHONE11 = { w: 414, h: 896, top: 48, short: 48 };
/** Per game: the box (slot) and world (arena) at each viewport, then scale and spare space at 390x844. */
const arenaTable = new Map<string, { world: string; sizes: string[]; detail: string; before: string[]; iphone: string; cut: string }>();
const WORLDS = { ...(ARCADE_FX_SPECS as Record<string, { width: number; height: number }>), ...ENGINE_WORLDS };
for (const [width, height, inset] of ARENA_SIZES) {
  for (const [game, spec] of Object.entries(WORLDS)) {
    const top = HEADER_AT(inset) + (ABOVE[game] ?? 0);
    const slotW = width, slotH = height - ARCADE_BOTTOM - top - (BELOW[game] ?? 0);
    const scale = Math.min(slotW / spec.width, slotH / spec.height);
    const w = spec.width * scale, h = spec.height * scale;
    assert.ok(w <= slotW + 1e-9 && h <= slotH + 1e-9, `${game} ${width}x${height}: fits`);
    assert.ok(Math.abs(w - slotW) < 1e-9 || Math.abs(h - slotH) < 1e-9, `${game} ${width}x${height}: largest fit`);
    assert.ok(Math.abs(w / h - spec.width / spec.height) < 1e-9, `${game} ${width}x${height}: uniform`);
    assert.ok(slotH > 0 && top + slotH + (BELOW[game] ?? 0) + ARCADE_BOTTOM === height, `${game} ${width}x${height}: column ends 16px above the bottom`);
    if (TARGETS[game]) assert.ok(TARGETS[game]!(width) >= 44, `${game} ${width}x${height}: 44px targets`);
    const entry = arenaTable.get(game) ?? { world: game === "whack" ? "square" : `${spec.width}x${spec.height}`, sizes: [], detail: "", before: [], iphone: "", cut: "" };
    entry.sizes.push(`${slotW}x${slotH.toFixed(0)} → ${w.toFixed(0)}x${h.toFixed(0)}`);
    if (width === IPHONE11.w && height === IPHONE11.h) {
      // The home-screen app before the fix: the same column in a 48px shorter layout viewport.
      const oldH = slotH - IPHONE11.short;
      const oldScale = Math.min(slotW / spec.width, oldH / spec.height);
      const gap = ARCADE_BOTTOM + IPHONE11.short;
      entry.iphone = `${slotW}x${oldH.toFixed(0)} → ${(spec.width * oldScale).toFixed(0)}x${(spec.height * oldScale).toFixed(0)}, ${gap}px | ${slotW}x${slotH.toFixed(0)} → ${w.toFixed(0)}x${h.toFixed(0)}, ${ARCADE_BOTTOM}px`;
      // Between the fix and its fix-up, html and body still clipped at the short viewport (848px): what the
      // world (top-anchored, or centred) and the lowest control row lost.
      const clipAt = height - IPHONE11.short;
      const worldTop = top + (CENTRED.has(game) ? (slotH - h) / 2 : 0);
      const worldCut = Math.max(0, worldTop + h - clipAt);
      const controlCut = BELOW[game] ? Math.max(0, height - ARCADE_BOTTOM - clipAt) : 0;
      entry.cut = `${worldCut ? `world ${worldCut.toFixed(0)}px` : "world none"}${BELOW[game] ? `, ${BELOW_CONTROLS[game]} ${controlCut.toFixed(0)}px` : ""}`;
    }
    if (inset === 0 && game in ARCADE_FX_SPECS) {
      // Every arcade arena is larger than before 15 Oct 2026, at every size.
      const oldW = width - 8, oldH = height - 8 - OLD_TOP(game) - (OLD_BELOW[game] ?? 0);
      const oldScale = Math.min(oldW / spec.width, oldH / spec.height);
      assert.ok(scale > oldScale, `${game} ${width}x${height}: larger than before (${oldScale.toFixed(3)} → ${scale.toFixed(3)})`);
      entry.before.push(`${oldW}x${oldH} → ${(spec.width * oldScale).toFixed(0)}x${(spec.height * oldScale).toFixed(0)}`);
    }
    const spare = slotH - h, above = PLAY_CENTRED.has(game) ? spare / 2 : 0;
    if (width === 390 && height === 844) entry.detail = `${scale.toFixed(3)}x | ${top}px | ${above.toFixed(0)}px | ${(spare - above).toFixed(0)}px | ${(slotW - w).toFixed(0)}px | ${BELOW[game] ? `${BELOW_CONTROLS[game]}: 16px` : "-"}`;
    arenaTable.set(game, entry);
    arenaChecks++;
  }
}
const gameCount = Object.keys(WORLDS).length;
console.log(`PASS ${arenaChecks} arcade play-screen geometries (${gameCount} games × 375x667, 390x700, 390x844, 414x896 with a 48px notch, 430x932, 1280x800): 60px header (108px under the notch), edge-to-edge box, uniform world-aspect, largest fit, column 16px above the bottom, lowest control row 16px up, control targets ≥44px, every arcade arena larger than before.`);
// The arena table is project documentation, not a Lovable audit: docs/, never .lovable/.
const PHONE_SIZES = ARENA_SIZES.map(([w, h, inset]) => `${w}x${h}${inset ? ` (${inset}/34px insets)` : ""}`);
writeFileSync("docs/arena-sizes-oct-2026.md", [
  "# Arcade arena sizes (Oct 2026)", "",
  "Generated by `bun scripts/presentation-geometry-check.tsx` from the CSS arithmetic of the arcade play screen",
  "(polish-layout/bottom.css, \"Arcade play screen\", and styles.css, \"Arcade arena slot\"), 15 Oct 2026. Every arcade game",
  "and every engine game on the arcade stage (Letterfall, Tenfall, Bonk, Pull!, Mixed Signals) has the game frame's 60px header",
  "(Polish 2, 24 Oct 2026: the game and its context left, the timer centred, the score, \"?\" and sound right) at the top or just under a notch, and the box",
  "(the arena slot) starts directly under it (60px down without a notch), below any of the game's own HUD rows. The box runs edge",
  "to edge and down to the controls (8px above them) or 16px above the bottom of the visible screen; the lowest control row",
  "ends exactly 16px above it. A home-bar inset does not change any of it (a notch moves the header and box down by its inset).",
  "That holds in an iOS home-screen app too, whose layout viewport is short by the top inset (WebKit bug 254868): the play",
  "screen, and the page's html and body, add the shortfall to their height (15 Oct 2026 and its fix-up; arcade-device-bottom-check,",
  "arcade-play-check and bottom-clearance-check reproduce it in Chromium and prove nothing clips).",
  "The world is drawn at the largest uniform scale that fits the box, top-anchored (Tilt, and since 17 Oct 2026 Pinball, Meteor,",
  "Scrumper and Gemstone: centred) and centred across. Since the screen fill-ins (17 Oct 2026) every arcade game's space round",
  "its world is its own scene out to the screen's edges (Arena scenes, below); the engine games without one keep the screen",
  "edge's black (#070709). Sizes are CSS px, width x height, box → world. Analytic geometry, cross-checked in the",
  "browser by arcade-play-check; not device measurements.", "",
  "Worlds are the revisions rooms deal today. Taller worlds: Tuning E (13 Oct 2026) Hover hoverRev 5, High Rise skylineRev 4,",
  "Meteor snakeRev 5, Scrumper snipRev 5; batch 1 (16 Oct 2026) Breaker brkRev 6, Rally rallyRev 6, Wavefront wavRev 6 (390x730),",
  "Fission burstRev 4 (390x650); batch 2 (16 Oct 2026) Tempo beatRev 6, Slice sliceRev 6, Coral Pop bubbleRev 5 (390x730),",
  "Mixed Signals clashRev 5 (390x650) and Pull! clayRev 6 (360x680, so it draws 390x737 at 390px wide). Stored rounds on older",
  "revisions keep their own world in reveals and replays.", "",
  `| Game | World | ${PHONE_SIZES.join(" | ")} | Scale at 390x844 | Box top | Spare above | Spare below | Spare across | Bottom control (gap to bottom) |`,
  `|---|---|${ARENA_SIZES.map(() => "---").join("|")}|---|---|---|---|---|---|`,
  ...[...arenaTable].map(([game, { world, sizes, detail }]) => `| ${gameDisplayName(game as never)} | ${world} | ${sizes.join(" | ")} | ${detail} |`), "",
  "## Arena scenes (15 Oct 2026; screen fill-ins 17 Oct 2026)", "",
  "These games paint their own scene behind the world on the play screen only (src/lib/arcade/arenaScene.renderer.ts,",
  "ARENA_SCENE_GAMES; the fill-ins in arenaFills.renderer.ts). Since 17 Oct 2026 the scene canvas is the whole play screen:",
  "it runs from the world's edges to the screen's bottom (behind the controls, the 16px strip and the home bar) and sides,",
  "the header row staying black (Gemstone's velvet runs behind it too). The world box is unchanged (same size, scale and",
  "pointer mapping). The scene is drawn once per screen size (never per frame) on a pointer-events: none canvas, so a tap or",
  "drag in it reaches no game handler and records no input; seven games add a slow moving layer over it (lights, notes,",
  "stars, walkers, lava, reactions) that holds still under reduced motion or reduced effects. Box → world per size.", "",
  `| Game | ${PHONE_SIZES.join(" | ")} | Scene beyond the world |`,
  `|---|${ARENA_SIZES.map(() => "---").join("|")}|---|`,
  ...ARENA_SCENE_GAMES.map((game) => `| ${gameDisplayName(game)} | ${arenaTable.get(game)?.sizes.join(" | ") ?? "-"} | ${ARENA_SCENE_NOTES[game]} |`), "",
  "## iPhone 11 home-screen app, before and after the 15 Oct 2026 fix", "",
  "414x896 with a 48px notch and 34px home bar. Before, the app was laid out in WebKit's 848px viewport and the column ended",
  "16px above that: 64px above the bottom of the screen (measured on a device as about 65px). Box → world, then the gap from the",
  "lowest control (or the box) to the bottom of the screen. Safari (toolbars collapsed) was already the \"after\" column.",
  "The fix alone left html and body at the 848px viewport, and locked (overflow hidden) they cut everything under it: the last",
  "column is what each game lost until the fix-up (same day) grew the page's root by the shortfall too (seen on a device as",
  "Meteor's missing bottom border, High Rise's cut block, Orbit's SET CHECKPOINT and Mixed Signals' arrows and joystick more",
  "than half hidden; Hover's world is cut the same way, its disc at the top).", "",
  "| Game | Before (home-screen app) | After | Cut at 848px between fix and fix-up |",
  "|---|---|---|---|",
  ...[...arenaTable].map(([game, { iphone, cut }]) => `| ${gameDisplayName(game as never)} | ${iphone} | ${cut} |`), "",
  "## Before 15 Oct 2026 (arcade games)", "",
  "Box top 116px (Scrumper 156px, Tilt 156px), 4px side insets, ending at the controls (12px above them) or 8px above the",
  "bottom; the spare space was the game's arena fill or the page colour. Same arithmetic, box → world.", "",
  `| Game | ${PHONE_SIZES.filter((_, i) => !ARENA_SIZES[i]![2]).join(" | ")} |`,
  `|---|${ARENA_SIZES.filter(([, , inset]) => !inset).map(() => "---").join("|")}|`,
  ...[...arenaTable].filter(([game]) => game in ARCADE_FX_SPECS).map(([game, { before }]) => `| ${gameDisplayName(game as never)} | ${before.join(" | ")} |`), "",
].join("\n"));
mkdirSync(".lovable/audits", { recursive: true });
writeFileSync(".lovable/audits/presentation-geometry-oct6.md", [
  "# Presentation geometry audit", "", "No browser tests. PASS means source/SSR and analytic geometry, not measured device rendering or no-scroll certification.", "",
  "| Presentation | Size | Result |", "|---|---|---|", ...rows, "",
  "The live Wordsmith board retains its height/width-fitting square and all existing fixed chip/action slots. Its reveal now adds a 160px shared board; existing long word lists can still require internal scrolling. Sudoku retains its previous board dimensions; Shikaku remains two 170px-max squares with a 12px gutter. No generators, grading or scoring changed. Actual fit and appearance remain for user device checks.", "",
].join("\n"));
console.log(`PASS ${checks} source/SSR phase checks plus both-size orbit/cell/label geometry; crash marker source check passed. Device fit unverified.`);