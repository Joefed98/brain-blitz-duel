/**
 * Review frames of the rated match screens (wave 3, session W3c; a tool, not a check): every screen in its states,
 * drawn from fixtures with the app's own components and the production stylesheet, at 390 px wide (2x), for laying
 * beside docs/mockups/wave-3/.
 *
 *   bun run build                                   (once, for the stylesheet)
 *   bun scripts/shots/rated-shots.tsx [--out=.shots/rated] [--css=<built styles css>] [--reduced]
 *
 * Static markup only (renderToStaticMarkup): no effect runs, so no event is recorded and no sound plays; with
 * --reduced the page is drawn under prefers-reduced-motion. Animations are drawn at their end (the frames are taken
 * after 1.5 s).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const out = resolve(arg("out") ?? ".shots/rated");
const reduced = process.argv.includes("--reduced");
const cssFile =
  arg("css") ??
  readdirSync(".output/public/assets")
    .filter((f) => /^styles-.*\.css$/.test(f))
    .map((f) => join(".output/public/assets", f))
    .sort((a, b) => statSync(b).size - statSync(a).size)[0];
if (!cssFile) throw new Error("No built stylesheet: run `bun run build` first, or pass --css=<file>.");
mkdirSync(out, { recursive: true });

const React = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } = await import("@tanstack/react-router");
const { RatedHomeView, RatedPicker } = await import("../../src/components/rated/RatedHome");
const { Searching, VsScreen, MatchResult, PlacementReveal } = await import("../../src/components/rated/RatedMatchScreens");
const { RatedFrameScore } = await import("../../src/components/rated/RatedFrameScore");
const { TierLadder } = await import("../../src/components/rated/TierLadder");
const { ProfileRating } = await import("../../src/components/rated/ProfileRating");
const { CARD_CHROME_CSS } = await import("../../src/design/identity/playerCardArt.data");

type RatedStatus = import("../../src/lib/rated/backend").RatedStatus;
type RatedResult = import("../../src/lib/rated/backend").RatedResult;
type RankView = import("../../src/lib/rated/tierDisplay").RankView;

const LOOK = { cardArt: "card-art.joulz-navy", frame: "frame.plain", nameColour: null, avatar: { id: "captain-joulz", colour: 4, gem: null } };
const { tierFor, tierLadder } = await import("../../src/lib/rated/tiers");
const rankAt = (r: number, s: Parameters<typeof tierFor>[1] = null): RankView => ({ ...tierFor(r, s), rating: r });
const VOLT2: RankView = rankAt(1278);
const ME = { userId: "u-5", username: "TheInventor", playerNumber: 42, look: LOOK, title: "Founding Player", badges: ["founding-player"], rank: VOLT2, guest: false, deleted: false };
const SAM = { userId: "u-7", username: "Sam", playerNumber: 7, look: { ...LOOK, frame: "frame.neon-circuit", avatar: { id: "captain-joulz", colour: 1, gem: null } }, title: "Arena Champion", badges: [], rank: rankAt(1296), guest: false, deleted: false };
const SHARES = { top500: 0.0005, lightning: 0.005, storm: 0.03, surge: 0.12, volt: 0.34, charge: 0.32, spark: 0.18 };
const placed: RatedStatus = {
  open: true,
  guest: false,
  me: ME,
  options: { picks: ["mixed", "puzzles", "arcade"], bestOf: [3], sizes: [2] },
  season: null,
  standing: {
    state: "placed",
    rank: VOLT2,
    puzzles: { rating: 1296, matches: 12 },
    arcade: { rating: 1231, matches: 9 },
    categories: [
      { pick: "pattern", rating: 1350, matches: 4 },
      { pick: "word", rating: 1312, matches: 3 },
      { pick: "retro", rating: 1176, matches: 2 },
    ],
    won: 12,
    lost: 9,
  },
  activeMatchId: null,
};
const placing: RatedStatus = {
  ...placed,
  me: { ...ME, rank: null },
  standing: { state: "placement", results: ["won", "won", "lost"], puzzles: { rating: null, matches: 2 }, arcade: { rating: null, matches: 0 } },
};
const match = { id: "m", pick: "mixed" as const, bestOf: 3 as const, me: ME, them: SAM, source: { kind: "live" as const }, headToHead: { won: 3, lost: 1 }, placement: null };
const result: RatedResult = {
  match,
  games: [
    { type: "wordsearch", myScore: 168, theirScore: 151 },
    { type: "racing", myScore: 142, theirScore: 171 },
    { type: "flow", myScore: 188, theirScore: 176 },
  ],
  myGames: 2,
  theirGames: 1,
  outcome: "won",
  frozen: null,
  moved: ["puzzles", "arcade"],
  rating: { after: rankAt(1285), change: 7, puzzles: { rating: 1303, change: 7 }, arcade: { rating: 1238, change: 7 } },
  placementResults: null,
  reveal: null,
  joules: { amount: 120, passLevel: 13 },
  star: { type: "wordsearch" },
  nearMiss: { type: "flow", offBest: 12 },
  friend: true,
  rematchUntil: new Date(Date.now() + 8000).toISOString(),
};
const noop = () => {};
const challenge = async () => ({ ok: true as const, code: "ABC234" });

const screens: [string, () => React.ReactElement][] = [
  ["01-home-placed", () => React.createElement(RatedHomeView, { status: placed })],
  ["02-picker", () => React.createElement(RatedPicker, { status: placed, value: "mixed", onPick: noop, onClose: noop })],
  ["03-searching", () => React.createElement(Searching, { me: ME, pickText: "Mixed, best of 3", progress: { elapsedMs: 4000, range: 60, recordedAfterMs: 8000 }, onCancel: noop })],
  ["04-vs-live", () => React.createElement(VsScreen, { match, nowMs: Date.now() })],
  ["04-vs-recorded", () => React.createElement(VsScreen, { match: { ...match, source: { kind: "recorded", label: "Recorded run · 2 h ago" } }, nowMs: Date.now() })],
  [
    "05-06-header",
    () =>
      React.createElement(
        "div",
        { className: "game-frame-header", style: { display: "flex", flexDirection: "column", gap: 24, padding: 20 } },
        ...[30_000, 12_000].map((left) =>
          React.createElement(RatedFrameScore, { key: left, me: { look: LOOK }, them: { name: "Sam", look: SAM.look }, myScore: left > 12_000 ? 96 : 148, theirScore: 88, leftMs: left, limitMs: 60_000 }),
        ),
      ),
  ],
  ["07-result-won", () => React.createElement(MatchResult, { result, nowMs: Date.now(), onNext: noop, onRematch: noop, onTiers: noop, onChallenge: challenge, onReveal: noop })],
  [
    "07-result-lost",
    () =>
      React.createElement(MatchResult, {
        result: { ...result, outcome: "lost", myGames: 1, theirGames: 2, rating: { after: rankAt(1268), change: -10, puzzles: { rating: 1286, change: -10 }, arcade: null }, star: null, nearMiss: null, friend: false },
        nowMs: Date.now(),
        onNext: noop,
        onRematch: noop,
        onTiers: noop,
        onChallenge: challenge,
        onReveal: noop,
      }),
  ],
  ["11-home-placement", () => React.createElement(RatedHomeView, { status: placing })],
  [
    "12-placement-result",
    () =>
      React.createElement(MatchResult, {
        result: { ...result, rating: null, placementResults: ["won", "won", "lost", "won"], star: null, nearMiss: null, joules: { amount: 120, passLevel: null }, match: { ...match, placement: 4 } },
        nowMs: Date.now(),
        onNext: noop,
        onRematch: noop,
        onTiers: noop,
        onChallenge: challenge,
        onReveal: noop,
      }),
  ],
  [
    "13-reveal",
    () =>
      React.createElement(PlacementReveal, {
        reveal: { rank: rankAt(1214), betterThan: 62, puzzles: { rating: 1236, matches: 3 }, arcade: { rating: 1180, matches: 2 }, won: 4, lost: 1 },
        onNext: noop,
        onTiers: noop,
      }),
  ],
  ["14-tiers", () => React.createElement(TierLadder, { rank: VOLT2, rungs: tierLadder(SHARES) })],
  ["14-tiers-held-back", () => React.createElement(TierLadder, { rank: rankAt(1960, { capsActive: true, stormOk: false, top500Ok: false, rank: 300, share: 0.04 }), rungs: tierLadder() })],
  ["profile-placed", () => React.createElement(ProfileRating, { status: placed })],
];

async function markup(ui: () => React.ReactElement): Promise<string> {
  const { Outlet } = await import("@tanstack/react-router");
  const rootRoute = createRootRoute({ component: () => React.createElement(Outlet) });
  const route = createRoute({ getParentRoute: () => rootRoute, path: "/", component: ui });
  const router = createRouter({ routeTree: rootRoute.addChildren([route]), history: createMemoryHistory({ initialEntries: ["/"] }) });
  await router.load();
  return renderToStaticMarkup(React.createElement(RouterProvider, { router } as never));
}

const css = readFileSync(cssFile, "utf8").replaceAll("url(/fonts/", `url(${resolve("public/fonts")}/`);
const { chromium } = await import("playwright");
const CHROMIUM = [process.env["PLAYWRIGHT_CHROMIUM"], "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find((p): p is string => Boolean(p && existsSync(p)));
const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: reduced ? "reduce" : "no-preference" });
for (const [name, ui] of screens) {
  const body = await markup(ui);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}\n${CARD_CHROME_CSS.replaceAll("url(\"/fonts/", `url("${resolve("public/fonts")}/`)}</style></head><body style="margin:0;background:var(--jz-bg)"><div class="rt-page" style="min-height:844px">${body}</div></body></html>`;
  const file = join(out, `${name}.html`);
  writeFileSync(file, html);
  await page.goto(`file://${file}`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, `${name}${reduced ? "-reduced" : ""}.png`), fullPage: true });
  console.log(`${name}`);
}
await browser.close();
console.log(`rated-shots: ${screens.length} frames in ${out}`);
