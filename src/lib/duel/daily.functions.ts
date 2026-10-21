import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { isDailyKind, shiftDayKey, ukDayKey, type DailyStatus } from "./daily";

/* -------------------------------------------------------------------------- */
/*  The daily challenge (21 Oct 2026; daily.server.ts): status, start, boards.  */
/*  The rounds themselves go through the async-room calls (asyncRoom.functions). */
/* -------------------------------------------------------------------------- */

/* eslint-disable @typescript-eslint/no-explicit-any */

async function db(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/**
 * Both dailies' state for this device today; `available: false` (card hidden) before the migration.
 * No session needed (the Play tab asks on every visit and must not sign a visitor in): the device id
 * is read from the call's bearer token when there is one, else both dailies read Play.
 */
export const dailyStatusFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<DailyStatus> => {
    const nowMs = Date.now();
    try {
      const client = await db();
      const { callerUserId } = await import("./betaRecord.server");
      const { dailyStatus } = await import("./daily.server");
      return await dailyStatus(client, await callerUserId(client), nowMs);
    } catch (err) {
      console.warn(`[daily] status: ${err instanceof Error ? err.message : String(err)}`);
      const day = ukDayKey(nowMs);
      const { ukDayWindow } = await import("./daily");
      return {
        available: false,
        day,
        closesAt: ukDayWindow(day).closesAt,
        puzzle: { state: "play" },
        arcade: { state: "play" },
      };
    }
  },
);

/**
 * Starts (or continues) today's daily for this device: one attempt per device per daily, the
 * room dealt and stored on the day's first start. The name is shown on the boards exactly as set,
 * so an offensive one is refused with a friendly message. Rate limited.
 */
export const dailyStartFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { kind: string; displayName: string; colour?: number | null; icon?: string | null }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    if (!isDailyKind(data.kind)) return { ok: false as const, message: "Unknown daily." };
    const nowMs = Date.now();
    const client = await db();
    const { attemptFor, startAttempt } = await import("./asyncRoom.server");
    const { dailyRoom, ensureDailyRoom } = await import("./daily.server");
    // Continuing never needs a new name, a new deal or a rate-limit hit.
    const today = await dailyRoom(client, data.kind, ukDayKey(nowMs));
    const existing = today ? await attemptFor(client, today.id, context.userId) : null;
    if (today && existing) return { ok: true as const, roomId: today.id, created: false };

    const name = String(data.displayName ?? "")
      .trim()
      .slice(0, 14);
    if (!name) return { ok: false as const, message: "Enter a display name." };
    const { NAME_REFUSED_MESSAGE, offensiveName } = await import("./boardName.server");
    if (offensiveName(name))
      return { ok: false as const, message: NAME_REFUSED_MESSAGE, nameRefused: true };
    const { DAILY_START_LIMIT, withinRateLimit } = await import("./rateLimit.server");
    if (!(await withinRateLimit(client, context.userId, DAILY_START_LIMIT)))
      return { ok: false as const, message: "Too many tries. Wait a few minutes and try again." };
    const { isPlayerColour, isPlayerIcon } = await import("./playerLook");
    const colour = isPlayerColour(data.colour) ? data.colour : null;
    const icon = isPlayerIcon(data.icon) ? data.icon : null;
    const room = today ?? (await ensureDailyRoom(client, data.kind, nowMs, context.userId));
    const started = await startAttempt(client, room, context.userId, { name, colour, icon }, nowMs);
    if (!started.ok) return started;
    return { ok: true as const, roomId: room.id, created: started.created };
  });

/** A daily's board for today or yesterday, with the caller's own line pinned. */
export const dailyBoardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: string; day: "today" | "yesterday" }) => input)
  .handler(async ({ data, context }) => {
    if (!isDailyKind(data.kind)) throw new Error("Unknown daily.");
    const nowMs = Date.now();
    const today = ukDayKey(nowMs);
    const day = data.day === "yesterday" ? shiftDayKey(today, -1) : today;
    const { dailyBoard } = await import("./daily.server");
    return dailyBoard(await db(), data.kind, day, context.userId, nowMs);
  });
