/**
 * customise-looks-check (12 Nov 2026; happy-dom, ~3 s): Customise's Games tab, where a player equips their card back,
 * each game's skin and each game's world theme, against a stand-in for A1's interface (setIdentityBackend) that keeps
 * one loadout for the account and refuses what the account doesn't own, as A1's server does. The real server,
 * database and renderers are customise-looks-db-check's.
 *
 *  1. The tab lists owned items only (a card back, skin or world theme the account doesn't own is never listed), the
 *     game's default first and always there, each choice with its picture (public/looks/<id>.webp, the default the
 *     game's tile); a game the account owns nothing for has no section; an account with nothing owned sees the card
 *     back's default alone and the line saying where looks come from.
 *  2. Equip each kind (the card back, a skin, a world theme): Save sends each through equip() with the look slot, the
 *     choice shows Equipped, and the live stage's look (src/lib/skins/equipped.ts, as the game reads it) has it.
 *  3. A reload (the identity and the stage's read forgotten, Customise mounted again) shows the saved choices.
 *  4. A second device (a second backend on the same account's loadout) reads the same looks.
 *  5. Unequip each kind: the default saves null in each slot and the game draws its default (NO_LOOK).
 *  6. Not owned: equipping an item the account doesn't own is refused with the server's message, the screen shows it,
 *     the choice goes back to what was saved, nothing is stored, and equip_refused is recorded with the look slot
 *     (an accepted, fixed-word slot).
 *
 *   bun scripts/customise-looks-check.tsx
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
const sent: Record<string, unknown>[] = [];
(window as unknown as { __DUELZ_IDENTITY_EVENTS__: unknown[] }).__DUELZ_IDENTITY_EVENTS__ = sent;

const consoleErrors: string[] = [];
const origError = console.error;
console.error = (...args: unknown[]) => {
  const text = args.map(String).join(" ");
  if (!/not wrapped in act|ReactDOMTestUtils/.test(text)) consoleErrors.push(text.slice(0, 300));
};

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } = await import("@tanstack/react-router");

const { setAccount } = await import("../src/lib/account/accountApi");
const backendMod = await import("../src/lib/identity/backend");
const identityApi = await import("../src/lib/identity/identityApi");
const { installGameLookSource } = await import("../src/lib/identity/gameLooks");
const equipped = await import("../src/lib/skins/equipped");
const { NO_LOOK } = await import("../src/lib/arcade/skins/look");
const { acceptIdentityEvent } = await import("../src/lib/identity/identityEvents");
const { LOOK_PREVIEWS } = await import("../src/lib/skins/lookPreviews.data");
const { Route: CustomiseRoute } = await import("../src/routes/customise");

const $ = (sel: string) => document.querySelector(sel) as unknown as HTMLElement | null;
const $$ = (sel: string) => [...document.querySelectorAll(sel)] as unknown as HTMLElement[];
const click = async (el: HTMLElement | null) => act(async () => void el?.click());
const settle = async (ms = 30) => act(async () => void (await new Promise((r) => setTimeout(r, ms))));

/* ------------------------------------------------------------------ A1's stand-in: one account's server-side loadout */
type Raw = { id: string; name: string; kind: string; rarity: string | null; source: string; pass_level: number | null; shop_price_coins: number | null; animated: boolean };
const CATALOGUE = (JSON.parse(readFileSync("docs/art/wave-2/catalogue.json", "utf8")) as { items: Raw[] }).items;
const LOOK_IDS = CATALOGUE.filter((r) => ["card-back", "game-skin", "world-theme"].includes(r.kind)).map((r) => r.id);

