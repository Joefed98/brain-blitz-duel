/**
 * pass-screens-check (wave 2, session D2, 13 Nov 2026; happy-dom, ~3 s; docs/economy/pass.md): the Season pass's
 * screens draw the server's answer. The Pass part (both tracks level by level, the claim buttons on reachable levels
 * only, locks, the premium unlock as a clearly marked test purchase for a tester, "coming soon" for anyone else, this
 * week's three with progress and their Joules in lime), its closed states, the Play tab's pass card, and the results
 * Joules line drawing nothing where the pass is off. The server's own answer is proved by pass-check.
 */
import { readFileSync } from "node:fs";

let passes = 0;
const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else {
    failures.push(message);
    console.log(`FAIL ${message}`);
  }
};

const { Window } = await import("happy-dom");
const win = new Window({ url: "https://joulz.uk/", width: 390, height: 844 });
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "MouseEvent", "HTMLButtonElement", "HTMLAnchorElement", "SVGElement", "getComputedStyle", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame", "localStorage", "sessionStorage", "MutationObserver", "CustomEvent", "location", "history", "scrollTo", "DOMParser"] as const) {
  const value = (win as unknown as Record<string, unknown>)[key];
  const bind = typeof value === "function" && !/^[A-Z]/.test(key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: bind ? (value as (...a: unknown[]) => unknown).bind(win) : value });
}
Object.defineProperty(win.navigator, "webdriver", { configurable: true, value: true });
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const errors: string[] = [];
console.error = (...args: unknown[]) => {
  const text = args.map(String).join(" ");
  if (!/not wrapped in act|ReactDOMTestUtils/.test(text)) errors.push(text.slice(0, 300));
};

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } = await import("@tanstack/react-router");
const { setAccount } = await import("../src/lib/account/accountApi");
const api = await import("../src/lib/pass/passApi");
const rw = await import("../src/lib/pass/rewards");
const { PassScreen } = await import("../src/components/pass/PassScreen");
const { PassHomeCard } = await import("../src/components/pass/PassHomeCard");
const { JoulesLine } = await import("../src/components/pass/JoulesLine");
import type { PassCell, PassView } from "../src/lib/pass/types";

const $ = (sel: string) => document.querySelector(sel) as unknown as HTMLElement | null;
const $$ = (sel: string) => [...document.querySelectorAll(sel)] as unknown as HTMLElement[];
const settle = async (ms = 30) => act(async () => void (await new Promise((r) => setTimeout(r, ms))));

const KIND_OF = new Map(
  (JSON.parse(readFileSync("docs/art/wave-2/catalogue.json", "utf8")) as { items: { id: string; kind: string }[] }).items.map((i) => [i.id, i.kind]),
);

const USER = "u-7";
setAccount(
  { kind: "account", userId: USER, username: "Tester", colour: 4, playerNumber: 7, founding: true, country: null, createdAt: "2026-11-10T12:00:00.000Z", status: "active", isUnder18: false, deletion: null } as never,
  null,
);

function viewAt(level: number, premium: boolean, tester: boolean): PassView {
  const cell = (track: "free" | "premium", l: number): PassCell | null => {
    const r = rw.rewardAt(track, l);
    if (!r) return null;
    const label = rw.rewardLabel(r);
    const claimed = track === "free" && l === 2;
    return {
      track,
      level: l,
      kind: r.kind,
      title: label.title,
      detail: label.detail,
      rarity: null,
      itemId: r.kind === "item" ? r.item : null,
      itemKind: r.kind === "item" ? (KIND_OF.get(r.item) ?? null) : null,
      state: claimed ? "claimed" : rw.reached(track, l, level, premium) ? "claimable" : "locked",
      needsPremium: track === "premium" && !premium,
    };
  };
  const levels = Array.from({ length: 60 }, (_, i) => ({ level: i + 1, free: cell("free", i + 1), premium: cell("premium", i + 1) }));
  return {
    open: true,
    season: { id: "s1", name: "Neon Circuit", test: false, endsAt: null, daysLeft: 34, ended: false },
    joules: level * 1000 + 430,
    level,
    into: 430,
    of: 1000,
    premium: premium ? { source: "test" } : null,
    tester,
    levels,
    claimable: levels.reduce((n, l) => n + (l.free?.state === "claimable" ? 1 : 0) + (l.premium?.state === "claimable" ? 1 : 0), 0),
    weekly: {
      weekStart: "2026-11-16",
      challenges: [
        { id: "e1", tier: "easy", text: "Play the Daily Puzzle on 3 different days", joules: 500, done: 2, need: 3, completed: false },
        { id: "m2", tier: "medium", text: "Earn a star in any game", joules: 750, done: 1, need: 1, completed: true },
        { id: "h1", tier: "hard", text: "Score 180+ in 3 different Logic games", joules: 1250, done: 0, need: 3, completed: false },
      ],
    },
    levelNotice: null,
  };
}

