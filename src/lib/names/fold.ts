/**
 * Name folding (moved here from displayName.server.ts on 10 Nov 2026 so the shared names module can use it; the
 * behaviour is unchanged). Dependency-free: the phone may import it.
 */

/** Characters no name or chat message keeps. */
const STRIP = /[\p{Cc}\p{Cf}\p{Cs}\u2028\u2029]/gu;

/** NFKC, invisible and control characters dropped, whitespace collapsed and trimmed. */
export function cleanDisplayText(raw: unknown): string {
  if (typeof raw !== "string" && typeof raw !== "number") return "";
  return String(raw).normalize("NFKC").replace(/\s+/g, " ").replace(STRIP, "").replace(/ {2,}/g, " ").trim();
}

/** The first `max` code points of a cleaned text, trimmed again. */
export function cutCodePoints(text: string, max: number): string {
  return Array.from(text).slice(0, Math.max(0, max)).join("").trim();
}

/** Look-alike letters (Cyrillic, Greek) mapped to the Latin letter they pass for, for the checks only. */
const LOOKALIKES: Record<string, string> = {
  а: "a", в: "b", е: "e", ё: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", у: "y", х: "x",
  і: "i", ї: "i", ј: "j", ѕ: "s", ԁ: "d", ӏ: "l", ɡ: "g", ь: "b", п: "n", г: "r", ц: "u", ш: "w", щ: "w",
  α: "a", β: "b", γ: "y", ε: "e", η: "n", ι: "i", κ: "k", ν: "v", ο: "o", ρ: "p", τ: "t", υ: "u", χ: "x",
  ω: "w", μ: "u", σ: "o", ς: "c", λ: "l",
};

/** The name as the filters read it: accents dropped and look-alike letters turned Latin (never stored). */
export function foldForCheck(name: string): string {
  return Array.from(cleanDisplayText(name).normalize("NFKD").replace(/\p{M}/gu, ""))
    .map((ch) => {
      const lower = ch.toLowerCase();
      const latin = LOOKALIKES[lower];
      if (!latin) return ch;
      return ch === lower ? latin : latin.toUpperCase();
    })
    .join("");
}
