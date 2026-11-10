/**
 * Cloudflare Turnstile on the phone (safety, 10 Nov 2026; docs/moderation.md "Bots"): an invisible widget that hands
 * back a one-use token for guest creation (Supabase's anonymous sign-in), sign-in emails (both checked by Supabase
 * Auth's captcha protection) and account sign-up's last step (checked by our server, turnstile.server.ts).
 *
 * Off (no script loaded, nothing rendered, every call answers null) while src/config/safetyConfig.ts has no site key.
 * Never throws: a token that can't be had answers null and the call goes ahead without one (Supabase or the server
 * then decides).
 */

import { turnstileSiteKey } from "@/config/safetyConfig";

export const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TOKEN_TIMEOUT_MS = 10_000;

interface TurnstileApi {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  remove(id: string): void;
}

let loading: Promise<TurnstileApi | null> | null = null;

function loadScript(): Promise<TurnstileApi | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const existing = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
  if (existing) return Promise.resolve(existing);
  loading ??= new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve((window as unknown as { turnstile?: TurnstileApi }).turnstile ?? null);
    script.onerror = () => {
      loading = null;
      resolve(null);
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Whether Turnstile is on for this build. */
export function turnstileEnabled(): boolean {
  return turnstileSiteKey() !== "";
}

/** A fresh one-use token for `action` ("guest", "sign-in", "sign-up"), or null (off, offline, or no answer). */
export async function getTurnstileToken(action: "guest" | "sign-in" | "sign-up"): Promise<string | null> {
  const siteKey = turnstileSiteKey();
  if (!siteKey || typeof document === "undefined") return null;
  const api = await loadScript();
  if (!api) return null;
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.setAttribute("data-turnstile", action);
  host.style.cssText = "position:fixed;width:0;height:0;overflow:hidden;pointer-events:none;";
  document.body.appendChild(host);
  let id: string | null = null;
  try {
    return await new Promise<string | null>((resolve) => {
      const timer = window.setTimeout(() => resolve(null), TOKEN_TIMEOUT_MS);
      const done = (token: string | null) => {
        window.clearTimeout(timer);
        resolve(token);
      };
      try {
        id = api.render(host, {
          sitekey: siteKey,
          action,
          appearance: "interaction-only",
          callback: (token: string) => done(token),
          "error-callback": () => done(null),
          "expired-callback": () => done(null),
        });
      } catch {
        done(null);
      }
    });
  } finally {
    try {
      if (id) api.remove(id);
    } catch {
      /* already gone */
    }
    host.remove();
  }
}
