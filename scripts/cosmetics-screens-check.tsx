/**
 * cosmetics-screens-check (wave 2, session E2; happy-dom, ~5 s): the screens that show the remaining cosmetics and
 * Joulz Plus, against stand-ins for the server (setPlusFns, setCosmeticsFetcher, setIdentityBackend).
 *
 *  1. The Shop's Plus part: a non-tester (Plus not open) keeps the calm "Joulz Plus is coming" card; a tester sees the
 *     offer (monthly and yearly, the perks, the later ones marked as coming) with "Test purchase" and its test note;
 *     the test purchase asks the server with the chosen plan and the member view follows; a member sees the PLUS
 *     chip switch (off) and the Daily archive; switched on for everyone, a non-tester sees "Coming soon", never a
 *     test purchase. The switch ships off.
 *  2. The PLUS chip: Profile draws it only for a member who turned it on (never by default, never for a guest).
 *  3. Room chat: the reaction row is today's six emoji for everyone; a second row of emotes appears only for a
 *     player who equipped reaction packs, and only theirs; a tap sends the emote's code through the same react().
 *  4. Customise: reactions, the win celebration, the podium entrance and the tile style list owned items only, and
 *     reactions hold at most four; with nothing owned, each says where they come from.
 *  5. Practice's early access: a held-back game leaves the list (the server holds it back too, plus-check).
 *
 *   bun scripts/cosmetics-screens-check.tsx
 */
const failures: string[] = [];
let checks = 0;
const check = (ok: boolean, message: string) => {
  checks++;
  if (!ok) {
    failures.push(message);
    console.log(`FAIL ${message}`);
  }
};

const { Window } = await import("happy-dom");
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
(window as unknown as { __DUELZ_IDENTITY_EVENTS__: unknown[] }).__DUELZ_IDENTITY_EVENTS__ = [];

const consoleErrors: string[] = [];
console.error = (...args: unknown[]) => {
  const text = args.map(String).join(" ");
  if (!/not wrapped in act|ReactDOMTestUtils/.test(text)) consoleErrors.push(text.slice(0, 300));
};

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } = await import("@tanstack/react-router");
const { setAccount } = await import("../src/lib/account/accountApi");
const plusApi = await import("../src/lib/plus/plusApi");
const plusConfig = await import("../src/config/plusConfig");
const store = await import("../src/lib/cosmetics/cosmeticsStore");
const backendMod = await import("../src/lib/identity/backend");
const identityApi = await import("../src/lib/identity/identityApi");
const { PlusPart } = await import("../src/components/plus/PlusPart");
const { ProfileCard } = await import("../src/components/identity/ProfileCard");
const { RoomChat } = await import("../src/components/duel/RoomChat");
const { NO_COSMETICS } = await import("../src/lib/cosmetics/types");

const $ = (sel: string) => document.querySelector(sel) as unknown as HTMLElement | null;
const $$ = (sel: string) => [...document.querySelectorAll(sel)] as unknown as HTMLElement[];
const click = async (el: HTMLElement | null) => act(async () => void el?.click());
const settle = async (ms = 30) => act(async () => void (await new Promise((r) => setTimeout(r, ms))));

const ACCOUNT = (playerNumber: number) =>
  ({
    kind: "account",
    userId: `u-${playerNumber}`,
    username: "TheInventor",
    colour: 4,
    playerNumber,
    founding: false,
    country: null,
    createdAt: "2026-11-10T12:00:00.000Z",
    status: "active",
    isUnder18: false,
    deletion: null,
    rename: { free: true },
  }) as const;

async function mount(ui: () => React.ReactElement) {
  document.body.innerHTML = "";
  const host = document.createElement("div");
  document.body.appendChild(host);
  const rootRoute = createRootRoute({ component: () => React.createElement(Outlet) });
  const routes = ["/", "/daily-archive", "/customise"].map((p) => createRoute({ getParentRoute: () => rootRoute, path: p, component: p === "/" ? ui : () => React.createElement("p", { "data-at": p }, p) }));
  const router = createRouter({ routeTree: rootRoute.addChildren(routes), history: createMemoryHistory({ initialEntries: ["/"] }) });
  (router as unknown as { _rendered?: unknown[] })._rendered ??= [];
  await router.load();
  const went: { to: string }[] = [];
  (router as unknown as { navigate: (o: unknown) => Promise<void> }).navigate = async (o: unknown) => {
    went.push(o as { to: string });
  };
  const root = createRoot(host as unknown as Element);
  await act(async () => {
    root.render(React.createElement(RouterProvider, { router } as never));
  });
  await settle(60);
  return { root, went };
}

