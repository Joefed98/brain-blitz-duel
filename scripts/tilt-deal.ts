/**
 * Builds Tilt's tiltRev 12 deal, as Apex's and Grappler's (scripts/racing-deal.ts, scripts/swing-slide-deal.ts):
 * src/lib/duel/tiltDealV12.server.ts (TILT_DEAL_V12) lists every candidate seed whose oracle run (scripts/tilt-oracle.ts,
 * `oracleRun(seed, 12)`: every maze within its par, no fall) replays through the server's own path (encodeTiltRun →
 * replayTiltRun on tiltRev 12) to exactly 200, unflagged. The candidates are tiltRev 8's bank (TILT_BANK, in its order:
 * every key and cup reachable and every maze fully dealt), so rooms deal only seeds proved on this stamp. A candidate the
 * oracle does not take to 200 is dropped and counted. Each kept seed's log is its witness
 * (scripts/fixtures/tilt-deal-v12-witness.json.gz).
 *
 *   bun scripts/tilt-deal.ts                 (runs the oracle on every candidate, 4 worker processes, ~15 min; writes the
 *                                             deal and the witnesses)
 *   bun scripts/tilt-deal.ts --check         (replays every stored witness through the server path, each exactly 200
 *                                             with every part full, and rebuilds the deal file from the witnesses: byte
 *                                             for byte the file on disk; ~1 min)
 *   bun scripts/tilt-deal.ts --check --full  (also re-runs the oracle on every candidate and rebuilds the deal file and
 *                                             the witnesses from scratch: byte for byte; ~15 min)
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync, appendFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { spawn } from "node:child_process";
import { tiltParParts, TILT_P_CLEAN_POINTS, TILT_P_CORE_MAX, TILT_P_PAR_MAX, TILT_P_SPEED_POINTS, TILT_REV_BIG } from "../src/lib/arcade/tilt";
import { replayTiltRun } from "../src/lib/duel/tilt";
import { TILT_BANK } from "../src/lib/duel/tiltBank.server";

const OUT = new URL("../src/lib/duel/tiltDealV12.server.ts", import.meta.url);
export const TILT_DEAL_WITNESS = new URL("./fixtures/tilt-deal-v12-witness.json.gz", import.meta.url);
const WORKERS = 4;

export type TiltWitness = { seed: number; raw: string };

/** The server's verdict on a stored witness: its score, whether flagged, and whether every part is at its maximum. */
export function tiltDealVerdict(w: TiltWitness): { score: number; flagged: boolean; full: boolean } {
  const r = replayTiltRun(w.seed, w.raw, TILT_REV_BIG);
  const p = tiltParParts(r.state);
  const full = p.core === TILT_P_CORE_MAX && p.par === TILT_P_PAR_MAX && p.clean === TILT_P_CLEAN_POINTS && p.speed === TILT_P_SPEED_POINTS;
  return { score: r.score, flagged: Boolean(r.flagged), full };
}

/** The deal file's text for a list of kept seeds out of the candidates tried (the same bytes every build). */
export function dealFileText(kept: readonly number[], tried: number): string {
  return `/**
 * Tilt's deal (tiltRev 12; built by \`bun scripts/tilt-deal.ts\`, do not edit): ${kept.length} seeds of tiltRev 8's bank
 * (TILT_BANK, in its order), each proved on tiltRev 12: the oracle (scripts/tilt-oracle.ts) plays the seed's four mazes,
 * every one within its par and with no fall, and its log replays through replayTiltRun to exactly 200 (witnesses in
 * scripts/fixtures/tilt-deal-v12-witness.json.gz). ${tried - kept.length} of the ${tried} candidates dropped (${kept.length} kept).
 * Server-only.
 */
export const TILT_DEAL_V12: readonly number[] = [${kept.join(",")}];
`;
}

/** Runs the oracle on candidates k, k + n, k + 2n … and appends each verdict to `file` (one JSON line each). */
async function worker(k: number, n: number, file: string): Promise<void> {
  const { oracleRun } = await import("./tilt-oracle");
  for (let i = k; i < TILT_BANK.length; i += n) {
    const seed = TILT_BANK[i]!;
    const r = oracleRun(seed, TILT_REV_BIG);
    appendFileSync(file, JSON.stringify({ i, seed, score: r.score, raw: r.raw }) + "\n");
  }
}

