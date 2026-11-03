/**
 * arcade-standard-check's entry for `homerun` (Home Run, homerunRev 4 since 3 Nov 2026, "pick your spot"; rev 3 dealt
 * 1 Nov 2026, rev 1 the stamp it was born on; see ./entry.ts and docs/arcade-standard/homerun.md). Perfect runs are
 * the oracle's (scripts/homerun-oracle.ts: the lit sign's centre as the spot, every tap on the perfect tick) on rev 4's
 * proved deal seeds, replayed through the server path; at quick depth 24 of the 300 (spread through the deal), at full
 * depth all of them.
 */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { recordInput } from "../../src/lib/arcade/engine";
import {
  homerunCheckpoint,
  homerunGameFor,
  homerunStdParts,
  HOMERUN_CHECKPOINT_INTERVAL,
  HOMERUN_INPUT_RANGES_V4,
  HOMERUN_INPUT_SPOT,
  HOMERUN_INPUT_TAP,
  HOMERUN_REV_4,
  HOMERUN_STD_SPEC_V4,
  HOMERUN_V4_FULL_AT,
  type HomerunState,
} from "../../src/lib/arcade/homerun";
import { encodeHomerunRun, replayHomerunRun } from "../../src/lib/duel/homerun";
import { HOMERUN_DEAL_V4 } from "../../src/lib/duel/homerunDealV4.server";
import { oracleRun, playLog } from "../homerun-oracle";
import type { StdEntry, StdRun } from "./entry";

const FULL = process.env["CHECKS_FULL"] === "1";
const REV = HOMERUN_REV_4;
const game = homerunGameFor(REV);
const seeds = FULL ? [...HOMERUN_DEAL_V4] : HOMERUN_DEAL_V4.filter((_, i) => i % Math.ceil(HOMERUN_DEAL_V4.length / 24) === 0);

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
  before: 3,
  parts: HOMERUN_STD_SPEC_V4.parts,
  spec: ARCADE_STANDARD.homerun.spec!,
  liveSpec: true,
  perfect: () => seeds.map((seed) => replayed(seed, oracleRun(seed, REV), `the oracle on rev-4 deal seed ${seed}`)),
  played: () => {
    const seed = HOMERUN_DEAL_V4[0]!;
    const tapped: ReturnType<typeof oracleRun> = [];
    // One tap long before the first pitch (ignored as a swing, but the player played).
    recordInput(tapped, { t: 5, k: HOMERUN_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 }, HOMERUN_INPUT_RANGES_V4);
    const spotted: ReturnType<typeof oracleRun> = [];
    // Only a spot tapped, never a swing.
    recordInput(spotted, { t: 5, k: HOMERUN_INPUT_SPOT, a: 120, b: 190, c: 0, d: 0 }, HOMERUN_INPUT_RANGES_V4);
    return [
      { ...replayed(seed, tapped, "one tap before the first pitch"), want: 1 },
      { ...replayed(seed, spotted, "only a spot tapped, never a swing"), want: 1 },
    ];
  },
  idle: () => [replayed(HOMERUN_DEAL_V4[1]!, [], "no input at all")],
  core: { fullAt: HOMERUN_V4_FULL_AT, at: (v) => base({ feet: v }), parts: homerunStdParts },
  extra(ok) {
    const p = (s: HomerunState, k: string) => homerunStdParts(s)!.find((x) => x.key === k)!.points;
    for (let h = 0; h <= 10; h++) ok(p(base({ homers: h }), "homers") === 4 * h, `${h} home runs → ${4 * h}`);
    for (let n = 0; n <= 10; n++) ok(p(base({ bonus: n }), "signs") === 2 * n, `${n} lit signs struck → ${2 * n}`);
    for (let n = 0; n <= 10; n++) ok(p(base({ best: n }), "streak") === 2 * n, `a best perfect streak of ${n} → ${2 * n}`);
    ok(game.score(base({ feet: 3000, homers: 10, bonus: 10, best: 10 })) === 200, "10 × 300 ft, 10 home runs, 10 lit signs and 10 perfect in a row → 200");
    ok(game.score(base({ feet: 2990, homers: 10, bonus: 10, best: 10 })) < 200, "10 ft short of the full core is short of 200");
    ok(base({}).rev === REV, "the dealt game's state carries homerunRev 4");
  },
};
