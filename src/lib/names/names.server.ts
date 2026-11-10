/**
 * The one name check (10 Nov 2026, accounts): usernames now, guest room names now (room create and join,
 * duel.functions.ts), generated guest names in wave 3. Server only (the word lists stay off the phone).
 *
 * Every check reads the name three ways: as typed, folded (`foldForCheck`: NFKC, accents dropped, Cyrillic and Greek
 * look-alikes turned Latin) and as its look-alike letter forms (`lookalikeForms`: 0→o, 1→i or l, 3→e, 4→a, 5→s, 7→t,
 * @→a, $→s and repeated letters squeezed). The word filter is the existing one (src/lib/duel/boardName.server.ts
 * `offensiveName`, on the room chat's list in profanity.server.ts); the reserved names are src/lib/names/reserved.ts.
 *
 * A refusal is a plain reason and three suggestions (energy words, src/lib/names/energyWords.ts).
 */

import { offensiveName } from "@/lib/duel/boardName.server";

import { ENERGY_ADJECTIVES, ENERGY_NOUNS } from "./energyWords";
import { cleanDisplayText, cutCodePoints, foldForCheck } from "./fold";
import { hasLongRun, letterForms, lookalikeForms, squeeze } from "./lookalike";
import { RESERVED_ANYWHERE, RESERVED_WORDS } from "./reserved";
import { GUEST_NAME_MAX, USERNAME_MAX, USERNAME_RE, usernameKey, usernameShapeProblem } from "./username";

export type NameProblem = "offensive" | "reserved";

export type RefusalReason = "empty" | "length" | "characters" | NameProblem | "taken" | "held";

export interface NameRefusalInfo {
  reason: RefusalReason;
  /** A plain sentence the screens show as it is. */
  message: string;
  /** Three names that pass every check (usernames: also free, when checked against the database). */
  suggestions: string[];
}

export const NAME_MESSAGES: Record<RefusalReason, string> = {
  empty: "Type a name.",
  length: "Usernames are 3 to 16 characters.",
  characters: "Use letters, numbers and underscores only.",
  offensive: "That name can’t be used. Pick another.",
  reserved: "That name is kept for Joulz. Pick another.",
  taken: "That username is taken.",
  held: "That username was used recently. Pick another.",
};

/** Words of a name, split at spaces, underscores, hyphens and dots, trailing digits dropped ("admin_99" → admin). */
function wordsOf(folded: string): string[] {
  return folded
    .split(/[\s_\-.]+/)
    .map((w) => w.replace(/\d+$/, ""))
    .filter(Boolean);
}

function reservedWordMatch(word: string): boolean {
  for (const form of letterForms(word)) {
    for (const reserved of RESERVED_WORDS) {
      if (form === reserved) return true;
      // Squeezed only for longer words or a stretched spelling, so "Mood" isn't "mod" but "Admiin" is "admin".
      if ((reserved.length >= 5 || hasLongRun(form)) && squeeze(form) === squeeze(reserved)) return true;
    }
  }
  return false;
}

/** Whether a name stands for the app, its mascot or its staff. */
export function isReservedName(name: string): boolean {
  const folded = foldForCheck(name);
  const forms = lookalikeForms(folded);
  if (forms.some((form) => RESERVED_ANYWHERE.some((word) => form.includes(word) || form.includes(squeeze(word)))))
    return true;
  return [folded, ...wordsOf(folded)].some(reservedWordMatch);
}

/** Whether the word filter refuses a name, read as typed, folded and in every look-alike form. */
export function isOffensiveName(name: string): boolean {
  const folded = foldForCheck(name);
  if (offensiveName(name) || offensiveName(folded)) return true;
  return lookalikeForms(folded).some((form) => offensiveName(form));
}

/** Why a name can't be used (offensive or reserved), or null. */
export function nameProblem(name: string): NameProblem | null {
  if (isOffensiveName(name)) return "offensive";
  if (isReservedName(name)) return "reserved";
  return null;
}

/* ------------------------------------------------------------------ suggestions */

/** A random integer in [0, n): crypto randomness by default (suggestions are never room content). */
export type Rand = (n: number) => number;

export const cryptoRand: Rand = (n) => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! % n;
};

