/**
 * badges-screens-check (wave 2, session C2; happy-dom, ~5 s): the badge and title screens against a stand-in for the
 * server (setBadgesBackend) and A1's interface (setIdentityBackend), as identity-screens-check does.
 *
 *  1. Profile: the card shows the title (Rookie by default) and the card's badges; the collection lists all 54 in six
 *     groups, earned ones with their number, every locked one with how it is earned (never blank); a guest sees none.
 *  2. Customise, Badges and title: earned badges toggle onto the card (three at most, in order), locked titles can't be
 *     chosen, an unlocked one can; Save sends the card's badges and the title, and the preview shows them.
 *  3. The badge-earned moment: on a tab page it shows the unseen badge once and marks it shown; on any screen that
 *     isn't a tab page (a round, a reveal, results, podium, standings) it never appears, unseen badges or not.
 *
 *   bun scripts/badges-screens-check.tsx
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

/* ------------------------------------------------------------------ the page */
const { Window } = await import("happy-dom");
// A phone: the bottom bar (the desktop layout draws the rail instead).
const win = new Window({ url: "https://joulz.uk/", width: 390, height: 844 });
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "KeyboardEvent", "PointerEvent", "MouseEvent", "HTMLButtonElement", "HTMLAnchorElement", "SVGElement", "getComputedStyle", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame", "localStorage", "sessionStorage", "MutationObserver", "CustomEvent", "location", "history", "scrollTo", "DOMParser"] as const) {
  const value = (win as unknown as Record<string, unknown>)[key];
  const bind = typeof value === "function" && !/^[A-Z]/.test(key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: bind ? (value as (...a: unknown[]) => unknown).bind(win) : value });
}
Object.defineProperty(win.navigator, "webdriver", { configurable: true, value: true });
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
(win as unknown as { ResizeObserver: unknown }).ResizeObserver = (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// The events the screens would send (recordIdentityEvent reads this list in place of sending).
const sent: Record<string, unknown>[] = [];
(window as unknown as { __DUELZ_IDENTITY_EVENTS__: unknown[] }).__DUELZ_IDENTITY_EVENTS__ = sent;

const consoleErrors: string[] = [];
const origError = console.error;
console.error = (...args: unknown[]) => {
  const text = args.map(String).join(" ");
  // React's act() environment notes are not errors in the screens.
  if (!/not wrapped in act|ReactDOMTestUtils/.test(text)) consoleErrors.push(text.slice(0, 300));
};

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} = await import("@tanstack/react-router");

const { setAccount } = await import("../src/lib/account/accountApi");
const backendMod = await import("../src/lib/identity/backend");
const identityApi = await import("../src/lib/identity/identityApi");
const shopSwitch = await import("../src/lib/identity/shopSwitch");
const shopConfig = await import("../src/config/shopConfig");
const { AppTabBar } = await import("../src/components/app/AppTabBar");
const { CoinCounter } = await import("../src/components/app/CoinCounter");
const { AppHeader } = await import("../src/components/app/AppHeader");
const { TabBar } = await import("../src/design/components/TabBar");
const { PlayerCard } = await import("../src/design/identity");
const art = await import("../src/design/identity/playerCardArt.data");
const { ProfileCard } = await import("../src/components/identity/ProfileCard");
const { Route: CustomiseRoute } = await import("../src/routes/customise");
const customiseRules = await import("../src/lib/identity/customise");

const $ = (sel: string) => document.querySelector(sel) as unknown as HTMLElement | null;
const $$ = (sel: string) => [...document.querySelectorAll(sel)] as unknown as HTMLElement[];
const click = async (el: HTMLElement | null) => act(async () => void el?.click());
const settle = async (ms = 30) => act(async () => void (await new Promise((r) => setTimeout(r, ms))));

/* ------------------------------------------------------------------ A1's stand-in */
type Raw = { id: string; name: string; kind: string; rarity: string | null; source: string; pass_level: number | null; shop_price_coins: number | null; animated: boolean };
const CATALOGUE = (JSON.parse(readFileSync("docs/art/wave-2/catalogue.json", "utf8")) as { items: Raw[] }).items;

