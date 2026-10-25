/**
 * Screenshots for the screen audit (docs/screen-audit.md, 25 Oct 2026; a design tool, not a check):
 * every non-gameplay screen in realistic states at 414×896 (an iPhone 11 home-screen app with its
 * 48/34 px insets) and 375×667 (iPhone SE Safari), drawn on the real routes through the screen harness
 * (scripts/safe-area-harness.tsx, network stubbed; the theme screens' fixtures), plus one overview
 * sheet per group. JPEG at 1×.
 *
 *   bun scripts/shots/screen-audit-shots.ts [--out=screenshots/screen-audit] [--only=<group,…>]
 *
 * The 404 page is the root route's own component and is not drawn by the harness: it needs the app's
 * dev server (`--app=<origin>`, e.g. `bun run dev`); without one it is left out.
 */
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

import { startSafeAreaServer } from "../safe-area-server";
import { DEVICE_INIT } from "../device-emulation";
import { dailyFixture, type HarnessDaily } from "../daily-fixture";
import { CHALLENGE_CODE, challengeFixture, type ChallengeScreenData } from "../challenge-fixture";
import { CHROMIUM_PATHS, IPHONE_SAFARI_UA, PUZZLE } from "../theme-screens";
import { ONBOARDING_KEY } from "../../src/lib/onboarding";
import { generatePuzzle } from "../../src/lib/duel/generate.server";
import { bankedIntroExample } from "../../src/lib/duel/puzzleBank.server";
import { withSeededRandom } from "../../src/lib/duel/random";
import { splitPuzzle } from "../../src/lib/duel/secrets";
import { currentPracticeStamp } from "../../src/lib/duel/practiceStamps";
import { GAME_COLUMN_LAYOUT, INTRO_EXAMPLE_SEED } from "../../src/lib/duel/puzzleDemo";
import { puzzlePresentation } from "../../src/components/puzzles/wordInput";
import type { PuzzleData, PuzzleType } from "../../src/lib/duel/types";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const OUT = arg("out") ?? "screenshots/screen-audit";
const ONLY = arg("only")?.split(",");
const APP = arg("app");
const CHROMIUM = CHROMIUM_PATHS.find((path): path is string => Boolean(path && existsSync(path)));
mkdirSync(OUT, { recursive: true });

const pub = (p: PuzzleData) => splitPuzzle(p).pub as PuzzleData;
const dealt = (type: PuzzleType, seed = 41) => pub(withSeededRandom(seed, () => generatePuzzle(type)));
const iso = (ms: number) => new Date(ms).toISOString();

/* ------------------------------------------------------------------ viewports */

interface Viewport {
  key: string;
  w: number;
  h: number;
  insets?: { top: number; bottom: number };
}
const VIEWPORTS: Viewport[] = [
  { key: "414x896", w: 414, h: 896, insets: { top: 48, bottom: 34 } },
  { key: "375x667", w: 375, h: 667 },
];

/* ---------------------------------------------------------------- room states */

const NAMES = ["Joe", "Priya", "Sam", "Jordan", "Alex", "Robin", "Kai", "Morgan", "Charlie", "Bartholomew-Jo"];

interface RoomSpec {
  status: "waiting" | "in_progress" | "finished";
  phase: string;
  players: number;
  /** Round types in order (the room's round_order). */
  order: PuzzleType[];
  /** The round the room is on (defaults: 0 in the lobby, else the last). */
  round?: number;
  /** score(slot, round) for every stored result. */
  score?: (slot: number, round: number) => number;
  /** This device is not in the room (the link join). */
  outside?: boolean;
  /** Whether the current round's results are stored (reveal: only mine). */
  scored?: "all" | "mine" | "none";
}
/** An arcade run's stored reveal (room-extras-check's shape), so the chart can place every player. */
const arcadeExtra = (type: PuzzleType, score: number) =>
  type === "matchup"
    ? { reveal: { axis: { value: Math.round(score / 10), max: 15, label: "Gems matched" }, lines: [`${score} points`], tiles: [{ label: "Score", value: String(score) }], outcome: "time" } }
    : null;
