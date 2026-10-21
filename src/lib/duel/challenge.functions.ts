import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { challengeCodeFrom } from "./challenge";

/* -------------------------------------------------------------------------- */
/*  Friend challenges (22 Oct 2026; challenge.server.ts): status, making one,   */
/*  opening a link, starting, the run's pings and boards, and Profile's list.   */
/*  Rounds themselves go through the async-room calls (asyncRoom.functions).    */
/* -------------------------------------------------------------------------- */

/* eslint-disable @typescript-eslint/no-explicit-any */

async function db(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** The name and look a player sets, checked as the daily checks a board name. */
async function playerFrom(data: { displayName?: unknown; colour?: unknown; icon?: unknown }) {
  const name = String(data.displayName ?? "")
    .trim()
    .slice(0, 14);
  if (!name) return { error: "Enter a display name." } as const;
  const { NAME_REFUSED_MESSAGE, offensiveName } = await import("./boardName.server");
  if (offensiveName(name)) return { error: NAME_REFUSED_MESSAGE, nameRefused: true } as const;
  const { isPlayerColour, isPlayerIcon } = await import("./playerLook");
  return {
    who: {
      name,
      colour: isPlayerColour(data.colour) ? data.colour : null,
      icon: isPlayerIcon(data.icon) ? data.icon : null,
    },
  } as const;
}

/** The challenge (by its async room id) and the caller's attempt in it. */
async function mine(client: any, roomId: string, userId: string) {
  const { challengeById } = await import("./challenge.server");
  const found = await challengeById(client, String(roomId ?? ""));
  if (!found) return { error: "That challenge no longer exists." } as const;
  const { attemptFor } = await import("./asyncRoom.server");
  const attempt = await attemptFor(client, found.room.id, userId);
  if (!attempt) return { error: "You haven't started this challenge." } as const;
  return { ...found, attempt } as const;
}

/**
 * Whether challenges are available (the migration applied). No session needed: the Play tab asks on
 * every visit and must not sign a visitor in.
 */
export const challengeStatusFn = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const { challengesAvailable } = await import("./challenge.server");
    return { available: await challengesAvailable(await db()) };
  } catch {
    return { available: false };
  }
});

/** Makes a challenge from the Play tab and starts the creator's own attempt. Rate limited. */
export const createChallengeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      categories: string[];
      rounds: number;
      displayName: string;
      colour?: number | null;
      icon?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const player = await playerFrom(data);
    if ("error" in player)
      return { ok: false as const, message: player.error, nameRefused: "nameRefused" in player };
    const client = await db();
    const { CHALLENGE_CREATE_LIMIT, withinRateLimit } = await import("./rateLimit.server");
    if (!(await withinRateLimit(client, context.userId, CHALLENGE_CREATE_LIMIT)))
      return { ok: false as const, message: "Too many tries. Wait a few minutes and try again." };
    const { createChallenge } = await import("./challenge.server");
    return createChallenge(
      client,
      context.userId,
      { categories: data.categories, rounds: Number(data.rounds), who: player.who },
      Date.now(),
    );
  });

/** Makes (or finds) the challenge for a finished room's game; any player of that room may ask. Rate limited. */
export const challengeFromRoomFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { duelId: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const { CHALLENGE_CREATE_LIMIT, withinRateLimit } = await import("./rateLimit.server");
    if (!(await withinRateLimit(client, context.userId, CHALLENGE_CREATE_LIMIT)))
      return { ok: false as const, message: "Too many tries. Wait a few minutes and try again." };
    const { createChallengeFromRoom } = await import("./challenge.server");
    return createChallengeFromRoom(client, context.userId, String(data.duelId ?? ""), Date.now());
  });

