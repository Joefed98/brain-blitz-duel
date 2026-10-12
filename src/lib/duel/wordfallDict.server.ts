/**
 * Server (and check) side of Letterfall's dictionary: installs the same packed
 * list the phone loads, synchronously, so the grading replay can use the same
 * pure `isWordfallWord` the phone's sim used.
 */
import { installWordfallDict } from "@/lib/arcade/wordfallDict";
import { WORDFALL_WORDS_FC } from "@/lib/arcade/wordfallWords.data";

installWordfallDict(WORDFALL_WORDS_FC);

/** Imported for its side effect; call to make the dependency explicit. */
export function ensureWordfallDict(): void {
  installWordfallDict(WORDFALL_WORDS_FC);
}
