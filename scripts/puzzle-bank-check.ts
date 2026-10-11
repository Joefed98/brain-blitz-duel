/**
 * Precomputed puzzle banks (src/lib/duel/puzzleBank.server.ts) for Chroma
 * Lines, Tessellate, Polypotions, Topsy-Turvy, Lamplighter and Skid.
 *
 *   bun scripts/puzzle-bank-check.ts
 *
 * For every bank:
 *   - the file is untouched since its build (entry count and SHA-256 match);
 *   - EVERY entry passes the game's verifier (the same acceptance rules as the
 *     live generator: uniqueness / solvability / proven minimum), in parallel;
 *   - no two entries share a public identity;
 *   - a spread sample of entries rebuilds identically from its fixed seed,
 *     and lower retry seeds for those entries really failed or duplicated;
 *   - the stored intro example equals the live seeded example.
 * Then the draw: seeded and reproducible, recent-avoidance, deep copies,
 * public-half keys, room start through buildRoomPuzzles, grading of each
 * stored solution, and the capped live fallback for an empty bank.
 *
 * The full byte-for-byte rebuild of all six banks takes ~20 minutes, so it is
 * the optional `puzzle-bank-rebuild-check.ts` (run-checks --include-optional).
 */
import { spawn } from "node:child_process";
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";

import { encodeFlowPaths } from "../src/lib/duel/flow";
import { encodePlacements } from "../src/lib/duel/blockParty";
import { encodeBulbs } from "../src/lib/duel/lightUp";
import { buildRoomPuzzles, gradeAnswer } from "../src/lib/duel/generate.server";
import {
  BANKED_TYPES,
  bankEntrySeed,
  bankFor,
  bankIndexFor,
  bankKey,
  bankedIntroExample,
  buildBankEntry,
  drawBankedPuzzle,
  verifyBankedPuzzle,
  type BankedType,
} from "../src/lib/duel/puzzleBank.server";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { SPEED_PAR_VERSION } from "../src/lib/duel/speedPar";
import { typesInCategory } from "../src/lib/duel/registry";
import * as flowFile from "../src/lib/duel/flowBank.server";
import * as blockFile from "../src/lib/duel/blockPartyBank.server";
import * as tubesFile from "../src/lib/duel/tubesBank.server";
import * as gravityFile from "../src/lib/duel/gravityBank.server";
import * as lightFile from "../src/lib/duel/lightUpBank.server";
import * as slideFile from "../src/lib/duel/iceSlideBank.server";
import { BANK_COUNT, entriesHash, liveIntroExample } from "./puzzle-bank-lib";
import type { PuzzleData } from "../src/lib/duel/types";

const self = fileURLToPath(import.meta.url);

/** Build stamp and retry index list per bank file (absent before a first build). */
const FACTS: Record<BankedType, { build?: { entries: number; sha256: string }; retries?: number[] }> = {
  flow: { build: (flowFile as any).FLOW_BANK_BUILD, retries: (flowFile as any).FLOW_BANK_RETRIES },
  blockparty: { build: (blockFile as any).BLOCKPARTY_BANK_BUILD, retries: (blockFile as any).BLOCKPARTY_BANK_RETRIES },
  tubes: { build: (tubesFile as any).TUBES_BANK_BUILD, retries: (tubesFile as any).TUBES_BANK_RETRIES },
  gravity: { build: (gravityFile as any).GRAVITY_BANK_BUILD, retries: (gravityFile as any).GRAVITY_BANK_RETRIES },
  lightup: { build: (lightFile as any).LIGHTUP_BANK_BUILD, retries: (lightFile as any).LIGHTUP_BANK_RETRIES },
  iceslide: { build: (slideFile as any).ICESLIDE_BANK_BUILD, retries: (slideFile as any).ICESLIDE_BANK_RETRIES },
};

/* ---------------- worker: verify a stride of one bank ---------------- */
if (process.argv[2] === "--verify-worker") {
  const [, , , type, worker, jobs] = process.argv;
  const bank = bankFor(type as BankedType);
  const bad: string[] = [];
  for (let i = Number(worker); i < bank.length; i += Number(jobs)) {
    const why = verifyBankedPuzzle(bank[i]!);
    if (why) bad.push(`${i}: ${why}`);
  }
  console.log(JSON.stringify(bad));
  process.exit(0);
}

