/**
 * profile-pages-check (the Profile session, phase 2 step 3, 14 Nov 2026; happy-dom, a few seconds): Profile's new
 * pieces against stand-ins for the server (the account, badges, rated status and friends).
 *
 *  1. The art: Profile's art-kit images on disk match scripts/profile-art.ts byte for byte.
 *  2. Ratings: the three tiles only for an account rated play is open to; nothing at all (no section, no note) for a
 *     guest or an account without rated play (the same rule as Home).
 *  3. The Badges row: the count and the earned badges newest first; See all opens /badges; nothing for a guest.
 *  4. The Friends strip: online friends first, at most eight, each opening their profile; See all opens Friends with
 *     the waiting count; a guest asks the server nothing and gets the save-your-progress sheet.
 *  5. The Badges page: the badges on the card with Choose (Customise's Badges and title tab) and every badge grouped
 *     with per-group counts; a guest is sent to Profile.
 *  6. The card page: the account's card large and Customise one tap away; a guest is sent to Profile.
 *  7. Profile's order (the style guide's profile.png; trimmed by Joe, 14 Nov 2026): card, Ratings, Mastery, Recent
 *     matches, Badges, Friends, Season peak and the trophy cabinet, Get started (until done); no Leaderboards links,
 *     challenges, Practice bests or Daily; a footer for guests only; the card opens the card page.
 *
 *   bun scripts/profile-pages-check.tsx
 */
import { readFileSync } from "node:fs";

const failures: string[] = [];
let checks = 0;
const check = (ok: boolean, message: string) => {
  checks++;
  if (!ok) {
    failures.push(message);
    console.log(`FAIL ${message}`);
  }
};

/* ------------------------------------------------------------------ 1. the art (before the DOM stand-in) */
{
  const run = Bun.spawnSync(["bun", "scripts/profile-art.ts", "--check"]);
  check(run.exitCode === 0, `Profile's art matches scripts/profile-art.ts (${run.stdout.toString().trim()})`);
}

const { Window } = await import("happy-dom");
const win = new Window({ url: "https://joulz.uk/", width: 390, height: 844 });
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "KeyboardEvent", "PointerEvent", "MouseEvent", "HTMLButtonElement", "HTMLAnchorElement", "HTMLInputElement", "SVGElement", "getComputedStyle", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame", "localStorage", "sessionStorage", "MutationObserver", "CustomEvent", "location", "history", "scrollTo", "DOMParser", "InputEvent"] as const) {
  const value = (win as unknown as Record<string, unknown>)[key];
  const bind = typeof value === "function" && !/^[A-Z]/.test(key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: bind ? (value as (...a: unknown[]) => unknown).bind(win) : value });
}
Object.defineProperty(win.navigator, "webdriver", { configurable: true, value: true });
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
(win as unknown as { ResizeObserver: unknown }).ResizeObserver = (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const origError = console.error;
console.error = () => {};
console.warn = () => {};

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } = await import("@tanstack/react-router");
const accountApi = await import("../src/lib/account/accountApi");
const { setFriendsFunctionsForChecks } = await import("../src/lib/friends/friendsApi");
const { setIdentityBackend } = await import("../src/lib/identity/backend");
const { setBadgesBackend } = await import("../src/lib/badges/badgesApi");
const ratedBackend = await import("../src/lib/rated/backend");
const ratedApi = await import("../src/lib/rated/ratedApi");
const { ProfileRatings } = await import("../src/components/identity/ProfileCard");
const { ProfileBadges } = await import("../src/components/profile/ProfileBadges");
const { ProfileFriends, FRIENDS_STRIP_MAX } = await import("../src/components/profile/ProfileFriends");
const { Route: BadgesRoute } = await import("../src/routes/badges");
const { Route: CardRoute } = await import("../src/routes/card");
const { BADGES } = await import("../src/lib/badges/catalogue");
const { PROFILE_BADGES, PROFILE_RATED } = await import("./screens/profile-fixture");

setIdentityBackend(null);

