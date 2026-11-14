/**
 * Replay server functions (display only). Both refuse until the round (or the
 * whole game) has closed for every player; see access.ts and replay.server.ts.
 */
import { num, record, text } from "@/lib/validate";
import { COUNT_MAX, ID_MAX } from "@/lib/duel/inputLimits";
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ReplayResponse, ReplayRound } from "./replay.server";

/** The service-role client, typed on the generated schema (src/lib/data/db.server.ts). */
async function db() {
  const { adminDb } = await import("@/lib/data/db.server");
  return adminDb();
}

export const roundReplayFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; roundNumber: number }) => {
    const b = record(input);
    return {
      roomId: text(b["roomId"], ID_MAX, "roomId"),
      roundNumber: Math.trunc(num(b["roundNumber"], -COUNT_MAX, COUNT_MAX, "roundNumber")),
    };
  })
  .handler(async ({ data, context }): Promise<ReplayResponse<ReplayRound | null>> => {
    const { loadRoundReplay } = await import("./replay.server");
    return loadRoundReplay(await db(), context.userId, data);
  });

export const gameReplaysFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => ({ roomId: text(record(input)["roomId"], ID_MAX, "roomId") }))
  .handler(async ({ data, context }): Promise<ReplayResponse<ReplayRound[]>> => {
    const { loadGameReplays } = await import("./replay.server");
    return loadGameReplays(await db(), context.userId, data);
  });
