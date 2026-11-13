/**
 * The rated match screens' fixtures for the screen harness (wave 3, session W3c; theme-check and no-wrap-check through
 * RATED_SCREENS in theme-screens.ts): each screen drawn by the app's own component, in the /rated route's shell
 * (PhoneShell skin "profile", `.rt-page`), from real W3a tier views (tierFor, tierLadder). The longest names on purpose
 * (16-character usernames, the longest title), so a line that would wrap or be cut shows here.
 */
import type { JSX } from "react";

import { PhoneShell } from "@/components/duel/PhoneShell";
import { RatedHomeView } from "@/components/rated/RatedHome";
import { MatchResult, PlacementReveal, Searching, VsScreen } from "@/components/rated/RatedMatchScreens";
import { RatedFrameScore } from "@/components/rated/RatedFrameScore";
import { TierLadder } from "@/components/rated/TierLadder";
import { ProfileRating } from "@/components/rated/ProfileRating";
import type { RatedMatch, RatedPlayer, RatedResult, RatedStatus } from "@/lib/rated/backend";
import type { RankView } from "@/lib/rated/tierDisplay";
import { tierFor, tierLadder } from "@/lib/rated/tiers";
import { abortLine } from "@/lib/rated/rules";
import { EmptyState } from "@/design/components";

export type RatedScreenKey =
  | "home"
  | "home-placement"
  | "searching"
  | "vs-live"
  | "vs-recorded"
  | "header"
  | "result-won"
  | "result-lost"
  | "result-placement"
  | "result-frozen"
  | "reveal"
  | "tiers"
  | "profile"
  | "result-forfeit-stayed"
  | "result-forfeit-left"
  | "aborted";

const rankAt = (r: number): RankView => ({ ...tierFor(r, null), rating: r });
const LOOK = { cardArt: "card-art.joulz-navy", frame: "frame.plain", nameColour: null, avatar: { id: "captain-joulz", colour: 4, gem: null } };
const ME: RatedPlayer = {
  userId: "u-5",
  username: "TheInventor_2026",
  playerNumber: 42,
  look: LOOK,
  title: "Founding Player",
  badges: ["founding-player"],
  rank: rankAt(1278),
  guest: false,
  deleted: false,
};
const SAM: RatedPlayer = {
  userId: "u-7",
  username: "Sam_Speedrunner1",
  playerNumber: 7,
  look: { ...LOOK, avatar: { id: "captain-joulz", colour: 1, gem: null } },
  title: "Arena Champion",
  badges: [],
  rank: rankAt(1296),
  guest: false,
  deleted: false,
};
const SHARES = { top500: 0.0005, lightning: 0.005, storm: 0.03, surge: 0.12, volt: 0.34, charge: 0.32, spark: 0.18 };
const OPTIONS: RatedStatus["options"] = { picks: ["mixed", "puzzles", "arcade"], formats: ["bo3"], bestOf: [3], sizes: [2] };
const PLACED: RatedStatus = {
  open: true,
  guest: false,
  me: ME,
  options: OPTIONS,
  season: null,
  standing: {
    state: "placed",
    rank: ME.rank!,
    puzzles: { rating: 1296, matches: 12 },
    arcade: { rating: 1231, matches: 9 },
    categories: [
      { pick: "pattern", rating: 1350, matches: 4 },
      { pick: "word", rating: 1312, matches: 3 },
      { pick: "retro", rating: 1176, matches: 2 },
    ],
  },
  activeMatchId: null,
} as RatedStatus;
const PLACING: RatedStatus = {
  ...PLACED,
  me: { ...ME, rank: null },
  standing: { state: "placement", results: ["won", "won", "lost"], puzzles: { rating: null, matches: 2 }, arcade: { rating: null, matches: 0 } },
} as RatedStatus;
const MATCH: RatedMatch = {
  id: "m-harness",
  pick: "mixed",
  format: "bo3",
  bestOf: 3,
  roomCode: "RTD2",
  me: ME,
  them: SAM,
  source: { kind: "live" },
  headToHead: { won: 3, lost: 1, drawn: 0 },
  placement: null,
};
// A fixed end for Rematch's 8 s, so the screen reads the same on every run (the harness clock is fixed too).
const REMATCH_UNTIL = new Date(Date.now() + 8000).toISOString();
const RESULT: RatedResult = {
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
  joules: { amount: 120, passLevel: 13 },
  star: null,
  nearMiss: { type: "flow", offBest: 12 },
  friend: true,
  rematchUntil: REMATCH_UNTIL,
  moved: ["puzzles", "arcade"],
  ending: null,
};
const noop = () => undefined;
const challenge = async () => ({ ok: true as const, code: "ABC234" });
const result = (r: RatedResult) => (
  <MatchResult result={r} nowMs={Date.now()} onNext={noop} onRematch={noop} onTiers={noop} onChallenge={challenge} onReveal={noop} />
);