const puzzleFor = (type: PuzzleType) => dealt(type);
function roomState(spec: RoomSpec) {
  const now = Date.now();
  const round = spec.round ?? (spec.status === "waiting" ? 0 : spec.order.length);
  const score = spec.score ?? ((slot: number, r: number) => 150 - slot * 11 - ((r * 7 + slot * 5) % 23));
  const players = Array.from({ length: spec.players }, (_, i) => ({
    id: `p${i + 1}`,
    duel_id: "duel-audit",
    player_slot: i + 1,
    display_name: NAMES[i] ?? `Player ${i + 1}`,
    user_id: `u${i + 1}`,
    ready_round: round,
    intro_ready_round: 0,
    muted_by_host: false,
    last_reaction_at: null,
    last_seen_at: iso(now),
    status: "active",
    joined_at: iso(now - 60_000 + i * 1000),
  }));
  if (spec.outside) players[0] = { ...players[0]!, status: "left" };
  const scoredRound = (r: number) =>
    r < round || spec.scored === "all" || (spec.scored === undefined && (spec.status === "finished" || ["result", "standings", "winner_reveal"].includes(spec.phase)));
  const results = players.flatMap((p) =>
    Array.from({ length: round }, (_, i) => i + 1)
      .filter((r) => scoredRound(r) || (r === round && spec.scored === "mine" && p.player_slot === 1))
      .map((r) => ({
        id: `r${p.player_slot}-${r}`,
        duel_id: "duel-audit",
        player_slot: p.player_slot,
        round_number: r,
        answer: "",
        is_correct: score(p.player_slot, r) >= 120,
        ms_remaining: Math.max(0, 40_000 - p.player_slot * 2300 - r * 900),
        reaction_avg_ms: null,
        correct_count: null,
        errors: null,
        extra: arcadeExtra(spec.order[r - 1]!, score(p.player_slot, r)),
        score: score(p.player_slot, r),
        submitted_at: iso(now - 5_000),
      })),
  );
  return {
    duel: {
      id: "duel-audit",
      room_code: "BLTZ",
      status: spec.status,
      selected_categories: [],
      tournament_history: [],
      disbanded_at: null,
      host_user_id: "u1",
      max_players: 10,
      round_count: spec.order.length,
      round_order: spec.order,
      no_maths: false,
      puzzles_public: spec.order.map(puzzleFor),
      current_round: round,
      phase: spec.phase,
      phase_started_at: iso(now + 500),
      round_started_at: iso(now + 500),
      next_duel_id: null,
      created_at: iso(now - 60_000),
    },
    players,
    results,
  };
}

/** A closed round's reveal for the room above: the full puzzle and each player's line. */
function revealFor(spec: RoomSpec): () => unknown {
  return () => {
    const type = spec.order[(spec.round ?? spec.order.length) - 1]!;
    return {
      puzzle: withSeededRandom(41, () => generatePuzzle(type)),
      correctAnswer: null,
      players: Array.from({ length: spec.players }, (_, i) => ({ playerSlot: i + 1, summary: i % 3 === 2 ? "4 of 6 rows" : "Solved", detail: [] })),
    };
  };
}

const SIX: PuzzleType[] = ["sudoku", "matchup", "strikeout", "tilegrid", "breaker", "codeword"];

/* -------------------------------------------------------------- device states */

interface Device {
  /** Room history and practice bests on the device (a returning player). */
  history?: boolean;
  bests?: boolean;
  /** The first-time intro already seen (default true). */
  onboarded?: boolean;
  /** The public schedule; default: a game in two days and one in nine. */
  schedule?: "default" | "none";
  /** Today's daily record on the device (streak and bests). */
  dailyRecord?: boolean;
}

