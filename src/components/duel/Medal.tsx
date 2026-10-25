/**
 * A leaderboard place (polish-layout/theme.css): gold, silver and bronze discs for the top three,
 * the plain number in the same disc's space below them. A shared place (tieDisplay.ts) reads "=1"
 * on the same medal.
 */
export function Medal({ place, shared = false }: { place: number; shared?: boolean | undefined }) {
  return (
    <span
      data-medal={place <= 3 ? place : undefined}
      data-shared={shared ? "" : undefined}
      aria-label={shared ? `Joint ${place}` : undefined}
      className={`th-medal tabular-nums ${shared ? "text-[10px] tracking-[-0.04em]" : ""}`}
    >
      {shared ? `=${place}` : place}
    </span>
  );
}
