/**
 * Tilt on the arcade scoring standard (docs/arcade-standard/tilt.md): tiltRev 12 since 3 Nov 2026 (tiltRev 11's mazes,
 * pars and parts with bigger marbles and keys; tiltRev 11 before it: tiltRev 10's mazes with no gold stars, scored on
 * par times and a clean run). The perfect runs are the oracle's (scripts/tilt-oracle.ts --rev=12) on deal seeds, stored
 * in scripts/fixtures/tilt-rev12-runs.json.gz and replayed here by the server (replayTiltRun): all four mazes within par,
 * no fall, done well before the speed part's full-by time. Every deal seed's own witness reaches 200 too (tilt-rev12-check).
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  tiltParParts,
  TILT_P_CLEAN_POINTS,
  TILT_P_CORE_MAX,
  TILT_P_PAR_MAX,
  TILT_P_SPEED_FULL,
  TILT_P_SPEED_POINTS,
  TILT_REV_BIG,
} from "../../src/lib/arcade/tilt";
import { replayTiltRun } from "../../src/lib/duel/tilt";
import type { StdEntry, StdRun } from "./entry";

type Run = { rev: number; seed: number; kind: string; raw: string; score: number };

export const entry: StdEntry = {
  type: "tilt",
  field: "tiltRev",
  rev: TILT_REV_BIG,
  parts: [
    { key: "core", label: "Mazes (a share for finishing each, and some for getting closer to the exit)", max: TILT_P_CORE_MAX },
    { key: "par", label: "Par (a fixed amount for each maze finished within its par)", max: TILT_P_PAR_MAX },
    { key: "clean", label: "Clean run (a quarter for each maze finished before the first fall)", max: TILT_P_CLEAN_POINTS },
    { key: "speed", label: `Speed (all four mazes: full by ${TILT_P_SPEED_FULL / 60} s, to 0 at the buzzer)`, max: TILT_P_SPEED_POINTS },
  ],
  /** The oracle's stored runs, replayed by the server; their parts from the sim's own scoring. */
  perfect(): StdRun[] {
    const path = new URL("../fixtures/tilt-rev12-runs.json.gz", import.meta.url);
    const runs = (JSON.parse(gunzipSync(readFileSync(path)).toString()) as { runs: Run[] }).runs;
    return runs
      .filter((r) => r.kind === "oracle")
      .slice(0, 2)
      .map((run) => {
        const r = replayTiltRun(run.seed, run.raw, TILT_REV_BIG);
        const p = tiltParParts(r.state);
        return { label: `the stored oracle run on seed ${run.seed}, server replay`, score: r.flagged ? -1 : r.score, parts: { core: p.core, par: p.par, clean: p.clean, speed: p.speed } };
      });
  },
};
