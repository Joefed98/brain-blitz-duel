/**
 * The Games page's view (P2, 22 Nov 2026; Joe, 20 Nov: "G1 shelves by default, plus one switch to All", remembered on
 * the device): Shelves (the game of the day, then a sideways row per family) or All (every game in the three-across
 * grid, grouped by family). A per-viewer convenience only, beside `duelz-practice-side:v1`: device storage, every
 * read and write guarded, Shelves without storage.
 */
export type GamesView = "shelves" | "all";

export const GAMES_VIEW_KEY = "duelz-games-view:v1";

export function readGamesView(): GamesView {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(GAMES_VIEW_KEY) === "all" ? "all" : "shelves";
  } catch {
    return "shelves";
  }
}

export function rememberGamesView(view: GamesView): void {
  try {
    localStorage.setItem(GAMES_VIEW_KEY, view);
  } catch {
    /* this visit only */
  }
}
