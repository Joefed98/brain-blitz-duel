/**
 * arcade-standard-check's entry for `homerun` (Home Run, homerunRev 3 since 1 Nov 2026, two above rev 1, the stamp it
 * was born on; see ./entry.ts and docs/arcade-standard/homerun.md). Perfect runs are the oracle's
 * (scripts/homerun-oracle.ts: Power on every pitch, each met on its kind's perfect tick) on rev 3's proved deal seeds, replayed through the server path; at quick depth 24 of the
 * 300 (spread through the deal), at full depth all of them.
 */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { recordInput } from "../../src/lib/arcade/engine";
import {
  homerunCheckpoint,
  homerunGameFor,
  homerunStdParts,
  HOMERUN_CHECKPOINT_INTERVAL,
  HOMERUN_FULL_AT_V3,
  HOMERUN_INPUT_MODE,
  HOMERUN_INPUT_RANGES_V3,
  HOMERUN_INPUT_SWING,
  HOMERUN_REV_3,
  HOMERUN_STD_SPEC_V3,
  type HomerunState,
} from "../../src/lib/arcade/homerun";
import { encodeHomerunRun, replayHomerunRun } from "../../src/lib/duel/homerun";
import { HOMERUN_DEAL_V3 } from "../../src/lib/duel/homerunDealV3.server";
import { oracleRun, playLog } from "../homerun-oracle";
import type { StdEntry, StdRun } from "./entry";

const FULL = process.env["CHECKS_FULL"] === "1";
const REV = HOMERUN_REV_3;
const game = homerunGameFor(REV);
const seeds = FULL ? [...HOMERUN_DEAL_V3] : HOMERUN_DEAL_V3.filter((_, i) => i % Math.ceil(HOMERUN_DEAL_V3.length / 24) === 0);

function replayed(seed: number, events: ReturnType<typeof oracleRun>, label: string): StdRun {
  const s = playLog(seed, events, REV);
  // The phone's checkpoints, as it records them (every HOMERUN_CHECKPOINT_INTERVAL ticks).
  const at = new Map(events.map((e) => [e.t, e]));
  const checkpoints = [];
  for (let r = game.init(seed); !game.isOver(r); ) {
    r = game.step(r, at.get(r.tick + 1) ?? null);
    if (r.tick % HOMERUN_CHECKPOINT_INTERVAL === 0) checkpoints.push(homerunCheckpoint(r));
  }
  const raw = encodeHomerunRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
  const r = replayHomerunRun(seed, raw, REV);
  return { label, score: r.score, parts: Object.fromEntries(r.parts.map((p) => [p.key, p.points])), partMaxes: Object.fromEntries(r.parts.map((p) => [p.key, p.max])) };
}

const base = (over: Partial<HomerunState>): HomerunState => ({ ...game.init(4242), acted: 1, ...over });

export const entry: StdEntry = {
  type: "homerun",
  field: "homerunRev",
  rev: REV,
  before: 2,
  parts: HOMERUN_STD_SPEC_V3.parts,
  spec: ARCADE_STANDARD.homerun.spec!,
  liveSpec: true,
  perfect: () => seeds.map((seed) => replayed(seed, oracleRun(seed, REV), `the oracle on rev-3 deal seed ${seed}`)),
  played: () => {
    const seed = HOMERUN_DEAL_V3[0]!;
    const events: ReturnType<typeof oracleRun> = [];
    // One swipe long before the first pitch (ignored by the sim, but the player played).
    recordInput(events, { t: 5, k: HOMERUN_INPUT_SWING, a: 100, b: 0, c: 0, d: 0 }, HOMERUN_INPUT_RANGES_V3);
    const chose: ReturnType<typeof oracleRun> = [];
    // Only the swing choice pressed, never a swing.
    recordInput(chose, { t: 5, k: HOMERUN_INPUT_MODE, a: 1, b: 0, c: 0, d: 0 }, HOMERUN_INPUT_RANGES_V3);
    return [
      { ...replayed(seed, events, "one swipe before the first pitch"), want: 1 },
      { ...replayed(seed, chose, "only Power chosen, never a swing"), want: 1 },
    ];
  },
  idle: () => [replayed(HOMERUN_DEAL_V3[1]!, [], "no input at all")],
  core: { fullAt: HOMERUN_FULL_AT_V3, at: (v) => base({ feet: v }), parts: homerunStdParts },
  extra(ok) {
    const p = (s: HomerunState, k: string) => homerunStdParts(s)!.find((x) => x.key === k)!.points;
    for (let h = 0; h <= 10; h++) ok(p(base({ homers: h }), "homers") === 5 * h, `${h} home runs → ${5 * h}`);
    for (let n = 0; n <= 4; n++) ok(p(base({ signs: (1 << n) - 1 }), "signs") === 5 * n, `${n} signs struck → ${5 * n}`);
    ok(game.score(base({ feet: 4600, homers: 10, signs: 15 })) === 200, "10 × 460 ft, 10 home runs and the 4 signs → 200");
    ok(game.score(base({ feet: 4500, homers: 10, signs: 15 })) < 200, "10 × 450 ft is short of the full core on rev 3");
    ok(base({}).rev === REV, "the dealt game's state carries homerunRev 3");
  },
};
