/**
 * Builds Crazy Golf golfRev 3's hole bank (the Crazy Golf overhaul, 15 Nov 2026): every hole in the catalogue
 * (src/lib/arcade/minigolfHolesV3.ts: each template's tees × cups × mirror) searched by the shot oracle
 * (scripts/minigolf-oracle.ts bestRouteV3: putts and chips on the sim's clock), at each windmill speed the levels use
 * (slow on Easy, normal on Normal and Hard, fast on Expert; a hole without a windmill is searched once, its route the
 * same at every level). A hole is kept when every speed found a route with par (= the route's strokes + 1) from 2 to 5;
 * its witness (the route, and the tick it was proved from) goes to scripts/fixtures/minigolf-holes-witness.json.
 *
 * The bank (src/lib/duel/minigolfHolesBank.server.ts) lists the kept holes by slot with their pars per level. A course
 * is any five, one per slot; `playCourseV3` plays the five witnesses back to back (each first shot waiting for the
 * sails' repeat to line up with the tick it was proved from), and crazy-golf-v3-check proves composed courses at 200
 * on every level through the server's replay.
 *
 *   bun scripts/minigolf-holes-bank.ts [--jobs=4] [--check] [--repar]
 *
 * `--only=<template,…>` searches only those templates' holes and keeps every other hole's witnesses as stored.
 * `--repar` rewrites the bank's pars from the stored witnesses (after a change to MG_LEVELS' parOver) without searching.
 *
 * `--check` rebuilds and compares without writing. The search is deterministic, so a rebuild is byte for byte.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { recordInput, inputAt, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  minigolfCheckpoint,
  minigolfGameFor,
  MG_AIM,
  MG_INPUT_CHIP,
  MG_INPUT_PUTT,
  MG_LEVELS,
  MG_LEVEL_NAMES,
  MG_HOLE_PAUSE,
  MINIGOLF_HOLES,
  MINIGOLF_REV_COURSE,
  type MgLevel,
  type MinigolfState,
} from "../src/lib/arcade/minigolf";
import { buildHoleV3, holeIdsForSlot, V3_MILL_SPINS } from "../src/lib/arcade/minigolfHolesV3";
import { SPORTS_CHECKPOINT_INTERVAL, type SportsCheckpoint } from "../src/lib/arcade/sportsKit";
import { bestRouteV3, type Shot } from "./minigolf-oracle";

export const WITNESS_FILE = new URL("./fixtures/minigolf-holes-witness.json", import.meta.url);
const BANK_FILE = new URL("../src/lib/duel/minigolfHolesBank.server.ts", import.meta.url);
/** Every proof starts from this first playable tick; a route plays the same from any tick ≡ PROOF_TICK mod the sails' repeat. */
export const PROOF_TICK = 1;

/** A proved hole route: its shots ([k, a, b, c, w]), the tick the ball dropped (from PROOF_TICK) and its strokes. */
export interface HoleWitness {
  shots: [number, number, number, number, number][];
  holed: number;
}
/** Witness key: `${id}:${speed}`, or `${id}:any` for a hole without a windmill. */
export type WitnessFile = Record<string, HoleWitness>;

/** Witness key: the hole and the level it was proved at (each level builds its own hole: sails, extras, slopes). */
export function witnessKey(id: number, level: MgLevel): string {
  return `${id}:${level}`;
}

/** The sails' repeat for a level (ticks). */
export function millPeriodFor(level: MgLevel): number {
  return 16384 / V3_MILL_SPINS[MG_LEVELS[level].mill];
}

function proveHole(id: number): { id: number; slot: number; witness: Record<string, HoleWitness> } | { id: number; slot: number; dropped: string } {
  const slot = Math.floor(id / 100);
  const witness: Record<string, HoleWitness> = {};
  // Levels that build the same hole (same sails, extras and slopes) share one search.
  const done = new Map<string, HoleWitness>();
  for (const level of MG_LEVEL_NAMES) {
    const h = buildHoleV3(id, 0, level);
    const sig = JSON.stringify(h);
    let w = done.get(sig);
    if (!w) {
      const r = bestRouteV3(h, 4, 14, PROOF_TICK);
      if (!r) return { id, slot, dropped: `no route (${level})` };
      if (r.strokes > 4) return { id, slot, dropped: `best route ${r.strokes} (${level})` };
      w = { shots: (r.putts as Shot[]).map((p) => [p.k ?? MG_INPUT_PUTT, p.a, p.b, p.c, p.w ?? 0]), holed: r.holedTick! };
      done.set(sig, w);
    }
    witness[witnessKey(id, level)] = w;
  }
  return { id, slot, witness };
}

/**
 * A hole's witness time at a level, the worst it can take inside any course (ticks): from the hole's first playable tick
 * to its drop, plus a full sails' repeat for the first shot to line up (a hole with a windmill) and the pause to the next
 * tee. Five of these summed bound a composed witness's finish, so a deal whose sum fits the level's Speed time scores 200.
 */
