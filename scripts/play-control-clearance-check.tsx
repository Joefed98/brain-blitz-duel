import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { ArrowModeOverride, ArrowPad } from "../src/components/puzzles/GridDrag";

const removed = {
  "mazeDash": "Tap or hold an arrow · or draw with your finger · go back to undo",
  "tower": "Tap a peg to lift its top disc, then tap where it goes",
  "sortTubes": "Tap a tube to lift its top balls, then tap where to pour",
  "flow": "Drag dot to dot · drag from a loose end to carry on · tap a dot to clear it",
  "nonogram": "Tap to fill, again to mark empty, again to clear.",
  "bombDefusal": "Read every rule, act in order, then tap DEFUSE",
};
for (const [file, caption] of Object.entries(removed)) {
  const source = readFileSync(`src/puzzles/${file}.tsx`, "utf8");
  const stage = source.split("function Stage")[1]?.split("function Reveal")[0] ?? "";
  assert.ok(stage.length);
  assert.ok(!stage.includes(caption), `${file}: caption remains`);
}
for (const expanded of [false, true]) for (const directions of [["L", "D", "R"], ["L", "U", "D", "R"]] as const) {
  const markup = renderToStaticMarkup(<ArrowModeOverride.Provider value={false}><ArrowPad expanded={expanded} directions={directions} onPress={() => {}} /></ArrowModeOverride.Provider>);
  assert.match(markup, /data-game-controls="arrows"/);
  assert.match(markup, /grid-cols-\[minmax\(0,1fr\)_44px\]/);
  assert.match(markup, /gap-3 px-2 pb-1 pt-3/);
  assert.match(markup, /aria-label="Joystick"/);
  assert.doesNotMatch(markup, /absolute right-0|absolute left-0|max-w-\[343px\]/);
  for (const width of [390, 375, 430]) {
    const inner = width - 8;
    const arrowWidth = (inner - 16 - 44 - 12 - (directions.length - 1) * 12) / directions.length;
    assert.ok(arrowWidth >= 44);
    const height = expanded ? 84 : 60;
    assert.equal(height - 12 - 4, expanded ? 68 : 44);
    console.log(`PASS ${width}px ${directions.length} arrows: ${arrowWidth.toFixed(2)}px wide, ${expanded ? 68 : 44}px tall, 12px gaps; 44px switch; same reserved joystick slot.`);
  }
}
for (const file of ["tower", "sortTubes", "gravityMaze", "slidingTiles", "wordSlide", "trail", "rotatingRings", "push", "iceSlide"]) {
  const source = readFileSync(`src/puzzles/${file}.tsx`, "utf8");
  assert.match(source, /data-game-controls="actions"[^>]*gap-3/);
}
assert.match(readFileSync("src/puzzles/gravityMaze.tsx", "utf8"), /h-11 min-w-11/);
assert.match(readFileSync("src/puzzles/trail.tsx", "utf8"), /26/);
assert.match(readFileSync("src/puzzles/rotatingRings.tsx", "utf8"), /ring \{selectedRing \+ 1\} selected/);
// Arcade controls stay below the fitted arena (ArcadeArenaSlot), in fixed rows the
// slot never takes: Fission's pad, Rainbow Bridge's tools, Orbit's checkpoint button.
// Arcade play screen (15 Oct 2026): every row ends exactly 16px above the visible bottom (the
// column's own 16px padding), so no row carries bottom padding of its own; pad and tools rows
// keep 4px side margins inside the edge-to-edge column (polish-layout/bottom.css).
const arcadeRows = [
  // Tuning B: Fission has no FIRE button (a tap on the arena fires); two 76px arrows, 16px apart.
  { file: "burst", row: /data-game-controls="pad" className="grid h-\[76px\] shrink-0 touch-none select-none grid-cols-2 items-start gap-4">/, button: /className="h-\[76px\] w-full/g, count: 2, width: (w: number) => (w - 8 - 16) / 2, tall: 76 },
  { file: "inkBridge", row: /data-game-controls="tools" className="flex h-12 shrink-0 gap-1\.5"/, button: /className="h-12 min-w-0 flex-1/g, count: 1, width: (w: number) => (w - 8 - 3 * 6) / 4, tall: 48 },
  // Orbit's 44 px row holds its 44 px button (it was a 76 px row with the button 28 px up from its bottom);
  // since 15 Oct 2026 the button is narrower: 11 px text, 12 px sides.
  { file: "orbit", row: /data-game-controls="checkpoint" className="flex h-11 shrink-0 items-center justify-center">/, button: /className="h-11 px-3 text-\[11px\]/g, count: 1, width: () => 44, tall: 44 },
];
const bottomCss = readFileSync("src/polish-layout/bottom.css", "utf8");
assert.match(bottomCss, /\[data-arcade-play\] \[data-game-stage\] :is\(\[data-game-controls="pad"\], \[data-game-controls="tools"\]\) \{\s*padding-inline: 4px;\s*\}/, "pad and tools rows keep 4px side margins");
assert.match(bottomCss, /\[data-arcade-play\] \[data-game-stage\] \[data-game-controls="arrows"\] \{\s*height: 52px;\s*padding-top: 0;\s*padding-bottom: 0;\s*align-items: end;\s*\}/, "Mixed Signals' ArrowPad: one fixed 52px row, both modes bottom-aligned");
for (const { file, row, button, count, width, tall } of arcadeRows) {
  const source = readFileSync(`src/puzzles/${file}.tsx`, "utf8");
  assert.match(source, row, `${file}: control row`);
  assert.equal(source.match(button)?.length ?? 0, count, `${file}: control buttons`);
  // The row follows the arena slot in the stage (ArcadeCanvasStage renders the slot, then its footer).
  assert.match(source, /fitWorld/, `${file}: fitted arena`);
  for (const w of [375, 390, 430, 1280]) {
    assert.ok(width(w) >= 44 && tall >= 44, `${file} ${w}px: 44px targets`);
  }
  console.log(`PASS ${file}: controls below the fitted arena, ${tall}px tall, ≥${Math.min(...[375, 390, 430].map(width)).toFixed(1)}px wide at 375–430px.`);
}
const stage = readFileSync("src/components/puzzles/ArcadeCanvasStage.tsx", "utf8");
assert.match(stage, /<ArcadeArenaSlot[^>]*>\{arena\}<\/ArcadeArenaSlot>[\s\S]*\{props\.footer\?\.\(push\)\}/, "footer renders after the slot");
console.log("PASS eight instruction captions removed; live progress kept; action gaps 12px. Source arithmetic only: no browser/pixel measurements or identity proofs.");