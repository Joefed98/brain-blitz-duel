/**
 * The leaderboard screens' stand-in server answers (wave 4, session W4a; docs/leaderboards.md) for theme-check and
 * no-wrap-check (scripts/theme-screens.ts LEADERBOARD_SCREENS, served by scripts/safe-area-harness.tsx from
 * window.__harnessBoards). Longest names (16 characters), four-digit ratings, a shared place, hidden players, the
 * Top 500 line and a pinned row far down the board, so every single-line text is drawn at its widest.
 */
import type { BoardRow, BoardVisibility, DailyBoardPage, RatingBoardPage } from "../src/lib/leaderboards/boards";

export interface HarnessBoards {
  rating: RatingBoardPage;
  /** The category boards' answer (Top Logic players). */
  category: RatingBoardPage;
  daily: DailyBoardPage;
  visibility: BoardVisibility;
}

const LONG = ["Quintessential_1", "Thunderstruck_22", "Lightning_Bolt_7", "MegaVoltage_2026", "Supercalifragil_", "Electromagnetic9"];

const FRAMES = ["frame.gold", "frame.silver", "frame.plain", "frame.bronze"];
const NAME_COLOURS = ["name-colour.gold-leaf", null, "name-colour.chrome", "name-colour.sapphire"];
const TIERS = ["top500", "lightning", "storm", "volt", "surge", null];

/** A visible row's card (Joe's rule, 11 Nov 2026), the widest a row can get: three badges, a tier, a name colour. */
function cardOf(i: number) {
  return {
    avatarId: "captain-joulz",
    colour: (i * 3) % 32,
    gem: null,
    cardArt: i % 2 ? "card-art.grid" : "card-art.bolt-stripes",
    frame: FRAMES[i % FRAMES.length]!,
    nameColour: NAME_COLOURS[i % NAME_COLOURS.length]!,
    badges: i % 3 === 0 ? ["flawless", "daily-habit", "first-star"] : i % 3 === 1 ? ["flawless"] : [],
    title: "rookie",
  };
}

function row(rank: number, value: number, i: number, extra: Partial<BoardRow> = {}): BoardRow {
  const hidden = extra.hidden === true;
  return {
    ...(hidden ? {} : { card: cardOf(i), tier: TIERS[i % TIERS.length]! }),
    rank,
    value,
    isMe: false,
    isFriend: false,
    hidden,
    deleted: false,
    name: hidden ? null : LONG[i % LONG.length]!,
    colour: hidden ? null : (i * 3) % 32,
    playerNumber: hidden ? null : 1000 + i,
    ...extra,
  };
}

export function boardsFixture(opts: { empty?: boolean; dailyReason?: DailyBoardPage["meReason"]; dailyFinal?: boolean } = {}): HarnessBoards {
  const ratingRows: BoardRow[] = opts.empty
    ? []
    : [
        row(1, 3104, 0, { top500: 1 }),
        row(2, 3061, 1, { top500: 2, hidden: true }),
        row(3, 2987, 2, { top500: 3 }),
        row(3, 2987, 3, { top500: 3, isFriend: true }),
        ...Array.from({ length: 46 }, (_, i) => row(5 + i, 2918 - i * 7, 4 + i, i % 9 === 4 ? { hidden: true } : {})),
      ];
  const me: BoardRow = row(4812, 1278, 5, { isMe: true, name: "Electromagnetic9" });
  const dailyRows: BoardRow[] = [
    row(1, 1184, 0, { timeMs: 252_000 }),
    row(2, 1176, 1, { timeMs: 271_000, isFriend: true }),
    row(3, 1171, 2, { timeMs: 245_000, hidden: true }),
    ...Array.from({ length: 97 }, (_, i) => row(4 + i, 1158 - i * 4, 3 + i, { timeMs: 288_000 + i * 1_000, ...(i % 11 === 3 ? { hidden: true } : {}) })),
  ];
  const meDaily = opts.dailyReason ? null : row(412, 694, 5, { isMe: true, timeMs: 400_000, name: "Electromagnetic9" });
  return {
    rating: { ready: true, rows: ratingRows, me: opts.empty ? null : me, total: opts.empty ? 0 : 12_318, country: "GB", refreshedAt: "2026-10-26T12:00:00.000Z" },
    category: { ready: true, rows: ratingRows.slice(0, 5), me, total: 2_318, country: "GB" },
    daily: {
      exists: true,
      day: "",
      kind: "daily_puzzle",
      players: 2_318,
      final: opts.dailyFinal === true,
      open: true,
      rows: dailyRows,
      me: meDaily,
      meReason: opts.dailyReason ?? null,
      prevDay: "2026-10-25",
      nextDay: null,
    },
    visibility: { show: true, setting: null, adult: true },
  };
}
