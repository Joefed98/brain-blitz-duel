/**
 * The Number overhaul (15 Nov 2026, phase 2 step 4, docs/design/game-reviews/number.md, docs/number-overhaul.md):
 * four games move one stamp up for a rule change; the other four change look and input only.
 *
 *   - Counterweight `balanceRev 4` (BALANCE_REV_FREE_MOVES): only a new hang from the tray counts towards the scale's
 *     hang limit; a hung weight can be picked up again and moved to another notch for free. The balance ("18 | 15")
 *     shows under the beam. The scales, limits and every scoring number are balanceRev 3's.
 *   - Operator `gapsRev 2` (GAPS_REV_FAIR_TRIES): a full line uses a try only when it is a fill not tried before on
 *     that equation; an empty gap can be chosen as the next to fill; a skipped equation can be gone back to while time
 *     is left. The equations and scoring are gapsRev 1's.
 *   - Checkout `checkoutRev 3` (CHECKOUT_REV_BUST): a dart that takes a board past its target, to exactly 0 off the
 *     stated ring or (on a double finish) to 1 is a bust, as in real darts: that board's darts are cleared and it
 *     starts again. The boards and scoring are checkoutRev 2's.
 *   - Kakuro `kakuroRev 2` (KAKURO_REV_RULE_MISTAKES): a mistake is a digit that breaks a rule (a repeat in a run, or
 *     a full run off its clue, or a run that can no longer reach its clue), never a digit merely different from the
 *     stored solution. The boards and every scoring number are kakuroRev 1's.
 *
 * Every older stamp deals, grades and reads exactly as before. Checks written for the stamps before pin new deals to
 * them with `pinPreNumberOverhaul(true)`. Shared by phone and server, pure.
 */
import { dealPinned, setDealPin } from "./dealEra";

/** Counterweight's stamp before the overhaul (moveLimits.ts, the hang limits 9 / 12 / 15 / 18). */
export const BALANCE_REV_LIMITS = 3;
/** Counterweight: moving a hung weight is free, the balance is shown. */
export const BALANCE_REV_FREE_MOVES = 4;
/** Operator's gaps stamp before the overhaul (operatorGaps.ts). */
export const GAPS_REV_FIRST = 1;
/** Operator: tries only on a new fill, choose the gap, go back to skipped equations. */
export const GAPS_REV_FAIR_TRIES = 2;
/** Checkout's stamp before the overhaul (checkout.ts, the depth stamp's big finishes). */
export const CHECKOUT_REV_DEPTH = 2;
/** Checkout: overshooting busts the board. */
export const CHECKOUT_REV_BUST = 3;
/** Kakuro's stamp before the overhaul (born on the standard). */
export const KAKURO_REV_FIRST = 1;
/** Kakuro: only digits that break a rule are mistakes. */
export const KAKURO_REV_RULE_MISTAKES = 2;

/** Checks written for the stamps before 15 Nov 2026's overhaul deal them; returns the previous setting. */
export function pinPreNumberOverhaul(on: boolean): boolean {
  return setDealPin("preNumberOverhaul", on);
}

export function preNumberOverhaulPinned(): boolean {
  return dealPinned("preNumberOverhaul");
}

type Stamped = { type: string; balanceRev?: number; gapsRev?: number; checkoutRev?: number; kakuroRev?: number };

/**
 * The four games one stamp up, each only over the stamp it was dealt on today (so checks that deal older eras keep
 * them); any other game, or with the pin, unchanged.
 */
export function dealNumberOverhaul<T extends { type: string }>(puzzle: T): T {
  if (dealPinned("preNumberOverhaul")) return puzzle;
  const p = puzzle as unknown as Stamped;
  if (p.type === "balance" && p.balanceRev === BALANCE_REV_LIMITS) return { ...puzzle, balanceRev: BALANCE_REV_FREE_MOVES };
  if (p.type === "equation" && p.gapsRev === GAPS_REV_FIRST) return { ...puzzle, gapsRev: GAPS_REV_FAIR_TRIES };
  if (p.type === "checkout" && p.checkoutRev === CHECKOUT_REV_DEPTH) return { ...puzzle, checkoutRev: CHECKOUT_REV_BUST };
  if (p.type === "kakuro" && p.kakuroRev === KAKURO_REV_FIRST) return { ...puzzle, kakuroRev: KAKURO_REV_RULE_MISTAKES };
  return puzzle;
}

const typed = (puzzle: unknown, type: string): Stamped | null => {
  const p = puzzle as Stamped | null;
  return p && p.type === type ? p : null;
};

/** Counterweight balanceRev 4+: only new hangs count, moving is free, the balance is shown. */
export const balanceFreeMoves = (puzzle: unknown): boolean => (typed(puzzle, "balance")?.balanceRev ?? 0) >= BALANCE_REV_FREE_MOVES;
/** Operator gapsRev 2+: tries only for a fill not tried before, any gap, skipped equations revisited. */
export const operatorFairTries = (puzzle: unknown): boolean => (typed(puzzle, "equation")?.gapsRev ?? 0) >= GAPS_REV_FAIR_TRIES;
/** Checkout checkoutRev 3+: overshooting busts the board. */
export const checkoutBust = (puzzle: unknown): boolean => (typed(puzzle, "checkout")?.checkoutRev ?? 0) >= CHECKOUT_REV_BUST;
/** Kakuro kakuroRev 2+: only digits that break a rule are mistakes. */
export const kakuroRuleMistakes = (puzzle: unknown): boolean => (typed(puzzle, "kakuro")?.kakuroRev ?? 0) >= KAKURO_REV_RULE_MISTAKES;
