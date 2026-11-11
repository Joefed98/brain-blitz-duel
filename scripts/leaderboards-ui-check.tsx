/**
 * leaderboards-ui-check (wave 4, session W4a; happy-dom, a few seconds): the leaderboard screens against a stand-in
 * for the server functions (setLeaderboardFunctionsForChecks). The rules themselves (order, ties, privacy, the Daily's
 * eligibility, the badges) are leaderboards-check's (PostgreSQL); here the screens show exactly what the server sent.
 *
 *  1. Leaderboards (mockup 01): Joulz Rating / Puzzles / Arcade, Global / your country / Friends, This season ⇄
 *     All-time; medals for 1st–3rd, a shared place marked, "Top 500 #n" with its emblem, a hidden player as "Hidden
 *     player" in their place with no disc colour, your own row pinned below in gold when it isn't in the list, Show more
 *     asks for the next page; each switch asks the server for that board.
 *  2. A guest's Friends board is the account gate and asks nothing.
 *  3. The Daily top 100 (mockup 02): "You came 118th of 118", time and score per row, your row pinned, the day's
 *     arrows walk to the days the server names, the friends chip, a closed board until you finish.
 *  4. Category boards ("Top Logic players") on Profile for an account; a guest's Profile has only the two links.
 *  5. "Show me on leaderboards" sends the setting.
 *  6. Cards (Joe's rule, 11 Nov 2026): each visible row is the player's nameplate strip (card art, frame, name colour,
 *     tier emblem, badges) with places and scores outside it; a hidden player has no card and opens nothing; the top 3
 *     as full cards above the rows (1st in the middle from 700 px); a tap opens the full card; one call per board.
 *
 *   bun scripts/leaderboards-ui-check.tsx
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
const { setAccount } = await import("../src/lib/account/accountApi");
const { setLeaderboardFunctionsForChecks } = await import("../src/lib/leaderboards/leaderboardsApi");
const screens = await import("../src/components/leaderboards/LeaderboardScreens");
const { ProfileBoards } = await import("../src/components/leaderboards/ProfileBoards");

const $ = (sel: string) => document.querySelector(sel) as unknown as HTMLElement | null;
const $$ = (sel: string) => [...document.querySelectorAll(sel)] as unknown as HTMLElement[];
const click = async (el: HTMLElement | null) => act(async () => void el?.click());
const settle = async (ms = 30) => act(async () => void (await new Promise((r) => setTimeout(r, ms))));
const text = () => document.body.textContent ?? "";

/* ------------------------------------------------------------------ the stand-in */
type Row = Record<string, unknown>;
const row = (rank: number, value: number, name: string | null, extra: Row = {}): Row => ({
  rank,
  value,
  isMe: false,
  isFriend: false,
  hidden: name === null,
  deleted: false,
  name,
  colour: name === null ? null : rank % 32,
  playerNumber: name === null ? null : rank,
  ...extra,
});
const calls: { fn: string; data: Record<string, unknown> }[] = [];
const ratingPage = (data: Record<string, unknown>) => {
  const offset = Number(data["offset"] ?? 0);
  if (data["board"] === "logic")
    return { ready: true, rows: [row(1, 2100, null), row(2, 1900, "Cee"), row(3, 1800, "Me_Here", { isMe: true })], me: row(3, 1800, "Me_Here", { isMe: true }), total: 3, country: "GB" };
  if (offset > 0) return { ready: true, rows: Array.from({ length: 50 }, (_, i) => row(51 + i, 2000 - i, `Fill_${i}`)), me: null, total: 120, country: "GB" };
  return {
    ready: true,
    rows: [
      row(1, data["period"] === "peak" ? 3200 : 3104, "Nova", { top500: 1 }),
      row(2, 3061, null, { top500: 2 }),
      row(3, 2987, "Mira_K", { top500: 3 }),
      row(3, 2987, "Dex", { top500: 3 }),
      row(5, 2918, "Sam", { isFriend: true }),
      ...Array.from({ length: 45 }, (_, i) => row(6 + i, 2900 - i, `Fill_${i}`)),
    ],
    me: row(4812, 1278, "Me_Here", { isMe: true }),
    total: 120,
    country: "GB",
  };
};
const dailyPage = (data: Record<string, unknown>) => {
  if (data["scope"] === "friends") return { exists: true, day: data["day"], players: 118, final: true, open: true, rows: [row(1, 1176, "Sam", { isFriend: true, timeMs: 271_000 }), row(2, 694, "Me_Here", { isMe: true, timeMs: 400_000 })], me: null, meReason: null, prevDay: "2026-11-06", nextDay: null };
  if (data["day"] === "2026-11-06") return { exists: true, day: "2026-11-06", players: 3, final: true, open: true, rows: [row(1, 900, "Ivy", { timeMs: 200_000 })], me: null, meReason: "not_played", prevDay: null, nextDay: "2026-11-07" };
  return {
    exists: true,
    day: data["day"],
    players: 118,
    final: false,
    open: true,
    rows: [row(1, 1184, "Ivy", { timeMs: 252_000 }), row(2, 1176, "Nova", { timeMs: 271_000 }), row(3, 1171, null, { timeMs: 245_000 }), ...Array.from({ length: 97 }, (_, i) => row(4 + i, 1100 - i, `Fill_${i}`, { timeMs: 300_000 }))],
    me: row(118, 694, "Me_Here", { isMe: true, timeMs: 400_000 }),
    meReason: null,
    prevDay: "2026-11-06",
    nextDay: null,
  };
};
let visibility = { show: false, setting: null as boolean | null, adult: false };
setLeaderboardFunctionsForChecks({
  ratingBoardFn: (async ({ data }: { data: Record<string, unknown> }) => {
    calls.push({ fn: "rating", data });
    if (data["scope"] === "friends") return { ok: true, page: { ready: true, rows: [row(1, 2918, "Sam", { isFriend: true }), row(2, 1278, "Me_Here", { isMe: true })], me: row(2, 1278, "Me_Here", { isMe: true }), total: 2 } };
    return { ok: true, page: ratingPage(data) };
  }) as never,
  dailyTopBoardFn: (async ({ data }: { data: Record<string, unknown> }) => {
    calls.push({ fn: "daily", data });
    return { ok: true, page: dailyPage(data) };
  }) as never,
  boardVisibilityFn: (async () => ({ ok: true, visibility })) as never,
  setBoardVisibilityFn: (async ({ data }: { data: { show: boolean | null } }) => {
    calls.push({ fn: "setVisibility", data });
    visibility = { ...visibility, show: data.show === true, setting: data.show };
    return { ok: true, visibility };
  }) as never,
});