export function witnessTicks(w: WitnessFile, id: number, level: MgLevel): number {
  const mill = (buildHoleV3(id, 0, level).windmills?.length ?? 0) > 0;
  return w[witnessKey(id, level)]!.holed - PROOF_TICK + 1 + (mill ? millPeriodFor(level) - 1 : 0) + MG_HOLE_PAUSE;
}

/** A hole's par at a level: its witness's strokes on Hard and Expert (the best route), + 2 on Easy and Normal (MG_LEVELS parOver). */
export function parOf(w: WitnessFile, id: number, level: MgLevel): number {
  return w[witnessKey(id, level)]!.shots.length + MG_LEVELS[level].parOver;
}

/**
 * Plays five holes' witnesses back to back on the real game (the phone's recording path), at `level`: each hole's first
 * shot waits for the sails to reach the moment its route was proved from (a tick ≡ PROOF_TICK mod the repeat; holes
 * without a windmill don't wait), every later shot its own wait after the ball rests.
 */
export function playCourseV3(holes: readonly number[], pars: readonly number[], level: MgLevel, w: WitnessFile): { events: ArcadeInputEvent[]; state: MinigolfState; checkpoints: SportsCheckpoint[] } {
  const game = minigolfGameFor(pars, MINIGOLF_REV_COURSE, { holes, level });
  const P = millPeriodFor(level);
  let s = game.init(1);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: SportsCheckpoint[] = [];
  let hole = -1;
  let next = 0;
  let aimSince = -1;
  let first = -1;
  while (!game.isOver(s)) {
    if (s.hole !== hole) {
      hole = s.hole;
      next = 0;
      first = -1;
    }
    const t = s.tick + 1;
    if (s.phase !== MG_AIM) aimSince = -1;
    else if (aimSince < 0) aimSince = s.tick;
    const wit = w[witnessKey(holes[s.hole]!, level)];
    if (s.phase === MG_AIM && wit && next < wit.shots.length) {
      const [k, a, b, c, wait] = wit.shots[next]!;
      let due = aimSince + 1 + wait;
      if (next === 0) {
        if (first < 0) {
          const ta = aimSince + 1;
          const mill = (s.course[s.hole]!.windmills?.length ?? 0) > 0;
          first = mill ? ta + ((((PROOF_TICK - ta) % P) + P) % P) : ta;
        }
        due = first + wait;
      }
      if (t >= due) {
        recordInput(events, { t, k, a, b, c, d: 0 }, game.inputRanges);
        next++;
        aimSince = -1;
      }
    }
    s = game.step(s, inputAt(events, t));
    if (s.tick % SPORTS_CHECKPOINT_INTERVAL === 0) checkpoints.push(minigolfCheckpoint(s));
  }
  return { events, state: s, checkpoints };
}

function bankBody(bySlot: { id: number; pars: number[]; t: number[] }[][], tried: number): string {
  const rows = bySlot
    .map((slot, i) => `  // Slot ${i + 1}: ${slot.length} holes.\n  [\n${slot.map((e) => `    { id: ${e.id}, pars: [${e.pars.join(", ")}], t: [${e.t.join(", ")}] },`).join("\n")}\n  ],`)
    .join("\n");
  const total = bySlot.reduce((a, s) => a + s.length, 0);
  return `/**
 * Crazy Golf golfRev 3's hole bank (the Crazy Golf overhaul, 15 Nov 2026): ${total} holes (of ${tried} in the catalogue,
 * src/lib/arcade/minigolfHolesV3.ts) whose route the shot oracle (scripts/minigolf-oracle.ts bestRouteV3: putts and
 * chips on the sim's clock) found at every windmill speed, by course slot. Each hole's pars are per level (Easy, Normal,
 * Hard, Expert): the best route's strokes + 2 on Easy and Normal (a birdie always possible), the best route itself on
 * Hard and Expert (holing in par earns the under-par bonus there); its witness routes are in
 * scripts/fixtures/minigolf-holes-witness.json, and any five (one per slot) played back to back score exactly 200
 * through the server's replay at every level (crazy-golf-v3-check). Built by \`bun scripts/minigolf-holes-bank.ts\`.
 * Server-only.
 */
export interface MinigolfHoleEntry {
  /** The hole's catalogue id (minigolfHolesV3.ts). */
  id: number;
  /** Par at Easy, Normal, Hard and Expert. */
  pars: readonly number[];
  /**
   * The witness's worst time in a course at each level (ticks; scripts/minigolf-holes-bank.ts witnessTicks): the deal
   * keeps a course's five within the level's Speed time, so its composed witness always scores 200.
   */
  t: readonly number[];
}

export const MINIGOLF_HOLES_BANK: readonly (readonly MinigolfHoleEntry[])[] = [
${rows}
];
`;
}

const args = process.argv.slice(2);
const JOBS = Number(args.find((a) => a.startsWith("--jobs="))?.slice(7) ?? 4);
const CHECK = args.includes("--check");
const ALL = [0, 1, 2, 3, 4].flatMap((slot) => holeIdsForSlot(slot));
const ONLY = args.find((a) => a.startsWith("--only="))?.slice(7).split(",").map(Number) ?? null;
/** The holes this run searches (all, or `--only`'s templates'). */
const SEARCH = ONLY ? ALL.filter((id) => ONLY.includes(Math.floor(id / 100))) : ALL;

