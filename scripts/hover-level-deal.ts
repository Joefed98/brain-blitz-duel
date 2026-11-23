/**
 * Hover's hoverRev 12 deal (D5, 23 Nov 2026; docs/arcade-standard/hover.md "Levels (D5, 23 Nov 2026)"): writes
 * src/lib/duel/hoverLevelDeals.server.ts, the seeds rooms deal on hoverRev 12 at each level (Normal included), and the
 * witnesses that prove them, scripts/fixtures/hover-level-deal-witness.json.gz.
 *
 * The D5 proof standard: a seed is dealt at a level only when the proof player (scripts/hover-proof-player.ts: the
 * flawless player held to the human limits, taps at least 0.15 s apart, nothing answered sooner than 0.25 s after it
 * scrolled into view) flies it to exactly 200 through the server replay (replayHoverRun on the level's game), unflagged.
 * Candidates are the skill-band room seeds n = 0, 1, 2… (the tuning seeds first, then the fresh ones from 10000), in
 * order; the first HOVER_DEAL_KEEP that reach 200 are dealt.
 *
 * The proof player takes several seconds a run, so the build is in two steps:
 *   bun scripts/hover-level-deal.ts campaign --level=<l> [--from=0] [--to=300]
 *       plays the proof player (and the ladder's average and elite players, for tuning) on candidates [from, to) of the
 *       list and appends each run's taps and raw counts to .shots/hover-campaign-<level>.jsonl (not committed);
 *   bun scripts/hover-level-deal.ts build [--keep=100]
 *       reads the campaigns, replays each candidate's proof log on today's level game in candidate order and keeps the
 *       first `keep` that score exactly 200, then writes the deal file and the witness fixture.
 *   bun scripts/hover-level-deal.ts --check [--replay=<n>]
 *       replays every stored witness and rebuilds the deal file in memory; fails unless every witness scores 200 and the
 *       file is identical; --replay=n also re-plays the proof player on n seeds a level and fails unless it plays
 *       exactly the stored witness.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { HOVER_CHECKPOINT_INTERVAL, HOVER_REV_FIT, hoverCheckpoint, hoverGameFor, type HoverState } from "../src/lib/arcade/hover";
import { encodeHoverRun, replayHoverRun } from "../src/lib/duel/hover";
import type { Level } from "../src/lib/levels/levels";
import { roomSeed } from "./arcade-skill-bands/games";
import { hoverProofTaps } from "./hover-proof-player";

export const HOVER_DEAL_FILE = "src/lib/duel/hoverLevelDeals.server.ts";
export const HOVER_DEAL_WITNESS = "scripts/fixtures/hover-level-deal-witness.json.gz";
export const HOVER_DEAL_LEVELS: readonly Level[] = ["easy", "normal", "hard", "expert"];
export const HOVER_DEAL_KEEP = 100;
export const HOVER_DEAL_CANDIDATES: readonly number[] = [...Array.from({ length: 60 }, (_, i) => i), ...Array.from({ length: 1200 }, (_, i) => 10000 + i)];
export const hoverCampaignFile = (level: Level) => `.shots/hover-campaign-${level}.jsonl`;

export interface HoverWitness {
  seed: number;
  /** The candidate index (the skill-band room seed n). */
  n: number;
  taps: number[];
}
export interface HoverDealWitnesses {
  /** Per level: candidates tried, and the kept seeds' witnesses in the order kept. */
  levels: Partial<Record<Level, { tried: number; witnesses: HoverWitness[] }>>;
}

/** The phone's encoding of a tap log played on a level's hoverRev 12 game, and the server's replay of it. */
export function proveHoverWitness(seed: number, level: Level, taps: readonly number[]): { score: number; flagged: boolean; raw: string; state: HoverState } {
  const game = hoverGameFor(HOVER_REV_FIT, level);
  const set = new Set(taps);
  let s = game.init(seed) as HoverState;
  const checkpoints = [];
  while (!game.isOver(s)) {
    s = game.step(s, set.has(s.tick + 1)) as HoverState;
    if (s.tick % HOVER_CHECKPOINT_INTERVAL === 0) checkpoints.push(hoverCheckpoint(s));
  }
  const raw = encodeHoverRun({ seed, claimedScore: game.score(s), inputs: [...taps], endTick: s.tick, checkpoints });
  const r = replayHoverRun(seed, raw, HOVER_REV_FIT, level);
  return { score: r.score, flagged: Boolean(r.flagged), raw, state: r.state };
}

/** The proof player's taps on a seed at a level. */
export function proofTapsAt(seed: number, level: Level): number[] {
  const game = hoverGameFor(HOVER_REV_FIT, level);
  return hoverProofTaps(game, game.init(seed) as HoverState).taps;
}

export function hoverDealSource(w: HoverDealWitnesses): string {
  const row = (level: Level) => {
    const at = w.levels[level];
    return `  ${level}: [${(at?.witnesses ?? []).map((x) => x.seed).join(",")}],`;
  };
  const counts = HOVER_DEAL_LEVELS.map((l) => `${l} ${w.levels[l]?.witnesses.length ?? 0} of ${w.levels[l]?.tried ?? 0}`).join(", ");
  return `/**
 * Hover's deal on hoverRev 12 (D5, 23 Nov 2026; built by \`bun scripts/hover-level-deal.ts\`, do not edit): per level, the
 * seeds rooms deal, each with a stored witness (scripts/fixtures/hover-level-deal-witness.json.gz), the proof player
 * held to the human limits (scripts/hover-proof-player.ts), that scores exactly 200 through the server replay at that
 * level. Kept of the candidates tried: ${counts}.
 */
import type { Level } from "@/lib/levels/levels";

export const HOVER_LEVEL_DEALS: Readonly<Record<Level, readonly number[]>> = {
${HOVER_DEAL_LEVELS.map(row).join("\n")}
};

/** The seed a room seed deals on hoverRev 12 at a level (Normal when none is asked). */
export function hoverLevelDealSeed(level: Level | null | undefined, roomSeed: number): number {
  const list = HOVER_LEVEL_DEALS[level ?? "normal"];
  const n = list.length;
  if (!n) return Math.trunc(roomSeed);
  return list[((Math.trunc(roomSeed) % n) + n) % n]!;
}
`;
}

