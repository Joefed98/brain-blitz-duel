/**
 * Letterfall's dictionary: one exact word list (the SCOWL British list behind
 * dictionary.server.ts, packed by scripts/wordfall-dict.ts) and one pure test,
 * `isWordfallWord`, shared by the phone's sim and the server's replay so a
 * word's verdict is a function of the string alone and replays identically.
 *
 * The packed list is generated three ways from one source (scripts/wordfall-dict.ts):
 * wordfallWords.data.ts for the server, which installs it synchronously
 * (wordfallDict.server.ts); public/wordfall/words-<hash>.txt for the phone,
 * which fetches it (never in the main bundle; a plain fetch, so a failed
 * download can be retried, which a failed dynamic import cannot) as soon as
 * a room's round order or the practice list includes Letterfall; and
 * wordfallWords.meta.ts (count, hash, URL), the phone's cache key. The phone
 * keeps the packed text in IndexedDB by version, so later plays install it
 * without a download.
 * Asking for a verdict before the list is installed throws, so a run can never
 * be scored against a missing dictionary.
 */

import { WORDFALL_META } from "./wordfallWords.meta";

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

const CACHE_DB = "duelz-wordfall";
const CACHE_STORE = "words";
const CACHE_ITEM = "packed";
const CACHE_VERSION = `${WORDFALL_META.hash}:${WORDFALL_META.count}`;

function openCache(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const request = indexedDB.open(CACHE_DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(CACHE_STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** The cached packed list for this version, or null (any cache fault reads as a miss). */
async function readCache(): Promise<string | null> {
  const db = await openCache();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const request = db.transaction(CACHE_STORE, "readonly").objectStore(CACHE_STORE).get(CACHE_ITEM);
      request.onsuccess = () => {
        const value = request.result as { version?: string; packed?: string } | undefined;
        resolve(value?.version === CACHE_VERSION && typeof value.packed === "string" ? value.packed : null);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Stores the packed list, replacing any older version; failures are ignored. */
async function writeCache(packed: string): Promise<void> {
  const db = await openCache();
  if (!db) return;
  try {
    db.transaction(CACHE_STORE, "readwrite").objectStore(CACHE_STORE).put({ version: CACHE_VERSION, packed }, CACHE_ITEM);
  } catch {
    // A full or private-mode store only costs the next download.
  }
}

/**
 * Loads the list on the phone: from the IndexedDB cache when this version is
 * there, else one fetch of this version's text file, then cached. Either copy
 * must decode to the stated word count. Shared by every caller; a failure
 * clears the pending load so the next call retries.
 */
export function loadWordfallDict(): Promise<void> {
  if (words) return Promise.resolve();
  loading ??= (async () => {
    const cached = await readCache();
    if (cached && !words) {
      const decoded = decodeWordfallWords(cached);
      if (decoded.size === WORDFALL_META.count) {
        words = decoded;
        return;
      }
    }
    const response = await fetch(WORDFALL_META.url);
    if (!response.ok) throw new Error(`Letterfall words: HTTP ${response.status}`);
    const packed = await response.text();
    const decoded = decodeWordfallWords(packed);
    if (decoded.size !== WORDFALL_META.count) throw new Error("Letterfall words: incomplete download");
    if (!words) words = decoded;
    void writeCache(packed);
  })().catch((error: unknown) => {
    loading = null;
    throw error;
  });
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
