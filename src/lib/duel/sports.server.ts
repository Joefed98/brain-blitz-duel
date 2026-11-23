/**
 * Server-only deals for the Sports group (30 Oct 2026). Home Run Derby, Free Kick and Racing store one seed from the
 * game's proved deal (`<game>Deal.server.ts`: seeds the oracle took to exactly 200 through the server replay), picked by
 * a fresh CSPRNG seed; Minigolf, Speed Pool and Curling deal from their banks of proven courses, tables and sheets
 * (every one played to 200 by its oracle through the server's replay; minigolf-check, pool-check and curling-check
 * replay the proofs). Everyone in a room plays the identical run and a perfect run is always there; each is stamped
 * on its first revision, on the arcade scoring standard.
 */
import { HOMERUN_REV_DEALT } from "@/lib/arcade/homerun";
import { FREEKICK_REV_DEALT } from "@/lib/arcade/freekick";
import { RACING_REV_3, RACING_REV_DEALT, type RacingLevelSettings } from "@/lib/arcade/racing";
import { checkOverride } from "@/lib/checkOverride";
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import { NORMAL, type Level } from "@/lib/levels/levels";
import { racingDealSeedV3 } from "./racingDealV3.server";
import { arcadeSeed } from "./arcade.server";
import { homerunDealSeedV5 } from "./homerunDealV5.server";
import { homerunDealSeedV4 } from "./homerunDealV4.server";
import { freekickDealSeedV4 } from "./freekickDealV4.server";
import { dealPinned } from "./dealEra";
import { freekickDealSeedV6 } from "./freekickDealV6.server";
import { HOMERUN_REV_6, hrLevelOf } from "@/lib/arcade/homerunInnings";
import { homerunDealSeedV6 } from "./homerunDealV6.server";
import { fkLevelOf } from "@/lib/arcade/freekick";
import { racingDealSeedV4 } from "./racingDealV4.server";
import { racingDealSeedV4Easy } from "./racingDealV4Easy.server";
import { racingDealSeedV4Hard } from "./racingDealV4Hard.server";
import { racingDealSeedV4Expert } from "./racingDealV4Expert.server";
import { MINIGOLF_REV, MINIGOLF_REV_COURSE, mgLevelOf, MG_LEVELS, MG_LEVEL_NAMES, type MgLevel } from "@/lib/arcade/minigolf";
import { MINIGOLF_HOLES_BANK, type MinigolfHoleEntry } from "./minigolfHolesBank.server";
import { POOL_REV, POOL_REV_V4 } from "@/lib/arcade/pool";
import { CURLING_REV } from "@/lib/arcade/curling";
import { CURLING_BANK_V4 } from "./curlingBankV4.server";
import { CURLING_LEVEL_BANKS } from "./curlingLevelBanks.server";
import { MINIGOLF_BANK_V2 } from "./minigolfBankV2.server";
import { POOL_BANK_V3 } from "./poolBankV3.server";
import { ALLEYROLL_REV_DEALT } from "@/lib/arcade/alleyroll";
import type { AlleyRollPuzzleData, CurlingPuzzleData, FreekickPuzzleData, HomerunPuzzleData, MinigolfPuzzleData, PoolPuzzleData, RacingPuzzleData } from "./types";

/**
 * homerunRev 5 (15 Nov 2026, the innings): the level's own proved deal (homerunDealV5.server.ts). `level` is the
 * difficulty framework's (absent or "normal": Normal, stamped with no `level` field); rev 1–4 rounds replay on their own
 * revisions (their deal files stay as they were).
 */