/** What the server holds for the account (shared by every "device"). */
const server = { owned: new Set<string>(), slots: {} as Record<string, string | null>, calls: [] as string[] };
/** The slot an item may sit in (A1's catalogue_items.slot: the kind, per game for skins and world themes). */
const GAME_OF: Record<string, string> = { apex: "racing", "crazy-golf": "minigolf", "cue-ball": "pool", "curl-champ": "curling", "full-house": "pokersquares", "top-bins": "freekick" };
const slotOf = (id: string) => (id.startsWith("card-back.") ? "card-back" : `${id.split(".")[0]}:${GAME_OF[id.split(".")[1]!]}`);
const loadout = () => ({
  slots: { "card-art": "card-art.joulz-navy", frame: "frame.plain", "name-colour": null, "card-back": null, ...server.slots },
  avatarId: "captain-joulz",
  colour: 4,
  gem: null,
  avatar: { accent: null, feature: null, accessory: null, background: null },
  unlockedGems: [],
});
const device = (): Parameters<typeof backendMod.setIdentityBackend>[0] => ({
  getCatalogue: async () => CATALOGUE.map((r) => backendMod.normaliseItem(r)!),
  getMyWallet: async () => ({ coins: 0 }),
  getMyInventory: async () => [...server.owned],
  getMyLoadout: async () => loadout() as never,
  getAvatarOptions: async () => ({}),
  equip: async (slot, itemId) => {
    server.calls.push(`equip ${slot} ${itemId}`);
    if (itemId !== null && !server.owned.has(itemId)) return { ok: false, reason: "not_owned", message: "You don’t own that yet." } as never;
    if (itemId !== null && slotOf(itemId) !== slot) return { ok: false, reason: "wrong_slot", message: "That doesn’t go there." } as never;
    server.slots[slot] = itemId;
    return { ok: true, loadout: loadout() as never };
  },
  setAvatar: async () => ({ ok: true, loadout: loadout() as never }),
  getPublicCard: async () => null,
});
backendMod.setIdentityBackend(device());
installGameLookSource();

const ACCOUNT = {
  kind: "account",
  userId: "u-1",
  username: "TheInventor",
  colour: 4,
  playerNumber: 1,
  founding: true,
  country: null,
  createdAt: "2026-11-10T12:00:00.000Z",
  status: "active",
  isUnder18: false,
  deletion: null,
  rename: { free: true },
} as const;

async function mount() {
  document.body.innerHTML = "";
  const host = document.createElement("div");
  document.body.appendChild(host);
  const rootRoute = createRootRoute({ component: () => React.createElement(Outlet) });
  const routes = ["/customise", "/profile", "/"].map((p) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: p,
      component: p === "/customise" ? (CustomiseRoute.options.component as () => React.ReactElement) : () => React.createElement("p", { "data-at": p }, p),
    }),
  );
  const router = createRouter({ routeTree: rootRoute.addChildren(routes), history: createMemoryHistory({ initialEntries: ["/customise"] }) });
  (router as unknown as { _rendered?: unknown[] })._rendered ??= [];
  await router.load();
  (router as unknown as { navigate: (o: unknown) => Promise<void> }).navigate = async () => undefined;
  const root = createRoot(host as unknown as Element);
  await act(async () => {
    root.render(React.createElement(RouterProvider, { router } as never));
  });
  await settle(80);
  await click($("[data-customise-tab='games']"));
  return root;
}
/** A reload: what the phone kept in memory is gone; the next read comes from the server. */
function forgetEverything() {
  identityApi.resetIdentity();
  equipped.forgetGameLooks();
}

const choices = (slot: string) => $$(`[data-look-slot='${slot}'] [data-look-choice]`).map((b) => b.getAttribute("data-look-choice"));
const on = (slot: string) => $(`[data-look-slot='${slot}'] [aria-checked='true']`)?.getAttribute("data-look-choice") ?? null;
const pickIn = async (slot: string, id: string) => click($(`[data-look-slot='${slot}'] [data-look-choice='${id}']`));
const save = async () => {
  await click($("[data-customise-save]"));
  await settle(60);
};

setAccount(ACCOUNT as never, null);

/* ------------------------------------------------------------------ 1. nothing owned */
{
  forgetEverything();
  const root = await mount();
  check($("[data-customise]")?.getAttribute("data-customise") === "ready", "Customise opens for an account");
  check(!!$("[data-customise-tab='games'][aria-checked='true']") || !!$("[data-look-section='card-back']"), "the Games tab opens");
  check(JSON.stringify(choices("card-back")) === '["default"]', `nothing owned: the card back's default alone (${choices("card-back").join(",")})`);
  check(on("card-back") === "default", "the default is equipped");
  check($$("[data-look-section]").length === 1, `nothing owned: no game section (${$$("[data-look-section]").map((s) => s.getAttribute("data-look-section")).join(",")})`);
  check(/shop or the season pass/.test($("[data-looks-note]")?.textContent ?? ""), "nothing owned: the line says where looks come from");
  act(() => root.unmount());
}

