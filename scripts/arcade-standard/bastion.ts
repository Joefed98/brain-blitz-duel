/**
 * arcade-standard-check's entry for `bastion` (Iron Wall, the tank-defence shooter, Action; born on the standard at
 * bastionRev 2, bastionRev 3 added the drones; dealt at bastionRev 4 since the levels, 15 Nov 2026;
 * docs/arcade-standard/bastion.md). Perfect runs are the oracle's (scripts/bastion-oracle.ts) through the server's replay
 * on tuning and fresh seeds at Normal, the level rooms deal (bastion-levels-check proves every level on 260 seeds); the
 * core is hit points destroyed on a straight line, full at the level's own total (Normal's 57); the original (unstamped)
 * Bastion's state has no standard parts.
 *
 * Changed with Joe's approval, 15 Nov 2026 (too-hard games: today's becomes Expert): the entry follows the dealt stamp,
 * bastionRev 4 at Normal (rev 3, now Expert, is the stamp before; its rules stay proved in bastion-check).
 * Changed with Joe's approval, 26 Nov 2026 (D5's ladder): the entry follows bastionRev 5 at Normal, bastionRev 4's Normal
 * game with Weak spots full at 28 hits (rev 4 is the stamp before; every level's lines are BT5_LEVELS, proved in
 * bastion-ladder-check).
 */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { recordInput, type ArcadeInputEvent } from "../../src/lib/arcade/engine";
import {
  bastionStdParts,
  bastionTankCheckpoint,
  bastionTankGameFor,
  bastionTotalHp,
  BASTION_LADDER_LEVELS, // Changed with Joe's approval, 26 Nov 2026
  BASTION_REV_LADDER, // Changed with Joe's approval, 26 Nov 2026
  BASTION_REV_LEVELS,
  BASTION_STD_SPEC_V5, // Changed with Joe's approval, 26 Nov 2026
  BT2_CHECKPOINT_INTERVAL,
  BT2_INPUT_AIM,
  BT2_INPUT_RANGES,
  BT5_LEVELS, // Changed with Joe's approval, 26 Nov 2026
  type BastionLadderLevel, // Changed with Joe's approval, 26 Nov 2026
  type BastionTankState,
} from "../../src/lib/arcade/bastionTank";
import { bastionGame } from "../../src/lib/arcade/bastion";
import { encodeBastionTankRun, replayBastionTankRun } from "../../src/lib/duel/bastion";
import { bastionOracleRun, bastionPlayLog } from "../bastion-oracle";
import type { StdEntry, StdRun } from "./entry";

const game = bastionTankGameFor(BASTION_REV_LADDER, "normal"); // Changed with Joe's approval, 26 Nov 2026
const NORMAL_HP = bastionTotalHp(BASTION_REV_LADDER, "normal"); // Changed with Joe's approval, 26 Nov 2026

function replayed(seed: number, events: ArcadeInputEvent[], label: string, level: BastionLadderLevel = "normal"): StdRun { // Changed with Joe's approval, 26 Nov 2026
  const g = bastionTankGameFor(BASTION_REV_LADDER, level); // Changed with Joe's approval, 26 Nov 2026
  const s = bastionPlayLog(seed, events, BASTION_REV_LADDER, level); // Changed with Joe's approval, 26 Nov 2026
  const at = new Map(events.map((e) => [e.t, e]));
  const checkpoints = [];
  for (let r = g.init(seed); !g.isOver(r); ) {
    r = g.step(r, at.get(r.tick + 1) ?? null);
    if (r.tick % BT2_CHECKPOINT_INTERVAL === 0) checkpoints.push(bastionTankCheckpoint(r));
  }
  const raw = encodeBastionTankRun({ seed, claimedScore: g.score(s), events, endTick: s.tick, checkpoints });
  const r = replayBastionTankRun(seed, raw, BASTION_REV_LADDER, level); // Changed with Joe's approval, 26 Nov 2026
  return { label, score: r.score, parts: Object.fromEntries(r.parts.map((p) => [p.key, p.points])), partMaxes: Object.fromEntries(r.parts.map((p) => [p.key, p.max])) };
}

const base = (over: Partial<BastionTankState>, level: BastionLadderLevel = "normal"): BastionTankState => ({ ...bastionTankGameFor(BASTION_REV_LADDER, level).init(4242), acted: 1, ended: 1, base: 0, ...over }); // Changed with Joe's approval, 26 Nov 2026

