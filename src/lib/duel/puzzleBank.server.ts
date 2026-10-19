/**
 * Server-only precomputed banks for the six slow puzzle generators.
 *
 * Each bank is a committed data file (`<game>Bank.server.ts`) written by
 * `scripts/<game>-bank.ts`. Entry i is the live generator's output under a
 * fixed seed derived from (type, i, retry), re-checked by the game's verifier,
 * so a bank rebuilds byte-for-byte from the scripts alone. Banked boards are
 * exactly what the live generator would have produced (same rules, filters and
 * stored shape), so they carry no new stamp and grading is unchanged.
 *
 * Room start and practice draw an entry by seed (`drawBankedPuzzle`); only an
 * empty bank falls back to live generation, with a capped attempt count.
 */

import { BLOCK_MAX_ATTEMPTS, generateBlockParty, verifyBlockPartyPuzzle } from "./blockParty.server";
import { BLOCKPARTY_BANK, BLOCKPARTY_INTRO_EXAMPLE } from "./blockPartyBank.server";
import { FLOW_MAX_ATTEMPTS, generateFlow, verifyFlowPuzzle } from "./flow.server";
import { FLOW_BANK, FLOW_INTRO_EXAMPLE } from "./flowBank.server";
import { generateGravity, verifyGravityPuzzle } from "./gravity.server";
import { GRAVITY_BANK, GRAVITY_INTRO_EXAMPLE } from "./gravityBank.server";
import { SLIDE_MAX_ATTEMPTS, generateIceSlide, verifyIceSlidePuzzle } from "./slide.server";
import { ICESLIDE_BANK, ICESLIDE_INTRO_EXAMPLE } from "./iceSlideBank.server";
import { LIGHTUP_MAX_ATTEMPTS, generateLightUp, verifyLightUpPuzzle } from "./lightUp.server";
import { LIGHTUP_BANK, LIGHTUP_INTRO_EXAMPLE } from "./lightUpBank.server";
import { TUBES_MAX_ATTEMPTS, generateTubes, verifyTubesPuzzle } from "./tubes.server";
import { TUBES_BANK, TUBES_INTRO_EXAMPLE } from "./tubesBank.server";
import { withSeededRandom } from "./random";
import { SPEED_PAR_VERSION } from "./speedPar";
import { dealtPuzzleScoreRev } from "./puzzleScoreRev";
import { stampMoveLimits } from "./moveLimits.server";
import type {
  BlockPartyPuzzleData,
  FlowPuzzleData,
  GravityPuzzleData,
  LightUpPuzzleData,
  PuzzleData,
  PuzzleType,
  SlidePuzzleData,
  TubesPuzzleData,
} from "./types";

export const BANKED_TYPES = ["flow", "blockparty", "tubes", "gravity", "lightup", "iceslide"] as const;
export type BankedType = (typeof BANKED_TYPES)[number];

/** Topsy-Turvy's live generator has no cap of its own; bank builds and the fallback use this one. */
export const GRAVITY_MAX_TRIES = 20_000;

interface BankSpec<P extends PuzzleData> {
  bank: readonly P[];
  /** The fixed practice intro example, stored by the bank build (null before the first build). */
  example: P | null;
  /** The live generator, with every attempt loop capped. */
  generate: (maxAttempts: number) => P;
  /** Attempt cap for bank builds and for the live fallback. */
  maxAttempts: number;
  /** Null when the board passes every check the live generator applies. */
  verify: (puzzle: P) => string | null;
  /** Identity from the public fields only, so stored `puzzles_public` rows can be matched. */
  key: (puzzle: P) => string;
}

const SPECS: { [T in BankedType]: BankSpec<Extract<PuzzleData, { type: T }>> } = {
  flow: {
    bank: FLOW_BANK,
    example: FLOW_INTRO_EXAMPLE,
    generate: (cap) => generateFlow(undefined, cap),
    maxAttempts: FLOW_MAX_ATTEMPTS,
    verify: verifyFlowPuzzle,
    key: (p: FlowPuzzleData) => `${p.pairs.map((x) => `${x.a}-${x.b}`).join(",")}|${(p.walls ?? []).join(",")}`,
  },
  blockparty: {
    bank: BLOCKPARTY_BANK,
    example: BLOCKPARTY_INTRO_EXAMPLE,
    // In-band only: the live safety net's out-of-band layouts never enter a bank.
    generate: (cap) => generateBlockParty(cap, true),
    maxAttempts: BLOCK_MAX_ATTEMPTS,
    verify: verifyBlockPartyPuzzle,
    key: (p: BlockPartyPuzzleData) => p.blockers.join(","),
  },
  tubes: {
    bank: TUBES_BANK,
    example: TUBES_INTRO_EXAMPLE,
    generate: (cap) => generateTubes(cap),
    maxAttempts: TUBES_MAX_ATTEMPTS,
    verify: verifyTubesPuzzle,
    key: (p: TubesPuzzleData) => p.tubes.map((t) => t.join("")).join("|"),
  },
  gravity: {
    bank: GRAVITY_BANK,
    example: GRAVITY_INTRO_EXAMPLE,
    generate: (cap) => generateGravity(cap),
    maxAttempts: GRAVITY_MAX_TRIES,
    verify: verifyGravityPuzzle,
    key: (p: GravityPuzzleData) => `${p.walls.join(",")}|${p.starts.join(",")}|${p.targets.join(",")}`,
  },
  lightup: {
    bank: LIGHTUP_BANK,
    example: LIGHTUP_INTRO_EXAMPLE,
    generate: (cap) => generateLightUp(cap),
    maxAttempts: LIGHTUP_MAX_ATTEMPTS,
    verify: verifyLightUpPuzzle,
    key: (p: LightUpPuzzleData) => `${p.walls.join(",")}|${p.wallNumbers.join(",")}`,
  },
  iceslide: {
    bank: ICESLIDE_BANK,
    example: ICESLIDE_INTRO_EXAMPLE,
    generate: (cap) => generateIceSlide(cap),
    maxAttempts: SLIDE_MAX_ATTEMPTS,
    verify: verifyIceSlidePuzzle,
    key: (p: SlidePuzzleData) => `${p.start}>${p.exit}|${p.walls.join(",")}|${p.holes.join(",")}`,
  },
};

