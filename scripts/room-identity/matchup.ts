/**
 * Room identity for Gemstone matchupRev 11 (the arcade scoring standard, docs/arcade-standard-oct-2026/matchup.md; matchupRev 10 before it, docs/phone-notes-oct-2026/gemstone.md): `scheduleOf`
 * replays an input log and lists what the seed alone decides: the ice (laid once at the start), each level's goal
 * (colours and count) and each treasure gem's column, numbered by order (entry t = k for the k-th level and the k-th
 * treasure, t = 0 for the ice), since when a level is met or a treasure is placed is the player's play. Two very
 * different logs must agree on every level and treasure both runs reached: the k-th goal and the k-th treasure are
 * the same for everyone, whatever they did.
 *
 *   import { roomIdentity } from "./room-identity/matchup";
 */
import type { ArcadeInputEvent } from "../../src/lib/arcade/engine";
import { matchupGameFor, MATCHUP_INPUT_SWAP, MATCHUP_REV_STD, MATCHUP_SIZE, MATCHUP_TREASURE, MATCHUP_V9_ROWS, type MatchupState } from "../../src/lib/arcade/matchup";
import { Human, type SkillLevel } from "../arcade-skill-bands/human";
import { bot } from "../arcade-skill-bands/bots/matchup";

export function scheduleOf(seed: number, rev: number, events: unknown): { entries: { t: number; what: string }[]; endTick: number } {
  const game = matchupGameFor(rev);
  const byTick = new Map(((events as ArcadeInputEvent[]) ?? []).map((e) => [e.t, e]));
  let s = game.init(seed) as MatchupState;
  const entries: { t: number; what: string }[] = [];
  const ice = (s.ice ?? []).flatMap((v, i) => (v ? [i] : []));
  entries.push({ t: 0, what: `ice ${ice.join(",")}` });
  const goal = (st: MatchupState) => (st.goalLeft ?? []).map((n, c) => (n ? `${c}×${n}` : "")).filter(Boolean).join(" ");
  entries.push({ t: 1, what: `level 1 goal ${goal(s)}` });
  const treasureCol = (st: MatchupState) => st.cells.indexOf(MATCHUP_TREASURE) % MATCHUP_SIZE;
  entries.push({ t: 1, what: `treasure 1 in column ${treasureCol(s)}` });
  while (!game.isOver(s)) {
    const prev = s;
    s = game.step(s, byTick.get(s.tick + 1) ?? null) as MatchupState;
    if ((s.levels ?? 0) > (prev.levels ?? 0)) entries.push({ t: (s.level ?? 0) + 1, what: `level ${(s.level ?? 0) + 1} goal ${goal(s)}` });
    if ((s.treasurePlaced ?? 0) > (prev.treasurePlaced ?? 0)) entries.push({ t: s.treasurePlaced ?? 0, what: `treasure ${s.treasurePlaced} in column ${treasureCol(s)}` });
  }
  entries.sort((a, b) => a.t - b.t || a.what.localeCompare(b.what));
  // Compare up to the fewest levels or treasures any log reached.
  return { entries, endTick: Math.min((s.level ?? 0) + 1, s.treasurePlaced ?? 0) };
}

/** Uniformly random swaps (about two a second), from a seeded stream (for ad-hoc runs). */
export function randomLog(seed: number, ticks = 5400): ArcadeInputEvent[] {
  let a = (seed ^ 0x51ed270b) >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const events: ArcadeInputEvent[] = [];
  for (let t = 1; t <= ticks; t += 20 + Math.floor(rand() * 20)) {
    const row = Math.floor(rand() * MATCHUP_V9_ROWS);
    const col = Math.floor(rand() * (MATCHUP_SIZE - 1));
    events.push({ t, k: MATCHUP_INPUT_SWAP, a: row, b: col, c: row, d: col + 1 });
  }
  return events;
}

export function botLog(seed: number, level: SkillLevel): ArcadeInputEvent[] {
  const game = matchupGameFor(MATCHUP_REV_STD);
  return bot({ game, seed, rev: MATCHUP_REV_STD, human: new Human("matchup", seed, level), fixes: true }).events ?? [];
}

export const roomIdentity = {
  type: "matchup",
  rev: MATCHUP_REV_STD,
  logs: (seed: number) => [
    // Bots at three levels (a random log rarely brings a treasure down, so it would cap the comparison at the first).
    { name: "weak", log: botLog(seed, "weak") },
    { name: "good", log: botLog(seed, "good") },
    { name: "elite", log: botLog(seed, "elite") },
  ],
  scheduleOf,
};
