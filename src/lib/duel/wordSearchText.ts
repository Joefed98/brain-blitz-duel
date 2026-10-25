/**
 * Lookout's score text under wordSearchRev 3 (25 Oct 2026, word depth d1): the hidden bonus word. The intro SCORE
 * line and the "?" help, from the rev-3 helper's figures and the bonus constants (wordSearch.ts), so they always
 * state what rooms deal. "{max}" is filled with the round's maximum (roundMax.ts).
 */
import { dealtLimitMs, rev3Figures } from "./puzzleBandsText";
import { WS_BONUS_FOUND, WS_BONUS_SPEED, WS_BONUS_UNFINISHED, WS_STRETCH } from "./wordSearch";

/** Seconds of play a finish with the bonus word may take and still score the maximum. */
export function wordSearchBonusFastSeconds(): number {
  return Math.round((dealtLimitMs("wordsearch") * (1 - WS_STRETCH.elite)) / 1000);
}

export function wordSearchBonusIntro(): string {
  const f = rev3Figures("wordsearch");
  return `Each word: up to 110. Finish: 120+, 150 in about ${f.fastSeconds} s. Hidden bonus word: up to {max}.`;
}

export function wordSearchBonusHelp(): string {
  const f = rev3Figures("wordsearch");
  return `Progress counts: words found (wrong picks after the first 5 cost a little). Unfinished scores up to 110: about ${f.half} half done, 110 one word short. Any finish scores 120 to 150: 120 as time runs out, 150 if you finish in about ${f.fastSeconds} s with no mistakes. One more theme word is hidden but not listed: finding it before the sixth word is the only way higher: +${WS_BONUS_FOUND} with the finish; the rest of the way to {max} (+${WS_BONUS_SPEED} more) only at elite pace, all of it if you finish in about ${wordSearchBonusFastSeconds()} s with no mistakes; found without finishing, +${WS_BONUS_UNFINISHED}.`;
}