const $ = (sel: string) => document.querySelector(sel) as unknown as HTMLElement | null;
const $$ = (sel: string) => [...document.querySelectorAll(sel)] as unknown as HTMLElement[];
const click = async (el: HTMLElement | null) => act(async () => void el?.click());
const settle = async (ms = 30) => act(async () => void (await new Promise((r) => setTimeout(r, ms))));
const text = () => document.body.textContent ?? "";

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const ACCOUNT = {
  kind: "account",
  userId: uid(100),
  username: "Me_Here",
  colour: 4,
  playerNumber: 100,
  founding: false,
  country: null,
  createdAt: ago(0),
  status: "active",
  isUnder18: false,
  deletion: null,
  rename: { free: true },
} as const;

async function asGuest() {
  (accountApi as unknown as { setGuestForChecks?: () => void }).setGuestForChecks?.();
  await act(async () => void (await accountApi.refreshAccount()));
}
const asAccount = () => accountApi.setAccount(ACCOUNT as never, null);

/* The stand-ins: badges, rated status and friends. */
setBadgesBackend({
  sync: async () => PROFILE_BADGES as never,
  setCard: async () => ({ ok: true, badges: PROFILE_BADGES }) as never,
  setTitle: async () => ({ ok: true, badges: PROFILE_BADGES }) as never,
  markSeen: async () => ({ ok: true }),
  dailyRecord: async () => ({ busy: true }),
});
let ratedStatus: unknown = PROFILE_RATED;
const ratedStandIn = {
  status: async () => ratedStatus,
  search: async () => null,
  match: async () => null,
  result: async () => null,
  rematch: async () => ({ state: "closed" }),
  challenge: async () => ({ ok: false, message: "" }),
  ladder: async () => null,
  roomMatch: async () => null,
  opponentScore: async () => null,
  progress: async () => {},
};
const calls: string[] = [];
const friend = (n: number, username: string, status: unknown) => ({ id: uid(n), username, colour: n, playerNumber: n, founding: false, since: ago(1e9), status });
let friends: unknown[] = [
  friend(1, "Off_One", { kind: "offline", lastSeen: ago(3600_000) }),
  friend(2, "On_Two", { kind: "online" }),
  ...Array.from({ length: 9 }, (_, i) => friend(10 + i, `Off_${i}`, { kind: "offline", lastSeen: ago(7200_000) })),
  friend(3, "Room_Three", { kind: "room", code: "BLTZ", players: 3, maxPlayers: 16 }),
];
setFriendsFunctionsForChecks({
  friendsOverviewFn: async () => {
    calls.push("overview");
    return { ok: true, overview: { friends, incoming: [], outgoing: [], invites: [], challenges: [], blocked: [], count: friends.length, cap: 200, showOnline: true, showOnlineSetting: null, adult: true } };
  },
  friendsWaitingFn: async () => {
    calls.push("waiting");
    return 3;
  },
} as never);

async function mount(ui: () => React.ReactElement, path = "/profile") {
  document.body.innerHTML = "";
  const host = document.createElement("div");
  document.body.appendChild(host);
  const rootRoute = createRootRoute({ component: () => React.createElement(Outlet) });
  const paths = new Set([path, "/", "/profile", "/friends", "/badges", "/card", "/customise", "/tiers", "/account"]);
  const routes = [...paths].map((p) =>
    createRoute({ getParentRoute: () => rootRoute, path: p, component: p === path ? ui : () => React.createElement("p", { "data-at": p }, p) }),
  );
  const router = createRouter({ routeTree: rootRoute.addChildren(routes), history: createMemoryHistory({ initialEntries: [path] }) });
  (router as unknown as { _rendered?: unknown[] })._rendered ??= [];
  await router.load();
  const went: { to: string; search?: Record<string, unknown>; replace?: boolean }[] = [];
  (router as unknown as { navigate: (o: unknown) => Promise<void> }).navigate = async (o: unknown) => {
    went.push(o as { to: string });
  };
  const root = createRoot(host as unknown as Element);
  await act(async () => root.render(React.createElement(RouterProvider, { router } as never)));
  await settle(80);
  return { root, went };
}

