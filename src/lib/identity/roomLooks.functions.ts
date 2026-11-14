/**
 * Other players' looks in a room (wave 2, E1; docs/skins.md "Replays and ghosts"; display only): Apex's ghost cars
 * draw each player's own car paint. Only a player in the room may ask, and each look is read from its owner's
 * loadout by the database (only owned items can be equipped). Nothing here is read by a sim, a grader or a deal.
 */
import { record, text } from "@/lib/validate";
import { ID_MAX, SHORT_MAX } from "@/lib/duel/inputLimits";
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSkinnableGame, lookFromStored, type GameLook } from "@/lib/arcade/skins/look";
import { isUuid } from "@/lib/duel/dbError";

export const roomGameLooksFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; game: string }) => {
    const b = record(input);
    return { roomId: text(b["roomId"], ID_MAX, "roomId"), game: text(b["game"], SHORT_MAX, "game") };
  })
  .handler(async ({ data, context }): Promise<Record<string, GameLook>> => {
    if (!isUuid(data.roomId) || !isSkinnableGame(data.game)) return {};
    const { adminDb } = await import("@/lib/data/db.server");
    const { readPlayer } = await import("@/lib/data/players.server");
    const { readRoomGameLooks } = await import("@/lib/data/looks.server");
    const client = await adminDb();
    const { data: me } = await readPlayer(client, data.roomId, context.userId);
    if (!me) return {};
    const { data: rows, error } = await readRoomGameLooks(client, data.roomId, data.game);
    if (error || !rows) return {};
    const out: Record<string, GameLook> = {};
    for (const row of rows) {
      const look = lookFromStored(data.game, row.look);
      if (look.skin || look.world || look.back) out[String(row.player_slot)] = look;
    }
    return out;
  });

/** The phone's call (never throws: a failure draws every ghost in its default look). */
export async function fetchRoomGameLooks(roomId: string, game: string): Promise<Record<string, GameLook>> {
  try {
    return await roomGameLooksFn({ data: { roomId, game } });
  } catch {
    return {};
  }
}
