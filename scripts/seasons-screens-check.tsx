/**
 * seasons-screens-check (wave 4, session W4d; happy-dom, ~2 s; docs/seasons/README.md): the season screens against a
 * stand-in for the server (setSeasonsBackend, setBadgesBackend).
 *
 *  1. The reward notice: drawn by PhoneShell on tab pages only (never over a round, its intro or reveal, or any result,
 *     podium, standings or share screen); one season at a time; it waits while a badge moment is due; a tap closes it and
 *     marks it shown on the server; nothing for a guest or when nothing is new; its words for every tier.
 *  2. Profile's seasons section: the season peak and the history with each season's emblem (the tier's shield and the
 *     "S1" mark, Top 500 on the Lightning shield with its plate), real data only; SeasonTrophies for the trophy cabinet.
 *  3. The check-only switch window.__DUELZ_ALLOW_SEASONS__ is never read in a production build.
 *
 *   bun scripts/seasons-screens-check.tsx
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

const { Window } = await import("happy-dom");
const win = new Window({ url: "https://joulz.uk/", width: 390, height: 844 });
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "MouseEvent", "HTMLButtonElement", "SVGElement", "getComputedStyle", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame", "localStorage", "sessionStorage", "MutationObserver", "CustomEvent", "location", "history", "DOMParser"] as const) {
  const value = (win as unknown as Record<string, unknown>)[key];
  const bind = typeof value === "function" && !/^[A-Z]/.test(key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: bind ? (value as (...a: unknown[]) => unknown).bind(win) : value });
}
Object.defineProperty(win.navigator, "webdriver", { configurable: true, value: true });
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const consoleErrors: string[] = [];
console.error = (...args: unknown[]) => {
  const text = args.map(String).join(" ");
  if (!/not wrapped in act|ReactDOMTestUtils/.test(text)) consoleErrors.push(text.slice(0, 300));
};

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { setAccount } = await import("../src/lib/account/accountApi");
const seasonsApi = await import("../src/lib/seasons/seasonsApi");
const badgesApi = await import("../src/lib/badges/badgesApi");
const { SeasonNotice, seasonNoticeLines } = await import("../src/components/seasons/SeasonNotice");
const { SeasonSection, SeasonTrophies, SeasonEmblem } = await import("../src/components/seasons/SeasonSection");
const rules = await import("../src/lib/seasons/rules");
import type { SeasonHistoryEntry, MySeasons } from "../src/lib/seasons/types";

const $ = (sel: string) => document.querySelector(sel) as unknown as HTMLElement | null;
const settle = async (ms = 40) => act(async () => void (await new Promise((r) => setTimeout(r, ms))));

setAccount(
  { kind: "account", userId: "u-1", username: "SeasonOne", colour: 4, playerNumber: 42, founding: true, country: null, createdAt: "2026-11-10T12:00:00.000Z", status: "active", isUnder18: false, deletion: null, rename: { free: true } } as never,
  null,
);

const entry = (tier: SeasonHistoryEntry["tier"], seen = false, season = "s1"): SeasonHistoryEntry => ({
  season, name: "Neon Circuit", test: false, mark: "S1", tier, peakLabel: `${rules.SEASON_TIER_NAMES[tier]} II`, ratedMatches: 14,
  frame: rules.season1Reward(tier).frame, title: rules.season1Reward(tier).title.id, grantedAt: "2027-03-23T00:00:00.000Z", seen,
});
let seenCalls: string[] = [];
let badgesUnseen: string[] = [];
const useBackends = (answer: MySeasons) => {
  seenCalls = [];
  seasonsApi.setSeasonsBackend({ mine: async () => answer, seen: async (s) => (seenCalls.push(s), { ok: true }) });
  badgesApi.setBadgesBackend({
    sync: async () => ({ account: true, earned: [], card: [], title: "rookie", unseen: badgesUnseen, progress: {} }),
    setCard: async () => ({ ok: false, reason: "error", message: "" }),
    setTitle: async () => ({ ok: false, reason: "error", message: "" }),
    markSeen: async () => ({ ok: true }),
    dailyRecord: async () => ({ busy: true }),
  });
};
async function mount(el: React.ReactElement) {
  document.body.innerHTML = "";
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host as unknown as Element);
  await act(async () => root.render(el));
  await settle(80);
  return root;
}

/* ------------------------------------------------------------------ 1. the notice */
{
  const shell = readFileSync("src/components/duel/PhoneShell.tsx", "utf8");
  check(/\{tabs && !gameScreen \? <SeasonNotice \/> : null\}/.test(shell) && (shell.match(/<SeasonNotice/g) ?? []).length === 1, "PhoneShell draws the notice on tab pages only, once");

  useBackends({ account: true, current: null, history: [entry("storm")] });
  let root = await mount(React.createElement(SeasonNotice));
  const notice = $("[data-season-notice]");
  check(notice?.getAttribute("data-season-notice") === "s1", "a reward not yet shown draws the notice");
  check(/Season 1 is over · Peak Storm/.test(notice?.textContent ?? "") && /S1 Storm emblem, frame and the title S1 Storm/.test(notice?.textContent ?? ""), `its words (${notice?.textContent})`);
  check(!!notice?.querySelector('[data-season-emblem="storm"][data-season-mark="S1"]'), "with the S1 Storm emblem");
  await act(async () => notice!.click());
  await settle(40);
  check(!$("[data-season-notice]") && seenCalls.join() === "s1", "a tap closes it and marks it shown on the server");
  root.unmount();

  useBackends({ account: true, current: null, history: [entry("storm", true)] });
  root = await mount(React.createElement(SeasonNotice));
  check(!$("[data-season-notice]"), "nothing when every reward has been shown");
  root.unmount();

  badgesUnseen = ["flawless"];
  useBackends({ account: true, current: null, history: [entry("volt")] });
  root = await mount(React.createElement(SeasonNotice));
  check(!$("[data-season-notice]"), "it waits while a badge moment is due");
  root.unmount();
  badgesUnseen = [];

  for (const t of rules.SEASON_TIERS) {
    const l = seasonNoticeLines(entry(t));
    check(l.kicker === `Season 1 is over · Peak ${rules.SEASON_TIER_NAMES[t]}` && l.body === `You earned the S1 ${rules.SEASON_TIER_NAMES[t]} emblem, frame and the title S1 ${rules.SEASON_TIER_NAMES[t]}.`, `${t}: ${l.body}`);
  }
}

