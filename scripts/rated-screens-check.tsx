/**
 * rated-screens-check (wave 3, session W3c; happy-dom, ~5 s): the rated match screens against a stand-in for the
 * ratings and matchmaking server (setRatedBackend), in every state.
 *
 *  1. The rules: the hidden finish at exactly 20 % of each game's time; the picker's switched-on options only; the
 *     default pick; a recorded run's real age; the head-to-head line; the bar to the next division (mockup figures:
 *     1,278 is Volt II, "122 to Volt I"); Storm's and Top 500's caps.
 *  2. Home: nothing at all for a guest, a non-tester (rated play not open) or with no rated server; for a tester in
 *     placement 1 to 5 the panel ("N of 5", the boxes, Puzzles and Arcade hidden) and "Play placement N"; placed, the
 *     tier, rating, Puzzles and Arcade and the bar.
 *  3. The picker shows only what is switched on (the launch set: Mixed, All puzzles, All arcade; best of 3 draws no
 *     control); a wider switch draws exactly its options; Play records play_card_tapped and opens /rated.
 *  4. Searching (your card pulsing, the clock, the range), VS (live and recorded with its real age, both cards, the
 *     tier emblems, the record, vs_shown), the live header (the opponent's "?" from exactly 20 % left; the existing
 *     score box), the result (won and lost; rating change, bar, Puzzles and Arcade, each game won or lost with a tick
 *     or a cross, Joules, the star, the near miss, Next match, Rematch's 8 s, Challenge for friends only), placement
 *     results, the reveal ("Better than N%" only from real data), the tier ladder (every tier, the caps, where you are,
 *     a cap holding you back, the Players column only with counts).
 *  5. The card's pill: the player number before placement, the tier and division in the tier colour and the rating
 *     after; Profile: the Joulz Rating, Puzzles and Arcade and strongest categories only from real data (none drawn
 *     without a rated match in them), the placement panel during placement, A2's note without rated play; never a
 *     trophy cabinet or season peak.
 *  6. No motion under Reduce Motion: every animated rated element is stopped in rated.css's reduced-motion block.
 *  7. The analytics rules (acceptRatedEvent: five events, fixed words), the list in ANALYTICS_EVENTS and the
 *     migration; the check-only page override is ignored in production builds.
 *
 *   bun scripts/rated-screens-check.tsx
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
(window as unknown as { __DUELZ_RATED_EVENTS__: unknown[] }).__DUELZ_RATED_EVENTS__ = sent;
(window as unknown as { __DUELZ_IDENTITY_EVENTS__: unknown[] }).__DUELZ_IDENTITY_EVENTS__ = [];

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
const identityBackend = await import("../src/lib/identity/backend");
const identityApi = await import("../src/lib/identity/identityApi");
const ratedBackendMod = await import("../src/lib/rated/backend");
const ratedApi = await import("../src/lib/rated/ratedApi");
const rules = await import("../src/lib/rated/rules");
const tiers = await import("../src/lib/rated/tiers");
const { RatedHome } = await import("../src/components/rated/RatedHome");
const { Searching, VsScreen, MatchResult, PlacementReveal } = await import("../src/components/rated/RatedMatchScreens");
const { RatedFrameScore } = await import("../src/components/rated/RatedFrameScore");
const { TierLadder } = await import("../src/components/rated/TierLadder");
const { ProfileCard } = await import("../src/components/identity/ProfileCard");
const { PlayerCard } = await import("../src/design/identity");

type RatedStatus = import("../src/lib/rated/backend").RatedStatus;
type RatedResult = import("../src/lib/rated/backend").RatedResult;
type RatedMatch = import("../src/lib/rated/backend").RatedMatch;
type RankView = import("../src/lib/rated/tiers").RankView;

const $ = (sel: string) => document.querySelector(sel) as unknown as HTMLElement | null;
const $$ = (sel: string) => [...document.querySelectorAll(sel)] as unknown as HTMLElement[];
const text = (sel: string) => ($(sel)?.textContent ?? "").replace(/\s+/g, " ").trim();
const click = async (el: HTMLElement | null) => act(async () => void el?.click());
const settle = async (ms = 30) => act(async () => void (await new Promise((r) => setTimeout(r, ms))));

identityBackend.setIdentityBackend(null);

/* ------------------------------------------------------------------ the stand-in */
const LOOK = { cardArt: "card-art.joulz-navy", frame: "frame.plain", nameColour: null, avatar: { id: "captain-joulz", colour: 4, gem: null } };
const VOLT2: RankView = { tier: "volt", division: 2, rating: 1278, top500: null, heldBack: null };
const ME_PLACED = { username: "TheInventor", playerNumber: 42, look: LOOK, title: "Founding Player", rank: VOLT2 };
const SAM = { username: "Sam", playerNumber: 7, look: { ...LOOK, avatar: { id: "captain-joulz", colour: 1, gem: null } }, title: "Arena Champion", rank: { tier: "volt", division: 2, rating: 1296, top500: null, heldBack: null } as RankView };
const LAUNCH = { picks: ["mixed", "puzzles", "arcade"], bestOf: [3], sizes: [2] } as const;