/* ------------------------------------------------------------------ 2. Ratings */
{
  ratedBackend.setRatedBackend(ratedStandIn as never);
  asAccount();
  ratedApi.resetRated();
  let m = await mount(() => React.createElement(ProfileRatings));
  check($$("[data-profile-rating='placed'] .pf-tile").length === 3, "an account rated play is open to: three rating tiles");
  check($("[data-joulz-rating]")?.textContent === "1,278" && /Volt II/.test($("[data-open-tiers]")?.textContent ?? ""), "the Joulz Rating tile: the rating and its tier");
  check(/12 matches/.test($("[data-side='puzzles']")?.textContent ?? "") && $("[data-side='arcade'] .rt-side-value")?.textContent === "1,231", "Puzzles and Arcade tiles with their matches");
  await click($("[data-open-tiers]"));
  check(m.went.some((w) => w.to === "/tiers"), "the Joulz Rating tile opens the tiers");
  m.root.unmount();

  ratedStatus = { ...PROFILE_RATED, open: false };
  ratedApi.resetRated();
  m = await mount(() => React.createElement(ProfileRatings));
  check(!$("[data-profile-rating]") && !$("[data-rating-note]") && text() === "", "rated play not open: nothing at all (no section, no note)");
  m.root.unmount();

  ratedStatus = PROFILE_RATED;
  ratedApi.resetRated();
  await asGuest();
  m = await mount(() => React.createElement(ProfileRatings));
  check(text() === "", "a guest: no Ratings");
  m.root.unmount();
  ratedBackend.setRatedBackend(undefined);
  ratedApi.resetRated();
}

/* ------------------------------------------------------------------ 3. the Badges row */
{
  asAccount();
  let m = await mount(() => React.createElement(ProfileBadges));
  await settle(60);
  const shown = $$("[data-preview-badge]").map((b) => b.getAttribute("data-preview-badge"));
  check(shown[0] === "placed" && shown.length === PROFILE_BADGES.earned.length, `the earned badges, newest first (${shown.join(",")})`);
  check(new RegExp(`${PROFILE_BADGES.earned.length} of ${BADGES.length}`).test(text()), "the count of the whole collection");
  await click($("[data-profile-badges-open]"));
  check(m.went.some((w) => w.to === "/badges"), "See all opens the Badges page");
  m.root.unmount();
  await asGuest();
  m = await mount(() => React.createElement(ProfileBadges));
  check(!$("[data-profile-badge-preview]"), "a guest: no Badges row");
  m.root.unmount();
}

/* ------------------------------------------------------------------ 4. the Friends strip */
{
  calls.length = 0;
  await asGuest();
  let m = await mount(() => React.createElement(ProfileFriends));
  check(calls.length === 0, "a guest's strip asks the server nothing");
  await click($("[data-friends-open]"));
  await settle();
  check(!!$("[data-save-progress='sheet']") && !m.went.length, "a guest's Add friends opens the save-your-progress sheet");
  m.root.unmount();

  asAccount();
  m = await mount(() => React.createElement(ProfileFriends));
  await settle(60);
  const order = $$("[data-profile-friend]").map((b) => b.getAttribute("data-profile-friend"));
  check(order.length === FRIENDS_STRIP_MAX, `at most ${FRIENDS_STRIP_MAX} friends (${order.length})`);
  check(order[0] === uid(2) && order[1] === uid(3), "friends who are about first");
  check($("[data-friends-waiting]")?.textContent === "3", "See all carries the waiting requests");
  await click($(`[data-profile-friend='${uid(2)}']`));
  check(m.went.some((w) => w.to === "/friends" && w.search?.["player"] === uid(2)), "a friend opens their profile");
  await click($("[data-friends-open]"));
  check(m.went.some((w) => w.to === "/friends" && !w.search?.["player"]), "See all opens Friends");
  m.root.unmount();

  friends = [];
  m = await mount(() => React.createElement(ProfileFriends));
  await settle(60);
  await click($("[data-profile-friends-add]"));
  check(m.went.some((w) => w.to === "/friends" && w.search?.["add"] === "1"), "no friends yet: Add a friend");
  m.root.unmount();
}

