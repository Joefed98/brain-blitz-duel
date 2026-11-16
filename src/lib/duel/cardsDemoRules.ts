/**
 * The Cards & Board intro demos' version rule (the overhaul's stage 3, 15 Nov 2026): a saved demo plays only when it was
 * recorded on the stamps rooms deal today (freecellRev 5, mahjongRev 2, tripeaksRev 3, fiveHandsRev 3, pyramidRev 3)
 * and at Normal (no `level`); an older demo stops where the stamp changed and the intro shows the game's still until a
 * demo is recorded on today's stamps (scripts/fixtures/cards-demos.json, saved by scripts/cards-demos-save.ts). Plain
 * data and a pure test (getIntroDemoFn reads it; cards-demos-check proves it).
 */
export const CARDS_DEMO_STAMPS: Readonly<Record<string, { field: string; rev: number }>> = {
  freecell: { field: "freecellRev", rev: 5 },
  mahjong: { field: "mahjongRev", rev: 2 },
  tripeaks: { field: "tripeaksRev", rev: 3 },
  fivehands: { field: "fiveHandsRev", rev: 3 },
  pyramid: { field: "pyramidRev", rev: 3 },
};

/** Whether a saved demo's puzzle may play for `type` (always true for any other game). */
export function cardsDemoPlays(type: string, puzzle: unknown): boolean {
  const stamp = CARDS_DEMO_STAMPS[type];
  if (!stamp) return true;
  if (!puzzle || typeof puzzle !== "object") return false;
  const p = puzzle as Record<string, unknown>;
  return p["type"] === type && p[stamp.field] === stamp.rev && p["level"] === undefined;
}
