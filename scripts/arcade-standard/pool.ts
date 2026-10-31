/**
 * arcade-standard-check's entry for `pool` (see ./entry.ts): Cue Ball poolRev 2 (31 Oct 2026; the Sports group, born on
 * the standard at poolRev 1 on 30 Oct 2026; docs/arcade-standard/pool.md). Spots up to 140 (20 each of 7), Black 10,
 * Pots in a row up to 30 (5 for each pot straight after another), Speed up to 20 (the black potted, full by the
 * revision's own time); fouls −10 each. Perfect runs are the poolRev 2 bank's witnesses through the server's replay,
 * and a built state; poolRev 1 (stored rounds) keeps its parts and its bank's witnesses still score 200.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { poolFullByS, poolGameFor, poolStdParts, POOL_FULL_BY_S, POOL_REV, POOL_REV_V1, POOL_SPOTS, POOL_STD_SPEC, type PoolState } from "../../src/lib/arcade/pool";
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { replayPoolRun } from "../../src/lib/duel/pool";
import { POOL_BANK } from "../../src/lib/duel/poolBank.server";
import { POOL_BANK_V2 } from "../../src/lib/duel/poolBankV2.server";
import { caseEntry, type StdCase, type StdEntry } from "./entry";

const game = poolGameFor(POOL_REV);
const SEED = POOL_BANK_V2[0]!;
const witness = JSON.parse(readFileSync(new URL("../fixtures/pool-witness.json", import.meta.url), "utf8")) as Record<string, string>;
const witnessV2 = JSON.parse(readFileSync(new URL("../fixtures/pool-witness-v2.json", import.meta.url), "utf8")) as Record<string, string>;

function final(over: Partial<PoolState>, g = game, seed = SEED): PoolState {
  return { ...g.init(seed), acted: 1, over: 1, spotsDown: 0, black: 0, follows: 0, fouls: 0, finishAt: 0, ...over };
}
const part = (s: PoolState, key: string) => poolStdParts(s)!.find((p) => p.key === key)!.points;

const stdCase: StdCase = {
  game,
  perfect: () => final({ spotsDown: POOL_SPOTS, black: 1, follows: 7, finishAt: 60 * 30 }),
  idle: () => final({}),
  core: (v: number) => final({ spotsDown: v }),
  fullAt: POOL_SPOTS,
  older: () => ({ ...game.init(SEED), rev: 0 }),
  extra(ok) {
    for (let f = 0; f <= 8; f++) ok(part(final({ follows: f }), "streak") === Math.min(30, 5 * f), `pool: ${f} follow-up pots → ${Math.min(30, 5 * f)}`);
    const fullBy = poolFullByS(POOL_REV);
    ok(part(final({ spotsDown: 7, black: 1, finishAt: fullBy * 60 }), "speed") === 20, `pool: the black by poolRev 2's full-by time (${fullBy} s) → speed 20`);
    ok(fullBy === 67 || part(final({ spotsDown: 7, black: 1, finishAt: fullBy * 60 + 60 }), "speed") < 20, "pool: a second past the full-by time is under 20");
    ok(part(final({ spotsDown: 7, black: 1, finishAt: 7200 }), "speed") === 0, "pool: the black at the buzzer → speed 0");
    ok(part(final({ spotsDown: 3, black: 2, finishAt: 600 }), "speed") === 0 && part(final({ spotsDown: 3, black: 2 }), "black") === 0, "pool: the black early pays neither black nor speed");
    ok(game.score(final({ spotsDown: 2, fouls: 1 })) === 30, "pool: two spots and a foul score 40 − 10 = 30");
    ok(game.score(final({ fouls: 3 })) === 1, "pool: a played run never scores under 1");
    let twoHundred = 0;
    for (const seed of POOL_BANK_V2) {
      const run = replayPoolRun(seed, witnessV2[String(seed)] ?? "", POOL_REV);
      if (run.score === 200 && !run.flagged && run.fouls === 0) twoHundred++;
    }
    ok(twoHundred === POOL_BANK_V2.length, `pool: every poolRev 2 bank layout's witness clears it to 200 with no foul, through the server replay (${twoHundred} of ${POOL_BANK_V2.length})`);
    // poolRev 1 (stored rounds): its parts, its 67 s full-by time and its bank's witnesses, unchanged.
    const g1 = poolGameFor(POOL_REV_V1);
    const s1 = final({ spotsDown: 7, black: 1, finishAt: POOL_FULL_BY_S * 60 }, g1, POOL_BANK[0]!);
    ok(s1.rev === 1 && part(s1, "speed") === 20 && g1.score(s1) >= 170, "pool: poolRev 1 keeps its parts and its 67 s full-by time");
    let v1 = 0;
    for (const seed of POOL_BANK) {
      const run = replayPoolRun(seed, witness[String(seed)] ?? "", POOL_REV_V1);
      if (run.score === 200 && !run.flagged && run.fouls === 0) v1++;
    }
    ok(v1 === POOL_BANK.length, `pool: every poolRev 1 bank layout's witness still clears it to 200, through the server replay (${v1} of ${POOL_BANK.length})`);
  },
};

const base = caseEntry("pool", ARCADE_STANDARD.pool!.spec!, ARCADE_STANDARD.pool!.parts, stdCase);
export const entry: StdEntry = {
  ...base,
  perfect: async () => [
    ...(await base.perfect()),
    ...POOL_BANK_V2.slice(0, 10).map((seed) => {
      const run = replayPoolRun(seed, witnessV2[String(seed)] ?? "", POOL_REV);
      return { label: `poolRev 2 bank layout ${seed}'s witness (server replay)`, score: run.flagged ? -1 : run.score, parts: Object.fromEntries((poolStdParts(run.state) ?? []).map((p) => [p.key, p.points])) };
    }),
  ],
};
void POOL_STD_SPEC;
