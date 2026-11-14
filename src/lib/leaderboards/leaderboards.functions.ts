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
import { num, optional, record, sized, text } from "@/lib/validate";

/*
 * Input checks (Security C2, 14 Nov 2026; src/lib/validate.ts): type and size only. leaderboards.server.ts still
 * judges each board, scope, period, offset and day.
 */
const WORD_MAX = 32;

async function setup() {
  const { adminDb } = await import("@/lib/data/db.server");
  return { client: await adminDb(), boards: await import("./leaderboards.server") };
}

export const ratingBoardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { board: string; scope: string; period: string; offset?: number }) => {
    const body = record(input);
    return {
      board: text(body["board"], WORD_MAX, "board"),
      scope: text(body["scope"], WORD_MAX, "scope"),
      period: text(body["period"], WORD_MAX, "period"),
      offset: optional(body["offset"], (v) => num(v, "offset")),
    };
  })
  .handler(async ({ data, context }) => {
    const { client, boards } = await setup();
    return boards.ratingBoard(client, context.userId, data);
  });

export const dailyTopBoardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: string; day?: string; scope?: string }) => {
    const body = record(input);
    return {
      kind: text(body["kind"], WORD_MAX, "kind"),
      day: optional(body["day"], (v) => text(v, WORD_MAX, "day")),
      scope: optional(body["scope"], (v) => text(v, WORD_MAX, "scope")),
    };
  })
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
  // Size only: setVisibility answers a value that isn't true, false or null itself (leaderboards-check).
  .inputValidator((input: { show: boolean | null }) => ({ show: sized(record(input)["show"], 64, "show") as boolean | null }))
  .handler(async ({ data, context }) => {
    const { client, boards } = await setup();
    return boards.setVisibility(client, context.userId, data);
  });