interface Shot {
  group: string;
  file: string;
  label: string;
  mode: "home" | "practice" | "tournaments" | "profile" | "room" | "daily" | "challenge" | "terms";
  device?: Device;
  room?: RoomSpec;
  daily?: () => HarnessDaily;
  challenge?: () => ChallengeScreenData;
  search?: Record<string, string>;
  query?: string;
  userAgent?: string;
  /** Extra puzzles (practice ?game=) and saved intro demos. */
  puzzles?: Record<string, PuzzleData>;
  demos?: Record<string, unknown>;
  demoDelayMs?: number;
  preview?: unknown;
  /** The room round's reveal (fetchRevealPuzzle, which the harness answers with null). */
  reveal?: () => unknown;
  /** Wait for this before the shot. */
  ready?: string;
  go?: (page: Page) => Promise<void>;
  waitMs?: number;
  /** Shoot this many ms after `ready` appears, skipping the usual settle (a count-up caught mid-way). */
  earlyMs?: number;
  /** Also shoot the end of the page's scroll. */
  scrollEnd?: boolean;
}

const RETURNING: Device = { history: true, bests: true, dailyRecord: true };
const FRESH: Device = { history: false, bests: false, dailyRecord: false };

const bothDone = (): HarnessDaily => {
  const after = dailyFixture().after;
  return { ...after, status: { ...after.status, arcade: { state: "done", total: 412, rank: 9, count: null } } as never };
};

/** A saved demo as getIntroDemoFn returns it (demo-intro-check's demoRow): an engine run, or taps over the intro example. */
function demoRow(type: PuzzleType, engine: boolean): unknown {
  if (engine) {
    const puzzle = pub(withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(type)));
    const seed = "seed" in puzzle ? Number((puzzle as { seed: number }).seed) : 1;
    return { game_type: type, seed, puzzle, input_log: { run: `${seed}|0||0|` }, start_tick: 0, length_ticks: 480 };
  }
  const example = bankedIntroExample(type) ?? withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(type));
  const t = (ms: number, x: number, y: number) => ({ t: ms, action: "tap", args: { at: { x, y } } });
  return {
    game_type: type,
    seed: 0,
    puzzle: pub(example),
    input_log: {
      actions: [t(500, 0.5, 0.45), t(1100, 0.35, 0.55), t(1700, 0.65, 0.35)],
      w: 390,
      h: 600,
      layout: GAME_COLUMN_LAYOUT,
      presentation: puzzlePresentation(type),
    },
    start_tick: 0,
    length_ticks: 300,
  };
}

const scrollTo = (sel: string) => async (page: Page) => {
  await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 100);
  }, sel);
};

// Standings scores: round 1 then round 2, chosen for each state.
const SWAP = (slot: number, r: number) => (r === 1 ? [140, 120, 100, 90, 80, 60][slot - 1]! : [60, 150, 145, 100, 70, 90][slot - 1]!);
const TIE = (slot: number, r: number) => (r === 1 ? [130, 120, 110, 100, 90, 80][slot - 1]! : [100, 110, 120, 95, 90, 70][slot - 1]!);

