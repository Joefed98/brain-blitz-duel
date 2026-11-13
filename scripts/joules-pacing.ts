/**
 * Joules pacing (a tool, not a check; the Joules rework, 13 Nov 2026, docs/economy/economy-design.md "Expected pace"):
 * three player profiles played day by day through an 8-week season on the pass's own arithmetic (joules.ts:
 * `settleDay`, its day limits and soft cap; the rated and tournament amounts from `ratedMatchJoules` and
 * `tournamentJoules`), before the rework and now. Season 2 and 3 rows are a returning player with fewer stars and
 * Practice challenges left to earn.
 *
 *   bun scripts/joules-pacing.ts
 */
import { JOULES, LEGACY_JOULES, ratedMatchJoules, settleDay, STAR_JOULES_CLASSIC, tournamentJoules, WEEKLY_JOULES, type JoulesKind } from "../src/lib/pass/joules";
import { levelFor } from "../src/lib/pass/rewards";

const WEEKS = 8;
/** The amounts before the rework (pass.md as of 13 Nov 2026, before this change). */
const BEFORE = {
  daily: 150,
  room_round: LEGACY_JOULES.room_round,
  room_finish: LEGACY_JOULES.room_finish,
  practice: LEGACY_JOULES.practice,
  challenge: 100,
  practice_challenge: 100,
  star: 0,
  weekly: { easy: 500, medium: 750, hard: 1250 },
};
const NOW = {
  daily: JOULES.daily_puzzle,
  room_round: 0,
  room_finish: 0,
  practice: 0,
  challenge: JOULES.challenge,
  practice_challenge: JOULES.practice_challenge,
  star: STAR_JOULES_CLASSIC,
  weekly: WEEKLY_JOULES,
};
type Amounts = typeof BEFORE;

interface Profile {
  name: string;
  /** Days a week played. */
  days: number;
  practicePerDay: number;
  /** 6-round rooms a week. */
  roomsPerWeek: number;
  /** Rated best of 3 a week (half won). */
  ratedPerWeek: number;
  friendChallengesPerWeek: number;
  /** Arena duels and Score Attack finishes a week. */
  arenaPerWeek: number;
  scoreAttackPerWeek: number;
  /** Weeks each weekly tier is completed in. */
  weekly: { easy: number; medium: number; hard: number };
  /** Practice challenges and stars earned over the season, by season (1, 2, 3). */
  challenges: [number, number, number];
  stars: [number, number, number];
}

const PROFILES: Profile[] = [
  { name: "Light", days: 3, practicePerDay: 5, roomsPerWeek: 1, ratedPerWeek: 2, friendChallengesPerWeek: 0, arenaPerWeek: 0, scoreAttackPerWeek: 0, weekly: { easy: 6, medium: 0, hard: 0 }, challenges: [12, 8, 6], stars: [6, 4, 3] },
  { name: "Regular", days: 5, practicePerDay: 10, roomsPerWeek: 2, ratedPerWeek: 15, friendChallengesPerWeek: 2, arenaPerWeek: 0, scoreAttackPerWeek: 0, weekly: { easy: 8, medium: 8, hard: 3 }, challenges: [40, 25, 15], stars: [20, 10, 6] },
  { name: "Keen", days: 7, practicePerDay: 10, roomsPerWeek: 4, ratedPerWeek: 56, friendChallengesPerWeek: 5, arenaPerWeek: 4, scoreAttackPerWeek: 2, weekly: { easy: 8, medium: 8, hard: 8 }, challenges: [100, 60, 35], stars: [50, 25, 15] },
];

/** One season's Joules: each day's events through settleDay (limits and the soft cap), plus the weekly rewards. */
function season(p: Profile, a: Amounts, index: 0 | 1 | 2): { joules: number; firstWeek60: number | null } {
  const playDays = WEEKS * p.days;
  const spread = (total: number, day: number) => Math.floor(((day + 1) * total) / playDays) - Math.floor((day * total) / playDays);
  let joules = 0;
  let firstWeek60: number | null = null;
  let d = 0;
  for (let w = 0; w < WEEKS; w++) {
    for (let k = 0; k < p.days; k++, d++) {
      const ev: { kind: JoulesKind; base: number }[] = [];
      ev.push({ kind: "daily_puzzle", base: a.daily }, { kind: "daily_arcade", base: a.daily });
      for (let i = 0; i < p.practicePerDay; i++) if (a.practice) ev.push({ kind: "practice", base: a.practice });
      for (let i = 0; i < spread(p.roomsPerWeek * WEEKS, d); i++) {
        if (a.room_round) for (let r = 0; r < 6; r++) ev.push({ kind: "room_round", base: a.room_round });
        if (a.room_finish) ev.push({ kind: "room_finish", base: a.room_finish });
      }
      for (let i = 0; i < spread(p.ratedPerWeek * WEEKS, d); i++) ev.push({ kind: "rated", base: ratedMatchJoules({ won: i % 2 === 0, long: false }) });
      for (let i = 0; i < spread(p.friendChallengesPerWeek * WEEKS, d); i++) ev.push({ kind: "challenge", base: a.challenge });
      for (let i = 0; i < spread(p.arenaPerWeek * WEEKS, d); i++) ev.push({ kind: "tournament", base: tournamentJoules({ kind: "arena_duel" }) });
      for (let i = 0; i < spread(p.scoreAttackPerWeek * WEEKS, d); i++) ev.push({ kind: "tournament", base: tournamentJoules({ kind: "finished" }) });
      for (let i = 0; i < spread(p.challenges[index], d); i++) ev.push({ kind: "practice_challenge", base: a.practice_challenge });
      for (let i = 0; i < spread(p.stars[index], d); i++) if (a.star) ev.push({ kind: "star", base: a.star });
      joules += settleDay(ev).reduce((x, y) => x + y, 0);
    }
    if (w < p.weekly.easy) joules += a.weekly.easy;
    if (w < p.weekly.medium) joules += a.weekly.medium;
    if (w < p.weekly.hard) joules += a.weekly.hard;
    if (firstWeek60 === null && levelFor(joules) >= 60) firstWeek60 = w + 1;
  }
  return { joules, firstWeek60 };
}

const fmt = (n: number) => n.toLocaleString("en-GB");
console.log("| Profile | Season | Before: Joules a week → level | Now: Joules a week → level |");
console.log("| --- | --- | --- | --- |");
for (const p of PROFILES)
  for (const i of [0, 1, 2] as const) {
    const b = season(p, BEFORE, i);
    const n = season(p, NOW, i);
    const cell = (r: { joules: number; firstWeek60: number | null }) =>
      `${fmt(Math.round(r.joules / WEEKS))} → ${levelFor(r.joules)}${r.firstWeek60 ? ` (60 in week ${r.firstWeek60})` : ""}`;
    console.log(`| ${p.name} | ${i + 1} | ${cell(b)} | ${cell(n)} |`);
  }
