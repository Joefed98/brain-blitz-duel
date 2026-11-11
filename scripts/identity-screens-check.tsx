/**
 * identity-screens-check (wave 2, session A2; happy-dom, ~5 s): the five-tab bar, the coin counter, the player card,
 * Profile's card and Customise, against a stand-in for Session A1's interface (setIdentityBackend).
 *
 *  1. The Shop switch: off (as shipped) the tab bar is today's four for a guest and for any account but the
 *     preview list's (#0001), which gets five (Play, Practice, Tournaments, Shop, Profile); switched on, five for
 *     everyone (shopOnFor with the switch on; TabBar with `shop`). On every bottom-bar screen (the real PhoneShell on
 *     Play, Practice, Tournaments, Profile and, where it's on, Shop) and on the desktop rail, in both states (the
 *     switch on through the check-only window.__DUELZ_SHOP_TAB__).
 *  2. The coin counter: an account the Shop is on for sees A1's balance ("1,240") and a tap opens Shop > Coins; it is
 *     absent for a guest and for an account the switch is off for.
 *  3. The card: every card art, frame and name colour in the catalogue (docs/art/wave-2/catalogue.json) renders
 *     with no error and draws its own art (the item's markup, ids made unique per card); the sample player isn't
 *     part of any item; the Founding frame carries the card's own player number; the pill shows the player number
 *     (or "Guest") and never a rating; the art data is what scripts/player-card-art.ts builds; every animated
 *     class the items use has a prefers-reduced-motion rule stopping it (the browser half is
 *     identity-motion-check).
 *  4. Customise: equipping a card art, a frame and a name colour updates the preview and, once saved, Profile's
 *     card; a refused equip shows A1's message and leaves the preview and the Profile card as they were, and
 *     records equip_refused with the slot and the reason; customise_opened and profile_viewed are recorded.
 *     Locked items say where they come from; shop items are hidden while the Shop is off for the player.
 *  5. Guests: Profile's Customise opens the save-your-progress sheet, and /customise sends a guest to Profile.
 *  6. Profile shows no section without real data: no rating figure, no Puzzles and Arcade, strongest categories,
 *     trophy cabinet, mastery stars or practice challenges; the Joulz Rating says it arrives with rated play.
 *  7. The analytics rules (acceptIdentityEvent): the three events only, fixed words only; the list in
 *     ANALYTICS_EVENTS; the migration adds them to the table's list without writing the list out.
 *
 *   bun scripts/identity-screens-check.tsx
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

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

const tabLabels = () => $$("[data-app-tabbar] a").map((a) => (a.textContent ?? "").trim()).join(",");

/* ------------------------------------------------------------------ 1. the switch */
check(shopConfig.SHOP_TAB_ENABLED === false, "the Shop switch ships off (SHOP_TAB_ENABLED false until train D)");
check(shopConfig.SHOP_PREVIEW_PLAYERS.length === 1 && shopConfig.SHOP_PREVIEW_PLAYERS[0] === 1, "the preview list is Joe’s account alone (#0001)");
check(shopSwitch.shopOnFor(1) && !shopSwitch.shopOnFor(2) && !shopSwitch.shopOnFor(null) && !shopSwitch.shopOnFor(0), "off: on for #0001 only, never a guest");
check(
  shopSwitch.shopOnFor(null, { enabled: true, preview: [] }) && shopSwitch.shopOnFor(7, { enabled: true, preview: [] }),
  "on: on for every account and guest",
);
for (const [who, n, want] of [
  ["a guest", null, "Play,Practice,Tournaments,Profile"],
  ["account #0002", 2, "Play,Practice,Tournaments,Profile"],
  ["Joe’s account #0001", 1, "Play,Practice,Tournaments,Shop,Profile"],
] as const) {
  await signIn(n);
  const { root, went } = await mount(() => React.createElement(AppTabBar, { current: "play" }), "/");
  check(tabLabels() === want, `switch off, ${who}: tabs ${want} (got ${tabLabels()})`);
  check(!$("[data-app-tabbar] [data-tab='shop'] [data-badge], [data-app-tabbar] [data-tab='shop'] .jz-dot"), `${who}: no badge or dot on the Shop tab`);
  if (n === 1) {
    await click($("[data-app-tabbar] [data-tab='shop']"));
    await settle();
    check(went.some((w) => w.to === "/shop"), "#0001: the Shop tab opens /shop");
  }
  act(() => root.unmount());
}
{
  // Switched on for everyone: the bar draws five for anyone (TabBar's `shop`, which useShopOn sets).
  document.body.innerHTML = "<nav data-app-tabbar></nav>";
  const root = createRoot(document.querySelector("[data-app-tabbar]") as unknown as Element);
  await act(async () => root.render(React.createElement(TabBar, { variant: "bar", current: "shop", shop: true, onOpen: () => () => {} })));
  check(tabLabels() === "Play,Practice,Tournaments,Shop,Profile", "switch on: five tabs, Shop before Profile");
  check($("[data-tab='shop']")?.getAttribute("aria-current") === "page", "switch on: the Shop tab shows as current on /shop");
  act(() => root.unmount());
}

