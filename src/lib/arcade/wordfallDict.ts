/**
 * Letterfall's dictionary: one exact word list (the SCOWL British list behind
 * dictionary.server.ts, packed by scripts/wordfall-dict.ts) and one pure test,
 * `isWordfallWord`, shared by the phone's sim and the server's replay so a
 * word's verdict is a function of the string alone and replays identically.
 *
 * The packed list lives in wordfallWords.data.ts. The phone loads it with a
 * dynamic import only when Letterfall starts (its own chunk, never the main
 * bundle); the server installs it synchronously (wordfallDict.server.ts).
 * Asking for a verdict before the list is installed throws, so a run can never
 * be scored against a missing dictionary.
 */

let words: Set<string> | null = null;
let loading: Promise<void> | null = null;

/** Decodes the front-coded list ('0' + shared letters, then the rest of the word). */
export function decodeWordfallWords(packed: string): Set<string> {
  const out = new Set<string>();
  let prev = "";
  let i = 0;
  while (i < packed.length) {
    const shared = packed.charCodeAt(i) - 48;
    let j = i + 1;
    while (j < packed.length) {
      const code = packed.charCodeAt(j);
      if (code < 97 || code > 122) break;
      j++;
    }
    const word = prev.slice(0, shared) + packed.slice(i + 1, j);
    out.add(word);
    prev = word;
    i = j;
  }
  return out;
}

/** Installs the packed list (idempotent). */
export function installWordfallDict(packed: string): void {
  if (!words) words = decodeWordfallWords(packed);
}

export function wordfallDictReady(): boolean {
  return words !== null;
}

/** Loads the list on the phone: one dynamic import, shared by every caller. */
export function loadWordfallDict(): Promise<void> {
  if (words) return Promise.resolve();
  loading ??= import("./wordfallWords.data").then(
    (mod) => installWordfallDict(mod.WORDFALL_WORDS_FC),
    (error: unknown) => {
      // A failed download can be retried.
      loading = null;
      throw error;
    },
  );
  return loading;
}

/** How many words are installed (0 before loading). */
export function wordfallWordCount(): number {
  return words?.size ?? 0;
}

/** True when the lowercase string is a Letterfall word (3-12 letters, in the list). */
export function isWordfallWord(word: string): boolean {
  if (!words) throw new Error("Letterfall dictionary is not loaded");
  return word.length >= 3 && word.length <= 12 && words.has(word);
}
