/**
 * One cleaner for every name a player sets (rooms' create and join, the daily and
 * challenge starts, a room's names copied onto a challenge board) and the same character strip for chat.
 *
 * - NFKC, so full-width and styled letters read as their plain forms;
 * - control and format characters dropped (`\p{Cc}`, `\p{Cf}`: right-to-left overrides, zero-width joiners and
 *   spaces, soft hyphens), and lone surrogates (`\p{Cs}`);
 * - whitespace runs collapsed, then cut by code point (never half an emoji);
 * - refused when offensive (boardName.server.ts, checked on the name with accents and Cyrillic / Greek look-alikes
 *   folded to Latin letters, so "fυck" and "f\u200Buck" don't pass) or reserved (the app's own name, staff words).
 *
 * Server-only. Names already stored are never rewritten (rule 4); this applies to new names only. Since 10 Nov 2026
 * (accounts) the filter, reserved and look-alike rules are the shared names module's (src/lib/names/), and the length
 * is a guest name's 16 code points.
 */
import { cleanDisplayText, cutCodePoints, foldForCheck } from "@/lib/names/fold";
import { isReservedName, nameProblem } from "@/lib/names/names.server";
import { GUEST_NAME_MAX } from "@/lib/names/username";

import { NAME_REFUSED_MESSAGE, offensiveName } from "./boardName.server";
import { censor } from "./profanity.server";

export { cleanDisplayText, cutCodePoints, foldForCheck };

/**
 * The longest name, in code points: a guest name's 16 (src/lib/names/username.ts, 10 Nov 2026; 14 before). Rooms,
 * the daily and challenges all keep it.
 */
export const DISPLAY_NAME_MAX = GUEST_NAME_MAX;

export const NAME_RESERVED_MESSAGE = "That name is taken by the app. Pick another.";

/** A name ready to store: cleaned and cut to DISPLAY_NAME_MAX code points ("" when nothing is left). */
export function cleanDisplayName(raw: unknown): string {
  return cutCodePoints(cleanDisplayText(raw), DISPLAY_NAME_MAX);
}

/**
 * True when a name stands for the app or its staff (the shared list, src/lib/names/reserved.ts, read with
 * look-alikes folded: src/lib/names/names.server.ts).
 */
export function reservedName(name: string): boolean {
  return isReservedName(name);
}

/** Why a cleaned name can't be used, or null when it can (the shared check, src/lib/names/names.server.ts). */
export function nameRefusal(name: string): { message: string; reason: "offensive" | "reserved" } | null {
  const problem = nameProblem(name);
  if (problem === "offensive") return { message: NAME_REFUSED_MESSAGE, reason: "offensive" };
  if (problem === "reserved") return { message: NAME_RESERVED_MESSAGE, reason: "reserved" };
  return null;
}

/** A name copied from somewhere already stored (a room's players onto a challenge board): cleaned, else "Player". */
export function copiedDisplayName(raw: unknown): string {
  const name = cleanDisplayName(raw);
  return name && !nameRefusal(name) ? name : "Player";
}

/** Chat text: the same strip as names, whitespace collapsed, cut by code point. */
export function cleanChatText(raw: unknown, max: number): string {
  return cutCodePoints(cleanDisplayText(raw), max);
}

const CHAT_MASK = "★★★";

/**
 * Chat's mask: the room's word list (profanity.server.ts `censor`) and then every remaining token the name filter
 * refuses once look-alikes and accents are folded ("fuckyou", "fυck"), so whole-token matching is no longer the only test.
 */
export function censorChat(text: string): string {
  return censor(text).replace(/[^\s]+/g, (token) =>
    token !== CHAT_MASK && (offensiveName(token) || offensiveName(foldForCheck(token))) ? CHAT_MASK : token,
  );
}