const SHOTS: Shot[] = [
  // Play tab
  { group: "play", file: "play-first-time-intro", label: "Fresh install: first-time intro", mode: "home", device: { ...FRESH, onboarded: false }, daily: () => dailyFixture().before, challenge: () => challengeFixture("create") },
  { group: "play", file: "play-fresh", label: "Fresh install: Play tab", mode: "home", device: FRESH, daily: () => dailyFixture().before, challenge: () => challengeFixture("create"), scrollEnd: true },
  { group: "play", file: "play-dailies-done", label: "Both dailies done", mode: "home", device: RETURNING, daily: bothDone, challenge: () => challengeFixture("create"), go: scrollTo("[data-daily-card]") },
  { group: "play", file: "play-public-game", label: "Public game coming up", mode: "home", device: RETURNING, daily: () => dailyFixture().after, challenge: () => challengeFixture("create"), go: scrollTo("[data-public-game]") },
  { group: "play", file: "play-home-hint", label: "Add to Home Screen hint (iPhone Safari)", mode: "home", device: FRESH, userAgent: IPHONE_SAFARI_UA, daily: () => dailyFixture().before },
  // Practice
  { group: "practice", file: "practice-all-fresh", label: "All, no bests", mode: "practice", device: FRESH, scrollEnd: true },
  { group: "practice", file: "practice-all-bests", label: "All, with bests", mode: "practice", device: RETURNING },
  { group: "practice", file: "practice-category", label: "One category (Logic)", mode: "practice", device: RETURNING, go: (p) => p.locator("[data-practice-filter='logic']").click() },
  { group: "practice", file: "practice-search", label: "Search \"ra\"", mode: "practice", device: RETURNING, go: (p) => p.getByRole("searchbox", { name: "Search games" }).fill("ra") },
  { group: "practice", file: "practice-search-empty", label: "Search with no match", mode: "practice", device: RETURNING, go: (p) => p.getByRole("searchbox", { name: "Search games" }).fill("zzqx") },
  // Tournaments
  { group: "tournaments", file: "tournaments-scheduled", label: "Games scheduled, results", mode: "tournaments", device: RETURNING },
  { group: "tournaments", file: "tournaments-none", label: "None scheduled, no results", mode: "tournaments", device: { ...FRESH, schedule: "none" } },
  // Profile
  { group: "profile", file: "profile-new", label: "New player", mode: "profile", device: FRESH, scrollEnd: true },
  { group: "profile", file: "profile-stats", label: "Stats, bests, recent rooms", mode: "profile", device: RETURNING, daily: () => dailyFixture().after, challenge: () => challengeFixture("create"), scrollEnd: true },
  { group: "profile", file: "profile-settings", label: "Settings sheet", mode: "profile", device: RETURNING, go: async (p) => { await p.locator("[data-open-settings]").click(); await p.locator("[data-settings-sheet]").waitFor({ timeout: 10_000 }); } },
  // Lobby
  { group: "lobby", file: "lobby-1", label: "1 player (host alone)", mode: "room", room: { status: "waiting", phase: "starting", players: 1, order: SIX } },
  { group: "lobby", file: "lobby-3", label: "3 players", mode: "room", room: { status: "waiting", phase: "starting", players: 3, order: SIX } },
  { group: "lobby", file: "lobby-10", label: "10 players (room full)", mode: "room", room: { status: "waiting", phase: "starting", players: 10, order: SIX }, scrollEnd: true },
  // Game intros (practice)
  { group: "intros", file: "intro-puzzle-demo", label: "Puzzle intro with a demo (Box Six)", mode: "practice", search: { game: "sudoku" }, puzzles: { sudoku: dealt("sudoku") }, demos: { sudoku: demoRow("sudoku", false) }, ready: ".round-intro", waitMs: 2500 },
  { group: "intros", file: "intro-puzzle-still", label: "Puzzle intro with a still (Strikeout)", mode: "practice", search: { game: "strikeout" }, puzzles: { strikeout: dealt("strikeout") }, ready: ".round-intro", waitMs: 1500 },
  { group: "intros", file: "intro-arcade", label: "Arcade intro with a demo (Gemstone)", mode: "practice", search: { game: "matchup" }, puzzles: { matchup: dealt("matchup") }, demos: { matchup: demoRow("matchup", true) }, ready: ".round-intro", waitMs: 2500 },
  // Answer reveal
  { group: "reveal", file: "reveal-puzzle-2", label: "Puzzle reveal, 2 players", mode: "room", room: { status: "in_progress", phase: "reveal", players: 2, order: ["sudoku"], scored: "all" }, reveal: revealFor({ status: "in_progress", phase: "reveal", players: 2, order: ["sudoku"], scored: "all" }), waitMs: 1800 },
  { group: "reveal", file: "reveal-puzzle-6", label: "Puzzle reveal, 6 players", mode: "room", room: { status: "in_progress", phase: "reveal", players: 6, order: ["sudoku"], scored: "all" }, reveal: revealFor({ status: "in_progress", phase: "reveal", players: 6, order: ["sudoku"], scored: "all" }), waitMs: 1800 },
  { group: "reveal", file: "reveal-arcade-2", label: "Arcade chart, 2 players", mode: "room", room: { status: "in_progress", phase: "reveal", players: 2, order: ["matchup"], scored: "all" }, reveal: revealFor({ status: "in_progress", phase: "reveal", players: 2, order: ["matchup"], scored: "all" }), waitMs: 1800 },
  { group: "reveal", file: "reveal-arcade-6", label: "Arcade chart, 6 players", mode: "room", room: { status: "in_progress", phase: "reveal", players: 6, order: ["matchup"], scored: "all" }, reveal: revealFor({ status: "in_progress", phase: "reveal", players: 6, order: ["matchup"], scored: "all" }), waitMs: 1800 },
  // Points reveal (round leaderboard) and standings
  { group: "standings", file: "points-6", label: "Round results, 6 players", mode: "room", room: { status: "in_progress", phase: "result", players: 6, order: ["sudoku", "strikeout"] }, reveal: revealFor({ status: "in_progress", phase: "result", players: 6, order: ["sudoku", "strikeout"] }), waitMs: 2500 },
  { group: "standings", file: "points-swap", label: "Round results after a swap", mode: "room", room: { status: "in_progress", phase: "result", players: 6, order: ["sudoku", "strikeout"], score: SWAP }, reveal: revealFor({ status: "in_progress", phase: "result", players: 6, order: ["sudoku", "strikeout"], score: SWAP }), waitMs: 2500 },
  { group: "standings", file: "standings-countup", label: "Standings mid count-up", mode: "room", room: { status: "in_progress", phase: "standings", players: 6, order: ["sudoku", "strikeout"], score: SWAP }, reveal: revealFor({ status: "in_progress", phase: "standings", players: 6, order: ["sudoku", "strikeout"], score: SWAP }), ready: "text=After round 2 of 2", earlyMs: 450 },
  { group: "standings", file: "standings-swap", label: "Standings after a place swap", mode: "room", room: { status: "in_progress", phase: "standings", players: 6, order: ["sudoku", "strikeout"], score: SWAP }, reveal: revealFor({ status: "in_progress", phase: "standings", players: 6, order: ["sudoku", "strikeout"], score: SWAP }), waitMs: 3000 },
  { group: "standings", file: "standings-tie", label: "Standings with a tie", mode: "room", room: { status: "in_progress", phase: "standings", players: 6, order: ["sudoku", "strikeout"], score: TIE }, reveal: revealFor({ status: "in_progress", phase: "standings", players: 6, order: ["sudoku", "strikeout"], score: TIE }), waitMs: 3000 },
  { group: "standings", file: "standings-2", label: "Standings, 2 players", mode: "room", room: { status: "in_progress", phase: "standings", players: 2, order: ["sudoku", "strikeout"] }, reveal: revealFor({ status: "in_progress", phase: "standings", players: 2, order: ["sudoku", "strikeout"] }), waitMs: 3000 },
  // Podium and final results
  { group: "final", file: "final-2", label: "Final results, 2 players", mode: "room", room: { status: "finished", phase: "result", players: 2, order: SIX }, reveal: revealFor({ status: "finished", phase: "result", players: 2, order: SIX }), waitMs: 3500, scrollEnd: true },
  { group: "final", file: "podium-6", label: "Podium, 6 players", mode: "room", room: { status: "finished", phase: "result", players: 6, order: SIX }, reveal: revealFor({ status: "finished", phase: "result", players: 6, order: SIX }), waitMs: 3500, scrollEnd: true },
  // Daily, challenge, terms, errors
  { group: "other", file: "daily-results", label: "Daily results", mode: "daily", daily: () => dailyFixture().after, device: RETURNING, go: async (p) => { await p.locator("[data-daily-results]").click(); await p.locator("[data-async-results]").waitFor({ timeout: 20_000 }); }, waitMs: 1500, scrollEnd: true },
  { group: "other", file: "daily-board", label: "Daily board after playing", mode: "daily", daily: () => dailyFixture().after, device: RETURNING },
  { group: "other", file: "challenge-podium", label: "Challenge results (podium)", mode: "challenge", challenge: () => challengeFixture("podium"), search: { code: CHALLENGE_CODE }, waitMs: 3000, scrollEnd: true },
  { group: "other", file: "challenge-creator", label: "Challenge: creator's results", mode: "challenge", challenge: () => challengeFixture("creator"), search: { code: CHALLENGE_CODE }, waitMs: 2000 },
  { group: "other", file: "terms", label: "Beta terms", mode: "terms", query: "terms=0", scrollEnd: true },
  { group: "other", file: "error-challenge-not-found", label: "Challenge link not found", mode: "challenge", search: { code: "ZZZZZZ" }, waitMs: 1500 },
  { group: "other", file: "error-room-not-found", label: "Room link: room not found", mode: "room", room: { status: "waiting", phase: "starting", players: 2, order: SIX, outside: true }, preview: { found: false, roomCode: "BLTZ" }, device: {}, waitMs: 1500 },
];

