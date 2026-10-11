/**
 * Shared builder for the precomputed puzzle banks (see
 * src/lib/duel/puzzleBank.server.ts). Each `scripts/<game>-bank.ts` calls
 * `runBankScript(type)`.
 *
 *   bun scripts/flow-bank.ts               rebuild and write the bank file
 *   bun scripts/flow-bank.ts --check       rebuild in memory; fail unless it matches the file byte for byte
 *   bun scripts/flow-bank.ts --count=50    a smaller bank (with --out=<path>, or --check to compare a prefix)
 *   bun scripts/flow-bank.ts --jobs=4      worker processes (default: CPU count)
 *
 * Determinism: entry i is the live generator run under the fixed seed
 * `bankEntrySeed(type, i, retry)` for the smallest retry whose board passes the
 * game's verifier and is not a duplicate of an earlier entry. No CSPRNG, clock
 * or worker scheduling affects the result: workers only compute candidates;
 * the parent merges them in index order. A seed that exhausts its attempts
 * simply moves on to the next retry, so a build cannot fail at random.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";

import {
  BANKED_TYPES,
  bankEntrySeed,
  bankKey,
  buildBankEntry,
  type BankedType,
} from "../src/lib/duel/puzzleBank.server";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { INTRO_EXAMPLE_SEED } from "../src/lib/duel/puzzleDemo";
import { withSeededRandom } from "../src/lib/duel/random";
import type { PuzzleData } from "../src/lib/duel/types";

/** Bank size per game: about 1,000 boards each (see the PR / docs for the size budget). */
export const BANK_COUNT = 1000;
/** A seed index that cannot find a board in this many retries is a real bug, not bad luck. */
const MAX_RETRIES = 64;

export const BANK_FILES: Record<BankedType, { file: string; constName: string; typeName: string; script: string }> = {
  flow: { file: "flowBank.server.ts", constName: "FLOW", typeName: "FlowPuzzleData", script: "flow-bank.ts" },
  blockparty: { file: "blockPartyBank.server.ts", constName: "BLOCKPARTY", typeName: "BlockPartyPuzzleData", script: "blockparty-bank.ts" },
  tubes: { file: "tubesBank.server.ts", constName: "TUBES", typeName: "TubesPuzzleData", script: "tubes-bank.ts" },
  gravity: { file: "gravityBank.server.ts", constName: "GRAVITY", typeName: "GravityPuzzleData", script: "gravity-bank.ts" },
  lightup: { file: "lightUpBank.server.ts", constName: "LIGHTUP", typeName: "LightUpPuzzleData", script: "lightup-bank.ts" },
  iceslide: { file: "iceSlideBank.server.ts", constName: "ICESLIDE", typeName: "SlidePuzzleData", script: "iceslide-bank.ts" },
};

export function bankPath(type: BankedType): string {
  return fileURLToPath(new URL(`../src/lib/duel/${BANK_FILES[type].file}`, import.meta.url));
}

interface Candidate {
  index: number;
  retry: number;
  puzzle: PuzzleData;
}

/** The first passing candidate for `index`, trying retries from `fromRetry` upward. */
export function candidateFor(type: BankedType, index: number, fromRetry = 0): Candidate {
  for (let retry = fromRetry; retry < MAX_RETRIES; retry++) {
    const puzzle = buildBankEntry(type, bankEntrySeed(type, index, retry));
    if (puzzle) return { index, retry, puzzle };
  }
  throw new Error(`${type} bank entry ${index}: no verified board in ${MAX_RETRIES} fixed seeds`);
}

/** Worker mode: candidates for indices worker, worker + jobs, … as JSON lines. */
function runWorker(type: BankedType, count: number, worker: number, jobs: number): void {
  for (let index = worker; index < count; index += jobs) {
    process.stdout.write(`${JSON.stringify(candidateFor(type, index))}\n`);
  }
}

async function candidatesInParallel(type: BankedType, count: number, jobs: number): Promise<Candidate[]> {
  const out: Candidate[] = new Array(count);
  let done = 0;
  const t0 = Date.now();
  const self = fileURLToPath(import.meta.url);
  await Promise.all(
    Array.from({ length: jobs }, (_, worker) =>
      new Promise<void>((resolve, reject) => {
        const child = spawn(process.execPath, [self, "--worker", type, String(count), String(worker), String(jobs)], {
          stdio: ["ignore", "pipe", "inherit"],
        });
        let buffer = "";
        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => {
          buffer += chunk;
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 1);
            if (!line.trim()) continue;
            const candidate = JSON.parse(line) as Candidate;
            out[candidate.index] = candidate;
            done += 1;
            if (done % 100 === 0) console.error(`[${type}] ${done}/${count} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
          }
        });
        child.on("error", reject);
        child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${type} worker ${worker} exited ${code}`))));
      }),
    ),
  );
  for (let i = 0; i < count; i++) if (!out[i]) throw new Error(`${type} bank entry ${i} missing from workers`);
  return out;
}

