/**
 * Builds D3's proved level deals for Bonk and Tenfall (22 Nov 2026; difficulty-spec.md rule 6: a level deals only seeds
 * on which a person exactly at the human limits can score 200): for each level, candidate seeds the limits proof player
 * (d3-speed-oracles.ts) takes to exactly 200 through the server's own grade, on the level's dealt puzzle with the seed
 * in its place. Writes src/lib/duel/d3SpeedDeals.server.ts (do not edit by hand).
 *
 *   bun scripts/d3-speed-deal.ts [--check] [--candidates=160]      (--check rebuilds and compares, byte for byte)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dealAt } from "./level-tune";
import { proofScore } from "./d3-speed-oracles";
import { hashText } from "./puzzle-fairness/kit";
import type { PuzzleData } from "../src/lib/duel/types";

export const D3_SPEED_DEALS_FILE = "src/lib/duel/d3SpeedDeals.server.ts";
const GAMES = ["whack", "tendrop"] as const;
const LEVELS = ["easy", "hard", "expert"] as const;

/** The n-th candidate seed (a fixed hash sequence, positive 31-bit). */
export function candidateSeed(game: string, level: string, n: number): number {
  return (hashText(`d3-speed-deal:${game}:${level}:${n}`) % 0x7fff_fffe) + 1;
}

export function buildDeals(candidates: number): string {
  const lines: string[] = [];
  const kept: string[] = [];
  for (const game of GAMES) {
    const rows: string[] = [];
    for (const level of LEVELS) {
      // The level's own puzzle as rooms deal it; only its seed comes from the list this builds.
      const base = dealAt(game, level, 0);
      const seeds: number[] = [];
      for (let n = 0; n < candidates; n++) {
        const seed = candidateSeed(game, level, n);
        const p = { ...base, seed } as PuzzleData;
        if (proofScore(p).score >= 200) seeds.push(seed);
      }
      rows.push(`    ${level}: [${seeds.join(",")}],`);
      kept.push(`${game} ${level} ${seeds.length}`);
    }
    lines.push(`  ${game}: {\n${rows.join("\n")}\n  },`);
  }
  return `/**
 * D3's proved level deals for Bonk and Tenfall (22 Nov 2026; built by \`bun scripts/d3-speed-deal.ts\`, do not edit): for
 * each level, the seeds on which a person exactly at the human limits (scripts/d3-speed-oracles.ts: 0.25 s to react,
 * 0.15 s to move, no slip) scores 200 through the server's grade. Of ${candidates} candidates kept: ${kept.join(", ")}.
 */
export const D3_SPEED_DEALS: Readonly<Record<"whack" | "tendrop", Readonly<Record<"easy" | "hard" | "expert", readonly number[]>>>> = {
${lines.join("\n")}
};

/** The seed a level deal plays: one of the level's proved seeds, drawn by the deal's own index. */
export function d3SpeedDealSeed(game: "whack" | "tendrop", level: "easy" | "hard" | "expert", draw: number): number | null {
  const list = D3_SPEED_DEALS[game][level];
  if (!list.length) return null;
  const n = list.length;
  return list[((Math.trunc(draw) % n) + n) % n]!;
}
`;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const candidates = Number(args.find((a) => a.startsWith("--candidates="))?.slice(13) ?? 160);
  const text = buildDeals(candidates);
  if (args.includes("--check")) {
    const now = readFileSync(D3_SPEED_DEALS_FILE, "utf8");
    if (now !== text) {
      console.log(`FAIL ${D3_SPEED_DEALS_FILE} does not rebuild byte for byte`);
      process.exit(1);
    }
    console.log(`${D3_SPEED_DEALS_FILE} rebuilds byte for byte`);
  } else {
    writeFileSync(D3_SPEED_DEALS_FILE, text);
    console.log(text.split("\n").slice(0, 5).join("\n"));
  }
}
