/**
 * The feedback form's device reference (13 Nov 2026): an HMAC-SHA-256 of the caller's own user id under the Worker
 * secret FEEDBACK_HMAC_KEY, its first 32 hex digits. The phone sends it to the Tally form in place of the id, so the
 * form can be matched to the beta's recordings only by someone holding the key. No key set: no reference (the link
 * carries the version alone).
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** The reference for `userId` under `key`: hex HMAC-SHA-256, cut to 32 digits (128 bits). */
export async function feedbackRef(key: string, userId: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(userId)));
  return [...mac.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const feedbackRefFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ref: string | null }> => {
    const key = process.env["FEEDBACK_HMAC_KEY"];
    if (!key) return { ref: null };
    return { ref: await feedbackRef(key, context.userId) };
  });
