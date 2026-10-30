/**
 * Builds Curling's bank (src/lib/duel/curlingBank.server.ts) and its proofs (scripts/fixtures/curling-witness.json).
 *
 * For a fixed list of candidate seeds (CANDIDATES, in order), the oracle (scripts/curling-oracle.ts perfectPlan)
 * looks for eight throws that each come to rest on the button, with every opponent stone out of the house at the end
 * and shot stone held. A seed is kept only when that plan, played as the phone would record it (each throw on the
 * first tick it can be), scores exactly 200 through the server's own replay (replayCurlingRun); the first WANT kept
 * seeds make the bank, in candidate order, so a rebuild writes the same files.
 *
 *   bun scripts/curling-bank.ts [--jobs=2] [--want=60]   build (children search in parallel)
 *   bun scripts/curling-bank.ts --check                   replay every stored witness (each must score 200)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { perfectPlan, planEvents, type Throw } from "./curling-oracle";
import { encodeCurlingRun, replayCurlingRun } from "../src/lib/duel/curling";
import { curlingCheckpoint, curlingGameFor } from "../src/lib/arcade/curling";
import { SPORTS_CHECKPOINT_INTERVAL } from "../src/lib/arcade/sportsKit";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const WANT = Number(opt("want") ?? 60);
const JOBS = Number(opt("jobs") ?? 2);
const CANDIDATE_COUNT = Number(opt("candidates") ?? 110);
const BANK = new URL("../src/lib/duel/curlingBank.server.ts", import.meta.url);
const WITNESS = new URL("./fixtures/curling-witness.json", import.meta.url);

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
  /** The plan: [broom x, broom y, weight, turn] per throw. */
  throws: [number, number, number, number][];
}

/** The plan's run as the phone would submit it (events and checkpoints), for the server's replay. */
export function witnessRaw(w: Witness): string {
  const plan: Throw[] = w.throws.map(([bx, by, weight, turn]) => ({ bx, by, weight, turn }));
  const { events } = planEvents(w.seed, plan);
  const game = curlingGameFor();
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
export function witnessScore(w: Witness): number {
  const r = replayCurlingRun(w.seed, witnessRaw(w));
  return r.flagged ? -1 : r.score;
}

function proveOne(seed: number): Witness | null {
  const plan = perfectPlan(seed, 3, 30);
  if (!plan) return null;
  const w: Witness = { seed, throws: plan.map((t) => [t.bx, t.by, t.weight, t.turn]) };
  return witnessScore(w) === 200 ? w : null;
}

if (!import.meta.main) {
  // Imported for witnessRaw / witnessScore (curling-check, the bot): nothing to build.
} else if (args.includes("--child")) {
  const list = (opt("list") ?? "").split(",").filter(Boolean).map(Number);
  for (const seed of list) console.log(JSON.stringify({ seed, w: proveOne(seed) }));
} else if (args.includes("--check")) {
  const all = JSON.parse(readFileSync(WITNESS, "utf8")) as Witness[];
  const bad = all.filter((w) => witnessScore(w) !== 200);
  console.log(`${all.length - bad.length} of ${all.length} witnesses score 200${bad.length ? `; failing: ${bad.map((w) => w.seed).join(", ")}` : ""}`);
  if (bad.length) process.exit(1);
} else {
  const seeds = Array.from({ length: CANDIDATE_COUNT }, (_, n) => candidate(n));
  const groups: number[][] = Array.from({ length: JOBS }, () => []);
  seeds.forEach((s, i) => groups[i % JOBS]!.push(s));
  const started = Date.now();
  const outs = await Promise.all(
    groups.map(
      (g) =>
        new Promise<string>((resolve) => {
          const r = Bun.spawn(["bun", new URL(import.meta.url).pathname, "--child", `--list=${g.join(",")}`], { stdout: "pipe", stderr: "inherit" });
          new Response(r.stdout).text().then(resolve);
        }),
    ),
  );
  const found = new Map<number, Witness | null>();
  for (const text of outs)
    for (const line of text.split("\n").filter(Boolean)) {
      const { seed, w } = JSON.parse(line) as { seed: number; w: Witness | null };
      found.set(seed, w);
    }
  const kept = seeds.map((s) => found.get(s)).filter((w): w is Witness => !!w).slice(0, WANT);
  console.log(`${kept.length} of ${seeds.length} candidates proved (want ${WANT}) in ${Math.round((Date.now() - started) / 1000)} s`);
  writeFileSync(WITNESS, JSON.stringify(kept) + "\n");
  writeFileSync(
    BANK,
    `/**
 * Curling curlRev 1's bank: ${kept.length} seeds whose opponent stones the oracle (scripts/curling-oracle.ts) played out
 * of the house with every one of eight stones coming to rest on the button, scoring 200 through the server's replay
 * (of ${seeds.length} candidates). Built by \`bun scripts/curling-bank.ts\`; \`--check\` and curling-check replay the
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
`,
  );
}

