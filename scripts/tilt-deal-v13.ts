/**
 * Builds Tilt's tiltRev 13 Normal deal (D6, 22 Nov 2026, the scoring review's I8; docs/arcade-standard/tilt.md
 * "tiltRev 13"): src/lib/duel/tiltDealV13.server.ts (TILT_DEAL_V13) lists every candidate seed whose oracle run
 * (scripts/tilt-oracle.ts `oracleRun(seed, 13, undefined, { limitTicks: 9 })`: the three mazes each within its par, no
 * fall, and held to HUMAN_LIMITS: no new decision sooner than 0.15 s after the last) replays through the server's own
 * path (encodeTiltRun → replayTiltRun on tiltRev 13) to exactly 200 with every part full, unflagged. The candidates are
 * tiltRev 12's proved deal (TILT_DEAL_V12, in its order). Witnesses: scripts/fixtures/tilt-deal-v13-witness.json.gz.
 *
 *   bun scripts/tilt-deal-v13.ts            (the oracle on every candidate, 4 worker processes; writes the deal and witnesses)
 *   bun scripts/tilt-deal-v13.ts --check    (replays every stored witness through the server path, each exactly 200 with
 *                                            every part full and every held tilt at least 9 ticks; the deal file rebuilds
 *                                            byte for byte from the witnesses)
 */
import { appendFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { spawn } from "node:child_process";
import { tiltParParts, TILT_P_CLEAN_POINTS, TILT_P_CORE_MAX, TILT_P_PAR_MAX, TILT_P_SPEED_POINTS, TILT_REV_THREE, TILT_T_MAZES } from "../src/lib/arcade/tilt";
import { decodeTiltRun, replayTiltRun } from "../src/lib/duel/tilt";
import { TILT_DEAL_V12 } from "../src/lib/duel/tiltDealV12.server";

const OUT = new URL("../src/lib/duel/tiltDealV13.server.ts", import.meta.url);
export const TILT_DEAL_V13_WITNESS = new URL("./fixtures/tilt-deal-v13-witness.json.gz", import.meta.url);
const WORKERS = 4;
/** HUMAN_LIMITS' 0.15 s to move, in ticks: the oracle's shortest held tilt. */
export const TILT_LIMIT_TICKS = 9;

export type TiltWitness = { seed: number; raw: string };

/** The server's verdict on a witness: its score, flag, every part at its maximum on three mazes. */
export function tiltV13Verdict(w: TiltWitness): { score: number; flagged: boolean; full: boolean } {
  const r = replayTiltRun(w.seed, w.raw, TILT_REV_THREE);
  const p = tiltParParts(r.state);
  const full = p.core === TILT_P_CORE_MAX && p.par === TILT_P_PAR_MAX && p.clean === TILT_P_CLEAN_POINTS && p.speed === TILT_P_SPEED_POINTS && r.state.list.length === TILT_T_MAZES && r.state.three === 1;
  return { score: r.score, flagged: Boolean(r.flagged), full };
}

/**
 * The witness's pace: the drag events in runs (consecutive ticks are one gesture); a new gesture never starts sooner
 * than TILT_LIMIT_TICKS after the previous one started. Returns the shortest such gap (Infinity for one gesture).
 */
export function tiltShortestDecision(raw: string): number {
  const ev = decodeTiltRun(raw).events;
  let best = Infinity;
  let start = -1;
  let last = -2;
  for (const e of ev) {
    if (e.t !== last + 1) {
      if (start >= 0) best = Math.min(best, e.t - start);
      start = e.t;
    }
    last = e.t;
  }
  return best;
}

export function dealFileText(kept: readonly number[], tried: number): string {
  return `/**
 * Tilt's Normal deal on tiltRev 13 (built by \`bun scripts/tilt-deal-v13.ts\`, do not edit): ${kept.length} seeds of tiltRev 12's
 * proved deal (TILT_DEAL_V12, in its order), each proved on tiltRev 13: the oracle (scripts/tilt-oracle.ts, held to
 * HUMAN_LIMITS: no new decision sooner than 0.15 s after the last) plays the seed's three mazes, every one within its
 * par and with no fall, and its log replays through replayTiltRun to exactly 200 (witnesses in
 * scripts/fixtures/tilt-deal-v13-witness.json.gz). ${tried - kept.length} of the ${tried} candidates dropped.
 * Server-only.
 */
export const TILT_DEAL_V13: readonly number[] = [${kept.join(",")}];
`;
}

async function worker(k: number, n: number, file: string): Promise<void> {
  const { oracleRun } = await import("./tilt-oracle");
  for (let i = k; i < TILT_DEAL_V12.length; i += n) {
    const seed = TILT_DEAL_V12[i]!;
    const r = oracleRun(seed, TILT_REV_THREE, undefined, { limitTicks: TILT_LIMIT_TICKS });
    appendFileSync(file, JSON.stringify({ i, seed, score: r.score, raw: r.raw }) + "\n");
  }
}

async function runAll(): Promise<{ i: number; seed: number; score: number; raw: string }[]> {
  const files = Array.from({ length: WORKERS }, (_, k) => `/tmp/tilt-deal-v13-${process.pid}-${k}.jsonl`);
  for (const f of files) if (existsSync(f)) unlinkSync(f);
  await Promise.all(
    files.map(
      (f, k) =>
        new Promise<void>((done, fail) => {
          const p = spawn(process.execPath, [new URL(import.meta.url).pathname, `--worker=${k}/${WORKERS}`, `--file=${f}`], { stdio: ["ignore", "ignore", "inherit"] });
          p.on("exit", (code) => (code === 0 ? done() : fail(new Error(`worker ${k} exited ${code}`))));
        }),
    ),
  );
  const rows = files.flatMap((f) => readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as { i: number; seed: number; score: number; raw: string }));
  for (const f of files) unlinkSync(f);
  return rows.sort((a, b) => a.i - b.i);
}

