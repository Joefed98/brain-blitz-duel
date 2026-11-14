/** A game's page (the Games session owns this file; a stub until it lands: today's Practice route for that game). */
export const gamePageHref = (gameId: string): string => `/practice?game=${encodeURIComponent(gameId)}`;