const SCREENS: Record<RatedScreenKey, () => JSX.Element> = {
  home: () => <RatedHomeView status={PLACED} />,
  "home-placement": () => <RatedHomeView status={PLACING} />,
  searching: () => <Searching me={ME} pickText="Mixed, best of 3" progress={{ elapsedMs: 4000, range: 60, recordedAfterMs: 8000 }} onCancel={noop} />,
  "vs-live": () => <VsScreen match={MATCH} nowMs={Date.now()} />,
  "vs-recorded": () => <VsScreen match={{ ...MATCH, headToHead: null, source: { kind: "recorded", label: "Recorded run · 2 h ago" } }} nowMs={Date.now()} />,
  header: () => (
    <div className="game-frame-header" style={{ display: "flex", flexDirection: "column", gap: 24, padding: 20 }}>
      <RatedFrameScore me={{ look: LOOK }} them={{ name: SAM.username, look: SAM.look }} myScore={96} theirScore={88} leftMs={30_000} limitMs={60_000} />
      <RatedFrameScore me={{ look: LOOK }} them={{ name: SAM.username, look: SAM.look }} myScore={148} theirScore={88} leftMs={9_000} limitMs={60_000} />
    </div>
  ),
  "result-won": () => result(RESULT),
  "result-lost": () =>
    result({
      ...RESULT,
      outcome: "lost",
      myGames: 1,
      theirGames: 2,
      rating: { after: rankAt(1268), change: -10, puzzles: { rating: 1286, change: -10 }, arcade: null },
      nearMiss: null,
      friend: false,
    }),
  "result-placement": () =>
    result({
      ...RESULT,
      rating: null,
      placementResults: ["won", "won", "lost", "won"],
      nearMiss: null,
      joules: { amount: 120, passLevel: null },
      match: { ...MATCH, placement: 4 },
    }),
  "result-frozen": () => result({ ...RESULT, rating: null, frozen: "same_opponent_today", moved: [], friend: false }),
  reveal: () => (
    <PlacementReveal
      reveal={{ rank: rankAt(1214), betterThan: 62, puzzles: { rating: 1236, matches: 3 }, arcade: { rating: 1180, matches: 2 }, won: 4, lost: 1 }}
      onNext={noop}
      onTiers={noop}
    />
  ),
  // As the /tiers route draws it: its header, then the ladder.
  tiers: () => (
    <>
      <header className="cz-head">
        <span className="cz-head-title">
          <h1>Tiers</h1>
        </span>
      </header>
      <TierLadder rank={ME.rank!} rungs={tierLadder(SHARES)} />
    </>
  ),
  profile: () => <ProfileRating status={PLACED} />,
  // W3b's leaving rules (12 Nov 2026): a forfeit's result for each side, and the abort notice as /rated draws it.
  "result-forfeit-stayed": () => result({ ...RESULT, ending: { kind: "forfeit", leaverNames: [SAM.username], youLeft: false }, rematchUntil: null }),
  "result-forfeit-left": () =>
    result({
      ...RESULT,
      outcome: "lost",
      myGames: 0,
      theirGames: 1,
      rating: { after: rankAt(1268), change: -10, puzzles: { rating: 1286, change: -10 }, arcade: null },
      nearMiss: null,
      friend: false,
      ending: { kind: "forfeit", leaverNames: [], youLeft: true },
      rematchUntil: null,
    }),
  aborted: () => (
    <EmptyState
      layout="page"
      tone="alert"
      pose="ready"
      heading={1}
      title="Match cancelled"
      body={abortLine([SAM.username], false)}
      action={{ label: "Search now", onClick: noop }}
      data-rated-screen="aborted"
    />
  ),
};

/** The harness's `rated` mode: window.__harnessRated.screen in the /rated route's shell. */
export function RatedHarnessScreen(): JSX.Element {
  const key = (window as unknown as { __harnessRated?: { screen?: RatedScreenKey } }).__harnessRated?.screen ?? "home";
  const Screen = SCREENS[key] ?? SCREENS.home;
  return (
    <PhoneShell skin="profile" bare>
      <div className="rt-page" data-rated-harness={key}>
        <Screen />
      </div>
    </PhoneShell>
  );
}
