/**
 * Room identity for Minesweeper minesRev 1 (Cards & Board, 30 Oct 2026): the whole board (the 25 mines and the opening)
 * is dealt from the seed when the run starts and nothing appears afterwards, whatever anyone taps. `scheduleOf`
 * replays a log and lists the mines and the opening as dealt at tick 0, then every mine the board holds at the run's
 * end (a hit only shows a mine, it never moves or adds one), so every log's list must be the same.
 */
import { minesweeperGameFor, MINES_CELLS, MINES_REV_STD, type MinesState } from "../../src/lib/arcade/minesweeper";
import type { ArcadeInputEvent } from "../../src/lib/arcade/engine";
import { bot } from "../arcade-skill-bands/bots/minesweeper";
import { Human } from "../arcade-skill-bands/human";

type Ev = ArcadeInputEvent;

function deal(s: MinesState, t: number): { t: number; what: string }[] {
  const mines: number[] = [];
  for (let c = 0; c < MINES_CELLS; c++) if (s.mines[c]) mines.push(c);
  return [{ t, what: `mines ${mines.join(",")}` }, { t, what: `numbers ${s.nums.join("")}` }];
}

export function scheduleOf(seed: number, rev: number, events: unknown): { entries: { t: number; what: string }[]; endTick: number } {
  const game = minesweeperGameFor(rev);
  const byTick = new Map((events as Ev[]).map((e) => [e.t, e]));
  let s = game.init(seed);
  const entries = [...deal(s, 0), { t: 0, what: `opening at ${s.start}: ${s.opening} squares` }];
  while (!game.isOver(s)) s = game.step(s, byTick.get(s.tick + 1) ?? null);
  return { entries: [...entries, ...deal(s, 0)], endTick: s.tick };
}

/** Random taps (reveals and flags anywhere), about one a second. */
function randomLog(seed: number): Ev[] {
  let v = seed | 0;
  const out: Ev[] = [];
  for (let t = 30; t < 90 * 60; t += 60) {
    v = (Math.imul(v, 1103515245) + 12345) | 0;
    out.push({ t, k: 1, a: (v >>> 8) % MINES_CELLS, b: (v >>> 4) & 1, c: 0, d: 0 });
  }
  return out;
}

const botLog = (seed: number, level: "weak" | "elite") => bot({ game: minesweeperGameFor(MINES_REV_STD), seed, rev: MINES_REV_STD, human: new Human("minesweeper", seed, level) }).events ?? [];

export const roomIdentity = {
  type: "minesweeper",
  rev: MINES_REV_STD,
  logs: (seed: number) => [
    { name: "idle", log: [] },
    { name: "random", log: randomLog(seed) },
    { name: "weak", log: botLog(seed, "weak") },
    { name: "elite", log: botLog(seed, "elite") },
  ],
  scheduleOf,
};