/* ----------------------------------------------------------------- the opener */

function deviceInit(seed: { onboarding: string; device: Required<Device>; bests: [string, number][] }) {
  try {
    const d = seed.device;
    if (d.onboarded) localStorage.setItem(seed.onboarding, "1");
    const now = Date.now();
    const day = (offset: number) => new Date(now + offset * 86_400_000).toISOString().slice(0, 10);
    (window as unknown as { __DUELZ_PUBLIC_GAMES__?: unknown }).__DUELZ_PUBLIC_GAMES__ =
      d.schedule === "none"
        ? []
        : [
            { date: day(2), time: "20:00", lobbyOpens: "19:45", rounds: 6, roomCode: "JULZ", title: "Thursday night games" },
            { date: day(9), time: "20:00", lobbyOpens: "19:45", rounds: 7, roomCode: "JULZ", title: "Halloween special" },
          ];
    if (d.history)
      localStorage.setItem(
        "duelz-room-history:v1",
        JSON.stringify([
          { key: "a:1", code: "JULZ", at: now - 86_400_000, players: 10, place: 1, points: 812 },
          { key: "b:1", code: "WXYZ", at: now - 2 * 86_400_000, players: 4, place: 3, points: 640 },
          { key: "c:1", code: "JULZ", at: now - 3 * 86_400_000, players: 7, place: null, points: 120 },
        ]),
      );
    if (d.bests) for (const [key, best] of seed.bests) localStorage.setItem(key, String(best));
  } catch {
    /* ignore */
  }
}

