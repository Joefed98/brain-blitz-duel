/**
 * rated-screens-check (wave 3, session W3c; happy-dom, ~5 s): the rated match screens against a stand-in for W3a's and
 * W3b's server (setRatedBackend) in their real shapes (W3a's TierView and ladder, W3b's options), in every state; section
 * 8 covers the binding: W3a's frozen reasons as Joe's result lines, guest and deleted opponents, C2's badges, the room
 * header, the placement record and a guest's save-your-progress prompt.
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
import { existsSync, readFileSync } from "node:fs";

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
const tiers = await import("../src/lib/rated/tierDisplay");
const { RatedHome } = await import("../src/components/rated/RatedHome");
const { Searching, VsScreen, MatchResult, PlacementReveal } = await import("../src/components/rated/RatedMatchScreens");
const { RatedFrameScore } = await import("../src/components/rated/RatedFrameScore");
const { TierLadder } = await import("../src/components/rated/TierLadder");
const { ProfileCard } = await import("../src/components/identity/ProfileCard");
const { PlayerCard } = await import("../src/design/identity");

type RatedStatus = import("../src/lib/rated/backend").RatedStatus;
type RatedResult = import("../src/lib/rated/backend").RatedResult;
type RatedMatch = import("../src/lib/rated/backend").RatedMatch;
type RankView = import("../src/lib/rated/tierDisplay").RankView;
type RatedPlayer = import("../src/lib/rated/backend").RatedPlayer;

const $ = (sel: string) => document.querySelector(sel) as unknown as HTMLElement | null;
const $$ = (sel: string) => [...document.querySelectorAll(sel)] as unknown as HTMLElement[];
const text = (sel: string) => ($(sel)?.textContent ?? "").replace(/\s+/g, " ").trim();
const click = async (el: HTMLElement | null) => act(async () => void el?.click());
const settle = async (ms = 30) => act(async () => void (await new Promise((r) => setTimeout(r, ms))));

identityBackend.setIdentityBackend(null);

/* ------------------------------------------------------------------ the stand-in (the real shapes: W3a's TierView, W3b's options) */
const { tierFor, tierLadder } = await import("../src/lib/rated/tiers");
const rankAt = (rating: number, standing: Parameters<typeof tierFor>[1] = null): RankView => ({ ...tierFor(rating, standing), rating });
const LOOK = { cardArt: "card-art.joulz-navy", frame: "frame.plain", nameColour: null, avatar: { id: "captain-joulz", colour: 4, gem: null } };
const VOLT2: RankView = rankAt(1278);
const player = (over: Partial<RatedPlayer>): RatedPlayer => ({
  userId: "u-5",
  username: "TheInventor",
  playerNumber: 42,
  look: LOOK,
  title: "Founding Player",
  badges: [],
  rank: VOLT2,
  guest: false,
  deleted: false,
  ...over,
});
const ME_PLACED = player({});
const SAM = player({ userId: "u-7", username: "Sam", playerNumber: 7, look: { ...LOOK, avatar: { id: "captain-joulz", colour: 1, gem: null } }, title: "Arena Champion", badges: ["founding-player"], rank: rankAt(1296) });
const LAUNCH = { picks: ["mixed", "puzzles", "arcade"], formats: ["bo3"], bestOf: [3], sizes: [2] } as RatedStatus["options"];
const SHARES = { top500: 0.0005, lightning: 0.005, storm: 0.03, surge: 0.12, volt: 0.34, charge: 0.32, spark: 0.18 };

function placedStatus(over: Partial<RatedStatus> = {}): RatedStatus {
  return {
    open: true,
    guest: false,
    me: ME_PLACED,
    options: LAUNCH,
    season: null,
    standing: {
      state: "placed",
      rank: VOLT2,
      puzzles: { rating: 1296, matches: 12 },
      arcade: { rating: 1231, matches: 9 },
      categories: [
        { pick: "pattern", rating: 1350, matches: 4 },
        { pick: "word", rating: 1312, matches: 3 },
        { pick: "logic", rating: 1288, matches: 2 },
        { pick: "retro", rating: 1400, matches: 0 },
        { pick: "speed", rating: 1198, matches: 1 },
      ],
    },
    activeMatchId: null,
    ...over,
  };
}
function placementStatus(results: ("won" | "lost" | null)[]): RatedStatus {
  return {
    ...placedStatus(),
    me: { ...ME_PLACED, rank: null },
    standing: { state: "placement", results, puzzles: { rating: null, matches: 0 }, arcade: { rating: null, matches: 0 } },
  };
}

