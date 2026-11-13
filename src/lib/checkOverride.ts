/**
 * Check-only stand-ins: a browser check or a screenshot sets one of these on its own page (window.__DUELZ_…__) to
 * stand in a value the app would otherwise take from its config. A production build reads none of them: Vite
 * replaces `import.meta.env.PROD` with true there, so `checkOverride` returns undefined before touching `window`.
 * Under bun (the happy-dom checks) and on a dev server PROD is not true, so the checks keep working.
 *
 * Three switches stay outside this helper, each already off for real players: `__DUELZ_AUDIT_INPUT__` (dev builds
 * only, auditInput.ts), `__DUELZ_SHOP_TAB__` (its own PROD test, shopSwitch.ts) and `__DUELZ_ALLOW_BADGES__` (its own
 * PROD test after the navigator.webdriver one, badgesApi.ts). `__DUELZ_ALLOW_PACKS__`
 * (packs.ts) is read only while `navigator.webdriver` is true and only lets an automated browser behave as a
 * player's does (offline-check runs it on a production build).
 */
export type CheckOverrideName =
  | "__DUELZ_ACCOUNT_FIXTURE__"
  | "__DUELZ_ALLOW_ANALYTICS__"
  | "__DUELZ_ALLOW_CHALLENGES__"
  | "__DUELZ_ALLOW_PASS__"
  | "__DUELZ_ALLOW_PRESENCE__"
  | "__DUELZ_ALLOW_PASS__"
  | "__DUELZ_ALLOW_RATED__"
  | "__DUELZ_ALLOW_SAFETY__"
  | "__DUELZ_ALLOW_SEASONS__"
  | "__DUELZ_ALLOW_TOURNAMENTS__"
  | "__DUELZ_ALLOW_SHOP__"
  | "__DUELZ_ALLOW_TOURNAMENTS__"
  | "__DUELZ_BANNERS__"
  | "__DUELZ_BETA_CONFIG__"
  | "__DUELZ_CELEBRATION_LOG__"
  | "__DUELZ_CHALLENGES__"
  | "__DUELZ_FIRST_OPEN__"
  | "__DUELZ_IDENTITY_EVENTS__"
  | "__DUELZ_MINES_PRE_LOGIC__"
  | "__DUELZ_PUBLIC_GAMES__"
  | "__DUELZ_RATED_BACKEND__"
  | "__DUELZ_RATED_EVENTS__"
  | "__DUELZ_PUSH_PUBLIC_KEY__"
  | "__DUELZ_TURNSTILE_SITE_KEY__";

export function checkOverride<T = unknown>(name: CheckOverrideName): T | undefined {
  // Plain import.meta.env.PROD so Vite replaces it with true in a production build.
  if (import.meta.env.PROD) return undefined;
  // Under bun (a server-side check, no window) a check sets its stand-in on the global through setCheckOverride.
  if (typeof window === "undefined") return serverStandIns()[name] as T | undefined;
  try {
    return (window as unknown as Record<string, unknown>)[name] as T | undefined;
  } catch {
    return undefined;
  }
}

/** Where a server-side check's stand-ins live (bun only; a production build never reads it). */
function serverStandIns(): Record<string, unknown> {
  const g = globalThis as unknown as { __duelzCheckStandIns?: Record<string, unknown> };
  return (g.__duelzCheckStandIns ??= {});
}

/**
 * Sets a stand-in for code that runs with no window (a check calling server code in its own process, e.g. the deal's
 * check-only era switches in dealEra.ts). A production build ignores it and never sets anything.
 */
export function setCheckOverride(name: CheckOverrideName, value: unknown): void {
  if (import.meta.env.PROD) return;
  if (value === undefined) delete serverStandIns()[name];
  else serverStandIns()[name] = value;
}
