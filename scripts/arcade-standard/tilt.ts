/**
 * Tilt on the arcade scoring standard (tiltRev 10, docs/arcade-standard-oct-2026/tilt.md). The perfect run is the
 * oracle's (scripts/tilt-oracle.ts) on the first bank seed, stored in scripts/fixtures/tilt-standard-runs.json.gz
 * and replayed here by the server (replayTiltRun): all four mazes by 75 s with every gold star.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { tiltStdParts, TILT_REV_STD, TILT_S_CORE_MAX, TILT_S_FINISH_POINTS, TILT_S_SPEED_POINTS, TILT_S_STAR_POINTS } from "../../src/lib/arcade/tilt";
import { replayTiltRun } from "../../src/lib/duel/tilt";

type Run = { rev: number; seed: number; kind: string; raw: string; score: number };

export const STANDARD = {
  id: "tilt",
  stampKey: "tiltRev",
  stamp: TILT_REV_STD,
  parts: [
    { key: "core", label: "Mazes (35 each: 30 for finishing, up to 5 for getting closer to the exit)", max: TILT_S_CORE_MAX },
    { key: "finish", label: "All four mazes", max: TILT_S_FINISH_POINTS },
    { key: "speed", label: "Speed (full by 75 s, to 0 at the buzzer)", max: TILT_S_SPEED_POINTS },
    { key: "stars", label: "Gold stars (mazes 1–3, split evenly)", max: TILT_S_STAR_POINTS },
  ],
  /** The oracle's stored run on the first bank seed, replayed by the server; its parts from the sim's own scoring. */
  perfect(): { score: number; parts: Record<string, number> } {
    const path = new URL("../fixtures/tilt-standard-runs.json.gz", import.meta.url);
    const runs = (JSON.parse(gunzipSync(readFileSync(path)).toString()) as { runs: Run[] }).runs;
    const run = runs.find((r) => r.kind === "oracle")!;
    const r = replayTiltRun(run.seed, run.raw, TILT_REV_STD);
    const p = tiltStdParts(r.state);
    return { score: r.flagged ? -1 : r.score, parts: { core: p.core, finish: p.finish, speed: p.speed, stars: p.stars } };
  },
};
