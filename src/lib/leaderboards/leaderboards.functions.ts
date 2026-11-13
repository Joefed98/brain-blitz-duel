/**
 * Leaderboards: the server functions the screens call (wave 4, session W4a; docs/leaderboards.md). A thin shell over
 * leaderboards.server.ts on the service-role client; the caller is always the signed-in auth user (requireSupabaseAuth,
 * guests included), never an id the phone names.
 *
 *   ratingBoardFn({ board, scope, period, offset })   a rating board page (Joulz Rating, Puzzles, Arcade, a category)
 *   dailyTopBoardFn({ kind, day, scope })                a Daily top 100 (or friends), today's or an earlier day's
 *   boardVisibilityFn()                               "Show me on leaderboards" (accounts)
 *   setBoardVisibilityFn({ show })                    true, false, or null for the default
 *
 * Nothing here writes a board: boards are refreshed by pg_cron only.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function setup() {
  const { adminDb } = await import("@/lib/data/db.server");
  return { client: await adminDb(), boards: await import("./leaderboards.server") };
}

export const ratingBoardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { board: string; scope: string; period: string; offset?: number }) => input)
  .handler(async ({ data, context }) => {
    const { client, boards } = await setup();
    return boards.ratingBoard(client, context.userId, data);
  });

export const dailyTopBoardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: string; day?: string; scope?: string }) => input)
  .handler(async ({ data, context }) => {
    const { client, boards } = await setup();
    return boards.dailyBoard(client, context.userId, data);
  });

export const boardVisibilityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { client, boards } = await setup();
    return boards.visibility(client, context.userId);
  });

export const setBoardVisibilityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { show: boolean | null }) => input)
  .handler(async ({ data, context }) => {
    const { client, boards } = await setup();
    return boards.setVisibility(client, context.userId, data);
  });