/* ------------------------------------------------------------------ 1b. every bottom-bar screen, both states */
{
  // The real shell (PhoneShell `tabs`) on each tab page; the desktop rail draws the same list (TabBar `rail`).
  const { PhoneShell } = await import("../src/components/duel/PhoneShell");
  const { AppRail } = await import("../src/components/app/AppRail");
  const setForced = (v: boolean | undefined) => ((window as unknown as { __DUELZ_SHOP_TAB__?: boolean }).__DUELZ_SHOP_TAB__ = v);
  const FOUR = "Play,Practice,Tournaments,Profile";
  const FIVE = "Play,Practice,Tournaments,Shop,Profile";
  const pages = ["play", "practice", "tournaments", "profile", "shop"] as const;
  const states = [
    { name: "switch off, a guest", n: null, forced: undefined, want: FOUR },
    { name: "switch off, account #0002", n: 2, forced: undefined, want: FOUR },
    { name: "switch off, preview #0001", n: 1, forced: undefined, want: FIVE },
    { name: "switch on, a guest", n: null, forced: true, want: FIVE },
    { name: "switch on, account #0002", n: 2, forced: true, want: FIVE },
  ] as const;
  for (const state of states) {
    setForced(state.forced);
    await signIn(state.n);
    for (const page of pages) {
      // The Shop page has a bottom bar only where the Shop is on (elsewhere /shop sends the player to Play).
      if (page === "shop" && state.want === FOUR) continue;
      const { root } = await mount(() => React.createElement(PhoneShell, { tabs: page, children: React.createElement("p", null, page) }), page === "play" ? "/" : `/${page}`);
      const bars = $$("[data-app-tabbar]").length;
      check(bars === 1 && tabLabels() === state.want, `${state.name}, ${page}: one bottom bar with ${state.want} (${bars} bar, ${tabLabels()})`);
      check($("[data-app-tabbar] [aria-current='page']")?.getAttribute("data-tab") === page, `${state.name}, ${page}: its own tab is current`);
      act(() => root.unmount());
    }
    const { root } = await mount(() => React.createElement(AppRail, { current: "play" }), "/");
    const rail = $$("[data-rail-tab]").map((a) => a.getAttribute("data-rail-tab")).join(",");
    check(rail === state.want.toLowerCase(), `${state.name}: the desktop rail has the same tabs (${rail})`);
    act(() => root.unmount());
  }
  setForced(undefined);
  check(shopSwitch.shopOverride() === null, "the check-only override is off unless a check sets it");
  // Production ignores both overrides: the function's first statement returns null when Vite's PROD (replaced with
  // true in a production build, so the rest is dropped; the built bundle names neither override).
  const switchSource = readFileSync("src/lib/identity/shopSwitch.ts", "utf8");
  const body = switchSource.slice(switchSource.indexOf("export function shopOverride"));
  const firstStatement = body.slice(body.indexOf("{") + 1).split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("//"));
  check(firstStatement === "if (import.meta.env.PROD) return null;", `the override returns null in a production build before reading anything (${firstStatement})`);
}

/* ------------------------------------------------------------------ 2. the coin counter */
for (const [who, n, shows] of [
  ["Joe’s account #0001", 1, true],
  ["account #0002 (switch off for it)", 2, false],
  ["a guest", null, false],
] as const) {
  await signIn(n);
  const { root, went } = await mount(() => React.createElement(CoinCounter), "/");
  await settle(80);
  const counter = $("[data-coin-counter]");
  check(Boolean(counter) === shows, `coin counter ${shows ? "shows" : "absent"} for ${who}`);
  if (shows) {
    check((counter?.textContent ?? "").includes("1,240"), `the counter shows A1’s balance 1,240 (got "${counter?.textContent}")`);
    await click(counter);
    await settle();
    const loc = went[went.length - 1];
    check(loc?.to === "/shop" && loc?.search?.["section"] === "coins", `a tap opens Shop > Coins (${JSON.stringify(loc)})`);
  }
  act(() => root.unmount());
}

