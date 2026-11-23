/**
 * Tilt on the arcade scoring standard (docs/arcade-standard/tilt.md): tiltRev 12 since 3 Nov 2026 (tiltRev 11's mazes,
 * pars and parts with bigger marbles and keys; tiltRev 11 before it: tiltRev 10's mazes with no gold stars, scored on
 * par times and a clean run). The perfect runs are the oracle's (scripts/tilt-oracle.ts --rev=12) on deal seeds, stored
 * in scripts/fixtures/tilt-rev12-runs.json.gz and replayed here by the server (replayTiltRun): all four mazes within par,
 * no fall, done well before the speed part's full-by time. Every deal seed's own witness reaches 200 too (tilt-rev12-check).
 * tiltRev 13 since 22 Nov 2026 (D6, the scoring review's I8): Normal plays tiltRev 12's first three mazes, the same parts
 * over three, speed full by 55 s; the perfect runs are its deal's witnesses (scripts/tilt-deal-v13.ts, the oracle held to
 * human limits), replayed by the server.
 *
 * Changed with Joe's approval, 23 Nov 2026 (D6's Normal scoring stamps): the entry moved to the new stamp; the older stamp's lines kept.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  tiltParParts,
  TILT_P_CLEAN_POINTS,
  TILT_P_CORE_MAX,
  TILT_P_PAR_MAX,
  TILT_P_SPEED_POINTS,
  TILT_REV_THREE,
  TILT_T_MAZES,
  TILT_T_SPEED_FULL_S,
} from "../../src/lib/arcade/tilt";
import { replayTiltRun } from "../../src/lib/duel/tilt";
import type { StdEntry, StdRun } from "./entry";

type Run = { seed: number; raw: string };

export const entry: StdEntry = {
  type: "tilt",
  field: "tiltRev",
  // Changed with Joe's approval, 23 Nov 2026 (D6): tiltRev 13.
  rev: TILT_REV_THREE,
  parts: [
    { key: "core", label: "Mazes (a share for finishing each, and some for getting closer to the exit)", max: TILT_P_CORE_MAX },
    { key: "par", label: "Par (a fixed amount for each maze finished within its par)", max: TILT_P_PAR_MAX },
    // Changed with Joe's approval, 23 Nov 2026 (D6): three mazes.
    { key: "clean", label: "Clean run (a third for each maze finished before the first fall)", max: TILT_P_CLEAN_POINTS },
    { key: "speed", label: `Speed (all ${TILT_T_MAZES} mazes: full by ${TILT_T_SPEED_FULL_S} s, to 0 at the buzzer)`, max: TILT_P_SPEED_POINTS },
  ],
  /** The tiltRev 13 deal's stored witnesses (the oracle held to human limits), replayed by the server; their parts from the sim's own scoring. */
  perfect(): StdRun[] {
    // Changed with Joe's approval, 23 Nov 2026 (D6): the perfect runs are the tiltRev 13 deal's witnesses.
    const path = new URL("../fixtures/tilt-deal-v13-witness.json.gz", import.meta.url);
    const runs = (JSON.parse(gunzipSync(readFileSync(path)).toString()) as { witnesses: Run[] }).witnesses;
    return runs
      .slice(0, 2)
      .map((run) => {
        const r = replayTiltRun(run.seed, run.raw, TILT_REV_THREE);
        const p = tiltParParts(r.state);
        return { label: `the tiltRev 13 deal's witness on seed ${run.seed}, server replay`, score: r.flagged ? -1 : r.score, parts: { core: p.core, par: p.par, clean: p.clean, speed: p.speed } };
      });
  },
};
