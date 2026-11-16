/**
 * Builds Grappler's swingRev 17 deal, as Apex's (scripts/racing-deal.ts): src/lib/duel/swingSlideDeal.server.ts
 * (SWING_SLIDE_DEAL) lists SWING_SLIDE_DEAL_SIZE course seeds, each one whose oracle run replays through the server's
 * own path (encodeSwingRun → replaySwingRun on swingRev 17) to exactly 200, unflagged. Candidates come from a fixed
 * hashed sequence (swingSlideCandidate(0, 1, 2 …)); each candidate's course is built (the sim's own builder, sliding
 * hooks phased to its planned route), then the oracle plays it: the skill-band bot at the flawless level
 * (scripts/arcade-skill-bands/bots/swingRework.ts, no timing error, SWING_SLIDE_ORACLE_TRIES look-ahead stream: in
 * trials a second or third stream never rescued a course the first missed); a log that scores exactly 200 is kept as
 * the course's witness
 * (scripts/fixtures/swing-slide-deal-witness.json.gz). A candidate none of whose tries reaches 200 is dropped and
 * counted.
 *
 *   bun scripts/swing-slide-deal.ts            (writes the deal and the witnesses; 4 worker processes, ~15–25 min)
 *   bun scripts/swing-slide-deal.ts --check    (replays every stored witness through the server path: each exactly 200,
 *                                                and the deal is exactly the witnessed seeds in order; ~1 min)
 *
 * `--rev=18` does the same for swingRev 18 (the bigger hero, 15 Nov 2026): src/lib/duel/swingBigDeal.server.ts
 * (SWING_BIG_DEAL) and scripts/fixtures/swing-big-deal-witness.json.gz, from the same candidate sequence (each course
 * built on the larger body from its own salt), the same oracle and the same rule (exactly 200 through replaySwingRun).
 *
 * `--rev=18 --level=easy|hard|expert` does the same for a difficulty level (15 Nov 2026, docs/arcade-standard/swing.md
 * "Levels"): src/lib/duel/swingLevelDeal.server.ts (SWING_LEVEL_DEAL, one list a level; each run rewrites its own
 * level's list and keeps the others) and scripts/fixtures/swing-level-<level>-witness.json.gz, from the same candidate
 * sequence (each course built at the level, from the level's own salt), the same oracle and the same rule, played and
 * replayed at the level. A level's deal holds SWING_LEVEL_DEAL_SIZE courses.
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync, appendFileSync } from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";
import { spawn } from "node:child_process";
import { swingGameFor, swingCheckpoint, swingSlideParts, SWING_REV_BIG, SWING_REV_SLIDE, SWING_CHECKPOINT_INTERVAL, type SwingLevel, type SwingState } from "../src/lib/arcade/swing";
import { encodeSwingRun, replaySwingRun } from "../src/lib/duel/swing";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";

export const SWING_SLIDE_DEAL_SIZE = 120;
export const SWING_SLIDE_ORACLE_TRIES = 1;
export const SWING_SLIDE_WITNESS = new URL("./fixtures/swing-slide-deal-witness.json.gz", import.meta.url);
/** swingRev 18's witnesses (`--rev=18`). */
export const SWING_BIG_WITNESS = new URL("./fixtures/swing-big-deal-witness.json.gz", import.meta.url);
/** The revision this run builds (17 unless `--rev=18`). */
const REV = import.meta.main ? Number(process.argv.find((a) => a.startsWith("--rev="))?.slice(6) ?? SWING_REV_SLIDE) : SWING_REV_SLIDE;
if (REV !== SWING_REV_SLIDE && REV !== SWING_REV_BIG) throw new Error(`--rev must be ${SWING_REV_SLIDE} or ${SWING_REV_BIG}`);
const BIG = REV === SWING_REV_BIG;
/** A difficulty level's deal (`--level=`, swingRev 18 only; absent: Normal, the deals above). */
const LEVEL = import.meta.main ? ((process.argv.find((a) => a.startsWith("--level="))?.slice(8) ?? null) as SwingLevel | null) : null;
if (LEVEL && (!BIG || !["easy", "hard", "expert"].includes(LEVEL))) throw new Error("--level must be easy, hard or expert, with --rev=18");
/** Courses a level's deal holds. */
export const SWING_LEVEL_DEAL_SIZE = 24;
export const swingLevelWitness = (level: SwingLevel) => new URL(`./fixtures/swing-level-${level}-witness.json.gz`, import.meta.url);
export const SWING_LEVEL_DEAL_FILE = new URL("../src/lib/duel/swingLevelDeal.server.ts", import.meta.url);
const OUT = LEVEL ? SWING_LEVEL_DEAL_FILE : new URL(BIG ? "../src/lib/duel/swingBigDeal.server.ts" : "../src/lib/duel/swingSlideDeal.server.ts", import.meta.url);
const WITNESS = LEVEL ? swingLevelWitness(LEVEL) : BIG ? SWING_BIG_WITNESS : SWING_SLIDE_WITNESS;
const DEAL_SIZE = LEVEL ? SWING_LEVEL_DEAL_SIZE : SWING_SLIDE_DEAL_SIZE;
const WORKERS = 4;
const BATCH = 8;