const BEST_TYPES = ["tilegrid", "matchup", "sudoku", "strikeout", "breaker", "codeword"] as const;

async function open(browser: Browser, origin: string, shot: Shot, vp: Viewport): Promise<{ context: BrowserContext; page: Page }> {
  const device: Required<Device> = { history: false, bests: false, onboarded: true, schedule: "default", dailyRecord: false, ...shot.device };
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    hasTouch: true,
    isMobile: true,
    ...(shot.userAgent ? { userAgent: shot.userAgent } : {}),
  });
  await context.addInitScript(DEVICE_INIT);
  const challengeRun = shot.challenge
    ? (() => {
        const data = shot.challenge();
        return shot.mode === "challenge" ? data : { ...data, daily: undefined, startOffsetMs: null };
      })()
    : null;
  await context.addInitScript(
    (r) => {
      const daily = r.challengeRun?.daily ?? r.daily;
      (window as unknown as { __harness: unknown }).__harness = {
        puzzles: { sudoku: r.puzzle, ...r.puzzles, ...(r.challengeRun?.challenge.puzzles ?? {}) },
        verdict: { isCorrect: true, score: 150 },
        latencyMs: 50,
        submissions: [],
        verdictAt: null,
        room: r.room,
        daily,
        challenge: r.challengeRun?.challenge,
        startOffsetMs: r.challengeRun?.startOffsetMs ?? null,
        search: r.search,
        demos: r.demos,
        demoDelayMs: r.demoDelayMs,
        preview: r.preview ?? undefined,
      };
      // fetchRevealPuzzle (api.ts): the harness answers every unlisted call with null, so wrap its dispatcher.
      if (r.reveal) {
        const h = (window as unknown as { __harness: Record<string, unknown> }).__harness;
        let call: ((m: string, n: string, a: unknown[]) => unknown) | undefined;
        Object.defineProperty(h, "call", {
          configurable: true,
          set: (fn) => (call = fn),
          get: () => (m: string, n: string, a: unknown[]) =>
            n === "fetchRevealPuzzle" ? async () => r.reveal : call!(m, n, a),
        });
      }
      try {
        if (r.record) localStorage.setItem(r.record[0], r.record[1]);
        if (r.challengeRun) localStorage.setItem(r.challengeRun.record[0], r.challengeRun.record[1]);
      } catch {
        /* ignore */
      }
    },
    {
      room: shot.room ? roomState(shot.room) : null,
      puzzle: PUZZLE,
      puzzles: shot.puzzles ?? {},
      daily: shot.daily?.() ?? undefined,
      record: device.dailyRecord ? dailyFixture().record : null,
      challengeRun,
      search: shot.search ?? {},
      demos: shot.demos ?? {},
      demoDelayMs: shot.demoDelayMs ?? 300,
      preview: shot.preview ?? null,
      reveal: shot.reveal?.() ?? null,
    },
  );
  await context.addInitScript(deviceInit, {
    onboarding: ONBOARDING_KEY,
    device,
    bests: BEST_TYPES.map((t, i) => [`duelz-practice-best:v2:${t}@${currentPracticeStamp(t)}`, 148 - i * 17] as [string, number]),
  });
  // A home-screen app at 414×896, except where the shot is Safari's (the Add to Home Screen hint).
  const standalone = Boolean(vp.insets && !shot.userAgent);
  if (standalone)
    await context.addInitScript((h) => {
      (window as unknown as { __device: unknown }).__device = { standalone: true, w: 414, h };
    }, vp.h);
  const page = await context.newPage();
  if (vp.insets) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setSafeAreaInsetsOverride" as never, { insets: { top: vp.insets.top, bottom: vp.insets.bottom, left: 0, right: 0 } } as never);
    if (standalone)
      await cdp.send("Emulation.setEmulatedMedia" as never, { features: [{ name: "display-mode", value: "standalone" }] } as never).catch(() => {});
  }
  const url = `${origin}/safe-area.html?mode=${shot.mode}${shot.query ? `&${shot.query}` : ""}`;
  await page.goto(url, { timeout: 180_000 });
  if (shot.ready) await page.waitForSelector(shot.ready, { timeout: 60_000 });
  if (shot.earlyMs !== undefined) {
    await page.waitForTimeout(shot.earlyMs);
    return { context, page };
  }
  if (shot.ready) {
    /* waited above */
  } else if (shot.mode === "practice") await page.locator("[data-practice-game]").first().waitFor({ timeout: 60_000 });
  else await page.waitForSelector("#root *", { timeout: 60_000 });
  await page.waitForTimeout(800);
  if (shot.go) await shot.go(page);
  await page.waitForTimeout(shot.waitMs ?? 700);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  return { context, page };
}

