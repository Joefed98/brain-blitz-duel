/**
 * The scoring audit's arcade fixes (Nov 2026, docs/audit-nov-2026/scoring.md issues 2, 5, 7 and 8): the five games, the
 * stamp each dealt before the fix and the one it deals now, and how a run is played and replayed through the server.
 * Shared by scoring-audit-arcade-check and scripts/scoring-audit-arcade-legacy-record.ts (which loads this file from a
 * checkout of main, so it imports through `root`).
 *
 * Every new stamp keeps the old stamp's play exactly (the same log gives the same ticks and checksum); only the score
 * differs: Spacewalk crossRev 11 → 12, Wavefront wavRev 12 → 13, Fission burstRev 10 → 11 (the life that ends the run is
 * not charged; mistakes take at most half the core; Fission also charges wasted beams), High Rise skylineRev 9 → 10
 * (perfect drops counted up to 61), Slice sliceRev 12 → 13 (core and combo on straight lines from 0).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export const AUDIT_GAMES = [
  { type: "cross", field: "crossRev", old: 11, rev: 12 },
  { type: "wavefront", field: "wavRev", old: 12, rev: 13 },
  { type: "burst", field: "burstRev", old: 10, rev: 11 },
  { type: "skyline", field: "skylineRev", old: 9, rev: 10 },
  { type: "slice", field: "sliceRev", old: 12, rev: 13 },
] as const;
export type AuditType = (typeof AUDIT_GAMES)[number]["type"];

export const AUDIT_LEVELS = ["weak", "average", "good", "great", "near", "elite", "perfect"] as const;

export interface AuditRun {
  type: AuditType;
  rev: number;
  seed: number;
  label: string;
  raw: string;
  score: number;
  checksum: number;
  tick: number;
}

/** The modules a run needs, from the tree at `root` (this checkout, or a checkout of main). */
export async function auditKit(root: string) {
  const imp = (p: string) => import(`${root}/${p}`) as Promise<any>;
  const [games, human, cross, wav, burst, sky, slice] = await Promise.all([
    imp("scripts/arcade-skill-bands/games.ts"),
    imp("scripts/arcade-skill-bands/human.ts"),
    imp("src/lib/arcade/cross.ts"),
    imp("src/lib/arcade/wavefront.ts"),
    imp("src/lib/arcade/burst.ts"),
    imp("src/lib/arcade/skyline.ts"),
    imp("src/lib/arcade/slice.ts"),
  ]);
  const bots: Record<string, any> = {};
  for (const g of AUDIT_GAMES) bots[g.type] = (await imp(`scripts/arcade-skill-bands/bots/${g.type}.ts`)).bot;
  const spec = (type: string) => (games.GAMES as any[]).find((s) => s.type === type)!;
  const gameFor: Record<string, (rev: number) => any> = {
    cross: cross.crossGameFor,
    wavefront: wav.wavefrontGameFor,
    burst: burst.burstGameFor,
    skyline: sky.skylineGameFor,
    slice: slice.sliceGameFor,
  };
  const checkpoint: Record<string, (s: any) => { checksum: number }> = {
    cross: cross.crossCheckpoint,
    wavefront: wav.wavCheckpoint,
    burst: burst.burstCheckpoint,
    skyline: sky.skylineCheckpoint,
    slice: slice.sliceCheckpoint,
  };
  const taps = (type: string) => Boolean(spec(type).taps);

  /**
   * Encodes a log as the phone does (its checkpoints and claimed score: the sim's own, taken from a first replay) and
   * replays it through the server's path for `rev`.
   */
  function serverRun(type: AuditType, rev: number, seed: number, log: { events?: any[]; taps?: number[] }) {
    const body = { seed, claimedScore: 0, events: log.events ?? [], inputs: log.taps ?? [], taps: [], endTick: 0, checkpoints: [] as any[] };
    const first = spec(type).replay(seed, spec(type).encode(body, rev, seed), rev);
    const raw = spec(type).encode({ ...body, claimedScore: first.score, endTick: first.state.tick, checkpoints: first.checkpoints ?? [] }, rev, seed);
    return { raw, result: replay(type, rev, seed, raw) };
  }
  function replay(type: AuditType, rev: number, seed: number, raw: string) {
    const r = spec(type).replay(seed, raw, rev);
    return { score: r.score as number, state: r.state, checksum: checkpoint[type]!(r.state).checksum, tick: r.state.tick as number, flagged: Boolean(r.flagged), desyncTick: (r.desyncTick ?? null) as number | null };
  }
  /** A skill-band bot's log at `level` on `rev`. */
  function botLog(type: AuditType, rev: number, seed: number, level: string) {
    return bots[type]({ game: gameFor[type]!(rev), seed, rev, human: new human.Human(type, seed, level), fixes: true });
  }
  /** Fission's lazy players: fire every `every` ticks from the start spot, or sweep wall to wall firing. */
  function burstSpam(seed: number, every: number): { events: any[] } {
    const g = gameFor.burst!(10);
    const events: any[] = [];
    for (let t = every; t < g.runTicks; t += every) events.push({ t, k: burst.BURST_INPUT_FIRE, a: 0, b: 0, c: 0, d: 0 });
    return { events };
  }
  return { gameFor, checkpoint, taps, serverRun, replay, botLog, burstSpam, roomSeed: games.roomSeed as (n: number) => number, mods: { cross, wav, burst, sky, slice } };
}

/** The legacy fixture's runs: each game's old stamp (and Slice's sliceRev 11), bots at every level on four room seeds, plus Fission's lazy players. */
export async function auditLegacyRuns(root: string): Promise<AuditRun[]> {
  const kit = await auditKit(root);
  const runs: AuditRun[] = [];
  const add = (type: AuditType, rev: number, seed: number, label: string, log: { events?: any[]; taps?: number[] }) => {
    const { raw, result } = kit.serverRun(type, rev, seed, log);
    runs.push({ type, rev, seed, label, raw, score: result.score, checksum: result.checksum, tick: result.tick });
  };
  for (const g of AUDIT_GAMES) {
    const revs = g.type === "slice" ? [g.old, g.old - 1] : [g.old];
    for (const rev of revs)
      for (const n of [0, 3, 11, 29])
        for (const level of AUDIT_LEVELS) {
          const seed = kit.roomSeed(n);
          add(g.type, rev, seed, `${level} bot`, kit.botLog(g.type, rev, seed, level));
        }
  }
  for (const n of [0, 3, 11, 29]) for (const every of [1, 5]) add("burst", 10, kit.roomSeed(n), `fire every ${every} ticks`, kit.burstSpam(kit.roomSeed(n), every));
  return runs;
}