async function mount(ui: () => React.ReactElement) {
  document.body.innerHTML = '<div id="root"></div>';
  const rootRoute = createRootRoute({ component: () => React.createElement(Outlet) });
  const routes = ["/", "/shop"].map((p) => createRoute({ getParentRoute: () => rootRoute, path: p, component: p === "/" ? ui : () => null }));
  const router = createRouter({ routeTree: rootRoute.addChildren(routes), history: createMemoryHistory({ initialEntries: ["/"] }) });
  (router as unknown as { _rendered?: unknown[] })._rendered ??= [];
  await router.load();
  const root = createRoot(document.getElementById("root")!);
  await act(async () => root.render(React.createElement(RouterProvider, { router } as never)));
  await settle(40);
  return root;
}

/* ------------------------------------------------------------------ the Pass part, level 12, a tester without premium */
api.standInPass(USER, { state: "open", view: viewAt(12, false, true) });
let root = await mount(() => React.createElement(PassScreen));
check($("[data-pass-screen]") !== null, "the Pass part draws");
check(($(".pass-season-name")?.textContent ?? "") === "Neon Circuit" && ($("[data-pass-days]")?.textContent ?? "") === "34 days left", "the season's name and days left");
check(($(".pass-level-now")?.textContent ?? "") === "Level 12" && ($(".pass-joules")?.textContent ?? "").includes("430 / 1,000 Joules"), "Level 12, 430 / 1,000 Joules");
check($$("[data-pass-level]").length === 60, "60 levels");
check($$("[data-track='free'][data-pass-cell]").length === 30 && $$("[data-track='premium'][data-pass-cell]").length === 60, "30 free and 60 premium rewards");
const claimFree = $$("[data-pass-claim^='free:']").map((b) => b.getAttribute("data-pass-claim"));
check(claimFree.join() === "free:4,free:6,free:8,free:10,free:12", `claim buttons on reached free levels only (${claimFree.join()})`);
check($$("[data-pass-claim^='premium:']").length === 0, "no premium claim without the premium track");
check($("[data-pass-cell='free:2']")?.getAttribute("data-state") === "claimed", "a claimed reward shows claimed");
check($("[data-pass-cell='free:14']")?.getAttribute("data-state") === "locked", "a level not reached shows a lock");
check(($("[data-pass-test-purchase]")?.textContent ?? "").includes("Test purchase") && ($(".pass-unlock .pass-note")?.textContent ?? "").includes("no payment"), "the premium unlock is a clearly marked test purchase for a tester");
check(($("[data-pass-cell='free:4'] .pass-cell-detail")?.textContent ?? "").includes("coming soon"), "tickets: for tournaments, coming soon");
check($$("[data-pass-weekly-id]").length === 3 && ($("[data-pass-weekly-id='e1'] .pass-week-detail")?.textContent ?? "") === "Easy · 2 / 3", "this week's three with progress");
check(($("[data-pass-weekly-id='h1'] .pass-week-joules")?.textContent ?? "") === "+1,250" && $("[data-pass-weekly-id='m2']")?.hasAttribute("data-done") === true, "their Joules and done state");
// Each reward's real picture (Joe, 11 Nov 2026): card arts and frames through the player card renderer, name colours
// as the player's name in the colour, every other item its approved still; coins, tickets and freezes their mark.
const art = (id: string) => $(`[data-pass-cell='${id}'] [data-pass-art]`);
check(art("free:6")?.getAttribute("data-pass-art") === "card" && art("free:6")?.querySelector("[data-piece='frame.bronze'] svg") !== null, "a frame: drawn by the player card renderer");
check(art("free:32")?.querySelector("[data-piece='card-art.neon-wave'] svg") !== null, "a card art: drawn by the player card renderer");
check(art("free:10")?.getAttribute("data-pass-art") === "name" && (art("free:10")?.textContent ?? "") === "Tester", "a name colour: the player's own name in it");
const previews = (await import("../src/lib/shop/shopPreviews.data")).SHOP_PREVIEWS;
const still = art("free:14")?.querySelector("img");
check(
  art("free:14")?.getAttribute("data-pass-art") === "still" &&
    (still?.getAttribute("src") ?? "").startsWith(`/shop/game-skin.crazy-golf.neon-glow.webp?v=${previews["game-skin.crazy-golf.neon-glow"]}`),
  "a game skin: its approved still",
);
const passItems = rw.PASS_REWARDS.filter((r) => r.reward.kind === "item").map((r) => (r.reward as { item: string }).item);
const notLive = passItems.filter((id) => !["card-art", "frame", "name-colour"].includes(KIND_OF.get(id) ?? ""));
check(notLive.length === 26 && notLive.every((id) => !!previews[id]), `every other pass item has its still (${notLive.filter((id) => !previews[id]).join(", ") || "all 26"})`);
check($$("[data-pass-art]").length === 40 && $$("[data-pass-art='still'] img").length === 26, "all 40 pass items show a picture");
check($("[data-pass-cell='free:2'] .pass-cell-glyph") !== null && $("[data-pass-cell='free:2'] [data-pass-art]") === null, "coins keep their mark");
await act(async () => root.unmount());

