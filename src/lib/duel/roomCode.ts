/**
 * Room codes (7 Nov 2026, from the design audit): four characters from the challenge codes' alphabet
 * (challenge.ts CHALLENGE_CODE_ALPHABET: no I, L, O, 0 or 1, so a code read aloud or off a screen can't be
 * misread). Only new rooms get codes from it; every code made before (four letters from A–Z without I or O,
 * and the public room JULZ) keeps working, so anything that reads a code accepts any four letters or digits.
 * No imports: the Play tab's boot script and the share loop read this too.
 */

/** The characters a new room's code is made from (the same as challenge codes). */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/** Room codes are four characters. */
export const ROOM_CODE_LENGTH = 4;
/** Any room code, new or old: four capital letters or digits. */
export const ROOM_CODE_PATTERN = /^[A-Z0-9]{4}$/;

export function isRoomCode(value: unknown): value is string {
  return typeof value === "string" && ROOM_CODE_PATTERN.test(value);
}

/** Typed or pasted text cleaned to a code's characters (upper-cased; everything else dropped). */
export function roomCodeChars(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}
