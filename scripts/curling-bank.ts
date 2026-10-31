/**
 * Builds Curling's bank (src/lib/duel/curlingBank.server.ts) and its proofs (scripts/fixtures/curling-witness.json).
 *
 * For a fixed list of candidate seeds (CANDIDATES, in order), the oracle (scripts/curling-oracle.ts perfectPlan)
 * looks for eight throws that each come to rest on the button, with every opponent stone out of the house at the end
 * and shot stone held. A seed is kept only when that plan, played as the phone would record it (each throw on the
 * first tick it can be), scores exactly 200 through the server's own replay (replayCurlingRun); the first WANT kept
 * seeds make the bank, in candidate order, so a rebuild writes the same files.
 *
 * curlRev 2 (31 Oct 2026) has its own bank (src/lib/duel/curlingBankV2.server.ts) and proofs
 * (scripts/fixtures/curling-witness-v2.json): the oracle may also slide the stone along the near hog line (each
 * witness throw is [start x, broom x, broom y, weight, turn]), and every plan scores 200 through replayCurlingRun(…, 2).
 *
 *   bun scripts/curling-bank.ts [--rev=2] [--jobs=4] [--want=…] [--candidates=…] [--cache=<file>]   build (children
 *                                                         search in parallel; --cache makes it resumable)
 *   bun scripts/curling-bank.ts --check                   both revisions: every stored witness scores 200 and each
 *                                                         bank file is exactly the text its witnesses build
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { perfectPlan, planEvents, type Throw } from "./curling-oracle";
import { encodeCurlingRun, replayCurlingRun } from "../src/lib/duel/curling";
import { curlingCheckpoint, curlingGameFor } from "../src/lib/arcade/curling";
import { SPORTS_CHECKPOINT_INTERVAL } from "../src/lib/arcade/sportsKit";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const REV = Number(opt("rev") ?? 1);
const WANT = Number(opt("want") ?? (REV >= 2 ? 80 : 60));
const JOBS = Number(opt("jobs") ?? 2);
const CANDIDATE_COUNT = Number(opt("candidates") ?? (REV >= 2 ? 120 : 110));
/** `--cache=<file>`: each searched seed is appended there as it is proved or dropped, and a rerun skips the seeds in it (resumable; the result is the same). */
const CACHE = opt("cache");
const FILES = {
  1: { bank: new URL("../src/lib/duel/curlingBank.server.ts", import.meta.url), witness: new URL("./fixtures/curling-witness.json", import.meta.url) },
  2: { bank: new URL("../src/lib/duel/curlingBankV2.server.ts", import.meta.url), witness: new URL("./fixtures/curling-witness-v2.json", import.meta.url) },
} as const;
const BANK = FILES[REV >= 2 ? 2 : 1].bank;
const WITNESS = FILES[REV >= 2 ? 2 : 1].witness;

/** A spread of 31-bit seeds (fixed, so the bank rebuilds the same). */
function candidate(n: number): number {
  let x = (n + 7) * 0x9e3779b1;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return ((x >>> 0) % 0x7ffffffe) + 1;
}

export interface Witness {
  seed: number;
  /** The plan: [broom x, broom y, weight, turn] per throw (curlRev 1). */
  throws: [number, number, number, number][];
}

/** A curlRev 2 proof: [start x, broom x, broom y, weight, turn] per throw. */
export interface WitnessV2 {
  seed: number;
  throws: [number, number, number, number, number][];
}

/** A witness's plan as throws (either revision's shape). */
export function witnessPlan(w: Witness | WitnessV2): Throw[] {
  return (w.throws as number[][]).map((t) => (t.length === 5 ? { sx: t[0]!, bx: t[1]!, by: t[2]!, weight: t[3]!, turn: t[4]! } : { bx: t[0]!, by: t[1]!, weight: t[2]!, turn: t[3]! }));
}

