/**
 * The beta terms' agreement in the beta events (terms_events, supabase/migrations/20261023120000):
 * when this device agreed, and to which terms. Best-effort and never part of play: until the
 * migration is applied the write fails quietly (betaRecord.server.ts) and the phone carries on.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { num, record, text } from "@/lib/validate";

export const recordTermsAgreedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  // Type and size only (Security C2); termsEventRow judges the version, and the stored date is the server's.
  .inputValidator((input: { version: number; agreedAt: string }) => {
    const body = record(input);
    return { version: num(body["version"], "version"), agreedAt: text(body["agreedAt"], 64, "agreedAt") };
  })
  .handler(async ({ data, context }) => {
    // Skipped where there is no database (local dev servers in checks).
    if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) return { ok: true };
    const { recordTermsAgreed, termsEventRow } = await import("@/lib/duel/betaRecord.server");
    // The stored date is the server's own (the phone sends this as it agrees).
    const row = termsEventRow(context.userId, { version: data?.version, agreedAt: new Date().toISOString() });
    if (!row) return { ok: false };
    const supabaseAdmin = await (await import("@/lib/data/db.server")).adminDb();
    const { BETA_EVENT_LIMIT, withinRateLimit } = await import("@/lib/duel/rateLimit.server");
    if (!(await withinRateLimit(supabaseAdmin, context.userId, BETA_EVENT_LIMIT))) return { ok: false };
    await recordTermsAgreed(supabaseAdmin, row);
    return { ok: true };
  });
