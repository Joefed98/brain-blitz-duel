/**
 * Gemstone under the arcade scoring standard (matchupRev 11, docs/arcade-standard-oct-2026/matchup.md).
 * `perfect()` replays a recorded flawless skill-band bot run (scripts/fixtures/gemstone-standard-runs.json, written by
 * scripts/gemstone-standard-record.ts) through the server's own replay (replayMatchupRun) and scores its final state
 * with the sim's own parts.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { matchupStdParts, MATCHUP_REV_STD, MATCHUP_V11_BIG_MAX, MATCHUP_V11_CORE_MAX, MATCHUP_V11_GOALS_MAX, MATCHUP_V11_ICE_MAX, MATCHUP_V11_TREASURE_MAX, type MatchupState } from "../../src/lib/arcade/matchup";
import { replayMatchupRun } from "../../src/lib/duel/matchup";

const FIXTURE = fileURLToPath(new URL("../fixtures/gemstone-standard-runs.json", import.meta.url));

export const STANDARD = {
  id: "matchup",
  stampKey: "matchupRev",
  stamp: MATCHUP_REV_STD,
  parts: [
    { key: "core", label: "Gems cleared", max: MATCHUP_V11_CORE_MAX },
    { key: "treasure", label: "Treasure brought down", max: MATCHUP_V11_TREASURE_MAX },
    { key: "goals", label: "Colour goals met", max: MATCHUP_V11_GOALS_MAX },
    { key: "ice", label: "Frozen cells broken", max: MATCHUP_V11_ICE_MAX },
    { key: "big", label: "Lines of 4 or 5", max: MATCHUP_V11_BIG_MAX },
  ],
  /** A flawless bot run, replayed by the server: its score and per-part points. */
  perfect(): { score: number; parts: Record<string, number> } {
    const { perfect } = JSON.parse(readFileSync(FIXTURE, "utf8")) as { perfect: { seed: number; raw: string } };
    const run = replayMatchupRun(perfect.seed, gunzipSync(Buffer.from(perfect.raw, "base64")).toString(), MATCHUP_REV_STD);
    if (run.flagged) throw new Error("the recorded perfect run is flagged by the server replay");
    return { score: run.score, parts: { ...matchupStdParts(run.state as MatchupState) } };
  },
};
