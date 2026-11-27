/**
 * The Cards & Board intro demos' version rule (the overhaul's stage 3, 15 Nov 2026): a saved demo plays only when it was
 * recorded on the stamps rooms deal today (freecellRev 6, mahjongRev 2, tripeaksRev 4, fiveHandsRev 4, pyramidRev 4; D6, 23 Nov
 * 2026, moved Free Cell, Summit, Five Hands and Thirteen to their Normal scoring stamps, and their demos were re-recorded on them)
 * and at Normal (no `level`); an older demo stops where the stamp changed and the intro shows the game's still until a
 * demo is recorded on today's stamps (scripts/fixtures/cards-demos.json, saved by scripts/cards-demos-save.ts). Plain
 * data and a pure test (getIntroDemoFn reads it; cards-demos-check proves it).
 */
export const CARDS_DEMO_STAMPS: Readonly<Record<string, { field: string; rev: number }>> = {
  freecell: { field: "freecellRev", rev: 6 },
  mahjong: { field: "mahjongRev", rev: 2 },
  tripeaks: { field: "tripeaksRev", rev: 4 },
  fivehands: { field: "fiveHandsRev", rev: 4 },
  pyramid: { field: "pyramidRev", rev: 4 },
};

/** Whether a saved demo's puzzle may play for `type` (always true for any other game). */
export function cardsDemoPlays(type: string, puzzle: unknown): boolean {
  const stamp = CARDS_DEMO_STAMPS[type];
  if (!stamp) return true;
  if (!puzzle || typeof puzzle !== "object") return false;
  const p = puzzle as Record<string, unknown>;
  return p["type"] === type && p[stamp.field] === stamp.rev && p["level"] === undefined;
}