{
  const header = readFileSync("src/components/app/AppHeader.tsx", "utf8");
  check(/<CoinCounter \/>/.test(header), "the tab pages’ header draws the coin counter");
}

/* The header: without the counter its markup is exactly the old one (the wordmark and the sound button, no wrapper),
   which celebrations-off.json pins; with it, the counter and the sound button sit in one group. */
for (const [who, n, shows] of [
  ["a guest", null, false],
  ["account #0002 (switch off for it)", 2, false],
  ["Joe’s account #0001", 1, true],
] as const) {
  await signIn(n);
  const { root } = await mount(() => React.createElement(AppHeader), "/");
  await settle(80);
  const header = $("[data-app-header]");
  const children = header ? [...header.children].map((c) => (c as unknown as HTMLElement).className || c.tagName) : [];
  if (shows) check(!!header?.querySelector(".ap-header-tools [data-coin-counter]"), `header, ${who}: the counter beside the sound button`);
  else
    check(
      !!header && header.children.length === 2 && !header.querySelector(".ap-header-tools, [data-coin-counter]"),
      `header, ${who}: the old markup, the wordmark and the sound button only (${children.join(" | ")})`,
    );
  act(() => root.unmount());
}

/* ------------------------------------------------------------------ 3. the card */
{
  const built = execFileSync("bun", ["scripts/player-card-art.ts", "--check"], { encoding: "utf8" });
  check(/up to date/.test(built), "the card art data is what scripts/player-card-art.ts builds from the item sources");
  const kinds = ["card-art", "frame", "name-colour"];
  const items = CATALOGUE.filter((r) => kinds.includes(r.kind));
  check(items.length === 52, `52 card arts, frames and name colours in the catalogue (${items.length})`);
  const missing = items.filter((r) => !(r.kind === "card-art" ? art.CARD_ARTS[r.id] : r.kind === "frame" ? art.FRAMES[r.id] : art.NAME_COLOURS[r.id]));
  check(missing.length === 0, `every catalogue item has its art (missing: ${missing.map((r) => r.id).join(", ") || "none"})`);
  const sample = /SkyRacer|Logician|Storm II|2,046|#0042/;
  const leaks = Object.entries({ ...art.CARD_ARTS, ...Object.fromEntries(Object.entries(art.FRAMES).map(([k, v]) => [k, v.markup])) }).filter(([, m]) => sample.test(m));
  check(leaks.length === 0, `no item carries the sample player (${leaks.map(([k]) => k).join(", ") || "none"})`);

  document.body.innerHTML = "<div id=cards></div>";
  const root = createRoot(document.getElementById("cards") as unknown as Element);
  const before = consoleErrors.length;
  await act(async () =>
    root.render(
      React.createElement(
        React.Fragment,
        null,
        ...items.map((r) =>
          React.createElement(PlayerCard, {
            key: r.id,
            look: {
              cardArt: r.kind === "card-art" ? r.id : null,
              frame: r.kind === "frame" ? r.id : null,
              nameColour: r.kind === "name-colour" ? r.id : null,
              avatar: { id: "apex", colour: 7, gem: null },
            },
            name: "TheInventor",
            playerNumber: 42,
          }),
        ),
      ),
    ),
  );
  const cards = $$("[data-player-card]");
  check(cards.length === items.length, `every item draws a card (${cards.length} of ${items.length})`);
  check(consoleErrors.length === before, `no errors drawing them (${consoleErrors.slice(before).join(" | ")})`);
  for (const r of items) {
    const sel = r.kind === "card-art" ? `[data-card-art="${r.id}"]` : r.kind === "frame" ? `[data-frame="${r.id}"]` : `[data-name-colour="${r.id}"]`;
    const card = $(sel);
    const svg = card?.querySelector("svg.pcard-svg");
    const drawn = (svg?.innerHTML.length ?? 0) > 200 && !!card?.querySelector(".pcard-av svg");
    check(Boolean(card && drawn), `${r.id}: the card draws its art and avatar`);
  }
  const ids = $$("[data-player-card] [id]").map((el) => el.getAttribute("id"));
  check(new Set(ids).size === ids.length, `ids are unique across ${cards.length} cards on one page (${ids.length - new Set(ids).size} repeated)`);
  check(($('[data-frame="frame.founding"]')?.innerHTML ?? "").includes("FOUNDER #0042"), "the Founding frame carries the card’s own player number");
  const pills = [...new Set($$("[data-card-pill]").map((p) => p.textContent))];
  check(pills.length === 1 && pills[0] === "#0042", `the pill shows the player number, no tier or rating (${pills.join(", ")})`);
  check(!document.body.textContent?.match(/rating|Storm|Volt|\b\d,\d{3}\b/i), "no card shows a rating or tier");
  // Every name colour keeps a dark edge (a black shadow or a dark stroke in its own style).
  const edgeless = Object.entries(art.NAME_COLOURS).filter(([, v]) => !/#000|rgba\(0,0,0|#06080F|rgba\(6,8,15|#0A1550|#1A2F9A|#C24E00/i.test(JSON.stringify(v.style)));
  check(edgeless.length === 0, `every name colour keeps a dark edge (${edgeless.map(([k]) => k).join(", ") || "all"})`);
  act(() => root.unmount());

  // Guest card.
  document.body.innerHTML = "<div id=g></div>";
  const g = createRoot(document.getElementById("g") as unknown as Element);
  await act(async () => g.render(React.createElement(PlayerCard, { look: { cardArt: null, frame: null, nameColour: null, avatar: null }, name: "Sam", playerNumber: null, guest: true })));
  check($("[data-card-pill]")?.textContent === "Guest", "a guest’s card says Guest in the pill");
  check($("[data-card-initial]")?.textContent === "S" && !$("[data-player-card] .pcard-av svg"), "a guest keeps colour plus initial (no avatar)");
  act(() => g.unmount());

  // Motion: every animated class the items use is stopped by a reduced-motion rule.
  const used = new Set<string>();
  for (const m of [...Object.values(art.CARD_ARTS), ...Object.values(art.FRAMES).map((f) => f.markup)].join(" ").matchAll(/class="([^"]+)"/g))
    for (const c of m[1]!.split(/\s+/)) used.add(c);
  for (const v of Object.values(art.NAME_COLOURS)) if (v.className) used.add(v.className);
  const css = art.CARD_MOTION_CSS;
  const reduced = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\)\{(.*?\})\}/g)].map((m) => m[1]!).join(" ");
  const animatedClasses = [...used].filter((c) => new RegExp(`\\.pcard \\.${c}\\{[^}]*animation:`).test(css));
  const unstopped = animatedClasses.filter((c) => !new RegExp(`\\.pcard \\.${c}[,{][^}]*?animation:none|\\.pcard \\.${c}[^{]*\\{[^}]*animation:none`).test(reduced) && !new RegExp(`\\.pcard \\.${c}[,][^{]*\\{animation:none`).test(reduced));
  check(animatedClasses.length >= 8, `the items’ animated classes are found (${animatedClasses.join(" ")})`);
  check(unstopped.length === 0, `every animated class stops under reduced motion (${unstopped.join(", ") || "all"})`);
  const animatedIds = [...art.ANIMATED_ITEMS];
  const wantAnimated = ["card-art.aurora", "card-art.diamond-plate", "card-art.neon-skyline", "card-art.neon-circuit", "frame.diamond", "frame.founding", "frame.top-500", "name-colour.prism", "name-colour.neon-flux"];
  check(wantAnimated.every((id) => animatedIds.includes(id)), "the Legendaries, Founding and Top 500 are marked animated");
  const moves = (id: string) => {
    const markup = art.CARD_ARTS[id] ?? art.FRAMES[id]?.markup ?? "";
    const cls = art.NAME_COLOURS[id]?.className ?? "";
    return animatedClasses.some((c) => markup.includes(c) || cls === c);
  };
  const still = [...wantAnimated, "frame.neon-circuit"].filter((id) => !moves(id));
  check(still.length === 0, `the Legendaries, the Neon Circuit frame, Founding and Top 500 animate (${still.join(", ") || "all"})`);
}

