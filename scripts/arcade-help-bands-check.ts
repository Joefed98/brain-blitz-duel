/**
 * The arcade "?" help states the band numbers of the revision new rooms deal
 * (screen audit Oct 2026, stale-knots follow-up to Batch 5). Display only.
 *
 *  1. Every band game has a LIVE_BANDS entry (src/lib/arcade/liveBands.ts), and
 *     the room generator (generatePuzzle, the path rooms and practice use) deals
 *     exactly the revision listed there.
 *  2. The listed curve is the newest band curve the game's sim exports (a newer
 *     `<GAME>_V<n>_BAND_CURVE` means the help has fallen behind a stamp).
 *  3. Each help SCORE line is the plain wording: "More …, higher score", the
 *     top (150 at the full figure on open games, up to 140 then the finish rule
 *     and "Up to 150" on finish games), and a good run (100 points) at the units
 *     the live curve needs, with no knot list ("→", "Points follow").
 *
 *   bun scripts/arcade-help-bands-check.ts
 */
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { LIVE_BANDS, type LiveBandGame } from "../src/lib/arcade/liveBands";
import { BAND_SPECS } from "../src/lib/arcade/bandParts";
import {
  BAND_GOOD_POINTS,
  bandPoints,
  bandTop,
  bandUnitsFor,
  type BandCurve,
} from "../src/lib/arcade/scoreBands";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import type { PuzzleType } from "../src/lib/duel/types";

const SIM_MODULES: Record<LiveBandGame, string[]> = {
  balltrack: ["ballTrack"],
  wavefront: ["wavefront"],
  flip: ["flip"],
  inkbridge: ["inkBridge"],
  matchup: ["matchup"],
  bubble: ["bubble"],
  cross: ["cross"],
  rally: ["rally"],
  snake: ["snake"],
  bintoss: ["binToss"],
  snip: ["snip"],
  hover: ["hover"],
  skyline: ["skyline"],
  junction: ["junction"],
  breaker: ["breaker"],
  tilt: ["tilt"],
  orbit: ["orbit", "orbitRev3"],
  beat: ["beat"],
  slice: ["slice"],
  burst: ["burst"],
  swing: ["swing"],
  bullseye: ["bullseye"],
  pinball: ["pinball", "pinball4"],
};

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
const same = (a: BandCurve, b: BandCurve) =>
  JSON.stringify([a.units, a.points]) === JSON.stringify([b.units, b.points]);
const n = (u: number) => u.toLocaleString("en-GB");

/* 1. One entry per band game, and rooms deal its revision. */
for (const type of Object.keys(BAND_SPECS))
  ok(type in LIVE_BANDS, `${type}: a band game with no LIVE_BANDS entry`);
for (const [type, live] of Object.entries(LIVE_BANDS) as [
  LiveBandGame,
  (typeof LIVE_BANDS)[LiveBandGame],
][]) {
  const dealt = (generatePuzzle(type as PuzzleType) as unknown as Record<string, unknown>)[
    live.field
  ];
  ok(
    dealt === live.rev,
    `${type}: rooms deal ${live.field} ${String(dealt)}, the help reads ${live.field} ${live.rev} (update liveBands.ts)`,
  );
}

/* 2. The listed curve is the sim's newest. */
for (const [type, modules] of Object.entries(SIM_MODULES) as [LiveBandGame, string[]][]) {
  let newest: { name: string; v: number; curve: BandCurve } | null = null;
  for (const m of modules) {
    const mod = (await import(`../src/lib/arcade/${m}.ts`)) as Record<string, unknown>;
    for (const [name, value] of Object.entries(mod)) {
      const match = /^[A-Z0-9]+?(?:_V(\d+))?_BAND_CURVE$/.exec(name);
      if (!match) continue;
      const v = match[1] ? Number(match[1]) : 0;
      if (!newest || v > newest.v) newest = { name, v, curve: value as BandCurve };
    }
  }
  ok(
    newest !== null && same(newest.curve, LIVE_BANDS[type].curve),
    `${type}: the help's curve is not the newest the sim exports (${newest?.name ?? "none"})`,
  );
}

/* 3. The plain wording, numbers from the live curve. */
for (const [type, live] of Object.entries(LIVE_BANDS) as [
  LiveBandGame,
  (typeof LIVE_BANDS)[LiveBandGame],
][]) {
  const score = PUZZLE_INSTRUCTIONS[type].score;
  const curve = live.curve;
  const top = curve.points[curve.points.length - 1]!;
  const good = bandUnitsFor(curve, BAND_GOOD_POINTS);
  ok(
    bandPoints(curve, good) >= BAND_GOOD_POINTS &&
      (good === 0 || bandPoints(curve, good - 1) < BAND_GOOD_POINTS),
    `${type}: ${good} is the fewest units for ${BAND_GOOD_POINTS} points`,
  );
  ok(
    /^.*\. (More|Further|A higher) [^.]*, higher score – /.test(score),
    `${type}: one plain "More …, higher score" line: ${score}`,
  );
  ok(
    score.includes(`A good run (${BAND_GOOD_POINTS} points) `) &&
      new RegExp(`\\b${n(good)}\\b`).test(score.slice(score.indexOf("A good run"))),
    `${type}: a good run at ${n(good)} (live ${live.field} ${live.rev}): ${score}`,
  );
  // An open game's curve tops out at its round maximum: 150, or 200 once an expansion raised it (roundMax.ts).
  if (top === 150 || top === roundMaxFor(type))
    ok(
      score.includes(`– ${top} at ${n(bandTop(curve))}.`),
      `${type}: open game states ${top} at ${n(bandTop(curve))}`,
    );
  else
    ok(
      score.includes(`– up to ${top}.`) && score.endsWith("Up to 150."),
      `${type}: finish game states up to ${top} then up to 150`,
    );
  ok(!/→|Points follow|straight lines/.test(score), `${type}: no knot list in the help`);
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL: ${failures.length} of ${checks} arcade help band checks`);
  process.exit(1);
}
console.log(
  `PASS: ${checks} arcade help band checks — every band game's "?" help reads the revision rooms deal`,
);