export function generateHomerun(level?: string | null): HomerunPuzzleData {
  // A check's era pin (dealEra.ts): rooms' deal before the overhaul, homerunRev 4 from its own proved deal.
  if (dealPinned("sportsPreOverhaul")) return { type: "homerun", seed: homerunDealSeedV4(arcadeSeed()), homerunRev: 4 };
  const l = hrLevelOf(level);
  // D6 (23 Nov 2026): level deals stamp homerunRev 6 and play D6's levels (HR_LEVEL_SETTINGS' "easy6" … keys) from their
  // own proved deal (homerunDealV6.server.ts); Normal stays homerunRev 5. Checks written for the levels before pin
  // d6PreLevels.
  if (l !== "normal" && !dealPinned("d6PreLevels")) return { type: "homerun", seed: homerunDealSeedV6(arcadeSeed(), l), homerunRev: HOMERUN_REV_6, level: l } as HomerunPuzzleData;
  return { type: "homerun", seed: homerunDealSeedV5(arcadeSeed(), l), homerunRev: HOMERUN_REV_DEALT, ...(l !== "normal" ? { level: l } : {}) };
}

/** Top Bins deals freekickRev 6 (16 Nov 2026: rev 5 with Easy and Normal eased, Hard and Expert harder) from the level’s proved deal; rev 1–5 rounds replay on their own. */
export function generateFreekick(level?: string | null): FreekickPuzzleData {
  if (dealPinned("sportsPreOverhaul")) return { type: "freekick", seed: freekickDealSeedV4(arcadeSeed()), freekickRev: 4 };
  const l = fkLevelOf(level);
  return { type: "freekick", seed: freekickDealSeedV6(arcadeSeed(), l), freekickRev: FREEKICK_REV_DEALT, ...(l !== "normal" ? { level: l } : {}) };
}

export function generateRacing(level: Level = NORMAL): RacingPuzzleData {
  // Apex deals racingRev 4 (15 Nov 2026, the Sports overhaul: three named circuits) from its own proved deal;
  // racingRev 3, 2 and 1 rounds replay on theirs (racingDealV3.server.ts, racingDealV2.server.ts, racingDeal.server.ts).
  // Checks written for racingRev 3 pin racingPreCircuits, a check-only switch read through checkOverride (as Minefield's
  // minesPreLogic): a production build never deals rev 3.
  if (checkOverride<boolean>("__DUELZ_RACING_PRE_CIRCUITS__") === true) return { type: "racing", seed: racingDealSeedV3(arcadeSeed()), racingRev: RACING_REV_3 };
  // Difficulty levels (stage 3, 16 Nov 2026): Easy, Hard and Expert deal from their own proved deals and stamp the
  // level's settings (racingLevel) for the sim; Normal deals exactly as before (no field, the same draw).
  const settings = level === NORMAL ? null : gameLevelSettings<RacingLevelSettings>("racing", level);
  if (!settings) return { type: "racing", seed: racingDealSeedV4(arcadeSeed()), racingRev: RACING_REV_DEALT };
  const deal = level === "easy" ? racingDealSeedV4Easy : level === "hard" ? racingDealSeedV4Hard : racingDealSeedV4Expert;
  return { type: "racing", seed: deal(arcadeSeed()), racingRev: RACING_REV_DEALT, racingLevel: {
      keep: settings.keep,
      road: settings.road,
      kerb: settings.kerb,
      wall: settings.wall,
      tight: settings.tight,
      ...(settings.tightBy ? { tightBy: [...settings.tightBy] } : {}),
      aids: settings.aids,
      ...(settings.pace ? { pace: [...settings.pace] } : {}),
      ...(settings.spread ? { spread: settings.spread } : {}),
    },
  };
}

/**
 * golfRev 3's five holes at a level, one per slot, drawn with `draw` (the server's CSPRNG; checks pass a seeded one):
 * five whose witnesses fit the level's Speed time together (their worst times summed, the bank's `t`), so a perfect run
 * always scores 200. A fresh draw until one fits (at least half of all draws do at every level), else each slot's
 * quickest hole, which always fits (crazy-golf-v3-check).
 */
export function pickMinigolfHoles(level: MgLevel, draw: () => number): MinigolfHoleEntry[] {
  const at = MG_LEVEL_NAMES.indexOf(level);
  const budget = MG_LEVELS[level].fullByS * 60;
  const sum = (p: readonly MinigolfHoleEntry[]) => p.reduce((a, e) => a + e.t[at]!, 0);
  let picks = MINIGOLF_HOLES_BANK.map((slot) => slot[draw() % slot.length]!);
  for (let tries = 0; tries < 64 && sum(picks) > budget; tries++) picks = MINIGOLF_HOLES_BANK.map((slot) => slot[draw() % slot.length]!);
  if (sum(picks) > budget) picks = MINIGOLF_HOLES_BANK.map((slot) => slot.reduce((a, e) => (e.t[at]! < a.t[at]! ? e : a)));
  return picks;
}

