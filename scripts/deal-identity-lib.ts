/**
 * What every game deals, as digests (B4 of docs/audit-nov-2026/architecture.md): the deal with no pins, each check
 * pin on its own, explicit puzzleScoreRev pins, and whole rooms. Each deal runs under withSeededRandom, so the same
 * tree always digests the same; scripts/deal-identity-record.ts wrote scripts/fixtures/deal-identity.json.gz on
 * main before the deal moved into one place, and scripts/deal-identity-check.ts proves today's tree matches it.
 *
 * It reaches the pins only through the old pinX functions, which still exist, so the same code runs on both trees.
 */
import { createHash } from "node:crypto";

import { buildRoomPuzzles, generatePuzzle } from "../src/lib/duel/generate.server";
import { PUZZLE_REGISTRY } from "../src/lib/duel/registry";
import { withSeededRandom } from "../src/lib/duel/random";
import { stampSignature } from "../src/lib/duel/practiceStamps";
import { stampTieRev } from "../src/lib/duel/tieBreak";
import {
  pinCardsPreShare,
  pinInkPreBig,
  pinInkPreClover,
  pinOrbitPreFuel,
  pinSwingPreAssault,
  pinSwingPreDark,
  pinSwingPreRework,
  pinSwingPreSlide,
} from "../src/lib/duel/arcade.server";
import { pinD5LegacyDeal } from "../src/lib/duel/d5Remodels";
import { pinDepth4Off } from "../src/lib/duel/depth4/deal.server";
import { pinPreTopup } from "../src/lib/duel/depthTopup";
import { pinNumberDepth } from "../src/lib/duel/numberDepth";
import { pinPreOperatorGaps } from "../src/lib/duel/operatorGaps";
import { pinPreParMoves, pinPreParStrict } from "../src/lib/duel/parMoves";
import { pinPrePartialCredit } from "../src/lib/duel/partialCredit";
import { pinPrePhoneNotes } from "../src/lib/duel/phoneNotes";
import { pinPrePuzzleNotes } from "../src/lib/duel/puzzleNotes";
import { pinDealtPuzzleScoreRev } from "../src/lib/duel/puzzleScoreRev";
import { pinPreNov7 } from "../src/lib/duel/speedPipesNov7";
import { pinPreStandard } from "../src/lib/duel/standard/stamps";
import { pinPreDepthTapRev } from "../src/lib/duel/tapLog";
import { pinPreDepth } from "../src/lib/duel/wordDepth";
import { pinPreWordNov7 } from "../src/lib/duel/wordNov7";
import type { PuzzleType } from "../src/lib/duel/types";
import type { DealOptions } from "../src/lib/duel/dealEra";

/** Each check pin, switched on and off through its own function. */
export const PIN_VARIANTS: Record<string, (on: boolean) => unknown> = {
  cardsPreShare: pinCardsPreShare,
  inkPreClover: pinInkPreClover,
  inkPreBig: pinInkPreBig,
  orbitPreFuel: pinOrbitPreFuel,
  swingPreAssault: pinSwingPreAssault,
  swingPreRework: pinSwingPreRework,
  swingPreDark: pinSwingPreDark,
  swingPreSlide: pinSwingPreSlide,
  d5LegacyDeal: pinD5LegacyDeal,
  depth4Off: pinDepth4Off,
  preTopup: pinPreTopup,
  numberDepthOff: pinNumberDepth,
  preOperatorGaps: pinPreOperatorGaps,
  preParMoves: pinPreParMoves,
  preParStrict: pinPreParStrict,
  prePartialCredit: pinPrePartialCredit,
  prePhoneNotes: pinPrePhoneNotes,
  prePuzzleNotes: pinPrePuzzleNotes,
  preNov7: pinPreNov7,
  preStandard: pinPreStandard,
  preDepthTapRev: pinPreDepthTapRev,
  preDepth: pinPreDepth,
  preWordNov7: pinPreWordNov7,
  // The pins checks most often set together (pinPreStandard with the top-up and word depth).
  "preStandard+preTopup+preDepth": (on) => {
    pinPreStandard(on);
    pinPreTopup(on);
    pinPreDepth(on);
  },
  "scoreRev1": (on) => pinDealtPuzzleScoreRev(on ? 1 : null),
  "scoreRev2": (on) => pinDealtPuzzleScoreRev(on ? 2 : null),
};

