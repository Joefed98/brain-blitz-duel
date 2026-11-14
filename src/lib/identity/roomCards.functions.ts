/**
 * A room's player cards (13 Nov 2026, one identity everywhere): roomCardsFn({ roomId }) answers every seat's card in
 * one call (roomCards.server.ts), for a caller seated in that room only. The phone asks once per room and again when
 * someone joins (useRoomCards); never one call per player. Display only: nothing here is read by a sim, a grader, a
 * deal, a ranking or a timer.
 */
import { record, text } from "@/lib/validate";
import { ID_MAX } from "@/lib/duel/inputLimits";
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isUuid } from "@/lib/duel/dbError";

import { NO_ROOM_CARDS, type RoomCardsAnswer } from "./roomCards";

export const roomCardsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => ({ roomId: text(record(input)["roomId"], ID_MAX, "roomId") }))
  .handler(async ({ data, context }): Promise<RoomCardsAnswer> => {
    if (!isUuid(data.roomId)) return NO_ROOM_CARDS;
    const { adminDb } = await import("@/lib/data/db.server");
    const client = await adminDb();
    const { PUBLIC_CARD_LIMIT, withinRateLimit } = await import("@/lib/duel/rateLimit.server");
    if (!(await withinRateLimit(client, context.userId, PUBLIC_CARD_LIMIT))) return NO_ROOM_CARDS;
    const { roomCardsFor } = await import("./roomCards.server");
    try {
      return (await roomCardsFor(client, data.roomId, context.userId, Date.now())) ?? NO_ROOM_CARDS;
    } catch {
      return NO_ROOM_CARDS;
    }
  });
