import { ukDay, ukTime, type PublicGame } from "@/lib/publicSchedule";

/** "NEXT PUBLIC GAME: SAT 24 OCT 7:00 PM" (UK time, as the Tournaments card shows it). */
export function nextPublicLabel(game: PublicGame, now: number): string {
  return `Next public game: ${ukDay(game.startsAt, now)} ${ukTime(game.startsAt)}`.toUpperCase();
}