export interface BuiltBank {
  type: BankedType;
  entries: PuzzleData[];
  retries: number[];
  example: PuzzleData;
  source: string;
}

/**
 * The fixed intro example exactly as practice built it live: generatePuzzle
 * under INTRO_EXAMPLE_SEED, minus the speed-par stamp the draw re-adds.
 */
export function liveIntroExample(type: BankedType): PuzzleData {
  const { speedPar: _stamp, ...made } = withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(type)) as PuzzleData & { speedPar?: number };
  return made as PuzzleData;
}

/** Merges candidates in index order; a duplicate board moves that index on to its next retry. */
function merge(type: BankedType, candidates: Candidate[]): { entries: PuzzleData[]; retries: number[] } {
  const seen = new Set<string>();
  const entries: PuzzleData[] = [];
  const retries: number[] = [];
  for (const first of candidates) {
    let candidate = first;
    while (seen.has(bankKey(candidate.puzzle)!)) candidate = candidateFor(type, candidate.index, candidate.retry + 1);
    seen.add(bankKey(candidate.puzzle)!);
    entries.push(candidate.puzzle);
    retries.push(candidate.retry);
  }
  return { entries, retries };
}

export function entriesHash(entries: readonly PuzzleData[]): string {
  return createHash("sha256").update(JSON.stringify(entries)).digest("hex");
}

export function renderBankSource(type: BankedType, entries: PuzzleData[], retries: number[], example: PuzzleData): string {
  const { constName, typeName, script } = BANK_FILES[type];
  return `/* Generated by scripts/${script} — do not edit by hand. Rebuild with \`bun scripts/${script}\`. */
import type { ${typeName} } from "./types";

/** Build facts: entry i is the live generator under bankEntrySeed("${type}", i, ${constName}_BANK_RETRIES[i]). */
export const ${constName}_BANK_BUILD = { entries: ${entries.length}, sha256: "${entriesHash(entries)}" } as const;

export const ${constName}_BANK_RETRIES: number[] = ${JSON.stringify(retries)};

/** The fixed practice intro example (live generator under INTRO_EXAMPLE_SEED), stored so it needs no live solve. */
export const ${constName}_INTRO_EXAMPLE: ${typeName} | null = ${JSON.stringify(example)};

export const ${constName}_BANK: ${typeName}[] = [
${entries.map((entry) => `  ${JSON.stringify(entry)},`).join("\n")}
];
`;
}

export async function buildBank(type: BankedType, count = BANK_COUNT, jobs = cpus().length): Promise<BuiltBank> {
  const candidates = await candidatesInParallel(type, count, Math.max(1, Math.min(jobs, count)));
  const { entries, retries } = merge(type, candidates);
  const example = liveIntroExample(type);
  return { type, entries, retries, example, source: renderBankSource(type, entries, retries, example) };
}

export async function runBankScript(type: BankedType): Promise<void> {
  const args = process.argv.slice(2);
  const value = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const count = Number(value("count") ?? BANK_COUNT);
  const jobs = Number(value("jobs") ?? cpus().length);
  const out = value("out");
  const check = args.includes("--check");
  const t0 = Date.now();
  const built = await buildBank(type, count, jobs);
  const seconds = ((Date.now() - t0) / 1000).toFixed(1);
  const bytes = Buffer.byteLength(built.source);
  const retried = built.retries.filter((r) => r > 0).length;
  console.log(`${type}: ${built.entries.length} entries, ${(bytes / 1024).toFixed(0)} KB, ${retried} entries needed a retry seed, ${seconds} s`);

  if (check) {
    const committed = readFileSync(bankPath(type), "utf8");
    const same = count === BANK_COUNT
      ? committed === built.source
      : committed.includes(built.entries.map((e) => `  ${JSON.stringify(e)},`).join("\n"));
    console.log(same ? `PASS ${type}: rebuild matches ${BANK_FILES[type].file}` : `FAIL ${type}: rebuild differs from ${BANK_FILES[type].file}`);
    if (!same) process.exit(1);
    return;
  }
  if (count !== BANK_COUNT && !out) {
    console.log(`(--count without --out: not writing ${BANK_FILES[type].file})`);
    return;
  }
  writeFileSync(out ?? bankPath(type), built.source);
  console.log(`wrote ${out ?? bankPath(type)}`);
}

if (process.argv[2] === "--worker") {
  const [, , , type, count, worker, jobs] = process.argv;
  if (!(BANKED_TYPES as readonly string[]).includes(type!)) throw new Error(`unknown banked type ${type}`);
  runWorker(type as BankedType, Number(count), Number(worker), Number(jobs));
}
