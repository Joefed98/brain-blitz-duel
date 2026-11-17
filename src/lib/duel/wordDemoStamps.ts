/**
 * The Word overhaul's intro-demo stamp rule (15 Nov 2026): a Word game's saved demo plays only when its puzzle carries the
 * game's own stamp exactly as rooms deal it today (LIVE_DEAL, the dealt signature), so a demo recorded before a Word stamp
 * changed stops (the intro shows its still) until one is recorded on the new stamp. The presentation revision
 * (wordInput.ts WORD_OVERHAUL_PRESENTATION) stops coordinate demos recorded on the older boards; this stops older deals.
 */
import { LIVE_DEAL } from "./dealSignature";

/** Each Word game's own stamp field. */
export const WORD_DEMO_STAMP: Readonly<Record<string, string>> = {
  wordsmith: "wordsmithRev",
  tilegrid: "tileGridRev",
  wordslide: "wordSlideRev",
  wordhunt: "wordHuntRev",
  wordsearch: "wordSearchRev",
  letterwheel: "wheelRev",
  strikeout: "strikeoutRev",
  codeword: "codewordRev",
  swapword: "swapwordRev",
};

/** True when `puzzle` (a saved demo's) may play for `type`; always true for a game that is not a Word game. */
export function wordDemoStampOk(type: string, puzzle: unknown): boolean {
  const field = WORD_DEMO_STAMP[type];
  if (!field) return true;
  const dealt = LIVE_DEAL[type]?.[field];
  if (dealt == null || typeof puzzle !== "object" || puzzle === null) return false;
  return (puzzle as Record<string, unknown>)[field] === dealt;
}
