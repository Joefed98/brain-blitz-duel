/**
 * Server-only word filter for room chat. Matched words are replaced with
 * stars rather than rejecting the message, so a slip never loses the message.
 */

export const PROFANITY_WORDS = [
  "arse",
  "arsehole",
  "ass",
  "asshole",
  "bastard",
  "bitch",
  "bollocks",
  "bugger",
  "cock",
  "coon",
  "cunt",
  "dick",
  "dickhead",
  "dyke",
  "fag",
  "faggot",
  "fuck",
  "fucker",
  "fucking",
  "kike",
  "motherfucker",
  "nigger",
  "nigga",
  "paki",
  "piss",
  "prick",
  "pussy",
  "retard",
  "shit",
  "shite",
  "slag",
  "slut",
  "spastic",
  "tits",
  "twat",
  "wank",
  "wanker",
  "whore",
];

const MASK = "★★★";

/** Leet-speak folded back to letters so "f*ck" and "sh1t" still match. */
function normalise(word: string): string {
  return word
    .toLowerCase()
    .replace(/[@4]/g, "a")
    .replace(/[0]/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[5$]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/[^a-z]/g, "");
}

const BLOCKED_SET = new Set(PROFANITY_WORDS.map(normalise));

/** Replaces every blocked word with stars, keeping the rest of the text. */
export function censor(text: string): string {
  return text.replace(/[^\s]+/g, (token) => {
    const bare = normalise(token);
    if (!bare) return token;
    if (BLOCKED_SET.has(bare)) return MASK;
    return token;
  });
}