async function mount(ui: React.ReactElement) {
  document.body.innerHTML = "";
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host as unknown as Element);
  await act(async () => root.render(ui));
  await settle(60);
  return root;
}

/* ------------------------------------------------------------------ 1. the rating boards */
{
  const root = await mount(React.createElement(screens.RatingBoardsScreen, { onBack: () => {}, isAccount: true }));
  check(calls.some((c) => c.fn === "rating" && c.data["board"] === "joulz" && c.data["scope"] === "global" && c.data["period"] === "season"), "opens on the Joulz Rating, global, this season");
  const rows = $$("[data-leaderboards-screen] > [data-board-list] > ol:first-child > li");
  check(rows.length === 50, `the page's rows (${rows.length})`);
  check(!!rows[0]?.querySelector('[data-medal="1"]') && !!rows[2]?.querySelector('[data-medal="3"]') && rows[5]?.textContent?.includes("6") === true, "medals for 1st–3rd, numbers after");
  check(!!rows[2]?.querySelector("[data-shared]") && !!rows[3]?.querySelector("[data-shared]"), "a shared place is marked on both rows");
  check(rows[0]?.querySelector("[data-top500]")?.textContent === "Top 500 #1" && !!rows[0]?.querySelector('img[src="/art/emblems/top-500.svg"]'), "Top 500 #1 with its emblem");
  check(rows[1]?.hasAttribute("data-hidden-player") === true && rows[1]?.textContent?.includes("Hidden player") === true && !!rows[1]?.querySelector("[data-hidden-disc]") && rows[1]?.textContent?.includes("3,061") === true, "a hidden player in their place: “Hidden player”, a plain disc, the rating kept");
  check(rows[4]?.textContent?.includes("Sam (friend)") === true, "a friend is marked");
  const pinned = $("[data-board-pinned] li");
  check(!!pinned && pinned.hasAttribute("data-pinned") && pinned.textContent?.includes("4,812") === true && pinned.textContent?.includes("Me_Here (you)") === true, "your own row pinned below the list");
  await click($("[data-board-more]"));
  await settle();
  check(calls.some((c) => c.fn === "rating" && c.data["offset"] === 50) && $$("[data-leaderboards-screen] > [data-board-list] > ol:first-child > li").length === 100, "Show more asks for the next page and adds it");
  await click($("[data-period]"));
  await settle();
  check(calls.some((c) => c.fn === "rating" && c.data["period"] === "peak") && $("[data-period]")?.textContent === "All-time", "This season ⇄ All-time");
  await click($('[data-board="arcade"]'));
  await settle();
  check(calls.some((c) => c.fn === "rating" && c.data["board"] === "arcade"), "the Arcade board");
  await click($('[data-scope="country"]'));
  await settle();
  check(calls.some((c) => c.data["scope"] === "country") && $('[data-scope="country"]')?.textContent === "UK", "the country chip reads UK for GB");
  await click($('[data-scope="friends"]'));
  await settle();
  check($$("[data-leaderboards-screen] > [data-board-list] li").length === 2 && !$("[data-board-pinned]"), "the friends board, no pin when you're in the list");
  check(!!$('[data-category-boards="logic"]'), "Top players by category on the leaderboards page");
  root.unmount();
}

