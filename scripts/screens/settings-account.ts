/**
 * The Settings, account and onboarding session's screens (phase 2 step 3, 14 Nov 2026; docs/design/style-guide): the
 * Settings page (/settings) for a guest and an account, every step of sign in and sign up (S2–S6, through the
 * check-only window.__DUELZ_ACCOUNT_FIXTURE__), Settings → Account on /account, the first-time intro's three panels
 * and the terms, in the dark theme and the light, at every size (ALL_SIZES). theme-check and no-wrap-check draw them
 * as an area file found by scripts/area-screens.ts.
 */
import type { Page } from "playwright";

// Only read inside SETTINGS_ACCOUNT_SCREENS() (the area loader imports this file after theme-screens).
import { ACCOUNT_FIXTURE, ALL_SIZES, type ThemeScreen } from "../theme-screens";

const scrollTo = (selector: string) => async (page: Page) => {
  await page.locator(selector).first().waitFor({ timeout: 10_000 });
  await page.locator(selector).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
};

/** The intro's panel n (1–3): Next until it is the current one. */
const introPanel = (n: number) => async (page: Page) => {
  for (let i = 1; i < n; i++) {
    await page.locator("[data-onboarding-next]").click();
    await page.waitForTimeout(450);
  }
};

export const SETTINGS_ACCOUNT_SCREENS = (): ThemeScreen[] => {
  const account = { __harnessNavAccount: ACCOUNT_FIXTURE };
  const light = { __harnessTheme: "light" };
  const card = { email: "inventor@example.com", username: "TheInventor", colour: 4, dob: { d: "14", m: "3", y: "1998" } };
  const flow = (name: string, fixture: Record<string, unknown>, theme: Record<string, unknown> = {}): ThemeScreen => ({
    name: `settings page: sign-up, ${name}`,
    mode: "account",
    plain: true,
    globals: { __DUELZ_ACCOUNT_FIXTURE__: fixture, ...theme },
    sizes: ALL_SIZES,
  });
  return [
    { name: "settings page: a guest", mode: "settings", plain: true, waitMs: 800, sizes: ALL_SIZES },
    { name: "settings page: a guest, help", mode: "settings", plain: true, waitMs: 800, go: scrollTo("[data-settings-group='help']"), sizes: ALL_SIZES },
    { name: "settings page: an account", mode: "settings", plain: true, globals: account, waitMs: 1000, sizes: ALL_SIZES },
    { name: "settings page: an account, controls", mode: "settings", plain: true, globals: account, waitMs: 1000, go: scrollTo("[data-settings-group='controls']"), sizes: ALL_SIZES },
    { name: "settings page light: a guest", mode: "settings", plain: true, globals: light, waitMs: 800, sizes: ALL_SIZES },
    { name: "settings page light: an account", mode: "settings", plain: true, globals: { ...account, ...light }, waitMs: 1000, sizes: ALL_SIZES },
    { name: "settings page: account page", mode: "account", plain: true, globals: { __harnessAccount: ACCOUNT_FIXTURE }, sizes: ALL_SIZES },
    flow("sign in", { step: "signin" }),
    flow("email", { step: "email", email: "inventor@example.com" }),
    flow("inbox", { step: "inbox", ...card }),
    flow("username", { step: "username", ...card }),
    flow("username refused", { step: "username", ...card, username: "admin" }),
    flow("birthday", { step: "birthday", ...card }),
    flow("under 13", { step: "under13" }),
    flow("sign-in warning", { step: "warn", email: "inventor@example.com", progress: { rooms: 3, dailies: 2, challenges: 1, practice: 14 } }),
    flow("welcome", { step: "welcome", done: ACCOUNT_FIXTURE }),
    flow("deletion pending", { step: "deleting", done: { ...ACCOUNT_FIXTURE, deletion: { requestedAt: "2026-11-01T12:00:00.000Z", purgeAt: "2026-12-01T12:00:00.000Z" } } }),
    flow("sign in, light", { step: "signin" }, light),
    flow("username, light", { step: "username", ...card }, light),
    flow("welcome, light", { step: "welcome", done: ACCOUNT_FIXTURE }, light),
    { name: "settings page: intro, panel 1", mode: "onboarding", plain: true, sizes: ALL_SIZES },
    { name: "settings page: intro, panel 2", mode: "onboarding", plain: true, go: introPanel(2), sizes: ALL_SIZES },
    { name: "settings page: intro, panel 3", mode: "onboarding", plain: true, go: introPanel(3), sizes: ALL_SIZES },
    { name: "settings page light: intro, panel 1", mode: "onboarding", plain: true, globals: light, sizes: ALL_SIZES },
    { name: "settings page: terms", mode: "terms", plain: true, query: "terms=0", sizes: ALL_SIZES },
    { name: "settings page light: terms", mode: "terms", plain: true, query: "terms=0", globals: light, sizes: ALL_SIZES },
  ];
};

export default SETTINGS_ACCOUNT_SCREENS;
