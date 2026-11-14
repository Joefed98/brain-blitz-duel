/**
 * The Profile session's fixtures (phase 2 step 3): the badges answer, practice progress and rated status the Profile
 * screens draw (scripts/screens/profile.ts) and profile-pages-check stands in with. No import of theme-screens, so a
 * check can load it on its own.
 */
import { tierFor } from "../../src/lib/rated/tiers";

export const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** The server's badges answer: the Founding Player and four more earned, three on the card, progress on two. */
export const PROFILE_BADGES = {
  account: true,
  earned: [
    { slug: "founding-player", earnedAt: "2026-11-10T12:00:00.000Z", number: 42, seen: true },
    { slug: "first-win", earnedAt: "2026-11-11T12:00:00.000Z", number: null, seen: true },
    { slug: "friendly", earnedAt: "2026-11-11T13:00:00.000Z", number: null, seen: true },
    { slug: "first-star", earnedAt: "2026-11-12T12:00:00.000Z", number: null, seen: true },
    { slug: "placed", earnedAt: "2026-11-12T14:00:00.000Z", number: null, seen: true },
  ],
  card: ["founding-player", "first-win", "placed"],
  title: "rookie",
  unseen: [],
  progress: { "daily-habit": 4, perfectionist: 3 },
};

/** Practice progress: 74 stars (Jade unlocked, Amethyst next) and three bests. */
export const PROFILE_PROGRESS = {
  games: {
    sudoku: { classic: { best: 182, star: true } },
    tilegrid: { classic: { best: 176, star: true } },
    matchup: { classic: { best: 151, star: false } },
  },
  stars: 74,
  gems: ["amber", "rose-quartz", "ruby", "jade"],
  noteSeen: true,
  freshStartAt: null,
};

const LOOK = { cardArt: "card-art.joulz-navy", frame: "frame.plain", nameColour: null, avatar: { id: "captain-joulz", colour: 4, gem: null } };
const rank = (rating: number) => ({ ...tierFor(rating, null), rating });

/** A placed player's rated status (W3a's figures as the fixture's: Volt II at 1,278). */
export const PROFILE_RATED = {
  open: true,
  guest: false,
  me: {
    userId: "u-42",
    username: "TheInventor",
    playerNumber: 42,
    look: LOOK,
    title: "Rookie",
    badges: ["founding-player"],
    rank: rank(1278),
    guest: false,
    deleted: false,
  },
  options: { picks: ["mixed", "puzzles", "arcade"], formats: ["bo3"], bestOf: [3], sizes: [2] },
  season: null,
  standing: {
    state: "placed",
    rank: rank(1278),
    puzzles: { rating: 1296, matches: 12 },
    arcade: { rating: 1231, matches: 9 },
    categories: [
      { pick: "pattern", rating: 1350, matches: 4 },
      { pick: "word", rating: 1312, matches: 3 },
      { pick: "retro", rating: 1176, matches: 2 },
    ],
  },
  activeMatchId: null,
};

