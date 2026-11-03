/**
 * The room's moment voice lines (3 Nov 2026; files in public/sounds, list in
 * docs/sound-cues/voice-lines-nov-2026.csv). Presentation only: each rule reads what the screen
 * already shows (stored scores and standings), never an answer. Every line goes through
 * `queueVoice` (src/lib/sound.ts), so it never talks over another voice line, and the screens
 * call each one once (their own `cued` refs).
 *
 * - `voice.newBest`: practice's reveal, when this run beat an earlier best (the "New best!" moment), or a room's
 *   arcade reveal beating this device's best for the game (ArcadeReveal, arcadeBest.ts).
 * - `voice.photoFinish`: the room's final results (podium or two-player final), when the top two totals are 1–5
 *   apart (only there, so it stays special; Joe's decision).
 * - `voice.newLeader`: a room's standings, when first place is held by someone new after a round.
 * - `voice.cleanSweep`: the room's end, when one player had the round's sole top score every round.
 * - `voice.draw`: the room's end, when first place is shared (in place of `voice.tie` there).
 */

/** The top two scores are this close (and not level) for a photo finish. */
export const PHOTO_FINISH_POINTS = 5;

/** A photo finish: the two best scores differ by 1–5 points (level is a tie, not a photo finish). */
export function isPhotoFinish(scores: readonly number[]): boolean {
  if (scores.length < 2) return false;
  const sorted = [...scores].sort((x, y) => y - x);
  const a = sorted[0] ?? 0;
  const b = sorted[1] ?? 0;
  return a > 0 && a !== b && a - b <= PHOTO_FINISH_POINTS;
}

/**
 * A new leader: after round 2 or later, the players in first place now are not the ones who were
 * first before, and first place is not shared (a shared lead is no new leader).
 */
export function isNewLeader(rows: readonly { slot: number; position: number; previousPosition: number | null }[]): boolean {
  if (rows.length < 2) return false;
  const now = rows.filter((r) => r.position === 1).map((r) => r.slot);
  if (now.length !== 1) return false;
  if (rows.some((r) => r.previousPosition === null)) return false;
  const before = rows.filter((r) => r.previousPosition === 1).map((r) => r.slot);
  return before.length > 0 && !before.includes(now[0] ?? -1);
}

/**
 * A clean sweep: the room had two or more rounds and one player had the round's sole top score
 * (above 0) in every one of them. Returns that player's slot, or null.
 */
export function cleanSweepSlot(results: readonly { player_slot: number; round_number: number; score: number }[], rounds: number): number | null {
  if (rounds < 2) return null;
  let sweeper: number | null = null;
  for (let round = 1; round <= rounds; round++) {
    const rows = results.filter((r) => r.round_number === round);
    if (rows.length < 2) return null;
    const top = Math.max(...rows.map((r) => r.score));
    const winners = rows.filter((r) => r.score === top);
    const winner = winners[0];
    if (top <= 0 || winners.length !== 1 || !winner) return null;
    if (sweeper === null) sweeper = winner.player_slot;
    else if (sweeper !== winner.player_slot) return null;
  }
  return sweeper;
}
