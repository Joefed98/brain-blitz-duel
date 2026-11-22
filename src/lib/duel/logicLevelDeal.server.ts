/**
 * The deal for the Logic overhaul 2 levels (logicLevels.ts), server only. At Normal (or for any other game) it deals
 * nothing and the game's own path deals today's board exactly. At Easy, Hard and Expert it builds the level's board
 * and keeps it only when the person-style solver (logicHuman.server.ts) finishes it with a number of one-step trials
 * inside the level's band: never a board that needs guessing, and each level's boards as hard as the level says. Every
 * draw is from the room's own randomness (Math.random under the room's seed, or the game's seed for the grid games,
 * stepped on each try), so a room deals the same board to every player. The levels that take seconds to build (Trail
 * Hard and Expert, Regions Expert) are dealt from banks built the same way (scripts/logic-level-bank.ts).
 */
import type { Level } from "@/lib/levels/levels";
import { generateBridges } from "./bridges.server";
import { generateFences } from "./fences.server";
import { generateFillomino } from "./fillomino.server";
import { generateLightUp } from "./lightUp.server";
import { personSeconds, solveLikePerson } from "./logicHuman.server";
import type { LogicLevelGame } from "./logicLevels";
import { LOGIC_LEVEL_GAMES } from "./logicLevels";
import { logicLevel } from "./logicLevels.server";
import { generateShikaku } from "./shikaku.server";
import { generateTents } from "./tents.server";
import { generateTrail } from "./trail.server";
import type { PuzzleData, PuzzleType } from "./types";
import { isBankedLevel } from "./logicLevelBankSpec";
import { LOGIC_LEVEL_BANK } from "./logicLevelBank.server";

/** The bank builder builds entries live (scripts/logic-level-bank.ts); everything else deals the slow levels from it. */
let bankOff = false;
export function logicLevelBankOff<T>(fn: () => T): T {
  const before = bankOff;
  bankOff = true;
  try {
    return fn();
  } finally {
    bankOff = before;
  }
}

/** Tries before giving up (each try is a fresh board; the bands are set so a few suffice). */
export const LOGIC_LEVEL_TRIES = 60;

const isLogicLevelGame = (type: string): type is LogicLevelGame => (LOGIC_LEVEL_GAMES as readonly string[]).includes(type);

/** One board of `type` at its level's settings, try `k` (the grid games step their seed). */
function build(type: LogicLevelGame, level: Level, seed: () => number, k: number): PuzzleData {
  const step = (s: number) => (s + Math.imul(k, 0x9e3779b1)) >>> 1;
  switch (type) {
    case "tents":
      return generateTents(logicLevel("tents", level));
    case "shikaku":
      return generateShikaku(logicLevel("shikaku", level));
    case "lightup":
      return generateLightUp(undefined, undefined, logicLevel("lightup", level));
    case "trail":
      return generateTrail(logicLevel("trail", level));
    case "fences":
      return generateFences(step(seed()), logicLevel("fences", level));
    case "fillomino":
      return generateFillomino(step(seed()), logicLevel("fillomino", level));
    case "bridges":
      return generateBridges(step(seed()), logicLevel("bridges", level));
  }
}

function isLogicSettings(settings: unknown): settings is { person: readonly [number, number]; timeLimitMs: number } {
  const s = settings as { person?: unknown; timeLimitMs?: unknown };
  return Array.isArray(s.person) && s.person.length === 2 && typeof s.timeLimitMs === "number";
}

/** The level's board, or null at Normal and for a game this doesn't cover (the caller then deals as before levels). */
export function dealLogicLevel(type: PuzzleType, level: Level | undefined, seed: () => number): PuzzleData | null {
  if (!isLogicLevelGame(type)) return null;
  const settings = logicLevel(type, level);
  // Only the Logic levels' own settings (a check's stand-in registry may hold others: then the game's Normal board).
  if (!settings || !level || !isLogicSettings(settings)) return null;
  // The grid games' seed is drawn once (a room's is its own; elsewhere one draw), then stepped per try.
  const base = seed();
  // A slow level comes from its bank (logicLevelBankSpec.ts), the entry picked by the same seed.
  if (!bankOff && isBankedLevel(type, level)) {
    const bank = LOGIC_LEVEL_BANK[`${type}:${level}`];
    if (bank?.length) return structuredClone(bank[base % bank.length]!);
  }
  const [lo, hi] = settings.person;
  let fallback: PuzzleData | null = null;
  for (let k = 0; k < LOGIC_LEVEL_TRIES; k++) {
    let board: PuzzleData;
    try {
      board = build(type, level, () => base, k);
    } catch {
      continue;
    }
    const person = solveLikePerson(board);
    if (!person.solved) continue;
    // The person's clock (D4, 22 Nov 2026): the board's entries at the human limits and 1.5 s a one-step trial must
    // fit the level's clock, so every level board is finished by a person inside its round.
    if (personSeconds(board, person) > settings.timeLimitMs / 1000) continue;
    if (person.eliminations >= lo && person.eliminations <= hi) return board;
    // Closest fair board kept in case the band is never met (logic-levels-check measures how often: never in its samples).
    fallback ??= board;
  }
  if (fallback) return fallback;
  throw new Error(`${type} ${level} generation failed`);
}
