/**
 * A room's player cards (13 Nov 2026, one identity everywhere): roomCardsFn({ roomId }) answers every seat's card in
 * one call (roomCards.server.ts), for a caller seated in that room only. The phone asks once per room and again when
 * someone joins (useRoomCards); never one call per player. Display only: nothing here is read by a sim, a grader, a
 * deal, a ranking or a timer.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isUuid } from "@/lib/duel/dbError";

import type { RoomCards } from "./roomCards";

export const roomCardsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => ({ roomId: String(input?.roomId ?? "") }))
  .handler(async ({ data, context }): Promise<RoomCards> => {
    if (!isUuid(data.roomId)) return {};
    const { adminDb } = await import("@/lib/data/db.server");
    const client = await adminDb();
    const { PUBLIC_CARD_LIMIT, withinRateLimit } = await import("@/lib/duel/rateLimit.server");
    if (!(await withinRateLimit(client, context.userId, PUBLIC_CARD_LIMIT))) return {};
    const { roomCardsFor } = await import("./roomCards.server");
    try {
      return (await roomCardsFor(client, data.roomId, context.userId, Date.now())) ?? {};
    } catch {
      return {};
    }
  });
