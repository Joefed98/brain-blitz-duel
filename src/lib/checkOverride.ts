/**
 * Check-only stand-ins: a browser check or a screenshot sets one of these on its own page (window.__DUELZ_…__) to
 * stand in a value the app would otherwise take from its config. A production build reads none of them: Vite
 * replaces `import.meta.env.PROD` with true there, so `checkOverride` returns undefined before touching `window`.
 * Under bun (the happy-dom checks) and on a dev server PROD is not true, so the checks keep working.
 *
 * Two switches stay outside this helper, each already off for real players: `__DUELZ_AUDIT_INPUT__` (dev builds
 * only, auditInput.ts) and `__DUELZ_SHOP_TAB__` (its own PROD test, shopSwitch.ts). `__DUELZ_ALLOW_PACKS__`
 * (packs.ts) is read only while `navigator.webdriver` is true and only lets an automated browser behave as a
 * player's does (offline-check runs it on a production build).
 */
export type CheckOverrideName =
  | "__DUELZ_ACCOUNT_FIXTURE__"
  | "__DUELZ_ALLOW_ANALYTICS__"
  | "__DUELZ_ALLOW_SAFETY__"
  | "__DUELZ_BANNERS__"
  | "__DUELZ_BETA_CONFIG__"
  | "__DUELZ_CELEBRATION_LOG__"
  | "__DUELZ_FIRST_OPEN__"
  | "__DUELZ_IDENTITY_EVENTS__"
  | "__DUELZ_PUBLIC_GAMES__"
  | "__DUELZ_TURNSTILE_SITE_KEY__";

export function checkOverride<T = unknown>(name: CheckOverrideName): T | undefined {
  // Plain import.meta.env.PROD so Vite replaces it with true in a production build.
  if (import.meta.env.PROD) return undefined;
  if (typeof window === "undefined") return undefined;
  try {
    return (window as unknown as Record<string, unknown>)[name] as T | undefined;
  } catch {
    return undefined;
  }
}
