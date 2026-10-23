/**
 * Public games (Tournaments, beta): the schedule Joe edits. One entry per scheduled public game,
 * in UK time (Europe/London, so BST and GMT are handled by the date). Nothing else needs changing:
 * the Play tab's "Next public game" card and the Tournaments tab read this list, and an empty list
 * hides the card.
 *
 *   date        "YYYY-MM-DD", the UK date the game starts
 *   time        "HH:MM", 24-hour UK time the game starts
 *   lobbyOpens  "HH:MM", 24-hour UK time the room's lobby opens (the same day); "Join now" shows from then
 *   rounds      rounds the game will play (shown on the card; the host sets the room as usual)
 *   roomCode    the code of the persistent public room (4 letters, as shown in the lobby)
 *   title       optional name for the game ("Saturday night quiz")
 *
 * Example (remove the leading // to use it):
 *   { date: "2026-10-24", time: "19:00", lobbyOpens: "18:45", rounds: 6, roomCode: "PLAY" },
 *
 * Past games drop off by themselves. Results on the Tournaments tab are this device's places in
 * rooms whose code is listed here.
 */
export interface PublicGameConfig {
  date: string;
  time: string;
  lobbyOpens: string;
  rounds: number;
  roomCode: string;
  title?: string;
}

/**
 * The beta's persistent public room. "JOULZ" can't be a room code: codes are 4 letters with no I or O
 * (generateRoomCode, src/lib/duel/puzzles.ts), so the nearest valid code is JULZ. New rooms never get
 * it (RESERVED_ROOM_CODES); the room itself is made once by hand (docs/beta-sql.md section 11).
 */
export const PUBLIC_ROOM_CODE = "JULZ";

export const PUBLIC_GAMES: PublicGameConfig[] = [
  { date: "2026-10-27", time: "20:00", lobbyOpens: "19:45", rounds: 6, roomCode: PUBLIC_ROOM_CODE, title: "Beta launch night" },
  { date: "2026-10-29", time: "20:00", lobbyOpens: "19:45", rounds: 6, roomCode: PUBLIC_ROOM_CODE, title: "Thursday night game" },
];