export function readHoverWitnesses(): HoverDealWitnesses {
  if (!existsSync(HOVER_DEAL_WITNESS)) return { levels: {} };
  return JSON.parse(gunzipSync(readFileSync(HOVER_DEAL_WITNESS)).toString()) as HoverDealWitnesses;
}

/** Replays the stored witnesses (all, or those `only` picks); the failures. */
export function checkHoverWitnesses(w: HoverDealWitnesses, only?: (level: Level, i: number) => boolean): string[] {
  const bad: string[] = [];
  for (const level of HOVER_DEAL_LEVELS) {
    (w.levels[level]?.witnesses ?? []).forEach((x, i) => {
      if (only && !only(level, i)) return;
      const p = proveHoverWitness(x.seed, level, x.taps);
      if (p.score !== 200 || p.flagged) bad.push(`${level} ${x.seed}: ${p.flagged ? "flagged" : p.score}`);
    });
  }
  return bad;
}

interface CampaignRow {
  n: number;
  seed: number;
  taps: number[];
  /** The ladder players' raw counts on the seed (scripts/hover-level-tune.ts), for tuning. */
  raws: unknown[];
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const w = readHoverWitnesses();
  if (args.includes("--check")) {
    const bad = checkHoverWitnesses(w);
    const same = readFileSync(HOVER_DEAL_FILE, "utf8") === hoverDealSource(w);
    const replay = Number(opt("replay") ?? 0);
    for (const level of HOVER_DEAL_LEVELS) {
      const list = w.levels[level]?.witnesses ?? [];
      for (let k = 0; k < Math.min(replay, list.length); k++) {
        const x = list[Math.floor(((k + 0.5) * list.length) / replay)]!;
        if (proofTapsAt(x.seed, level).join() !== x.taps.join()) bad.push(`${level} ${x.seed}: the proof player no longer plays the witness`);
      }
    }
    console.log(`${HOVER_DEAL_LEVELS.map((l) => `${l} ${w.levels[l]?.witnesses.length ?? 0}`).join(", ")} witnessed seeds, ${bad.length} failing; ${HOVER_DEAL_FILE} ${same ? "identical" : "DIFFERS"}`);
    for (const b of bad.slice(0, 20)) console.log(`  ${b}`);
    process.exit(bad.length || !same ? 1 : 0);
  } else if (args[0] === "campaign") {
    const level = (opt("level") ?? "normal") as Level;
    const from = Number(opt("from") ?? 0);
    const to = Number(opt("to") ?? 300);
    const { playHover, rawOf } = await import("./hover-level-tune");
    const game = hoverGameFor(HOVER_REV_FIT, level);
    const bots = (opt("bots") ?? "").split(",").filter(Boolean);
    for (const n of HOVER_DEAL_CANDIDATES.slice(from, to)) {
      const seed = roomSeed(n);
      const taps = proofTapsAt(seed, level);
      const p = proveHoverWitness(seed, level, taps);
      const raws = [rawOf(level, "proof", n, seed, p.state, p.score)];
      for (const bot of bots) {
        const { state } = await playHover(game, seed, bot);
        raws.push(rawOf(level, bot, n, seed, state, game.score(state)));
      }
      appendFileSync(hoverCampaignFile(level), JSON.stringify({ n, seed, taps, raws } satisfies CampaignRow) + "\n");
      console.log(`${level} #${n}: proof ${p.score}${p.flagged ? " flagged" : ""}`);
    }
  } else if (args[0] === "build") {
    const keep = Number(opt("keep") ?? HOVER_DEAL_KEEP);
    for (const level of HOVER_DEAL_LEVELS) {
      if (!existsSync(hoverCampaignFile(level))) continue;
      const rows = readFileSync(hoverCampaignFile(level), "utf8").trim().split("\n").map((l) => JSON.parse(l) as CampaignRow);
      const byN = new Map(rows.map((r) => [r.n, r]));
      const witnesses: HoverWitness[] = [];
      let tried = 0;
      for (const n of HOVER_DEAL_CANDIDATES) {
        if (witnesses.length >= keep) break;
        const row = byN.get(n);
        if (!row) break;
        tried += 1;
        const p = proveHoverWitness(row.seed, level, row.taps);
        if (p.score === 200 && !p.flagged) witnesses.push({ seed: row.seed, n, taps: row.taps });
      }
      w.levels[level] = { tried, witnesses };
      console.log(`${level}: ${witnesses.length} of ${tried} kept`);
    }
    writeFileSync(HOVER_DEAL_WITNESS, gzipSync(JSON.stringify(w)));
    writeFileSync(HOVER_DEAL_FILE, hoverDealSource(w));
    console.log(`→ ${HOVER_DEAL_FILE}, ${HOVER_DEAL_WITNESS}`);
  }
}
