/**
 * The Category Cup's Swiss system (wave 4, W4c; docs/tournaments/events.md "Swiss"). Pure: the standings from the
 * settled matches and each round's pairings, the same on any machine for the same input.
 *
 * - Points are counted in halves: a match win 2, a drawn match 1, a loss 0, a bye 2 (a bye is worth a win).
 * - Standings: points, then Buchholz (the sum of the opponents' points; byes add nothing), then head-to-head (the
 *   points tied players took from each other), then the total score across the cup, then entry order (earliest first).
 * - Pairing: players on the same points meet where possible (a player floats down to the next score group only when
 *   their group can't pair); never the same opponent twice; nobody is knocked out. With an odd number, the
 *   lowest-placed player who hasn't had a bye gets one.
 */

export interface SwissPlayer {
  id: string;
  /** Entry order, 0 first: the last tie-break, and round 1's order. */
  order: number;
}

export interface SwissResult {
  /** The match winner's id; null for a drawn match. */
  winner: string | null;
  /** Each side's total score over the match's games. */
  totalA: number;
  totalB: number;
  /**
   * Players whose run the server flagged in this match (Joe, 11 Nov 2026): they take no points and no score from it
   * (counted as a loss). Their opponent's result stands: the win when only one side was flagged.
   */
  noPoints?: readonly string[];
}

export interface SwissMatch {
  round: number;
  a: string;
  /** null: a bye for `a`. */
  b: string | null;
  /** null while the match is played. */
  result: SwissResult | null;
}

export interface SwissStanding {
  id: string;
  place: number;
  /** In halves (a win 2). */
  points2: number;
  wins: number;
  draws: number;
  losses: number;
  byes: number;
  /** In halves: the opponents' points. */
  buchholz2: number;
  /** In halves: points taken from the players level on points and Buchholz. */
  headToHead2: number;
  totalScore: number;
  order: number;
  opponents: string[];
}

/** Points in words: 2 → "1", 3 → "1½". */
export function pointsText(points2: number): string {
  const whole = Math.floor(points2 / 2);
  return points2 % 2 ? `${whole}½` : String(whole);
}

function tally(players: readonly SwissPlayer[], matches: readonly SwissMatch[]) {
  const rows = new Map<string, SwissStanding>();
  for (const p of players)
    rows.set(p.id, { id: p.id, place: 0, points2: 0, wins: 0, draws: 0, losses: 0, byes: 0, buchholz2: 0, headToHead2: 0, totalScore: 0, order: p.order, opponents: [] });
  const meetings: { a: string; b: string; aPts: number; bPts: number }[] = [];
  for (const m of matches) {
    if (!m.result) continue;
    const a = rows.get(m.a);
    if (!a) continue;
    if (m.b === null) {
      a.points2 += 2;
      a.byes++;
      continue;
    }
    const b = rows.get(m.b);
    if (!b) continue;
    a.opponents.push(b.id);
    b.opponents.push(a.id);
    const voidA = m.result.noPoints?.includes(a.id) === true;
    const voidB = m.result.noPoints?.includes(b.id) === true;
    a.totalScore += voidA ? 0 : m.result.totalA;
    b.totalScore += voidB ? 0 : m.result.totalB;
    let aPts = 1;
    let bPts = 1;
    if (m.result.winner === a.id) [aPts, bPts] = [2, 0];
    else if (m.result.winner === b.id) [aPts, bPts] = [0, 2];
    if (voidA) aPts = 0;
    if (voidB) bPts = 0;
    a.points2 += aPts;
    b.points2 += bPts;
    // A flagged side's match is a loss; a match both sides drew (neither flagged) a draw each.
    if (aPts === 2) a.wins++;
    else if (aPts === 1) a.draws++;
    else a.losses++;
    if (bPts === 2) b.wins++;
    else if (bPts === 1) b.draws++;
    else b.losses++;
    meetings.push({ a: a.id, b: b.id, aPts, bPts });
  }
  for (const r of rows.values()) r.buchholz2 = r.opponents.reduce((s, o) => s + (rows.get(o)?.points2 ?? 0), 0);
  return { rows, meetings };
}