/* ------------------------------------------------------------------ 2. a guest's friends board */
{
  calls.length = 0;
  const root = await mount(React.createElement(screens.RatingBoardsScreen, { onBack: () => {}, isAccount: false, initial: { scope: "friends" } }));
  check(text().includes("Friends boards need an account") && !calls.some((c) => c.fn === "rating" && c.data["scope"] === "friends"), "a guest's Friends board is the account gate and asks nothing");
  root.unmount();
}

/* ------------------------------------------------------------------ 3. the Daily top 100 */
{
  calls.length = 0;
  const went: string[] = [];
  const root = await mount(
    React.createElement(screens.DailyBoardScreen, { onBack: () => {}, isAccount: true, kind: "puzzle", day: "2026-11-07", today: "2026-11-07", onKindDay: (k: string, d: string) => went.push(`${k}:${d}`) }),
  );
  check(calls.some((c) => c.fn === "daily" && c.data["kind"] === "puzzle" && c.data["day"] === "2026-11-07" && c.data["scope"] === "top100"), "asks for today's Daily Puzzle top 100");
  check($(".lb-day-title")?.textContent === "Today, Sat 7 Nov", `the day's heading (${$(".lb-day-title")?.textContent})`);
  check($("[data-daily-summary]")?.textContent?.includes("You came 118th of 118") === true && $("[data-daily-summary]")?.textContent?.includes("694, top 100%") === true, "You came 118th of 118 · 694, top 100%");
  const rows = $$("[data-leaderboards-screen] > [data-board-list] > ol:first-child > li");
  check(rows.length === 100 && rows[0]?.querySelector(".lb-time")?.textContent === "4:12" && rows[0]?.querySelector(".lb-value")?.textContent === "1,184", "100 rows with time and score");
  check(rows[2]?.textContent?.includes("Hidden player") === true, "privacy as sent");
  check($("[data-board-pinned]")?.textContent?.includes("6:40") === true && text().includes("…"), "your own row pinned below, after a gap");
  check($("[data-day-next]")?.hasAttribute("disabled") === true, "no next day after today");
  await click($("[data-day-prev]"));
  await settle();
  check(calls.some((c) => c.fn === "daily" && c.data["day"] === "2026-11-06") && $(".lb-day-title")?.textContent === "Fri 6 Nov" && went.includes("puzzle:2026-11-06"), "the previous day, and the address follows");
  check(text().includes("Final"), "an earlier day's board is final");
  await click($('[data-kind="arcade"]'));
  await settle();
  check(calls.some((c) => c.fn === "daily" && c.data["kind"] === "arcade"), "the Daily Arcade");
  await click($('[data-scope="friends"]'));
  await settle();
  check($$("[data-leaderboards-screen] > [data-board-list] li").length === 2, "the friends chip");
  root.unmount();
}