export const entry: StdEntry = {
  type: "bastion",
  field: "bastionRev",
  rev: BASTION_REV_LADDER, // Changed with Joe's approval, 26 Nov 2026
  // bastionRev 4 (Normal before the ladder) is the stamp before. // Changed with Joe's approval, 26 Nov 2026
  before: BASTION_REV_LEVELS, // Changed with Joe's approval, 26 Nov 2026
  parts: BASTION_STD_SPEC_V5.normal.parts, // Changed with Joe's approval, 26 Nov 2026
  spec: ARCADE_STANDARD.bastion!.spec!,
  liveSpec: true,
  perfect: () => [0, 1, 2, 59, 10000, 10199, 123456789].map((seed) => replayed(seed, bastionOracleRun(seed, BASTION_REV_LADDER, "normal"), `the oracle on seed ${seed}`)), // Changed with Joe's approval, 26 Nov 2026
  played: () => {
    const events: ArcadeInputEvent[] = [];
    recordInput(events, { t: 5, k: BT2_INPUT_AIM, a: 195, b: 400, c: 1, d: 0 }, BT2_INPUT_RANGES);
    return [{ ...replayed(31, events, "one aim and nothing more"), want: 1 }];
  },
  idle: () => [replayed(32, [], "no input at all")],
  help: { terms: ["hit point", "weak spot", "fast reload", "drones"] },
  core: { fullAt: NORMAL_HP, at: (v) => base({ destroyedHp: v }), parts: bastionStdParts },
  older: () => bastionStdParts(bastionGame.init(5) as unknown as BastionTankState) === null,
  extra(ok) {
    const p = (s: BastionTankState, k: string) => bastionStdParts(s)!.find((x) => x.key === k)!.points;
    // Normal's Weak spots on a straight line, all of it at 28 hits (BT5_LEVELS.normal.weakFull). // Changed with Joe's approval, 26 Nov 2026
    const weakAt = (w: number) => Math.floor((30 * Math.min(w, 28)) / 28); // Changed with Joe's approval, 26 Nov 2026
    for (let w = 0; w <= 32; w += 4) ok(p(base({ weak: w }), "weak") === weakAt(w), `bastion: ${w} weak-spot hits → ${weakAt(w)}`); // Changed with Joe's approval, 26 Nov 2026
    for (let f = 0; f <= 12; f += 2) ok(p(base({ fast: f }), "fast") === Math.min(20, 2 * f), `bastion: ${f} fast reloads → ${Math.min(20, 2 * f)}`);
    for (let d = 0; d <= 3; d++) ok(p(base({ drones: d }), "drone") === 10 * d, `bastion: ${d} drones → ${10 * d}`);
    for (const level of BASTION_LADDER_LEVELS) { // Changed with Joe's approval, 26 Nov 2026
      const set = BT5_LEVELS[level]; // Changed with Joe's approval, 26 Nov 2026
      const full = set.base; // Changed with Joe's approval, 26 Nov 2026
      const free = set.baseFree; // Changed with Joe's approval, 26 Nov 2026
      const hp = bastionTotalHp(BASTION_REV_LADDER, level); // Changed with Joe's approval, 26 Nov 2026
      const b = (over: Partial<BastionTankState>) => base(over, level);
      ok(p(b({ base: full - free }), "base") === 10 && p(b({ base: full - free - 1 }), "base") === 5 && p(b({ base: full - free - 2 }), "base") === 0 && p(b({ base: full, ended: 2 }), "base") === 0, `bastion ${level}: base intact 10 / 5 / 0 with ${free} / ${free + 1} / ${free + 2} hits of ${full}, 0 once it fell`); // Changed with Joe's approval, 26 Nov 2026
      ok(bastionTankGameFor(BASTION_REV_LADDER, level).score(b({ destroyedHp: hp, weak: 30, fast: 10, drones: 3, base: full })) === 200, `bastion ${level}: ${hp} HP, 30 weak-spot hits, 10 fast reloads, 3 drones and the base whole → 200`); // Changed with Joe's approval, 26 Nov 2026
      ok(bastionStdParts(b({}))!.reduce((a, x) => a + x.max, 0) === 200, `bastion ${level}: the parts' maximums sum to 200`);
      for (const seed of [0, 10000]) ok(replayed(seed, bastionOracleRun(seed, BASTION_REV_LADDER, level), `oracle ${level} ${seed}`, level).score === 200, `bastion ${level}: the oracle on seed ${seed} scores 200 through the server replay`); // Changed with Joe's approval, 26 Nov 2026
    }
  },
};
