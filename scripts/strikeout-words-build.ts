/**
 * Builds src/lib/duel/strikeoutWords.server.ts: Strikeout's eight-letter answer
 * list (strikeoutRev 2). The shared common-word list (commonWords.server.ts,
 * scripts/common-words-build.ts) stops at seven letters, so answerWords(8) is
 * empty; this file applies exactly the same rules to eight-letter words, kept
 * separate so Cryptogrid, Swapword and the Letterfall audit vocabulary are
 * untouched:
 *   - SCOWL 2020.12.07 english + british word lists, sizes 10, 20 and 35 only;
 *   - lowercase a–z, exactly 8 letters (no proper nouns, abbreviations or apostrophes);
 *   - in the app dictionary and not blocked (isWord);
 *   - not a plural or -s verb form (Wordsmith's isPluralForm rule);
 *   - among the 20,000 most frequent words of scripts/data/word-frequency.txt.
 *
 *   curl -L -o scowl.tar.gz https://downloads.sourceforge.net/wordlist/scowl-2020.12.07.tar.gz
 *   tar xzf scowl.tar.gz
 *   bun scripts/strikeout-words-build.ts scowl-2020.12.07/final
 *   bun scripts/strikeout-words-build.ts scowl-2020.12.07/final --check   (no write; compares)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { isWord } from "../src/lib/duel/dictionary.server";
import { isPluralForm } from "../src/lib/duel/wordsmith.server";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: bun scripts/strikeout-words-build.ts <scowl>/final [--check]");
  process.exit(1);
}
const OUT = "src/lib/duel/strikeoutWords.server.ts";
const frequent = new Set(
  readFileSync(new URL("./data/word-frequency.txt", import.meta.url), "utf8")
    .split(/\r?\n/)
    .map((w) => w.trim().toLowerCase()),
);
const words = new Set<string>();
for (const list of ["english-words", "british-words"]) {
  for (const size of [10, 20, 35]) {
    const raw = readFileSync(join(dir, `${list}.${size}`), "latin1");
    for (const line of raw.split(/\r?\n/)) {
      const word = line.trim();
      if (!/^[a-z]{8}$/.test(word)) continue;
      if (!frequent.has(word) || !isWord(word) || isPluralForm(word)) continue;
      words.add(word);
    }
  }
}
const sorted = [...words].sort();
const lines: string[] = [];
for (let i = 0; i < sorted.length; i += 12) lines.push(sorted.slice(i, i + 12).join(" "));
const text = `/**
 * Server-only eight-letter answer list for Strikeout (strikeoutRev 2), built by
 * scripts/strikeout-words-build.ts with the common-word rules (SCOWL 2020.12.07
 * english + british sizes 10, 20 and 35, in the app dictionary, never a plural
 * or -s verb form, among the 20,000 most frequent words of
 * scripts/data/word-frequency.txt). Never import from client code.
 */

/** ${sorted.length} words, alphabetical. */
export const STRIKEOUT_WORDS_8_RAW = \`
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
  console.log(`wrote ${OUT}: ${sorted.length} words`);
}
