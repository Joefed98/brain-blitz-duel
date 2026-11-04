import { strict as assert } from "node:assert";
import { BULLSEYE_RING_VALUES, bullseyeInit, bullseyeRingValue, bullseyeValueColour, bullseyeScoreFor } from "@/lib/arcade/bullseye";
import { bandUnitsFor } from "@/lib/arcade/scoreBands";
import { LIVE_BANDS } from "@/lib/arcade/liveBands";
import { stdHelp, stdHelpLines, type StdSpec } from "@/lib/arcade/arcadeStandard";
import { crossGame, crossTotalLanes } from "@/lib/arcade/cross";
import { buildArcadeReveal } from "@/lib/arcade/reveal";
import { flipGame, flipWarpAt, FLIP_FLOOR_Y, FLIP_CEIL_Y } from "@/lib/arcade/flip";
import { drawFlipHazard, flipSurfaceLine } from "@/lib/arcade/flip.renderer";
import { INTRO_SCORE } from "@/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "@/lib/duel/instructions";

assert.deepEqual([...BULLSEYE_RING_VALUES], [10, 9, 8, 3, 2, 1]);
for (let seed = 1; seed <= 200; seed++) {
  const state = bullseyeInit(seed);
  assert.deepEqual(state, bullseyeInit(seed));
  for (let arrow = 0; arrow < 10; arrow++) {
    const values = state.ringValues[arrow] ?? [];
    assert.deepEqual([...values].sort((a, b) => b - a), [...BULLSEYE_RING_VALUES]);
    if (arrow < 6) assert.deepEqual(values, [...BULLSEYE_RING_VALUES]);
    else assert.notDeepEqual(values, [...BULLSEYE_RING_VALUES]);
    values.forEach((value, ring) => {
      assert.equal(bullseyeRingValue(ring, values), value);
      assert.equal(bullseyeValueColour(value), bullseyeValueColour(BULLSEYE_RING_VALUES.find((v) => v === value) ?? 0));
    });
  }
}
for (let total = 0; total <= 100; total++) assert.equal(bullseyeScoreFor(total), Math.max(0, Math.floor(17 * total / 10 - 20)));
assert.equal(bullseyeScoreFor(100), 150);
const base = crossGame.init(123);
for (let crossings = 0; crossings <= 10; crossings++) {
  for (let reached = 0; reached <= 9; reached++) {
    const state = { ...base, crossings, reached };
    const lanes = crossings * 9 + reached;
    const score = Math.min(150, 2 * lanes + 4 * crossings);
    assert.equal(crossTotalLanes(state), lanes);
    assert.equal(crossGame.score(state), score);
    assert.equal(crossGame.score({ ...state, clean: crossings }), score);
    const reveal = buildArcadeReveal("cross", { lanes, crossings, livesLost: 1 }, score);
    assert.ok(reveal);
    assert.equal(reveal.lines[0], `${lanes} lanes × 2 = ${lanes * 2}`);
    assert.equal(reveal.lines[1], `${crossings} crossings × 4 = ${crossings * 4}`);
    assert.equal(reveal.tiles[0]?.value, String(lanes));
    assert.equal(reveal.tiles[1]?.value, String(crossings));
    assert.ok(!JSON.stringify(reveal).includes("Clean"));
  }
}

// Capture every draw vertex without a browser. Use exactly the sim's border offset.
let points: [number, number][] = [];
const context = new Proxy({}, {
  get: (_target, key) => key === "moveTo" || key === "lineTo"
    ? (x: number, y: number) => points.push([x, y])
    : () => {},
  set: () => true,
}) as CanvasRenderingContext2D;
for (let seed = 1; seed <= 10; seed++) {
  const initial = flipGame.init(seed);
  for (let tick = 1200; tick <= 3600; tick++) {
    const state = { ...initial, tick, x: tick * 1024 };
    for (const side of [0, 1]) {
      const baseY = side === 0 ? FLIP_FLOOR_Y : FLIP_CEIL_Y;
      const surface = (x: number) => baseY + flipWarpAt(state, side, state.x + (x - 90) * 256);
      const dir = side === 0 ? -1 : 1;
      for (const kind of ["spike", "gap", "overhang"] as const) {
        points = [];
        drawFlipHazard(context, kind, 40, 350, dir, surface, "test-colour");
        assert.ok(points.length > 3);
        for (const [x, y] of points) {
          const inward = (y - surface(x)) * dir;
          if (kind === "gap") assert.ok(inward <= 0 && inward >= -40);
          else assert.ok(inward >= 0 && inward <= 34);
        }
      }
      points = [];
      flipSurfaceLine(context, surface, 40, 350);
      points.forEach(([x, y]) => assert.equal(y, surface(x)));
    }
  }
}
assert.ok(!INTRO_SCORE.cross.includes("earns extra"));
// The intro stays short (first-run audit, 11 Oct); the "?" help keeps the formula.
// 13 Oct 2026: the intro lists every ring value (10 / 9 / 8 / 3 / 2 / 1) and the inner bull 12.
// Text pass (4 Nov 2026): the intro names the bonuses in one plain sentence; the help lists every ring value.
assert.ok(PUZZLE_INSTRUCTIONS.bullseye.score.includes("10 / 9 / 8 / 3 / 2 / 1") && PUZZLE_INSTRUCTIONS.bullseye.score.includes("inner bull 12"));
// Score bands (Oct 2026): the help gives a good run on the live curve; stored rounds keep floor(1.7 × total − 20).
// The arcade scoring standard (bullRev 9, 29 Oct 2026): the help lists the parts instead of a good run on a curve
// (arcade-help-bands-check proves the parts); it still names every ring value, the inner bull and the balloons.
const bullseyeStd = (LIVE_BANDS.bullseye as { std?: StdSpec }).std;
if (bullseyeStd) assert.ok(PUZZLE_INSTRUCTIONS.bullseye.score.includes(stdHelpLines(bullseyeStd)) && PUZZLE_INSTRUCTIONS.bullseye.score.includes("rings 10 / 9 / 8 / 3 / 2 / 1 from the centre out, the inner bull 12, balloons 1 to 3 more"));
else assert.ok(PUZZLE_INSTRUCTIONS.bullseye.score.includes("rings 10 / 9 / 8 / 3 / 2 / 1 from the centre out (the inner bull 12), plus +1, +2 or +3 for each balloon") && PUZZLE_INSTRUCTIONS.bullseye.score.includes(`A good run (100 points) totals ${bandUnitsFor(LIVE_BANDS.bullseye.curve, 100)}`));
console.log("Bullseye values/shuffles/scores, Cross score/cap/reveal and Flip curve vertices passed; no browser tests.");