let status: RatedStatus | null = placedStatus();
const calls: string[] = [];
const MATCH: RatedMatch = {
  id: "m1",
  pick: "mixed",
  format: "bo3",
  bestOf: 3,
  roomCode: "AB2C",
  me: ME_PLACED,
  them: SAM,
  source: { kind: "live" },
  headToHead: null,
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
    outcome: "won",
    rating: { after: rankAt(1285), change: 7, puzzles: { rating: 1303, change: 7 }, arcade: { rating: 1238, change: 7 } },
    frozen: null,
    placementResults: null,
    reveal: null,
    joules: { amount: 150, passLevel: 13 },
    star: null,
    nearMiss: { type: "flow", offBest: 12 },
    friend: false,
    rematchUntil: new Date(Date.now() + 8000).toISOString(),
    moved: ["puzzles", "arcade"],
    ...over,
  };
}
const standIn = {
  status: async () => status,
  search: async () => MATCH,
  match: async () => MATCH,
  result: async () => result(),
  rematch: async () => ({ state: "agreed" as const, match: MATCH }),
  challenge: async (id: string) => {
    calls.push(`challenge ${id}`);
    return { ok: true as const, code: "ABC234" };
  },
  ladder: async () => tierLadder(SHARES),
  roomMatch: async (roomId: string) => (roomId === "room-rated" ? { matchId: "m-from-server", format: "bo3" as const } : null),
  opponentScore: async () => ({ round: 1, score: 88, hidden: false, finished: false }),
  progress: async () => {},
};
ratedBackendMod.setRatedBackend(standIn);

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
  // The hidden finish is W3b's one rule (matchmaking.ts), re-exported: elapsed ≥ 80 % of the game's time.
  const { opponentScoreHidden, HIDDEN_FINISH_SHARE } = rules;
  const mm = await import("../src/lib/rated/matchmaking");
  check(HIDDEN_FINISH_SHARE === 0.2 && opponentScoreHidden === mm.opponentScoreHidden, "the hidden finish is W3b's rule, the final 20 %");
  check(opponentScoreHidden(48_000, 60_000), "60 s game: hidden at exactly 12 s left (20 %)");
  check(!opponentScoreHidden(47_999, 60_000), "60 s game: shown at 12.001 s left");
  check(opponentScoreHidden(60_000, 60_000), "hidden to the buzzer");
  check(!opponentScoreHidden(30_000, 60_000), "shown at half time");
  let inexact = 0;
  for (let limit = 5; limit <= 300_000; limit += 5) if (!opponentScoreHidden(limit - limit / 5, limit) || opponentScoreHidden(limit - limit / 5 - 1, limit)) inexact++;
  check(inexact === 0, `exactly at 20 % for every game length to 300 s (${inexact} off)`);

  check(rules.shownPicks(LAUNCH).join() === "mixed,puzzles,arcade", "launch picks: Mixed, All puzzles, All arcade");
  check(rules.shownPicks({ picks: ["arcade", "word", "nonsense" as never], bestOf: [3], sizes: [2] }).join() === "arcade,word", "only switched-on picks, in order; an unknown one is left out");
  check(rules.shownBestOf({ picks: [], bestOf: [7, 3], sizes: [] }).join() === "3,7", "best-of options: only those on");
  check(rules.defaultPick(LAUNCH, null) === "mixed", "default pick: Mixed");
  check(rules.defaultPick(LAUNCH, "arcade") === "arcade", "default pick: the last one played when still on");
  check(rules.defaultPick(LAUNCH, "word") === "mixed", "default pick: never a switched-off last pick");
  check(rules.headToHeadLine(null, "Sam") === null, "head to head: nothing without the server's record");
  check(rules.headToHeadLine({ won: 3, lost: 1 }, "Sam") === "You lead 3–1", "head to head: you lead");
  check(rules.FROZEN_LINES.under_review === "This match is under review, so ratings didn’t change.", "the review line (Joe, 11 Nov 2026)");
  check(rules.FROZEN_LINES.same_opponent_today === "Ratings don’t change from your 4th match against the same player in a day.", "the 4th-match line (Joe, 11 Nov 2026)");

  const bar = tiers.divisionBar(VOLT2);
  check(bar.here === "Volt II" && bar.next === "122 to Volt I", `1,278 (W3a's tierFor): Volt II, 122 to Volt I (${bar.here}, ${bar.next})`);
  check(Math.abs(bar.fraction - 28 / 150) < 1e-9, "the bar fills across the division");
  check(tiers.divisionBar(rankAt(1450)).next === "50 to Surge III", "Volt I: on to Surge III");
  const held = rankAt(1980, { capsActive: true, stormOk: false, top500Ok: false, rank: 400, share: 0.04 });
  check(held.label === "Surge I" && tiers.divisionBar(held).next === "Storm-rated, top 4%", `held back from Storm: W3a's words (${tiers.divisionBar(held).next})`);
  const top = rankAt(2800, { capsActive: true, stormOk: true, top500Ok: true, rank: 37, share: 0.001 });
  check(top.label === "Top 500 #37" && tiers.divisionBar(top).next === "Top division", "Top 500: numbered, the top");
  check(tiers.divisionBar({ ...rankAt(1080), tier: "volt", division: "III", label: "Volt III", floorGrace: { matchesLeft: 2 } }).next === "Kept for 2 more matches", "the floor grace");
  const rungs = tierLadder(SHARES);
  check(tiers.rungRange(rungs.find((r) => r.tier === "volt")!) === "1,100 to 1,499" && tiers.rungRange(rungs.find((r) => r.tier === "lightning")!) === "2,400 and up", "ranges from W3a's ladder");
  check(tiers.betterThan("volt", rungs) === 50, `better than: the tiers below from real shares (${tiers.betterThan("volt", rungs)})`);
  check(tiers.betterThan("volt", tierLadder()) === null, "better than: nothing without shares");

  // The binding's pure parts.
  const bind = await import("../src/lib/rated/w3Binding");
  check(bind.frozenLineOf({ moved: false, frozen: "flagged_run", flagged: false }) === "under_review", "W3a flagged_run: under review");
  check(bind.frozenLineOf({ moved: false, frozen: null, flagged: true }) === "under_review", "a flagged run: under review");
  check(bind.frozenLineOf({ moved: false, frozen: "same_opponent_today", flagged: false }) === "same_opponent_today", "W3a same_opponent_today: the 4th-match line");
  check(bind.frozenLineOf({ moved: true, frozen: null, flagged: false }) === null, "moved: no line");
  check(bind.nearMissOf([{ type: "flow", myScore: 176, theirScore: 0 }, { type: "racing", myScore: 100, theirScore: 0 }], (t) => (t === "flow" ? 188 : 160))?.offBest === 12, "near miss: the closest game within 15 of its best");
  check(bind.nearMissOf([{ type: "flow", myScore: 190, theirScore: 0 }], () => 188) === null, "near miss: none above the best");
  // W3a's placement results (817c18a0), out of order on purpose: the boxes follow n, a tick, a cross, a dash.
  const w3aResults = [
    { n: 3, matchId: "c", result: "draw" as const, at: "2026-11-11T12:03:00Z" },
    { n: 1, matchId: "a", result: "win" as const, at: "2026-11-11T12:01:00Z" },
    { n: 2, matchId: "b", result: "loss" as const, at: "2026-11-11T12:02:00Z" },
  ];
  const standing = bind.standingOf({
    playerId: "u",
    placement: { played: 3, of: 5, done: false, label: "Placement 4 of 5", results: w3aResults },
    joulz: null,
    tier: null,
    pools: null,
    categories: null,
  });
  check(standing.state === "placement" && standing.results.join() === "won,lost,drawn", `placement: W3a's results in order on every device (${standing.state === "placement" ? standing.results.join() : "placed"})`);
  check(bind.placementBoxesOf(undefined).length === 0 && bind.placementBoxesOf([]).length === 0, "placement: none played, no boxes filled");
  // W3b's head-to-head (0916a5be): wins, losses and draws from the caller's side as the VS line.
  const h2h = bind.headToHeadOf({ wins: 3, losses: 1, draws: 1, played: 5 });
  check(h2h.won === 3 && h2h.lost === 1 && h2h.drawn === 1 && rules.headToHeadLine(h2h, "Sam") === "You lead 3–1", "head to head: W3b's record, you lead");
  check(rules.headToHeadLine(bind.headToHeadOf({ wins: 0, losses: 0, draws: 0, played: 0 }), "Sam") === "First meeting", "head to head: never played, first meeting");
  check(rules.headToHeadLine(bind.headToHeadOf({ wins: 1, losses: 1, draws: 2, played: 4 }), "Sam") === "Level 1–1", "head to head: level");
  check(rules.headToHeadLine(bind.headToHeadOf({ wins: 0, losses: 0, draws: 1, played: 1 }), "Sam") === "Level 0–0", "head to head: only a draw is a meeting, level");
  check(bind.DELETED_PLAYER === "Deleted player", "forgotten accounts show as Deleted player");
}