/** The candidate sequence: a hash of 0, 1, 2 … into 1 … 2^31 − 2 (as roomSeed). */
export function swingSlideCandidate(n: number): number {
  let x = (n + 1) * 0x3a8f05c5;
  x = Math.imul(x ^ (x >>> 16), 0x297a2d39);
  x = Math.imul(x ^ (x >>> 15), 0x9e3779b1);
  x ^= x >>> 16;
  return ((x >>> 0) % 0x7ffffffe) + 1;
}

type Ev = ArcadeInputEvent;
export type SwingWitness = { seed: number; tries: number; events: Ev[] };

/** The phone's submission for a log on swingRev 17: steps the sim, takes checkpoints, encodes. */
export function swingSlideSubmission(seed: number, events: readonly Ev[], rev = SWING_REV_SLIDE, level?: SwingLevel | null): string {
  const game = swingGameFor(rev, level ?? undefined);
  const byT = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed) as SwingState;
  const checkpoints: unknown[] = [];
  while (!game.isOver(s)) {
    s = game.step(s, byT.get(s.tick + 1) ?? null) as SwingState;
    if (s.tick % SWING_CHECKPOINT_INTERVAL === 0) checkpoints.push(swingCheckpoint(s));
  }
  return encodeSwingRun({ seed, claimedScore: game.score(s), events: [...events], inputs: [], taps: [], endTick: s.tick, checkpoints } as never);
}

/** The server's verdict on a log: its stored score, whether flagged, and the parts. */
export function swingSlideVerdict(seed: number, events: readonly Ev[], rev = SWING_REV_SLIDE, level?: SwingLevel | null) {
  const r = replaySwingRun(seed, swingSlideSubmission(seed, events, rev, level), rev, undefined, level ?? undefined);
  return { score: r.score, flagged: Boolean(r.flagged), parts: swingSlideParts(r.state) };
}

/** The oracle on one candidate: the first of its tries that the server scores exactly 200, or null. */
async function oracle(seed: number): Promise<SwingWitness | null> {
  const { Human } = await import("./arcade-skill-bands/human");
  const { bot } = await import("./arcade-skill-bands/bots/swing");
  const game = swingGameFor(REV, LEVEL ?? undefined);
  for (let v = 0; v < SWING_SLIDE_ORACLE_TRIES; v++) {
    const human = new Human("swing", (seed + v * 7919) | 0, "perfect" as never);
    let events: Ev[];
    try {
      events = (bot({ game, seed, rev: REV, human } as never).events ?? []) as Ev[];
    } catch {
      // (A level's course the builder could not prove from this seed: dropped.)
      return null;
    }
    const verdict = swingSlideVerdict(seed, events, REV, LEVEL);
    if (verdict.score === 200 && !verdict.flagged) return { seed, tries: v + 1, events };
  }
  return null;
}

function readWitnesses(): SwingWitness[] {
  return (JSON.parse(gunzipSync(readFileSync(WITNESS)).toString()) as { witnesses: SwingWitness[] }).witnesses;
}

/** The written deal's seeds. */
function readDeal(): number[] {
  if (LEVEL) return readLevelDeals()[LEVEL] ?? [];
  const text = readFileSync(OUT, "utf8");
  const body = text.slice(text.indexOf("= [") + 2);
  return JSON.parse(body.slice(0, body.indexOf("]") + 1)) as number[];
}

