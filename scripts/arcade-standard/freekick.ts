/**
 * arcade-standard-check's entry for `freekick` (Top Bins, freekickRev 3 since 1 Nov 2026: the prepared shot, a tap to
 * aim, a drag to curl and a power meter; rev 1's parts with the core full at FREEKICK_V3_CORE_FULL; see ./entry.ts and
 * docs/arcade-standard/freekick.md). Perfect runs are the oracle's (scripts/freekick-oracle.ts, oracleShotsV3) on
 * proved freekickRev 3 deal seeds, replayed through the server path: 24 of the 300 at quick depth (spread through the
 * deal), all with CHECKS_FULL=1.
 */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { recordInput, type ArcadeInputEvent } from "../../src/lib/arcade/engine";
import {
  freekickCheckpoint,
  freekickGameV3,
  freekickStdParts,
  FREEKICK_CHECKPOINT_INTERVAL,
  FREEKICK_INPUT_AIM,
  FREEKICK_INPUT_POWER,
  FREEKICK_INPUT_RANGES_V3,
  FREEKICK_INPUT_STRIKE,
  FREEKICK_REV_2,
  FREEKICK_REV_3,
  FREEKICK_V2_STD_SPEC,
  FREEKICK_V3_CORE_FULL,
  FREEKICK_V3_STD_SPEC,
  type FreekickState,
} from "../../src/lib/arcade/freekick";
import { encodeFreekickRun, replayFreekickRun } from "../../src/lib/duel/freekick";
import { FREEKICK_DEAL_V3 } from "../../src/lib/duel/freekickDealV3.server";
import { oracleRun } from "../freekick-oracle";
import type { StdEntry, StdRun } from "./entry";

const FULL = process.env["CHECKS_FULL"] === "1";
const seeds = FULL ? [...FREEKICK_DEAL_V3] : FREEKICK_DEAL_V3.filter((_, i) => i % Math.ceil(FREEKICK_DEAL_V3.length / 24) === 0);
const game = freekickGameV3;

function replayed(seed: number, events: ArcadeInputEvent[], label: string): StdRun {
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  const checkpoints = [];
  while (!game.isOver(s)) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % FREEKICK_CHECKPOINT_INTERVAL === 0) checkpoints.push(freekickCheckpoint(s));
  }
  const raw = encodeFreekickRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
  const r = replayFreekickRun(seed, raw, FREEKICK_REV_3);
  return { label, score: r.score, parts: Object.fromEntries(r.parts.map((p) => [p.key, p.points])), partMaxes: Object.fromEntries(r.parts.map((p) => [p.key, p.max])) };
}

const base = (over: Partial<FreekickState>): FreekickState => ({ ...game.init(FREEKICK_DEAL_V3[0]!), acted: 1, ...over });

export const entry: StdEntry = {
  type: "freekick",
  field: "freekickRev",
  rev: FREEKICK_REV_3,
  before: FREEKICK_REV_2,
  parts: FREEKICK_V3_STD_SPEC.parts,
  spec: ARCADE_STANDARD.freekick.spec!,
  liveSpec: true,
  perfect: () => seeds.map((seed) => replayed(seed, oracleRun(seed, FREEKICK_REV_3), `the oracle on freekickRev 3 deal seed ${seed}`)),
  played: () => {
    const events: ArcadeInputEvent[] = [];
    // A shot along the grass at the wall's middle, struck at once (the meter at its bottom): an input that scores nothing.
    recordInput(events, { t: 40, k: FREEKICK_INPUT_AIM, a: 0, b: 11, c: 0, d: 0 }, FREEKICK_INPUT_RANGES_V3);
    recordInput(events, { t: 41, k: FREEKICK_INPUT_POWER, a: 0, b: 0, c: 0, d: 0 }, FREEKICK_INPUT_RANGES_V3);
    recordInput(events, { t: 42, k: FREEKICK_INPUT_STRIKE, a: 0, b: 0, c: 0, d: 0 }, FREEKICK_INPUT_RANGES_V3);
    return [{ ...replayed(FREEKICK_DEAL_V3[0]!, events, "one feeble kick"), want: 1 }];
  },
  idle: () => [replayed(FREEKICK_DEAL_V3[1]!, [], "no input at all")],
  core: { fullAt: FREEKICK_V3_CORE_FULL, at: (v) => base({ units: v }), parts: freekickStdParts },
  extra(ok) {
    const p = (s: FreekickState, k: string) => freekickStdParts(s)!.find((x) => x.key === k)!.points;
    for (let t = 0; t <= 4; t++) ok(p(base({ targets: t }), "targets") === 10 * t, `${t} targets → ${10 * t}`);
    for (let c = 0; c <= 10; c++) ok(p(base({ curled: c }), "curl") === 2 * c, `${c} goals round the wall → ${2 * c}`);
    ok(p(base({ best: 4 }), "streak") === 0 && p(base({ best: 5 }), "streak") === 10 && p(base({ best: 10 }), "streak") === 10, "five in a row: 10 once, from five");
    ok(base({}).freekickRev === FREEKICK_REV_3 && FREEKICK_V3_STD_SPEC.parts.map((x) => `${x.key}:${x.max}`).join() === FREEKICK_V2_STD_SPEC.parts.map((x) => `${x.key}:${x.max}`).join(), "freekickRev 3 keeps rev 2's parts (130 + 40 + 20 + 10)");
    ok(p(base({ goals: 10, units: 1300 }), "core") === 130 && p(base({ goals: 9, units: FREEKICK_V3_CORE_FULL }), "core") === 130, `the core is full at ${FREEKICK_V3_CORE_FULL} units`);
  },
};
