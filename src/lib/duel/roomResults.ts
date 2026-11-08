/**
 * What the room screens fetch from round_results (8 Nov 2026, item 4 of docs/audit-nov-2026/performance.md;
 * network only, nothing stored, graded or scored changes).
 *
 * The results refetch (every phase change, every result event, every reconnect) used to `select("*")`, so it
 * carried every player's stored answer: an arcade run's whole input log, tens of kilobytes a row, for every
 * round so far. The room screens read only scores, verdicts, times and `extra` (the stored breakdown, reveal
 * lines and near-miss figures) for other players, and only their own answer (the answer reveal's own board):
 * a replay fetches the one log it plays through its own server call (replay.functions.ts) when it is shown.
 * So the refetch now names its columns, leaving `answer` out, and this device's own answer is fetched once a
 * row (it never changes once stored) by row id.
 */
import type { RoundResultRow } from "./types";

/** Every round_results column the room screens read, `answer` apart (and `input_type`, beta recording only). */
export const ROOM_RESULT_COLUMNS =
  "id, duel_id, player_slot, round_number, is_correct, ms_remaining, reaction_avg_ms, correct_count, errors, extra, score, submitted_at";

/** A row as the refetch returns it: no answer. */
export type RoomResultRow = Omit<RoundResultRow, "answer">;

/** This device's own answers by row id (a stored answer never changes; Play again's rows have new ids). */
export class OwnAnswers {
  private readonly answers = new Map<string, string | null>();
  constructor(private readonly cap = 400) {}

  /** Row ids of `slot`'s rows whose answer isn't held yet. */
  missing(rows: readonly RoomResultRow[], slot: number | null): string[] {
    if (slot === null) return [];
    return rows.filter((r) => r.player_slot === slot && !this.answers.has(r.id)).map((r) => r.id);
  }

  remember(fetched: readonly { id: string; answer: string | null }[]): void {
    for (const row of fetched) this.answers.set(row.id, row.answer ?? null);
    while (this.answers.size > this.cap) this.answers.delete(this.answers.keys().next().value as string);
  }

  /** The rows as RoundResultRow: `slot`'s own answers filled in where held, everyone else's null. */
  attach(rows: readonly RoomResultRow[], slot: number | null): RoundResultRow[] {
    return rows.map((r) => ({ ...r, answer: slot !== null && r.player_slot === slot ? (this.answers.get(r.id) ?? null) : null }));
  }
}