const witnessBytes = (w: TiltWitness[]) => gzipSync(JSON.stringify({ rev: TILT_REV_THREE, candidates: TILT_DEAL_V12.length, limitTicks: TILT_LIMIT_TICKS, witnesses: w }), { level: 9 });

if (import.meta.main) {
  const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const w = opt("worker");
  if (w) {
    const [k, n] = w.split("/").map(Number) as [number, number];
    await worker(k, n, opt("file")!);
  } else if (process.argv.includes("--check")) {
    const failures: string[] = [];
    const stored = JSON.parse(gunzipSync(readFileSync(TILT_DEAL_V13_WITNESS)).toString()) as { rev: number; candidates: number; limitTicks: number; witnesses: TiltWitness[] };
    const { TILT_DEAL_V13 } = await import("../src/lib/duel/tiltDealV13.server");
    if (stored.rev !== TILT_REV_THREE || stored.candidates !== TILT_DEAL_V12.length || stored.limitTicks !== TILT_LIMIT_TICKS) failures.push("witnesses for another stamp, candidate list or limit");
    let order = -1;
    for (const wit of stored.witnesses) {
      const v = tiltV13Verdict(wit);
      if (v.score !== 200 || v.flagged || !v.full) failures.push(`seed ${wit.seed}: the witness replays to ${v.score}${v.flagged ? " (flagged)" : ""}${v.full ? "" : " (a part short)"}`);
      if (tiltShortestDecision(wit.raw) < TILT_LIMIT_TICKS) failures.push(`seed ${wit.seed}: a decision ${tiltShortestDecision(wit.raw)} ticks after the last`);
      const at = TILT_DEAL_V12.indexOf(wit.seed);
      if (at <= order) failures.push(`seed ${wit.seed}: not a candidate in the candidates' order`);
      order = at;
    }
    if (JSON.stringify(TILT_DEAL_V13) !== JSON.stringify(stored.witnesses.map((x) => x.seed))) failures.push("the deal is not exactly the witnessed seeds in order");
    if (dealFileText(stored.witnesses.map((x) => x.seed), stored.candidates) !== readFileSync(OUT, "utf8")) failures.push("the deal file rebuilt from the witnesses differs from the file on disk");
    if (failures.length) {
      for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
      console.log(`FAIL tilt-deal-v13 --check: ${failures.length} problems`);
      process.exit(1);
    }
    console.log(`PASS tilt-deal-v13 --check: ${stored.witnesses.length} witnesses replay to 200 with every part full, held to human limits; the deal file rebuilds byte for byte`);
  } else {
    const t0 = Date.now();
    const rows = await runAll();
    const kept = rows.filter((r) => {
      const v = tiltV13Verdict(r);
      return v.score === 200 && !v.flagged && v.full && tiltShortestDecision(r.raw) >= TILT_LIMIT_TICKS;
    }).map((r) => ({ seed: r.seed, raw: r.raw }));
    writeFileSync(OUT, dealFileText(kept.map((x) => x.seed), TILT_DEAL_V12.length));
    writeFileSync(TILT_DEAL_V13_WITNESS, witnessBytes(kept));
    const dropped = rows.filter((r) => !kept.some((k) => k.seed === r.seed));
    console.log(`kept ${kept.length} of ${rows.length}; dropped ${dropped.length}: ${dropped.map((d) => `${d.seed} (${d.score})`).join(", ") || "none"} in ${Math.round((Date.now() - t0) / 1000)} s`);
  }
}
