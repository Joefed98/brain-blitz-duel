/**
 * Practice challenges: the server function the lists call (wave 2 C1b; docs/challenges/catalogue.md). A thin shell
 * over challenges.server.ts on the service-role client. It reads the caller's own progress (guests too: they are auth
 * users) and pays any rewards due first; it never completes a challenge or credits coins for anything the phone says.
 * Completion happens only in the server's grading of a Practice run (practice.functions.ts).
 *
 *   getMyChallengesFn()   { account, rows: [{ id, best, done, doneAt, coins, paid }] }, or { busy: true }
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ChallengeProgressView } from "./challenges.server";

export interface MyChallenges {
  /** Whether the caller is an account (coins paid) or a guest (completions kept, coins waiting). */
  account: boolean;
  rows: ChallengeProgressView[];
}

export const getMyChallengesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyChallenges | { busy: true }> => {
    const { adminDb } = await import("@/lib/data/db.server");
    const client = await adminDb();
    const { CHALLENGES_LIMIT, withinRateLimit } = await import("@/lib/duel/rateLimit.server");
    if (!(await withinRateLimit(client, context.userId, CHALLENGES_LIMIT))) return { busy: true };
    const { myChallengeProgress } = await import("./challenges.server");
    const { readProfile } = await import("@/lib/data/profiles.server");
    const [rows, profile] = await Promise.all([myChallengeProgress(client, context.userId), readProfile(client, context.userId)]);
    return { account: Boolean(profile.data), rows };
  });