/* ------------------------------------------------------------------ 4. Customise and Profile */
{
  fake.owned = new Set(["frame.gold", "name-colour.gold-leaf"]);
  fake.slots = {};
  fake.avatar = null;
  fake.refuse = new Set();
  sent.length = 0;
  await signIn(2);
  const customise = CustomiseRoute.options.component as () => React.ReactElement;
  let { root } = await mount(customise, "/customise");
  await settle(80);
  check($("[data-customise]")?.getAttribute("data-customise") === "ready", `Customise opens for an account (${$("[data-customise]")?.getAttribute("data-customise")})`);
  check(sent.some((e) => e["event"] === "customise_opened"), "customise_opened is recorded");
  const preview = () => $("[data-player-card]")!;
  check(preview().getAttribute("data-avatar") === "captain-joulz" && $("[data-colour-choice='4']")?.getAttribute("aria-checked") === "true", "a new account starts with Captain Joulz in their colour");
  // Avatar tab: 32 avatars and colours, gems locked, owned-only lists empty.
  await click($("[data-avatars-all]"));
  check($$("[data-avatar-choice]").length === 32, `32 avatars (${$$("[data-avatar-choice]").length})`);
  check($$("[data-colour-choice]").length === 32, `32 colours (${$$("[data-colour-choice]").length})`);
  check($$("[data-gems-locked] [data-gem]").length === 10 && !($("[data-gems-locked]")?.textContent ?? "").match(/\d/), "the 10 gems show locked, with no star counts");
  check($$("[data-slot-empty]").length === 3, "finishes, accessory and special edition: the empty line with none owned");
  check($$("[data-avatar-option]").length === 0, "Captain Joulz: one accent and background, no features or accessories: no option rows (never an empty or one-choice picker)");
  // Card tab.
  await click($("[data-customise-tab='card']"));
  const choices = (slot: string) => $$(`[data-card-slot='${slot}'] [data-item-choice]`);
  const ownedArts = choices("card-art").filter((b) => !b.hasAttribute("data-locked"));
  check(ownedArts.length === 8, `the 8 free card arts are owned (${ownedArts.length})`);
  check(choices("card-art").every((b) => b.hasAttribute("data-locked") ? !/Shop/.test(b.textContent ?? "") : true), "Shop off for the player: no locked item says Shop");
  check(!choices("card-art").some((b) => b.getAttribute("data-item-choice") === "card-art.crimson"), "Shop off for the player: shop card arts are hidden");
  check(choices("card-art").some((b) => b.getAttribute("data-item-choice") === "card-art.neon-wave" && /Season 1 pass, level 32/.test(b.textContent ?? "")), "a pass item says where it comes from (Season 1 pass, level 32)");
  check(choices("frame").some((b) => b.getAttribute("data-item-choice") === "frame.gold" && !b.hasAttribute("data-locked")), "an owned shop frame is listed as owned");

  await click($("[data-item-choice='card-art.bolt-stripes']"));
  check(preview().getAttribute("data-card-art") === "card-art.bolt-stripes", "choosing a card art updates the preview");
  await click($("[data-card-slot='frame'] [data-item-choice='frame.gold']"));
  check(preview().getAttribute("data-frame") === "frame.gold", "choosing a frame updates the preview");
  await click($("[data-card-slot='name-colour'] [data-item-choice='name-colour.gold-leaf']"));
  check(preview().getAttribute("data-name-colour") === "name-colour.gold-leaf", "choosing a name colour updates the preview");
  const lockedClick = choices("card-art").find((b) => b.hasAttribute("data-locked"));
  await click(lockedClick ?? null);
  check(preview().getAttribute("data-card-art") === "card-art.bolt-stripes", "a locked item can’t be chosen");
  await click($("[data-customise-save]"));
  await settle(60);
  check(
    fake.calls.includes("equip card-art card-art.bolt-stripes") && fake.calls.includes("equip frame frame.gold") && fake.calls.includes("equip name-colour name-colour.gold-leaf"),
    `Save sends each change through equip() (${fake.calls.join("; ")})`,
  );
  check(!$("[data-customise-message]"), "nothing refused: no message");
  check(preview().getAttribute("data-frame") === "frame.gold", "after saving, the preview keeps the saved look");
  act(() => root.unmount());

  // Profile's card shows what was saved.
  ({ root } = await mount(() => React.createElement(ProfileCard, { guestName: "Player", guestColour: 0 }), "/profile"));
  await settle(60);
  const card = $("[data-profile-card] [data-player-card]");
  check(
    card?.getAttribute("data-card-art") === "card-art.bolt-stripes" && card?.getAttribute("data-frame") === "frame.gold" && card?.getAttribute("data-name-colour") === "name-colour.gold-leaf",
    `Profile’s card shows the equipped card art, frame and name colour (${card?.getAttribute("data-card-art")}, ${card?.getAttribute("data-frame")}, ${card?.getAttribute("data-name-colour")})`,
  );
  check(sent.some((e) => e["event"] === "profile_viewed" && e["who"] === "account"), "profile_viewed is recorded (account)");
  act(() => root.unmount());

  // A refused equip: the message, and nothing changes.
  fake.refuse = new Set(["frame"]);
  fake.owned.add("frame.obsidian");
  identityApi.resetIdentity();
  sent.length = 0;
  ({ root } = await mount(customise, "/customise"));
  await settle(80);
  await click($("[data-customise-tab='card']"));
  await click($("[data-card-slot='frame'] [data-item-choice='frame.obsidian']"));
  check(preview().getAttribute("data-frame") === "frame.obsidian", "the preview shows the frame chosen");
  await click($("[data-customise-save]"));
  await settle(60);
  check(($("[data-customise-message]")?.textContent ?? "").includes("You don’t own that yet."), `a refusal shows A1’s plain message (${$("[data-customise-message]")?.textContent})`);
  check(preview().getAttribute("data-frame") === "frame.gold", `a refused equip leaves the preview as it was (${preview().getAttribute("data-frame")})`);
  check(sent.some((e) => e["event"] === "equip_refused" && e["slot"] === "frame" && e["reason"] === "not_owned"), "equip_refused is recorded with the slot and the reason");
  act(() => root.unmount());
  ({ root } = await mount(() => React.createElement(ProfileCard, { guestName: "Player", guestColour: 0 }), "/profile"));
  await settle(60);
  check($("[data-profile-card] [data-player-card]")?.getAttribute("data-frame") === "frame.gold", "a refused equip leaves Profile’s card as it was");
  act(() => root.unmount());

  // An avatar change and its refusal.
  fake.refuse = new Set(["avatar"]);
  ({ root } = await mount(customise, "/customise"));
  await settle(80);
  await click($("[data-avatar-choice='gemstone']"));
  check(preview().getAttribute("data-avatar") === "gemstone", "choosing an avatar updates the preview");
  await click($("[data-customise-save]"));
  await settle(60);
  check(fake.calls.some((c) => c.startsWith("avatar gemstone")), "the avatar saves through setAvatar()");
  check(preview().getAttribute("data-avatar") === "captain-joulz", "a refused avatar leaves the card as it was");
  fake.refuse = new Set();
  await click($("[data-avatar-choice='gemstone']"));
  check($$("[data-avatar-option]").map((e) => e.getAttribute("data-avatar-option")).join() === "accent", "an avatar with two accents shows the accent row alone");
  await click($("[data-option-choice='gold']"));
  await click($("[data-colour-choice='12']"));
  await click($("[data-customise-save]"));
  await settle(60);
  check(
    fake.avatar?.id === "gemstone" && fake.avatar?.colour === 12 && fake.avatar?.gem === null && fake.avatar?.choices?.["accent"] === "gold",
    `setAvatar saves the avatar, colour, gem and accent (${JSON.stringify(fake.avatar)})`,
  );
  act(() => root.unmount());

  // #0001 with the Shop on: locked shop items say Shop.
  identityApi.resetIdentity();
  setAccount(ACCOUNT(1) as never, null);
  ({ root } = await mount(customise, "/customise"));
  await settle(80);
  await click($("[data-customise-tab='card']"));
  check(choices("card-art").some((b) => b.getAttribute("data-item-choice") === "card-art.crimson" && /Shop/.test(b.textContent ?? "")), "Shop on for the player: a shop card art shows locked, from the Shop");
  act(() => root.unmount());

  // The rules on their own.
  const rows = customiseRules.slotItems(CATALOGUE.map((r) => backendMod.normaliseItem(r)!), "frame", new Set(), false);
  check(rows.filter((r) => r.owned).map((r) => r.item.id).join() === "frame.plain", "frames: Plain is everyone’s");
  check(!rows.some((r) => r.item.source === "shop"), "frames: shop frames hidden with the Shop off");
}