/* ------------------------------------------------------------------- the run */

const jpeg = { type: "jpeg" as const, quality: 80 };
interface Frame {
  group: string;
  file: string;
  label: string;
  vp: string;
}
const frames: Frame[] = [];
const shots = SHOTS.filter((s) => !ONLY || ONLY.includes(s.group));
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-screen-audit", buildId: "screen-audit" });
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  // Warm the cold dev server once (unshot).
  {
    const { context } = await open(browser, server.origin, SHOTS[1]!, VIEWPORTS[0]!);
    await context.close();
  }
  for (const shot of shots)
    for (const vp of VIEWPORTS) {
      const { context, page } = await open(browser, server.origin, shot, vp).catch((e) => {
        console.log(`MISS ${shot.file} ${vp.key}: ${String(e).split("\n")[0]}`);
        return { context: null, page: null } as never;
      });
      if (!context) continue;
      try {
        const name = `${shot.file}-${vp.key}.jpg`;
        await page.screenshot({ path: join(OUT, name), ...jpeg });
        frames.push({ group: shot.group, file: name, label: shot.label, vp: vp.key });
        console.log(name);
        if (shot.scrollEnd) {
          const tall = await page.evaluate(() => document.scrollingElement!.scrollHeight - window.innerHeight);
          if (tall > 40) {
            await page.evaluate(() => window.scrollTo(0, document.scrollingElement!.scrollHeight));
            await page.waitForTimeout(500);
            const end = `${shot.file}-end-${vp.key}.jpg`;
            await page.screenshot({ path: join(OUT, end), ...jpeg });
            frames.push({ group: shot.group, file: end, label: `${shot.label} (scrolled to end)`, vp: vp.key });
            console.log(end);
          }
        }
      } finally {
        await context.close();
      }
    }
  // The root's 404 page, from the app's own dev server.
  if (APP)
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: true, isMobile: true });
      const page = await context.newPage();
      await page.goto(`${APP}/no-such-page`, { timeout: 180_000 });
      await page.waitForTimeout(2500);
      const name = `error-404-${vp.key}.jpg`;
      await page.screenshot({ path: join(OUT, name), ...jpeg });
      frames.push({ group: "other", file: name, label: "404 page", vp: vp.key });
      await context.close();
    }
} finally {
  await browser.close();
  await server.close();
}

