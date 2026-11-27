/**
 * Gemstone under the arcade scoring standard (matchupRev 13, two-hit ice and levels, at Normal; docs/arcade-standard/matchup.md;
 * matchupRev 12 before it, still proved by gemstone-rev12-check, and matchupRev 11 by gemstone-standard-check).
 * `perfect()` replays a recorded flawless skill-band bot run at Normal (the first Normal witness in
 * scripts/fixtures/gemstone-levels-runs.json, written by scripts/gemstone-levels-record.ts) through the server's own
 * replay (replayMatchupRun) and scores its final state with the sim's own parts. Every level's witness is proved by
 * gemstone-levels-check.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { matchupStdParts, MATCHUP_REV_D6, MATCHUP_REV_ICE2, MATCHUP_V12_BIG_MAX, MATCHUP_V12_CORE_MAX, MATCHUP_V12_GOALS_MAX, MATCHUP_V12_ICE_MAX, MATCHUP_V12_TREASURE_MAX, type MatchupState } from "../../src/lib/arcade/matchup";
import { replayMatchupRun } from "../../src/lib/duel/matchup";
import type { StdEntry, StdRun } from "./entry";

/** Changed with Joe's approval, 27 Nov 2026 (D6): matchupRev 14's flawless Normal run (scripts/d6-gemstone-perfect-record.ts); matchupRev 13's witness (scripts/fixtures/gemstone-levels-runs.json) is
 * flagged on matchupRev 14, whose checkpoints carry its own marker. */
const FIXTURE_D6 = fileURLToPath(new URL("../fixtures/d6-gemstone-perfect.json", import.meta.url));

export const entry: StdEntry = {
  type: "matchup",
  field: "matchupRev",
  rev: MATCHUP_REV_D6, // Changed with Joe's approval, 27 Nov 2026 (D6: rooms deal matchupRev 14, matchupRev 13's play at Normal on its own full-at figures)
  /** matchupRev 13 was dealt before it. */
  before: 13,
  parts: [
    { key: "core", label: "Gems cleared", max: MATCHUP_V12_CORE_MAX },
    { key: "treasure", label: "Treasure brought down", max: MATCHUP_V12_TREASURE_MAX },
    { key: "goals", label: "Colour goals met", max: MATCHUP_V12_GOALS_MAX },
    { key: "ice", label: "Frozen cells broken", max: MATCHUP_V12_ICE_MAX },
    { key: "big", label: "Lines of 4 or 5", max: MATCHUP_V12_BIG_MAX },
  ],
  /** A flawless bot run, replayed by the server: its score and per-part points. */
  perfect(): StdRun[] {
    const perfect = JSON.parse(readFileSync(FIXTURE_D6, "utf8")) as { seed: number; raw: string }; // Changed with Joe's approval, 27 Nov 2026 (D6)
    const run = replayMatchupRun(perfect.seed, gunzipSync(Buffer.from(perfect.raw, "base64")).toString(), MATCHUP_REV_D6); // Changed with Joe's approval, 27 Nov 2026 (D6)
    if (run.flagged) throw new Error("the recorded perfect run is flagged by the server replay");
    return [{ label: "the stored flawless bot run, server replay", score: run.score, parts: { ...matchupStdParts(run.state as MatchupState) } }];
  },
};
