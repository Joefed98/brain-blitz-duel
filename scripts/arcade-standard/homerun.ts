/**
 * arcade-standard-check's entry for `homerun` (Home Run Derby, homerunRev 1, born on the standard; see ./entry.ts and
 * docs/arcade-standard/homerun.md). Perfect runs are the oracle's (scripts/homerun-oracle.ts) on proved deal seeds,
 * replayed through the server path; at quick depth 24 of the 300 (spread through the deal), at full depth all of them.
 */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { recordInput } from "../../src/lib/arcade/engine";
import { homerunCheckpoint, homerunGame, homerunStdParts, HOMERUN_CHECKPOINT_INTERVAL, HOMERUN_FULL_AT, HOMERUN_INPUT_RANGES, HOMERUN_INPUT_SWING, HOMERUN_STD_SPEC, type HomerunState } from "../../src/lib/arcade/homerun";
import { encodeHomerunRun, replayHomerunRun } from "../../src/lib/duel/homerun";
import { HOMERUN_DEAL } from "../../src/lib/duel/homerunDeal.server";
import { oracleRun, playLog } from "../homerun-oracle";
import type { StdEntry, StdRun } from "./entry";

const FULL = process.env["CHECKS_FULL"] === "1";
const seeds = FULL ? [...HOMERUN_DEAL] : HOMERUN_DEAL.filter((_, i) => i % Math.ceil(HOMERUN_DEAL.length / 24) === 0);

function replayed(seed: number, events: ReturnType<typeof oracleRun>, label: string): StdRun {
  const s = playLog(seed, events);
  // The phone's checkpoints, as it records them (every HOMERUN_CHECKPOINT_INTERVAL ticks).
  const at = new Map(events.map((e) => [e.t, e]));
  const checkpoints = [];
  for (let r = homerunGame.init(seed); !homerunGame.isOver(r); ) {
    r = homerunGame.step(r, at.get(r.tick + 1) ?? null);
    if (r.tick % HOMERUN_CHECKPOINT_INTERVAL === 0) checkpoints.push(homerunCheckpoint(r));
  }
  const raw = encodeHomerunRun({ seed, claimedScore: homerunGame.score(s), events, endTick: s.tick, checkpoints });
  const r = replayHomerunRun(seed, raw, 1);
  return { label, score: r.score, parts: Object.fromEntries(r.parts.map((p) => [p.key, p.points])), partMaxes: Object.fromEntries(r.parts.map((p) => [p.key, p.max])) };
}

const base = (over: Partial<HomerunState>): HomerunState => ({ ...homerunGame.init(4242), acted: 1, ...over });

export const entry: StdEntry = {
  type: "homerun",
  field: "homerunRev",
  rev: 1,
  parts: HOMERUN_STD_SPEC.parts,
  spec: ARCADE_STANDARD.homerun.spec!,
  liveSpec: true,
  perfect: () => seeds.map((seed) => replayed(seed, oracleRun(seed), `the oracle on deal seed ${seed}`)),
  played: () => {
    const seed = HOMERUN_DEAL[0]!;
    const events: ReturnType<typeof oracleRun> = [];
    // One swipe long before the first pitch (ignored by the sim, but the player played).
    recordInput(events, { t: 5, k: HOMERUN_INPUT_SWING, a: 100, b: 0, c: 0, d: 0 }, HOMERUN_INPUT_RANGES);
    return [{ ...replayed(seed, events, "one swipe before the first pitch"), want: 1 }];
  },
  idle: () => [replayed(HOMERUN_DEAL[1]!, [], "no input at all")],
  core: { fullAt: HOMERUN_FULL_AT, at: (v) => base({ feet: v }), parts: homerunStdParts },
  extra(ok) {
    const p = (s: HomerunState, k: string) => homerunStdParts(s)!.find((x) => x.key === k)!.points;
    for (let h = 0; h <= 10; h++) ok(p(base({ homers: h }), "homers") === 5 * h, `${h} home runs → ${5 * h}`);
    for (let n = 0; n <= 4; n++) ok(p(base({ signs: (1 << n) - 1 }), "signs") === 5 * n, `${n} signs struck → ${5 * n}`);
    ok(homerunGame.score(base({ feet: 4500, homers: 10, signs: 15 })) === 200, "10 × 450 ft, 10 home runs and the 4 signs → 200");
  },
};
