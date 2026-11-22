/**
 * Builds Bomb Defusal's level banks (the Attention overhaul, stage 3; D3, 22 Nov 2026): writes
 * src/lib/duel/bombLevelsBank.server.ts (one array per level). Every entry is `generateBombAt` under a fixed seed, so a
 * rebuild is byte for byte the same:
 *
 *  - Easy: entry i is generateBombAt(BOMB_LEVELS.easy) under seed BOMB_LEVEL_BASE.easy + i.
 *  - Hard and Expert (D3, Joe's option (a), 22 Nov 2026: 6-step cards): candidate i is generateBombAt(BOMB_LEVELS[level])
 *    under seed BOMB_LEVEL_BASE[level] + i (a seed that builds no card is passed by), kept when it fits the level
 *    (bombFits: the "Step N" clue filters, a person-like solver working it out within the level's orders, and the D3
 *    limits proof, scripts/d3-attention-proof.ts, defusing it at 200 on the level's clock and full-by), up to the
 *    level's bank size. The file lists the kept seeds (BOMB_HARD_SEEDS, BOMB_EXPERT_SEEDS).
 *
 *   bun scripts/bomb-levels-bank.ts                                  (builds every level and writes the bank)
 *   bun scripts/bomb-levels-bank.ts --level=hard --out=/tmp/x/hard.json   (one level's kept cards, for parallel builds)
 *   bun scripts/bomb-levels-bank.ts --merge=/tmp/x                   (writes the bank from hard.json / expert.json there)
 *   bun scripts/bomb-levels-bank.ts --check [--sample=4]             (rebuilds a few entries of each level and compares)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BOMB_LEVELS } from "../src/lib/levels/attentionLevels.data";
import { generateBombAt } from "../src/lib/duel/bombLevels.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { personBombTries } from "./attention-levels-lib";
import { proveAt200 } from "./d3-attention-proof";
import { dealAt } from "./level-tune";
import type { BombPuzzleData } from "../src/lib/duel/types";

export const BOMB_LEVEL_BASE = { easy: 230_000, hard: 240_000, expert: 250_000 } as const;
/** Candidates tried before a level's bank is given up on. */
const MAX_CANDIDATES = 4000;
const OUT = "src/lib/duel/bombLevelsBank.server.ts";
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);

export function buildEasy(i: number): BombPuzzleData {
  return withSeededRandom(BOMB_LEVEL_BASE.easy + i, () => generateBombAt(BOMB_LEVELS.easy));
}

/** Hard's or Expert's candidate i, or null when its seed builds no card. */
export function buildCandidate(level: "hard" | "expert", i: number): BombPuzzleData | null {
  try {
    return withSeededRandom(BOMB_LEVEL_BASE[level] + i, () => generateBombAt(BOMB_LEVELS[level]));
  } catch {
    return null;
  }
}

/** "Step N" clues on a card (each gives one step away). */
export const bombStepClues = (p: BombPuzzleData) => p.rules.filter((r) => r.id.startsWith("step:")).length;

/** A card as the level deals it: the level's deal with the card's panel in it (attentionLevels.server.ts dealBombLevel). */
export function bombLevelPuzzle(level: "hard" | "expert", card: BombPuzzleData): BombPuzzleData {
  const { bombInstant: _instant, ...deal } = dealAt("bomb", level, 0) as BombPuzzleData;
  return { ...deal, ...card, timeLimitMs: BOMB_LEVELS[level].timeLimitMs, ...(BOMB_LEVELS[level].instant ? { bombInstant: 1 as const } : {}) };
}

/** Whether a candidate belongs to a level's bank (D3's filters and the limits proof at 200). */
export function bombFits(level: "hard" | "expert", p: BombPuzzleData): boolean {
  const row = BOMB_LEVELS[level];
  const steps = bombStepClues(p);
  if ("stepCluesMin" in row && steps < (row as { stepCluesMin: number }).stepCluesMin) return false;
  if ("stepCluesMax" in row && steps > (row as { stepCluesMax: number }).stepCluesMax) return false;
  if (personBombTries(p, row.ordersMax) > row.ordersMax) return false;
  return proveAt200(bombLevelPuzzle(level, p)).score >= 200;
}