export function generateMinigolf(level: unknown = "normal"): MinigolfPuzzleData {
  if (dealPinned("minigolfPreCourse")) {
    // golfRev 2 (crazy golf, 31 Oct 2026) deals from its own proven bank; golfRev 1's bank (minigolfBank.server.ts) still replays.
    const entry = MINIGOLF_BANK_V2[arcadeSeed() % MINIGOLF_BANK_V2.length]!;
    return { type: "minigolf", seed: entry.seed, golfRev: MINIGOLF_REV, pars: [...entry.pars] };
  }
  // golfRev 3 (the Crazy Golf overhaul, 15 Nov 2026): one hole from each slot of the proven hole bank, with its par at the
  // dealt level (a level the deal doesn't know is Normal). Stored once, so a room's players all play the same five.
  const lv: MgLevel = mgLevelOf(level);
  const at = MG_LEVEL_NAMES.indexOf(lv);
  const seed = arcadeSeed();
  const picks = pickMinigolfHoles(lv, arcadeSeed);
  return {
    type: "minigolf",
    seed,
    golfRev: MINIGOLF_REV_COURSE,
    holes: picks.map((e) => e.id),
    pars: picks.map((e) => e.pars[at]!),
    ...(lv === "normal" ? {} : { level: lv }),
  };
}

export function generatePool(): PoolPuzzleData {
  // poolRev 4 (3 Nov 2026) deals from poolRev 3's proved bank, every layout re-proved at 200 on poolRev 4
  // (pool-bank.ts --rev=4, pool-check); poolRev 2 and 1 rounds replay on theirs (poolBankV2 / poolBank).
  // poolRev 5 (D6, 22 Nov 2026: Speed from the fifth pot) deals the same bank, every layout re-proved at 200 on it
  // (pool-bank.ts --rev=5). Checks written for poolRev 4 pin poolPreFifth.
  return { type: "pool", seed: POOL_BANK_V3[arcadeSeed() % POOL_BANK_V3.length]!, poolRev: dealPinned("poolPreFifth") ? POOL_REV_V4 : POOL_REV };
}

export function generateCurling(level?: string | null): CurlingPuzzleData {
  // The levels (the Sports overhaul, 15 Nov 2026): Easy, Hard and Expert each deal a sheet from their own bank, every
  // seed proved at 200 at that level (curlingLevelBanks.server.ts); the deal stamps `level` itself (generate.server.ts).
  // Normal (no level) is curlRev 4's deal exactly, the same draw from the same bank.
  if (level === "easy" || level === "hard" || level === "expert") {
    const bank = CURLING_LEVEL_BANKS[level];
    return { type: "curling", seed: bank[arcadeSeed() % bank.length]!, curlRev: CURLING_REV };
  }
  // curlRev 4 (3 Nov 2026): its own bank, proved with three reds and curling's count (curlingBankV4.server.ts); curlRev 3
  // rounds replay on curlingBankV3.server.ts's sheets, curlRev 2 on curlingBankV2's, curlRev 1 on curlingBank's.
  return { type: "curling", seed: CURLING_BANK_V4[arcadeSeed() % CURLING_BANK_V4.length]!, curlRev: CURLING_REV };
}

export function generateAlleyRoll(): AlleyRollPuzzleData {
  // Alley Roll (1 Nov 2026): the lane is the same for every seed (the oracle's line scores 200 on any), so any seed.
  // Ringer (alleyRollRev 2, 3 Nov 2026): the seed sets the gold cup's path; the oracle times it to 200 on any seed.
  return { type: "alleyroll", seed: arcadeSeed(), alleyRollRev: ALLEYROLL_REV_DEALT };
}
