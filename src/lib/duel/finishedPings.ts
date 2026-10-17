/**
 * Live "finished" pings (17 Oct 2026, presentation only): during a room round, a small strip says
 * which other players have finished ("Sam finished ✓"), from duel_players.submitted_round, which the
 * server writes after storing a player's answer (finishedPing.server.ts). A ping carries a slot and
 * a name and nothing else: never a score, answer, verdict or time. Rooms only; practice and replays
 * never show one. Before the 20261017140000 migration no row has the field and nobody pings.
 *
 * scripts/finished-pings-check.ts proves pings appear only for players whose answer is stored, carry
 * no result data, and combine when several land together.
 */
import type { DuelPlayerRow } from "./types";

/** Everything a ping holds. */
export interface FinishedPing {
  slot: number;
  name: string;
}

/** How long a ping stays up after the last player joined it, ms. */
export const PING_SHOW_MS = 3200;
/** Names a combined ping spells out; beyond this it says "and N others". */
export const PING_MAX_NAMES = 3;

type PingRow = Pick<DuelPlayerRow, "player_slot" | "display_name" | "status"> & { submitted_round?: number | null };

/**
 * The other players whose answer for `round` is stored, in slot order. Players who left are left
 * out; rows without the field (before the migration) never count.
 */
export function finishedThisRound(players: readonly PingRow[], round: number, mySlot: number): FinishedPing[] {
  if (!(round >= 1)) return [];
  return players
    .filter((p) => p.player_slot !== mySlot && p.status !== "left" && p.submitted_round === round)
    .sort((a, b) => a.player_slot - b.player_slot)
    .map((p) => ({ slot: p.player_slot, name: p.display_name }));
}

/** "Sam finished", "Sam and Ali finished", "Sam, Ali and Jo finished", "Sam, Ali and 3 others finished". */
export function pingText(pings: readonly FinishedPing[]): string {
  const names = pings.map((p) => p.name.trim() || "Player");
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} finished`;
  if (names.length <= PING_MAX_NAMES)
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} finished`;
  const shown = names.slice(0, PING_MAX_NAMES - 1);
  const rest = names.length - shown.length;
  return `${shown.join(", ")} and ${rest} others finished`;
}

/**
 * One step of the strip: the finishers not yet announced this round. Players who finish while a ping
 * is still up join it, so several finishing together read as one ping ("Sam and Ali finished").
 */
export function newFinishers(finished: readonly FinishedPing[], announced: ReadonlySet<number>): FinishedPing[] {
  return finished.filter((p) => !announced.has(p.slot));
}
