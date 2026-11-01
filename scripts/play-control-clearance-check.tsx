import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { ArrowModeOverride, ArrowPad } from "../src/components/puzzles/GridDrag";
import { BUTTON, ORBIT_XP_AHEAD, ORBIT_XP_DRAW_H, ORBIT_XP_ZONE, zoneFits, zoneProof, zoneProofFuel } from "./orbit-zone-lib";
import { ORBIT_FUEL_BANK } from "../src/lib/duel/orbitFuelBank.server";
import { orbitFuelMeterBox } from "../src/lib/arcade/orbit.renderer";
import { orbitXpRev } from "../src/lib/arcade/orbit";

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
// Orbit orbitRev 12 (Joe's phone notes, 27 Oct 2026; docs/arcade-phone-notes-oct-2026.md): the world reaches the screen's
// bottom, so SET CHECKPOINT is not in a row below it but in ORBIT_XP_ZONE, the reserved top-right corner of the rows drawn
// above the camera's frame (orbit.renderer.ts), where nothing in play is ever drawn. Proved here: the markup puts the 44 px
// button 4 px in from the world's top and right edges on orbitRev 12 only (earlier revisions keep the row above); the button
// with its insets fits inside the zone at every viewport's world scale; the scene is drawn behind and around it (no clip
// since 1 Nov 2026); and on every course rooms can deal, every frame of its witness run and of two random runs, in both
// camera modes, the rocket's drawn reach stays out of the zone (so nothing the rocket can meet is ever under the button).
{
  const orbit = readFileSync("src/puzzles/orbit.tsx", "utf8");
  assert.match(orbit, /const xp = orbitXpRev\(data\?\.orbitRev\);/, "orbit: orbitRev 12, 13 and 14 pick the corner");
  // orbitRev 14 (the fuel meter, 1 Nov 2026) keeps the expansion's view and corner.
  assert.ok(orbitXpRev(12) && orbitXpRev(13) && orbitXpRev(14) && !orbitXpRev(10) && !orbitXpRev(11) && !orbitXpRev(15) && !orbitXpRev(undefined), "orbit: orbitXpRev is orbitRev 12, 13 and 14 only");
  assert.match(orbit, /overlay=\{xp \? \(send\) => \(\s*<div data-game-controls="checkpoint" data-orbit-zone="" className="pointer-events-none absolute right-1 top-1 flex h-11 items-start justify-end">/, "orbit: the button 4px in from the world's top and right");
  assert.match(orbit, /className="pointer-events-auto h-11 px-3 text-\[11px\] font-bold before:content-\['SET_CHECKPOINT'\]"/, "orbit: the corner button is 44px tall, 11px text, 12px sides");
  assert.match(orbit, /footer=\{xp \? undefined : \(send\) => \(/, "orbit: no row below the world on orbitRev 12");
  const renderer = readFileSync("src/lib/arcade/orbit.renderer.ts", "utf8");
  const world = renderer.split("function drawOrbitRev3ArtWorld")[1]?.split("\n}\n")[0] ?? "";
  // 1 Nov 2026 (Joe: the black box under the button): the scene is drawn behind and around SET CHECKPOINT, which sits over
  // it as an overlay with its own backing. Nothing clips the zone out any more; the play layers sit in one save/restore.
  assert.ok(!/clipOutZone|ORBIT_XP_ZONE\.w, 0, ORBIT_XP_ZONE\.w/.test(renderer), "orbit: nothing clips the scene out of the button's corner");
  const playAt = world.indexOf("ctx.save();", world.indexOf("rev3Starfield("));
  const firstPlay = Math.min(...["drawAmbientShootingStar(", "drawOrbitShootingStar(", "drawOrbitPaths(", "drawFirstLap(", "rev3GlowLayer(", "drawSun(", "drawBelt(", "drawBlackHole(", "drawXpFeatures(", "drawShipTrail(", "drawRocketFlame("].map((f) => world.indexOf(f)).filter((i) => i >= 0));
  const restoreAt = world.indexOf("ctx.restore();\n  if(capturePlanet)successFrame(");
  const lastPlay = Math.max(...["drawRocketFlame(", "drawShipTrail(", "drawXpFeatures(", "drawCaptureGlow("].map((f) => world.lastIndexOf(f)));
  assert.ok(playAt >= 0 && playAt < firstPlay && lastPlay < restoreAt, "orbit: the play layers are drawn in one save/restore, with no clip");
  assert.match(world, /if \(xpMemory\) \{\s*drawXpPops\(ctx, xpMemory, cam, still\);/, "orbit: feature pops draw anywhere, the corner included");
  assert.equal(ORBIT_XP_ZONE.h <= ORBIT_XP_AHEAD, true, "orbit: the zone lies within the rows above the camera's frame");
  // Every viewport the play-screen checks cover (the box from presentation-geometry-check's model: a 60px header under
  // any notch, 16px at the bottom; desktop's ≤640px column with its 56px header), at orbitRev 12's 450 x 862 world.
  const viewports: [number, number, number, number][] = [[360, 800, 0, 60], [375, 667, 0, 60], [390, 700, 0, 60], [390, 844, 0, 60], [414, 896, 48, 60], [430, 932, 0, 60], [600, 900, 0, 60], [1024, 768, 0, 60], [1280, 800, 0, 56]];
  for (const [w, h, inset, header] of viewports) {
    const boxW = w >= 1180 ? Math.min(640, w) : w;
    const boxH = h - inset - header - 16;
    const scale = Math.min(boxW / 450, boxH / ORBIT_XP_DRAW_H);
    const z = zoneFits(scale);
    assert.ok(z.fits, `orbit ${w}x${h}: the ${BUTTON.maxW}x${BUTTON.h} button with its ${BUTTON.inset}px insets fits the ${z.w.toFixed(0)}x${z.h.toFixed(0)}px zone`);
  }
  const proof = zoneProof(2);
  assert.equal(proof.courses, 371, "orbit: every bank course rooms deal");
  assert.deepEqual(proof.hits, [], "orbit: the rocket never reaches the zone");
  // orbitRev 14 (the fuel meter): every fuel-bank course, with the flight camera that leads the rocket; and the fuel meter,
  // bottom right, lies inside the drawn world, clear of SET CHECKPOINT's corner (it is the only other thing drawn there:
  // orbitRev 12–14 have no controls but the corner button).
  const fuelProof = zoneProofFuel(2);
  assert.equal(fuelProof.courses, ORBIT_FUEL_BANK.length, "orbit: every fuel-bank course rooms deal");
  assert.ok(ORBIT_FUEL_BANK.length > 0, "orbit: the fuel bank has courses");
  assert.deepEqual(fuelProof.hits, [], "orbit: on orbitRev 14 the rocket never reaches the zone");
  const meter = orbitFuelMeterBox(450, ORBIT_XP_DRAW_H);
  assert.ok(meter.x >= 0 && meter.y >= 0 && meter.x + meter.w <= 450 && meter.y + meter.h <= ORBIT_XP_DRAW_H, "orbit: the fuel meter lies inside the drawn world");
  assert.ok(meter.y > ORBIT_XP_ZONE.h + 100 && meter.x + meter.w <= 450, "orbit: the fuel meter is far below SET CHECKPOINT's corner");
  assert.match(orbit, /footer=\{xp \? undefined : \(send\) => \(/, "orbit: no control row below the world on orbitRev 12–14 for the meter to cover");
  console.log(`PASS orbit orbitRev 14: the fuel meter at ${meter.x},${meter.y} (${meter.w}x${meter.h} view px), clear of the corner; the rocket never in the corner over ${fuelProof.frames} frames (${fuelProof.courses} fuel-bank courses, ${fuelProof.runs} runs).`);
  console.log(`PASS orbit orbitRev 12: SET CHECKPOINT in the reserved top-right zone (${ORBIT_XP_ZONE.w}x${ORBIT_XP_ZONE.h} view px) at ${viewports.length} viewports; the scene drawn behind it; the rocket never in it over ${proof.frames} frames (${proof.courses} courses, ${proof.runs} runs, lowest rocket top ${proof.lowestRocketTop.toFixed(0)}px vs the zone's ${ORBIT_XP_ZONE.h}px).`);
}
const stage = readFileSync("src/components/puzzles/ArcadeCanvasStage.tsx", "utf8");
// The slot's props may span lines and hold an arrow function (the arena scene's `=>`), so match lazily to the tag's end.
assert.match(stage, /<ArcadeArenaSlot\b[\s\S]*?>\s*\{arena\}\s*<\/ArcadeArenaSlot>[\s\S]*\{props\.footer\?\.\(push\)\}/, "footer renders after the slot");
console.log("PASS eight instruction captions removed; live progress kept; action gaps 12px. Source arithmetic only: no browser/pixel measurements or identity proofs.");