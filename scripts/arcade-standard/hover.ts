/**
 * Hover under the arcade scoring standard (hoverRev 10, docs/arcade-standard/hover.md).
 *
 * perfect(): a stored witness run (scripts/fixtures/hover-x200-witness.json.gz: every barrier, gold star, tight gate on
 * its centre line and star chain, found by the course solver on hoverRev 9, whose play hoverRev 10 keeps exactly) played
 * on hoverRev 10 the way the phone plays it, encoded, and scored by the server's replay (replayHoverRun).
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  HOVER_CHECKPOINT_INTERVAL,
  HOVER_REV_STANDARD,
  HOVER_STD_CENTRE,
  HOVER_STD_CHAINS,
  HOVER_STD_CORE,
  HOVER_STD_GOLD,
  HOVER_STD_TIGHT,
  hoverCheckpoint,
  hoverGameFor,
  hoverStandardParts,
  type HoverState,
} from "../../src/lib/arcade/hover";
import { encodeHoverRun, replayHoverRun } from "../../src/lib/duel/hover";
import type { StdEntry, StdRun } from "./entry";

const WITNESS = new URL("../fixtures/hover-x200-witness.json.gz", import.meta.url);

/** Plays a tap log on hoverRev 10 as the phone does and returns the server replay of the encoded answer. */
export function replayStandard(seed: number, taps: number[]) {
  const game = hoverGameFor(HOVER_REV_STANDARD);
  const set = new Set(taps);
  let s = game.init(seed) as HoverState;
  const checkpoints = [];
  while (!game.isOver(s)) {
    s = game.step(s, set.has(s.tick + 1)) as HoverState;
    if (s.tick % HOVER_CHECKPOINT_INTERVAL === 0) checkpoints.push(hoverCheckpoint(s));
  }
  const raw = encodeHoverRun({ seed, claimedScore: game.score(s), inputs: [...set].sort((a, b) => a - b), endTick: s.tick, checkpoints });
  return replayHoverRun(seed, raw, HOVER_REV_STANDARD);
}

export const entry: StdEntry = {
  type: "hover",
  field: "hoverRev",
  rev: HOVER_REV_STANDARD,
  parts: [
    { key: "core", label: "Barriers passed", max: HOVER_STD_CORE },
    { key: "chains", label: "Star chains", max: HOVER_STD_CHAINS },
    { key: "gold", label: "Gold stars", max: HOVER_STD_GOLD },
    { key: "tight", label: "Tight gates", max: HOVER_STD_TIGHT },
    { key: "centre", label: "Centre line", max: HOVER_STD_CENTRE },
  ],
  /** The first stored witness run (room seed index 0), replayed by the server on hoverRev 10. */
  perfect(): StdRun[] {
    const witnesses = JSON.parse(gunzipSync(readFileSync(WITNESS)).toString()) as { n: number; seed: number; taps: number[] }[];
    const w = witnesses.find((x) => x.n === 0)!;
    const r = replayStandard(w.seed, w.taps);
    const p = hoverStandardParts(r.state);
    return [{ label: "the stored witness run, server replay", score: r.score, parts: { core: p.core, chains: p.chains, gold: p.gold, tight: p.tight, centre: p.centre } }];
  },
};