interface Fake {
  coins: number;
  owned: Set<string>;
  slots: Record<string, string | null>;
  avatar: { id: string; colour: number; gem: string | null; choices?: Record<string, string | null> } | null;
  refuse: Set<string>;
  options: Record<string, Record<string, { options: string[]; default: string | null }>>;
  calls: string[];
}
// A1's one-accent, one-background art (no features or accessories) for every avatar, and one made-up avatar with a
// real choice, so the check sees a row drawn only where there is more than one option.
const ONE = { accent: { options: ["cyan"], default: "cyan" }, feature: { options: [], default: null }, accessory: { options: [], default: null }, background: { options: ["scene"], default: "scene" } };
const fake: Fake = {
  coins: 1240,
  owned: new Set(),
  slots: {},
  avatar: null,
  refuse: new Set(),
  calls: [],
  options: { "captain-joulz": ONE, gemstone: { ...ONE, accent: { options: ["white", "gold"], default: "white" } } },
};
// A1's Loadout shape (src/lib/data/economy.ts on #360): the avatar's parts at the top level.
const loadout = () => ({
  slots: { "card-art": "card-art.joulz-navy", frame: "frame.plain", "name-colour": null, ...fake.slots },
  avatarId: fake.avatar?.id ?? "captain-joulz",
  colour: fake.avatar?.colour ?? 4,
  gem: fake.avatar?.gem ?? null,
  avatar: { accent: null, feature: null, accessory: null, background: null, ...fake.avatar?.choices },
  unlockedGems: [],
});
backendMod.setIdentityBackend({
  getCatalogue: async () => CATALOGUE.map((r) => backendMod.normaliseItem(r)!),
  getMyWallet: async () => ({ coins: fake.coins }),
  getMyInventory: async () => [...fake.owned],
  getMyLoadout: async () => loadout() as never,
  getAvatarOptions: async () => fake.options,
  equip: async (slot, itemId) => {
    fake.calls.push(`equip ${slot} ${itemId}`);
    if (fake.refuse.has(slot)) return { ok: false, reason: "not_owned", message: "You don’t own that yet." };
    fake.slots[slot] = itemId;
    return { ok: true, loadout: loadout() as never };
  },
  setAvatar: async (choice) => {
    fake.calls.push(`avatar ${choice.id} ${choice.colour} ${choice.gem} ${JSON.stringify(choice.choices ?? null)}`);
    if (fake.refuse.has("avatar")) return { ok: false, reason: "gem_locked", message: "That gem isn’t unlocked yet." };
    fake.avatar = { id: choice.id, colour: choice.colour, gem: choice.gem, choices: choice.choices };
    return { ok: true, loadout: loadout() as never };
  },
  getPublicCard: async () => null,
});

const ACCOUNT = (playerNumber: number, username = "TheInventor") =>
  ({
    kind: "account",
    userId: `u-${playerNumber}`,
    username,
    colour: 4,
    playerNumber,
    founding: true,
    country: null,
    createdAt: "2026-11-10T12:00:00.000Z",
    status: "active",
    isUnder18: false,
    deletion: null,
    rename: { free: true } as never,
  }) as const;

/** Publishes the account state the screens read (a guest through the module's own sign-out publish path). */
async function signIn(playerNumber: number | null) {
  identityApi.resetIdentity();
  if (playerNumber === null) {
    const mod = await import("../src/lib/account/accountApi");
    // A guest: the module's own guest state (no server call): refreshAccount with no session answers guest.
    (mod as unknown as { setGuestForChecks?: () => void }).setGuestForChecks?.();
    await act(async () => void (await mod.refreshAccount()));
  } else setAccount(ACCOUNT(playerNumber) as never, null);
}

/** Mounts `ui` in a router at `path` (other paths draw their name, so a navigation is visible). */
async function mount(ui: () => React.ReactElement, path: string, extra: Record<string, () => React.ReactElement> = {}) {
  document.body.innerHTML = "";
  const host = document.createElement("div");
  document.body.appendChild(host);
  const rootRoute = createRootRoute({ component: () => React.createElement(Outlet) });
  const paths = new Set([path, "/", "/practice", "/tournaments", "/shop", "/profile", "/customise", "/account", ...Object.keys(extra)]);
  const routes = [...paths].map((p) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: p,
      component: p === path ? ui : (extra[p] ?? (() => React.createElement("p", { "data-at": p }, p))),
    }),
  );
  const router = createRouter({ routeTree: rootRoute.addChildren(routes), history: createMemoryHistory({ initialEntries: [path] }) });
  // Under bun the router package resolves its server build, which never draws the Transitioner that starts this list.
  (router as unknown as { _rendered?: unknown[] })._rendered ??= [];
  await router.load();
  // The server build doesn't move its location on navigate: the screens' navigations are read from this list.
  const went: { to: string; search?: Record<string, unknown> }[] = [];
  (router as unknown as { navigate: (o: unknown) => Promise<void> }).navigate = async (o: unknown) => {
    went.push(o as { to: string; search?: Record<string, unknown> });
  };
  const root = createRoot(host as unknown as Element);
  await act(async () => {
    root.render(React.createElement(RouterProvider, { router } as never));
  });
  await settle(60);
  return { root, router, went };
}