/** The standings from the settled matches, best first, every tie broken (entry order last, so places are unique). */
export function swissStandings(players: readonly SwissPlayer[], matches: readonly SwissMatch[]): SwissStanding[] {
  const { rows, meetings } = tally(players, matches);
  const list = [...rows.values()];
  // Head-to-head among players level on points and Buchholz.
  const groups = new Map<string, SwissStanding[]>();
  for (const r of list) {
    const k = `${r.points2}:${r.buchholz2}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ids = new Set(group.map((g) => g.id));
    for (const m of meetings) {
      if (!ids.has(m.a) || !ids.has(m.b)) continue;
      rows.get(m.a)!.headToHead2 += m.aPts;
      rows.get(m.b)!.headToHead2 += m.bPts;
    }
  }
  list.sort(
    (x, y) =>
      y.points2 - x.points2 ||
      y.buchholz2 - x.buchholz2 ||
      y.headToHead2 - x.headToHead2 ||
      y.totalScore - x.totalScore ||
      x.order - y.order ||
      (x.id < y.id ? -1 : x.id > y.id ? 1 : 0),
  );
  list.forEach((r, i) => (r.place = i + 1));
  return list;
}

export interface SwissPairing {
  a: string;
  /** null: a bye. */
  b: string | null;
}

export class SwissPairingError extends Error {}

/** The search's budget: far more than any field of 128 over 7 rounds needs (each step is one tried partner). */
const PAIR_BUDGET = 2_000_000;

/**
 * The next round's pairings. `matches` are every earlier round's (all settled). Players are taken in standings order;
 * each is paired with the nearest-placed unpaired player on the same points they haven't met, floating down a group
 * only when the rest can't otherwise pair (a search that backs up). The bye goes to the lowest-placed player without
 * one whose leaving still lets everyone else pair.
 */
export function pairSwissRound(players: readonly SwissPlayer[], matches: readonly SwissMatch[]): SwissPairing[] {
  const standings = swissStandings(players, matches);
  const met = new Map<string, Set<string>>();
  for (const s of standings) met.set(s.id, new Set());
  const hadBye = new Set<string>();
  for (const m of matches) {
    if (m.b === null) {
      hadBye.add(m.a);
      continue;
    }
    met.get(m.a)?.add(m.b);
    met.get(m.b)?.add(m.a);
  }
  const ranked = standings.map((s) => ({ id: s.id, points2: s.points2 }));
  let budget = PAIR_BUDGET;

  type Seat = { id: string; points2: number };
  const canMeet = (x: Seat, y: Seat) => !met.get(x.id)!.has(y.id);

  /**
   * Pairs `pool` (in standings order) leaving exactly `skip` players unpaired, preferring to pair each player with the
   * nearest one below and to leave the lowest-placed out; a search that backs up within its own small budget.
   */
  const pairLeaving = (pool: Seat[], skip: number): { pairs: SwissPairing[]; left: Seat[] } | null => {
    const used = new Array<boolean>(pool.length).fill(false);
    const pairs: SwissPairing[] = [];
    const left: Seat[] = [];
    let steps = 50_000;
    const step = (skipsLeft: number): boolean => {
      const i = used.indexOf(false);
      if (i === -1) return skipsLeft === 0;
      if (--steps < 0 || --budget < 0) return false;
      used[i] = true;
      const me = pool[i]!;
      for (let j = i + 1; j < pool.length; j++) {
        if (used[j] || !canMeet(me, pool[j]!)) continue;
        used[j] = true;
        pairs.push({ a: me.id, b: pool[j]!.id });
        if (step(skipsLeft)) return true;
        pairs.pop();
        used[j] = false;
      }
      if (skipsLeft > 0) {
        left.push(me);
        if (step(skipsLeft - 1)) return true;
        left.pop();
      }
      used[i] = false;
      return false;
    };
    return step(skip) ? { pairs, left } : null;
  };

  /**
   * Score group by score group, from the top: each group (with any players floated down from the one above, placed
   * first) pairs among itself, floating the fewest players down (one for an odd group, two more for each a rematch
   * forces), the lowest-placed first. The last group must pair everyone; if it can't, one search over the whole pool
   * that backs up (same points first, then the nearest).
   */
  const pairAll = (pool: Seat[]): SwissPairing[] | null => {
    const groups: Seat[][] = [];
    for (const p of pool) {
      const g = groups[groups.length - 1];
      if (g && g[0]!.points2 === p.points2) g.push(p);
      else groups.push([p]);
    }
    let carry: Seat[] = [];
    const out: SwissPairing[] = [];
    let ok = true;
    for (let gi = 0; gi < groups.length && ok; gi++) {
      const here = [...carry, ...groups[gi]!];
      const last = gi === groups.length - 1;
      let done: { pairs: SwissPairing[]; left: Seat[] } | null = null;
      if (last) done = pairLeaving(here, 0);
      else for (let skip = here.length % 2; skip <= here.length && !done; skip += 2) done = pairLeaving(here, skip);
      if (!done) ok = false;
      else {
        out.push(...done.pairs);
        carry = done.left;
      }
    }
    if (ok) return out;
    return pairAnyhow(pool);
  };

  /** The fallback: any pairing without a rematch, same points first, then the nearest (rarely needed). */
  const pairAnyhow = (pool: Seat[]): SwissPairing[] | null => {
    const used = new Array<boolean>(pool.length).fill(false);
    const out: SwissPairing[] = [];
    const step = (): boolean => {
      const i = used.indexOf(false);
      if (i === -1) return true;
      used[i] = true;
      const me = pool[i]!;
      const candidates: number[] = [];
      for (let j = i + 1; j < pool.length; j++) if (!used[j] && canMeet(me, pool[j]!)) candidates.push(j);
      candidates.sort((x, y) => Math.abs(pool[x]!.points2 - me.points2) - Math.abs(pool[y]!.points2 - me.points2) || x - y);
      for (const j of candidates) {
        if (--budget < 0) throw new SwissPairingError("pairing search ran out of budget");
        used[j] = true;
        out.push({ a: me.id, b: pool[j]!.id });
        if (step()) return true;
        out.pop();
        used[j] = false;
      }
      used[i] = false;
      return false;
    };
    return step() ? out : null;
  };

  if (ranked.length % 2 === 0) {
    const pairs = pairAll(ranked);
    if (!pairs) throw new SwissPairingError("no pairing without a rematch");
    return pairs;
  }
  // Odd: the bye from the bottom up, to players without one first.
  const byeOrder = [...ranked.keys()].reverse().sort((x, y) => Number(hadBye.has(ranked[x]!.id)) - Number(hadBye.has(ranked[y]!.id)));
  for (const k of byeOrder) {
    const pool = ranked.filter((_, i) => i !== k);
    const pairs = pairAll(pool);
    if (pairs) return [...pairs, { a: ranked[k]!.id, b: null }];
  }
  throw new SwissPairingError("no pairing without a rematch");
}
