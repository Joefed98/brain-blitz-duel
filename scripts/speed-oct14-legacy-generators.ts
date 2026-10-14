/**
 * The Flash and Bang On generators rooms used before the 14 Oct 2026 Speed
 * tuning (tapRev 2), copied verbatim from main, so the band script and
 * scripts/speed-oct14-check.ts can deal the "before" puzzle for any seed.
 * Script only; the app never deals these again.
 */
import { pick, randInt } from "../src/lib/duel/random";
import { TAP_REV_CARELESS } from "../src/lib/duel/tapLog";
import {
  REACTION_FLASH_MS,
  REACTION_MAX_FLASHES,
  REACTION_MIN_FLASHES,
  REACTION_ROUND_MS,
  type ReactionPuzzleData,
  type StopWatchPuzzleData,
  type StopWatchSpec,
} from "../src/lib/duel/types";

const DECOY_COLOURS = ["teal", "red", "blue"] as const;

/** 5–8 gold flashes, each preceded by proportionally spaced seeded decoys. */
/** 5–8 gold flashes, plain decoys only (tapRev 2). */
export function buildReactionRev2(): ReactionPuzzleData {
  const flashCount = randInt(REACTION_MIN_FLASHES, REACTION_MAX_FLASHES);
  let flashes: number[] = [];
  let decoys: ReactionPuzzleData["decoys"] = [];
  for (let attempt = 0; attempt < 1_000; attempt++) {
    const list = [randInt(4_000, 7_000)];
    while (list.length < flashCount) list.push(list[list.length - 1]! + randInt(5_000, 8_000));
    if (list[list.length - 1]! + REACTION_FLASH_MS > REACTION_ROUND_MS - 500) continue;

    // Begin at two per flash, then vary to a seeded total of 8–12.
    const counts = Array.from({ length: flashCount }, () => randInt(1, 3));

    const proposed: ReactionPuzzleData["decoys"] = [];
    let valid = true;
    for (let flashIndex = 0; flashIndex < list.length; flashIndex++) {
      const segmentStart = flashIndex === 0 ? 0 : list[flashIndex - 1]! + REACTION_FLASH_MS;
      let cursor = list[flashIndex]! - randInt(1_000, 5_000);
      const backwards: ReactionPuzzleData["decoys"] = [];
      for (let n = 0; n < counts[flashIndex]!; n++) {
        if (cursor < segmentStart + 250) {
          valid = false;
          break;
        }
        backwards.push({ at: cursor, color: pick(DECOY_COLOURS) });
        cursor -= randInt(1_500, 4_000);
      }
      proposed.push(...backwards.reverse());
      if (!valid) break;
    }
    if (!valid) continue;
    flashes = list;
    decoys = proposed.sort((a, b) => a.at - b.at);
    break;
  }
  if (flashes.length === 0) {
    flashes = Array.from({ length: flashCount }, (_, index) => 6_000 + index * 7_000);
    decoys = flashes.flatMap((flash, index) => [
      { at: flash - 4_500, color: DECOY_COLOURS[index % 3]! },
      { at: flash - 2_000, color: DECOY_COLOURS[(index + 1) % 3]! },
    ]);
  }
  return { type: "reaction", flashes, decoys, tapRev: TAP_REV_CARELESS };
}

export function buildStopWatchRev2(): StopWatchPuzzleData {
  return {
    type: "stopwatch",
    watches: Array.from({ length: 10 }, (_, index) => {
      const centre = randInt(index < 3 ? 25 : 60, index < 3 ? 75 : 88) / 100;
      const moving = index === 2 || index === 5 || index === 8;
      const vertical = index === 4 || index === 7;
      const accelerating = index >= 6;
      const sweepMs = Math.max(560, 1_180 - index * 55);
      const spec: StopWatchSpec = {
        centre,
        half: Math.max(0.035, 0.085 - index * 0.005),
        sweepMs,
        hidden: index >= 3 && index % 2 === 1,
        wrap: index >= 7,
        passes: index + 2,
      };
      if (vertical) spec.vertical = true;
      if (moving) spec.moving = { amplitude: 0.1, cycleMs: 2_200 - index * 70, phase: randInt(0, 99) / 100 };
      if (accelerating) spec.passSweepMs = Array.from({ length: index + 2 }, (_, pass) => Math.max(420, sweepMs - pass * 55));
      return spec;
    }),
    tapRev: TAP_REV_CARELESS,
  };
}
