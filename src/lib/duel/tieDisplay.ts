/**
 * How ties are shown (Polish batch R, 25 Oct 2026, display only; docs/polish-batches/room-screens.md).
 *
 * The ranking never changes here. Rooms already break a tie on points by the time used
 * (scoring.ts `rank`: the quicker combined answer time, tieBreak.ts), and players still level on both
 * share a position. So a row level on points with someone:
 *  - who is placed apart by time says so: "Level on 230 · ahead on time" (the quicker) or
 *    "· behind on time";
 *  - who shares the place (level on points and time) shows "=1", the same medal and "Level on 230".
 * A row on its own points has no note. Level on 0 shares the place but gets no note (an unplayed start
 * is not news).
 */
export interface TieMark {
  /** "1", or "=1" for a shared place. */
  label: string;
  shared: boolean;
  note: string | null;
}

export interface Placed {
  slot: number;
  points: number;
  position: number;
}

export function tieMarks(rows: readonly Placed[]): Map<number, TieMark> {
  const out = new Map<number, TieMark>();
  for (const row of rows) {
    const level = rows.filter((other) => other.points === row.points);
    const shared = rows.filter((other) => other.position === row.position).length > 1;
    let note: string | null = null;
    if (level.length > 1 && row.points !== 0) {
      const best = Math.min(...level.map((other) => other.position));
      const split = level.some((other) => other.position !== row.position);
      note = `Level on ${row.points}${split ? (row.position === best ? ", ahead on time" : ", behind on time") : ""}`;
    }
    out.set(row.slot, { label: `${shared ? "=" : ""}${row.position}`, shared, note });
  }
  return out;
}

/**
 * A round's places (the round results screen): its order is the round score, then the time used
 * (resultPresentation.ts roundResultOrder); players level on both share the place.
 */
export function roundPlaces(
  rows: readonly { slot: number; roundScore: number }[],
  times: ReadonlyMap<number, number | null>,
): Placed[] {
  const time = (slot: number) => times.get(slot) ?? Number.POSITIVE_INFINITY;
  return rows.map((row) => ({
    slot: row.slot,
    points: row.roundScore,
    position:
      1 +
      rows.filter(
        (other) =>
          other.roundScore > row.roundScore ||
          (other.roundScore === row.roundScore && time(other.slot) < time(row.slot)),
      ).length,
  }));
}
