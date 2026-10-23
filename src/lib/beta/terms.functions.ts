/**
 * The beta terms' agreement in the beta events (terms_events, supabase/migrations/20261023120000):
 * when this device agreed, and to which terms. Best-effort and never part of play: until the
 * migration is applied the write fails quietly (betaRecord.server.ts) and the phone carries on.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const recordTermsAgreedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { version: number; agreedAt: string }) => input)
  .handler(async ({ data, context }) => {
    // Skipped where there is no database (local dev servers in checks).
    if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) return { ok: true };
    const { recordTermsAgreed, termsEventRow } = await import("@/lib/duel/betaRecord.server");
    const row = termsEventRow(context.userId, data as unknown as Record<string, unknown>);
    if (!row) return { ok: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await recordTermsAgreed(supabaseAdmin, row);
    return { ok: true };
  });
