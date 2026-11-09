/**
 * Every place the app ranks, on seeded rooms and boards (B3 of docs/audit-nov-2026/architecture.md): standings after
 * every round (Total score and Placings, stamped and unstamped tie-break rooms, ties, left and inactive players, missed
 * rounds), duelOutcome for every pair, the podium's awards and the Daily's rankBoard. scripts/ranking-identity-record.ts
 * wrote scripts/fixtures/ranking-identity.json.gz on main before ranking moved into ranking.ts; ranking-identity-check
 * proves today's tree gives exactly the same output.
 */
import { createHash } from "node:crypto";

import { duelOutcome, standings, type TieRound } from "../src/lib/duel/scoring";
import { rankBoard } from "../src/lib/duel/daily";
import { podiumAwards, type AwardRound } from "../src/lib/duel/podiumAwards";
import type { DuelPlayerRow, RoundResultRow } from "../src/lib/duel/types";
import type { ScoringMode } from "../src/lib/duel/scoringMode";

function rng(seed: number) {
  let s = seed >>> 0;
  return (n: number) => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000) * n);
  };
}

export interface Room {
  players: DuelPlayerRow[];
  results: RoundResultRow[];
  rounds: number;
  tie: TieRound[] | null;
  awardRounds: AwardRound[];
}

const TYPES = ["sudoku", "reaction", "hover", "flow", "stopwatch", "orbit"] as const;

export function makeRoom(seed: number): Room {
  const r = rng(seed);
  const n = 2 + r(15);
  const rounds = 1 + r(12);
  // Narrow score and time ranges, so ties on total, on time and on both are common.
  const spread = [3, 10, 200][r(3)]!;
  const timeSpread = [2, 5, 90][r(3)]!;
  const players: DuelPlayerRow[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    duel_id: "d",
    player_slot: [i + 1, n - i, (i * 7) % n + 1][seed % 3]!,
    display_name: `P${i}`,
    user_id: `u${i}`,
    ready_round: 0,
    intro_ready_round: 0,
    muted_by_host: false,
    last_reaction_at: null,
    last_seen_at: "2026-11-09T00:00:00Z",
    status: (["active", "active", "active", "inactive", "left"] as const)[r(5)]!,
    joined_at: "2026-11-09T00:00:00Z",
  }));
  const tie: TieRound[] | null = r(3) === 0 ? null : Array.from({ length: rounds }, () => ({ limitMs: 30000 + r(3) * 15000, phaseLimitMs: 32000 + r(2) * 5000, flash: r(6) === 0 }));
  const results: RoundResultRow[] = [];
  for (const p of players) {
    for (let round = 1; round <= rounds; round++) {
      if (r(6) === 0) continue;
      const score = r(spread + 1) * (spread === 3 ? 50 : 1);
      results.push({
        id: `${p.player_slot}-${round}`,
        duel_id: "d",
        player_slot: p.player_slot,
        round_number: round,
        answer: null,
        is_correct: score > 0,
        ms_remaining: r(timeSpread) * 1000,
        reaction_avg_ms: r(5) === 0 ? 200 + r(3) * 10 : null,
        correct_count: null,
        errors: null,
        extra: null,
        score,
        submitted_at: "2026-11-09T00:00:00Z",
      });
    }
  }
  // Shuffle the rows: ranking must not depend on row order beyond what it did before.
  for (let i = results.length - 1; i > 0; i--) {
    const j = r(i + 1);
    [results[i], results[j]] = [results[j]!, results[i]!];
  }
  const awardRounds: AwardRound[] = Array.from({ length: rounds }, (_, i) => {
    const type = TYPES[r(TYPES.length)]!;
    return { type, name: type, timeLimitMs: 30000, timed: type !== "orbit" && type !== "hover" && type !== "reaction" };
  });
  return { players, results, rounds, tie, awardRounds };
}

export function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24);
}

export function rankingIdentity(rooms: number, boards: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (let seed = 1; seed <= rooms; seed++) {
    const room = makeRoom(seed);
    for (const mode of ["total", "placings"] as ScoringMode[]) {
      const tables = [];
      for (let through = 0; through <= room.rounds; through++) {
        tables.push(standings(room.players, room.results, through, new Map(), room.tie, mode));
      }
      out[`standings|${seed}|${mode}`] = digest(tables);
      const outcomes: string[] = [];
      for (const a of room.players) for (const b of room.players) {
        if (a === b) continue;
        outcomes.push(duelOutcome(room.results, a.player_slot, b.player_slot, room.tie, mode, room.rounds));
        outcomes.push(duelOutcome(room.results, a.player_slot, b.player_slot, room.tie, mode));
      }
      out[`outcome|${seed}|${mode}`] = digest(outcomes);
      out[`awards|${seed}|${mode}`] = digest(podiumAwards(room.players, room.results, room.awardRounds, room.tie, mode));
    }
    // Unstamped rooms called without a tie argument at all.
    out[`standings-notie|${seed}`] = digest(standings(room.players, room.results, room.rounds));
  }
  for (let seed = 1; seed <= boards; seed++) {
    const r = rng(seed * 31 + 5);
    const n = 1 + r(40);
    const entries = Array.from({ length: n }, (_, i) => ({
      id: `a${r(1000)}-${i}`,
      total: r(4) * 100 + r(3),
      tieMs: r(3) * 1000,
      finishedAt: r(4) * 60000,
      extra: i,
    }));
    out[`board|${seed}`] = digest(rankBoard(entries));
  }
  return out;
}

export const FIXTURE = "scripts/fixtures/ranking-identity.json.gz";
export const COUNTS = { rooms: 3000, boards: 2000 };
