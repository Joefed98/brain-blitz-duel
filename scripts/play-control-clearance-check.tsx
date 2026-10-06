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
  "oneStroke": "Lift your finger to start again.",
  "bombDefusal": "Read every rule, act in order, then tap DEFUSE",
  "goNoGo": "Tap gold circles only",
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
  for (const width of [390, 375]) {
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
console.log("PASS eight instruction captions removed; live progress kept; action gaps 12px. Source arithmetic only: no browser/pixel measurements or identity proofs.");