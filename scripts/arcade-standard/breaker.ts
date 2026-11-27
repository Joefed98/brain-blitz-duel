/**
 * Breaker under the arcade scoring standard (brkRev 11, 29 Oct 2026; docs/arcade-standard/breaker.md).
 * Parts: bricks (a straight line on the share of all 108 bricks, gold included) 140, clearing the wall 10, speed 20
 * (full with half the run left, evenly to 0 at the buzzer; only when cleared), gold bricks 30 (10 each). Total 200.
 *
 * perfect(): a flawless skill-band bot run on brkRev 11 (scripts/fixtures/breaker-standard-perfect.json: every brick,
 * all 3 gold, the wall cleared at 35 s), replayed by the server (replayBreakerRun) and split into parts with the sim's
 * own breakerStdParts.
 * Changed with Joe's approval, 15 Nov 2026 (routine consequence of the Retro overhaul): the entry moved to the dealt
 * stamp, brkRev 12 (the 9-row wall, 81 bricks), its perfect run scripts/fixtures/breaker-clear-perfect.json (a flawless
 * bot run at 200, recorded by scripts/breaker-clear-perfect-record.ts).
 * Changed with Joe's approval, 27 Nov 2026 (routine consequence of D5's brkRev 13, the ladder): the entry moved to the
 * dealt stamp, brkRev 13 (brkRev 12's wall, the bricks full at 79 of 81, the gold bricks 15 each), its perfect run
 * scripts/fixtures/breaker-ladder-perfect.json.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { BRK_REV_LADDER, BRK_V11_CLEAR_POINTS, BRK_V11_CORE_MAX, BRK_V11_GOLD_MAX, BRK_V11_SPEED_MAX, breakerStdParts } from "../../src/lib/arcade/breaker";
import { replayBreakerRun } from "../../src/lib/duel/breaker";
import type { StdEntry, StdRun } from "./entry";

const FIXTURE = new URL("../fixtures/breaker-ladder-perfect.json", import.meta.url); // Changed with Joe's approval, 27 Nov 2026 (D5's brkRev 13)

export const entry: StdEntry = {
  type: "breaker",
  field: "brkRev",
  rev: BRK_REV_LADDER, // Changed with Joe's approval, 27 Nov 2026 (D5's brkRev 13)
  parts: [
    // Changed with Joe's approval, 27 Nov 2026 (D5's brkRev 13): the three labels below state its lines.
    { key: "core", label: "Bricks destroyed (full at 79 of 81, gold included)", max: BRK_V11_CORE_MAX },
    { key: "clear", label: "Wall cleared", max: BRK_V11_CLEAR_POINTS },
    { key: "speed", label: "Speed (cleared by 80 s: full)", max: BRK_V11_SPEED_MAX },
    { key: "gold", label: "Gold bricks (15 each, 2 of 3 fill it)", max: BRK_V11_GOLD_MAX },
  ],
  /** A perfect run through the real scoring path: the stored flawless run replayed by the server. */
  perfect(): StdRun[] {
    const fixture = JSON.parse(readFileSync(FIXTURE, "utf8")) as { rev: number; seed: number; raw: string };
    const raw = gunzipSync(Buffer.from(fixture.raw, "base64")).toString("utf8");
    const run = replayBreakerRun(fixture.seed, raw, fixture.rev);
    if (run.flagged) throw new Error(`breaker perfect run flagged: ${run.reason ?? ""}`);
    const p = breakerStdParts(run.state);
    return [{ label: "the stored flawless bot run, server replay", score: run.score, parts: { core: p.core, clear: p.clear, speed: p.speed, gold: p.gold } }];
  },
};
