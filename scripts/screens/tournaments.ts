/**
 * The Tournaments, Leaderboards and Daily pages (phase 2 step 3, 14 Nov 2026; the style guide's list mockups) for
 * theme-check and no-wrap-check: the hub's two views, an event page (the live Arena with its board and podium, a Score
 * Attack before entry), the rules page, the leaderboards' board picker, the Daily page and the Daily archive. Each is
 * drawn dark and light at every size (VIEWPORTS plus ALL_SIZES). The stand-in answers are served by the screen
 * harness (scripts/safe-area-harness.tsx: window.__harnessTournamentHub, __harnessTournamentEvent,
 * __harnessArenaBoard, __harnessScoreAttackBoard, __harnessArchive). Appended last in THEME_SCREENS, so every earlier
 * screen keeps its place.
 */
import type { Page } from "playwright";

import { FIXED_NOW } from "../fixed-clock";
import { dailyFixture } from "../daily-fixture";
import { boardsFixture } from "../leaderboards-fixture";
import type { ThemeScreen, ThemeViewport } from "../theme-screens";
import { entryOptionsFor, prizeLines, scheduledEvent } from "../../src/lib/tournaments/rules";
import type { ArenaBoard, ScoreAttackBoard, TournamentEventView, TournamentHub } from "../../src/lib/tournaments/types";
import type { PlateView } from "../../src/lib/identity/plates";

const MIN = 60_000;

function view(id: string, patch: Partial<TournamentEventView> = {}): TournamentEventView {
  const ev = scheduledEvent(id)!;
  return {
    id,
    kind: ev.kind,
    title: ev.title,
    pick: ev.pick,
    pickLabel: ev.pick === "mixed" ? "Mixed" : ev.pick,
    startsAt: ev.startsAt,
    endsAt: ev.endsAt,
    entryOpensAt: ev.entryOpensAt,
    entryClosesAt: ev.entryClosesAt,
    status: "scheduled",
    entrants: 0,
    entryOpen: true,
    entryOptions: entryOptionsFor(ev.kind).map((entry) => ({ entry, coins: entry === "coins" ? 50 : 0, affordable: true, held: entry.startsWith("ticket") ? 1 : null })),
    prizes: prizeLines(ev.kind),
    mine: null,
    reminded: false,
    rulesDraft: true,
    cancelledNext: null,
    cancelReason: null,
    rounds: ev.kind === "score_attack" ? 5 : null,
    ...patch,
  };
}

/** Today (Mon 26 Oct 2026 on the fixed clock): a live Arena, the day's Score Attack, tonight's Arena and tomorrow's. */
const ARENA_LIVE = view("arena:2026-10-26:1300", { status: "live", entrants: 124, endsAt: FIXED_NOW + 18 * MIN, mine: { entry: "free", coins: 0, enteredAt: FIXED_NOW - 30 * MIN, refunded: false } as never });
const SCORE_ATTACK = view("score_attack:2026-10-26", { status: "live", entrants: 418 });
const ARENA_EVENING = view("arena:2026-10-26:2000", { entrants: 37, reminded: true });
const ARENA_TOMORROW = view("arena:2026-10-27:1300", { entrants: 6 });
const ARENA_CALLED_OFF = view("arena:2026-10-27:2000", { status: "cancelled", cancelReason: "too_few" });

export function hubFixture(opts: { live?: boolean } = {}): TournamentHub {
  const live = opts.live ?? true;
  return {
    open: true,
    account: true,
    now: FIXED_NOW,
    live: live ? [ARENA_LIVE, SCORE_ATTACK] : [],
    next: ARENA_EVENING,
    week: [...(live ? [ARENA_LIVE, SCORE_ATTACK] : []), ARENA_EVENING, ARENA_TOMORROW, ARENA_CALLED_OFF],
    entries: [
      { eventId: "arena:2026-10-24:2000", kind: "arena", title: "Evening Arena", startsAt: FIXED_NOW - 2 * 86_400_000, entry: "free", coins: 0, enteredAt: 0, refunded: false, status: "finished", place: 2, prizeCoins: 60 },
      { eventId: "score_attack:2026-10-25", kind: "score_attack", title: "Score Attack", startsAt: FIXED_NOW - 86_400_000, entry: "coins", coins: 50, enteredAt: 0, refunded: false, status: "finished", place: 14, prizeCoins: 0 },
      { eventId: "arena:2026-10-25:1300", kind: "arena", title: "Lunchtime Arena", startsAt: FIXED_NOW - 86_400_000, entry: "free", coins: 0, enteredAt: 0, refunded: true, status: "cancelled", place: null, prizeCoins: 0 },
    ],
    trophies: [],
  } as TournamentHub;
}

function card(i: number) {
  return {
    avatarId: "captain-joulz",
    colour: (i * 5) % 32,
    gem: null,
    cardArt: i % 2 ? "card-art.grid" : "card-art.bolt-stripes",
    frame: i % 2 ? "frame.gold" : "frame.plain",
    nameColour: i === 1 ? "name-colour.gold-leaf" : null,
    badges: i === 1 ? ["flawless"] : [],
    title: "rookie",
  };
}
const NAMES = ["Nova_Strike", "Quillfire", "Me_Here", "Bartholomew_Long", "Dex", "Priya", "Sam", "Jo"];
function plate(i: number): PlateView {
  if (i === 2) return { kind: "hidden" };
  if (i === 6) return { kind: "plain", name: "Sam", colour: 9 };
  return { kind: "card", name: NAMES[i - 1]!, card: card(i), playerNumber: 40 + i, tier: i <= 2 ? "storm" : "volt" } as PlateView;
}

