/**
 * Builds src/lib/duel/commonWords.server.ts: the answer list for Strikeout,
 * Cryptogrid and Swapword. Only puzzle ANSWERS come from it; typed words are
 * still checked against the full dictionary (dictionary.server.ts isWord).
 *
 * Source: SCOWL 2020.12.07 (the release the full list is built from), the
 * "common" size lists 10, 20 and 35 of the english and british word lists.
 * Kept only when the word is:
 *   - lowercase a–z, 3–7 letters (no proper nouns, abbreviations or apostrophes);
 *   - in the app dictionary and not blocked (isWord);
 *   - not a plural or -s verb form (Wordsmith's isPluralForm rule);
 *   - among the 20,000 most frequent words of scripts/data/word-frequency.txt
 *     (the ranking Roundabout's bank uses), which drops rare inflections such
 *     as EKING, VISED or SAGER that SCOWL's size-35 list still carries;
 *   - not informal spelling (INFORMAL below: GONNA, DUNNO…).
 *
 *   curl -L -o scowl.tar.gz https://downloads.sourceforge.net/wordlist/scowl-2020.12.07.tar.gz
 *   tar xzf scowl.tar.gz
 *   bun scripts/common-words-build.ts scowl-2020.12.07/final
 *   bun scripts/common-words-build.ts scowl-2020.12.07/final --check   (no write; compares)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { isWord } from "../src/lib/duel/dictionary.server";
import { isPluralForm } from "../src/lib/duel/wordsmith.server";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: bun scripts/common-words-build.ts <scowl>/final [--check]");
  process.exit(1);
}
const OUT = "src/lib/duel/commonWords.server.ts";
const frequent = new Set(
  readFileSync(new URL("./data/word-frequency.txt", import.meta.url), "utf8")
    .split(/\r?\n/)
    .map((w) => w.trim().toLowerCase()),
);
/** Informal spellings and interjections the size-35 list carries; never an answer. */
const INFORMAL = new Set(["gonna", "wanna", "gotta", "dunno", "kinda", "sorta", "lemme", "gimme", "yeah", "yep", "nope", "huh", "hmm", "ugh", "aha", "duh", "ooh", "wow", "okay"]);
const words = new Set<string>();
for (const list of ["english-words", "british-words"]) {
  for (const size of [10, 20, 35]) {
    const raw = readFileSync(join(dir, `${list}.${size}`), "latin1");
    for (const line of raw.split(/\r?\n/)) {
      const word = line.trim();
      if (!/^[a-z]{3,7}$/.test(word)) continue;
      if (INFORMAL.has(word) || !frequent.has(word) || !isWord(word) || isPluralForm(word)) continue;
      words.add(word);
    }
  }
}
const sorted = [...words].sort((a, b) => a.length - b.length || (a < b ? -1 : 1));
const lines: string[] = [];
for (let i = 0; i < sorted.length; i += 16) lines.push(sorted.slice(i, i + 16).join(" "));
const text = `/**
 * Server-only common-word answer list (built by scripts/common-words-build.ts):
 * SCOWL 2020.12.07 english + british word lists, sizes 10, 20 and 35 only,
 * lowercase a–z, 3–7 letters, in the app dictionary (blocklist applied), never
 * a plural or -s verb form, and among the 20,000 most frequent words of
 * scripts/data/word-frequency.txt. Puzzle answers come only from here; words a
 * player types are checked against the full dictionary. Never import from
 * client code.
 */

/** ${sorted.length} words, sorted by length then alphabetically. */
export const COMMON_WORDS_RAW = \`
${lines.join("\n")}
\`;
`;
if (process.argv.includes("--check")) {
  const current = readFileSync(OUT, "utf8");
  if (current !== text) {
    console.log(`FAIL: ${OUT} differs from a rebuild`);
    process.exit(1);
  }
  console.log(`PASS: ${OUT} rebuilds byte-for-byte (${sorted.length} words)`);
} else {
  writeFileSync(OUT, text);
  const byLength = new Map<number, number>();
  for (const w of sorted) byLength.set(w.length, (byLength.get(w.length) ?? 0) + 1);
  console.log(`wrote ${OUT}: ${sorted.length} words`, Object.fromEntries(byLength));
}
