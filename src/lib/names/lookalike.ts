/**
 * Look-alike folding for the name checks (10 Nov 2026, accounts). Takes a name already folded by `foldForCheck`
 * (accents dropped, Cyrillic / Greek look-alikes turned Latin) and gives the lower-case letter forms the word filter
 * and the reserved list are checked against: digits and symbols read as the letters they pass for (0→o, 1→i and
 * 1→l, 3→e, 4→a, 5→s, 7→t, @→a, $→s, !→i, |→i), everything else dropped, each form also with repeated letters
 * squeezed to one ("Jooouulz" → "joulz"). Never stored, never shown.
 */

const COMMON: Record<string, string> = { "0": "o", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i", "|": "i" };

/** Repeated letters squeezed to one. */
export function squeeze(letters: string): string {
  return letters.replace(/(.)\1+/g, "$1");
}

/** The plain letter forms (no squeezing): "1" read as i, and again as l when the name has a 1. */
export function letterForms(folded: string): string[] {
  const base = Array.from(folded.toLowerCase())
    .map((ch) => COMMON[ch] ?? ch)
    .join("");
  const forms = new Set<string>();
  for (const one of base.includes("1") ? ["i", "l"] : ["i"]) forms.add(base.replaceAll("1", one).replace(/[^a-z]/g, ""));
  return [...forms].filter(Boolean);
}

/** Every form the checks read: the plain forms and their squeezed versions. */
export function lookalikeForms(folded: string): string[] {
  const out = new Set<string>();
  for (const form of letterForms(folded)) {
    out.add(form);
    out.add(squeeze(form));
  }
  return [...out];
}

/** True when the plain letters hold a run of three or more of one letter ("Admiiin"). */
export function hasLongRun(letters: string): boolean {
  return /(.)\1\1/.test(letters);
}