function stable(value: unknown): unknown {
  if (value instanceof Map) return { __map: [...value.entries()].map(([k, v]) => [stable(k), stable(v)]) };
  if (value instanceof Set) return { __set: [...value].map(stable) };
  if (ArrayBuffer.isView(value)) return { __typed: Array.from(value as unknown as ArrayLike<number>) };
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      // Lightbender stores how long its build took (laser.server.ts): wall-clock time, not part of the deal.
      if (k === "generationMs") continue;
      out[k] = v === undefined ? { __undef: true } : stable(v);
    }
    return out;
  }
  return value;
}

/** Key order kept: a reordered puzzle counts as a different deal. */
export function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex").slice(0, 24);
}

export function dealDigest(type: PuzzleType, seed: number, banked: boolean, options?: DealOptions): string {
  try {
    return digest(
      withSeededRandom(seed, () =>
        generatePuzzle(type, banked ? { unblockRow: null, bankSeed: (seed * 7919 + 13) >>> 0 } : { unblockRow: null }, options),
      ),
    );
  } catch (error) {
    return `ERR ${String((error as Error)?.message ?? error).split("\n")[0]}`;
  }
}

export const TYPES = Object.keys(PUZZLE_REGISTRY).sort() as PuzzleType[];

export interface DealIdentity {
  /** `${variant}|${type}|${seed}|${banked ? "b" : "l"}` → digest. */
  deals: Record<string, string>;
  rooms: Record<string, string>;
}

/** One variant's deals: every game on each seed, banked (a room or practice seed) and live (no bank seed). */
export function variantDigests(name: string, pin: ((on: boolean) => unknown) | null, seeds: readonly number[], deals: Record<string, string>): void {
  pin?.(true);
  try {
    for (const type of TYPES) {
      for (const seed of seeds) {
        deals[`${name}|${type}|${seed}|b`] = dealDigest(type, seed, true);
        deals[`${name}|${type}|${seed}|l`] = dealDigest(type, seed, false);
      }
    }
  } finally {
    pin?.(false);
  }
}

/**
 * Whole rooms (buildRoomPuzzles). A room deals its rounds under one seeded stream, and some builds take a varying
 * number of draws (on main as well), so the later rounds' contents are not repeatable; what is recorded is repeatable:
 * the round order, each dealt puzzle's keys and version stamps, and each round re-dealt with the room's own context
 * (its seed as the bank seed, the tie-break stamp) on a stream of its own.
 */
export function roomDigests(seeds: readonly number[]): Record<string, string> {
  const rooms: Record<string, string> = {};
  for (const seed of seeds) {
    try {
      const room = withSeededRandom(seed, () => buildRoomPuzzles({ seed, unblockRow: null }));
      const shapes = room.puzzles.map((p) => {
        const loose = p as unknown as Record<string, unknown>;
        return [Object.keys(loose).filter((k) => k !== "generationMs").sort(), stampSignature(loose)];
      });
      const rounds = room.roundOrder.map((type, i) =>
        digest(withSeededRandom(seed * 31 + i, () => stampTieRev(generatePuzzle(type, { unblockRow: null, bankSeed: seed })))),
      );
      rooms[String(seed)] = digest({ order: room.roundOrder, shapes, rounds });
    } catch (error) {
      rooms[String(seed)] = `ERR ${String((error as Error)?.message ?? error).split("\n")[0]}`;
    }
  }
  return rooms;
}

export function dealIdentity(opts: { liveSeeds: number[]; pinSeeds: number[]; roomSeeds: number[]; log?: (s: string) => void }): DealIdentity {
  const deals: Record<string, string> = {};
  const variants: [string, ((on: boolean) => unknown) | null][] = [["live", null], ...Object.entries(PIN_VARIANTS)];
  for (const [name, pin] of variants) {
    const started = Date.now();
    variantDigests(name, pin, pin ? opts.pinSeeds : opts.liveSeeds, deals);
    opts.log?.(`${name}: ${Date.now() - started} ms`);
  }
  return { deals, rooms: roomDigests(opts.roomSeeds) };
}

export const FIXTURE = "scripts/fixtures/deal-identity.json.gz";
export const SEEDS = {
  liveSeeds: [1, 2, 3, 101, 20261017, 987654321],
  pinSeeds: [7, 20261109],
  roomSeeds: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26],
};
