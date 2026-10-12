/** Shared helpers for the Letterfall dictionary build and its check. */
export const WORDFALL_DATA_PATH = new URL("../src/lib/arcade/wordfallWords.data.ts", import.meta.url).pathname;

/** Sorted words to the front-coded string the phone decodes. */
export function encodeWordfallWords(words: readonly string[]): string {
  let prev = "";
  let out = "";
  for (const word of words) {
    let shared = 0;
    while (shared < prev.length && shared < word.length && shared < 11 && prev[shared] === word[shared]) shared++;
    out += String.fromCharCode(48 + shared) + word.slice(shared);
    prev = word;
  }
  return out;
}

/** FNV-1a over the words joined by newlines, as an unsigned 32-bit integer. */
export function wordfallWordsHash(words: readonly string[]): number {
  let hash = 0x811c9dc5;
  const text = words.join("\n");
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}
