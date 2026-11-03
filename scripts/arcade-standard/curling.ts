/**
 * arcade-standard-check's entry for `curling` (see ./entry.ts): Curling curlRev 4 (the Sports group, 30 Oct 2026;
 * curlRev 2 since 31 Oct 2026, curlRev 3 since 1 Nov 2026, curlRev 4 since 3 Nov 2026 (only stones nearer than every red in the house count); docs/arcade-standard/curling.md). Stones up to 120 (up to 15 a stone by closeness to the button where it comes to
 * rest when thrown), Takeouts 30 (shared across the opponent's stones), Red ring 30 (3.75 a stone in the 4-foot),
 * Holding shot 20 (curlRev 4: Stones 150 full at 95 closeness points, Takeouts 20, Red ring 20, Holding shot 10). Perfect runs are the curlRev 4 bank's witnesses through the server's replay on curlRev 4.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { witnessRaw, type WitnessV2 } from "../curling-bank";
import { curlingGameFor, curlingStdParts, CURLING_REV, CURLING_STD_SPEC, CURLING_STONES, CURL_STONE_PTS, CURL_V4_CORE_FULL, CURL_V4_RED_PTS, type CurlingState } from "../../src/lib/arcade/curling";
import { replayCurlingRun } from "../../src/lib/duel/curling";
import { CURLING_BANK_V4 } from "../../src/lib/duel/curlingBankV4.server";
import type { StdEntry } from "./entry";

const game = curlingGameFor(CURLING_REV);
const SEED = CURLING_BANK_V4[0]!;
// The fixture holds each sheet's throw plan; witnessRaw plays it into the log the phone would send.
const witness: Record<string, string> = Object.fromEntries(
  (JSON.parse(readFileSync(new URL("../fixtures/curling-witness-v4.json", import.meta.url), "utf8")) as WitnessV2[]).map((w) => [String(w.seed), witnessRaw(w, CURLING_REV)]),
);
const record = (s: CurlingState) => Object.fromEntries((curlingStdParts(s) ?? []).map((p) => [p.key, p.points]));

/** A built final state: the opponent's stones untouched (in the house, holding), `pts` and `four` per throw as given. */
function final(pts: number[], four: number[] = pts.map(() => 0)): CurlingState {
  return { ...game.init(SEED), acted: 1, over: 1, thrown: CURLING_STONES, pts, four };
}
const zeros = () => Array.from({ length: CURLING_STONES }, () => 0);

export const entry: StdEntry = {
  type: "curling",
  field: "curlRev",
  rev: CURLING_REV,
  parts: CURLING_STD_SPEC.parts,
  spec: CURLING_STD_SPEC,
  liveSpec: true,
  perfect: () =>
    CURLING_BANK_V4.map((seed) => {
      const run = replayCurlingRun(seed, witness[String(seed)] ?? "", CURLING_REV);
      return { label: `bank sheet ${seed}'s witness (server replay)`, score: run.flagged ? -1 : run.score, parts: record(run.state) };
    }),
  played: () => [{ label: "a built state that threw eight stones and earned nothing", score: game.score(final(zeros())), want: 1 }],
  idle: () => [{ label: "an untouched run to the buzzer", score: (() => {
    let s = game.init(SEED);
    while (!game.isOver(s)) s = game.step(s, null);
    return game.score(s);
  })() }],
  // curlRev 4: the core's measure is the stones' closeness points (15 a stone on the button), full at 95.
  core: {
    fullAt: CURL_V4_CORE_FULL,
    at: (v: number) => final(Array.from({ length: CURLING_STONES }, (_, i) => Math.max(0, Math.min(CURL_STONE_PTS, v - i * CURL_STONE_PTS)))),
    parts: (s: any) => curlingStdParts(s),
  },
  older: () => curlingStdParts({ ...game.init(SEED), rev: 0 }) === null,
  extra(ok) {
    const part = (s: CurlingState, k: string) => curlingStdParts(s)!.find((p) => p.key === k)!.points;
    for (let n = 0; n <= CURLING_STONES; n++) {
      const four = Array.from({ length: CURLING_STONES }, (_, i) => (i < n ? 1 : 0));
      ok(part(final(zeros(), four), "redring") === Math.floor((CURL_V4_RED_PTS * n) / 8), `curling: ${n} in the 4-foot → red ring ${Math.floor((CURL_V4_RED_PTS * n) / 8)}`);
    }
    ok(part(final(zeros()), "hold") === 0 && part(final(zeros()), "takeouts") === 0, "curling: the opponent's untouched stones hold shot and none is out");
  },
};
