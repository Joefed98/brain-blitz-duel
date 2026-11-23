/**
 * The shared half of D5's ladder checks for Meteor and Rally (scripts/snake-ladder-check.ts, scripts/rally-ladder-check.ts):
 * the legacy fixture, the stamp and its pin, Normal = no level, the level tables mirrored by the registry, the proved
 * deals and their witnesses, the recorded ladder and its live sample. A script library, not a check.
 */
import { readFileSync } from "node:fs";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { setDealPin, type DealPin } from "../src/lib/duel/dealEra";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import type { Level } from "../src/lib/levels/levels";
import { GAME_LEVELS, gameLevelSettings } from "../src/lib/levels/gameLevels";
import { ladderFixtureVerdicts, replaySample } from "./d5-ladder-lib";
import { replayLegacy } from "./ladder-legacy-lib";
import { checkWitnesses, DEAL_LEVELS, keptOf, levelPuzzle, type LevelDealPlan } from "./ladder-deal-lib";
import { dealAt } from "./level-tune";

export const FULL = process.env.CHECKS_FULL === "1" || process.argv.includes("--full");

let passes = 0;
const failures: string[] = [];
export function ok(cond: unknown, label: string): void {
  if (cond) passes++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}
export function section(s: string): void {
  console.log(`\n${s}`);
}
export function finish(started: number): never {
  console.log(`\n${failures.length ? "FAIL" : "PASS"}: ${passes} passed, ${failures.length} failed (${((performance.now() - started) / 1000).toFixed(1)} s)`);
  process.exit(failures.length ? 1 : 0);
}

/** A deal with no level asked, or at a level, under a seeded Math.random (the room's own stream). */
export function deal(type: PuzzleType, seed: number, level: Level | null): PuzzleData {
  return withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed, ...(level ? { level } : {}) }));
}

/** 1. The legacy fixture: every run on the older stamps grades and checkpoints exactly as recorded. */
export function legacySection(file: string): void {
  section(`1. Older rounds replay exactly as recorded (${file})`);
  for (const [cond, label] of replayLegacy(file)) ok(cond, label);
}

/** 2. The stamp, the pin and Normal = no level. */
export function stampSection(type: PuzzleType, field: string, rev: number, prevRev: number, pin: DealPin): void {
  section("2. The stamp, its era pin and Normal = no level");
  for (const seed of [7, 99, 4242, 123456]) {
    const p = deal(type, seed, null) as unknown as Record<string, unknown>;
    ok(p[field] === rev, `${type} ${seed}: Normal deals ${field} ${rev} (${p[field]})`);
    ok(JSON.stringify(deal(type, seed, null)) === JSON.stringify(deal(type, seed, "normal")), `${type} ${seed}: a Normal deal is the deal with no level asked`);
    for (const level of ["easy", "hard", "expert"] as const) {
      const q = deal(type, seed, level) as unknown as Record<string, unknown>;
      ok(q[field] === rev && q["level"] === level, `${type} ${seed} ${level}: dealt on ${field} ${rev} with its level (${q[field]}, ${q["level"]})`);
    }
    const was = setDealPin(pin, true);
    try {
      const pinned = deal(type, seed, null) as unknown as Record<string, unknown>;
      ok(pinned[field] === prevRev, `${type} ${seed}: with ${pin} on, Normal deals ${field} ${prevRev} (${pinned[field]})`);
      const lv = deal(type, seed, "hard") as unknown as Record<string, unknown>;
      ok(lv[field] === prevRev && lv["level"] === "hard", `${type} ${seed}: with ${pin} on, Hard deals ${field} ${prevRev} as before`);
    } finally {
      setDealPin(pin, was);
    }
  }
}

/** 3. The registry lists the dealt table (src/lib/levels/gameLevels.ts mirrors retroLevels.ts's table for the stamp). */
export function registrySection(type: PuzzleType, table: Readonly<Record<"easy" | "hard" | "expert", object>>): void {
  section("3. The level registry mirrors the dealt table");
  const entry = GAME_LEVELS[type];
  ok(Boolean(entry?.levels.easy && entry.levels.hard && entry.levels.expert), `${type}: the registry offers Easy, Hard and Expert`);
  for (const level of ["easy", "hard", "expert"] as const) {
    ok(JSON.stringify(gameLevelSettings(type, level)) === JSON.stringify(table[level]), `${type} ${level}: the registry's settings are the sim's table (${JSON.stringify(gameLevelSettings(type, level))})`);
  }
}

