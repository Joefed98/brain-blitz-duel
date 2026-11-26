/**
 * Grappler swingRev 19's ladder, measured on candidate courses (a tool, not a check; D5, 23 Nov 2026): for each
 * candidate of scripts/swing-slide-deal.ts's sequence (swingSlideCandidate(n)) at a level, the D5 ladder's players
 * (scripts/d5-ladder-lib.ts playDealt: the average and elite skill-band bots and the proof player, the flawless level, all
 * under Joe's human limits) play the course built at the level, graded by the server (gradeAnswer on the puzzle). Each
 * run's line holds what the score is made of, stretch by stretch (each cleared stretch's par as built, before the level's
 * `parLater`, and the time it took), so the par lines can be weighed afterwards without playing again (`--table`).
 *
 *   bun scripts/swing-ladder-bands.ts --level=<l> [--from=0] [--to=24] [--players=average,elite,proof] [--workers=2] --out=<file.jsonl>
 *   bun scripts/swing-ladder-bands.ts --table <file.jsonl…> [--par=<level>:<ticks>,…] [--gates=…] [--streak=…] [--cap=…] [--parfull=…] [--full=…]
 *       (each line per level, e.g. --cap=expert:150; unset ones the sim's SWING_V19_LEVELS)
 */
import { appendFileSync, existsSync, readFileSync, unlinkSync } from "node:fs";
import { spawn } from "node:child_process";
import { SWING_REV_LADDER, SWING_V15_PAR_FULL, SWING_V17_CORE, SWING_V17_GATES, SWING_V17_GATE_POINTS, SWING_V17_PAR_POINTS, SWING_V17_PAR_STRETCHES, SWING_V17_STREAK_MAX, SWING_V19_LEVELS, swingAssaultPar, swingSlideParts, type SwingLadderLevel } from "../src/lib/arcade/swing";
import { decodeSwingRun, replaySwingRun } from "../src/lib/duel/swing";
import type { PuzzleData } from "../src/lib/duel/types";
import { playDealt, type D5Bot } from "./d5-ladder-lib";
import { swingSlideCandidate } from "./swing-slide-deal";

export interface BandRun {
  n: number;
  seed: number;
  level: SwingLadderLevel;
  player: D5Bot;
  /** The server's score (null: the course could not be built from this seed). */
  score: number | null;
  core?: number;
  par?: number;
  gates?: number;
  streak?: number;
  permille?: number;
  gatesLit?: number;
  streakPaid?: number;
  caught?: number;
  restarts?: number;
  /** Each cleared stretch's [built par, ticks taken]. */
  stretches?: [number, number][];
  /** The run's log ([t, k, a] a press), kept so a deal (the proof player's) or the ladder's table can be built from it. */
  events?: number[][];
}

const SKILL: Record<D5Bot, "average" | "elite" | "perfect"> = { average: "average", elite: "elite", proof: "perfect" };

/** The puzzle a ladder level deals for a course seed. */
export function ladderPuzzle(seed: number, level: SwingLadderLevel): PuzzleData {
  return { type: "swing", seed, swingRev: SWING_REV_LADDER, ...(level !== "normal" ? { level } : {}) } as unknown as PuzzleData;
}

/** One player's run on a course at a level, graded by the server, with what its score is made of. */
export async function bandRun(n: number, seed: number, level: SwingLadderLevel, player: D5Bot): Promise<BandRun> {
  const puzzle = ladderPuzzle(seed, level);
  let r;
  try {
    r = await playDealt("swing", puzzle, SKILL[player]);
  } catch {
    return { n, seed, level, player, score: null };
  }
  const s = replaySwingRun(seed, r.raw, SWING_REV_LADDER, undefined, level).state;
  const parts = swingSlideParts(s);
  const lad = SWING_V19_LEVELS[level];
  const stretches: [number, number][] = [];
  (s.sections ?? []).forEach((_, k) => {
    const q = swingAssaultPar(s, k);
    if (q.time >= 0) stretches.push([q.par - lad.parLater, q.time]);
  });
  const events = decodeSwingRun(r.raw).events.map((e) => [e.t, e.k, e.a]);
  return { n, seed, level, player, events, score: r.score, core: parts.core, par: parts.par, gates: parts.gates, streak: parts.streak, permille: parts.permille, gatesLit: Math.trunc(parts.gates / SWING_V17_GATE_POINTS), streakPaid: s.streakPaid ?? 0, caught: s.caught ?? 0, restarts: s.restarts ?? 0, stretches };
}