/** An energy-word name: "SwiftVolt48" (username) or "Swift Volt 48" (guest). Always fits its limit. */
export function energyName(kind: "username" | "guest", rand: Rand = cryptoRand): string {
  for (let tries = 0; tries < 50; tries++) {
    const adj = ENERGY_ADJECTIVES[rand(ENERGY_ADJECTIVES.length)]!;
    const noun = ENERGY_NOUNS[rand(ENERGY_NOUNS.length)]!;
    const number = String(2 + rand(98));
    const name = kind === "username" ? `${adj}${noun}${number}` : `${adj} ${noun} ${number}`;
    const max = kind === "username" ? USERNAME_MAX : GUEST_NAME_MAX;
    if (name.length <= max && !nameProblem(name)) return name;
  }
  return kind === "username" ? "BrightVolt7" : "Bright Volt 7";
}

/**
 * Up to `count` suggestions: for a name that was only taken or held, the name with a number first ("Ali_27"), then
 * energy-word names. `free` (usernames) drops any the database says can't be had; it may be async.
 */
export async function suggestNames(
  kind: "username" | "guest",
  options: { base?: string | undefined; count?: number; rand?: Rand; free?: ((name: string) => boolean | Promise<boolean>) | undefined } = {},
): Promise<string[]> {
  const { base, count = 3, rand = cryptoRand, free } = options;
  const out: string[] = [];
  const candidates: string[] = [];
  if (base && kind === "username" && USERNAME_RE.test(base) && !nameProblem(base)) {
    const stem = base.slice(0, USERNAME_MAX - 3);
    candidates.push(`${stem}_${10 + rand(90)}`, `${stem}${10 + rand(90)}`);
  }
  for (let i = 0; i < 12; i++) candidates.push(energyName(kind, rand));
  for (const name of candidates) {
    if (out.length >= count) break;
    if (out.some((n) => usernameKey(n) === usernameKey(name))) continue;
    if (nameProblem(name)) continue;
    if (free && !(await free(name))) continue;
    out.push(name);
  }
  return out;
}

/* ------------------------------------------------------------------ the two checks */

export type CheckedUsername = { ok: true; username: string; key: string } | { ok: false; reason: RefusalReason; message: string };

/** A username's own rules (shape, filter, reserved); availability is the database's (account.server.ts). */
export function checkUsernameRules(raw: unknown): CheckedUsername {
  const shape = usernameShapeProblem(raw);
  if (shape) return { ok: false, reason: shape, message: NAME_MESSAGES[shape] };
  const username = String(raw).trim();
  const problem = nameProblem(username);
  if (problem) return { ok: false, reason: problem, message: NAME_MESSAGES[problem] };
  return { ok: true, username, key: usernameKey(username) };
}

export type CheckedGuestName = { ok: true; name: string } | { ok: false; reason: RefusalReason; message: string };

/**
 * A guest's room name: cleaned (control, bidi and zero-width characters dropped, whitespace collapsed), cut to 16
 * code points, then the same filter, reserved and look-alike checks. Empty is allowed here (rooms name it "Player").
 */
export function checkGuestName(raw: unknown): CheckedGuestName {
  const name = cutCodePoints(cleanDisplayText(raw), GUEST_NAME_MAX);
  const problem = name ? nameProblem(name) : null;
  if (problem) return { ok: false, reason: problem, message: NAME_MESSAGES[problem] };
  return { ok: true, name };
}

/** A refusal with its three suggestions. */
export async function refusalWithSuggestions(
  kind: "username" | "guest",
  reason: RefusalReason,
  options: { base?: string; rand?: Rand; free?: (name: string) => boolean | Promise<boolean> } = {},
): Promise<NameRefusalInfo> {
  const base = reason === "taken" || reason === "held" ? options.base : undefined;
  return {
    reason,
    message: NAME_MESSAGES[reason],
    suggestions: await suggestNames(kind, { ...options, base, count: 3 }),
  };
}

/** A refused room name, thrown by room create and join: the plain reason, with the suggestions on it and in the text. */
export class NameRefusedError extends Error {
  readonly suggestions: string[];
  readonly reason: RefusalReason;
  constructor(info: NameRefusalInfo) {
    super(
      info.suggestions.length
        ? `${info.message} Try ${info.suggestions.slice(0, -1).join(", ")} or ${info.suggestions[info.suggestions.length - 1]}.`
        : info.message,
    );
    this.suggestions = info.suggestions;
    this.reason = info.reason;
  }
}
