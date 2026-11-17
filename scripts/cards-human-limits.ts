/**
 * A player held to human limits for the Cards & Board levels (16 Nov 2026, Joe: measure "as Speed did", beside the
 * shared tool's elite bot). It decides only from what a player sees on the table (never a face-down card, the stock's
 * order or the cards still to come) and acts at a fixed human pace: about 0.25 s to react and 0.15 s to move, so one
 * action every HL_ACTION_TICKS ticks, a pair's second tap HL_MOVE_TICKS after its first. No thinking time is added:
 * this is a fast, sharp player, the upper end of human play.
 *
 *   Free Cell   every card is face up: the bank solver's plan from the position (re-planned when it breaks).
 *   Mahjong     the free pair that frees the most tiles (and the higher one); Shuffle when no pair is free.
 *   Summit      the playable card with the longest chain through cards already face up (cards it uncovers are
 *               unknown until they turn), then what it uncovers; the stock when nothing plays.
 *   Five Hands  the row the card improves most (the hint's rule: pairs, a suit held, ranks close for a straight),
 *               then the column worth most.
 *   Thirteen    a King, else the removal with the best line five removals ahead in view (the elite bot's depth), else a
 *               draw. "Human limits" are the timing; the decisions are a strong player's.
 *
 * Used by scripts/cards-levels-tune.ts (`--bots=human`) and cards-levels-order-check.
 */
import type { ArcadeGame, ArcadeInputEvent } from "../src/lib/arcade/engine";
import * as FC from "../src/lib/arcade/cards/freecell";
import { fcHintMove, fcSolve, type FcMove } from "../src/lib/arcade/cards/freecellSolver";
import * as MJ from "../src/lib/arcade/mahjong";
import * as TP from "../src/lib/arcade/cards/tripeaks";
import * as FH from "../src/lib/arcade/cards/fiveHands";
import * as PY from "../src/lib/arcade/cards/pyramid";

/** 0.25 s to react plus 0.15 s to move, at 60 ticks a second. */
export const HL_REACT_TICKS = 15;
export const HL_MOVE_TICKS = 9;
export const HL_ACTION_TICKS = HL_REACT_TICKS + HL_MOVE_TICKS;

type Ev = Omit<ArcadeInputEvent, "t">;
type AnyGame = ArcadeGame<any, ArcadeInputEvent | null>; // eslint-disable-line @typescript-eslint/no-explicit-any
const ev = (k: number, a = 0, b = 0, c = 0): Ev => ({ k, a, b, c, d: 0 });

/** One decision: the inputs to send (a pair's two taps), or none (nothing to do). */
type Decide = (s: any) => Ev[]; // eslint-disable-line @typescript-eslint/no-explicit-any

function freecellDecider(): Decide {
  let plan: FcMove[] | null = null;
  return (s: FC.FcState) => {
    let move: FcMove | null = null;
    if (plan && plan.length) {
      move = plan.shift()!;
      if (!FC.fcApply(s, move[0], move[1], move[2])) {
        plan = null;
        move = null;
      }
    }
    if (!move) {
      plan = fcSolve(s, 2, 20_000);
      move = plan && plan.length ? plan.shift()! : fcHintMove(s, 2000);
    }
    return move ? [ev(FC.FC_INPUT_MOVE, move[0], move[1], move[2])] : [];
  };
}

function mahjongDecider(): Decide {
  return (s: MJ.MahjongState) => {
    const moves = MJ.mahjongMoves(s.face);
    if (!moves.length) return [ev(MJ.MAHJONG_INPUT_SHUFFLE, MJ.MAHJONG_BUTTON_SHUFFLE)];
    const lay = MJ.mahjongLayoutOf(s.face);
    let best = moves[0]!;
    let bestV = -1;
    for (const m of moves) {
      const after = s.face.slice();
      after[m[0]] = -1;
      after[m[1]] = -1;
      let freed = 0;
      for (let i = 0; i < after.length; i++) if (after[i]! >= 0 && !MJ.mahjongFree(s.face, i) && MJ.mahjongFree(after, i)) freed++;
      const v = freed * 4 + lay.slots[m[0]]!.z + lay.slots[m[1]]!.z;
      if (v > bestV) {
        bestV = v;
        best = m;
      }
    }
    return [ev(MJ.MAHJONG_INPUT_TAP, best[0]), ev(MJ.MAHJONG_INPUT_TAP, best[1])];
  };
}