/* ------------------------------------------------------------------ stand-ins */
const badgesApi = await import("../src/lib/badges/badgesApi");
const cat = await import("../src/lib/badges/catalogue");
const { BadgeCollection } = await import("../src/components/badges/BadgeCollection");
const { PhoneShell } = await import("../src/components/duel/PhoneShell");

backendMod.setIdentityBackend({
  getCatalogue: async () => CATALOGUE.map((r) => backendMod.normaliseItem(r)!),
  getMyWallet: async () => ({ coins: 1250 }),
  getMyInventory: async () => ["frame.founding"],
  getMyLoadout: async () => ({ slots: { "card-art": "card-art.joulz-navy", frame: "frame.plain", "name-colour": null }, avatarId: "captain-joulz", colour: 4, gem: null, avatar: { accent: null, feature: null, accessory: null, background: null }, unlockedGems: [] }) as never,
  getAvatarOptions: async () => ({}),
  equip: async () => ({ ok: true, loadout: null as never }),
  setAvatar: async () => ({ ok: true, loadout: null as never }),
  getPublicCard: async () => null,
});

const state = {
  earned: [{ slug: "founding-player", earnedAt: "2026-11-11T10:00:00Z", number: 42, seen: false }],
  card: [] as string[],
  title: "rookie",
  calls: [] as string[],
};
const view = () => ({
  account: true as const,
  earned: state.earned,
  card: state.card,
  title: state.title,
  unseen: state.earned.filter((e) => !e.seen).map((e) => e.slug),
  progress: { "daily-habit": 4, perfectionist: 3, flawless: 0 } as Record<string, number>,
});
badgesApi.setBadgesBackend({
  sync: async () => view(),
  setCard: async (badges) => {
    state.calls.push(`card ${badges.join("|")}`);
    if (badges.some((b) => !state.earned.some((e) => e.slug === b))) return { ok: false, reason: "not_earned", message: "You haven’t earned that yet." };
    state.card = badges;
    return { ok: true, badges: view() };
  },
  setTitle: async (title) => {
    state.calls.push(`title ${title}`);
    state.title = title ?? "rookie";
    return { ok: true, badges: view() };
  },
  markSeen: async (badges) => {
    state.calls.push(`seen ${badges.join("|")}`);
    state.earned = state.earned.map((e) => (badges.includes(e.slug) ? { ...e, seen: true } : e));
    return { ok: true };
  },
  dailyRecord: async () => ({ today: "2026-11-11", days: [], frozenDays: [], best: {}, totals: {}, streak: 0, playedToday: false, freezesUsed: [] }),
});

