/**
 * The beta values (src/config/betaConfig.ts) as the app reads them. A check or a screenshot can stand
 * in its own values through window.__DUELZ_BETA_CONFIG__ (as publicSchedule.ts's
 * __DUELZ_PUBLIC_GAMES__); the app never sets it.
 */
import * as config from "@/config/betaConfig";

export type BetaKey = "SENTRY_DSN" | "TALLY_URL" | "CONTACT_EMAIL" | "DISCORD_URL";

export function betaValue(key: BetaKey): string {
  if (typeof window !== "undefined") {
    const override = (
      window as unknown as { __DUELZ_BETA_CONFIG__?: Partial<Record<BetaKey, unknown>> }
    ).__DUELZ_BETA_CONFIG__;
    const value = override?.[key];
    if (typeof value === "string") return value.trim();
  }
  return config[key].trim();
}