/* ------------------------------------------------------------------ 2. owned items listed, equipped, read by the game */
server.owned = new Set(["card-back.holo-foil", "game-skin.apex.molten-gold", "game-skin.cue-ball.pixel-pool", "world-theme.cue-ball.neon-table"]);
{
  forgetEverything();
  const root = await mount();
  check(JSON.stringify(choices("card-back")) === '["default","card-back.holo-foil"]', `the card backs: the default and the owned Holo Foil only (${choices("card-back").join(",")})`);
  check(JSON.stringify($$("[data-look-section]").map((s) => s.getAttribute("data-look-section"))) === '["card-back","racing","pool"]', `a section for each game with an owned look, in order (${$$("[data-look-section]").map((s) => s.getAttribute("data-look-section")).join(",")})`);
  check(JSON.stringify(choices("game-skin:racing")) === '["default","game-skin.apex.molten-gold"]', `Apex's skins: the default and Molten Gold (${choices("game-skin:racing").join(",")})`);
  check(!$("[data-look-slot='world-theme:racing']"), "Apex: no world row with no world theme owned");
  check(JSON.stringify(choices("game-skin:pool")) === '["default","game-skin.cue-ball.pixel-pool"]' && JSON.stringify(choices("world-theme:pool")) === '["default","world-theme.cue-ball.neon-table"]', "Cue Ball: its owned skin and world theme, each after the default");
  const listed = new Set($$("[data-look-choice]").map((b) => b.getAttribute("data-look-choice")));
  check(LOOK_IDS.filter((id) => listed.has(id)).every((id) => server.owned.has(id)), "only owned items are listed");
  check(LOOK_IDS.filter((id) => !server.owned.has(id)).every((id) => !listed.has(id)), "no unowned card back, skin or world theme is listed");
  // Each choice's picture: the item's still, or the game's tile for the default.
  const pics = $$("[data-look-choice]").map((b) => [b.getAttribute("data-look-choice"), b.querySelector("[data-look-preview] img")?.getAttribute("src") ?? ""] as const);
  check(
    pics.every(([id, src]) => (id === "default" ? /^\/tiles\/[a-z]+\.webp\?v=/.test(src) : src === `/looks/${id}.webp?v=${LOOK_PREVIEWS[id!]}`)),
    `every choice shows its picture (${pics.filter(([id, src]) => !(id === "default" ? /^\/tiles\//.test(src) : src.startsWith(`/looks/${id}`))).map(([id]) => id).join(",") || "all"})`,
  );
  check(LOOK_IDS.every((id) => typeof LOOK_PREVIEWS[id] === "string"), "every look item in the catalogue has a picture");
  {
    const { createHash } = await import("node:crypto");
    const { existsSync } = await import("node:fs");
    const stale = LOOK_IDS.filter((id) => {
      const file = `public/looks/${id}.webp`;
      return !existsSync(file) || createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 10) !== LOOK_PREVIEWS[id];
    });
    check(stale.length === 0, `every picture is on disk with the hash on its URL (bun scripts/look-previews.ts${stale.length ? `; stale: ${stale.join(", ")}` : ""})`);
  }

  server.calls.length = 0;
  await pickIn("card-back", "card-back.holo-foil");
  await pickIn("game-skin:racing", "game-skin.apex.molten-gold");
  await pickIn("game-skin:pool", "game-skin.cue-ball.pixel-pool");
  await pickIn("world-theme:pool", "world-theme.cue-ball.neon-table");
  await save();
  check(
    ["equip card-back card-back.holo-foil", "equip game-skin:racing game-skin.apex.molten-gold", "equip game-skin:pool game-skin.cue-ball.pixel-pool", "equip world-theme:pool world-theme.cue-ball.neon-table"].every((c) => server.calls.includes(c)),
    `Save sends each look through equip() with its slot (${server.calls.join("; ")})`,
  );
  check(!$("[data-customise-message]"), "nothing refused: no message");
  check(on("card-back") === "card-back.holo-foil" && on("game-skin:racing") === "game-skin.apex.molten-gold" && on("world-theme:pool") === "world-theme.cue-ball.neon-table", "after Save each saved choice shows equipped");
  check(/Equipped/.test($("[data-look-slot='card-back'] [aria-checked='true']")?.textContent ?? ""), "the equipped choice says Equipped");
  // The game: the live stage's look, as the stage reads it.
  const fh = await equipped.gameLookOf("pokersquares");
  const pool = await equipped.gameLookOf("pool");
  const apex = await equipped.gameLookOf("racing");
  check(fh.back === "card-back.holo-foil", `Full House's deck draws Holo Foil (${JSON.stringify(fh)})`);
  check(pool.skin === "game-skin.cue-ball.pixel-pool" && pool.world === "world-theme.cue-ball.neon-table", `Cue Ball draws its skin and world (${JSON.stringify(pool)})`);
  check(apex.skin === "game-skin.apex.molten-gold" && apex.world === null, `Apex draws its skin and the default world (${JSON.stringify(apex)})`);
  check((await equipped.gameLookOf("curling")) === NO_LOOK, "a game with nothing equipped draws its default");
  act(() => root.unmount());
}