/** The plan's run as the phone would submit it (events and checkpoints), for the server's replay (curlRev 1 by default). */
export function witnessRaw(w: Witness | WitnessV2, rev = 1): string {
  const plan = witnessPlan(w);
  const { events } = planEvents(w.seed, plan, 0, rev);
  const game = curlingGameFor(rev);
  const byTick = new Map(events.map((e) => [e.t, e]));
  let s = game.init(w.seed);
  const checkpoints = [];
  while (!game.isOver(s)) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    if (s.tick % SPORTS_CHECKPOINT_INTERVAL === 0) checkpoints.push(curlingCheckpoint(s));
  }
  return encodeCurlingRun({ seed: w.seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
}

/** The witness's score through the server's replay (and whether the replay flagged it). */
export function witnessScore(w: Witness | WitnessV2, rev = 1): number {
  const r = replayCurlingRun(w.seed, witnessRaw(w, rev), rev);
  return r.flagged ? -1 : r.score;
}

function proveOne(seed: number): Witness | WitnessV2 | null {
  const plan = perfectPlan(seed, 3, 30, REV);
  if (!plan) return null;
  const w: Witness | WitnessV2 =
    REV >= 2 ? { seed, throws: plan.map((t) => [t.sx ?? 0, t.bx, t.by, t.weight, t.turn]) } : { seed, throws: plan.map((t) => [t.bx, t.by, t.weight, t.turn]) };
  return witnessScore(w, REV) === 200 ? w : null;
}

/** A bank file's text from its kept witnesses (and the candidates searched). */
function bankText(rev: number, kept: readonly { seed: number }[], candidates: number): string {
  if (rev >= 2)
    return `/**
 * Curling curlRev 2's bank: ${kept.length} seeds whose opponent stones the oracle (scripts/curling-oracle.ts, sliding the
 * stone along the near hog line where the centre line was not enough) played out of the house with every one of eight
 * stones coming to rest on the button, scoring 200 through the server's replay on curlRev 2 (of ${candidates} candidates).
 * Built by \`bun scripts/curling-bank.ts --rev=2\`; \`--check\` and curling-check replay the proofs
 * (scripts/fixtures/curling-witness-v2.json). Server-only.
 */
export const CURLING_BANK_V2: readonly number[] = [${kept.map((w) => w.seed).join(",")}];

/**
 * The skill-band tool's seed index n → a curlRev 2 bank seed: the tuning seeds (0–29) are the bank's first 30; the
 * fresh seeds (10000 on) start at its 31st, so the two sets never share a seed.
 */
export function curlingBankV2SeedFor(n: number): number {
  const len = CURLING_BANK_V2.length;
  return n < 10000 ? CURLING_BANK_V2[n % len]! : CURLING_BANK_V2[30 + ((n - 10000) % (len - 30))]!;
}
`;
  return `/**
 * Curling curlRev 1's bank: ${kept.length} seeds whose opponent stones the oracle (scripts/curling-oracle.ts) played out
 * of the house with every one of eight stones coming to rest on the button, scoring 200 through the server's replay
 * (of ${candidates} candidates). Built by \`bun scripts/curling-bank.ts\`; \`--check\` and curling-check replay the
 * proofs (scripts/fixtures/curling-witness.json). Server-only.
 */
export const CURLING_BANK: readonly number[] = [${kept.map((w) => w.seed).join(",")}];

/**
 * The skill-band tool's seed index n → a bank seed: the tuning seeds (0–29) are the bank's first 30; the fresh seeds
 * (10000 on) start at its 31st, so the two sets never share a seed.
 */
export function curlingBankSeedFor(n: number): number {
  const len = CURLING_BANK.length;
  return n < 10000 ? CURLING_BANK[n % len]! : CURLING_BANK[30 + ((n - 10000) % (len - 30))]!;
}
`;
}

/** The candidate count a bank file names ("of N candidates"). */
function candidatesNamed(text: string): number {
  return Number(/\(of (\d+) candidates\)/.exec(text.replace(/\s+\*\s+/g, " "))?.[1] ?? NaN);
}

if (!import.meta.main) {
  // Imported for witnessRaw / witnessScore (curling-check, the bot): nothing to build.
} else if (args.includes("--child")) {
  const list = (opt("list") ?? "").split(",").filter(Boolean).map(Number);
  for (const seed of list) {
    const line = JSON.stringify({ seed, w: proveOne(seed) });
    if (CACHE) appendFileSync(CACHE, line + "\n");
    console.log(line);
  }
} else if (args.includes("--check")) {
  let failed = false;
  for (const rev of opt("rev") ? [REV] : [1, 2]) {
    const files = FILES[rev >= 2 ? 2 : 1];
    const all = JSON.parse(readFileSync(files.witness, "utf8")) as (Witness | WitnessV2)[];
    const bad = all.filter((w) => witnessScore(w, rev) !== 200);
    const text = readFileSync(files.bank, "utf8");
    const same = bankText(rev, all, candidatesNamed(text)) === text;
    console.log(`curlRev ${rev}: ${all.length - bad.length} of ${all.length} witnesses score 200${bad.length ? `; failing: ${bad.map((w) => w.seed).join(", ")}` : ""}; the bank file ${same ? "is" : "is NOT"} exactly its witnesses' text`);
    if (bad.length || !same) failed = true;
  }
  if (failed) process.exit(1);
} else {
  const seeds = Array.from({ length: CANDIDATE_COUNT }, (_, n) => candidate(n));
  const found = new Map<number, Witness | WitnessV2 | null>();
  if (CACHE && existsSync(CACHE))
    for (const line of readFileSync(CACHE, "utf8").split("\n").filter(Boolean)) {
      const { seed, w } = JSON.parse(line) as { seed: number; w: Witness | WitnessV2 | null };
      found.set(seed, w);
    }
  const groups: number[][] = Array.from({ length: JOBS }, () => []);
  seeds.filter((s) => !found.has(s)).forEach((s, i) => groups[i % JOBS]!.push(s));
  const started = Date.now();
  const outs = await Promise.all(
    groups.map(
      (g) =>
        new Promise<string>((resolve) => {
          if (!g.length) return resolve("");
          const r = Bun.spawn(["bun", new URL(import.meta.url).pathname, "--child", `--rev=${REV}`, `--list=${g.join(",")}`, ...(CACHE ? [`--cache=${CACHE}`] : [])], { stdout: "pipe", stderr: "inherit" });
          new Response(r.stdout).text().then(resolve);
        }),
    ),
  );
  for (const text of outs)
    for (const line of text.split("\n").filter(Boolean)) {
      const { seed, w } = JSON.parse(line) as { seed: number; w: Witness | WitnessV2 | null };
      found.set(seed, w);
    }
  const proved = seeds.map((s) => found.get(s)).filter((w): w is Witness | WitnessV2 => !!w);
  const kept = proved.slice(0, WANT);
  console.log(`curlRev ${REV}: ${proved.length} of ${seeds.length} candidates proved, ${kept.length} kept (want ${WANT}) in ${Math.round((Date.now() - started) / 1000)} s`);
  writeFileSync(WITNESS, JSON.stringify(kept) + "\n");
  writeFileSync(BANK, bankText(REV, kept, seeds.length));
}
