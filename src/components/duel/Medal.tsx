/**
 * A leaderboard place (polish-layout/theme.css): gold, silver and bronze discs for the top three,
 * the plain number in the same disc's space below them.
 */
export function Medal({ place }: { place: number }) {
  return (
    <span data-medal={place <= 3 ? place : undefined} className="th-medal tabular-nums">
      {place}
    </span>
  );
}