type Status = Awaited<ReturnType<typeof plusApi.refreshPlus>>;
const status = (over: Partial<NonNullable<Status>>): NonNullable<Status> => ({
  open: false,
  tester: false,
  member: null,
  monthsPaid: 0,
  premiumPass: false,
  earlyAccess: [],
  ...over,
});
let server: NonNullable<Status> = status({});
const bought: string[] = [];
const marks: boolean[] = [];
plusApi.setPlusFns({
  plusStatusFn: (async () => server) as never,
  plusTestPurchaseFn: (async ({ data }: { data: { plan: string } }) => {
    bought.push(data.plan);
    server = status({ open: true, tester: true, member: { plan: data.plan as "monthly", test: true, startedAt: "2026-11-13T10:00:00Z", showMark: false }, monthsPaid: 1 });
    return { ok: true, status: server };
  }) as never,
  plusSetMarkFn: (async ({ data }: { data: { on: boolean } }) => {
    marks.push(data.on);
    return { ok: true };
  }) as never,
  dailyArchiveFn: (async () => ({ ok: true, days: [] })) as never,
  dailyArchiveStartFn: (async () => ({ ok: false, message: "no" })) as never,
  earlyAccessFn: (async () => ({ held: ["unblock"] })) as never,
});
const SOON = { title: "Joulz Plus is coming", body: "Everything Plus includes will show here when it launches." };

/* ------------------------------------------------------------------ 1. the Plus part */
check(plusConfig.PLUS_FOR_EVERYONE === false, "the Plus switch ships off (testers only until Season 1)");
setAccount(ACCOUNT(2) as never, null);
server = status({ open: false });
plusApi.setPlusFns({ ...(await currentFns()) });
let view = await mount(() => React.createElement(PlusPart, { soon: SOON }));
check(!!$('[data-shop-soon="plus"]') && !$("[data-plus-offer]") && !$("[data-plus-test-purchase]"), "a non-tester keeps the calm Plus card (no offer, no test purchase)");
view.root.unmount();

setAccount(ACCOUNT(1) as never, null);
server = status({ open: true, tester: true });
plusApi.setPlusFns({ ...(await currentFns()) });
view = await mount(() => React.createElement(PlusPart, { soon: SOON }));
check(!!$("[data-plus-offer]"), "a tester sees the Joulz Plus offer");
check(/£3\.99/.test($('[data-plus-plan="monthly"]')?.textContent ?? "") && /£34\.99/.test($('[data-plus-plan="yearly"]')?.textContent ?? "") && /Save 27%/.test($('[data-plus-plan="yearly"]')?.textContent ?? ""), "monthly £3.99 and yearly £34.99 (save 27%)");
const perks = $$("[data-plus-perks] li");
check(perks.length === 8 && perks.filter((p) => p.hasAttribute("data-later")).length === 3, "the board's perks, the three later ones marked as coming");
check(/200 coins every month/.test($("[data-plus-perks]")?.textContent ?? "") && /2 streak freezes a month/.test($("[data-plus-perks]")?.textContent ?? ""), "200 coins and 2 streak freezes a month");
check(/no payment is taken/.test($("[data-plus-test-note]")?.textContent ?? ""), "the test purchase says it is a test, with no payment");
await click($('[data-plus-plan="monthly"]'));
await click($("[data-plus-test-purchase]"));
await settle();
check(bought.join() === "monthly", "Test purchase asks the server with the chosen plan");
check(!!$('[data-plus-member="monthly"]') && /test purchase/.test($("[data-plus-member]")?.textContent ?? ""), "then the member view, marked as a test");
const toggle = $("[data-plus-mark-toggle]");
check(toggle?.getAttribute("aria-checked") === "false", "the PLUS chip is off by default");
await click(toggle);
await settle();
check(marks.join() === "true", "a member turns the PLUS chip on");
await click($("[data-plus-archive-open]"));
check(view.went.some((w) => w.to === "/daily-archive"), "the Daily archive opens from Plus");
view.root.unmount();