/* ------------------------------------------------------------------ 4. Profile */
{
  setAccount({ kind: "guest", userId: "00000000-0000-4000-8000-000000000099" } as never);
  calls.length = 0;
  let opened = "";
  let root = await mount(React.createElement(ProfileBoards, { onOpen: (to: string) => void (opened = to) }));
  check(!!$("[data-open-leaderboards]") && !!$("[data-open-daily-board]") && !$("[data-category-boards]") && calls.length === 0, "a guest's Profile has the two links and no category board");
  await click($("[data-open-daily-board]"));
  check(opened === "/daily-board", "the Daily top 100 link");
  root.unmount();
  setAccount({ kind: "account", userId: "00000000-0000-4000-8000-000000000100", username: "Me_Here", colour: 4, playerNumber: 100, founding: false, country: "GB", createdAt: new Date().toISOString(), status: "active", isUnder18: false, deletion: null, rename: { free: true } } as never);
  root = await mount(React.createElement(ProfileBoards, { onOpen: () => {} }));
  check(!!$('[data-category-boards="logic"]') && text().includes("Top Logic players") && calls.some((c) => c.data["board"] === "logic"), "an account's Profile shows Top Logic players");
  check($$('[data-category-boards] [data-board-list] li').length === 3, "the category's top rows");
  await click($('[data-category="sports"]'));
  await settle();
  check(text().includes("Top Sports players") && calls.some((c) => c.data["board"] === "sports"), "another category");
  root.unmount();
}

/* ------------------------------------------------------------------ 5. the setting */
{
  calls.length = 0;
  const root = await mount(React.createElement(screens.BoardVisibilitySetting));
  check($("[data-board-visibility]")?.getAttribute("data-board-visibility") === "off" && text().includes("Under-18s are hidden by default"), "an under-18 starts hidden");
  await click($("[data-board-visibility]"));
  await settle();
  check(calls.some((c) => c.fn === "setVisibility" && c.data["show"] === true) && $("[data-board-visibility]")?.getAttribute("data-board-visibility") === "on", "the switch sends the setting");
  root.unmount();
}