/** Every candidate's oracle run, in candidate order (worker processes). */
async function runAll(): Promise<{ i: number; seed: number; score: number; raw: string }[]> {
  const files = Array.from({ length: WORKERS }, (_, k) => `/tmp/tilt-deal-${process.pid}-${k}.jsonl`);
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

/** The deal and witnesses from the candidates' runs: a seed is kept only when its log replays to exactly 200 with every part full. */
function keep(rows: { seed: number; raw: string }[]): TiltWitness[] {
  return rows.filter((r) => {
    const v = tiltDealVerdict(r);
    return v.score === 200 && !v.flagged && v.full;
  }).map((r) => ({ seed: r.seed, raw: r.raw }));
}

const witnessBytes = (w: TiltWitness[]) => gzipSync(JSON.stringify({ rev: TILT_REV_BIG, candidates: TILT_BANK.length, witnesses: w }), { level: 9 });

if (import.meta.main) {
  const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const w = opt("worker");
  if (w) {
    const [k, n] = w.split("/").map(Number) as [number, number];
    await worker(k, n, opt("file")!);
  } else if (process.argv.includes("--check")) {
    const failures: string[] = [];
    const stored = JSON.parse(gunzipSync(readFileSync(TILT_DEAL_WITNESS)).toString()) as { rev: number; candidates: number; witnesses: TiltWitness[] };
    const onDisk = readFileSync(OUT, "utf8");
    const { TILT_DEAL_V12 } = await import("../src/lib/duel/tiltDealV12.server");
    if (stored.rev !== TILT_REV_BIG || stored.candidates !== TILT_BANK.length) failures.push(`witnesses for tiltRev ${stored.rev} over ${stored.candidates} candidates`);
    let order = -1;
    for (const wit of stored.witnesses) {
      const v = tiltDealVerdict(wit);
      if (v.score !== 200 || v.flagged || !v.full) failures.push(`seed ${wit.seed}: the witness replays to ${v.score}${v.flagged ? " (flagged)" : ""}${v.full ? "" : " (a part short)"}`);
      const at = TILT_BANK.indexOf(wit.seed);
      if (at <= order) failures.push(`seed ${wit.seed}: not a bank seed in the bank's order`);
      order = at;
    }
    if (JSON.stringify(TILT_DEAL_V12) !== JSON.stringify(stored.witnesses.map((x) => x.seed))) failures.push("the deal is not exactly the witnessed seeds in order");
    if (dealFileText(stored.witnesses.map((x) => x.seed), stored.candidates) !== onDisk) failures.push("the deal file rebuilt from the witnesses differs from the file on disk");
    if (process.argv.includes("--full")) {
      const rebuilt = keep(await runAll());
      if (dealFileText(rebuilt.map((x) => x.seed), TILT_BANK.length) !== onDisk) failures.push("the deal file rebuilt from the oracle differs from the file on disk");
      if (Buffer.compare(witnessBytes(rebuilt), readFileSync(TILT_DEAL_WITNESS)) !== 0) failures.push("the witnesses rebuilt from the oracle differ from the stored ones");
    }
    if (failures.length) {
      for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
      console.log(`FAIL tilt-deal --check: ${failures.length} problems`);
      process.exit(1);
    }
    console.log(`PASS tilt-deal --check: ${stored.witnesses.length} witnesses replay to 200 with every part full; the deal file rebuilds byte for byte${process.argv.includes("--full") ? " (and from the oracle)" : ""}`);
  } else {
    const t0 = Date.now();
    const rows = await runAll();
    const kept = keep(rows);
    writeFileSync(OUT, dealFileText(kept.map((x) => x.seed), TILT_BANK.length));
    writeFileSync(TILT_DEAL_WITNESS, witnessBytes(kept));
    const dropped = rows.filter((r) => !kept.some((k) => k.seed === r.seed));
    console.log(`kept ${kept.length} of ${rows.length}; dropped ${dropped.map((d) => `${d.seed} (${d.score})`).join(", ") || "none"} in ${Math.round((Date.now() - t0) / 1000)} s`);
  }
}
