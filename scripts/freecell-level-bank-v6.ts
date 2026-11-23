/**
 * Builds Free Cell's D6 level banks (freecellRev 6, 23 Nov 2026; src/lib/arcade/cards/freecellDealsLevelsV6.data.ts):
 * [deal seed, par] for Hard and Expert (Easy keeps FC_DEALS_EASY), every deal solved by the bank solver
 * (src/lib/arcade/cards/freecellSolver.ts) on the level's own start (fcLevelInitFrom on rev 6: its cards and free cells),
 * par the fewest moves it found; the solution replayed through the sim to all home. The solutions go to
 * scripts/fixtures/freecell-solutions-levels-v6.json (checks only, never shipped). Deterministic: `--check` rebuilds and
 * compares without writing.
 *
 *   Hard    Normal's 40-card bank seeds (FC_DEALS_V4, in order) on 3 free cells: the first FC_V6_BANK_SIZE solved.
 *   Expert  the Normal-era 52-card bank seeds (FC_DEALS, in order, then FC_DEALS_V4's) dealt as 48 cards (Ace to Queen,
 *           the level's topRank) on 2 free cells: the first FC_V6_BANK_SIZE solved in FC_V6_EXPERT_PAR_MAX moves or fewer.
 *
 *   bun scripts/freecell-level-bank-v6.ts [--check] [--level=hard|expert] [--part=k/n]   (parts: seeds split by index;
 *   bun scripts/freecell-level-bank-v6.ts --merge=n                                      then merge the n part files)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fcAllHome, fcApply, fcLevelInitFrom, FC_REV_PAR98 } from "../src/lib/arcade/cards/freecell";
import { FC_DEALS } from "../src/lib/arcade/cards/freecellDeals.data";
import { FC_DEALS_V4 } from "../src/lib/arcade/cards/freecellDealsV4.data";
import { fcBestSolution, type FcMove } from "../src/lib/arcade/cards/freecellSolver";

export const FC_V6_BANK_SIZE = 120;
/** Expert keeps the shortest two-cell solutions (Joe, 23 Nov 2026: a gentler Expert, the average player 30–40). */
export const FC_V6_EXPERT_PAR_MAX = 38;
const DATA = "src/lib/arcade/cards/freecellDealsLevelsV6.data.ts";
export const FC_V6_SOLUTIONS = "scripts/fixtures/freecell-solutions-levels-v6.json";
const CHECK = process.argv.includes("--check");
const ONLY = process.argv.find((a) => a.startsWith("--level="))?.slice(8) as "hard" | "expert" | undefined;
const PART = process.argv.find((a) => a.startsWith("--part="))?.slice(7);
const MERGE = process.argv.find((a) => a.startsWith("--merge="))?.slice(8);
const LEVELS = ["hard", "expert"] as const;
type L = (typeof LEVELS)[number];

const LIMIT = 60_000;

function solve(level: L, dealSeed: number): FcMove[] | null {
  const start = fcLevelInitFrom(level, dealSeed, 0, 0, FC_REV_PAR98);
  const sol = fcBestSolution(start, LIMIT);
  if (!sol) return null;
  let s = start;
  for (const m of sol) s = fcApply(s, m[0], m[1], m[2]) ?? s;
  return fcAllHome(s) ? sol : null;
}

type Entry = { seed: number; sol: FcMove[] };
const seedsOf = (l: L) => (l === "hard" ? FC_DEALS_V4 : [...FC_DEALS, ...FC_DEALS_V4]).map(([seed]) => seed);
const keeps = (l: L, sol: FcMove[] | null) => Boolean(sol) && (l === "hard" || sol!.length <= FC_V6_EXPERT_PAR_MAX);

/** Every candidate's result in order (null: not kept), for the seeds this part owns. */
function results(l: L, k: number, n: number): (Entry | null)[] {
  return seedsOf(l).map((seed, i) => {
    if (i % n !== k - 1) return null;
    const sol = solve(l, seed);
    return keeps(l, sol) ? { seed, sol: sol! } : null;
  });
}

function bank(l: L, all: (Entry | null)[]): Entry[] {
  return all.filter((e): e is Entry => e !== null).slice(0, FC_V6_BANK_SIZE);
}

function render(banks: Record<L, Entry[]>): { data: string; sols: string } {
  const name = (l: string) => `FC_DEALS_${l.toUpperCase()}_V6`;
  const data = `/**
 * Free Cell's D6 level deal banks (freecellRev 6, 23 Nov 2026), written by scripts/freecell-level-bank-v6.ts (do not
 * edit by hand): [deal seed, par] for each deal, solved by the bank solver on the level's own start; par is the fewest
 * moves it found (auto moves home not counted). A level puzzle's seed is its index in its level's bank. Hard: Normal's
 * 40 cards (Ace to 10) on 3 free cells. Expert: 48 cards (Ace to Queen) on 2 free cells, solved in ${FC_V6_EXPERT_PAR_MAX} moves or fewer.
 */
${LEVELS.map((l) => `export const ${name(l)}: readonly (readonly [number, number])[] = [\n${banks[l].map((e) => `  [${e.seed}, ${e.sol.length}],`).join("\n")}\n];`).join("\n\n")}
`;
  const sols = JSON.stringify(Object.fromEntries(LEVELS.map((l) => [l, banks[l].map((e) => e.sol.map((m) => m.join(":")).join(","))])));
  return { data, sols };
}

const partFile = (k: number, n: number) => `scripts/fixtures/.freecell-v6-part-${k}-of-${n}.json`;

if (PART) {
  const [k, n] = PART.split("/").map(Number) as [number, number];
  const out = Object.fromEntries(LEVELS.filter((l) => !ONLY || l === ONLY).map((l) => [l, results(l, k, n)]));
  writeFileSync(partFile(k, n), JSON.stringify(out));
  console.log(`part ${k}/${n} written`);
} else {
  const n = MERGE ? Number(MERGE) : 1;
  const merged: Record<L, (Entry | null)[]> = { hard: [], expert: [] };
  if (MERGE) {
    for (let k = 1; k <= n; k++) {
      const part = JSON.parse(readFileSync(partFile(k, n), "utf8")) as Record<L, (Entry | null)[]>;
      for (const l of LEVELS) (part[l] ?? []).forEach((e, i) => { if (e) merged[l][i] = e; });
    }
    for (const l of LEVELS) merged[l] = seedsOf(l).map((_, i) => merged[l][i] ?? null);
  } else {
    for (const l of LEVELS) merged[l] = results(l, 1, 1);
  }
  const banks = { hard: bank("hard", merged.hard), expert: bank("expert", merged.expert) };
  for (const l of LEVELS) {
    const pars = banks[l].map((e) => e.sol.length).sort((a, b) => a - b);
    console.log(`${l}: ${banks[l].length} deals, par ${pars[0]}–${pars[pars.length - 1]}, median ${pars[pars.length >> 1]}`);
  }
  const { data, sols } = render(banks);
  if (CHECK) {
    const same = existsSync(DATA) && readFileSync(DATA, "utf8") === data && readFileSync(FC_V6_SOLUTIONS, "utf8") === sols;
    console.log(same ? "PASS freecell D6 level banks rebuild byte for byte" : "FAIL freecell D6 level banks differ from a rebuild");
    process.exit(same ? 0 : 1);
  }
  writeFileSync(DATA, data);
  writeFileSync(FC_V6_SOLUTIONS, sols);
  console.log("wrote", DATA, FC_V6_SOLUTIONS);
}
