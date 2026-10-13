/**
 * Replay server functions (display only). Both refuse until the round (or the
 * whole game) has closed for every player; see access.ts and replay.server.ts.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ReplayResponse, ReplayRound } from "./replay.server";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function db(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const roundReplayFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; roundNumber: number }) => ({
    roomId: String(input?.roomId ?? ""),
    roundNumber: Math.trunc(Number(input?.roundNumber)),
  }))
  .handler(async ({ data, context }): Promise<ReplayResponse<ReplayRound | null>> => {
    const { loadRoundReplay } = await import("./replay.server");
    return loadRoundReplay(await db(), context.userId, data);
  });

export const gameReplaysFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => ({ roomId: String(input?.roomId ?? "") }))
  .handler(async ({ data, context }): Promise<ReplayResponse<ReplayRound[]>> => {
    const { loadGameReplays } = await import("./replay.server");
    return loadGameReplays(await db(), context.userId, data);
  });
