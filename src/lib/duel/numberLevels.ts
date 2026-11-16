/**
 * Checkout's and Kakuro's levels (Number overhaul stage 3, 15 Nov 2026; docs/number-overhaul.md "Stage 3"). Joe's
 * decision for both games: today's game becomes Hard exactly (Checkout checkoutRev 3, Kakuro kakuroRev 2, dealt as
 * rooms dealt them before levels), and Normal, Easy and Expert are new deals on a new stamp per game
 * (CHECKOUT_REV_LEVELS, KAKURO_REV_LEVELS). Rated play and the Daily deal Normal, so they get the new Normal.
 *
 * checkoutRev 4 plays and grades as checkoutRev 3 (the bust, the standard's scoring), with the number of boards and
 * each board's ring, darts and values carried on the stored puzzle; Easy's boards check out on any dart (`anyRing`).
 * kakuroRev 3 plays and grades as kakuroRev 2 (rule-breaking digits are mistakes), its grid size and white squares on
 * the stored puzzle. The level settings live in gameLevels.ts (`checkout`, `kakuro`); Normal's here. The check-only pins
 * `preCheckoutLevels` / `preKakuroLevels` (and any older era pinned) deal today's game at Normal. Shared and plain.
 */
import { activeDealPins, dealPinned } from "./dealEra";

/** Checkout's levels stamp (Normal, Easy, Expert since 15 Nov 2026; Hard is checkoutRev 3, today's game). */
export const CHECKOUT_REV_LEVELS = 4;
/** Kakuro's levels stamp (Normal, Easy, Expert since 15 Nov 2026; Hard is kakuroRev 2, today's game). */
export const KAKURO_REV_LEVELS = 3;

/** One board of a Checkout level: its wedges, ring, darts and target band. */
export interface CheckoutBoardPlan {
  /** standard: 1–20 as on a real board; shuffled: 1–20 in a seeded order; uneven: 20 distinct values 5–60. */
  wedges: "standard" | "shuffled" | "uneven";
  /** Two wedges made negative, never next to each other. */
  negatives?: boolean;
  finish: 2 | 3;
  /** Any dart may check out (Easy). */
  anyRing?: boolean;
  /** The thin ×4 ring. */
  quad?: boolean;
  maxDarts: number;
  /** Exactly `maxDarts` darts. */
  exact?: boolean;
  target: readonly [number, number];
  /** At least this many routes (keeps the board learnable). */
  minRoutes?: number;
  /** Always throwing the biggest dart that fits must not finish it. */
  notGreedy?: boolean;
}

/** A Checkout level (GAME_LEVELS `checkout`, CHECKOUT_NORMAL): today's game, or its boards. */
export interface CheckoutLevelSettings {
  /** Hard: today's game exactly (generateCheckout, checkoutRev 3). */
  today?: boolean;
  boards?: readonly CheckoutBoardPlan[];
  /** Every board found by the person-like solver (checkout.server.ts `checkoutPersonFinds`). */
  person?: boolean;
}

/** A Kakuro level (GAME_LEVELS `kakuro`, KAKURO_NORMAL): today's game, or its grid. */
export interface KakuroLevelSettings {
  /** Hard: today's game exactly (generateKakuro, kakuroRev 2). */
  today?: boolean;
  /** Grid squares across and down, the clue row and column included. */
  size?: number;
  whiteMin?: number;
  whiteMax?: number;
  /** The grade band (branch points beyond deduction, kakuro.server.ts `gradeKakuro`). */
  gradeMin?: number;
  gradeMax?: number;
  /** Most white 2 × 2 blocks a layout may hold. */
  maxBlocks?: number;
  /** Every board completed by the person-like solver (kakuro.server.ts `kakuroPersonSolve`). */
  person?: boolean;
}

/** The new Normal (gentler than today's, which is now Hard): three standard boards and two with shuffled numbers. */
export const CHECKOUT_NORMAL: CheckoutLevelSettings = {
  boards: [
    { wedges: "standard", finish: 2, maxDarts: 3, target: [40, 100], minRoutes: 50 },
    { wedges: "standard", finish: 2, maxDarts: 3, target: [60, 120], minRoutes: 50 },
    { wedges: "standard", finish: 2, maxDarts: 3, target: [80, 140], minRoutes: 50 },
    { wedges: "shuffled", finish: 2, maxDarts: 3, target: [60, 120], minRoutes: 50 },
    { wedges: "shuffled", finish: 2, maxDarts: 3, target: [100, 160], minRoutes: 50 },
  ],
  person: true,
};

/** The new Normal Kakuro (gentler than today's 6 × 6, which is now Hard): 6 × 6, 16–19 white squares, grade 0–4. */
export const KAKURO_NORMAL: KakuroLevelSettings = {
  size: 6,
  whiteMin: 16,
  whiteMax: 19,
  gradeMin: 0,
  gradeMax: 4,
  maxBlocks: 7,
  person: true,
};

/** True when a check asks for the world before these levels: a Normal deal is then today's game. */
export function checkoutLevelsPinned(): boolean {
  return dealPinned("preCheckoutLevels") || activeDealPins().length > 0;
}

export function kakuroLevelsPinned(): boolean {
  return dealPinned("preKakuroLevels") || activeDealPins().length > 0;
}

/** True on a board dealt with the levels (kakuroRev 3 / checkoutRev 4): the kits and the stage read it. */
export function checkoutLevelsBoard(puzzle: { checkoutRev?: number } | null | undefined): boolean {
  return (puzzle?.checkoutRev ?? 0) >= CHECKOUT_REV_LEVELS;
}

export function kakuroLevelsBoard(puzzle: { kakuroRev?: number } | null | undefined): boolean {
  return (puzzle?.kakuroRev ?? 0) >= KAKURO_REV_LEVELS;
}