/* ------------------------------------------------------------------ 2. Profile */
{
  useBackends({ account: true, current: { season: "s2", name: "Season 2", test: false, mark: "S2", ratedMatches: 4, placementDone: true, peak: "surge", peakLabel: "Surge III" }, history: [entry("top500", true)] });
  let root = await mount(React.createElement(SeasonSection));
  const text = $("[data-profile-seasons]")?.textContent ?? "";
  check(/Season peak/.test(text) && /Surge III/.test(text) && /Season 2/.test(text), `the season peak: the server's own (${text.slice(0, 80)})`);
  check(/Season history/.test(text) && !!$('[data-season-entry="s1"] [data-season-emblem="top500"]'), "the history row with its emblem");
  const top = $('[data-season-emblem="top500"]');
  check(!!top?.querySelector('[data-tier="lightning"]') && /S1 TOP 500/.test(top?.textContent ?? ""), "Top 500's emblem: the Lightning shield and its plate");
  root.unmount();

  useBackends({ account: true, current: null, history: [] });
  root = await mount(React.createElement(SeasonSection));
  check(!$("[data-profile-seasons]"), "no section without a season played");
  root.unmount();

  root = await mount(React.createElement(SeasonTrophies, { history: rules.SEASON_TIERS.map((t) => entry(t)) }));
  const trophies = [...document.querySelectorAll("[data-season-emblem]")].map((e) => (e as unknown as HTMLElement).getAttribute("data-season-emblem"));
  check(trophies.join() === rules.SEASON_TIERS.join(), `every tier's emblem for the trophy cabinet (${trophies.join()})`);
  check([...document.querySelectorAll("[data-season-mark]")].every((e) => (e as unknown as HTMLElement).getAttribute("data-season-mark") === "S1"), "each with the S1 mark");
  root.unmount();
  root = await mount(React.createElement(SeasonEmblem, { tier: "spark", mark: "S1" }));
  check($("[data-season-emblem]")?.getAttribute("aria-label") === "S1 Spark emblem", "the emblem is labelled for screen readers");
  root.unmount();
}

/* ------------------------------------------------------------------ 3. the switch */
{
  const api = readFileSync("src/lib/seasons/seasonsApi.ts", "utf8");
  check(
    /if \(import\.meta\.env\.PROD\) return true;\s*return \(window as \{ __DUELZ_ALLOW_SEASONS__\?: boolean \}\)\.__DUELZ_ALLOW_SEASONS__ !== true;/.test(api),
    "the check-only window.__DUELZ_ALLOW_SEASONS__ is never read in a production build",
  );
  seasonsApi.setSeasonsBackend(null);
  (window as { __DUELZ_ALLOW_SEASONS__?: boolean }).__DUELZ_ALLOW_SEASONS__ = undefined;
  check(seasonsApi.seasonsAutomated() === true, "under automation without the switch, the phone calls no season function");
}

check(consoleErrors.length === 0, `no console errors (${consoleErrors.slice(0, 2).join(" | ")})`);
console.log(`seasons-screens-check: ${checks - failures.length} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS");
process.exit(0);