function placedStatus(over: Partial<RatedStatus> = {}): RatedStatus {
  return {
    open: true,
    me: ME_PLACED,
    options: LAUNCH,
    season: { name: "Season 1", daysLeft: 34 },
    standing: {
      state: "placed",
      rank: VOLT2,
      puzzles: { rating: 1296, matches: 12 },
      arcade: { rating: 1231, matches: 9 },
      categories: [
        { pick: "cat:pattern", rating: 1350, matches: 4 },
        { pick: "cat:word", rating: 1312, matches: 3 },
        { pick: "cat:logic", rating: 1288, matches: 2 },
        { pick: "cat:retro", rating: 1400, matches: 0 },
        { pick: "cat:speed", rating: 1198, matches: 1 },
      ],
      won: 12,
      lost: 9,
    },
    lastPick: null,
    ...over,
  };
}
function placementStatus(results: ("won" | "lost")[]): RatedStatus {
  return {
    ...placedStatus(),
    me: { ...ME_PLACED, rank: null },
    standing: { state: "placement", results, puzzles: { rating: null, matches: results.length > 0 ? 2 : 0 }, arcade: { rating: null, matches: 0 } },
  };
}

let status: RatedStatus | null = placedStatus();
const calls: string[] = [];
const MATCH: RatedMatch = {
  id: "m1",
  pick: "mixed",
  bestOf: 3,
  me: ME_PLACED,
  them: SAM,
  source: { kind: "live" },
  headToHead: { won: 3, lost: 1 },
  placement: null,
};
function result(over: Partial<RatedResult> = {}): RatedResult {
  return {
    match: MATCH,
    games: [
      { type: "wordsearch", myScore: 168, theirScore: 151 },
      { type: "racing", myScore: 142, theirScore: 171 },
      { type: "flow", myScore: 188, theirScore: 176 },
    ],
    myGames: 2,
    theirGames: 1,
    won: true,
    rating: { after: { ...VOLT2, rating: 1285 }, change: 7, puzzles: { rating: 1303, change: 7 }, arcade: { rating: 1238, change: 7 } },
    placementResults: null,
    reveal: null,
    joules: { amount: 120, passLevel: 13 },
    star: { type: "wordsearch" },
    nearMiss: { type: "flow", offBest: 12 },
    friend: false,
    rematchUntil: new Date(Date.now() + 8000).toISOString(),
    ...over,
  };
}
ratedBackendMod.setRatedBackend({
  status: async () => status,
  search: async () => MATCH,
  result: async () => result(),
  rematch: async () => MATCH,
  challenge: async (id) => {
    calls.push(`challenge ${id}`);
    return { ok: true, code: "ABC234" };
  },
  ladder: async () => ({ shares: { lightning: 0.5, storm: 3, surge: 12, volt: 34, charge: 32, spark: 18 }, top500: 500 }),
  renderGame: () => null,
});

