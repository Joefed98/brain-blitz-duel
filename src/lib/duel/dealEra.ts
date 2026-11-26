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
import { setCheckOverride } from "@/lib/checkOverride";
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
  /** logicOverhaul2.ts: Trail depthRev 2 and Regions fillominoRev 1, before the Logic overhaul (15 Nov 2026). */
  preLogic2: { texts: true },
  /** arcade.server.ts: Free Cell 4, Summit 2, Thirteen 1, before the card games' share fix. */
  cardsPreShare: { texts: false },
  /** arcade.server.ts: Rainbow Bridge inkRev 12. */
  inkPreClover: { texts: false },
  /** arcade.server.ts: Rainbow Bridge inkRev 13 on any seed. */
  inkPreBig: { texts: false },
  /** arcade.server.ts: Orbit orbitRev 13, before the fuel meter. */
  orbitPreFuel: { texts: false },
  /** arcade.server.ts: Orbit orbitRev 14, before grace (the Action overhaul, 15 Nov 2026). */
  orbitPreGrace: { texts: false },
  /** arcade.server.ts: High Rise skylineRev 10, before lives (the Action overhaul, 15 Nov 2026). */
  skylinePreLives: { texts: false },
  /** arcade.server.ts: Grappler's bank courses, before the assault course. */
  swingPreAssault: { texts: false },
  /** arcade.server.ts: Grappler swingRev 14. */
  swingPreRework: { texts: false },
  /** arcade.server.ts: Grappler swingRev 15. */
  swingPreDark: { texts: false },
  /** arcade.server.ts: Grappler swingRev 16. */
  swingPreSlide: { texts: false },
  /** arcade.server.ts: Grappler swingRev 17, before the bigger hero (the Action overhaul's stage 2, 15 Nov 2026). */
  swingPreBig: { texts: false },
  /** arcade.server.ts: Minefield minesRev 1 (25 mines), before it moved to Logic (13 Nov 2026). */
  minesPreLogic: { texts: false },
  /** notesFree.ts: Mosaic, Tents, Lamplighter, Loopline and Island Link before notes stopped counting (15 Nov 2026). */
  preNotesFree: { texts: false },
  /** gameReviewNov15.ts: Brimful measureRev 3, before the game review fixes (15 Nov 2026). */
  preGameReviewNov15: { texts: false },
  /** logicOverhaul1.ts: Polypotions tubesRev 2, before the Logic overhaul's refunding Undo (15 Nov 2026). */
  preLogicOverhaul1: { texts: true },
  /** numberOverhaul.ts: Counterweight balanceRev 3, Operator gapsRev 1, Checkout checkoutRev 2 and Kakuro kakuroRev 1,
   * before the Number overhaul (15 Nov 2026). */
  preNumberOverhaul: { texts: true },
  /** balanceLevels.ts: Counterweight's Normal as today's game (balanceRev 4), before its levels (15 Nov 2026). */
  preBalanceLevels: { texts: false },
  /** measureLevels.ts: Brimful's Normal as today's game (measureRev 4), before its levels (15 Nov 2026). */
  preMeasureLevels: { texts: false },
  /** numberLevels.ts: Checkout's Normal as today's game (checkoutRev 3), before its levels (15 Nov 2026). */
  preCheckoutLevels: { texts: false },
  /** numberLevels.ts: Kakuro's Normal as today's game (kakuroRev 2), before its levels (15 Nov 2026). */
  preKakuroLevels: { texts: false },
  /** patternNov15.ts: the eight Pattern games before the Pattern overhaul (15 Nov 2026). */
  prePatternNov15: { texts: true },
  /** wordOverhaul.ts: Nucleus, Slider, Lookout, Roundabout and Cryptogrid before the Word overhaul (15 Nov 2026). */
  preWordOverhaul: { texts: true },
  /** attentionOverhaul.ts: Double Take spotRev 3, Tally countRev 6, Matchmaker pairRev 3, before the Attention overhaul. */
  preAttentionOverhaul: { texts: true },
  /** speedOverhaul.ts: Tenfall tenRev 5 and Pull! clayRev 9, before the Speed overhaul (15 Nov 2026). */
  preSpeedOverhaul: { texts: true },
  /** arcade.server.ts: the Retro games' stamps before the Retro overhaul (15 Nov 2026): Tempo beatRev 11, Rally rallyRev 12, Fission burstRev 11, Pinball pinRev 6, Meteor snakeRev 12, Breaker brkRev 11, Wavefront wavRev 13. */
  preRetro: { texts: false },
  /** arcade.server.ts: Roofbound flipRev 12, before the Action overhaul's grace (15 Nov 2026). */
  flipPreGrace: { texts: false },
  /** arcade.server.ts: Moon Climb ricoRev 3, before the bigger ninja (the Action overhaul's stage 2, 15 Nov 2026). */
  ricoPreBig: { texts: false },
  /** arcade.server.ts: Orbit orbitRev 15, before the bigger planets (the Action overhaul's stage 3, 15 Nov 2026). */
  orbitPreBig: { texts: false },
  /** arcade.server.ts: Iron Wall bastionRev 3, before the levels (the Action overhaul, 15 Nov 2026). */
  bastionPreLevels: { texts: false },
  /** arcade.server.ts: Coral Pop bubbleRev 11, before the Strategy overhaul's fast shot (15 Nov 2026). */
  bubblePreFast: { texts: false },
  /** arcade.server.ts: Rainbow Bridge inkRev 14 from its deal, before the Strategy overhaul's pot placements (15 Nov 2026). */
  inkPreHills: { texts: false },
  /** arcade.server.ts: Gemstone matchupRev 12, before two-hit ice and the levels (15 Nov 2026). */
  matchupPreIce2: { texts: false },
  /** sports.server.ts: Crazy Golf golfRev 2's bank courses, before the overhaul's hole bank (15 Nov 2026). */
  minigolfPreCourse: { texts: false },
  /** sports.server.ts: Home Run homerunRev 4 and Top Bins freekickRev 4, before their overhaul (15 Nov 2026). */
  sportsPreOverhaul: { texts: false },
  /** sports.server.ts: Apex racingRev 3 (one circuit), before the Sports overhaul's three circuits (15 Nov 2026). */
  racingPreCircuits: { texts: false },
  /** pyramidPartial.ts: Integer Pyramid depthRev 2, before its stone-by-stone unfinished credit (D2, 22 Nov 2026). */
  prePyramidPartial: { texts: true },
  /** ballparkBullseyes.ts: Ballpark depthRev 2, before a bullseye was worth 3 (D2, 22 Nov 2026). */
  preBallparkBullseyes: { texts: true },
  /** arcade.server.ts: Moon Climb ricoRev 4 (the 34 × 68 ninja), before the 30 × 60 one (D5, 22 Nov 2026). */
  ricoPreMid: { texts: false },
  /** arcade.server.ts: Fission burstRev 13 (bigger atoms), before burstRev 14's middle atoms (D5, 22 Nov 2026). */
  burstPreSmall: { texts: false },
  /** arcade.server.ts: Wavefront wavRev 15 from its own deal, before the wider formation (D5, 22 Nov 2026). */
  wavPreWide: { texts: false },
  /** arcade.server.ts: High Rise skylineRev 11, before skylineRev 12's lower full lines (D5 item I5, 22 Nov 2026). */
  skylinePreCount: { texts: false },
  /** arcade.server.ts: Orbit orbitRev 16 at every level, before the lost flight (D5 item H4, 22 Nov 2026). */
  orbitPreLost: { texts: false },
  /** arcade.server.ts: Iron Wall bastionRev 4 (Easy, Normal, Hard) and 3 (Expert), before the ladder (D5, 23 Nov 2026). */
  bastionPreLadder: { texts: false },
  /** arcade.server.ts: Tempo beatRev 12 (any seed, every level), before beatRev 13's lanes and lower full lines (D5's ladder, 23 Nov 2026). */
  beatPreLanes: { texts: false },
  /** arcade.server.ts: Blockzone's levels on blockfallRev 2 from Normal's deal, before blockfallRev 3's level deals (D5's ladder, 23 Nov 2026). */
  blockfallPreLevels: { texts: false },
  /** hover.server.ts: Hover hoverRev 11 (a random seed), before hoverRev 12's fitted lines and gap ladder (D5, 23 Nov 2026). */
  hoverPreFit: { texts: false },
  /** arcade.server.ts: Breaker brkRev 12 at every level, before brkRev 13's ladder (D5, 23 Nov 2026). */
  breakerPreLadder: { texts: false },
  /** arcade.server.ts: Pinball pinRev 8 at every level, before pinRev 9's ladder (D5, 23 Nov 2026). */
  pinballPreLadder: { texts: false },
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
  // Minefield's rev-1 deal is check-only (Joe, 13 Nov 2026): the deal reads it through checkOverride, which a
  // production build turns off, so the live app can never deal minesRev 1 whatever this set holds.
  if (pin === "minesPreLogic") setCheckOverride("__DUELZ_MINES_PRE_LOGIC__", on ? true : undefined);
  // Apex's rev-3 deal is check-only the same way (the Sports overhaul, 15 Nov 2026).
  if (pin === "racingPreCircuits") setCheckOverride("__DUELZ_RACING_PRE_CIRCUITS__", on ? true : undefined);
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