/* ------------------------------------------------------------------ 2. the PLUS chip on Profile */
for (const [label, s, want] of [
  ["a member with the chip off", status({ open: true, tester: true, member: { plan: "yearly", test: true, startedAt: "x", showMark: false } }), false],
  ["a member who turned it on", status({ open: true, tester: true, member: { plan: "yearly", test: true, startedAt: "x", showMark: true } }), true],
  ["a non-member", status({ open: true, tester: true }), false],
] as const) {
  server = s;
  plusApi.setPlusFns({ ...(await currentFns()) });
  view = await mount(() => React.createElement(ProfileCard, { guestName: "Guest", guestColour: 0 }));
  await settle();
  check(!!$("[data-plus-mark]") === want, `Profile's PLUS chip: ${label} → ${want ? "shown" : "none"}`);
  view.root.unmount();
}

/* ------------------------------------------------------------------ 3. room chat */
store.setCosmeticsFetcher(async (ids) =>
  ids.map((id) => ({ userId: id, ...NO_COSMETICS, reactions: id === "u-me" ? ["reaction.banter", "reaction.zap"] : [] })),
);
const sentReactions: string[] = [];
const chat = (open: boolean) =>
  ({
    messages: [],
    reactions: [],
    unread: 0,
    incoming: null,
    sheetOpen: open,
    setSheetOpen: () => undefined,
    sending: false,
    error: null,
    notice: null,
    send: async () => undefined,
    react: async (code: string) => void sentReactions.push(code),
    report: async () => undefined,
    mutedUserIds: [],
    toggleLocalMute: () => undefined,
  }) as never;
const players = [
  { user_id: "u-me", player_slot: 0, display_name: "Me" },
  { user_id: "u-them", player_slot: 1, display_name: "Them" },
] as never;
for (const [me, wantRow] of [["u-them", false], ["u-me", true]] as const) {
  store.resetCosmetics();
  view = await mount(() => React.createElement(RoomChat, { chat: chat(true), myUserId: me, players, available: true }));
  await settle(80);
  const emoji = document.querySelectorAll("[data-chat-reactions] button").length;
  const emotes = $$("[data-chat-emotes] button");
  check(emoji === 6, `the room's six emoji for everyone (${me})`);
  check(wantRow ? emotes.length === 5 : !$("[data-chat-emotes]"), wantRow ? `the owner's emotes: Banter's four and Zap (${emotes.length})` : "no emote row for a player with no packs");
  if (wantRow) {
    await click(emotes[2]!);
    check(sentReactions.at(-1) === "reaction.banter#2", "a tap sends the emote's code through react()");
  }
  view.root.unmount();
}
store.setCosmeticsFetcher(null);
store.resetCosmetics();