const ACCOUNT = (playerNumber: number) =>
  ({
    kind: "account",
    userId: `u-${playerNumber}`,
    username: "TheInventor",
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

async function signIn(playerNumber: number | null) {
  identityApi.resetIdentity();
  ratedApi.resetRated();
  if (playerNumber === null) {
    const mod = await import("../src/lib/account/accountApi");
    (mod as unknown as { setGuestForChecks?: () => void }).setGuestForChecks?.();
    await act(async () => void (await mod.refreshAccount()));
  } else setAccount(ACCOUNT(playerNumber) as never, null);
}

async function mount(ui: () => React.ReactElement, path = "/") {
  document.body.innerHTML = "";
  const host = document.createElement("div");
  document.body.appendChild(host);
  const rootRoute = createRootRoute({ component: () => React.createElement(Outlet) });
  const paths = new Set([path, "/", "/rated", "/tiers", "/profile", "/customise"]);
  const routes = [...paths].map((p) =>
    createRoute({ getParentRoute: () => rootRoute, path: p, component: p === path ? ui : () => React.createElement("p", { "data-at": p }, p) }),
  );
  const router = createRouter({ routeTree: rootRoute.addChildren(routes), history: createMemoryHistory({ initialEntries: [path] }) });
  (router as unknown as { _rendered?: unknown[] })._rendered ??= [];
  await router.load();
  const went: { to: string; search?: Record<string, unknown> }[] = [];
  (router as unknown as { navigate: (o: unknown) => Promise<void> }).navigate = async (o: unknown) => {
    went.push(o as { to: string; search?: Record<string, unknown> });
  };
  const root = createRoot(host as unknown as Element);
  await act(async () => {
    root.render(React.createElement(RouterProvider, { router } as never));
  });
  await settle(60);
  return { root, went };
}

/* ------------------------------------------------------------------ 1. the rules */
{
  const { opponentScoreHidden, HIDDEN_FINISH_SHARE } = rules;
  check(HIDDEN_FINISH_SHARE === 0.2, "the hidden finish is the final 20 %");
  check(opponentScoreHidden(12_000, 60_000), "60 s game: hidden at exactly 12 s left (20 %)");
  check(!opponentScoreHidden(12_001, 60_000), "60 s game: shown at 12.001 s left");
  check(opponentScoreHidden(0, 60_000) && opponentScoreHidden(5_000, 60_000), "hidden to the buzzer");
  check(!opponentScoreHidden(30_000, 60_000), "shown at half time");
  check(opponentScoreHidden(18_000, 90_000) && !opponentScoreHidden(18_001, 90_000), "90 s game: exactly 18 s");
  check(opponentScoreHidden(18_600, 93_000) && !opponentScoreHidden(18_601, 93_000), "93 s game: exactly 18.6 s");
  check(!opponentScoreHidden(0, 0) && !opponentScoreHidden(0, -1), "a game with no clock never hides");

  check(rules.shownPicks(LAUNCH).join() === "mixed,puzzles,arcade", "launch picks: Mixed, All puzzles, All arcade");
  check(rules.shownPicks({ picks: ["arcade", "cat:word", "nonsense" as never], bestOf: [3], sizes: [2] }).join() === "arcade,cat:word", "only switched-on picks, in order; an unknown one is left out");
  check(rules.shownBestOf({ picks: [], bestOf: [7, 3], sizes: [] }).join() === "3,7", "best-of options: only those on");
  check(rules.defaultPick(LAUNCH, null) === "mixed", "default pick: Mixed");
  check(rules.defaultPick(LAUNCH, "arcade") === "arcade", "default pick: the last one played when still on");
  check(rules.defaultPick(LAUNCH, "cat:word") === "mixed", "default pick: never a switched-off last pick");
  const now = Date.parse("2026-11-11T12:00:00Z");
  check(rules.recordedAgo("2026-11-11T10:00:00Z", now) === "Recorded run, 2 h ago", "recorded run: its real age, 2 h");
  check(rules.recordedAgo("2026-11-11T11:55:00Z", now) === "Recorded run, 5 min ago", "recorded run: 5 min");
  check(rules.recordedAgo("2026-11-10T11:00:00Z", now) === "Recorded run, 1 day ago", "recorded run: 1 day");
  check(rules.headToHeadLine({ won: 0, lost: 0 }, "Sam") === "First meeting", "head to head: first meeting");
  check(rules.headToHeadLine({ won: 3, lost: 1 }, "Sam") === "You lead 3–1", "head to head: you lead");
  check(rules.headToHeadLine({ won: 1, lost: 2 }, "Sam") === "Sam leads 2–1", "head to head: they lead");

  const bar = tiers.divisionBar(VOLT2);
  check(bar.here === "Volt II" && bar.next === "122 to Volt I" && bar.toNext === 122, `1,278: Volt II, 122 to Volt I (${bar.here}, ${bar.next})`);
  check(Math.abs(bar.fraction - 28 / 150) < 1e-9, "the bar fills across the division");
  check(tiers.divisionBar({ tier: "volt", division: 1, rating: 1450, top500: null, heldBack: null }).next === "50 to Surge III", "Volt I: on to Surge III");
  check(tiers.divisionBar({ tier: "surge", division: 1, rating: 1980, top500: null, heldBack: "storm" }).next === "Storm needs the top 3%", "held back from Storm: the cap, not points");
  check(tiers.divisionBar({ tier: "lightning", division: 1, rating: 2800, top500: 37, heldBack: null }).next === "Top division", "Lightning I: the top");
  check(tiers.rankLabel({ tier: "lightning", division: 1, top500: 37 }) === "Top 500 #37", "Top 500's number");
  check(tiers.tierRange("volt") === "1,100 to 1,499" && tiers.tierRange("lightning") === "2,400 and up", "tier ranges");
}

/* ------------------------------------------------------------------ 2. Home */
const homeUi = () => React.createElement(RatedHome);
for (const [who, n, st] of [
  ["a guest", null, placedStatus()],
  ["a non-tester (rated play not open)", 3, { ...placedStatus(), open: false }],
  ["an account with no rated server", 3, null],
] as const) {
  status = st;
  await signIn(n);
  const { root } = await mount(homeUi);
  await settle(60);
  check(document.body.innerHTML === "<div></div>", `${who}: Home draws nothing rated (${document.body.innerHTML.slice(0, 80)})`);
  root.unmount();
}
{
  // No server at all (setRatedBackend undefined → the unbound default): nothing.
  ratedBackendMod.setRatedBackend(undefined);
  check((await ratedBackendMod.ratedBackend()) === null, "unbound: no rated server until W3a and W3b land");
  await signIn(5);
  const { root } = await mount(homeUi);
  check(document.body.innerHTML === "<div></div>", "unbound: Home draws nothing rated");
  root.unmount();
}
ratedBackendMod.setRatedBackend({
  status: async () => status,
  search: async () => MATCH,
  result: async () => result(),
  rematch: async () => MATCH,
  challenge: async (id) => {
    calls.push(`challenge ${id}`);
    return { ok: true, code: "ABC234" };
  },
  ladder: async () => ({ shares: { lightning: 0.5, storm: 3, surge: 12, volt: 34, charge: 32, spark: 18 }, top500: 500 }),
  renderGame: () => null,
});
for (let played = 0; played <= 4; played++) {
  const results = (["won", "won", "lost", "won", "lost"] as const).slice(0, played);
  status = placementStatus([...results]);
  await signIn(5);
  const { root } = await mount(homeUi);
  check($("[data-rank-panel]")?.getAttribute("data-rank-panel") === "placement", `placement ${played}: the placement panel`);
  check(text("[data-placement-of]") === `${played} of 5`, `placement ${played}: "${played} of 5" (${text("[data-placement-of]")})`);
  const boxes = $$("[data-placement-boxes] li").map((b) => b.getAttribute("data-box")).join();
  const want = [...results, "next", "later", "later", "later", "later"].slice(0, 5).join();
  check(boxes === want, `placement ${played}: boxes ${want} (${boxes})`);
  check(!!$("[data-unplaced-emblem]") && !$("[data-joulz-rating]"), `placement ${played}: no tier or rating shown`);
  check($$("[data-side]").every((s) => s.getAttribute("data-side-value") !== "rating"), `placement ${played}: Puzzles and Arcade hidden`);
  check(text("[data-rated-play-button]") === `Play placement ${played + 1}`, `placement ${played}: "Play placement ${played + 1}"`);
  check(/Your Joulz Rating and tier appear after match 5\./.test(document.body.textContent ?? ""), `placement ${played}: the line under the boxes`);
  root.unmount();
}
{
  status = placedStatus();
  await signIn(5);
  const { root, went } = await mount(homeUi);
  check($("[data-rank-panel]")?.getAttribute("data-rank-panel") === "placed", "placed: the rank panel");
  check(text("[data-joulz-rating]") === "1,278", "placed: the Joulz Rating");
  check(!!$("[data-rank-panel] [data-jz='emblem'][data-tier='volt']"), "placed: the Volt emblem");
  check(text("[data-side='puzzles'] .rt-side-value") === "1,296" && text("[data-side='arcade'] .rt-side-value") === "1,231", "placed: Puzzles and Arcade");
  check(text("[data-rank-panel] [data-bar-next]") === "122 to Volt I", "placed: the bar to the next division");
  check(/Season 1, 34 days left/.test(document.body.textContent ?? ""), "placed: the season line");
  // The picker: launch set only.
  check(!$("[data-rated-play] [data-jz='segmented']"), "launch: no 1v1 or Best of 3 control (one option each)");
  check(text("[data-current-pick]") === "Mixed", "launch: Mixed by default");
  await click($("[data-open-picker]"));
  await settle(60);
  const opts = $$("[data-pick-option]").map((b) => b.getAttribute("data-pick-option")).join();
  check(opts === "mixed,puzzles,arcade", `the picker shows only what is switched on (${opts})`);
  check(!/Word|Retro|Strategy|Best of 5|8 players|4 players/.test($("[data-rated-picker]")?.textContent ?? document.body.textContent ?? ""), "the picker shows no switched-off option");
  await click($("[data-pick-option='arcade']"));
  check(text("[data-picker-play]") === "Play All arcade", "the picker's Play names the pick");
  await click($("[data-picker-play]"));
  await settle(60);
  check(text("[data-current-pick]") === "All arcade", "the pick shows on the Play card");
  sent.length = 0;
  await click($("[data-rated-play-button]"));
  check(JSON.stringify(sent[0]) === '{"event":"play_card_tapped","pick":"arcade","placement":false}', `play_card_tapped (${JSON.stringify(sent[0])})`);
  check(went.some((w) => w.to === "/rated" && w.search?.["pick"] === "arcade" && w.search?.["bestOf"] === 3), `Play opens /rated with the pick (${JSON.stringify(went)})`);
  sent.length = 0;
  await click($("[data-rank-panel] [data-open-tiers]"));
  check(JSON.stringify(sent[0]) === '{"event":"tier_ladder_viewed","from":"home"}' && went.some((w) => w.to === "/tiers"), "the rating opens the tiers (tier_ladder_viewed from home)");
  root.unmount();
}
{
  // A wider switch: exactly its options, and the best-of control with its two.
  status = placedStatus({ options: { picks: ["mixed", "cat:word", "cat:retro"], bestOf: [3, 5], sizes: [2] } });
  await signIn(5);
  const { root } = await mount(homeUi);
  const seg = $$("[data-best-of-option]").map((b) => b.getAttribute("data-best-of-option")).join();
  check(seg === "3,5", `best of 3 and 5 on: both shown, no 7 (${seg})`);
  await click($("[data-open-picker]"));
  await settle(60);
  const opts = $$("[data-pick-option]").map((b) => b.getAttribute("data-pick-option")).join();
  check(opts === "mixed,cat:word,cat:retro", `a wider switch: exactly its picks (${opts})`);
  check(text("[data-pick-option='cat:word'] .rt-option-rating") === "1,312", "a category shows its own rating");
  root.unmount();
  // 1v1 switched off: no Play card (the 4- and 8-player screens are a later session's).
  status = placedStatus({ options: { picks: ["mixed"], bestOf: [3], sizes: [8] } });
  await signIn(5);
  const r2 = await mount(homeUi);
  check(!$("[data-rated-play]") && !!$("[data-rank-panel]"), "1v1 off: the rank panel but no Play card");
  r2.root.unmount();
}

/* ------------------------------------------------------------------ 4. searching, VS, the live header */
async function render(el: React.ReactElement) {
  document.body.innerHTML = "<div id=r></div>";
  const root = createRoot(document.getElementById("r") as unknown as Element);
  await act(async () => root.render(el));
  await settle(20);
  return root;
}
{
  const root = await render(React.createElement(Searching, { me: ME_PLACED, pickText: "Mixed, best of 3", progress: { elapsedMs: 4200, range: 60, recordedAfterMs: 8000 }, onCancel: () => calls.push("cancel") }));
  check(!!$("[data-pulse] [data-player-card]"), "searching: your player card, pulsing");
  check(text("[data-search-clock]") === "0:04" && text("[data-search-range]") === "±60", "searching: the clock and the range");
  check(/Mixed, best of 3, near your 1,278/.test(document.body.textContent ?? ""), "searching: what and near what");
  await click($("[data-search-cancel]"));
  check(calls.includes("cancel"), "searching: Cancel");
  root.unmount();
}
for (const source of [{ kind: "live" }, { kind: "recorded", recordedAt: new Date(Date.now() - 2 * 3600_000 - 60_000).toISOString() }] as const) {
  sent.length = 0;
  const root = await render(React.createElement(VsScreen, { match: { ...MATCH, source }, nowMs: Date.now() }));
  check($("[data-rated-screen='vs']")?.getAttribute("data-source") === source.kind, `VS ${source.kind}`);
  check(
    source.kind === "live" ? !!$("[data-vs-tag='live'] [data-jz='live-tag']") : text("[data-vs-tag='recorded']") === "Recorded run, 2 h ago",
    `VS ${source.kind}: the tag (${text("[data-vs-tag]")})`,
  );
  check($$("[data-vs-side] [data-player-card]").length === 2, `VS ${source.kind}: both player cards`);
  check($$("[data-vs-side] [data-jz='emblem']").length === 2, `VS ${source.kind}: both tier emblems`);
  const pills = $$("[data-vs-side] [data-card-pill]").map((p) => (p.textContent ?? "").trim()).join(" | ");
  check(pills === "Volt II1,296 | Volt II1,278", `VS: each card shows tier and rating (${pills})`);
  check(text("[data-head-to-head]") === "You lead 3–1", "VS: your record against each other");
  check(JSON.stringify(sent[0]) === JSON.stringify({ event: "vs_shown", source: source.kind }), `vs_shown ${source.kind}`);
  root.unmount();
}
{
  // During placement both cards keep the player number and the unplaced shield.
  const root = await render(React.createElement(VsScreen, { match: { ...MATCH, placement: 2, me: { ...ME_PLACED, rank: null } }, nowMs: Date.now() }));
  check(text("[data-vs-side='me'] [data-card-pill]") === "#0042" && !!$("[data-vs-side='me'] [data-unplaced-emblem]"), "VS in placement: your card keeps the player number");
  check(/Placement 2 of 5/.test(document.body.textContent ?? ""), "VS in placement: the chip says which");
  root.unmount();
}
for (const [left, want] of [
  [30_000, "live"],
  [12_001, "live"],
  [12_000, "hidden"],
  [0, "hidden"],
] as const) {
  const root = await render(
    React.createElement(RatedFrameScore, { me: { look: LOOK }, them: { name: "Sam", look: SAM.look }, myScore: 148, theirScore: 131, leftMs: left, limitMs: 60_000 }),
  );
  const box = $("[data-frame-score]");
  check(box?.getAttribute("data-rated-score") === want, `header at ${left / 1000} s of 60: Sam's score ${want}`);
  check(box?.classList.contains("game-frame-score") ?? false, "the header score sits in the existing score box (no layout change)");
  check(want === "hidden" ? text("[data-hidden-score]") === "?" && !/131/.test(box?.textContent ?? "") : /131/.test(box?.textContent ?? ""), `at ${left / 1000} s: Sam's figure ${want === "hidden" ? "hidden" : "shown"}`);
  check(/148/.test(text("[data-score-row='me']")), `at ${left / 1000} s: yours stays`);
  root.unmount();
}

/* ------------------------------------------------------------------ the result, placement, the reveal */
const resultEl = (r: RatedResult, extra: Record<string, unknown> = {}) =>
  React.createElement(MatchResult, {
    result: r,
    nowMs: Date.now(),
    onNext: () => calls.push("next"),
    onRematch: () => calls.push("rematch"),
    onTiers: () => calls.push("tiers"),
    onChallenge: async () => ({ ok: true as const, code: "ABC234" }),
    onReveal: () => calls.push("reveal"),
    ...extra,
  });
{
  sent.length = 0;
  calls.length = 0;
  const root = await render(resultEl(result()));
  check(text(".rt-result-title") === "You win" && text("[data-match-score]") === "2–1", "result: You win 2–1");
  check($$("[data-match-chips] li").map((l) => l.textContent).join() === "Mixed,Best of 3,v Sam", "result: Mixed, Best of 3, v Sam");
  check(text("[data-rating-panel] [data-joulz-rating]") === "1,285" && text("[data-change='up']").includes("+7"), "result: the rating and its change, with an arrow");
  check(text("[data-rating-panel] [data-bar-next]") === "115 to Volt I", "result: the bar to the next division");
  check(/Puzzles 1,303 \+7/.test(text("[data-side-changes]")) && /Arcade 1,238 \+7/.test(text("[data-side-changes]")), "result: Puzzles and Arcade changes");
  const rows = $$("[data-game-row]").map((r) => `${r.getAttribute("data-game-row")}:${r.getAttribute("data-outcome")}`).join();
  check(rows === "wordsearch:won,racing:lost,flow:won", `result: each game won or lost (${rows})`);
  check($$("[data-verdict='won'] [data-icon='check'], [data-verdict='won'] svg").length >= 2 && $$("[data-verdict='lost'] svg").length === 1, "result: a tick for a win, a cross for a loss");
  check(/\+120 ?Joules, pass level 13/.test(text("[data-joules-line]")), "result: the Joules line");
  check(/Star on Lookout/.test(text("[data-earned='star']")), "result: the star earned (C1a's 175+ star, no bronze/silver/gold)");
  check(!/Silver|Bronze|Gold star/.test(document.body.textContent ?? ""), "result: no old medal stars");
  check(text("[data-near-miss]") === "Chroma Lines: 12 off your best", `result: the near miss (${text("[data-near-miss]")})`);
  check(/^Rematch, [78] s$/.test(text("[data-rematch]")), `result: Rematch with its 8 s (${text("[data-rematch]")})`);
  check(!$("[data-rated-challenge]"), "result: no Challenge for a stranger");
  check(JSON.stringify(sent[0]) === '{"event":"result_viewed","outcome":"won","placement":false}', "result_viewed");
  await click($("[data-next-match]"));
  check(calls.includes("next") && sent.some((e) => e["event"] === "next_match_tapped"), "Next match (next_match_tapped)");
  await click($("[data-rematch]"));
  check(calls.includes("rematch"), "Rematch");
  root.unmount();
}
{
  const root = await render(resultEl(result({ friend: true, rematchUntil: null })));
  check(text("[data-rated-challenge]") === "Challenge Sam", "a friend: Challenge Sam");
  check(!$("[data-rematch]"), "rematch offer over: no Rematch");
  root.unmount();
}
{
  sent.length = 0;
  const lost = result({ won: false, myGames: 1, theirGames: 2, rating: { after: { ...VOLT2, rating: 1268 }, change: -10, puzzles: null, arcade: { rating: 1221, change: -10 } }, star: null, nearMiss: null, joules: null });
  const root = await render(resultEl(lost));
  check(text(".rt-result-title") === "Sam wins" && text("[data-match-score]") === "1–2", "a loss: Sam wins 1–2");
  check(text("[data-rating-panel] [data-change='down']").includes("−10"), "a loss: the change down, with its arrow");
  check(!$("[data-near-miss]") && !$("[data-earned='star']") && !$("[data-joules-line]"), "a loss with nothing earned: no star, Joules or near-miss lines");
  check(JSON.stringify(sent[0]) === '{"event":"result_viewed","outcome":"lost","placement":false}', "result_viewed lost");
  root.unmount();
}
{
  sent.length = 0;
  const placing = result({ rating: null, placementResults: ["won", "won", "lost", "won"], star: null, nearMiss: null, joules: { amount: 120, passLevel: null }, match: { ...MATCH, placement: 4 } });
  const root = await render(resultEl(placing));
  check($("[data-rated-screen]")?.getAttribute("data-rated-screen") === "placement-result", "placement result");
  check(text(".rt-placement-title") === "Placement 4 of 5" && text(".rt-placement-won") === "3 won", "placement result: 4 of 5, 3 won");
  check(!$("[data-rating-panel]") && !$("[data-joulz-rating]"), "placement result: no rating");
  check(/Strong start\. One more and your rating and tier are revealed\./.test(document.body.textContent ?? ""), "placement result: the line");
  check(text("[data-next-match]") === "Play placement 5", "placement result: Play placement 5");
  check(/\+120 Joules/.test(text("[data-joules-line]")), "placement result: the Joules line");
  check(JSON.stringify(sent[0]) === '{"event":"result_viewed","outcome":"won","placement":true}', "result_viewed placement");
  root.unmount();
}
{
  calls.length = 0;
  const reveal = { rank: { tier: "volt", division: 3, rating: 1214, top500: null, heldBack: null } as RankView, betterThan: 62, puzzles: { rating: 1236, matches: 3 }, arcade: { rating: 1180, matches: 2 }, won: 4, lost: 1 };
  const fifth = result({ rating: null, placementResults: ["won", "won", "lost", "won", "won"], reveal });
  let root = await render(resultEl(fifth));
  check(text("[data-reveal-open]") === "Reveal my tier", "the 5th placement result: on to the reveal");
  await click($("[data-reveal-open]"));
  check(calls.includes("reveal"), "the reveal opens");
  root.unmount();
  root = await render(React.createElement(PlacementReveal, { reveal, onNext: () => calls.push("next"), onTiers: () => calls.push("tiers") }));
  check(text("[data-reveal-tier]") === "You’re Volt III", "reveal: You’re Volt III");
  check(text("[data-better-than]") === "Better than 62% of players", "reveal: better than N% from the server's figure");
  check(text("[data-rated-screen='reveal'] [data-joulz-rating]") === "1,214", "reveal: the rating");
  check(text("[data-bar-next]") === "36 to Volt II", `reveal: 36 to Volt II (${text("[data-bar-next]")})`);
  check(/Placement complete, 4 won, 1 lost/.test(document.body.textContent ?? ""), "reveal: placement complete");
  check(text("[data-side='puzzles'] .rt-side-value") === "1,236" && /3 matches/.test(text("[data-side='puzzles']")), "reveal: Puzzles");
  check(text("[data-side='arcade'] .rt-side-value") === "1,180" && /2 matches/.test(text("[data-side='arcade']")), "reveal: Arcade");
  root.unmount();
  root = await render(React.createElement(PlacementReveal, { reveal: { ...reveal, betterThan: null }, onNext: () => {}, onTiers: () => {} }));
  check(!$("[data-better-than]"), "reveal: no percentage without real data");
  root.unmount();
}

/* ------------------------------------------------------------------ the tier ladder */
{
  const counts = { shares: { lightning: 0.5, storm: 3, surge: 12, volt: 34, charge: 32, spark: 18 }, top500: 500 };
  let root = await render(React.createElement(TierLadder, { rank: VOLT2, counts }));
  const rows = $$("[data-tier-row]").map((r) => r.getAttribute("data-tier-row")).join();
  check(rows === "top500,lightning,storm,surge,volt,charge,spark", `the ladder: every tier, top down (${rows})`);
  check($$("[data-tier-row][data-you]").map((r) => r.getAttribute("data-tier-row")).join() === "volt" && /You, Volt II/.test(text("[data-tier-row='volt']")), "the ladder: where you are");
  check(/1,100 to 1,499/.test(text("[data-tier-row='volt']")) && /III 1,100, II 1,250, I 1,400/.test(text("[data-tier-row='volt']")), "the ladder: ranges and division floors");
  check(/and top 3%/.test(text("[data-tier-row='storm']")) && /ranked 1 to 500/.test(text("[data-tier-row='top500']")), "the ladder: Storm's and Top 500's conditions");
  check(/Storm and Top 500 must be held: drop out of the top 3% or the top 500 for 3 days/.test(text("[data-cap-rule]")), "the ladder: the caps explained");
  check(text("[data-tier-row='volt'] .rt-tier-share") === "34%" && text("[data-tier-row='top500'] .rt-tier-share") === "500 players", "the ladder: shares from the server's counts");
  check(text("[data-ladder-you] [data-bar-next]") === "122 to Volt I", "the ladder: your bar");
  root.unmount();
  root = await render(React.createElement(TierLadder, { rank: { tier: "surge", division: 1, rating: 1960, top500: null, heldBack: "storm" }, counts: null }));
  check(!!$("[data-held-back='storm']") && /once you’re in the top 3%/.test(text("[data-held-back]")), "held back by Storm's cap: said plainly");
  check(!$(".rt-tier-share") && !/Players/.test(text(".rt-games-head")), "no counts: no Players column");
  root.unmount();
  root = await render(React.createElement(TierLadder, { rank: { tier: "lightning", division: 1, rating: 2810, top500: 37, heldBack: null }, counts }));
  check($$("[data-you]").map((r) => r.getAttribute("data-tier-row")).join() === "top500" && /Top 500 #37/.test(text("[data-tier-row='top500']")), "a Top 500 place: marked there, numbered");
  root.unmount();
  root = await render(React.createElement(TierLadder, { rank: null, counts }));
  check($("[data-ladder-you]")?.getAttribute("data-ladder-you") === "placement" && !$("[data-you]"), "in placement: no place marked");
  root.unmount();
}

/* ------------------------------------------------------------------ 5. the card's pill and Profile */
{
  const root = await render(
    React.createElement(
      "div",
      null,
      React.createElement(PlayerCard, { look: LOOK, name: "A", playerNumber: 42 }),
      React.createElement(PlayerCard, { look: LOOK, name: "B", playerNumber: 42, rank: VOLT2 }),
      React.createElement(PlayerCard, { look: LOOK, name: "C", playerNumber: 42, rank: { tier: "lightning", division: 1, rating: 2810, top500: 37, heldBack: null } }),
      React.createElement(PlayerCard, { look: LOOK, name: "D", playerNumber: null, guest: true, rank: VOLT2 }),
    ),
  );
  const pills = $$("[data-card-pill]");
  check(pills[0]?.textContent === "#0042" && !pills[0]?.hasAttribute("data-card-rank"), "the pill before placement: the player number");
  check(pills[1]?.querySelector(".pcard-pill-label")?.textContent === "Volt II" && pills[1]?.querySelector(".pcard-pill-value")?.textContent === "1,278", "the pill after placement: tier and division, then the rating");
  check((pills[1]?.querySelector(".pcard-pill-label") as HTMLElement | null)?.getAttribute("style")?.includes("var(--jz-tier-volt)") ?? false, "the tier in its tier colour");
  check(pills[2]?.querySelector(".pcard-pill-label")?.textContent === "Top 500 #37", "a Top 500 place in the pill");
  check(pills[3]?.textContent === "Guest", "a guest's pill never shows a rating");
  const css = readFileSync("src/design/identity/playerCardArt.data.ts", "utf8");
  check(/\.pcard-pill-value\{[^}]*font-weight:900[^}]*color:#FFFFFF[^}]*font-variant-numeric:tabular-nums/.test(css), "the rating in bold white even-width digits");
  const tokens = readFileSync("src/design/tokens.css", "utf8");
  check(tiers.TIERS.every((t) => new RegExp(`--jz-tier-${t}:`).test(tokens)), "every tier has its colour token");
  root.unmount();
}
const profileUi = () => React.createElement(ProfileCard, { guestName: "Player", guestColour: 0 });
{
  status = placedStatus();
  await signIn(5);
  const { root, went } = await mount(profileUi, "/profile");
  await settle(60);
  check(text("[data-profile-card] [data-card-pill] .pcard-pill-label") === "Volt II", "Profile: the card's pill shows the tier once placed");
  check(text("[data-profile-rating='placed'] [data-joulz-rating]") === "1,278", "Profile: the Joulz Rating");
  check(text("[data-profile-rating] [data-side='puzzles'] .rt-side-value") === "1,296" && /12 matches/.test(text("[data-profile-rating] [data-side='puzzles']")), "Profile: Puzzles from real data");
  check(text("[data-profile-rating] [data-side='arcade'] .rt-side-value") === "1,231", "Profile: Arcade from real data");
  const strongest = $$("[data-strongest-row]").map((r) => r.getAttribute("data-strongest-row")).join();
  check(strongest === "cat:pattern,cat:word,cat:logic", `Profile: strongest categories from rated matches only, the best three (${strongest})`);
  check(!$("[data-rating-note]"), "Profile: A2's note gives way to the real rating");
  check(!/Trophy cabinet|Season peak/i.test(document.body.textContent ?? ""), "Profile: no trophy cabinet or season peak (wave 4)");
  sent.length = 0;
  await click($("[data-profile-rating] [data-open-tiers]"));
  check(JSON.stringify(sent[0]) === '{"event":"tier_ladder_viewed","from":"profile"}' && went.some((w) => w.to === "/tiers"), "Profile: the rating opens the tiers");
  root.unmount();
}
{
  status = placedStatus({ standing: { ...(placedStatus().standing as Extract<RatedStatus["standing"], { state: "placed" }>), categories: [{ pick: "cat:word", rating: 1300, matches: 0 }] } });
  await signIn(5);
  const { root } = await mount(profileUi, "/profile");
  await settle(60);
  check(!$("[data-strongest]") && !/Strongest categories/.test(document.body.textContent ?? ""), "Profile: no strongest categories without a rated match in one");
  root.unmount();
}
{
  status = placementStatus(["won", "lost"]);
  await signIn(5);
  const { root } = await mount(profileUi, "/profile");
  await settle(60);
  check(text("[data-profile-card] [data-card-pill]") === "#0005", "Profile in placement: the pill keeps the player number");
  check($("[data-profile-rating]")?.getAttribute("data-profile-rating") === "placement" && /Placement 2 of 5/.test(text("[data-profile-rating]")), "Profile in placement: the placement panel");
  check(!$("[data-joulz-rating]") && !$("[data-strongest]"), "Profile in placement: no rating or categories yet");
  root.unmount();
}
{
  status = { ...placedStatus(), open: false };
  await signIn(5);
  const { root } = await mount(profileUi, "/profile");
  await settle(60);
  check(!!$("[data-rating-note]") && !$("[data-profile-rating]"), "Profile without rated play: A2's note, nothing rated");
  check(text("[data-profile-card] [data-card-pill]") === "#0005", "Profile without rated play: the player number");
  root.unmount();
}

/* ------------------------------------------------------------------ 6. no motion under Reduce Motion */
{
  const css = readFileSync("src/polish-layout/rated.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  const outside = css.slice(0, css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  const animated = new Set<string>();
  for (const m of outside.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/(^|;|\s)animation\s*:/.test(m[2]!) || /animation\s*:\s*none/.test(m[2]!)) continue;
    for (const sel of m[1]!.split(",")) animated.add(sel.trim());
  }
  check(animated.size >= 8, `the rated screens' animations found (${animated.size})`);
  for (const sel of animated) check(new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[,{]`).test(reduced), `Reduce Motion stops ${sel}`);
  check(/animation:\s*none/.test(reduced) && /transition:\s*none/.test(reduced), "Reduce Motion: no animation or transition left");
  for (const m of outside.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\n\}/g)) {
    const blocks = m[2]!.split("}").map((b) => b.trim()).filter(Boolean);
    const last = blocks[blocks.length - 1] ?? "";
    check(!/opacity:\s*0[;\s}]/.test(last), `@keyframes ${m[1]} ends visible`);
  }
}

/* ------------------------------------------------------------------ 7. analytics and the production rule */
{
  const { acceptRatedEvent, RATED_EVENTS } = await import("../src/lib/rated/ratedEvents");
  const { ANALYTICS_EVENTS, CLIENT_EVENTS } = await import("../src/lib/analytics/events");
  const five = ["play_card_tapped", "vs_shown", "result_viewed", "next_match_tapped", "tier_ladder_viewed"];
  check(RATED_EVENTS.join() === five.join(), "the five events");
  check(five.every((e) => (ANALYTICS_EVENTS as readonly string[]).includes(e)), "ANALYTICS_EVENTS lists the five");
  check(!five.some((e) => (CLIENT_EVENTS as readonly string[]).includes(e)), "not phone-sendable through the analytics queue");
  check(acceptRatedEvent({ event: "vs_shown", source: "recorded" })?.props?.["source"] === "recorded", "vs_shown: source");
  check(acceptRatedEvent({ event: "next_match_tapped" })?.props === null, "next_match_tapped: no props");
  check(acceptRatedEvent({ event: "play_card_tapped", pick: "word", placement: true })?.props?.["pick"] === "word", "play_card_tapped: a category pick");
  for (const [bad, why] of [
    [{ event: "profile_viewed", who: "guest" }, "an event that isn't one of the five"],
    [{ event: "vs_shown", source: "Sam" }, "free text"],
    [{ event: "play_card_tapped", pick: "Sam's room!", placement: false }, "a pick that isn't a fixed id"],
    [{ event: "result_viewed", outcome: "won", placement: false, rating: 1285 }, "a rating"],
    [{ event: "tier_ladder_viewed", from: "elsewhere" }, "an unknown place"],
  ] as const)
    check(acceptRatedEvent(bad) === null, `refused: ${why}`);
  const sql = readFileSync("supabase/migrations/20261114300000_analytics_rated_screen_events.sql", "utf8");
  check(/'play_card_tapped', 'vs_shown', 'result_viewed', 'next_match_tapped', 'tier_ladder_viewed'/.test(sql) && /pg_get_constraintdef/.test(sql), "the migration adds the five to the list it reads from the table");
  check(/recordEvents\(/.test(readFileSync("src/lib/rated/ratedEvents.functions.ts", "utf8")), "recorded through src/lib/data/events.server.ts's recordEvents");

  const src = readFileSync("src/lib/rated/ratedApi.ts", "utf8");
  const body = src.slice(src.indexOf("export function ratedOverride"));
  const first = body.slice(body.indexOf("{") + 1).split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("//"));
  check(first === "if (import.meta.env.PROD) return null;", `the check-only page override returns null in a production build before reading anything (${first})`);
  check(ratedApi.ratedOverride() === null, "the override is off unless a check's page sets it");
  const home = readFileSync("src/routes/index.tsx", "utf8");
  check(/<RatedHome \/>/.test(home) && /if \(!status\) return null;/.test(readFileSync("src/components/rated/RatedHome.tsx", "utf8")), "Home draws RatedHome, which is nothing for anyone rated play isn't open to");
}

check(consoleErrors.length === 0, `no console errors (${consoleErrors.slice(0, 3).join(" | ")})`);
console.error = origError;
const passed = checks - failures.length;
console.log(`rated-screens-check: ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS");
process.exit(0);
