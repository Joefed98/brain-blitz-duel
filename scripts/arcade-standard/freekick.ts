/**
 * arcade-standard-check's entry for `freekick` (Top Bins, freekickRev 5 since 15 Nov 2026: the layered kick, rev 4's
 * drawn shot plus wind, three strike types, the keeper's lean and the jumping wall; Goals 120 full at
 * FREEKICK_V5_CORE_FULL, Targets 40, Skill shots 30, Five in a row 10; see ./entry.ts and docs/arcade-standard/freekick.md).
 * Perfect runs are the oracle's (scripts/freekick-oracle.ts oracleRunV5) on proved freekickRev 5 Normal deal seeds,
 * replayed through the server path: 12 of the 60 at quick depth (spread through the deal), every level's with CHECKS_FULL=1.
 */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { recordInput, type ArcadeInputEvent } from "../../src/lib/arcade/engine";
import {
  freekickGameFor,
  freekickStdParts,
  FK_LEVELS,
  FREEKICK_INPUT_POWER,
  FREEKICK_INPUT_RANGES_V5,
  FREEKICK_INPUT_SHOT,
  FREEKICK_INPUT_STRIKE,
  FREEKICK_REV_4,
  FREEKICK_REV_5,
  FREEKICK_V5_CORE_FULL,
  FREEKICK_V5_CORE_MAX,
  FREEKICK_V5_STD_SPEC,
  type FkLevel,
  type FreekickState,
} from "../../src/lib/arcade/freekick";
import { FREEKICK_DEAL_V5 } from "../../src/lib/duel/freekickDealV5.server";
import { oracleRunV5 } from "../freekick-oracle";
import { storedScoreFkV5 } from "../freekick-layered-deal";
import type { StdEntry, StdRun } from "./entry";

const FULL = process.env["CHECKS_FULL"] === "1";
const normal = FREEKICK_DEAL_V5.normal;
const seeds = FULL ? [...normal] : normal.filter((_, i) => i % 5 === 0);
const game = freekickGameFor(FREEKICK_REV_5);

function replayed(seed: number, events: ArcadeInputEvent[], label: string, level: FkLevel = "normal"): StdRun {
  // The stored score through the server's replay (with the phone's checkpoints); the parts from the same play.
  const score = storedScoreFkV5(seed, events, level);
  const g = freekickGameFor(FREEKICK_REV_5, level);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = g.init(seed);
  while (!g.isOver(s)) s = g.step(s, at.get(s.tick + 1) ?? null);
  const parts = freekickStdParts(s) ?? [];
  return { label, score, parts: Object.fromEntries(parts.map((p) => [p.key, p.points])), partMaxes: Object.fromEntries(parts.map((p) => [p.key, p.max])) };
}

const base = (over: Partial<FreekickState>): FreekickState => ({ ...game.init(normal[0]!), acted: 1, ...over });

export const entry: StdEntry = {
  type: "freekick",
  field: "freekickRev",
  rev: FREEKICK_REV_5,
  before: FREEKICK_REV_4,
  parts: FREEKICK_V5_STD_SPEC.parts,
  spec: ARCADE_STANDARD.freekick.spec!,
  liveSpec: true,
  perfect: () => [
    ...seeds.map((seed) => replayed(seed, oracleRunV5(seed, "normal"), `the oracle on freekickRev 5 Normal deal seed ${seed}`)),
    ...(FULL ? FK_LEVELS.filter((l) => l !== "normal").flatMap((l) => FREEKICK_DEAL_V5[l].map((seed) => replayed(seed, oracleRunV5(seed, l), `the oracle on freekickRev 5 ${l} seed ${seed}`, l))) : []),
  ],
  played: () => {
    const events: ArcadeInputEvent[] = [];
    // A straight drive along the grass at the wall's middle, struck at once (the meter at its bottom): it scores nothing.
    recordInput(events, { t: 40, k: FREEKICK_INPUT_SHOT, a: 0, b: 11, c: 0, d: 1 }, FREEKICK_INPUT_RANGES_V5);
    recordInput(events, { t: 41, k: FREEKICK_INPUT_POWER, a: 0, b: 0, c: 0, d: 0 }, FREEKICK_INPUT_RANGES_V5);
    recordInput(events, { t: 42, k: FREEKICK_INPUT_STRIKE, a: 0, b: 0, c: 0, d: 0 }, FREEKICK_INPUT_RANGES_V5);
    return [{ ...replayed(normal[0]!, events, "one feeble kick"), want: 1 }];
  },
  idle: () => [replayed(normal[1]!, [], "no input at all")],
  core: { fullAt: FREEKICK_V5_CORE_FULL, at: (v) => base({ units: v }), parts: freekickStdParts },
  extra(ok) {
    const p = (s: FreekickState, k: string) => freekickStdParts(s)!.find((x) => x.key === k)!.points;
    for (let t = 0; t <= 4; t++) ok(p(base({ targets: t }), "targets") === 10 * t, `${t} targets → ${10 * t}`);
    for (let c = 0; c <= 11; c++) ok(p(base({ skill: c }), "skill") === Math.min(30, 3 * c), `${c} skill shots → ${Math.min(30, 3 * c)}`);
    ok(p(base({ best: 4 }), "streak") === 0 && p(base({ best: 5 }), "streak") === 10 && p(base({ best: 10 }), "streak") === 10, "five in a row: 10 once, from five");
    ok(base({}).freekickRev === FREEKICK_REV_5 && FREEKICK_V5_STD_SPEC.parts.map((x) => `${x.key}:${x.max}`).join() === "core:120,targets:40,skill:30,streak:10", "freekickRev 5's parts (120 + 40 + 30 + 10)");
    ok(p(base({ goals: 10, units: 1300 }), "core") === FREEKICK_V5_CORE_MAX && p(base({ goals: 9, units: FREEKICK_V5_CORE_FULL }), "core") === FREEKICK_V5_CORE_MAX, `the core is full at ${FREEKICK_V5_CORE_FULL} units`);
    ok(p(base({ goals: 6, units: 700, skill: 6, targets: 3, best: 6 }), "core") === p(base({ goals: 6, units: 700 }), "core"), "the features never cost core");
  },
};
