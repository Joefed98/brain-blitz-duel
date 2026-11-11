/**
 * Practice progress calls (wave 2 train C, C1a; docs/practice-progress.md): the signed-in player's (guest or
 * account) stars, bests and gems, and the one-time refresh note. Read only from the server's own rows, so the same
 * account sees the same progress on every device; a guest's progress is that guest's alone.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { PracticeProgressView } from "./progress";

async function setup(userId: string) {
  const { adminDb } = await import("@/lib/data/db.server");
  const client = await adminDb();
  const { PRACTICE_PROGRESS_LIMIT, withinRateLimit } = await import("@/lib/duel/rateLimit.server");
  return { client, allowed: await withinRateLimit(client, userId, PRACTICE_PROGRESS_LIMIT) };
}

/** The caller's practice progress (empty for a player with no counted run). */
export const getMyPracticeProgressFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PracticeProgressView | { busy: true }> => {
    const { client, allowed } = await setup(context.userId);
    if (!allowed) return { busy: true };
    const { progressFor } = await import("./progress.server");
    return progressFor(client, context.userId);
  });

/** Records that the caller has seen Practice's one-time refresh note. */
export const markPracticeRefreshNoteSeenFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean }> => {
    const { client, allowed } = await setup(context.userId);
    if (!allowed) return { ok: false };
    const { markRefreshNoteSeen } = await import("@/lib/data/practiceProgress.server");
    const { error } = await markRefreshNoteSeen(client, context.userId);
    return { ok: !error };
  });
