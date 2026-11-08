import { VERDICT_LABEL, VERDICT_SPOKEN, type RoundVerdict } from "@/lib/duel/resultPresentation";

/**
 * A round verdict as shown ("✓ Correct", "Partly solved", "Scored", "✗") with words a screen reader can say
 * (7 Nov 2026, accessibility audit #7): the bare "✗" read as "multiplication x" or was skipped. The glyphs are
 * hidden from assistive tech and the spoken words (VERDICT_SPOKEN) are visually hidden; what is seen is unchanged.
 * `missed`: an async round that was never played (shown "✗", said "Missed").
 */
export function VerdictLabel({ verdict, missed = false }: { verdict: RoundVerdict; missed?: boolean }) {
  return (
    <>
      <span aria-hidden="true">{missed ? "✗" : VERDICT_LABEL[verdict]}</span>
      <span className="sr-only">{missed ? "Missed" : VERDICT_SPOKEN[verdict]}</span>
    </>
  );
}
