/**
 * arcade-standard-check's case for `skyline` (High Rise, skylineRev 9; see ./case.ts and
 * docs/arcade-standard/skyline.md). States are built by hand from skylineRev 9's init.
 */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { caseEntry, type StdCase } from "./entry";
import {
  skylineGameFor,
  skylineKinds,
  skylineKindsV9,
  skylineStdGame,
  skylineStdParts,
  SKYLINE_KIND_GOLD,
  SKYLINE_KIND_NORMAL,
  SKYLINE_REV_LIFT,
  SKYLINE_REV_STD,
  SKYLINE_SPECIAL_FROM,
  SKYLINE_V9_FULL_AT,
  SKYLINE_V9_GOLD_COUNT,
  type SkylineState,
} from "../../src/lib/arcade/skyline";

const SEED = 4242;

function run(over: Partial<SkylineState>): SkylineState {
  return { ...skylineStdGame.init(SEED), acted: 1, ...over };
}

const points = (s: SkylineState, key: string) => skylineStdParts(s)!.find((p) => p.key === key)!.points;

export const stdCase: StdCase = {
  game: skylineStdGame,
  fullAt: SKYLINE_V9_FULL_AT,
  perfect: () => run({ placed: 80, perfects: 80, bestStreak: 80, golds: SKYLINE_V9_GOLD_COUNT }),
  idle: () => run({}),
  core: (value) => run({ placed: value }),
  older: () => skylineGameFor(SKYLINE_REV_LIFT).init(SEED),
  extra(ok) {
    ok(skylineGameFor(SKYLINE_REV_STD) === skylineStdGame, "skylineGameFor(9) is the standard game");
    ok(skylineStdGame.init(SEED).expandRev === SKYLINE_REV_STD, "a rev-9 state carries expandRev 9");

    /* Perfect drops: 30 × perfects ÷ max(floors, fullAt), rounded down. */
    ok(points(run({ placed: 1, perfects: 1 }), "perfects") === 0, "one perfect drop and a quit: 30 × 1 ÷ 61 → 0");
    ok(points(run({ placed: 61, perfects: 30 }), "perfects") === Math.floor((30 * 30) / 61), "30 of 61 perfect → 14");
    ok(points(run({ placed: 30, perfects: 30 }), "perfects") === Math.floor((30 * 30) / 61), "30 of 30 perfect counts over 61 drops → 14");
    ok(points(run({ placed: 100, perfects: 50 }), "perfects") === 15, "50 of 100 perfect → 15");
    ok(points(run({ placed: 100, perfects: 100 }), "perfects") === 30, "every drop perfect → 30");

    /* Perfect streak: 1 a perfect drop in the best streak, full at 10. */
    ok(points(run({ bestStreak: 7 }), "streak") === 7, "best streak 7 → 7");
    ok(points(run({ bestStreak: 10 }), "streak") === 10, "best streak 10 → 10");
    ok(points(run({ bestStreak: 25 }), "streak") === 10, "best streak 25 → 10 (capped)");

    /* Gold blocks: 4 each landed perfectly, of 5. */
    for (let g = 0; g <= SKYLINE_V9_GOLD_COUNT; g++) ok(points(run({ golds: g }), "gold") === 4 * g, `${g} gold blocks landed perfectly → ${4 * g}`);

    /* The multiplier and milestones no longer score. */
    const base = run({ placed: 40, perfects: 20, bestStreak: 6, golds: 2 });
    const busy = { ...base, perfectUnits: 5_000, bestMult: 4, milestones: 4, streakPoints: 99 };
    ok(skylineStdGame.score(busy) === skylineStdGame.score(base), "rev 9: the streak multiplier, milestones and streak points score nothing");
    ok(skylineStdGame.score(base) === Math.floor((140 * 40) / 61) + Math.floor((30 * 20) / 61) + 6 + 8, "40 floors, 20 perfect, streak 6, 2 gold → 91 + 9 + 6 + 8");

    /* The gold schedule: exactly 5 a run, one in each fifth of blocks 4–60, never next to another special. */
    let fallbacks = 0;
    let ok5 = true;
    let okPlace = true;
    let okAdj = true;
    let okKept = true;
    const span = SKYLINE_V9_FULL_AT - SKYLINE_SPECIAL_FROM;
    for (let seed = 0; seed < 3000; seed++) {
      const k = skylineKindsV9(seed * 7919 + 13);
      const old = skylineKinds(seed * 7919 + 13);
      const golds = k.flatMap((v, i) => (v === SKYLINE_KIND_GOLD ? [i] : []));
      if (golds.length !== SKYLINE_V9_GOLD_COUNT) ok5 = false;
      golds.forEach((i, g) => {
        const lo = SKYLINE_SPECIAL_FROM + Math.floor((span * g) / SKYLINE_V9_GOLD_COUNT);
        const hi = SKYLINE_SPECIAL_FROM + Math.floor((span * (g + 1)) / SKYLINE_V9_GOLD_COUNT);
        if (i < lo || i >= hi) okPlace = false;
      });
      for (let i = 1; i < k.length; i++) if (k[i] !== SKYLINE_KIND_NORMAL && k[i - 1] !== SKYLINE_KIND_NORMAL) okAdj = false;
      if (k.length !== old.length) okKept = false;
      let changed = false;
      for (let i = 0; i < k.length; i++) {
        if (k[i] === SKYLINE_KIND_GOLD || old[i] === SKYLINE_KIND_GOLD) continue;
        if (k[i] !== old[i]) changed = true;
      }
      if (changed) fallbacks++;
    }
    ok(ok5, "every rev-9 schedule deals exactly 5 gold blocks");
    ok(okPlace, "each gold block sits in its own fifth of blocks 4–60 (all met by 61 floors)");
    ok(okAdj, "no two special blocks in a row");
    ok(okKept && fallbacks <= 60, `narrow and wide blocks stay where rev 7–8 deal them but beside a gold block placed by the rare fallback (moved on ${fallbacks} of 3000 seeds, ≤ 2 %)`);
    ok(JSON.stringify(skylineKindsV9(SEED)) === JSON.stringify(skylineKindsV9(SEED)), "the schedule comes from the seed alone");
  },
};

export const entry = caseEntry("skyline", ARCADE_STANDARD.skyline.spec!, ARCADE_STANDARD.skyline.parts, stdCase);
