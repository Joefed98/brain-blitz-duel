/**
 * Builds Tilt's D6 level deals on tiltRev 13 (23 Nov 2026; TILT_LEVELS_V13 in src/lib/arcade/tilt.ts):
 * src/lib/duel/tiltDealLevelsV13.server.ts lists, for each of easy, hard and expert, the candidate seeds (a fixed
 * sequence, tiltLevelCandidateV13) that the level deals fully (tiltLevelDealableV13: every hole, key and amber marble
 * dealt, every key and cup reachable, the pars inside the run) and, once proved, whose oracle run held to HUMAN_LIMITS
 * (scripts/tilt-oracle.ts `oracleRun(seed, 13, level, { limitTicks: 9 })`) replays through the server's own path to
 * exactly 200 with every part full.
 *
 *   bun scripts/tilt-level-deal-v13.ts --dealable   (the dealable candidates only, unproved: for measuring)
 *   bun scripts/tilt-level-deal-v13.ts              (the oracle on every dealable candidate; keeps the proved ones)
 *   bun scripts/tilt-level-deal-v13.ts --check      (re-proves every listed seed's witness; the file rebuilds byte for byte)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { tiltLevelDealableV13, tiltPartsOver, tiltLevelSpeedFull, TILT_LEVEL_NAMES, TILT_P_CLEAN_POINTS, TILT_P_CORE_MAX, TILT_P_PAR_MAX, TILT_P_SPEED_POINTS, TILT_REV_THREE, type TiltLevel } from "../src/lib/arcade/tilt";
import { replayTiltRun } from "../src/lib/duel/tilt";

const OUT = new URL("../src/lib/duel/tiltDealLevelsV13.server.ts", import.meta.url);
export const TILT_V13_LEVEL_WITNESS = new URL("./fixtures/tilt-level-deal-v13-witness.json.gz", import.meta.url);
/** Dealable candidates tried per level, and the most kept. */
export const TILT_V13_CANDIDATES = 160;
export const TILT_V13_KEEP = 120;
/** HUMAN_LIMITS' 0.15 s to move, in ticks: the oracle's shortest held tilt. */
const LIMIT_TICKS = 9;

/** The k-th seed of D6's candidate sequence (k from 1; a fixed hash, never 0; not the levels before's sequence). */
export function tiltLevelCandidateV13(k: number): number {
  return (Math.imul(k + 0x0d6, 2246822519) >>> 1) || 1;
}

/** A level's dealable candidates, in sequence order. */
export function tiltLevelCandidatesV13(level: TiltLevel): number[] {
  const out: number[] = [];
  for (let k = 1; out.length < TILT_V13_CANDIDATES && k < 100_000; k++) {
    const seed = tiltLevelCandidateV13(k);
    if (tiltLevelDealableV13(seed, level)) out.push(seed);
  }
  return out;
}

/** The server's verdict on a level witness: its score, flag, every part at its maximum. */
export function tiltV13LevelVerdict(level: TiltLevel, seed: number, raw: string): { score: number; full: boolean; flagged: boolean } {
  const r = replayTiltRun(seed, raw, TILT_REV_THREE, level);
  const p = tiltPartsOver(r.state, tiltLevelSpeedFull(level, true));
  const full = p.core === TILT_P_CORE_MAX && p.par === TILT_P_PAR_MAX && p.clean === TILT_P_CLEAN_POINTS && p.speed === TILT_P_SPEED_POINTS && r.state.lv13 === 1;
  return { score: r.score, full, flagged: Boolean(r.flagged) };
}

function render(lists: Record<TiltLevel, number[]>, proved: boolean): string {
  return `/**
 * Tilt's D6 level deals on tiltRev 13 (23 Nov 2026; TILT_LEVELS_V13), built by \`bun scripts/tilt-level-deal-v13.ts\`
 * (do not edit by hand): ${proved ? "each seed's oracle run held to HUMAN_LIMITS replays through the server to exactly 200 with every part full (witnesses in scripts/fixtures/tilt-level-deal-v13-witness.json.gz)" : "UNPROVED: the dealable candidates only, for measuring; the oracle's proof replaces this list"}. Server-only.
 */
export const TILT_DEAL_LEVELS_V13: Readonly<Record<"easy" | "hard" | "expert", readonly number[]>> = {
${TILT_LEVEL_NAMES.map((l) => `  ${l}: [${lists[l].join(", ")}],`).join("\n")}
};
`;
}

if (import.meta.main) {
  console.error = () => {};
  const args = process.argv.slice(2);
  if (args.includes("--dealable")) {
    const lists = Object.fromEntries(TILT_LEVEL_NAMES.map((l) => [l, tiltLevelCandidatesV13(l).slice(0, TILT_V13_KEEP)])) as Record<TiltLevel, number[]>;
    writeFileSync(OUT, render(lists, false));
    console.log(`wrote ${OUT.pathname} (unproved): ${TILT_LEVEL_NAMES.map((l) => `${l} ${lists[l].length}`).join(", ")}`);
    process.exit(0);
  }
  const check = args.includes("--check");
  const only = args.find((a) => a.startsWith("--level="))?.slice(8) as TiltLevel | undefined;
  const witness: Record<string, { seed: number; raw: string }[]> = existsSync(TILT_V13_LEVEL_WITNESS) ? JSON.parse(gunzipSync(readFileSync(TILT_V13_LEVEL_WITNESS)).toString()) : {};
  if (check) {
    let bad = 0;
    for (const l of TILT_LEVEL_NAMES) for (const w of witness[l] ?? []) {
      const v = tiltV13LevelVerdict(l, w.seed, w.raw);
      if (v.score !== 200 || !v.full || v.flagged) bad++;
    }
    const lists = Object.fromEntries(TILT_LEVEL_NAMES.map((l) => [l, (witness[l] ?? []).map((w) => w.seed)])) as Record<TiltLevel, number[]>;
    const same = existsSync(OUT) && readFileSync(OUT, "utf8") === render(lists, true);
    console.log(bad === 0 && same ? `PASS tilt D6 level deals: ${TILT_LEVEL_NAMES.map((l) => `${l} ${lists[l].length}`).join(", ")} witnesses at 200, the file rebuilds byte for byte` : `FAIL tilt D6 level deals: ${bad} witnesses off 200${same ? "" : "; the file differs from a rebuild"}`);
    process.exit(bad === 0 && same ? 0 : 1);
  }
  const { oracleRun } = await import("./tilt-oracle");
  for (const l of TILT_LEVEL_NAMES) {
    if (only && l !== only) continue;
    const kept: { seed: number; raw: string }[] = [];
    const dropped: string[] = [];
    const t0 = Date.now();
    for (const seed of tiltLevelCandidatesV13(l)) {
      if (kept.length >= TILT_V13_KEEP) break;
      const r = oracleRun(seed, TILT_REV_THREE, l, { limitTicks: LIMIT_TICKS });
      const v = tiltV13LevelVerdict(l, seed, r.raw);
      if (v.score === 200 && v.full && !v.flagged) kept.push({ seed, raw: r.raw });
      else dropped.push(`${seed} (${v.score})`);
    }
    witness[l] = kept;
    console.log(`${l}: kept ${kept.length}, dropped ${dropped.length} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  writeFileSync(TILT_V13_LEVEL_WITNESS, gzipSync(JSON.stringify(witness)));
  const lists = Object.fromEntries(TILT_LEVEL_NAMES.map((l) => [l, (witness[l] ?? []).map((w) => w.seed)])) as Record<TiltLevel, number[]>;
  writeFileSync(OUT, render(lists, true));
  console.log(`wrote ${OUT.pathname}`);
}
