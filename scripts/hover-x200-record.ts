/**
 * Records Hover runs for hover-x200-check (the 200 expansion, hoverRev 9).
 *
 *   bun scripts/hover-x200-record.ts --legacy   # pre-change runs on hoverRev 7 (and 2–6, unstamped), run on main
 *
 * The skill-band bot plays each revision on fixed room seeds; each run's encoded
 * answer and what the server replay made of it (score, gates, stars, survival,
 * final checkpoint checksum, every 300-tick checksum) are written to
 * scripts/fixtures/hover-expand-legacy.json.gz. hover-x200-check replays every
 * entry after the change and fails on any difference.
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { hoverCheckpoint, hoverGameFor, HOVER_CHECKPOINT_INTERVAL } from "../src/lib/arcade/hover";
import { encodeHoverRun, replayHoverRun } from "../src/lib/duel/hover";
import { roomSeed } from "./arcade-skill-bands/games";
import { Human, LEVELS } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/hover";

export interface HoverFixtureRun {
  rev: number | null;
  level: string;
  seed: number;
  raw: string;
  score: number;
  gates: number;
  stars: number;
  survived: boolean;
  checksum: number;
  checksums: number[];
}

/**
 * A flawless player for the 200 proof: the near-perfect profile with no timing error, lag, slip
 * or misjudgement, who goes for every star, tight gate, chain and shield.
 */
export class PerfectHuman extends Human {
  readonly flawless = true;
  constructor(seed: number) {
    super("hover", seed, "near");
  }
  override chance(): boolean {
    return true;
  }
  override slip(): boolean {
    return false;
  }
  override timingTicks(): number {
    return 0;
  }
  override lagTicks(): number {
    return 0;
  }
  override normal(): number {
    return 0;
  }
}

/** Plays one bot run on a revision and returns its encoded answer (the phone's log, checkpoints and claim). */
export function botRun(rev: number | null, level: (typeof LEVELS)[number] | "perfect", seed: number): string {
  const game = hoverGameFor(rev);
  const human = level === "perfect" ? new PerfectHuman(seed) : new Human("hover", seed, level);
  const out = bot({ game, seed, rev, human });
  const taps = new Set(out.taps ?? []);
  let state = game.init(seed);
  const checkpoints = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    state = game.step(state, taps.has(state.tick + 1));
    if (state.tick % HOVER_CHECKPOINT_INTERVAL === 0) checkpoints.push(hoverCheckpoint(state));
  }
  return encodeHoverRun({ seed, claimedScore: game.score(state), inputs: out.taps ?? [], endTick: state.tick, checkpoints });
}

export function fixtureOf(rev: number | null, level: string, seed: number, raw: string): HoverFixtureRun {
  const r = replayHoverRun(seed, raw, rev);
  return {
    rev,
    level,
    seed,
    raw,
    score: r.score,
    gates: r.gates,
    stars: r.stars,
    survived: r.survived,
    checksum: hoverCheckpoint(r.state).checksum,
    checksums: r.checkpoints.map((c) => c.checksum),
  };
}

if (import.meta.main && process.argv.includes("--legacy")) {
  const runs: HoverFixtureRun[] = [];
  // Rooms dealt hoverRev 7 until this change: 8 runs per level. Older stamps: a few each.
  const plan: [number | null, number][] = [[7, 8], [6, 2], [5, 2], [4, 1], [3, 1], [2, 1], [null, 1]];
  for (const [rev, perLevel] of plan)
    for (const level of LEVELS)
      for (let n = 0; n < perLevel; n++) {
        const seed = roomSeed(1000 + n * 7 + (rev ?? 0));
        runs.push(fixtureOf(rev, level, seed, botRun(rev, level, seed)));
      }
  writeFileSync("scripts/fixtures/hover-expand-legacy.json.gz", gzipSync(JSON.stringify(runs)));
  console.log(`wrote ${runs.length} legacy runs (scores ${runs.map((r) => r.score).join(" ")})`);
}
