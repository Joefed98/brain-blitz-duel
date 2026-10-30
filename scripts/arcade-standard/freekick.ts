/**
 * arcade-standard-check's entry for `freekick` (Free Kick, freekickRev 1, born on the standard; see ./entry.ts and
 * docs/arcade-standard/freekick.md). Perfect runs are the oracle's (scripts/freekick-oracle.ts) on proved deal seeds,
 * replayed through the server path: 24 of the 300 at quick depth (spread through the deal), all with CHECKS_FULL=1.
 */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { recordInput, type ArcadeInputEvent } from "../../src/lib/arcade/engine";
import {
  freekickCheckpoint,
  freekickGame,
  freekickStdParts,
  FREEKICK_CHECKPOINT_INTERVAL,
  FREEKICK_CORE_FULL,
  FREEKICK_INPUT_KICK,
  FREEKICK_INPUT_RANGES,
  FREEKICK_STD_SPEC,
  type FreekickState,
} from "../../src/lib/arcade/freekick";
import { encodeFreekickRun, replayFreekickRun } from "../../src/lib/duel/freekick";
import { FREEKICK_DEAL } from "../../src/lib/duel/freekickDeal.server";
import { oracleRun } from "../freekick-oracle";
import type { StdEntry, StdRun } from "./entry";

const FULL = process.env["CHECKS_FULL"] === "1";
const seeds = FULL ? [...FREEKICK_DEAL] : FREEKICK_DEAL.filter((_, i) => i % Math.ceil(FREEKICK_DEAL.length / 24) === 0);

function replayed(seed: number, events: ArcadeInputEvent[], label: string): StdRun {
  const at = new Map(events.map((e) => [e.t, e]));
  let s = freekickGame.init(seed);
  const checkpoints = [];
  while (!freekickGame.isOver(s)) {
    s = freekickGame.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % FREEKICK_CHECKPOINT_INTERVAL === 0) checkpoints.push(freekickCheckpoint(s));
  }
  const raw = encodeFreekickRun({ seed, claimedScore: freekickGame.score(s), events, endTick: s.tick, checkpoints });
  const r = replayFreekickRun(seed, raw, 1);
  return { label, score: r.score, parts: Object.fromEntries(r.parts.map((p) => [p.key, p.points])), partMaxes: Object.fromEntries(r.parts.map((p) => [p.key, p.max])) };
}

const base = (over: Partial<FreekickState>): FreekickState => ({ ...freekickGame.init(FREEKICK_DEAL[0]!), acted: 1, ...over });

export const entry: StdEntry = {
  type: "freekick",
  field: "freekickRev",
  rev: 1,
  parts: FREEKICK_STD_SPEC.parts,
  spec: ARCADE_STANDARD.freekick.spec!,
  liveSpec: true,
  perfect: () => seeds.map((seed) => replayed(seed, oracleRun(seed), `the oracle on deal seed ${seed}`)),
  played: () => {
    const events: ArcadeInputEvent[] = [];
    // A feeble kick straight into the wall: an input that scores nothing.
    recordInput(events, { t: 60, k: FREEKICK_INPUT_KICK, a: 0, b: 0, c: 0, d: 0 }, FREEKICK_INPUT_RANGES);
    return [{ ...replayed(FREEKICK_DEAL[0]!, events, "one feeble kick"), want: 1 }];
  },
  idle: () => [replayed(FREEKICK_DEAL[1]!, [], "no input at all")],
  core: { fullAt: FREEKICK_CORE_FULL, at: (v) => base({ units: v }), parts: freekickStdParts },
  extra(ok) {
    const p = (s: FreekickState, k: string) => freekickStdParts(s)!.find((x) => x.key === k)!.points;
    for (let t = 0; t <= 4; t++) ok(p(base({ targets: t }), "targets") === 10 * t, `${t} targets → ${10 * t}`);
    for (let c = 0; c <= 10; c++) ok(p(base({ curled: c }), "curl") === 2 * c, `${c} goals round the wall → ${2 * c}`);
    ok(p(base({ best: 4 }), "streak") === 0 && p(base({ best: 5 }), "streak") === 10 && p(base({ best: 10 }), "streak") === 10, "five in a row: 10 once, from five");
  },
};
