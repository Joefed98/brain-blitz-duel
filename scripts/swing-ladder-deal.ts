/**
 * Builds Grappler's swingRev 19 deal (the ladder, D5 23 Nov 2026): src/lib/duel/swingLadderDeal.server.ts
 * (SWING_LADDER_DEAL) lists, for each level (Easy, Normal, Hard, Expert), SWING_LADDER_DEAL_SIZE[level] course seeds on
 * which the proof player scores exactly 200 through the server: the flawless skill-band level held to Joe's human limits
 * (0.25 s to react, 0.15 s to move; scripts/d5-ladder-lib.ts playDealt(type, puzzle, "perfect"),
 * scripts/arcade-skill-bands/bots/swingRework.ts), playing the course built from the seed at the level (the sim's own
 * builder, its planned route proved under the level's pterodactyl), its log graded by gradeAnswer on the puzzle the level
 * deals (swingRev 19, `level` off Normal), unflagged. Candidates come from scripts/swing-slide-deal.ts's fixed hashed
 * sequence (swingSlideCandidate(0, 1, 2 …)); one the builder can't prove or the proof player doesn't take to 200 is
 * dropped and counted. Each kept course's proof log is its witness (scripts/fixtures/swing-ladder-<level>-witness.json.gz).
 *
 *   bun scripts/swing-ladder-deal.ts --level=<l> [--workers=2] [--reuse=<bands.jsonl,…>]
 *       (writes the level's list, keeping the others', and its witnesses; `--reuse` takes proof logs already played by
 *        scripts/swing-ladder-bands.ts for the same candidates: each is regraded on today's code, so the result is the
 *        same as playing them again)
 *   bun scripts/swing-ladder-deal.ts --check [--level=<l>] [--live=<n>]
 *       (every stored witness exactly 200 through the server's grade, the deal exactly the witnessed seeds in order, and
 *        `--live` courses a level spread through the deal played again by the proof player: its log byte for byte the
 *        stored witness; ~1 min plus ~6 s a live course)
 *   bun scripts/swing-ladder-deal.ts --check --full [--level=<l>]
 *       (the whole build again from candidate 0, every candidate's proof run played: the deal and every witness byte for
 *        byte; ~6 s a candidate)
 */
import { appendFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { spawn } from "node:child_process";
import { SWING_REV_LADDER, type SwingLadderLevel } from "../src/lib/arcade/swing";
import { decodeSwingRun } from "../src/lib/duel/swing";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import type { PuzzleData } from "../src/lib/duel/types";
import { playDealt } from "./d5-ladder-lib";
import { swingSlideCandidate, swingSlideSubmission } from "./swing-slide-deal";

export const SWING_LADDER_LEVELS: readonly SwingLadderLevel[] = ["easy", "normal", "hard", "expert"];
/** Courses each level's deal holds. */
export const SWING_LADDER_DEAL_SIZE: Readonly<Record<SwingLadderLevel, number>> = { easy: 24, normal: 40, hard: 24, expert: 24 };
export const SWING_LADDER_DEAL_FILE = new URL("../src/lib/duel/swingLadderDeal.server.ts", import.meta.url);
export const swingLadderWitness = (level: SwingLadderLevel) => new URL(`./fixtures/swing-ladder-${level}-witness.json.gz`, import.meta.url);

/** A kept course: its candidate index, seed and the proof player's log ([t, k, a] a press). */
export interface LadderWitness { n: number; seed: number; events: number[][] }
export interface LadderWitnessFile { note: string; level: SwingLadderLevel; tried: number; dropped: number; witnesses: LadderWitness[] }

/** The puzzle a ladder level deals for a course seed (as generateSwing and generatePuzzle stamp it). */
export function ladderPuzzle(seed: number, level: SwingLadderLevel): PuzzleData {
  return { type: "swing", seed, swingRev: SWING_REV_LADDER, ...(level !== "normal" ? { level } : {}) } as unknown as PuzzleData;
}
const unpack = (packed: readonly number[][]) => packed.map(([t, k, a]) => ({ t: t!, k: k!, a: a!, b: 0, c: 0, d: 0 }));

/** The server's grade of a stored log on a course at a level. */
export function ladderGrade(seed: number, level: SwingLadderLevel, events: readonly number[][]): { score: number; flagged: boolean } {
  const raw = swingSlideSubmission(seed, unpack(events) as never, SWING_REV_LADDER, level === "normal" ? null : level);
  const graded = gradeAnswer(ladderPuzzle(seed, level), raw, 0);
  return { score: graded.score, flagged: Boolean((graded.extra as { flagged?: boolean } | undefined)?.flagged) };
}

/** The proof player on one candidate: its log when the server scores it exactly 200, else null (null too when the course can't be built). */
export async function ladderProof(seed: number, level: SwingLadderLevel): Promise<{ events: number[][]; score: number } | null> {
  let r;
  try {
    r = await playDealt("swing", ladderPuzzle(seed, level), "perfect");
  } catch {
    return null;
  }
  const events = decodeSwingRun(r.raw).events.map((e) => [e.t, e.k, e.a]);
  return { events, score: r.score };
}

export function readLadderWitnesses(level: SwingLadderLevel): LadderWitnessFile {
  return JSON.parse(gunzipSync(readFileSync(swingLadderWitness(level))).toString()) as LadderWitnessFile;
}

/** Every level's written deal and drop line (none yet: empty). */
function readDeals(): { deals: Partial<Record<SwingLadderLevel, number[]>>; counts: Partial<Record<SwingLadderLevel, string>> } {
  if (!existsSync(SWING_LADDER_DEAL_FILE)) return { deals: {}, counts: {} };
  const text = readFileSync(SWING_LADDER_DEAL_FILE, "utf8");
  const m = /SWING_LADDER_DEAL: [^=]*=\s*(\{[^;]*\});/.exec(text);
  const counts: Partial<Record<SwingLadderLevel, string>> = {};
  for (const c of text.matchAll(/^ \* (easy|normal|hard|expert): (.*)\.$/gm)) counts[c[1] as SwingLadderLevel] = c[2]!;
  let deals: Partial<Record<SwingLadderLevel, number[]>> = {};
  try {
    deals = m ? (JSON.parse(m[1]!) as Partial<Record<SwingLadderLevel, number[]>>) : {};
  } catch {
    // (A file not written by this script: none of its lists are kept.)
  }
  return { deals, counts };
}

function writeDeals(deals: Partial<Record<SwingLadderLevel, number[]>>, counts: Partial<Record<SwingLadderLevel, string>>): void {
  const order = SWING_LADDER_LEVELS.filter((l) => deals[l]);
  writeFileSync(
    SWING_LADDER_DEAL_FILE,
    `/**
 * Grappler's ladder deals (swingRev 19, D5 23 Nov 2026; built by \`bun scripts/swing-ladder-deal.ts --level=<level>\`, do not
 * edit): each level's course seeds, each proved at its level: the proof player (the flawless skill-band level held to Joe's
 * human limits, 0.25 s to react and 0.15 s to move) plays the course built from the seed at the level and the server's
 * grade of its log (gradeAnswer on the dealt puzzle) is exactly 200, unflagged (witnesses in
 * scripts/fixtures/swing-ladder-<level>-witness.json.gz; \`--check\` replays them).
${order.map((l) => ` * ${l}: ${counts[l]}.`).join("\n")}
 */
import type { SwingLadderLevel } from "@/lib/arcade/swing";

export const SWING_LADDER_DEAL: Readonly<Record<SwingLadderLevel, readonly number[]>> = ${JSON.stringify(Object.fromEntries(order.map((l) => [l, deals[l]])))};

/** The course a room seed deals at a ladder level on swingRev 19. */
export function swingLadderDealSeed(level: SwingLadderLevel, roomSeed: number): number {
  const list = SWING_LADDER_DEAL[level];
  const n = list.length;
  return list[((Math.trunc(roomSeed) % n) + n) % n]!;
}
`,
  );
}

/** Proof runs already played for this level's candidates (scripts/swing-ladder-bands.ts lines), by candidate index. */
function reused(files: readonly string[], level: SwingLadderLevel): Map<number, { seed: number; events: number[][] | null }> {
  const out = new Map<number, { seed: number; events: number[][] | null }>();
  for (const f of files) {
    for (const line of readFileSync(f, "utf8").trim().split("\n").filter(Boolean)) {
      const r = JSON.parse(line) as { n: number; seed: number; level: string; player: string; score: number | null; events?: number[][] };
      if (r.level !== level) continue;
      if (r.score === null) out.set(r.n, { seed: r.seed, events: null });
      else if (r.player === "proof" && r.events) out.set(r.n, { seed: r.seed, events: r.events });
    }
  }
  return out;
}

/** Builds a level's deal: candidates in order until its size is kept (worker processes for what isn't reused). */
async function build(level: SwingLadderLevel, workers: number, reuse: Map<number, { seed: number; events: number[][] | null }>): Promise<LadderWitnessFile> {
  const size = SWING_LADDER_DEAL_SIZE[level];
  const results = new Map<number, LadderWitness | null>();
  const take = (n: number, seed: number, events: number[][] | null) => {
    if (seed !== swingSlideCandidate(n)) throw new Error(`candidate ${n}: reused seed ${seed} is not the sequence's`);
    const ok = events && ((g) => g.score === 200 && !g.flagged)(ladderGrade(seed, level, events));
    results.set(n, ok ? { n, seed, events: events! } : null);
  };
  const kept = () => {
    const out: LadderWitness[] = [];
    let dropped = 0;
    let n = 0;
    for (; results.has(n) && out.length < size; n++) {
      const r = results.get(n)!;
      if (r) out.push(r);
      else dropped++;
    }
    return { out, dropped, complete: out.length >= size };
  };
  for (const [n, r] of reuse) take(n, r.seed, r.events);
  let next = 0;
  while (!kept().complete) {
    while (results.has(next)) next++;
    const want = size - kept().out.length;
    const to = next + Math.max(workers * 2, Math.ceil(want * 1.5));
    const todo: number[] = [];
    for (let n = next; n < to; n++) if (!results.has(n)) todo.push(n);
    const tmp = `/tmp/swing-ladder-deal-${level}-${process.pid}`;
    await Promise.all(
      Array.from({ length: workers }, (_, k) => new Promise<void>((resolve, reject) => {
        const mine = todo.filter((_, i) => i % workers === k);
        if (!mine.length) return resolve();
        const child = spawn("bun", [new URL(import.meta.url).pathname, `--level=${level}`, `--worker=${mine.join(",")}`, `--out=${tmp}.${k}`], { stdio: "inherit" });
        child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`worker ${k} exited ${code}`))));
      })),
    );
    for (let k = 0; k < workers; k++) {
      if (!existsSync(`${tmp}.${k}`)) continue;
      for (const line of readFileSync(`${tmp}.${k}`, "utf8").trim().split("\n").filter(Boolean)) {
        const r = JSON.parse(line) as { n: number; seed: number; events: number[][] | null };
        take(r.n, r.seed, r.events);
      }
      unlinkSync(`${tmp}.${k}`);
    }
    next = to;
    console.log(`${level}: candidates 0–${to - 1}: ${kept().out.length} kept so far`);
  }
  const { out, dropped } = kept();
  return { note: `Grappler swingRev 19 ${level} deal witnesses (scripts/swing-ladder-deal.ts --level=${level}): each kept candidate's proof-player log, exactly 200 through the server's grade at the level`, level, tried: out.length + dropped, dropped, witnesses: out };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const levelArg = opt("level") as SwingLadderLevel | undefined;
  if (levelArg && !SWING_LADDER_LEVELS.includes(levelArg)) throw new Error("--level must be easy, normal, hard or expert");
  const workerArg = opt("worker");
  if (workerArg !== undefined) {
    // A worker: the listed candidates' proof runs, one JSON line each to `--out`.
    for (const n of workerArg.split(",").map(Number)) {
      const seed = swingSlideCandidate(n);
      const p = await ladderProof(seed, levelArg!);
      appendFileSync(opt("out")!, `${JSON.stringify({ n, seed, events: p ? p.events : null })}\n`);
    }
    process.exit(0);
  }
  const workers = Number(opt("workers") ?? 2);
  if (args.includes("--check")) {
    let bad = 0;
    const { deals } = readDeals();
    for (const level of levelArg ? [levelArg] : SWING_LADDER_LEVELS) {
      const file = readLadderWitnesses(level);
      const deal = deals[level] ?? [];
      if (file.witnesses.length !== SWING_LADDER_DEAL_SIZE[level] || deal.length !== file.witnesses.length || file.witnesses.some((w, i) => w.seed !== deal[i] || w.seed !== swingSlideCandidate(w.n))) {
        console.log(`FAIL ${level}: the deal is not exactly the ${SWING_LADDER_DEAL_SIZE[level]} witnessed candidates in order`);
        bad++;
      }
      for (const w of file.witnesses) {
        const g = ladderGrade(w.seed, level, w.events);
        if (g.score !== 200 || g.flagged) {
          console.log(`FAIL ${level}: seed ${w.seed}: its witness scores ${g.score}${g.flagged ? " (flagged)" : ""}`);
          bad++;
        }
      }
      const live = Number(opt("live") ?? 0);
      for (let i = 0; i < live; i++) {
        const w = file.witnesses[Math.floor(((i + 0.5) * file.witnesses.length) / live)]!;
        const p = await ladderProof(w.seed, level);
        if (!p || JSON.stringify(p.events) !== JSON.stringify(w.events) || p.score !== 200) {
          console.log(`FAIL ${level}: seed ${w.seed}: the proof player's run today is not its stored witness`);
          bad++;
        }
      }
      if (args.includes("--full")) {
        const again = await build(level, workers, new Map());
        if (JSON.stringify(again) !== JSON.stringify(file)) {
          console.log(`FAIL ${level}: the rebuilt deal and witnesses differ from the stored ones`);
          bad++;
        }
      }
      console.log(`${level}: ${file.witnesses.length} courses (${file.dropped} of the first ${file.tried} candidates dropped), each witness exactly 200${live ? `, ${live} played again by the proof player` : ""}${args.includes("--full") ? ", rebuilt byte for byte" : ""}`);
    }
    console.log(bad ? `FAIL swing-ladder-deal: ${bad} problem(s)` : "ok: swing-ladder-deal");
    process.exit(bad ? 1 : 0);
  }
  if (!levelArg) throw new Error("--level=<easy|normal|hard|expert> (or --check)");
  const reuse = reused((opt("reuse") ?? "").split(",").filter(Boolean), levelArg);
  const file = await build(levelArg, workers, reuse);
  writeFileSync(swingLadderWitness(levelArg), gzipSync(JSON.stringify(file)));
  const { deals, counts } = readDeals();
  writeDeals({ ...deals, [levelArg]: file.witnesses.map((w) => w.seed) }, { ...counts, [levelArg]: `${file.witnesses.length} courses; ${file.dropped} of the first ${file.tried} candidates dropped` });
  console.log(`wrote ${file.witnesses.length} ${levelArg} seeds; ${file.dropped} of the first ${file.tried} candidates dropped`);
}