let failures = 0;
const check = (ok: boolean, label: string) => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
};

function verifyAll(type: BankedType, jobs: number): Promise<string[]> {
  return Promise.all(
    Array.from({ length: jobs }, (_, worker) =>
      new Promise<string[]>((resolve, reject) => {
        const child = spawn(process.execPath, [self, "--verify-worker", type, String(worker), String(jobs)], {
          stdio: ["ignore", "pipe", "inherit"],
        });
        let out = "";
        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (d: string) => (out += d));
        child.on("error", reject);
        child.on("exit", (code) => {
          if (code !== 0) return reject(new Error(`verify worker exited ${code}`));
          resolve(JSON.parse(out.trim().split("\n").pop()!) as string[]);
        });
      }),
    ),
  ).then((parts) => parts.flat());
}

/** Answer that replays the stored solution, in each game's submission encoding. */
function solutionAnswer(puzzle: PuzzleData): string {
  switch (puzzle.type) {
    case "flow": return encodeFlowPaths(puzzle.solution!);
    case "blockparty": return encodePlacements(puzzle.solution!);
    case "lightup": return encodeBulbs(puzzle.solution!);
    case "tubes": case "gravity": case "iceslide": return puzzle.solution!;
    default: throw new Error(`not banked: ${puzzle.type}`);
  }
}

const SAMPLE = 6;
const jobs = Math.max(1, cpus().length);

