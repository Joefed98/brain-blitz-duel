/**
 * The Profile session's screens (phase 2 step 3, 14 Nov 2026; docs/design/style-guide/phone/profile.png and
 * desktop/profile.png): your own Profile (an account placed in rated play with badges, stars, friends and rooms; an
 * account without rated play; a guest; a brand-new guest), Badges (/badges), the player card page (/card), Friends (the
 * list, a friend's profile, Add a friend) and Customise, in the dark theme and the light, at every size (ALL_SIZES).
 * theme-check and no-wrap-check draw them through THEME_SCREENS (scripts/theme-screens.ts, appended last).
 *
 * Every figure is a fixture stood in through the screen harness (scripts/safe-area-harness.tsx): window.__harnessProfile
 * (the badges answer, the practice progress, the rated status), __harnessNavAccount (the signed-in account) and
 * __harnessFriends (the friends list Profile's strip reads).
 */
import type { Page } from "playwright";

// Imported after theme-screens has loaded (theme-screens imports this file): only read inside PROFILE_SCREENS().
import { ACCOUNT_FIXTURE, ALL_SIZES, CUSTOMISE_SCREENS, FRIENDS_SCREENS, type ThemeScreen } from "../theme-screens";
import { PROFILE_BADGES, PROFILE_PROGRESS, PROFILE_RATED, uid } from "./profile-fixture";

/** The friends list's fixture (FRIENDS_SCREENS' own), for Profile's Friends strip. */
function friendsGlobals(): Record<string, unknown> {
  const screen = FRIENDS_SCREENS()[0]!;
  return screen.globals ?? {};
}

/** Customise's fixture (CUSTOMISE_SCREENS' own: the account, the catalogue and the items owned). */
function customiseGlobals(): Record<string, unknown> {
  return CUSTOMISE_SCREENS()[0]!.globals ?? {};
}
const tab = (name: string) => async (page: Page) => {
  await page.locator(`[data-customise-tab='${name}']`).click();
  await page.waitForTimeout(500);
};

const scrollTo = (selector: string) => async (page: Page) => {
  if (await page.locator(selector).count()) await page.locator(selector).first().scrollIntoViewIfNeeded();
  else await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
};

export const PROFILE_SCREENS = (): ThemeScreen[] => {
  const account = { __harnessNavAccount: ACCOUNT_FIXTURE };
  const full = { ...account, ...friendsGlobals(), __harnessProfile: { badges: PROFILE_BADGES, progress: PROFILE_PROGRESS, rated: PROFILE_RATED } };
  const unrated = { ...account, ...friendsGlobals(), __harnessProfile: { badges: PROFILE_BADGES, progress: PROFILE_PROGRESS } };
  const light = { __harnessTheme: "light" };
  return [
    { name: "profile page: an account, rated", mode: "profile", globals: full, waitMs: 1200, sizes: ALL_SIZES },
    { name: "profile page: an account, rated, scrolled", mode: "profile", globals: full, waitMs: 1200, go: scrollTo("[data-profile-friends]"), sizes: ALL_SIZES },
    { name: "profile page: an account without rated play", mode: "profile", globals: unrated, waitMs: 1200, sizes: ALL_SIZES },
    { name: "profile page: a guest", mode: "profile", waitMs: 800, sizes: ALL_SIZES },
    { name: "profile page: a new guest", mode: "profile", records: false, waitMs: 800, sizes: ALL_SIZES },
    { name: "profile page: badges", mode: "badges", plain: true, globals: full, waitMs: 1000, sizes: ALL_SIZES },
    { name: "profile page: the player card", mode: "card", plain: true, globals: full, waitMs: 1000, sizes: ALL_SIZES },
    { name: "profile page: friends list", mode: "friends", plain: true, globals: friendsGlobals(), sizes: ALL_SIZES },
    { name: "profile page: a friend's profile", mode: "friends", plain: true, globals: friendsGlobals(), search: { player: uid(1) }, sizes: ALL_SIZES },
    { name: "profile page: add a friend", mode: "friends", plain: true, globals: friendsGlobals(), search: { add: "1" }, sizes: ALL_SIZES },
    { name: "profile page: customise, avatar", mode: "customise", plain: true, globals: customiseGlobals(), waitMs: 800, sizes: ALL_SIZES },
    { name: "profile page: customise, card", mode: "customise", plain: true, globals: customiseGlobals(), go: tab("card"), sizes: ALL_SIZES },
    { name: "profile page light: an account, rated", mode: "profile", globals: { ...full, ...light }, waitMs: 1200, sizes: ALL_SIZES },
    { name: "profile page light: badges", mode: "badges", plain: true, globals: { ...full, ...light }, waitMs: 1000, sizes: ALL_SIZES },
    { name: "profile page light: friends list", mode: "friends", plain: true, globals: { ...friendsGlobals(), ...light }, sizes: ALL_SIZES },
  ];
};