/* ------------------------------------------------------------------ 5. guests */
{
  await signIn(null);
  const { root } = await mount(() => React.createElement(ProfileCard, { guestName: "Sam", guestColour: 3 }), "/profile");
  await settle(60);
  check($("[data-profile-card]")?.getAttribute("data-profile-card") === "guest", "a guest sees their guest card");
  check($("[data-profile-card] [data-card-initial]")?.textContent === "S", "the guest card shows their initial in their colour");
  check(sent.some((e) => e["event"] === "profile_viewed" && e["who"] === "guest"), "profile_viewed is recorded (guest)");
  await click($("[data-customise-open]"));
  await settle(60);
  check(!!$("[data-save-progress='sheet']"), "a guest’s Customise opens the save-your-progress sheet");
  check(!$("[data-at='/customise']"), "a guest’s Customise doesn’t open Customise");
  act(() => root.unmount());
  const customise = CustomiseRoute.options.component as () => React.ReactElement;
  const { root: r2, went } = await mount(customise, "/customise");
  await settle(80);
  check(went.some((w) => w.to === "/profile"), `a guest opening /customise is sent to Profile (${JSON.stringify(went)})`);
  act(() => r2.unmount());
}

/* ------------------------------------------------------------------ 6. Profile has only real data */
{
  const source = readFileSync("src/routes/profile.tsx", "utf8") + readFileSync("src/components/identity/ProfileCard.tsx", "utf8");
  for (const word of ["Strongest categories", "Trophy cabinet", "Mastery stars", "Puzzles and Arcade", "Season peak", "matches"]) {
    check(!source.includes(`>${word}<`) && !source.includes(`"${word}"`), `Profile draws no "${word}" section yet`);
  }
  await signIn(1);
  const { root } = await mount(() => React.createElement(ProfileCard, { guestName: "Player", guestColour: 0 }), "/profile");
  await settle(60);
  const text = $("[data-profile-card]")?.textContent ?? "";
  check(/Your Joulz Rating arrives with rated play\./.test(text), "the Joulz Rating says it arrives with rated play");
  check(!/\d/.test(text.replace("#0001", "")), `no figure on Profile’s card but the player number (${text})`);
  act(() => root.unmount());
}

