/**
 * A game's page (phase 2 step 3, the Games session, 14 Nov 2026; mockups docs/design/style-guide/phone/intro.png and
 * desktop/intro.png): its art, name, category, time limit, best and stars, the goal and how to play, its challenges
 * and Play. The page lives on the Games tab's route, `/practice?page=<game id>`, so Back returns to the catalogue and
 * a reload opens the same page. Every link to a game's page uses this helper (the catalogue's tiles and hero, Home's
 * Recently played, the Challenges page).
 */

/** The Games tab's route; the page is its `page` search parameter. */
export const GAME_PAGE_PATH = "/practice";
export const GAME_PAGE_PARAM = "page";

/** The game's page as a URL path, e.g. "/practice?page=tubes". */
export function gamePageHref(gameId: string): string {
  return `${GAME_PAGE_PATH}?${GAME_PAGE_PARAM}=${encodeURIComponent(gameId)}`;
}

/** The same page as router navigate options ({ to, search }), for `router.navigate` and `<Link>`. */
export function gamePageLink(gameId: string): {
  to: typeof GAME_PAGE_PATH;
  search: { page: string };
} {
  return { to: GAME_PAGE_PATH, search: { page: gameId } };
}
