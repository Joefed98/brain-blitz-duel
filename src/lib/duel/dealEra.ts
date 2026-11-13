/**
 * The deal's eras in one place (B4, docs/audit-nov-2026/architecture.md). What a game deals today is the newest stamp
 * of every layer (generate.server.ts `generatePuzzle`, the arcade generators). Checks written for an older stamp ask
 * for the deal before a change; every such switch lives here, instead of a module-level `let` in each layer.
 *
 * The old `pinX(on)` functions stay as thin wrappers (same arguments, same return value, same text rebuild), so every
 * check keeps its effect. New code passes `DealOptions` instead (`withDealOptions`, or `generatePuzzle`'s third
 * argument), which sets the eras for one call and always restores them. `activeDealPins()` says whether anything is
 * pinned: with nothing pinned, the deal is the live one, and its stamps are `dealtSignature` (dealSignature.ts).
 *
 * Never set by app code. Pure state; shared by phone and server.
 */
import { rebuildLiveRecords } from "./roundMax";

/**
 * Each era switch: on = deal as rooms did before that change. `texts`: the help and intro texts follow it, so a
 * change rebuilds them (roundMax.ts `rebuildLiveRecords`), as the old pin functions did.
 */
export const DEAL_PINS = {
  /** standard/stamps.ts: the stamps before the puzzle scoring standard (27 Oct 2026). */
  preStandard: { texts: true },
  /** depthTopup.ts: the stamps before the puzzle top-up (26 Oct 2026). */
  preTopup: { texts: false },
  /** wordDepth.ts: the Word games before word depth (25 Oct 2026). */
  preDepth: { texts: false },
  /** tapLog.ts: Flash, Bang On and Ascend's tapRev before the depth stamps. */
  preDepthTapRev: { texts: false },
  /** numberDepth.ts: Number puzzles before depthRev 1 (puzzleScoreRev 3's 150 shape). */
  numberDepthOff: { texts: false },
  /** depth4/deal.server.ts: the Pattern / Logic games before depth batch 4. */
  depth4Off: { texts: false },
  /** d5Remodels.ts: Topsy-Turvy's bank and Jumbled tilesRev 2, before the D5 remodels. */
  d5LegacyDeal: { texts: false },
  /** phoneNotes.ts: the stamps before Joe's phone notes (27 Oct 2026). */
  prePhoneNotes: { texts: false },
  /** puzzleNotes.ts: Slider and Tally before Joe's puzzle notes (28 Oct 2026). */
  prePuzzleNotes: { texts: true },
  /** speedPipesNov7.ts: Flash, Bang On and Pipeline before the 7 Nov 2026 fix. */
  preNov7: { texts: true },
  /** parMoves.ts: Labyrinth, Topsy-Turvy and Skid before the puzzle batch (3 Nov 2026). */
  preParMoves: { texts: true },
  /** parMoves.ts: the puzzle batch's stamps, before the puzzle polish's stored par. */
  preParStrict: { texts: true },
  /** operatorGaps.ts: Operator's signs-only stamp, before gapsRev 1. */
  preOperatorGaps: { texts: true },
  /** partialCredit.ts: the stamps before the partial-credit fixes (7 Nov 2026). */
  prePartialCredit: { texts: true },
  /** wordNov7.ts: Interlock, Slider and Lookout before the Word scoring fix (7 Nov 2026). */
  preWordNov7: { texts: true },
  /** arcade.server.ts: Free Cell 4, Summit 2, Thirteen 1, before the card games' share fix. */
  cardsPreShare: { texts: false },
  /** arcade.server.ts: Rainbow Bridge inkRev 12. */
  inkPreClover: { texts: false },
  /** arcade.server.ts: Rainbow Bridge inkRev 13 on any seed. */
  inkPreBig: { texts: false },
  /** arcade.server.ts: Orbit orbitRev 13, before the fuel meter. */
  orbitPreFuel: { texts: false },
  /** arcade.server.ts: Grappler's bank courses, before the assault course. */
  swingPreAssault: { texts: false },
  /** arcade.server.ts: Grappler swingRev 14. */
  swingPreRework: { texts: false },
  /** arcade.server.ts: Grappler swingRev 15. */
  swingPreDark: { texts: false },
  /** arcade.server.ts: Grappler swingRev 16. */
  swingPreSlide: { texts: false },
  /** arcade.server.ts: Minefield minesRev 1 (25 mines), before it moved to Logic (13 Nov 2026). */
  minesPreLogic: { texts: false },
} as const satisfies Record<string, { texts: boolean }>;

export type DealPin = keyof typeof DEAL_PINS;
export const DEAL_PIN_NAMES = Object.keys(DEAL_PINS) as DealPin[];

const pinned = new Set<DealPin>();
let scoreRevPin: number | null = null;

/** True while a check has this era pinned. */
export function dealPinned(pin: DealPin): boolean {
  return pinned.has(pin);
}

/** Pins (on) or unpins one era; returns the previous setting. */
export function setDealPin(pin: DealPin, on: boolean): boolean {
  const prev = pinned.has(pin);
  if (on) pinned.add(pin);
  else pinned.delete(pin);
  if (prev !== on && DEAL_PINS[pin].texts) rebuildLiveRecords();
  return prev;
}

/** The puzzleScoreRev a check pinned new puzzles to (puzzleScoreRev.ts), or null for the live one. */
export function pinnedPuzzleScoreRev(): number | null {
  return scoreRevPin;
}

export function setPinnedPuzzleScoreRev(rev: number | null): void {
  scoreRevPin = rev;
}

/** What is pinned now; empty means the live deal. */
export function activeDealPins(): string[] {
  const out: string[] = DEAL_PIN_NAMES.filter((p) => pinned.has(p));
  if (scoreRevPin !== null) out.push(`puzzleScoreRev=${scoreRevPin}`);
  return out;
}

/** An explicit era for one deal (checks and tools): the eras to deal before, and a puzzleScoreRev to stamp. */
export interface DealOptions {
  pins?: readonly DealPin[];
  puzzleScoreRev?: number | null;
}

/**
 * Runs `fn` with exactly these eras pinned (everything else live), then restores what was set before, even on a throw.
 * No options, or empty ones, run `fn` as it is.
 */
export function withDealOptions<T>(options: DealOptions | undefined, fn: () => T): T {
  if (!options || (!options.pins?.length && options.puzzleScoreRev === undefined)) return fn();
  const before = new Set(pinned);
  const beforeRev = scoreRevPin;
  const want = new Set(options.pins ?? []);
  for (const pin of DEAL_PIN_NAMES) setDealPin(pin, want.has(pin));
  if (options.puzzleScoreRev !== undefined) scoreRevPin = options.puzzleScoreRev;
  try {
    return fn();
  } finally {
    for (const pin of DEAL_PIN_NAMES) setDealPin(pin, before.has(pin));
    scoreRevPin = beforeRev;
  }
}