if (import.meta.main && args.includes("--child")) {
  const part = Number(args.find((a) => a.startsWith("--part="))?.slice(7) ?? 0);
  for (let i = part; i < SEARCH.length; i += JOBS) console.log(JSON.stringify(proveHole(SEARCH[i]!)));
} else if (import.meta.main && args.includes("--repar")) {
  const witness = JSON.parse(readFileSync(WITNESS_FILE, "utf8")) as WitnessFile;
  const bySlot: { id: number; pars: number[]; t: number[] }[][] = [[], [], [], [], []];
  for (const id of ALL) {
    if (!MG_LEVEL_NAMES.every((lv) => witness[witnessKey(id, lv)])) continue;
    const slot = [0, 1, 2, 3, 4].find((s) => holeIdsForSlot(s).includes(id))!;
    bySlot[slot]!.push({ id, pars: MG_LEVEL_NAMES.map((lv) => parOf(witness, id, lv)), t: MG_LEVEL_NAMES.map((lv) => witnessTicks(witness, id, lv)) });
  }
  writeFileSync(BANK_FILE, bankBody(bySlot, ALL.length));
  console.log(`pars rewritten for ${bySlot.reduce((a, s) => a + s.length, 0)} holes`);
} else if (import.meta.main) {
  const started = Date.now();
  const outs = await Promise.all(
    Array.from({ length: JOBS }, async (_, part) => {
      const proc = Bun.spawn(["bun", new URL(import.meta.url).pathname, "--child", `--part=${part}`, `--jobs=${JOBS}`, ...(ONLY ? [`--only=${ONLY.join(",")}`] : [])], { stdout: "pipe", stderr: "inherit" });
      return await new Response(proc.stdout).text();
    }),
  );
  const results = outs
    .flatMap((o) => o.split("\n").filter((l) => l.startsWith("{")))
    .map((l) => JSON.parse(l) as ReturnType<typeof proveHole>)
    .sort((a, b) => a.id - b.id);
  const witness: WitnessFile = {};
  const bySlot: { id: number; pars: number[]; t: number[] }[][] = [[], [], [], [], []];
  if (ONLY) {
    // Every other hole keeps its stored witnesses; the searched ones are replaced below.
    const stored = JSON.parse(readFileSync(WITNESS_FILE, "utf8")) as WitnessFile;
    for (const [k, v] of Object.entries(stored)) if (!ONLY.includes(Math.floor(Number(k.split(":")[0]) / 100))) witness[k] = v;
    for (const id of ALL.filter((i) => !SEARCH.includes(i))) {
      if (!MG_LEVEL_NAMES.every((lv) => witness[witnessKey(id, lv)])) continue;
      const slot = [0, 1, 2, 3, 4].find((s) => holeIdsForSlot(s).includes(id))!;
      bySlot[slot]!.push({ id, pars: MG_LEVEL_NAMES.map((lv) => parOf(witness, id, lv)), t: MG_LEVEL_NAMES.map((lv) => witnessTicks(witness, id, lv)) });
    }
  }
  for (const r of results) {
    if ("dropped" in r) {
      console.log(`hole ${r.id}: dropped (${r.dropped})`);
      continue;
    }
    Object.assign(witness, r.witness);
    const slot = [0, 1, 2, 3, 4].find((s) => holeIdsForSlot(s).includes(r.id))!;
    bySlot[slot]!.push({ id: r.id, pars: MG_LEVEL_NAMES.map((lv) => parOf(witness, r.id, lv)), t: MG_LEVEL_NAMES.map((lv) => witnessTicks(witness, r.id, lv)) });
  }
  for (const slot of bySlot) slot.sort((a, b) => a.id - b.id);
  for (let i = 0; i < 5; i++) console.log(`slot ${i + 1}: ${bySlot[i]!.length} holes, pars ${[...new Set(bySlot[i]!.map((e) => e.pars[1]))].sort().join("/")}`);
  const sortedWitness = Object.fromEntries(Object.entries(witness).sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true })));
  const body = bankBody(bySlot, ALL.length);
  const wjson = JSON.stringify(sortedWitness) + "\n";
  if (CHECK) {
    const same = readFileSync(BANK_FILE, "utf8") === body && readFileSync(WITNESS_FILE, "utf8") === wjson;
    console.log(same ? "PASS: the hole bank rebuilds byte for byte" : "FAIL: the hole bank differs from a rebuild");
    process.exit(same ? 0 : 1);
  }
  writeFileSync(BANK_FILE, body);
  writeFileSync(WITNESS_FILE, wjson);
  console.log(`${ALL.length} holes searched in ${((Date.now() - started) / 1000).toFixed(0)} s; kept ${bySlot.reduce((a, s) => a + s.length, 0)}`);
}

export { MINIGOLF_HOLES, MG_INPUT_CHIP };