/** Every level's recorded drop count in the level deal file's comment (none yet: empty). */
function readLevelCounts(): Partial<Record<SwingLevel, string>> {
  if (!existsSync(SWING_LEVEL_DEAL_FILE)) return {};
  const out: Partial<Record<SwingLevel, string>> = {};
  for (const m of readFileSync(SWING_LEVEL_DEAL_FILE, "utf8").matchAll(/^ \* (easy|hard|expert): (.*)\.$/gm)) out[m[1] as SwingLevel] = m[2]!;
  return out;
}

/** Every level's written deal (none yet: empty). */
function readLevelDeals(): Partial<Record<SwingLevel, number[]>> {
  if (!existsSync(SWING_LEVEL_DEAL_FILE)) return {};
  const m = /SWING_LEVEL_DEAL: [^=]*=\s*(\{[^;]*\});/.exec(readFileSync(SWING_LEVEL_DEAL_FILE, "utf8"));
  return m ? (JSON.parse(m[1]!) as Partial<Record<SwingLevel, number[]>>) : {};
}

if (import.meta.main) {
  const workerArg = process.argv.find((a) => a.startsWith("--worker="));
  if (workerArg) {
    // A worker: candidates n with n % WORKERS === k, from `--from` to `--to`, one JSON line each to `--out`.
    const k = Number(workerArg.slice(9));
    const from = Number(process.argv.find((a) => a.startsWith("--from="))!.slice(7));
    const to = Number(process.argv.find((a) => a.startsWith("--to="))!.slice(5));
    const out = process.argv.find((a) => a.startsWith("--out="))!.slice(6);
    for (let n = from + k; n < to; n += WORKERS) {
      const seed = swingSlideCandidate(n);
      const w = await oracle(seed);
      appendFileSync(out, `${JSON.stringify({ n, seed, witness: w })}\n`);
    }
    process.exit(0);
  }
  if (process.argv.includes("--check")) {
    const deal = readDeal();
    const witnesses = readWitnesses();
    let bad = 0;
    if (witnesses.length !== deal.length || witnesses.some((w, i) => w.seed !== deal[i])) {
      console.log("FAIL: the deal is not exactly the witnessed seeds in order");
      bad++;
    }
    for (const w of witnesses) {
      const v = swingSlideVerdict(w.seed, w.events, REV, LEVEL);
      if (v.score !== 200 || v.flagged) {
        console.log(`FAIL: seed ${w.seed}: its witness scores ${v.score}${v.flagged ? " (flagged)" : ""}`);
        bad++;
      }
    }
    console.log(bad ? `FAIL swing-slide-deal: ${bad} problem(s)` : `ok: ${witnesses.length} dealt courses, each witness exactly 200 through the server replay`);
    process.exit(bad ? 1 : 0);
  }
  // Batches of candidates over WORKERS processes until SWING_SLIDE_DEAL_SIZE are kept, in candidate order.
  const results = new Map<number, { seed: number; witness: SwingWitness | null }>();
  let next = 0;
  const kept = () => {
    const out: SwingWitness[] = [];
    let dropped = 0;
    for (let n = 0; results.has(n) && out.length < DEAL_SIZE; n++) {
      const r = results.get(n)!;
      if (r.witness) out.push(r.witness);
      else dropped++;
    }
    return { out, dropped };
  };
  while (kept().out.length < DEAL_SIZE) {
    const want = DEAL_SIZE - kept().out.length;
    const to = next + Math.max(BATCH, Math.ceil(want * 3.2));
    const tmp = `/tmp/swing-slide-deal-${REV}-${process.pid}.jsonl`;
    // One file a worker (long lines appended by several processes to one file can interleave).
    const tmpOf = (k: number) => `${tmp}.${k}`;
    for (let k = 0; k < WORKERS; k++) if (existsSync(tmpOf(k))) unlinkSync(tmpOf(k));
    await Promise.all(
      Array.from({ length: WORKERS }, (_, k) => new Promise<void>((resolve, reject) => {
        const child = spawn("bun", [new URL(import.meta.url).pathname, `--rev=${REV}`, ...(LEVEL ? [`--level=${LEVEL}`] : []), `--worker=${k}`, `--from=${next}`, `--to=${to}`, `--out=${tmpOf(k)}`], { stdio: "inherit" });
        child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`worker ${k} exited ${code}`))));
      })),
    );
    for (let k = 0; k < WORKERS; k++) {
      if (!existsSync(tmpOf(k))) continue;
      for (const line of readFileSync(tmpOf(k), "utf8").trim().split("\n").filter(Boolean)) {
        const r = JSON.parse(line) as { n: number; seed: number; witness: SwingWitness | null };
        results.set(r.n, { seed: r.seed, witness: r.witness });
      }
      unlinkSync(tmpOf(k));
    }
    next = to;
    console.log(`candidates 0–${to - 1}: ${kept().out.length} kept so far`);
  }
  const { out, dropped } = kept();
  const tried = out.length + dropped;
  const byTries = [1, 2, 3].slice(0, SWING_SLIDE_ORACLE_TRIES).map((t) => out.filter((w) => w.tries === t).length);
  if (LEVEL) {
    // A level: its own witnesses first (so nothing built is lost), then its list in the one level deal file (the other
    // levels' lists kept).
    writeFileSync(WITNESS, gzipSync(JSON.stringify({ note: `Grappler swingRev 18 ${LEVEL} deal witnesses (scripts/swing-slide-deal.ts --rev=18 --level=${LEVEL}): each seed's oracle log, exactly 200 through the server replay at the level`, witnesses: out })));
    const deals = { ...readLevelDeals(), [LEVEL]: out.map((w) => w.seed) };
    const counts = { ...readLevelCounts(), [LEVEL]: `${dropped} of the first ${tried} candidates dropped` };
    const order = (["easy", "hard", "expert"] as const).filter((l) => deals[l]);
    writeFileSync(
      SWING_LEVEL_DEAL_FILE,
      `/**
 * Grappler's difficulty levels' deals (swingRev 18; built by \`bun scripts/swing-slide-deal.ts --rev=18 --level=<level>\`,
 * do not edit): ${DEAL_SIZE} course seeds a level, each proved at its level: the oracle (the flawless-level skill-band bot)
 * plays the course built from the seed at the level and its log replays through replaySwingRun at that level to exactly
 * 200 (witnesses in scripts/fixtures/swing-level-<level>-witness.json.gz).
${order.map((l) => ` * ${l}: ${counts[l]}.`).join("\n")}
 */
import type { SwingLevel } from "@/lib/arcade/swing";

export const SWING_LEVEL_DEAL: Readonly<Record<SwingLevel, readonly number[]>> = ${JSON.stringify(Object.fromEntries(order.map((l) => [l, deals[l]])))};

/** The course a room seed deals at a level on swingRev 18. */
export function swingLevelDealSeed(level: SwingLevel, roomSeed: number): number {
  const list = SWING_LEVEL_DEAL[level];
  const n = list.length;
  return list[((Math.trunc(roomSeed) % n) + n) % n]!;
}
`,
    );
    console.log(`wrote ${out.length} ${LEVEL} seeds; ${dropped} of the first ${tried} candidates dropped`);
    process.exit(0);
  }
  const NAME = BIG ? "SWING_BIG_DEAL" : "SWING_SLIDE_DEAL";
  const FN = BIG ? "swingBigDealSeed" : "swingSlideDealSeed";
  writeFileSync(
    OUT,
    `/**
 * Grappler's deal (swingRev ${REV}; built by \`bun scripts/swing-slide-deal.ts${BIG ? " --rev=18" : ""}\`, do not edit): ${SWING_SLIDE_DEAL_SIZE} course
 * seeds, each proved on swingRev ${REV}: the oracle (the flawless-level skill-band bot, scripts/swing-slide-deal.ts) plays the
 * course built from the seed and its log replays through replaySwingRun to exactly 200 (witnesses in
 * scripts/fixtures/${BIG ? "swing-big-deal-witness" : "swing-slide-deal-witness"}.json.gz). ${dropped} candidate${dropped === 1 ? "" : "s"} of the first ${tried} dropped
 * (${out.length} kept).
 */
export const ${NAME}: readonly number[] = ${JSON.stringify(out.map((w) => w.seed))};

/** The course a room seed deals on swingRev ${REV}. */
export function ${FN}(roomSeed: number): number {
  const n = ${NAME}.length;
  return ${NAME}[((Math.trunc(roomSeed) % n) + n) % n]!;
}
`,
  );
  writeFileSync(WITNESS, gzipSync(JSON.stringify({ note: `Grappler swingRev ${REV} deal witnesses (scripts/swing-slide-deal.ts${BIG ? " --rev=18" : ""}): each seed's oracle log, exactly 200 through the server replay`, witnesses: out })));
  console.log(`wrote ${out.length} seeds; ${dropped} of the first ${tried} candidates dropped; oracle tries per kept course ${byTries.join(" / ")}`);
}
