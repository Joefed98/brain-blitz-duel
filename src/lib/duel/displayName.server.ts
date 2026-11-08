/**
 * Security fix M2 (Nov 2026 audit): one cleaner for every name a player sets (rooms' create and join, the daily and
 * challenge starts, a room's names copied onto a challenge board) and the same character strip for chat.
 *
 * - NFKC, so full-width and styled letters read as their plain forms;
 * - control and format characters dropped (`\p{Cc}`, `\p{Cf}`: right-to-left overrides, zero-width joiners and
 *   spaces, soft hyphens), and lone surrogates (`\p{Cs}`);
 * - whitespace runs collapsed, then cut by code point (never half an emoji);
 * - refused when offensive (boardName.server.ts, checked on the name with accents and Cyrillic / Greek look-alikes
 *   folded to Latin letters, so "fυck" and "f\u200Buck" don't pass) or reserved (the app's own name, staff words).
 *
 * Server-only. Names already stored are never rewritten (rule 4); this applies to new names only.
 */
import { NAME_REFUSED_MESSAGE, offensiveName } from "./boardName.server";
import { censor } from "./profanity.server";

/** The longest name, in code points (rooms, the daily and challenges all keep 14). */
export const DISPLAY_NAME_MAX = 14;

export const NAME_RESERVED_MESSAGE = "That name is taken by the app. Pick another.";

/** Characters no name or chat message keeps. */
const STRIP = /[\p{Cc}\p{Cf}\p{Cs}\u2028\u2029]/gu;

/** NFKC, invisible and control characters dropped, whitespace collapsed and trimmed. */
export function cleanDisplayText(raw: unknown): string {
  if (typeof raw !== "string" && typeof raw !== "number") return "";
  return String(raw).normalize("NFKC").replace(/\s+/g, " ").replace(STRIP, "").replace(/ {2,}/g, " ").trim();
}

/** The first `max` code points of a cleaned text, trimmed again. */
export function cutCodePoints(text: string, max: number): string {
  return Array.from(text).slice(0, Math.max(0, max)).join("").trim();
}

/** A name ready to store: cleaned and cut to DISPLAY_NAME_MAX code points ("" when nothing is left). */
export function cleanDisplayName(raw: unknown): string {
  return cutCodePoints(cleanDisplayText(raw), DISPLAY_NAME_MAX);
}

/** Look-alike letters (Cyrillic, Greek) mapped to the Latin letter they pass for, for the checks only. */
const LOOKALIKES: Record<string, string> = {
  а: "a", в: "b", е: "e", ё: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", у: "y", х: "x",
  і: "i", ї: "i", ј: "j", ѕ: "s", ԁ: "d", ӏ: "l", ɡ: "g", ь: "b", п: "n", г: "r", ц: "u", ш: "w", щ: "w",
  α: "a", β: "b", γ: "y", ε: "e", η: "n", ι: "i", κ: "k", ν: "v", ο: "o", ρ: "p", τ: "t", υ: "u", χ: "x",
  ω: "w", μ: "u", σ: "o", ς: "c", λ: "l",
};

/** The name as the filters read it: accents dropped and look-alike letters turned Latin (never stored). */
export function foldForCheck(name: string): string {
  return Array.from(cleanDisplayText(name).normalize("NFKD").replace(/\p{M}/gu, ""))
    .map((ch) => {
      const lower = ch.toLowerCase();
      const latin = LOOKALIKES[lower];
      if (!latin) return ch;
      return ch === lower ? latin : latin.toUpperCase();
    })
    .join("");
}

/** Names that stand for the app or its staff: refused anywhere in a name (the app's names) or as the whole name. */
const RESERVED_ANYWHERE = ["joulz", "duelz"];
const RESERVED_WHOLE = ["admin", "administrator", "staff", "moderator", "official", "support", "system"];

function lettersOf(name: string): string {
  return foldForCheck(name)
    .toLowerCase()
    .replace(/[@4]/g, "a")
    .replace(/[0]/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[5$]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/[^a-z]/g, "");
}

/** True when a name stands for the app or its staff. */
export function reservedName(name: string): boolean {
  const letters = lettersOf(name);
  if (!letters) return false;
  return RESERVED_ANYWHERE.some((word) => letters.includes(word)) || RESERVED_WHOLE.includes(letters);
}

/** Why a cleaned name can't be used, or null when it can. */
export function nameRefusal(name: string): { message: string; reason: "offensive" | "reserved" } | null {
  if (offensiveName(name) || offensiveName(foldForCheck(name))) return { message: NAME_REFUSED_MESSAGE, reason: "offensive" };
  if (reservedName(name)) return { message: NAME_RESERVED_MESSAGE, reason: "reserved" };
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
