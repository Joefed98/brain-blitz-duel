import { ukDay, ukTime, type PublicGame } from "@/lib/publicSchedule";

/** "Next public game · Sat 24 Oct, 7:00 pm" (UK time, as the Tournaments card shows it; sentence case since F2). */
export function nextPublicLabel(game: PublicGame, now: number): string {
  return `Next public game · ${ukDay(game.startsAt, now)}, ${ukTime(game.startsAt)}`;
}