/** 4. The proved deals: the deal file rebuilds from its witnesses, the witnesses score 200, the deal deals from it. */
export function dealSection(plan: LevelDealPlan, extra?: (w: { level: Level; seed: number; events: unknown[] }) => [boolean, string] | null): void {
  section(`4. The proved deals (${plan.dealFile}; witnesses ${plan.witnessFile})`);
  const every = FULL ? 1 : 10;
  const { checked, bad, data } = checkWitnesses(plan, every);
  ok(bad.length === 0 && checked > 0, `${checked} stored witnesses (every ${every === 1 ? "one" : `${every}th`}) replay to exactly 200 through the server, unflagged${bad.length ? `: ${bad.slice(0, 5).join("; ")}` : ""}`);
  ok(readFileSync(plan.dealFile, "utf8") === plan.source(keptOf(data), data.tried), `${plan.dealFile} rebuilds byte for byte from the witnesses`);
  const kept = keptOf(data);
  for (const level of DEAL_LEVELS) {
    const seeds = kept[level] ?? [];
    ok(seeds.length >= 60 && new Set(seeds).size === seeds.length, `${plan.type} ${level}: ${seeds.length} proved seeds, all different (tried ${data.tried[level]})`);
  }
  if (extra) {
    const out = data.witnesses.map((w) => extra(w)).filter((x): x is [boolean, string] => !!x);
    const failed = out.filter(([c]) => !c);
    ok(failed.length === 0, `every witness keeps the human limits (${out.length} checked)${failed.length ? `: ${failed.slice(0, 3).map(([, l]) => l).join("; ")}` : ""}`);
  }
  // Real deals: each level deals only from its own list, and the puzzle is the one the witnesses prove.
  let dealtOk = 0;
  let total = 0;
  for (const level of DEAL_LEVELS) {
    for (let n = 0; n < 24; n++) {
      const p = dealAt(plan.type, level, n);
      const seed = Number((p as unknown as { seed: number }).seed);
      total++;
      if ((kept[level] ?? []).includes(seed) && JSON.stringify(p) === JSON.stringify(levelPuzzle(plan, seed, level))) dealtOk++;
    }
  }
  ok(dealtOk === total, `${dealtOk} of ${total} real deals (24 a level) come from the level's proved list, as the witnesses' puzzle`);
}

/**
 * The skill-band bot on the older stamps is the bot those rounds were recorded with: each legacy bot run, played again
 * now (the same deal, level and player, d5-ladder-lib's playDealt), sends exactly the stored answer.
 */
export async function legacyBotSection(file: string): Promise<void> {
  const { readLegacy } = await import("./ladder-legacy-lib");
  const { playDealt } = await import("./d5-ladder-lib");
  const f = readLegacy(file);
  const bots = f.runs.filter((r) => r.kind !== "random");
  const every = FULL ? 1 : 3;
  let same = 0;
  let checked = 0;
  for (let i = 0; i < bots.length; i += every) {
    const r = bots[i]!;
    checked++;
    const got = await playDealt(f.game as PuzzleType, r.puzzle, r.kind as never);
    if (got.raw === r.raw) same++;
    else ok(false, `${f.game} ${r.level} ${r.kind} n=${r.n}: the bot's log on the older stamp changed`);
  }
  ok(same === checked && checked > 0, `${f.game}: the skill-band bot sends exactly the recorded log on ${same} of ${checked} older-stamp runs (every ${every === 1 ? "one" : `${every}rd`})`);
}

/** The lever picture: drawn for every level, from the level's own settings, its colours only through design tokens. */
export async function pictureSection(type: string, Picture: (p: { level: Level; size: "l" | "s" }) => unknown, words: (level: Level) => string): Promise<void> {
  section("7. The lever picture");
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const seen = new Set<string>();
  for (const level of DEAL_LEVELS) {
    for (const size of ["l", "s"] as const) {
      const html = renderToStaticMarkup(React.createElement(Picture as never, { level, size }));
      seen.add(html);
      ok(html.startsWith("<svg") && html.includes(`data-${type}-picture="${level}"`), `${type} ${level} ${size}: the picture draws an svg for its level`);
      ok(!/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/.test(html) && html.includes("var(--jz-"), `${type} ${level} ${size}: colours only through design tokens`);
    }
    const w = words(level);
    ok(w.length > 0 && w.length <= 48, `${type} ${level}: the lever in a few words ("${w}")`);
  }
  ok(seen.size === DEAL_LEVELS.length * 2, `${type}: every level and size draws its own picture (${seen.size} different)`);
}

/** 5. The recorded ladder (96 deals a level): Joe's ladder test, and a live re-play sample. */
export async function ladderSection(type: PuzzleType): Promise<void> {
  section(`5. The recorded ladder (scripts/fixtures/d5-ladder-${type}.json.gz): Joe's ladder test, and a live sample`);
  for (const [cond, label] of await ladderFixtureVerdicts(type)) ok(cond, label);
  for (const [cond, label] of await replaySample(type, 2)) ok(cond, label);
}