/* ------------------------------------------------------------------ 3. a reload */
{
  forgetEverything();
  const root = await mount();
  check(on("card-back") === "card-back.holo-foil" && on("game-skin:racing") === "game-skin.apex.molten-gold" && on("game-skin:pool") === "game-skin.cue-ball.pixel-pool" && on("world-theme:pool") === "world-theme.cue-ball.neon-table", "after a reload Customise shows every saved choice");
  check((await equipped.gameLookOf("pokersquares")).back === "card-back.holo-foil", "after a reload the game still draws the saved card back");
  act(() => root.unmount());
}

/* ------------------------------------------------------------------ 4. a second device */
{
  forgetEverything();
  backendMod.setIdentityBackend(device());
  installGameLookSource();
  const root = await mount();
  check(on("card-back") === "card-back.holo-foil" && on("world-theme:pool") === "world-theme.cue-ball.neon-table", "a second device signed in to the account shows the same choices");
  check((await equipped.gameLookOf("pool")).world === "world-theme.cue-ball.neon-table", "and its games draw them");
  act(() => root.unmount());
}

/* ------------------------------------------------------------------ 5. unequip */
{
  forgetEverything();
  const root = await mount();
  server.calls.length = 0;
  for (const slot of ["card-back", "game-skin:racing", "game-skin:pool", "world-theme:pool"]) await pickIn(slot, "default");
  await save();
  check(["card-back", "game-skin:racing", "game-skin:pool", "world-theme:pool"].every((slot) => server.calls.includes(`equip ${slot} null`)), `the default saves an empty slot for each kind (${server.calls.join("; ")})`);
  check(["card-back", "game-skin:racing", "game-skin:pool", "world-theme:pool"].every((slot) => on(slot) === "default"), "the defaults show equipped");
  for (const game of ["pokersquares", "racing", "pool"] as const) check((await equipped.gameLookOf(game)) === NO_LOOK, `${game} draws its default again`);
  check(server.owned.has("card-back.holo-foil"), "unequipping keeps the item owned");
  act(() => root.unmount());
}

/* ------------------------------------------------------------------ 6. not owned */
{
  // The phone thinks it owns Royal Damask (a stale inventory: say a refund on another device); the server doesn't.
  forgetEverything();
  const stale = device();
  backendMod.setIdentityBackend({ ...stale, getMyInventory: async () => [...server.owned, "card-back.royal-damask"] });
  sent.length = 0;
  const root = await mount();
  check(choices("card-back").includes("card-back.royal-damask"), "(set-up) the stale inventory lists Royal Damask");
  await pickIn("card-back", "card-back.royal-damask");
  await save();
  check(server.calls.at(-1) === "equip card-back card-back.royal-damask", "the choice goes to the server");
  check(server.slots["card-back"] !== "card-back.royal-damask", "the server stores nothing it refused");
  check(/don’t own/.test($("[data-customise-message]")?.textContent ?? ""), `the refusal's message is shown (${$("[data-customise-message]")?.textContent})`);
  check(on("card-back") === "default", "the choice goes back to what was saved");
  const refused = sent.find((e) => e["event"] === "equip_refused");
  check(refused?.["slot"] === "card-back" && refused?.["reason"] === "not_owned", `equip_refused is recorded with the slot and reason (${JSON.stringify(refused)})`);
  check(acceptIdentityEvent(refused) !== null, "the server accepts that event (the look slots are fixed words)");
  check(acceptIdentityEvent({ event: "equip_refused", slot: "game-skin:snake", reason: "not_owned" }) === null, "a look slot for a game with no skins is refused");
  check((await equipped.gameLookOf("pokersquares")) === NO_LOOK, "the game draws its default");
  const direct = await identityApi.saveSlot("game-skin:pool", "game-skin.apex.molten-gold");
  check(!direct.ok && direct.reason === "wrong_slot", "an owned skin for another game is refused for this game's slot");
  act(() => root.unmount());
  backendMod.setIdentityBackend(device());
}

check(consoleErrors.length === 0, `no console errors (${consoleErrors.slice(0, 2).join(" | ")})`);
console.error = origError;
console.log(`customise-looks-check: ${checks - failures.length} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: Customise equips and unequips the card back, game skins and world themes from owned items, and the games draw them.");
process.exit(0);
