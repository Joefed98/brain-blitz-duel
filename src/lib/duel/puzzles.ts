import { PUBLIC_GAMES, PUBLIC_ROOM_CODE } from "@/config/publicGames";

import { pick } from "./random";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "./roomCode";
import { puzzleDef } from "./registry";
import { type PuzzleData } from "./types";

export function checkAnswer(puzzle: PuzzleData, answer: string): boolean {
  return puzzleDef(puzzle.type).check(answer, puzzle);
}


/**
 * Codes a new room never gets: the beta's persistent public room, whether or not a game is scheduled
 * in it, and any other code the public games use (src/config/publicGames.ts).
 */
export const RESERVED_ROOM_CODES: ReadonlySet<string> = new Set(
  [PUBLIC_ROOM_CODE, ...PUBLIC_GAMES.map((g) => g.roomCode)].map((code) => code.trim().toUpperCase()),
);

export function generateRoomCode(): string {
  for (;;) {
    let code = "";
    // From 7 Nov 2026 the challenge codes' alphabet (roomCode.ts); older rooms keep their letter codes.
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += pick(ROOM_CODE_ALPHABET.split(""));
    if (!RESERVED_ROOM_CODES.has(code)) return code;
  }
}