/** What a challenge link shows this device; `opened` counts the link's first opening (beta). */
export const challengeInfoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; opened?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const code = challengeCodeFrom(data.code);
    if (!code) return { found: false as const };
    const client = await db();
    const { ROOM_LOOKUP_LIMIT, withinRateLimit } = await import("./rateLimit.server");
    if (!(await withinRateLimit(client, context.userId, ROOM_LOOKUP_LIMIT)))
      return { found: false as const };
    const { challengeInfo } = await import("./challenge.server");
    const info = await challengeInfo(client, code, context.userId, Date.now());
    if (data.opened && info.found && !info.isCreator) {
      const { recordChallengeEvent } = await import("./betaRecord.server");
      await recordChallengeEvent(client, {
        room_id: info.roomId,
        code,
        user_id: context.userId,
        event: "link_opened",
      });
    }
    return info;
  });

/** Starts (or continues) this device's one attempt on a challenge. */
export const startChallengeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { code: string; displayName: string; colour?: number | null; icon?: string | null }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const code = challengeCodeFrom(data.code);
    if (!code) return { ok: false as const, message: "That challenge doesn't exist." };
    const client = await db();
    const { attemptFor } = await import("./asyncRoom.server");
    const { challengeByCode, startChallenge } = await import("./challenge.server");
    // Continuing never needs a name.
    const found = await challengeByCode(client, code);
    if (found && (await attemptFor(client, found.room.id, context.userId)))
      return { ok: true as const, roomId: found.room.id, created: false };
    const player = await playerFrom(data);
    if ("error" in player)
      return { ok: false as const, message: player.error, nameRefused: "nameRefused" in player };
    return startChallenge(client, code, context.userId, player.who, Date.now());
  });

/** The earlier players this run plays against, and this device's slot. */
export const challengeRosterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const found = await mine(client, data.roomId, context.userId);
    if ("error" in found) return null;
    const { challengeRoster } = await import("./challenge.server");
    return challengeRoster(client, found.room, found.attempt);
  });

/** Which earlier players had finished this round by now on the caller's own clock (slots only). */
export const challengePingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; roundNumber: number }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const found = await mine(client, data.roomId, context.userId);
    if ("error" in found) return [] as number[];
    const { challengePings } = await import("./challenge.server");
    return challengePings(client, found.room, found.attempt, Number(data.roundNumber), Date.now());
  });

/** A round's results for the caller, once their own is stored. */
export const challengeRoundBoardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; roundNumber: number }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const found = await mine(client, data.roomId, context.userId);
    if ("error" in found) return { ok: false as const, message: found.error };
    const { challengeRoundBoard } = await import("./challenge.server");
    const result = await challengeRoundBoard(
      client,
      found.room,
      found.attempt,
      Number(data.roundNumber),
    );
    // As JSON text, so the RPC boundary sees plain strings (stored extras vary by game).
    return result.ok ? { ok: true as const, json: JSON.stringify(result.board) } : result;
  });

/** The final podium for a caller who has finished. */
export const challengeFinalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const found = await mine(client, data.roomId, context.userId);
    if ("error" in found) return { ok: false as const, message: found.error };
    const { challengeFinalBoard } = await import("./challenge.server");
    const result = await challengeFinalBoard(client, found, found.attempt, Date.now());
    return result.ok ? { ok: true as const, json: JSON.stringify(result.board) } : result;
  });

/** Profile's "Your challenges": those this device made, plus the codes it remembers. */
export const myChallengesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { codes: string[] }) => input)
  .handler(async ({ data, context }) => {
    const codes = (Array.isArray(data.codes) ? data.codes : [])
      .map(challengeCodeFrom)
      .filter((c): c is string => !!c);
    const { myChallenges } = await import("./challenge.server");
    return myChallenges(await db(), context.userId, codes, Date.now());
  });

/** A friend's first room or daily after finishing a challenge (beta, once per device and kind). */
export const challengeFollowupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: "room" | "daily"; code?: string | null }) => input)
  .handler(async ({ data, context }) => {
    if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) return { ok: true };
    if (data.kind !== "room" && data.kind !== "daily") return { ok: false };
    const { recordChallengeEvent } = await import("./betaRecord.server");
    await recordChallengeEvent(await db(), {
      room_id: null,
      code: challengeCodeFrom(data.code),
      user_id: context.userId,
      event: data.kind === "room" ? "followup_room" : "followup_daily",
    });
    return { ok: true };
  });