/* ------------------------------------------------------------------ 4. Customise's new sections */
type Item = { id: string; name: string; kind: string; rarity: string | null; source: string };
const catalogue = (JSON.parse((await import("node:fs")).readFileSync("docs/art/wave-2/catalogue.json", "utf8")) as { items: Item[] }).items.map((i) => ({
  ...i,
  rarity: i.rarity?.toLowerCase() ?? null,
  passLevel: null,
  shopPrice: null,
  animated: false,
}));
const owned = new Set(["reaction.banter", "reaction.zap", "reaction.spark", "reaction.clutch", "reaction.live-wire", "celebration.power-surge", "celebration.circuit-overload", "tile-style.blueprint"]);
const equipped: Record<string, string | null> = {};
backendMod.setIdentityBackend({
  getCatalogue: async () => catalogue as never,
  getMyWallet: async () => ({ coins: 0 }),
  getMyInventory: async () => [...owned],
  getMyLoadout: async () => ({ slots: { ...equipped }, avatar: { id: "captain-joulz", colour: 4, gem: null } }) as never,
  getAvatarOptions: async () => ({}),
  equip: async (slot: string, item: string | null) => {
    equipped[slot] = item;
    return { ok: true, loadout: { slots: { ...equipped }, avatar: { id: "captain-joulz", colour: 4, gem: null } } } as never;
  },
  setAvatar: async () => ({ ok: true, loadout: null }) as never,
  getPublicCard: async () => null,
});
identityApi.resetIdentity();
setAccount(ACCOUNT(1) as never, null);
const { Route: CustomiseRoute } = await import("../src/routes/customise");
view = await mount(CustomiseRoute.options.component as () => React.ReactElement);
await settle(120);
const section = (slot: string) => $(`[data-avatar-slot="${slot}"]`);
const chips = (slot: string) => [...(section(slot)?.querySelectorAll("[data-item]") ?? [])].map((c) => c.getAttribute("data-item"));
check(chips("reactions").sort().join() === "reaction.banter,reaction.clutch,reaction.live-wire,reaction.spark,reaction.zap", "Reactions: the owned packs only");
check(chips("celebration").join() === "celebration.power-surge", "Win celebration: the owned win celebrations only");
check(chips("podium-entrance").join() === "celebration.circuit-overload", "Podium entrance: Circuit Overload only");
check(chips("tile-style").join() === "tile-style.blueprint", "Practice tiles: the owned tile style");
for (const id of ["reaction.banter", "reaction.zap", "reaction.spark", "reaction.clutch", "reaction.live-wire"])
  await click(section("reactions")?.querySelector(`[data-item="${id}"]`) as unknown as HTMLElement);
check(/4 of 4/.test($("[data-reactions-chosen]")?.textContent ?? ""), "at most four reactions (the fifth isn't added)");
check($$("[data-reactions-preview] [data-emote]").length === 4 + 1 + 1 + 1, "the chosen packs' emotes previewed");
await click(section("tile-style")?.querySelector('[data-item="tile-style.blueprint"]') as unknown as HTMLElement);
await click($("[data-customise-save]"));
await settle(60);
check(equipped["tile-style"] === "tile-style.blueprint" && equipped["reaction-1"] === "reaction.banter" && equipped["reaction-4"] === "reaction.clutch", "Save equips them through A1's equip()");
view.root.unmount();

/* ------------------------------------------------------------------ 5. early access in Practice's list */
plusApi.setPlusFns({ ...(await currentFns()) });
let heldSeen: string[] = [];
function Probe() {
  heldSeen = plusApi.useEarlyAccessHeld();
  return null;
}
view = await mount(() => React.createElement(Probe));
await settle(60);
check(heldSeen.join() === "unblock", "Practice learns the games held back for this device");
view.root.unmount();
const practiceSrc = (await import("node:fs")).readFileSync("src/routes/practice.tsx", "utf8");
check(/matchesFilter\(key, side, filter, query\) && !heldBack\.includes\(key\)/.test(practiceSrc), "Practice's list leaves a held-back game out");

check(consoleErrors.length === 0, `no console errors (${consoleErrors.slice(0, 2).join(" | ")})`);

console.log(`cosmetics-screens-check: ${checks - failures.length} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS");
process.exit(0);

/** The stand-in functions as currently set (re-set to clear the status cache between screens). */
async function currentFns() {
  return {
    plusStatusFn: (async () => server) as never,
    plusTestPurchaseFn: (async ({ data }: { data: { plan: string } }) => {
      bought.push(data.plan);
      server = status({ open: true, tester: true, member: { plan: data.plan as "monthly", test: true, startedAt: "2026-11-13T10:00:00Z", showMark: false }, monthsPaid: 1 });
      return { ok: true, status: server };
    }) as never,
    plusSetMarkFn: (async ({ data }: { data: { on: boolean } }) => {
      marks.push(data.on);
      return { ok: true };
    }) as never,
    dailyArchiveFn: (async () => ({ ok: true, days: [] })) as never,
    dailyArchiveStartFn: (async () => ({ ok: false, message: "no" })) as never,
    earlyAccessFn: (async () => ({ held: ["unblock"] })) as never,
  };
}
