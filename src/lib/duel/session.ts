import { supabase } from "@/integrations/supabase/client";

const NAME_KEY = "duelz_display_name";

/**
 * Every device gets a real auth identity through anonymous sign-in, kept in
 * the normal Supabase auth storage so a refresh keeps the same `auth.uid()`.
 *
 * When email / Google sign-in is added later, the same anonymous user can be
 * upgraded in place with `supabase.auth.linkIdentity()` or
 * `supabase.auth.updateUser({ email, password })` — the user id, and therefore
 * every `duel_players.user_id` row, stays the same.
 */
let pending: Promise<string> | null = null;

export async function ensureSession(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const existing = data.session?.user?.id;
  if (existing) return existing;

  pending ??= (async () => {
    const { data: signedIn, error } = await supabase.auth.signInAnonymously();
    if (error || !signedIn.user) {
      pending = null;
      throw new Error("Couldn't start a session on this device. Please try again.");
    }
    return signedIn.user.id;
  })();

  return pending;
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

export function getStoredName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(NAME_KEY) ?? "";
}

export function setStoredName(name: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NAME_KEY, name);
}
