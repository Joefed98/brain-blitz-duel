/**
 * Server-only British English dictionary (SCOWL size 70, British spellings),
 * shared by every word game: Wordsmith, Word Hunt, Word Ladder, Tile Grid and
 * Word Slide. Loaded once per worker and cached in memory.
 * The word data never leaves the server: only the letters of a board and the
 * verdict on a submitted word ever reach a device.
 */

import { PROFANITY_WORDS } from "./profanity.server";
import { SCOWL_COMMON_COUNT, SCOWL_WORDS_RAW } from "./wordlist.server";

/** Never accepted, whatever the dictionary says. */
const BLOCKED = new Set([
  "anal",
  "arse",
  "arses",
  "bastard",
  "bitch",
  "bitches",
  "bollock",
  "bollocks",
  "boner",
  "cock",
  "cocks",
  "coon",
  "coons",
  "crap",
  "cunt",
  "cunts",
  "dago",
  "dagos",
  "damn",
  "dick",
  "dicks",
  "dyke",
  "dykes",
  "fag",
  "fags",
  "faggot",
  "fuck",
  "fucks",
  "fucked",
  "fucker",
  "gook",
  "gooks",
  "jism",
  "jizz",
  "kike",
  "kikes",
  "kraut",
  "krauts",
  "nazi",
  "nazis",
  "negro",
  "negroes",
  "nigga",
  "niggas",
  "nigger",
  "niggers",
  "paki",
  "pakis",
  "penis",
  "piss",
  "pissed",
  "prick",
  "pricks",
  "pussy",
  "queer",
  "queers",
  "rape",
  "raped",
  "rapes",
  "rapist",
  "retard",
  "semen",
  "shag",
  "shit",
  "shits",
  "shite",
  "slut",
  "sluts",
  "spastic",
  "spic",
  "spics",
  "tits",
  "titty",
  "turd",
  "twat",
  "twats",
  "vagina",
  "wank",
  "whore",
  "whores",
  "wog",
  "wogs",
  "wop",
  "wops",
  ...PROFANITY_WORDS,
]);

interface Dictionary {
  all: Set<string>;
  common: string[];
}

let cached: Dictionary | null = null;

function dictionary(): Dictionary {
  if (cached) return cached;
  const list = SCOWL_WORDS_RAW.split(/\s+/).filter((word) => /^[a-z]{3,12}$/.test(word));
  const clean = list.map((word, index) => ({ word, index })).filter(({ word }) => !BLOCKED.has(word));
  const all = new Set(clean.map((entry) => entry.word));
  const common = clean.filter((entry) => entry.index < SCOWL_COMMON_COUNT).map((entry) => entry.word);
  cached = { all, common };
  return cached;
}

/** True when the word is an ordinary English word and not on the blocklist. */
export function isWord(word: string): boolean {
  const clean = word.trim().toLowerCase();
  if (!/^[a-z]+$/.test(clean) || BLOCKED.has(clean)) return false;
  return dictionary().all.has(clean);
}

function fits(word: string, pool: Map<string, number>): boolean {
  const used = new Map<string, number>();
  for (const letter of word) {
    const next = (used.get(letter) ?? 0) + 1;
    if (next > (pool.get(letter) ?? 0)) return false;
    used.set(letter, next);
  }
  return true;
}

/** Every everyday word that can be built from the given multiset of letters. */
export function wordsFrom(letters: string, minLength = 4): string[] {
  const pool = new Map<string, number>();
  for (const letter of letters.toLowerCase()) {
    if (!/^[a-z]$/.test(letter)) continue;
    pool.set(letter, (pool.get(letter) ?? 0) + 1);
  }
  return dictionary().common.filter(
    (word) => word.length >= minLength && word.length <= letters.length && fits(word, pool),
  );
}

/** Can this word be spelled from the board's tiles, each tile used once? */
export function buildableFrom(word: string, letters: string[]): boolean {
  const pool = new Map<string, number>();
  for (const letter of letters) {
    const key = letter.toLowerCase();
    pool.set(key, (pool.get(key) ?? 0) + 1);
  }
  return fits(word.toLowerCase(), pool);
}

/** The everyday word list used when solving a board. */
export function commonWords(): string[] {
  return dictionary().common;
}

let prefixes: Set<string> | null = null;

/** Prefix set of the everyday list, so a grid search can stop early. */
export function isCommonPrefix(prefix: string): boolean {
  if (!prefixes) {
    const set = new Set<string>();
    for (const word of dictionary().common) {
      for (let i = 1; i <= word.length; i++) set.add(word.slice(0, i));
    }
    prefixes = set;
  }
  return prefixes.has(prefix);
}