/* ------------------------------------------------------------------ 7. analytics */
{
  const { acceptIdentityEvent } = await import("../src/lib/identity/identityEvents");
  const { ANALYTICS_EVENTS, CLIENT_EVENTS } = await import("../src/lib/analytics/events");
  check(["profile_viewed", "customise_opened", "equip_refused"].every((e) => (ANALYTICS_EVENTS as readonly string[]).includes(e)), "ANALYTICS_EVENTS lists the three");
  check(!["profile_viewed", "customise_opened", "equip_refused"].some((e) => (CLIENT_EVENTS as readonly string[]).includes(e)), "not phone-sendable through the analytics queue");
  check(JSON.stringify(acceptIdentityEvent({ event: "profile_viewed", who: "guest" })) === '{"event":"profile_viewed","props":{"who":"guest"}}', "profile_viewed: who only");
  check(acceptIdentityEvent({ event: "customise_opened" })?.props === null, "customise_opened: no props");
  check(acceptIdentityEvent({ event: "equip_refused", slot: "frame", reason: "not_owned" })?.props?.["reason"] === "not_owned", "equip_refused: slot and reason");
  for (const [bad, why] of [
    [{ event: "item_equipped" }, "an event that isn't one of the three"],
    [{ event: "profile_viewed", who: "Sam" }, "free text"],
    [{ event: "equip_refused", slot: "hat", reason: "x" }, "an unknown slot"],
    [{ event: "equip_refused", slot: "frame", reason: "You don’t own it" }, "a sentence as the reason"],
    [{ event: "customise_opened", score: 5 }, "an extra field"],
  ] as const)
    check(acceptIdentityEvent(bad) === null, `refused: ${why}`);
  const sql = readFileSync("supabase/migrations/20261110200000_analytics_identity_events.sql", "utf8");
  check(/'profile_viewed', 'customise_opened', 'equip_refused'/.test(sql) && /pg_get_constraintdef/.test(sql), "the migration adds the three to the list it reads from the table");
}

console.error = origError;
const passed = checks - failures.length;
console.log(`identity-screens-check: ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS");
process.exit(0);
