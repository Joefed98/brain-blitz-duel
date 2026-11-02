/**
 * arcade-standard-check's entry for `bastion` (Bastion bastionRev 2, the tank-defence shooter, Action; born on the
 * standard, docs/arcade-standard/bastion.md). Perfect runs are the oracle's (scripts/bastion-oracle.ts) through the
 * server's replay on tuning and fresh seeds (bastion-check proves all 260); the core is hit points destroyed on a straight
 * line, full at all 60; the original (unstamped) Bastion's state has no standard parts.
 */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { recordInput, type ArcadeInputEvent } from "../../src/lib/arcade/engine";
import {
  bastionStdParts,
  bastionTankCheckpoint,
  bastionTankGame,
  BASTION_REV_TANK,
  BASTION_STD_SPEC,
  BT2_CHECKPOINT_INTERVAL,
  BT2_INPUT_AIM,
  BT2_INPUT_RANGES,
  BT2_TOTAL_HP,
  type BastionTankState,
} from "../../src/lib/arcade/bastionTank";
import { bastionGame } from "../../src/lib/arcade/bastion";
import { encodeBastionTankRun, replayBastionTankRun } from "../../src/lib/duel/bastion";
import { bastionOracleRun, bastionPlayLog } from "../bastion-oracle";
import type { StdEntry, StdRun } from "./entry";

const game = bastionTankGame;

function replayed(seed: number, events: ArcadeInputEvent[], label: string): StdRun {
  const s = bastionPlayLog(seed, events);
  const at = new Map(events.map((e) => [e.t, e]));
  const checkpoints = [];
  for (let r = game.init(seed); !game.isOver(r); ) {
    r = game.step(r, at.get(r.tick + 1) ?? null);
    if (r.tick % BT2_CHECKPOINT_INTERVAL === 0) checkpoints.push(bastionTankCheckpoint(r));
  }
  const raw = encodeBastionTankRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
  const r = replayBastionTankRun(seed, raw);
  return { label, score: r.score, parts: Object.fromEntries(r.parts.map((p) => [p.key, p.points])), partMaxes: Object.fromEntries(r.parts.map((p) => [p.key, p.max])) };
}

const base = (over: Partial<BastionTankState>): BastionTankState => ({ ...game.init(4242), acted: 1, ended: 1, base: 0, ...over });

export const entry: StdEntry = {
  type: "bastion",
  field: "bastionRev",
  rev: BASTION_REV_TANK,
  // The original Bastion (unstamped, practice only) never had a stamp; the standard is the first one past it.
  before: 1,
  parts: BASTION_STD_SPEC.parts,
  spec: ARCADE_STANDARD.bastion!.spec!,
  liveSpec: true,
  perfect: () => [0, 1, 2, 59, 10000, 10199, 123456789].map((seed) => replayed(seed, bastionOracleRun(seed), `the oracle on seed ${seed}`)),
  played: () => {
    const events: ArcadeInputEvent[] = [];
    recordInput(events, { t: 5, k: BT2_INPUT_AIM, a: 195, b: 400, c: 1, d: 0 }, BT2_INPUT_RANGES);
    return [{ ...replayed(31, events, "one aim and nothing more"), want: 1 }];
  },
  idle: () => [replayed(32, [], "no input at all")],
  help: { terms: ["hit points", "weak-spot", "fast reload"] },
  core: { fullAt: BT2_TOTAL_HP, at: (v) => base({ destroyedHp: v }), parts: bastionStdParts },
  older: () => bastionStdParts(bastionGame.init(5) as unknown as BastionTankState) === null,
  extra(ok) {
    const p = (s: BastionTankState, k: string) => bastionStdParts(s)!.find((x) => x.key === k)!.points;
    for (let w = 0; w <= 32; w += 4) ok(p(base({ weak: w }), "weak") === Math.min(30, w), `bastion: ${w} weak-spot hits → ${Math.min(30, w)}`);
    for (let f = 0; f <= 12; f += 2) ok(p(base({ fast: f }), "fast") === Math.min(20, 2 * f), `bastion: ${f} fast reloads → ${Math.min(20, 2 * f)}`);
    ok(p(base({ base: 3 }), "base") === 10 && p(base({ base: 2 }), "base") === 5 && p(base({ base: 1 }), "base") === 0 && p(base({ base: 3, ended: 2 }), "base") === 0, "bastion: base intact 10 / 5 / 0, 0 once it fell");
    ok(game.score(base({ destroyedHp: BT2_TOTAL_HP, weak: 30, fast: 10, base: 3 })) === 200, `bastion: ${BT2_TOTAL_HP} HP, 30 weak-spot hits, 10 fast reloads and the base whole → 200`);
  },
};