/* ------------------------------------------------------------------ 5. the Badges page */
{
  asAccount();
  const page = BadgesRoute.options.component as () => React.ReactElement;
  let m = await mount(page, "/badges");
  await settle(80);
  check($("[data-badges-page]")?.getAttribute("data-badges-page") === "ready", "the Badges page draws for an account");
  check($("[data-badges-on-card]")?.getAttribute("data-badges-on-card") === PROFILE_BADGES.card.join(" "), "the badges on the card, in order");
  check($$("[data-badge-group]").length === 6 && $$("[data-profile-badges] [data-badge]").length === BADGES.length, "every badge, in its six groups");
  check($$("[data-badge-group] .bd-group-count").every((c) => /^\d+ of \d+$/.test(c.textContent ?? "")), "each group with its count");
  await click($("[data-badges-choose]"));
  check(m.went.some((w) => w.to === "/customise" && w.search?.["tab"] === "badges"), "Choose opens Customise's Badges and title tab");
  m.root.unmount();
  await asGuest();
  m = await mount(page, "/badges");
  check(m.went.some((w) => w.to === "/profile" && w.replace === true), "a guest is sent to Profile");
  m.root.unmount();
}

/* ------------------------------------------------------------------ 6. the card page */
{
  asAccount();
  const page = CardRoute.options.component as () => React.ReactElement;
  let m = await mount(page, "/card");
  await settle(80);
  check(!!$("[data-card-page='ready'] [data-player-card]") && /Me_Here/.test(text()), "the account's card, large");
  await click($("[data-card-customise]"));
  check(m.went.some((w) => w.to === "/customise"), "Customise is one tap away");
  m.root.unmount();
  await asGuest();
  m = await mount(page, "/card");
  check(m.went.some((w) => w.to === "/profile" && w.replace === true), "a guest is sent to Profile");
  m.root.unmount();
}

/* ------------------------------------------------------------------ 7. Profile's order and wiring (source) */
{
  const src = readFileSync("src/routes/profile.tsx", "utf8");
  const at = (needle: string) => src.indexOf(needle);
  const order = ["{wide ? null : cardColumn}", "<TrophyShelf", 'aria-label="Mastery stars"', "<ProfileRatings />", "data-profile-rows", 'aria-label="Recent matches"']; // Changed with Joe's approval, 22 Nov 2026
  check(order.every((n) => at(n) > 0) && order.every((n, i) => i === 0 || at(order[i - 1]!) < at(n)), "You's order: card, trophy shelf, gauges (Mastery stars), strongest categories, rows, Recent matches"); // Changed with Joe's approval, 22 Nov 2026
  check(!/data-profile-guest-name|maxLength=\{GUEST_NAME_MAX\}/.test(src), "You has no name box (names are typed where they're played, pre-filled)"); // Changed with Joe's approval, 22 Nov 2026
  // Joe, 14 Nov 2026: Profile is only about the player; the rest have their own homes.
  const tail = ['aria-label="Recent matches"', "<SeasonSection />", "<TrophyCabinet trophies={trophies} />", "data-get-started"]; // Changed with Joe's approval, 22 Nov 2026
  check(tail.every((n, i) => i === 0 || at(tail[i - 1]!) < at(n)), "then Season peak, the trophy cabinet and Get started, last"); // Changed with Joe's approval, 22 Nov 2026
  check(!/ProfileBoards|YourChallenges|ProfileChallenges|aria-label="Practice bests"|data-profile-daily/.test(src), "no Leaderboards links, Your challenges, Practice challenges, Practice bests or Daily on Profile");
  check(/doneCount < steps\.length/.test(src), "Get started only until all three steps are done");
  check(/\{accountName \? null : \(\s*<div data-profile-footer/.test(src) && /Saved on this phone\. Create an account to keep it everywhere\./.test(src), "a footer for guests only");
  check(/data-open-settings/.test(src), "the settings gear stays in the header");
  const card = readFileSync("src/components/identity/ProfileCard.tsx", "utf8");
  check(/to: "\/card"/.test(card) && /data-customise-open/.test(card), "the card opens the card page; Customise card beside it");
}

console.error = origError;
console.log(`profile-pages-check: ${checks - failures.length} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS");
process.exit(0);