/* ------------------------------------------------------------------ premium bought; a non-tester */
api.standInPass(USER, { state: "open", view: viewAt(12, true, true) });
root = await mount(() => React.createElement(PassScreen));
check($$("[data-pass-claim^='premium:']").length === 12 && $("[data-pass-premium='test']") !== null, "premium bought: the passed premium rewards claimable, marked test");
await act(async () => root.unmount());
api.standInPass(USER, { state: "open", view: viewAt(3, false, false) });
root = await mount(() => React.createElement(PassScreen));
check($("[data-pass-test-purchase]") === null && $("[data-pass-premium-soon]") !== null, "a non-tester has no test purchase (Premium coming soon)");
await act(async () => root.unmount());
api.standInPass(USER, { state: "closed", reason: "no_season" });
root = await mount(() => React.createElement(PassScreen));
check($("[data-pass-closed='no_season']") !== null && document.body.textContent!.includes("The pass is coming"), "no season: the calm coming state");
await act(async () => root.unmount());

/* ------------------------------------------------------------------ the Home card */
api.standInPass(USER, { state: "open", view: viewAt(12, false, true) });
root = await mount(() => React.createElement(PassHomeCard, { eligible: true }));
check($("[data-pass-home='12']") !== null && ($(".pass-home-meta")?.textContent ?? "") === "5 to claim", "the Home card: level and rewards to claim");
check($("[data-pass-home]")?.getAttribute("href")?.includes("part=pass") === true, "it opens the Shop tab's Pass part");
await act(async () => root.unmount());
root = await mount(() => React.createElement(PassHomeCard, { eligible: false }));
check($("[data-pass-home]") === null, "not eligible and never seen a pass here: no card");
await act(async () => root.unmount());

/* ------------------------------------------------------------------ the Joules line where the pass is off */
root = await mount(() => React.createElement("div", { "data-host": "" }, React.createElement(JoulesLine, { sinceMs: Date.now() - 1000 })));
await settle(900);
check(($("[data-host]")?.innerHTML ?? "x") === "", "the Joules line draws nothing where the pass is off (no markup)");
await act(async () => root.unmount());

const css = readFileSync("src/polish-layout/pass.css", "utf8");
check(/\.joules-line\s*\{[^}]*color:\s*var\(--jz-joules\)/.test(css) && readFileSync("src/design/tokens.css", "utf8").includes("--jz-joules: #C6FF3D"), "Joules are electric lime (#C6FF3D, --jz-joules)");
check(errors.length === 0, `no console errors${errors.length ? `: ${errors[0]}` : ""}`);

console.log(`pass-screens-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: the pass's screens draw the server's answer.");
process.exit(0);