type AnySpec = BankSpec<PuzzleData>;
const spec = (type: BankedType) => SPECS[type] as unknown as AnySpec;

export function isBankedType(type: PuzzleType | string): type is BankedType {
  return (BANKED_TYPES as readonly string[]).includes(type);
}

/** The committed bank for a type (empty when it has not been built). */
export function bankFor(type: BankedType): readonly PuzzleData[] {
  return spec(type).bank;
}

/** Public identity of a banked board; null for other types or malformed rows. */
export function bankKey(puzzle: unknown): string | null {
  const type = (puzzle as { type?: string } | null)?.type;
  if (!type || !isBankedType(type)) return null;
  try {
    return `${type}:${spec(type).key(puzzle as PuzzleData)}`;
  } catch {
    return null;
  }
}

export function verifyBankedPuzzle(puzzle: PuzzleData): string | null {
  if (!isBankedType(puzzle.type)) return "not a banked type";
  return spec(puzzle.type).verify(puzzle);
}

/** murmur3 fmix32: a well-mixed 32-bit hash step. */
function fmix32(value: number): number {
  let h = value >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** FNV-1a of the type id, so each game's seeds and draws are independent. */
function typeSalt(type: BankedType): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < type.length; i++) h = Math.imul(h ^ type.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** Bump only with a deliberate rebuild of every bank. */
export const BANK_SEED_VERSION = 1;

/** The fixed generator seed for bank entry `index`, retry `retry`. */
export function bankEntrySeed(type: BankedType, index: number, retry: number): number {
  let h = fmix32(typeSalt(type) ^ BANK_SEED_VERSION);
  h = fmix32(h ^ Math.imul(index + 1, 0x9e3779b1));
  return fmix32(h ^ Math.imul(retry + 1, 0x27d4eb2f));
}

/**
 * Runs the live generator (capped) under one fixed seed and verifies the
 * result. Returns null if that seed exhausts its attempts or the board fails
 * verification; never throws, so a bank build only ever moves on to the next
 * fixed seed.
 */
export function buildBankEntry(type: BankedType, seed: number): PuzzleData | null {
  const s = spec(type);
  let puzzle: PuzzleData;
  try {
    puzzle = withSeededRandom(seed, () => s.generate(s.maxAttempts));
  } catch {
    return null;
  }
  return s.verify(puzzle) === null ? puzzle : null;
}

/** Where a seed lands in a bank of `size` entries. */
export function bankIndexFor(type: BankedType, seed: number, size: number): number {
  if (size <= 0) return 0;
  return fmix32((seed >>> 0) ^ typeSalt(type)) % size;
}

/**
 * Draws one banked board for this seed. Entries whose public identity is in
 * `avoid` (recently played by the host) are skipped by stepping forward
 * through the bank; if every entry is avoided the seed's own entry is used.
 * A deep copy is returned so the bank itself can never be mutated.
 *
 * With an empty bank this falls back to the live generator, capped at the
 * type's attempt limit; that is the only path that can throw.
 */
export function drawBankedPuzzle(
  type: BankedType,
  seed: number,
  avoid?: ReadonlySet<string>,
): PuzzleData {
  const s = spec(type);
  const size = s.bank.length;
  if (size === 0) {
    console.warn(`[puzzle-bank] ${type} bank is empty; generating live (cap ${s.maxAttempts})`);
    return s.generate(s.maxAttempts);
  }
  const start = bankIndexFor(type, seed, size);
  let chosen = s.bank[start]!;
  if (avoid && avoid.size > 0) {
    for (let step = 0; step < size; step++) {
      const entry = s.bank[(start + step) % size]!;
      if (!avoid.has(`${type}:${s.key(entry)}`)) {
        chosen = entry;
        break;
      }
    }
  }
  return JSON.parse(JSON.stringify(chosen)) as PuzzleData;
}

/**
 * The fixed practice intro example for a banked type, identical to
 * `withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(type))` (the
 * puzzle-bank check proves it). Null for other types or before a bank build.
 */
export function bankedIntroExample(type: PuzzleType): PuzzleData | null {
  if (!isBankedType(type)) return null;
  const example = spec(type).example;
  if (!example) return null;
  const copy = stampMoveLimits(JSON.parse(JSON.stringify(example)) as PuzzleData);
  return { ...(copy as object), speedPar: SPEED_PAR_VERSION, puzzleScoreRev: dealtPuzzleScoreRev() } as unknown as PuzzleData;
}