function tripeaksDecider(): Decide {
  /** The longest chain of plays through cards face up now (`seen`): cards a play uncovers are unknown. */
  const chain = (s: TP.TpState, seen: ReadonlySet<number>, depth: number): number => {
    if (depth === 0) return 0;
    let best = 0;
    for (const i of seen) {
      if (!TP.tpPlayable(s, i)) continue;
      best = Math.max(best, 1 + chain(TP.tpApply(s, i)!, seen, depth - 1));
      if (best >= depth) break;
    }
    return best;
  };
  return (s: TP.TpState) => {
    const seen = new Set<number>();
    for (let i = 0; i < TP.TP_CARDS; i++) if (TP.tpFree(s, i)) seen.add(i);
    const options = [...seen].filter((i) => TP.tpPlayable(s, i));
    if (!options.length) return s.stockPos < TP.TP_STOCK ? [ev(TP.TP_INPUT_TAP, TP.TP_STOCK_PILE)] : [];
    let best = options[0]!;
    let bestV = -1;
    for (const i of options) {
      const next = TP.tpApply(s, i)!;
      let uncovers = 0;
      for (let j = 0; j < TP.TP_CARDS; j++) if (!s.cleared[j] && !TP.tpFree(s, j) && TP.tpFree(next, j)) uncovers++;
      const v = 1 + chain(next, seen, 6) + 0.6 * uncovers + (i < 3 ? 2 : 0);
      if (v > bestV) {
        bestV = v;
        best = i;
      }
    }
    return [ev(TP.TP_INPUT_TAP, best)];
  };
}

function fiveHandsDecider(): Decide {
  return (s: FH.FhState) => {
    const h = FH.fhHintRow(s);
    if (!h) return [];
    return [ev(h.kind === "row" ? FH.FH_INPUT_PLACE : FH.FH_INPUT_PICK, h.index)];
  };
}

function pyramidDecider(): Decide {
  const after = (s: PY.PyState, m: readonly number[]): PY.PyState | null => {
    let t: PY.PyState = { ...s, sel: -1 };
    for (const a of m) {
      const r = PY.pyApply(t, a);
      if (!r) return null;
      t = r.state;
    }
    return t;
  };
  const free = (s: PY.PyState) => {
    let n = 0;
    for (let i = 0; i < PY.PY_CARDS; i++) if (PY.pyFree(s, i)) n++;
    return n;
  };
  const look = (s: PY.PyState, depth: number): number => {
    let best = 0.3 * free(s);
    if (depth === 0) return best;
    for (const m of PY.pyMoves(s)) {
      const t = after(s, m);
      if (t) best = Math.max(best, m.length + look(t, depth - 1));
    }
    return best;
  };
  return (s: PY.PyState) => {
    const moves = PY.pyMoves(s);
    const king = moves.find((m) => m.length === 1);
    let pick: number[] | null = king ?? null;
    if (!pick) {
      let bestV = -1;
      for (const m of moves) {
        const t = after(s, m);
        const v = t ? m.length + look(t, 4) + (m.includes(PY.PY_WASTE_PILE) ? 0.5 : 0) : -1;
        if (v > bestV) {
          bestV = v;
          pick = m;
        }
      }
    }
    if (!pick) return PY.pyCanDraw(s) ? [ev(PY.PY_INPUT_TAP, PY.PY_STOCK_PILE)] : [];
    return pick.map((a) => ev(PY.PY_INPUT_TAP, a));
  };
}

const DECIDERS: Record<string, () => Decide> = {
  freecell: freecellDecider,
  mahjong: mahjongDecider,
  tripeaks: tripeaksDecider,
  fivehands: fiveHandsDecider,
  pyramid: pyramidDecider,
};

/** Plays a game's seed at human limits: the input log as the sim recorded it, and the final state. */
export function humanLimitsPlay(type: string, game: AnyGame, seed: number): { events: ArcadeInputEvent[]; state: any } { // eslint-disable-line @typescript-eslint/no-explicit-any
  const decide = DECIDERS[type]!();
  let s = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  const queue: Ev[] = [];
  let nextAt = HL_ACTION_TICKS;
  let idle = 0;
  while (!game.isOver(s) && s.tick < game.runTicks) {
    const t = s.tick + 1;
    let input: ArcadeInputEvent | null = null;
    if (t >= nextAt) {
      if (!queue.length) {
        const acts = decide(s);
        if (acts.length) {
          queue.push(...acts);
          idle = 0;
        } else if (++idle > 3) break;
      }
      const a = queue.shift();
      if (a) {
        input = { ...a, t };
        events.push(input);
      }
      nextAt = t + (queue.length ? HL_MOVE_TICKS : HL_ACTION_TICKS);
    }
    s = game.step(s, input);
  }
  // Played on to the run's end so the stored state is the buzzer's (a stuck run stays where it is).
  while (!game.isOver(s) && s.tick < game.runTicks) s = game.step(s, null);
  return { events, state: s };
}
