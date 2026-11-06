/**
 * Leaderboard names (21 Oct 2026, the daily challenge): a name is shown exactly as the player set
 * it, so an offensive one is refused (with a friendly message) rather than masked. Server-only, on
 * the same list room chat masks (profanity.server.ts), with leet-speak folded back to letters.
 *
 * Two tests, so ordinary names are never caught by a short word inside them ("Cassie", "Dickens",
 * "Scunthorpe", "Hancock"): every word of the name (split at spaces, digits, punctuation and
 * lower-to-upper case changes) against the whole list, and the whole name run together against
 * the few stems no ordinary name contains.
 */
import { PROFANITY_WORDS } from "./profanity.server";

/** Stems refused anywhere in a name. */
const ANYWHERE = [
  "fuck",
  "cunt",
  "nigger",
  "nigga",
  "faggot",
  "wanker",
  "whore",
  "motherf",
  "bitch",
  "retard",
  "asshole",
  "arsehole",
  "dickhead",
  "shithead",
  "twat",
  "slut",
  "spastic",
];

function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/[@4]/g, "a")
    .replace(/[0]/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[5$]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/[^a-z]/g, "");
}

const WORDS = new Set(PROFANITY_WORDS.map(fold));

/** Place names and words that hold a stem by accident (the Scunthorpe problem). */
const HARMLESS = ["scunthorpe", "penistone", "shitake", "cockburn"];

/** The words of a name: split at anything but letters (leet digits kept inside words) and at case changes. */
function wordsOf(name: string): string[] {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9@$!|]+/)
    .map(fold)
    .filter(Boolean);
}

export const NAME_REFUSED_MESSAGE =
  "That name can’t go on the leaderboards. Please pick another one.";

/** True when a leaderboard name is refused. */
export function offensiveName(name: string): boolean {
  // A "*" standing for a letter ("f*ck"): each vowel in its place.
  const spellings = name.includes("*")
    ? ["a", "e", "i", "o", "u"].map((v) => name.replaceAll("*", v))
    : [name];
  return spellings.some((spelling) => {
    if (wordsOf(spelling).some((word) => WORDS.has(word))) return true;
    let joined = fold(spelling);
    for (const word of HARMLESS) joined = joined.replaceAll(word, "");
    // Repeated letters folded too ("fuuuck").
    const squeezed = joined.replace(/(.)\1+/g, "$1");
    return ANYWHERE.some(
      (stem) => joined.includes(stem) || squeezed.includes(stem.replace(/(.)\1+/g, "$1")),
    );
  });
}