/** A run's score under other lines: the par moved by `parLater`, the gates full at `gatesFull`, the course at `full`. */
export function rescore(r: BandRun, line: { parLater: number; gatesFull: number; full: number; streakFull: number; parCap: number; parFull: number }, measuredFull: number): number {
  if (r.score === null) return 0;
  const parTicks = (r.stretches ?? []).reduce((sum, [par, t]) => sum + Math.max(0, Math.min(line.parCap, par + line.parLater - t)), 0);
  const par = Math.min(SWING_V17_PAR_POINTS, Math.trunc((SWING_V17_PAR_POINTS * parTicks) / line.parFull));
  const gates = Math.min(SWING_V17_GATE_POINTS * SWING_V17_GATES, Math.trunc((SWING_V17_GATE_POINTS * SWING_V17_GATES * (r.gatesLit ?? 0)) / line.gatesFull));
  const core = Math.max(r.core! > 0 ? 1 : 0, Math.trunc((SWING_V17_CORE * Math.min(r.permille!, line.full)) / line.full));
  void measuredFull;
  const streak = Math.min(SWING_V17_STREAK_MAX, Math.trunc((SWING_V17_STREAK_MAX * (r.streakPaid ?? 0)) / line.streakFull));
  return Math.max(1, Math.min(200, core + par + gates + streak));
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (args.includes("--table")) {
    const files = args.filter((a) => !a.startsWith("--"));
    const runs = files.flatMap((f) => readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as BandRun));
    const pick = (spec: string | undefined, fallback: (lv: SwingLadderLevel) => number) => {
      const m = new Map((spec ?? "").split(",").filter(Boolean).map((t) => t.split(":") as [string, string]));
      return (lv: SwingLadderLevel) => (m.has(lv) ? Number(m.get(lv)) : fallback(lv));
    };
    const parOf = pick(opt("par"), (lv) => SWING_V19_LEVELS[lv].parLater);
    const gatesOf = pick(opt("gates"), (lv) => SWING_V19_LEVELS[lv].gatesFull);
    const fullOf = pick(opt("full"), (lv) => SWING_V19_LEVELS[lv].full);
    const streakOf = pick(opt("streak"), (lv) => SWING_V19_LEVELS[lv].streakFull);
    const capOf = pick(opt("cap"), (lv) => SWING_V19_LEVELS[lv].parCap);
    const parFullOf = pick(opt("parfull"), (lv) => SWING_V19_LEVELS[lv].parFull);
    for (const level of ["easy", "normal", "hard", "expert"] as SwingLadderLevel[]) {
      const at = runs.filter((r) => r.level === level && r.score !== null);
      if (!at.length) continue;
      const line = { parLater: parOf(level), gatesFull: gatesOf(level), full: fullOf(level), streakFull: streakOf(level), parCap: capOf(level), parFull: parFullOf(level) };
      const seeds = [...new Set(at.map((r) => r.seed))];
      const proofOk = new Set(seeds.filter((s) => at.some((r) => r.seed === s && r.player === "proof" && rescore(r, line, 0) === 200)));
      const out: string[] = [`${level.padEnd(7)} par ${line.parLater} gates ${line.gatesFull} full ${line.full} streak ${line.streakFull} pars ${line.parCap}/${line.parFull}: ${seeds.length} courses, proof 200 on ${proofOk.size}`];
      for (const player of ["average", "elite", "proof"] as D5Bot[]) {
        for (const dealt of [false, true]) {
          const rs = at.filter((r) => r.player === player && (!dealt || proofOk.has(r.seed)));
          if (!rs.length) continue;
          const sc = rs.map((r) => rescore(r, line, 0));
          const mean = sc.reduce((a, b) => a + b, 0) / sc.length;
          out.push(`  ${player.padEnd(8)}${dealt ? " dealt" : " all  "} n ${String(rs.length).padStart(3)}  mean ${mean.toFixed(1).padStart(6)}  at200 ${((100 * sc.filter((x) => x >= 200).length) / sc.length).toFixed(0).padStart(3)}%  caught ${(rs.reduce((a, r) => a + (r.caught ?? 0), 0) / rs.length).toFixed(1)}`);
        }
      }
      console.log(out.join("\n"));
    }
    process.exit(0);
  }
  const level = (opt("level") ?? "normal") as SwingLadderLevel;
  const from = Number(opt("from") ?? 0);
  const to = Number(opt("to") ?? 24);
  const players = (opt("players") ?? "average,elite,proof").split(",") as D5Bot[];
  const out = opt("out")!;
  const workers = Number(opt("workers") ?? 1);
  const worker = opt("worker");
  if (worker !== undefined || workers === 1) {
    const k = Number(worker ?? 0);
    const step = worker !== undefined ? workers : 1;
    for (let n = from + k; n < to; n += step) {
      const seed = swingSlideCandidate(n);
      // The proof player first: a course it can't take to every part's full but the pars' (whatever the par line) is
      // never dealt, so the other players skip it (`--all` plays them anyway).
      for (const p of [...players].sort((a, b) => (a === "proof" ? -1 : b === "proof" ? 1 : 0))) {
        const r = await bandRun(n, seed, level, p);
        appendFileSync(`${out}${worker !== undefined ? `.${k}` : ""}`, JSON.stringify(r) + "\n");
        if (r.score === null) break;
        if (p === "proof" && !args.includes("--all") && (r.core! < SWING_V17_CORE || r.gatesLit! < 4 || r.streakPaid! < 18)) break;
      }
    }
    process.exit(0);
  }
  await Promise.all(
    Array.from({ length: workers }, (_, k) => new Promise<void>((resolve, reject) => {
      const child = spawn("bun", [new URL(import.meta.url).pathname, `--level=${level}`, `--from=${from}`, `--to=${to}`, `--players=${players.join(",")}`, `--out=${out}`, `--workers=${workers}`, `--worker=${k}`, ...(args.includes("--all") ? ["--all"] : [])], { stdio: "inherit" });
      child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`worker ${k} exited ${code}`))));
    })),
  );
  for (let k = 0; k < workers; k++) {
    const f = `${out}.${k}`;
    if (!existsSync(f)) continue;
    appendFileSync(out, readFileSync(f, "utf8"));
    unlinkSync(f);
  }
}