/* ---------------------------------------------------------- overview sheets */

const TITLES: Record<string, string> = {
  play: "Play tab",
  practice: "Practice",
  tournaments: "Tournaments",
  profile: "Profile",
  lobby: "Lobby",
  intros: "Game intros",
  reveal: "Answer reveal",
  standings: "Points reveal and standings",
  final: "Podium and final results",
  other: "Daily, challenge, terms and errors",
};
const SCALE = 0.5;
for (const group of [...new Set(frames.map((f) => f.group))]) {
  for (const vp of VIEWPORTS) {
    const mine = frames.filter((f) => f.group === group && f.vp === vp.key);
    if (!mine.length) continue;
    const w = Math.round(vp.w * SCALE);
    const h = Math.round(vp.h * SCALE);
    const pad = 14;
    const label = 34;
    const head = 40;
    const cols = Math.min(mine.length, 6);
    const rows = Math.ceil(mine.length / cols);
    const canvas = createCanvas(pad + cols * (w + pad), head + rows * (label + h + pad));
    const c = canvas.getContext("2d");
    c.fillStyle = "#2a2a31";
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = "#f4f4f6";
    c.font = "bold 20px sans-serif";
    c.fillText(`${TITLES[group] ?? group} · ${vp.key}`, pad, 27);
    for (const [i, f] of mine.entries()) {
      const x0 = pad + (i % cols) * (w + pad);
      const y0 = head + Math.floor(i / cols) * (label + h + pad);
      c.fillStyle = "#d0d0d8";
      c.font = "12px sans-serif";
      const words = f.label.split(" ");
      let line = "";
      let ly = y0 + 13;
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (c.measureText(next).width > w && line) {
          c.fillText(line, x0, ly);
          line = word;
          ly += 14;
        } else line = next;
      }
      c.fillText(line, x0, ly);
      c.drawImage(await loadImage(readFileSync(join(OUT, f.file))), x0, y0 + label, w, h);
    }
    const out = join(OUT, `overview-${group}-${vp.key}.jpg`);
    writeFileSync(out, await canvas.encode("jpeg", 82));
    console.log(out);
  }
}
writeFileSync(join(OUT, "index.json"), `${JSON.stringify(frames, null, 2)}\n`);
console.log(`${frames.length} screenshots in ${OUT}`);
