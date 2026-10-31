/**
 * Room identity for Mahjong Solitaire mahjongRev 2 (rev 1's deal with Undo and Reset; Cards & Board, 30 Oct 2026): every face is dealt from the seed when
 * the run starts and nothing appears afterwards; taking a pair only removes tiles. A Shuffle re-deals the faces left
 * (deterministic for the seed and the log), so the logs compared here use none: `scheduleOf` lists the deal at tick 0
 * and, for every pair a log takes, the faces it took (each face the deal placed there).
 */
import { mahjongGameFor, MAHJONG_REV_DEALT, MAHJONG_REV_STD, MAHJONG_TILES, type MahjongState } from "../../src/lib/arcade/mahjong";
import type { ArcadeInputEvent } from "../../src/lib/arcade/engine";
import { bot } from "../arcade-skill-bands/bots/mahjong";
import { Human } from "../arcade-skill-bands/human";

type Ev = ArcadeInputEvent;

export function scheduleOf(seed: number, rev: number, events: unknown): { entries: { t: number; what: string }[]; endTick: number } {
  const game = mahjongGameFor(rev);
  const byTick = new Map((events as Ev[]).filter((e) => e.k === 1).map((e) => [e.t, e]));
  let s: MahjongState = game.init(seed);
  const dealt = s.face.slice();
  const entries = [{ t: 0, what: `faces ${dealt.join(",")}` }];
  while (!game.isOver(s)) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    // What any tile still on the board shows is what the deal put there.
    if (s.tick % 600 === 0) for (let i = 0; i < MAHJONG_TILES; i++) if (s.face[i]! >= 0 && s.face[i] !== dealt[i]) entries.push({ t: s.tick, what: `tile ${i} changed face` });
  }
  return { entries, endTick: s.tick };
}

/** Random taps on any tile, about two a second. */
function randomLog(seed: number): Ev[] {
  let v = seed | 0;
  const out: Ev[] = [];
  for (let t = 20; t < 120 * 60; t += 30) {
    v = (Math.imul(v, 1103515245) + 12345) | 0;
    out.push({ t, k: 1, a: (v >>> 8) % MAHJONG_TILES, b: 0, c: 0, d: 0 });
  }
  return out;
}

const botLog = (seed: number, level: "weak" | "elite") => (bot({ game: mahjongGameFor(MAHJONG_REV_STD), seed, rev: MAHJONG_REV_STD, human: new Human("mahjong", seed, level) }).events ?? []).filter((e) => e.k === 1);

export const roomIdentity = {
  type: "mahjong",
  rev: MAHJONG_REV_DEALT,
  logs: (seed: number) => [
    { name: "idle", log: [] },
    { name: "random", log: randomLog(seed) },
    { name: "weak", log: botLog(seed, "weak") },
    { name: "elite", log: botLog(seed, "elite") },
  ],
  scheduleOf,
};