/** A level's kept cards and their seed offsets, in order, up to its bank's size. */
export function buildLevel(level: "hard" | "expert"): { seeds: number[]; cards: BombPuzzleData[] } {
  const seeds: number[] = [];
  const cards: BombPuzzleData[] = [];
  for (let i = 0; i < MAX_CANDIDATES && cards.length < BOMB_LEVELS[level].bank; i++) {
    const p = buildCandidate(level, i);
    if (p && bombFits(level, p)) (seeds.push(i), cards.push(p));
    if (i % 20 === 19) console.log(`${level}: ${cards.length} of ${BOMB_LEVELS[level].bank} kept from ${i + 1} candidates`);
  }
  if (cards.length !== BOMB_LEVELS[level].bank) throw new Error(`${level}: ${cards.length} cards from ${MAX_CANDIDATES} candidates (want ${BOMB_LEVELS[level].bank})`);
  return { seeds, cards };
}

function write(easy: BombPuzzleData[], hard: { seeds: number[]; cards: BombPuzzleData[] }, expert: { seeds: number[]; cards: BombPuzzleData[] }): void {
  const line = (p: BombPuzzleData) => `  ${JSON.stringify(p)},`;
  const arr = (name: string, list: BombPuzzleData[]) => `export const ${name}: BombPuzzleData[] = [\n${list.map(line).join("\n")}\n];\n`;
  const body = [
    arr("BOMB_EASY_BANK", easy),
    `/** Hard's and Expert's kept candidates (scripts/bomb-levels-bank.ts buildCandidate). */\nexport const BOMB_HARD_SEEDS: readonly number[] = ${JSON.stringify(hard.seeds)};\nexport const BOMB_EXPERT_SEEDS: readonly number[] = ${JSON.stringify(expert.seeds)};\n`,
    arr("BOMB_HARD_BANK", hard.cards),
    arr("BOMB_EXPERT_BANK", expert.cards),
  ].join("\n");
  writeFileSync(
    OUT,
    `/* Generated by scripts/bomb-levels-bank.ts — do not edit by hand. Easy entry i is generateBombAt(BOMB_LEVELS.easy) under seed BOMB_LEVEL_BASE.easy + i; Hard and Expert keep the candidates generateBombAt(BOMB_LEVELS[level]) under seed BOMB_LEVEL_BASE[level] + i that fit the level. */\nimport type { BombPuzzleData } from "./types";\n\n${body}`,
  );
}

if (process.argv.includes("--check")) {
  const sample = Number(arg("sample") ?? 4);
  const mod = await import("../src/lib/duel/bombLevelsBank.server");
  let bad = 0;
  if (mod.BOMB_EASY_BANK.length !== BOMB_LEVELS.easy.bank) (bad++, console.log(`FAIL easy: ${mod.BOMB_EASY_BANK.length} entries`));
  for (let k = 0; k < sample; k++) {
    const i = Math.floor((k * mod.BOMB_EASY_BANK.length) / sample);
    if (JSON.stringify(buildEasy(i)) !== JSON.stringify(mod.BOMB_EASY_BANK[i])) (bad++, console.log(`FAIL easy[${i}] does not rebuild`));
  }
  for (const [level, bank, seeds] of [["hard", mod.BOMB_HARD_BANK, mod.BOMB_HARD_SEEDS], ["expert", mod.BOMB_EXPERT_BANK, mod.BOMB_EXPERT_SEEDS]] as const) {
    if (bank.length !== BOMB_LEVELS[level].bank || seeds.length !== bank.length) (bad++, console.log(`FAIL ${level}: ${bank.length} entries, ${seeds.length} seeds`));
    for (let k = 0; k < sample; k++) {
      const i = Math.floor((k * bank.length) / sample);
      const rebuilt = buildCandidate(level, seeds[i]!);
      if (!rebuilt || JSON.stringify(rebuilt) !== JSON.stringify(bank[i]) || !bombFits(level, rebuilt)) (bad++, console.log(`FAIL ${level}[${i}] (seed ${seeds[i]}) does not rebuild or fit`));
    }
  }
  console.log(bad ? `FAIL bomb-levels-bank: ${bad}` : "PASS bomb-levels-bank: sampled entries rebuild byte for byte");
  process.exit(bad ? 1 : 0);
}

if (import.meta.main) {
  const only = arg("level") as "hard" | "expert" | undefined;
  const out = arg("out");
  const merge = arg("merge");
  if (only && out) {
    writeFileSync(out, JSON.stringify(buildLevel(only)));
    console.log(`wrote ${out}`);
  } else {
    const from = (level: "hard" | "expert") => {
      const file = merge ? join(merge, `${level}.json`) : null;
      return file && existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as { seeds: number[]; cards: BombPuzzleData[] }) : buildLevel(level);
    };
    const easy = Array.from({ length: BOMB_LEVELS.easy.bank }, (_, i) => buildEasy(i));
    write(easy, from("hard"), from("expert"));
    console.log(`wrote ${OUT}`);
  }
}