/* ------------------------------------------------------------------ 6. cards (Joe's rule, 11 Nov 2026) */
{
  const card = (frame: string, badges: string[] = []) => ({ avatarId: "captain-joulz", colour: 4, gem: null, cardArt: "card-art.bolt-stripes", frame, nameColour: "name-colour.gold-leaf", badges, title: "rookie" });
  const cardRows = [
    row(1, 3104, "Nova", { card: card("frame.gold", ["flawless"]), tier: "top500", top500: 1 }),
    row(2, 3061, null),
    row(3, 2987, "Mira_K", { card: card("frame.silver"), tier: "storm" }),
    row(4, 2950, "Dex", { card: card("frame.plain"), tier: "volt" }),
    row(5, 2900, null),
  ];
  const cardCalls: string[] = [];
  setLeaderboardFunctionsForChecks({
    ratingBoardFn: (async ({ data }: { data: Record<string, unknown> }) => {
      cardCalls.push(`rating:${String(data["board"])}`);
      return { ok: true, page: { ready: true, rows: data["board"] === "joulz" ? cardRows : cardRows.slice(0, 3), me: row(4, 2950, "Dex", { isMe: true, card: card("frame.plain") }), total: 5, country: "GB" } };
    }) as never,
  });
  const root = await mount(React.createElement(screens.RatingBoardsScreen, { onBack: () => {}, isAccount: true }));
  const main = $$("[data-leaderboards-screen] > [data-board-list] > ol:first-child > li");
  const strip = main[0]?.querySelector("[data-card-strip]");
  check(!!strip && strip.getAttribute("data-frame") === "frame.gold" && strip.getAttribute("data-name-colour") === "name-colour.gold-leaf" && strip.getAttribute("data-card-art") === "card-art.bolt-stripes", "a row is the player's nameplate strip: card art, frame, name colour");
  check(!!strip?.querySelector('[data-card-tier="top500"]') && !!strip?.querySelector('[data-card-badge="flawless"]') && !!main[2]?.querySelector('[data-card-strip] [data-card-tier="storm"]'), "with the tier emblem and badges");
  check(main.every((li) => !li.querySelector("[data-card-strip] .lb-value, [data-card-strip] .lb-place, [data-card-strip] [data-jz='medal']")), "places and scores stay outside the strip (cosmetics in the name area only)");
  check(main[1]?.hasAttribute("data-hidden-player") === true && !main[1]?.querySelector("[data-card-strip]") && !main[1]?.querySelector("[data-open-card]") && main[1]?.textContent?.includes("Hidden player") === true, "a hidden player: Hidden player, no card, nothing to open");
  const podium = $$("[data-board-podium] > li");
  check(podium.length === 3 && podium.map((p) => p.getAttribute("data-podium-place")).join() === "1,2,3", "the top 3 above the rows, in place order (1st first on a phone)");
  check(!!podium[0]?.querySelector("[data-player-card]") && !!podium[2]?.querySelector("[data-player-card]") && !podium[1]?.querySelector("[data-player-card]") && podium[1]?.textContent?.includes("Hidden player") === true, "full cards for visible players, Hidden player with no card in its place");
  check(podium.every((p) => !p.querySelector("[data-player-card] .lb-value")) && podium[0]?.querySelector(".lb-value")?.textContent === "3,104", "each podium score sits under its card, not on it");
  check(!podium[1]?.querySelector("[data-open-card]"), "a hidden player's podium place opens nothing");
  await click(main[0]?.querySelector("[data-open-card]") as HTMLElement);
  await settle();
  const sheet = $("[data-card-sheet]");
  check(!!sheet?.querySelector('[data-player-card][data-frame="frame.gold"]') && sheet?.textContent?.includes("Nova") === true, "tapping a row opens that player's full card");
  await click($("[aria-label='Close card']"));
  await settle(400);
  await click(podium[2]?.querySelector("[data-open-card]") as HTMLElement);
  await settle();
  check(!!$('[data-card-sheet] [data-player-card][data-frame="frame.silver"]'), "tapping a podium card opens it too");
  check(cardCalls.filter((c) => c === "rating:joulz").length === 1 && cardCalls.length === 2, `one call per board, cards included (${cardCalls.join(", ")})`);
  root.unmount();
  const fs = await import("node:fs");
  const css = fs.readFileSync("src/polish-layout/leaderboards.css", "utf8");
  check(/@media \(min-width: 700px\)[\s\S]*data-podium-place="1"\][\s\S]*order: 2/.test(css), "wide screens put 1st in the middle (order 2 from 700 px)");
  const src = ["src/components/leaderboards/BoardList.tsx", "src/components/leaderboards/LeaderboardScreens.tsx"].map((f) => fs.readFileSync(f, "utf8")).join("\n");
  check(!/getPublicCard|identityBackend|cardBadgesFn|economy\.functions/.test(src), "the screens fetch no card of their own (the board's call carries them)");
}

setLeaderboardFunctionsForChecks(null);
console.error = origError;
console.log(`leaderboards-ui-check: ${checks - failures.length} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS");
process.exit(0);
