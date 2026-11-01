/**
 * Gemstone under the arcade scoring standard (matchupRev 12, six goals and six treasures, docs/arcade-standard/matchup.md;
 * matchupRev 11 before it, still proved by gemstone-standard-check).
 * `perfect()` replays a recorded flawless skill-band bot run (scripts/fixtures/gemstone-rev12-runs.json, written by
 * scripts/gemstone-rev12-record.ts) through the server's own replay (replayMatchupRun) and scores its final state
 * with the sim's own parts.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { matchupStdParts, MATCHUP_REV_SIX, MATCHUP_V12_BIG_MAX, MATCHUP_V12_CORE_MAX, MATCHUP_V12_GOALS_MAX, MATCHUP_V12_ICE_MAX, MATCHUP_V12_TREASURE_MAX, type MatchupState } from "../../src/lib/arcade/matchup";
import { replayMatchupRun } from "../../src/lib/duel/matchup";
import type { StdEntry, StdRun } from "./entry";

const FIXTURE = fileURLToPath(new URL("../fixtures/gemstone-rev12-runs.json", import.meta.url));

export const entry: StdEntry = {
  type: "matchup",
  field: "matchupRev",
  rev: MATCHUP_REV_SIX,
  /** matchupRev 11 (the first standard stamp) was dealt before it. */
  before: 11,
  parts: [
    { key: "core", label: "Gems cleared", max: MATCHUP_V12_CORE_MAX },
    { key: "treasure", label: "Treasure brought down", max: MATCHUP_V12_TREASURE_MAX },
    { key: "goals", label: "Colour goals met", max: MATCHUP_V12_GOALS_MAX },
    { key: "ice", label: "Frozen cells broken", max: MATCHUP_V12_ICE_MAX },
    { key: "big", label: "Lines of 4 or 5", max: MATCHUP_V12_BIG_MAX },
  ],
  /** A flawless bot run, replayed by the server: its score and per-part points. */
  perfect(): StdRun[] {
    const { perfect } = JSON.parse(readFileSync(FIXTURE, "utf8")) as { perfect: { seed: number; raw: string } };
    const run = replayMatchupRun(perfect.seed, gunzipSync(Buffer.from(perfect.raw, "base64")).toString(), MATCHUP_REV_SIX);
    if (run.flagged) throw new Error("the recorded perfect run is flagged by the server replay");
    return [{ label: "the stored flawless bot run, server replay", score: run.score, parts: { ...matchupStdParts(run.state as MatchupState) } }];
  },
};