/* ------------------------------------------------------------------ 1. Profile */
{
  await signIn(42);
  badgesApi.resetBadges();
  const page = () => React.createElement("div", null, React.createElement(ProfileCard, { guestName: "Guest", guestColour: 1 }), React.createElement(BadgeCollection));
  const { root } = await mount(page, "/profile");
  await settle(80);
  check($("[data-card-title]")?.textContent === "Rookie", `the card shows Rookie by default (${$("[data-card-title]")?.textContent})`);
  const tiles = $$("[data-profile-badges] [data-badge]");
  check(tiles.length === 54, `the collection lists all 54 badges (${tiles.length})`);
  check($$("[data-badge-group]").length === 6, "in six groups");
  const lit = tiles.filter((t) => !t.hasAttribute("data-locked"));
  check(lit.length === 1 && lit[0]!.getAttribute("data-badge") === "founding-player" && /#0042/.test(lit[0]!.textContent ?? ""), "the earned badge is lit with its number");
  check(tiles.filter((t) => t.hasAttribute("data-locked")).every((t) => ($(`[data-badge='${t.getAttribute("data-badge")}'] [data-badge-how]`)?.textContent ?? "").trim().length > 0), "every locked badge says how it is earned (no hidden badges)");
  check(/Arrives with tournaments/.test($("[data-badge='knockout-champion']")?.textContent ?? ""), "a tournament badge says it arrives with tournaments");
  check($("[data-badge-count]")?.textContent === "1 of 54", `the count (${$("[data-badge-count]")?.textContent})`);
  check($("[data-badge='daily-habit'] [data-badge-progress]")?.textContent === "4 of 7 days", `a locked counted badge shows progress (${$("[data-badge='daily-habit'] [data-badge-progress]")?.textContent})`);
  check($("[data-badge='perfectionist'] [data-badge-progress]")?.textContent === "3 of 25 games" && !$("[data-badge='flawless'] [data-badge-progress]") && !$("[data-badge='founding-player'] [data-badge-progress]"), "progress only on counted badges, never on an earned one");
  check(/Play the Daily 7 days in a row\./.test($("[data-badge='daily-habit']")?.textContent ?? ""), "the rule is shown");
  check(!/announced soon/i.test(document.body.textContent ?? ""), "no badge says “announced soon”");
  await act(async () => root.unmount());

  await signIn(null);
  const guest = await mount(page, "/profile");
  await settle(60);
  check(!$("[data-profile-badges]") && !$("[data-card-title]"), "a guest sees no badges or title");
  await act(async () => guest.root.unmount());
}

/* ------------------------------------------------------------------ 3. the moment (before Customise marks things) */
{
  await signIn(42);
  badgesApi.resetBadges();
  state.earned = state.earned.map((e) => ({ ...e, seen: false }));
  // Not a tab page (a reveal, results, podium or standings all use PhoneShell without `tabs`): never shown.
  for (const props of [{ reveal: true }, { skin: "room" }, { play: true, gameScreen: true }, {}]) {
    const { root } = await mount(() => React.createElement(PhoneShell, { ...props, children: React.createElement("p", null, "results") } as never), "/room");
    await settle(80);
    check(!$("[data-badge-moment]"), `no badge moment off the tab pages (${JSON.stringify(props)})`);
    await act(async () => root.unmount());
  }
  check(!state.calls.some((c) => c.startsWith("seen")), "nothing marked shown off the tab pages");
  const { root } = await mount(() => React.createElement(PhoneShell, { tabs: "profile", children: React.createElement("p", null, "profile") } as never), "/profile");
  await settle(80);
  const moment = $("[data-badge-moment]");
  check(moment?.getAttribute("data-badge-moment") === "founding-player" && /\+250 coins/.test(moment.textContent ?? ""), `on a tab page the moment shows the badge and its coins (${moment?.textContent})`);
  await click(moment);
  await settle(30);
  check(!$("[data-badge-moment]") && state.calls.includes("seen founding-player"), "a tap closes it and marks it shown");
  await act(async () => root.unmount());
}

/* ------------------------------------------------------------------ 2. Customise */
{
  await signIn(42);
  badgesApi.resetBadges();
  state.calls.length = 0;
  const customise = CustomiseRoute.options.component as () => React.ReactElement;
  const { root } = await mount(customise, "/customise");
  await settle(80);
  await click($("[data-customise-tab='badges']"));
  await settle(30);
  check($$("[data-badge-choice]").length === 1, "only earned badges can be picked");
  check($("[data-badges-chosen]")?.textContent === "0 of 3 chosen", "0 of 3 chosen");
  await click($("[data-badge-choice='founding-player']"));
  check($("[data-badges-chosen]")?.textContent === "1 of 3 chosen" && $("[data-player-card] [data-card-badge='founding-player']") !== null, "a picked badge shows on the preview");
  check($$("[data-title-choice]").length === 32, `32 titles listed (${$$("[data-title-choice]").length})`);
  await click($("[data-title-choice='grand-master']"));
  check($("[data-title-choice='grand-master']")?.getAttribute("aria-checked") === "false" && $("[data-title-choice='grand-master']")?.hasAttribute("data-locked") === true, "a locked title can't be chosen");
  await click($("[data-title-choice='founding-player']"));
  check($("[data-player-card] [data-card-title]")?.textContent === "Founding Player", "an unlocked title shows on the preview");
  await click($("[data-customise-save]"));
  await settle(60);
  check(state.calls.includes("card founding-player") && state.calls.includes("title founding-player"), `Save sends the badges and the title (${state.calls.join("; ")})`);
  check(state.card.join() === "founding-player" && state.title === "founding-player", "saved");
  await act(async () => root.unmount());

  // The cap: four earned (a stand-in), three on the card at most.
  state.earned = ["founding-player", "first-win", "placed", "hot-streak"].map((slug, i) => ({ slug, earnedAt: `2026-11-1${i}T10:00:00Z`, number: slug === "founding-player" ? 42 : null, seen: true }));
  state.card = [];
  badgesApi.resetBadges();
  const again = await mount(customise, "/customise");
  await settle(80);
  await click($("[data-customise-tab='badges']"));
  for (const s of ["founding-player", "first-win", "placed", "hot-streak"]) await click($(`[data-badge-choice='${s}']`));
  check($("[data-badges-chosen]")?.textContent === "3 of 3 chosen" && $("[data-badge-choice='hot-streak']")?.getAttribute("aria-pressed") === "false", "three at most on the card");
  await act(async () => again.root.unmount());
}

check(consoleErrors.length === 0, `no console errors (${consoleErrors.slice(0, 2).join(" | ")})`);
console.error = origError;
console.log(`badges-screens-check: ${checks - failures.length} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS");
process.exit(0);
