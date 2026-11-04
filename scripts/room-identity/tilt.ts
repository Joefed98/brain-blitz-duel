/**
 * Room identity for Tilt tiltRev 8 (docs/expansions/x200-tilt.md), tiltRev 10 (29 Oct 2026: four mazes, no quick
 * stars), tiltRev 11 (3 Nov 2026: tiltRev 10's mazes with no gold stars, each with a par fixed from
 * the maze) and, since 3 Nov 2026, the dealt tiltRev 12 (tiltRev 11 with bigger marbles and keys): everything a run meets is dealt from the seed when the mazes are built (the mazes, their
 * holes, ice, keys and gates, gold and quick stars, the pars and each quick star's window), never from how anyone
 * plays. `scheduleOf` replays a log on the new stamp and lists, for every maze the run reached, each seeded item with
 * its place; `t` is the maze's index × 100,000 plus the ticks into that maze (0 for what is there from the maze's
 * start; a quick star's entry is the tick its full-points window ends), so two runs agree entry for entry over the
 * mazes both reached.
 */
import { tiltCheckpoint, tiltGameFor, TILT_CHECKPOINT_INTERVAL, TILT_INPUT_DRAG, TILT_REV_BIG, TILT_X_QUICK_TAIL, type Maze, type TiltState } from "../../src/lib/arcade/tilt";
import type { ArcadeInputEvent } from "../../src/lib/arcade/engine";
import { bot } from "../arcade-skill-bands/bots/tilt";
import { Human } from "../arcade-skill-bands/human";

type Ev = ArcadeInputEvent;
const MAZE_T = 100_000;

function mazeItems(m: Maze, level: number): { t: number; what: string }[] {
  const at = level * MAZE_T;
  const out: { t: number; what: string }[] = [];
  out.push({ t: at, what: `maze ${level + 1}: ${m.n}×${m.n}, start ${m.start}, blue cup ${m.exit}/${m.exitDir}, par ${m.par}, ball ${m.br}${m.keyReach ? `, key reach ${m.keyReach}` : ""}` });
  if ((m.start2 ?? -1) >= 0) out.push({ t: at, what: `maze ${level + 1}: amber start ${m.start2}, amber cup ${m.exit2}/${m.exitDir2}` });
  for (const p of m.pits) out.push({ t: at, what: `maze ${level + 1}: black hole ${p}` });
  (m.stars ?? []).forEach((c, k) => out.push({ t: at, what: `maze ${level + 1}: gold star ${c} at ${m.starXY?.[2 * k]},${m.starXY?.[2 * k + 1]}` }));
  (m.keys ?? []).forEach((c, k) => out.push({ t: at, what: `maze ${level + 1}: key ${c}, gate ${m.gates?.[2 * k]}/${m.gates?.[2 * k + 1]}` }));
  out.push({ t: at, what: `maze ${level + 1}: ice ${(m.ice ?? []).map((v, c) => (v ? c : -1)).filter((c) => c >= 0).join(",")}` });
  (m.quick ?? []).forEach((c, k) => {
    out.push({ t: at + (m.quickAt?.[k] ?? 0), what: `maze ${level + 1}: quick star ${c} full points until +${m.quickAt?.[k]}` });
    out.push({ t: at + (m.quickAt?.[k] ?? 0) + TILT_X_QUICK_TAIL, what: `maze ${level + 1}: quick star ${c} gone` });
  });
  return out;
}

/** Replays `events` on tiltRev `rev` and lists every seeded item of each maze the run reached. */
export function scheduleOf(seed: number, rev: number, events: unknown): { t: number; what: string }[] {
  const game = tiltGameFor(rev);
  const byTick = new Map((events as Ev[]).map((e) => [e.t, e]));
  let s = game.init(seed) as TiltState;
  const seen = new Set<number>([0]);
  const out = mazeItems(s.list[0]!, 0);
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null) as TiltState;
    if (!seen.has(s.level)) {
      seen.add(s.level);
      out.push(...mazeItems(s.list[s.level]!, s.level));
    }
  }
  return out.sort((a, b) => a.t - b.t || (a.what < b.what ? -1 : a.what > b.what ? 1 : 0));
}

/** Uniformly random drags at a human-ish rate (a re-grip now and then), as the phone records them. */
export function randomLog(seed: number, rev: number = TILT_REV_BIG): Ev[] {
  const game = tiltGameFor(rev);
  let s = game.init(seed) as TiltState;
  let v = seed | 0;
  let x = 220;
  let touch = 0;
  const events: Ev[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    v = (Math.imul(v, 1103515245) + 12345) | 0;
    let input: Ev | null = null;
    if ((v >>> 8) % 3 === 0) {
      x += ((v >>> 12) % 25) - 12;
      if (x < 10 || x > 430 || (v >>> 20) % 90 === 0) {
        x = 60 + ((v >>> 4) % 320);
        touch = (touch + 1) % 256;
      }
      input = { t: s.tick + 1, k: TILT_INPUT_DRAG, a: x, b: 0, c: touch, d: 0 };
      events.push(input);
    }
    s = game.step(s, input) as TiltState;
  }
  return events;
}

/** A skill-band bot's log at a level (the bots in scripts/arcade-skill-bands/bots/tilt.ts). */
/** `rev` is the stamp the logs are played on (the dealt one by default; tilt-expand-check asks for tiltRev 9's, tiltRev 8's play). */
export function botLog(seed: number, level: "weak" | "average" | "elite", rev: number = TILT_REV_BIG): Ev[] {
  return bot({ game: tiltGameFor(rev), seed, rev, human: new Human("tilt", seed, level) }).events ?? [];
}

/** Idle, random, weak and elite logs played on `rev`. */
export function logsFor(seed: number, rev: number): Ev[][] {
  return [[], randomLog(seed, rev), botLog(seed, "weak", rev), botLog(seed, "elite", rev)];
}

export const roomIdentity = {
  type: "tilt",
  rev: TILT_REV_BIG,
  scheduleOf,
  logs: (seed: number): Ev[][] => logsFor(seed, TILT_REV_BIG),
};

/** Checkpoints for a log (the encode step needs them; kept here so callers can build a phone-shaped run). */
export function checkpointsOf(seed: number, events: Ev[]): unknown[] {
  const game = tiltGameFor(TILT_REV_BIG);
  const byTick = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed) as TiltState;
  const out: unknown[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null) as TiltState;
    if (s.tick % TILT_CHECKPOINT_INTERVAL === 0) out.push(tiltCheckpoint(s));
  }
  return out;
}