/* ------------------------------------------------------------------ 2. Home */
const homeUi = () => React.createElement(RatedHome);
for (const [who, n, st] of [
  ["a guest while rated play is testers only (W3b: not open)", null, { ...placedStatus(), open: false }],
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
  // Under automation the real binding stays off (no existing check gains a server call); none at all: nothing.
  ratedBackendMod.setRatedBackend(undefined);
  check((await ratedBackendMod.ratedBackend()) === null, "under automation the real binding stays off unless allowed");
  await signIn(5);
  const { root } = await mount(homeUi);
  check(document.body.innerHTML === "<div></div>", "no server: Home draws nothing rated");
  root.unmount();
}
ratedBackendMod.setRatedBackend(standIn);
{
  // A guest once rated play is for everyone: their energy name with a Guest tag.
  status = placementStatus([]);
  status = { ...status, guest: true, me: { ...status.me, username: "Swift Volt 48", guest: true, userId: "g-1", playerNumber: null, title: null } };
  await signIn(null);
  const { root } = await mount(homeUi);
  check(/Swift Volt 48/.test(text("[data-rank-panel] .rt-rank-name")) && text("[data-guest-tag]") === "Guest", "a guest: the energy name and a Guest tag");
  check(text("[data-rated-play-button]") === "Play placement 1", "a guest plays placement first");
  root.unmount();
}
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
  check(!$("[data-season-line]"), "placed: no season line without a Season pass (D2) to read it from");
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
  check(went.some((w) => w.to === "/rated" && w.search?.["pick"] === "arcade" && w.search?.["format"] === "bo3"), `Play opens /rated with the pick and W3b's format (${JSON.stringify(went)})`);
  sent.length = 0;
  await click($("[data-rank-panel] [data-open-tiers]"));
  check(JSON.stringify(sent[0]) === '{"event":"tier_ladder_viewed","from":"home"}' && went.some((w) => w.to === "/tiers"), "the rating opens the tiers (tier_ladder_viewed from home)");
  root.unmount();
}
{
  // A wider switch: exactly its options, and the best-of control with its two.
  status = placedStatus({ options: { picks: ["mixed", "word", "retro"], formats: ["bo3", "bo5"], bestOf: [3, 5], sizes: [2] } });
  await signIn(5);
  const { root } = await mount(homeUi);
  const seg = $$("[data-best-of-option]").map((b) => b.getAttribute("data-best-of-option")).join();
  check(seg === "3,5", `best of 3 and 5 on: both shown, no 7 (${seg})`);
  await click($("[data-open-picker]"));
  await settle(60);
  const opts = $$("[data-pick-option]").map((b) => b.getAttribute("data-pick-option")).join();
  check(opts === "mixed,word,retro", `a wider switch: exactly its picks (${opts})`);
  check(text("[data-pick-option='word'] .rt-option-rating") === "1,312", "a category shows its own rating");
  root.unmount();
  // 1v1 switched off: no Play card (the 4- and 8-player screens are a later session's).
  status = placedStatus({ options: { picks: ["mixed"], formats: ["ffa8"], bestOf: [], sizes: [8] } });
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
for (const source of [{ kind: "live" }, { kind: "recorded", label: "Recorded run · 2 h ago" }] as const) {
  sent.length = 0;
  const root = await render(React.createElement(VsScreen, { match: { ...MATCH, source }, nowMs: Date.now() }));
  check($("[data-rated-screen='vs']")?.getAttribute("data-source") === source.kind, `VS ${source.kind}`);
  check(
    source.kind === "live" ? !!$("[data-vs-tag='live'] [data-jz='live-tag']") : text("[data-vs-tag='recorded']") === "Recorded run · 2 h ago",
    `VS ${source.kind}: the tag (${text("[data-vs-tag]")})`,
  );
  check($$("[data-vs-side] [data-player-card]").length === 2, `VS ${source.kind}: both player cards`);
  check($$("[data-vs-side] [data-jz='emblem']").length === 2, `VS ${source.kind}: both tier emblems`);
  const pills = $$("[data-vs-side] [data-card-pill]").map((p) => (p.textContent ?? "").trim()).join(" | ");
  check(pills === "Volt II1,296 | Volt II1,278", `VS: each card shows tier and rating (${pills})`);
  check(!$("[data-head-to-head]"), "VS: no record line when there is no record to show (a recorded run)");
  if (source.kind === "live") {
    const withRecord = await render(React.createElement(VsScreen, { match: { ...MATCH, headToHead: { won: 3, lost: 1, drawn: 0 } }, nowMs: Date.now() }));
    check(text("[data-head-to-head]") === "You lead 3–1", "VS live: your record against each other (W3b's ratedHeadToHeadFn)");
    withRecord.unmount();
  }
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
  check(/\+150 ?Joules, pass level 13/.test(text("[data-joules-line]")) && !!$(".joules-line .joules-bolt"), "result: the Joules line in D2's style, with D2's bolt");
  check(!$("[data-earned='star']"), "result: no star tile (C1a's stars come from Practice runs only)");
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
  const lost = result({ outcome: "lost", myGames: 1, theirGames: 2, rating: { after: rankAt(1268), change: -10, puzzles: null, arcade: { rating: 1221, change: -10 } }, star: null, nearMiss: null, joules: null });
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
  check(/\+120 Joules/.test(text("[data-joules-line]")) && !!$(".joules-line .joules-bolt"), "placement result: the Joules line, D2's style");
  check(JSON.stringify(sent[0]) === '{"event":"result_viewed","outcome":"won","placement":true}', "result_viewed placement");
  root.unmount();
}
{
  calls.length = 0;
  const reveal = { rank: rankAt(1214), betterThan: 62, puzzles: { rating: 1236, matches: 3 }, arcade: { rating: 1180, matches: 2 }, won: 4, lost: 1 };
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
  const counts = tierLadder(SHARES);
  let root = await render(React.createElement(TierLadder, { rank: VOLT2, rungs: counts }));
  const rows = $$("[data-tier-row]").map((r) => r.getAttribute("data-tier-row")).join();
  check(rows === "top500,lightning,storm,surge,volt,charge,spark", `the ladder: every tier, top down (${rows})`);
  check($$("[data-tier-row][data-you]").map((r) => r.getAttribute("data-tier-row")).join() === "volt" && /You, Volt II/.test(text("[data-tier-row='volt']")), "the ladder: where you are");
  check(/1,100 to 1,499/.test(text("[data-tier-row='volt']")) && /III 1,100, II 1,250, I 1,400/.test(text("[data-tier-row='volt']")), "the ladder: ranges and division floors");
  check(/and top 3%/.test(text("[data-tier-row='storm']")) && /ranked 1 to 500/.test(text("[data-tier-row='top500']")), "the ladder: Storm's and Top 500's conditions");
  check(/Storm and Top 500 must be held: drop out of the top 3% or the top 500 for 3 days/.test(text("[data-cap-rule]")), "the ladder: the caps explained");
  check(text("[data-tier-row='volt'] .rt-tier-share") === "34%" && text("[data-tier-row='lightning'] .rt-tier-share") === "0.5%", "the ladder: shares from W3a's getTierLadder");
  check(text("[data-ladder-you] [data-bar-next]") === "122 to Volt I", "the ladder: your bar");
  root.unmount();
  root = await render(React.createElement(TierLadder, { rank: rankAt(1960, { capsActive: true, stormOk: false, top500Ok: false, rank: 300, share: 0.04 }), rungs: tierLadder() }));
  check(!!$("[data-held-back]") && /Storm-rated, top 4%: you’ll move up once you hold the place in the top 3%/.test(text("[data-held-back]")), `held back by Storm's cap: said plainly (${text("[data-held-back]")})`);
  check(!$(".rt-tier-share") && !/Players/.test(text(".rt-games-head")), "no counts: no Players column");
  root.unmount();
  root = await render(React.createElement(TierLadder, { rank: rankAt(2810, { capsActive: true, stormOk: true, top500Ok: true, rank: 37, share: 0.001 }), rungs: counts }));
  check($$("[data-you]").map((r) => r.getAttribute("data-tier-row")).join() === "top500" && /Top 500 #37/.test(text("[data-tier-row='top500']")), "a Top 500 place: marked there, numbered");
  root.unmount();
  root = await render(React.createElement(TierLadder, { rank: null, rungs: counts }));
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
      React.createElement(PlayerCard, { look: LOOK, name: "C", playerNumber: 42, rank: rankAt(2810, { capsActive: true, stormOk: true, top500Ok: true, rank: 37, share: 0.001 }) }),
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
  check(["spark", "charge", "volt", "surge", "storm", "lightning"].every((t) => new RegExp(`--jz-tier-${t}:`).test(tokens)), "every tier has its colour token");
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
  check(strongest === "pattern,word,logic", `Profile: strongest categories from rated matches only, the best three (${strongest})`);
  check(!$("[data-rating-note]"), "Profile: A2's note gives way to the real rating");
  check(!/Trophy cabinet|Season peak/i.test(document.body.textContent ?? ""), "Profile: no trophy cabinet or season peak (wave 4)");
  sent.length = 0;
  await click($("[data-profile-rating] [data-open-tiers]"));
  check(JSON.stringify(sent[0]) === '{"event":"tier_ladder_viewed","from":"profile"}' && went.some((w) => w.to === "/tiers"), "Profile: the rating opens the tiers");
  root.unmount();
}
{
  status = placedStatus({ standing: { ...(placedStatus().standing as Extract<RatedStatus["standing"], { state: "placed" }>), categories: [{ pick: "word", rating: 1300, matches: 0 }] } });
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

/* ------------------------------------------------------------------ 8. the binding's screens (11 Nov 2026) */
{
  const bind = await import("../src/lib/rated/w3Binding");
  const w3aResultsAll = [
    { n: 2, matchId: "b", result: "loss" as const, at: "2026-11-11T12:02:00Z" },
    { n: 1, matchId: "a", result: "win" as const, at: "2026-11-11T12:01:00Z" },
    { n: 3, matchId: "c", result: "draw" as const, at: "2026-11-11T12:03:00Z" },
  ];
  // Joe's result lines: W3a's reason a match moved nothing.
  for (const [frozen, line] of [
    ["under_review", "This match is under review, so ratings didn’t change."],
    ["same_opponent_today", "Ratings don’t change from your 4th match against the same player in a day."],
  ] as const) {
    const root = await render(resultEl(result({ frozen, rating: null })));
    check(text("[data-frozen]") === line && !$("[data-rating-panel]"), `a frozen match (${frozen}): the line, no rating change`);
    root.unmount();
  }
  const moved = await render(resultEl(result()));
  check(!$("[data-frozen]"), "a match that moved ratings: no frozen line");
  moved.unmount();

  // Opponents: a guest under their energy name with the Guest tag; a forgotten account as "Deleted player".
  const guest = player({ userId: "g-9", username: "Swift Volt 48", playerNumber: null, title: null, rank: null, guest: true });
  let root = await render(React.createElement(VsScreen, { match: { ...MATCH, them: guest }, nowMs: Date.now() }));
  check(/Swift Volt 48/.test(text("[data-vs-side='them'] [data-card-name]")) && text("[data-vs-side='them'] [data-card-pill]") === "Guest", "a guest opponent: the energy name, Guest on the card");
  check(text("[data-vs-side='them'] .rt-vs-tier") === "Guest", "a guest opponent: Guest under the emblem");
  root.unmount();
  const gone = player({ userId: null, username: "Deleted player", playerNumber: null, title: null, rank: null, deleted: true });
  root = await render(React.createElement(VsScreen, { match: { ...MATCH, them: gone, source: { kind: "recorded", label: "Recorded run · 3 days ago" } }, nowMs: Date.now() }));
  check(text("[data-vs-side='them'] [data-card-name]") === "Deleted player" && !$("[data-vs-side='them'] [data-card-rank]"), "a forgotten account: Deleted player, no rank");
  root.unmount();

  // C2's badges on the cards.
  root = await render(React.createElement(VsScreen, { match: MATCH, nowMs: Date.now() }));
  check($("[data-vs-side='them'] [data-card-badges]")?.getAttribute("data-card-badges") === "founding-player", "C2's badges on the opponent's card");
  root.unmount();

  // The room's header: W3b's opponent score, hidden when the server says so.
  const { RatedRoomScore } = await import("../src/components/rated/RatedFrameScore");
  standIn.opponentScore = async () => ({ round: 2, score: 140, hidden: true, finished: false });
  root = await render(React.createElement(RatedRoomScore, { matchId: "m1", round: 2, storedScore: 151, leftMs: 30_000, limitMs: 60_000, active: false }));
  await settle(80);
  check($("[data-frame-score]")?.getAttribute("data-rated-score") === "hidden" && /151/.test(text("[data-score-row='me']")), "the room header: the server's hidden flag, your stored score");
  root.unmount();
  standIn.opponentScore = async () => ({ round: 2, score: 140, hidden: false, finished: false });
  root = await render(React.createElement(RatedRoomScore, { matchId: "m1", round: 2, storedScore: null, leftMs: 30_000, limitMs: 60_000, active: false }));
  await settle(80);
  check(/140/.test(text("[data-score-row='them']")) && /Sam/.test(text("[data-score-row='them']")), "the room header: the opponent's live score and name");
  root.unmount();

  const room = readFileSync("src/routes/duel.$code.tsx", "utf8");
  check(room.includes("const ratedMatchId = useRatedRoom(roomCode, duel?.id ?? null);") && /ratedMatchId && !isMulti \? \(\s*\/\/[^\n]*\n\s*<RatedRoomScore/.test(room), "the room route: the rated header only for a rated match");
  check(/if \(duel\.status === "finished" && ratedMatchId\) \{\s*return <RatedRoomHandOff/.test(room), "the room route: a finished rated room hands over to the result");
  const ratedRoom = await import("../src/lib/rated/ratedRoom");
  check(ratedRoom.ratedMatchForRoom("ZZZZ") === null, "an ordinary room is never rated");
  ratedRoom.noteRatedRoom("ab2c", "m1");
  check(ratedRoom.ratedMatchForRoom("AB2C") === "m1", "a room opened from VS is the rated match's");

  // Placement boxes from W3a's results: a tick on green, a cross on red, a dash for a draw.
  const parts = await import("../src/components/rated/RatedParts");
  root = await render(React.createElement(parts.PlacementBoxes, { results: bind.placementBoxesOf(w3aResultsAll) }));
  check($$("[data-placement-boxes] li").map((b) => b.getAttribute("data-box")).join() === "won,lost,drawn,next,later", "placement boxes: W3a's results drawn on every device");
  root.unmount();
  check(!existsSync("src/lib/rated/placementRecord.ts"), "no device-only placement record any more (W3a's results instead)");
  // Game code publishes the live score through an import-free module, so it reaches nothing rated (economy-neutral-check).
  check(!/^import /m.test(readFileSync("src/lib/rated/liveScore.ts", "utf8")), "liveScore.ts imports nothing");
  check(
    readFileSync("src/components/puzzles/ArcadeCanvasStage.tsx", "utf8").includes('from "@/lib/rated/liveScore"') &&
      !readFileSync("src/components/puzzles/ArcadeCanvasStage.tsx", "utf8").includes("@/lib/rated/ratedRoom"),
    "the arcade stage reaches only the live-score store, never the rated lookup",
  );

  // The room's rated match from W3b's ratedRoomFn (0916a5be): any tab, device or reload gets the header back.
  const { useRatedRoom } = ratedRoom;
  const seen: (string | null)[] = [];
  const Probe = ({ code, roomId }: { code: string; roomId: string | null }) => {
    seen.push(useRatedRoom(code, roomId));
    return null;
  };
  root = await render(React.createElement(Probe, { code: "QR7T", roomId: "room-rated" }));
  await settle(60);
  check(seen[seen.length - 1] === "m-from-server" && ratedRoom.ratedMatchForRoom("QR7T") === "m-from-server", "a rated room opened elsewhere: W3b names its match, remembered for this tab");
  root.unmount();
  seen.length = 0;
  root = await render(React.createElement(Probe, { code: "ZZ9Z", roomId: "room-plain" }));
  await settle(60);
  check(seen.every((x) => x === null) && ratedRoom.ratedMatchForRoom("ZZ9Z") === null, "an ordinary room: W3b answers null, nothing changes");
  root.unmount();

  // A guest's first rated match: the save-your-progress prompt, "Save your rating and stars", on the next tab page.
  const sp = await import("../src/lib/account/saveProgress");
  localStorage.removeItem(sp.SAVE_PROGRESS_KEY);
  await signIn(null);
  const { FinishedGameCounter } = await import("../src/components/account/SaveProgress");
  root = await render(React.createElement(FinishedGameCounter, { gameKey: "rated:m9", from: "rated" }));
  await settle(40);
  const rec2 = sp.readSaveProgress();
  check(rec2.finished === 1 && rec2.pending === "sheet" && rec2.pendingFrom === "rated", `a guest's rated match counts and makes the prompt due (${JSON.stringify(rec2)})`);
  root.unmount();
  check(readFileSync("src/routes/rated.tsx", "utf8").includes('<FinishedGameCounter gameKey={`rated:${result.match.id}`} from="rated" />'), "counted from the rated result, as rooms and the Daily do (the prompt shows on a tab page, never here)");
  check(readFileSync("src/components/account/SaveProgress.tsx", "utf8").includes('from === "rated" ? "Save your rating and stars"'), "the sheet says “Save your rating and stars” after a rated match");
}


/* ------------------------------------------------------------------ 9. the route's format switch (W3d plugs in here) */
{
  const fs = await import("../src/components/rated/formatScreens");
  const screens = await import("../src/components/rated/RatedMatchScreens");
  check(["bo3", "bo5", "bo7"].every((f) => fs.formatKind(f as never) === "duel") && ["ffa4", "ffa8"].every((f) => fs.formatKind(f as never) === "placings"), "formats: bo3/5/7 a 1v1, ffa4/8 placings");
  const duel = fs.screensFor("bo3");
  check(duel?.Search === screens.Searching && duel?.Result === screens.MatchResult && duel?.vs === true, "a 1v1: Searching, VS and MatchResult");
  check(fs.screensFor("ffa8") === null, "4 and 8 players: no screens until W3d fills the placings row (the route refuses such a link)");
  const route = readFileSync("src/routes/rated.tsx", "utf8");
  check(route.includes("screensFor(search.format)") && route.includes("screensFor(result.match.format)?.Result") && !route.includes("<MatchResult") && !route.includes("<Searching"), "the route picks its screens by format only");
  const rated = await import("../src/routes/rated");
  const validate = (rated.Route.options as unknown as { validateSearch: (s: Record<string, unknown>) => { format?: string } }).validateSearch;
  check(validate({ format: "bo5" }).format === "bo5" && validate({ bestOf: 3 }).format === "bo3" && validate({ format: "nonsense" }).format === undefined, "the route reads W3b's format (an older bestOf link as bo3)");
}

/* ------------------------------------------------------------------ 10. Challenge for friends only (11 Nov 2026) */
{
  const bind = await import("../src/lib/rated/w3Binding");
  const friendsApiMod = await import("../src/lib/friends/friendsApi");
  const live: RatedMatch = { ...MATCH, source: { kind: "live" } };
  const recorded: RatedMatch = { ...MATCH, source: { kind: "recorded", label: "Recorded run · 2 h ago" } };
  const guestThem: RatedMatch = { ...MATCH, them: { ...SAM, guest: true } };
  const guestMe: RatedMatch = { ...MATCH, me: { ...ME_PLACED, guest: true } };
  const deleted: RatedMatch = { ...MATCH, them: { ...SAM, deleted: true, userId: null } };
  check(bind.challengeAllowed(live, "friends"), "Challenge: a live opponent who is a friend");
  check(!bind.challengeAllowed(recorded, "friends"), "Challenge: never for a recorded run, even a friend's");
  check(!bind.challengeAllowed(guestThem, "friends"), "Challenge: never for a guest opponent");
  check(!bind.challengeAllowed(guestMe, "friends"), "Challenge: never when you play as a guest");
  check(!bind.challengeAllowed(deleted, "friends"), "Challenge: never for a deleted player");
  check(["none", "requested", "incoming", "blocked", "self", null].every((r) => !bind.challengeAllowed(live, r)), "Challenge: never for a non-friend (no relation, a request either way, blocked)");

  // B1's relation through its own phone API (friends-ui-check's stand-in): asked only for a live account opponent.
  const asked: string[] = [];
  let relation = "friends";
  friendsApiMod.setFriendsFunctionsForChecks({
    friendProfileFn: (async ({ data }: { data: { playerId: string } }) => {
      asked.push(data.playerId);
      return { ok: true, profile: { relation } };
    }) as never,
  });
  check((await bind.friendRelation(live)) === "friends" && asked.join() === "u-7", "B1 asked about the live opponent: friends");
  relation = "none";
  check(!bind.challengeAllowed(live, await bind.friendRelation(live)), "B1 says not friends: no Challenge");
  asked.length = 0;
  relation = "friends";
  check((await bind.friendRelation(recorded)) === null && (await bind.friendRelation(guestThem)) === null && (await bind.friendRelation(guestMe)) === null && (await bind.friendRelation(deleted)) === null && asked.length === 0, "a recorded run, a guest or a deleted player: B1 never asked, no Challenge");
  friendsApiMod.setFriendsFunctionsForChecks({ friendProfileFn: (async () => ({ ok: false, reason: "error" })) as never });
  check(!bind.challengeAllowed(live, await bind.friendRelation(live)), "B1 can't answer: no Challenge");
  friendsApiMod.setFriendsFunctionsForChecks(null);

  const src = readFileSync("src/lib/rated/w3Binding.ts", "utf8");
  check(src.includes("friend: challengeAllowed(match, await friendRelation(match)),"), "the result's Challenge comes from B1's friendship");
  check(/async challenge\(matchId\)[\s\S]*?challengeAllowed\(match, await friendRelation\(match\)\)[\s\S]*?challengeFromRoom\(v\.roomId\)[\s\S]*?friendsApi\.challenge\(match\.them\.userId, made\.code\)/.test(src), "Challenge is asked again before it is made, then made by the existing flow and sent to the friend");

  // On the screen: shown for a friend, hidden for each of the others.
  const { MatchResult } = await import("../src/components/rated/RatedMatchScreens");
  const el = (r: RatedResult) =>
    React.createElement(MatchResult, { result: r, nowMs: Date.now(), onNext: () => {}, onRematch: () => {}, onTiers: () => {}, onChallenge: async () => ({ ok: true as const, code: "ABC234" }), onReveal: () => {} });
  for (const [name, m, friend] of [
    ["a live friend", live, true],
    ["a recorded run", recorded, false],
    ["a guest", guestThem, false],
    ["a non-friend", live, false],
  ] as const) {
    const root = await render(el(result({ match: m, friend: bind.challengeAllowed(m, friend ? "friends" : "none"), rematchUntil: null })));
    check(!!$("[data-rated-challenge]") === friend, `result screen: ${friend ? "Challenge shown" : "no Challenge"} for ${name}`);
    root.unmount();
  }
}

/* ------------------------------------------------------------------ 11. 4- and 8-player matches: Search's format, Between */
{
  const fs = await import("../src/components/rated/formatScreens");
  const between = await import("../src/lib/rated/between");
  const { RatedBetween, betweenFor } = await import("../src/components/rated/RatedBetween");
  const route = readFileSync("src/routes/rated.tsx", "utf8");
  check(/<Search\s+me=\{status\.me\}\s+format=\{format\}\s+pick=\{pick \?\? null\}/.test(route), "Search is passed W3b's format (ffa4 / ffa8), not just the pick text");
  // A Search screen sees the format: the route's props type carries it.
  const seen: { format?: string }[] = [];
  const FakeSearch = (p: import("../src/components/rated/formatScreens").SearchScreenProps) => {
    seen.push({ format: p.format });
    return null;
  };
  let root = await render(React.createElement(FakeSearch, { me: ME_PLACED, format: "ffa8", pick: "mixed", pickText: "Mixed, 8 players", progress: null, onCancel: () => {} }));
  check(seen[0]?.format === "ffa8", "a Search screen reads ffa8 from its props");
  root.unmount();

  // The time to the next game, from the room's own phase clock.
  check(between.msUntilNextGame("result", 0, 1, 4) === 8000 + 10000, "Between: from the round result, its 8 s and the standings' 10 s");
  check(between.msUntilNextGame("result", 3000, 1, 4) === 5000 + 10000, "Between: counts down through the round result");
  check(between.msUntilNextGame("standings", 4000, 2, 4) === 6000, "Between: then down through the standings");
  check(between.msUntilNextGame("standings", 12000, 2, 4) === 0, "Between: never below 0");
  check(between.msUntilNextGame("standings", 0, 4, 4) === null && between.msUntilNextGame("result", 0, 4, 4) === null, "Between: no next game after the last");
  check(between.isBetweenPhase("result") && between.isBetweenPhase("standings") && !between.isBetweenPhase("puzzle") && !between.isBetweenPhase("reveal"), "Between: only between games");

  // RatedBetween draws the slot's Between with the match, its games and the time to the next game.
  const got: Record<string, unknown>[] = [];
  const FakeBetween = (p: import("../src/components/rated/formatScreens").BetweenScreenProps) => {
    got.push({ ...p });
    return React.createElement("p", { "data-fake-between": "" }, "standings");
  };
  const slot = (f: string) => (f === "ffa4" || f === "ffa8" ? { Search: FakeSearch, Result: () => null, Between: FakeBetween, vs: false } : fs.screensFor(f as never));
  root = await render(React.createElement(RatedBetween, { matchId: "m-multi", format: "ffa4", phase: "standings", elapsedMs: 2500, round: 2, totalRounds: 4, screens: slot as never }));
  const p = got[got.length - 1] ?? {};
  check(!!$("[data-rated-between='ffa4'] [data-fake-between]"), "a 4-player match: the slot's Between is drawn between games");
  check(p.matchId === "m-multi" && p.format === "ffa4" && p.game === 2 && p.games === 4 && p.msUntilNext === 7500, `Between is given the match, the games and 7.5 s to the next game (${JSON.stringify(p)})`);
  root.unmount();
  root = await render(React.createElement(RatedBetween, { matchId: "m-multi8", format: "ffa8", phase: "result", elapsedMs: 0, round: 8, totalRounds: 8, screens: slot as never }));
  check(!!$("[data-rated-between='ffa8']") && got[got.length - 1]?.msUntilNext === null, "an 8-player match after its last game: Between with no next game");
  root.unmount();
  root = await render(React.createElement(RatedBetween, { matchId: "m1", format: "bo3", phase: "standings", elapsedMs: 0, round: 1, totalRounds: 3, screens: slot as never }));
  check(!$("[data-rated-between]") && betweenFor("bo3", slot as never) === null, "a 1v1: no Between (the room's own screens play)");
  root.unmount();

  // The room route: Between in place of the round result and standings for a rated 4- or 8-player match only.
  const room = readFileSync("src/routes/duel.$code.tsx", "utf8");
  const branch = room.indexOf("if (ratedMatchId && ratedFormat && isBetweenPhase(phase) && betweenFor(ratedFormat))");
  check(branch > 0 && branch < room.indexOf('if (phase === "result") {') && room.includes("const ratedFormat = useRatedRoomFormat(roomCode, ratedMatchId);"), "the room route draws Between before its own result and standings, for a rated room with a Between");
  check(/<RatedBetween[\s\S]*?elapsedMs=\{now - \(phaseStart \?\? now\)\}[\s\S]*?totalRounds=\{duel\.round_count \?\? TOTAL_ROUNDS\}/.test(room), "the room route passes its phase clock and the match's games");

  // The room's format, noted beside its match (this tab) or from W3b's ratedRoomFn.
  const ratedRoomMod = await import("../src/lib/rated/ratedRoom");
  ratedRoomMod.noteRatedRoom("FF8X", "m-8", "ffa8");
  check(ratedRoomMod.ratedFormatForRoom("ff8x") === "ffa8", "the room's format is noted with its match");
  sessionStorage.setItem("duelz-rated-room-format:v1:BAD1", "nonsense");
  check(ratedRoomMod.ratedFormatForRoom("BAD1") === null && ratedRoomMod.ratedFormatForRoom("NONE") === null, "an unknown or missing format reads as none");
  check(ratedRoomMod.ratedFormatForRoom("QR7T") === "bo3", "a room found through W3b's ratedRoomFn keeps its format too");
  check(readFileSync("src/routes/rated.tsx", "utf8").includes("noteRatedRoom(match.roomCode, match.id, match.format);"), "the rated route notes the match's format as it opens the room");
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