for (const type of BANKED_TYPES) {
  const t0 = performance.now();
  const bank = bankFor(type);
  const files = { build: FACTS[type].build, retries: FACTS[type].retries ?? [] };
  check(bank.length === BANK_COUNT, `${type}: ${bank.length} entries (expected ${BANK_COUNT})`);
  check(files.build?.entries === bank.length && files.build?.sha256 === entriesHash(bank),
    `${type}: entry count and SHA-256 match the build stamp (file not hand-edited)`);
  check(files.retries.length === bank.length, `${type}: one retry index per entry`);

  const bad = await verifyAll(type, jobs);
  check(bad.length === 0, `${type}: every entry passes verification${bad.length ? ` — ${bad.slice(0, 5).join("; ")}` : ""}`);

  const keys = new Set(bank.map((p) => bankKey(p)));
  check(keys.size === bank.length && !keys.has(null), `${type}: no duplicate boards`);

  // Rebuild a spread sample from fixed seeds: first, last and evenly spaced.
  const sample = [...new Set([0, bank.length - 1, ...Array.from({ length: SAMPLE }, (_, k) => Math.floor(((k + 0.5) * bank.length) / SAMPLE))])];
  let rebuilt = 0;
  let retriesOk = true;
  for (const index of sample) {
    const retry = files.retries[index]!;
    const again = buildBankEntry(type, bankEntrySeed(type, index, retry));
    if (again && JSON.stringify(again) === JSON.stringify(bank[index])) rebuilt++;
    // Any lower retry must have failed verification or duplicated an earlier entry.
    for (let r = 0; r < retry; r++) {
      const earlier = buildBankEntry(type, bankEntrySeed(type, index, r));
      if (earlier && !bank.slice(0, index).some((e) => bankKey(e) === bankKey(earlier))) retriesOk = false;
    }
  }
  check(rebuilt === sample.length, `${type}: ${rebuilt}/${sample.length} sampled entries rebuild identically from their fixed seeds`);
  check(retriesOk, `${type}: sampled entries use the first retry seed that gave a new verified board`);

  const live = liveIntroExample(type);
  const stored = bankedIntroExample(type);
  check(!!stored && JSON.stringify(stored) === JSON.stringify({ ...live, speedPar: SPEED_PAR_VERSION }),
    `${type}: stored intro example equals the live seeded example`);

  // Grading: the stored solution replays to a full solve on the stored board.
  const graded = gradeAnswer({ ...bank[0]!, speedPar: SPEED_PAR_VERSION } as PuzzleData, solutionAnswer(bank[0]!), 30_000);
  check(graded.isCorrect && graded.score > 0, `${type}: stored solution grades as solved (score ${graded.score})`);
  console.log(`  ${type} done in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
}

/* ---------------- the draw ---------------- */
{
  const type: BankedType = "tubes";
  const a = drawBankedPuzzle(type, 12345);
  const b = drawBankedPuzzle(type, 12345);
  check(JSON.stringify(a) === JSON.stringify(b), "draw: same seed, same board");
  check(JSON.stringify(a) === JSON.stringify(bankFor(type)[bankIndexFor(type, 12345, BANK_COUNT)]), "draw: seed picks its own index");
  (a as { tubes: number[][] }).tubes[0]!.push(99);
  check(JSON.stringify(drawBankedPuzzle(type, 12345)) === JSON.stringify(b), "draw: returns a deep copy (bank cannot be mutated)");

  const avoid = new Set([bankKey(b)!]);
  const c = drawBankedPuzzle(type, 12345, avoid);
  check(bankKey(c) !== bankKey(b) && JSON.stringify(c) === JSON.stringify(bankFor(type)[(bankIndexFor(type, 12345, BANK_COUNT) + 1) % BANK_COUNT]),
    "draw: a recently played board is skipped for the next one");
  const all = new Set(bankFor(type).map((p) => bankKey(p)!));
  check(JSON.stringify(drawBankedPuzzle(type, 12345, all)) === JSON.stringify(b), "draw: if every board is recent, the seed's own board is used");

  const spread = new Set(Array.from({ length: 2000 }, (_, s) => bankIndexFor("flow", s * 7919 + 1, BANK_COUNT)));
  check(spread.size > 800, `draw: 2,000 seeds reach ${spread.size} of ${BANK_COUNT} flow entries`);

  // Keys come from public fields only, so stored puzzles_public rows match.
  let publicKeysMatch = true;
  for (const t of BANKED_TYPES) {
    const full = { ...bankFor(t)[3]!, speedPar: SPEED_PAR_VERSION } as PuzzleData;
    if (bankKey(splitPuzzle(full).pub) !== bankKey(full)) publicKeysMatch = false;
  }
  check(publicKeysMatch, "draw: bankKey of the public half equals bankKey of the full puzzle");
}

/* ---------------- room start ---------------- */
{
  const categories = ["logic", "pattern"] as const;
  let banked = 0;
  let sameShape = true;
  let reproducible = true;
  for (let seed = 1; seed <= 60; seed++) {
    const built = buildRoomPuzzles({ seed, categories: [...categories] });
    for (const puzzle of built.puzzles) {
      if (!(BANKED_TYPES as readonly string[]).includes(puzzle.type)) continue;
      banked++;
      const { speedPar, ...rest } = puzzle as PuzzleData & { speedPar?: number };
      const expected = bankFor(puzzle.type as BankedType)[bankIndexFor(puzzle.type as BankedType, seed, BANK_COUNT)];
      if (speedPar !== SPEED_PAR_VERSION || JSON.stringify(rest) !== JSON.stringify(expected)) sameShape = false;
      const again = drawBankedPuzzle(puzzle.type as BankedType, seed);
      if (JSON.stringify(again) !== JSON.stringify(rest)) reproducible = false;
    }
  }
  check(banked > 20, `room start: ${banked} banked rounds drawn over 60 logic+pattern rooms`);
  check(sameShape, "room start: banked rounds are the bank entry for the room seed, stamped speedPar like live rounds");
  check(reproducible, "room start: the room seed alone reproduces every banked round");
  const logicPattern = [...typesInCategory("logic"), ...typesInCategory("pattern")];
  check(BANKED_TYPES.every((t) => logicPattern.includes(t)), "room start: all six banked types are active room types");
}

/* ---------------- fallback ---------------- */
{
  const bank = bankFor("gravity") as PuzzleData[];
  const saved = bank.splice(0, bank.length);
  let ok = false;
  try {
    const live = drawBankedPuzzle("gravity", 777);
    ok = verifyBankedPuzzle(live) === null;
  } finally {
    bank.push(...saved);
  }
  check(ok, "fallback: an empty bank generates live (capped) and the board verifies");
  check(bankFor("gravity").length === BANK_COUNT, "fallback: bank restored after the test");
}

console.log(failures === 0 ? "ALL PUZZLE BANK CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
