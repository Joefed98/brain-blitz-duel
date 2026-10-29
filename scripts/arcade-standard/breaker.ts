/**
 * Breaker under the arcade scoring standard (brkRev 11, 29 Oct 2026; docs/arcade-standard-oct-2026/breaker.md).
 * Parts: bricks (a straight line on the share of all 108 bricks, gold included) 140, clearing the wall 10, speed 20
 * (full with half the run left, evenly to 0 at the buzzer; only when cleared), gold bricks 30 (10 each). Total 200.
 *
 * perfect(): a flawless skill-band bot run on brkRev 11 (scripts/fixtures/breaker-standard-perfect.json: every brick,
 * all 3 gold, the wall cleared at 35 s), replayed by the server (replayBreakerRun) and split into parts with the sim's
 * own breakerStdParts.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { BRK_REV_STD, BRK_V11_CLEAR_POINTS, BRK_V11_CORE_MAX, BRK_V11_GOLD_MAX, BRK_V11_SPEED_MAX, breakerStdParts } from "../../src/lib/arcade/breaker";
import { replayBreakerRun } from "../../src/lib/duel/breaker";

const FIXTURE = new URL("../fixtures/breaker-standard-perfect.json", import.meta.url);

export const STANDARD = {
  id: "breaker",
  stampKey: "brkRev",
  stamp: BRK_REV_STD,
  parts: [
    { key: "core", label: "Bricks destroyed (of all 108, gold included)", max: BRK_V11_CORE_MAX },
    { key: "clear", label: "Wall cleared", max: BRK_V11_CLEAR_POINTS },
    { key: "speed", label: "Speed (cleared with half the time left: full)", max: BRK_V11_SPEED_MAX },
    { key: "gold", label: "Gold bricks (10 each)", max: BRK_V11_GOLD_MAX },
  ],
  /** A perfect run through the real scoring path: the stored flawless run replayed by the server. */
  perfect(): { score: number; parts: Record<string, number> } {
    const fixture = JSON.parse(readFileSync(FIXTURE, "utf8")) as { rev: number; seed: number; raw: string };
    const raw = gunzipSync(Buffer.from(fixture.raw, "base64")).toString("utf8");
    const run = replayBreakerRun(fixture.seed, raw, fixture.rev);
    if (run.flagged) throw new Error(`breaker perfect run flagged: ${run.reason ?? ""}`);
    const p = breakerStdParts(run.state);
    return { score: run.score, parts: { core: p.core, clear: p.clear, speed: p.speed, gold: p.gold } };
  },
};