export function arenaBoardFixture(): ArenaBoard {
  const rows = Array.from({ length: 8 }, (_, k) => {
    const i = k + 1;
    const p = plate(i);
    return { place: i, playerId: `pub-${i}`, name: p.kind === "hidden" ? "Hidden player" : (p as { name: string }).name, plate: p, points: 22 - i * 2, wins: 9 - i, streak: i === 1 ? 4 : i === 5 ? 2 : 0, played: 10 - i, isMe: i === 3 };
  });
  return { eventId: ARENA_LIVE.id, endsAt: ARENA_LIVE.endsAt, status: "live", players: 124, rows, me: rows[2]!, underReview: false };
}

export function scoreAttackBoardFixture(): ScoreAttackBoard {
  const rows = Array.from({ length: 8 }, (_, k) => {
    const i = k + 1;
    const p = plate(i);
    return { place: i, name: p.kind === "hidden" ? "Hidden player" : (p as { name: string }).name, plate: p, total: 1840 - i * 63, isMe: i === 3 };
  });
  return { eventId: SCORE_ATTACK.id, open: true, count: 418, rows, me: { place: 3, total: 1651, finished: true, roundsDone: 5 }, underReview: false };
}

const DAY = (offset: number) => {
  const d = new Date(FIXED_NOW - offset * 86_400_000);
  return d.toISOString().slice(0, 10);
};
export function archiveFixture() {
  const days = [1, 2, 3, 4, 5, 6, 7].flatMap((o) =>
    (["puzzle", "arcade"] as const).map((kind) => ({
      kind,
      day: DAY(o),
      available: o !== 6,
      replay: o === 2 ? { finished: true, total: 742 } : o === 3 ? { finished: false, total: 0 } : null,
    })),
  );
  return { ok: true, days };
}

const ACCOUNT = {
  kind: "account", userId: "00000000-0000-4000-8000-000000000042", username: "Me_Here", colour: 4, playerNumber: 42,
  founding: true, country: "GB", createdAt: "2026-10-10T12:00:00.000Z", status: "active", isUnder18: false, deletion: null,
  rename: { kind: "free" }, email: "me@example.com",
};

const OPEN = { __DUELZ_ALLOW_TOURNAMENTS__: true };

/** The hub's Your results view. */
async function toResults(page: Page) {
  await page.locator('[data-tournament-view="results"]').click();
  await page.waitForTimeout(300);
}

/** The leaderboards' picker sheet, open (a computer shows the boards beside the board instead: nothing to open). */
async function openPicker(page: Page) {
  const button = page.locator("[data-board-picker]");
  await button.waitFor({ state: "attached", timeout: 10_000 });
  if (!(await button.isVisible())) return;
  await button.click();
  await page.locator("[data-board-sheet]").waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);
}

const DARK: ThemeScreen[] = [
  { name: "tournaments pages: hub, upcoming", mode: "tournaments", globals: { ...OPEN, __harnessTournamentHub: hubFixture() }, waitMs: 900 },
  { name: "tournaments pages: hub, nothing live", mode: "tournaments", globals: { ...OPEN, __harnessTournamentHub: hubFixture({ live: false }) }, waitMs: 900 },
  { name: "tournaments pages: hub, your results", mode: "tournaments", globals: { ...OPEN, __harnessTournamentHub: hubFixture() }, waitMs: 900, go: toResults },
  {
    name: "tournaments pages: arena, live with its board",
    mode: "tournament",
    plain: true,
    globals: { ...OPEN, __harnessTournamentEvent: ARENA_LIVE, __harnessArenaBoard: arenaBoardFixture() },
    waitMs: 1200,
  },
  {
    name: "tournaments pages: score attack, entered and finished",
    mode: "tournament",
    plain: true,
    globals: { ...OPEN, __harnessTournamentEvent: { ...SCORE_ATTACK, mine: { entry: "coins", coins: 50, enteredAt: 0, refunded: false } }, __harnessScoreAttackBoard: scoreAttackBoardFixture() },
    waitMs: 1200,
  },
  { name: "tournaments pages: tonight's arena, before entry", mode: "tournament", plain: true, globals: { ...OPEN, __harnessTournamentEvent: ARENA_EVENING }, waitMs: 900 },
  { name: "tournaments pages: arena rules", mode: "tournamentrules", plain: true, waitMs: 600 },
  { name: "tournaments pages: leaderboards, board picker", mode: "leaderboards", plain: true, globals: { __harnessBoards: boardsFixture() }, waitMs: 1000, go: openPicker },
  { name: "tournaments pages: daily, after playing", mode: "daily", daily: () => dailyFixture().after },
  { name: "tournaments pages: daily archive", mode: "dailyarchive", plain: true, globals: { __harnessNavAccount: ACCOUNT, __harnessArchive: archiveFixture() }, waitMs: 900 },
];

/** Every page above, dark then light, at every size (`sizes`: theme-screens.ts passes ALL_SIZES; no runtime import back, so either module may load first). */
export const TOURNAMENT_PAGES_SCREENS = (sizes: ThemeViewport[]): ThemeScreen[] => [
  ...DARK.map((s) => ({ ...s, sizes })),
  ...DARK.map((s) => ({ ...s, name: `${s.name}, light`, globals: { ...(s.globals ?? {}), __harnessTheme: "light" }, sizes })),
];
