/**
 * Poker Squares: a player building hands as the cards come. Flawless knows the deal's target grid (the ceiling every
 * deal is built to allow) and places each card on its square there. Every other level places by sight: each empty
 * square is valued by what the card adds to its row and column now (the hands made) and what it keeps open (cards of
 * one suit gathering in a line for a flush, ranks repeating for pairs and trips, a run staying close for a straight),
 * blurred by the level's judgement, with the odd hasty tap. An average player takes about 2.1 s a card.
 */
import { NO_CARD, rankOf, suitOf } from "../../../src/lib/arcade/cards/cards";
import { PS_INPUT_PLACE, PS_LINES, PS_SIZE, PS_SQUARES, psHand, psLine, psTargetGrid, type PsState } from "../../../src/lib/arcade/cards/pokerSquares";
import { driveEvents, type SkillBot } from "../bot";

const THINK_MS = 2100;
const LINES = Array.from({ length: PS_LINES }, (_, l) => psLine(l));

/** A line's worth to a player: its hand now, plus what it still promises. */
function promise(cards: number[]): number {
  const held = cards.filter((c) => c !== NO_CARD);
  if (held.length === 0) return 0;
  const hand = psHand(held).points;
  const suits = new Set(held.map(suitOf));
  const ranks = held.map(rankOf);
  const distinct = new Set(ranks);
  const span = Math.max(...ranks) - Math.min(...ranks);
  let open = 0;
  if (suits.size === 1 && held.length >= 2) open += 2.2 * held.length;
  if (distinct.size === held.length && held.length >= 2 && span <= 4) open += 1.6 * held.length;
  open += 2 * (held.length - distinct.size);
  return hand + open * (held.length < 5 ? 1 : 0);
}

export const bot: SkillBot = ({ game, seed, human }) => {
  const level = human.level;
  const target = level === "perfect" ? psTargetGrid(seed).grid : null;
  let nextAt = human.thinkTicks(THINK_MS * 1.3);
  const { events } = driveEvents<PsState>(game, (s, t) => {
    if (t < nextAt || s.next >= PS_SQUARES) return null;
    nextAt = t + human.thinkTicks(THINK_MS);
    const card = s.order[s.next]!;
    if (target) return { k: PS_INPUT_PLACE, a: target.indexOf(card), b: 0, c: 0, d: 0 };
    const empty: number[] = [];
    for (let sq = 0; sq < PS_SQUARES; sq++) if (s.grid[sq] === NO_CARD) empty.push(sq);
    const values = empty.map((sq) => {
      const grid = s.grid.slice();
      grid[sq] = card;
      const row = Math.floor(sq / PS_SIZE);
      const col = PS_SIZE + (sq % PS_SIZE);
      const before = promise(LINES[row]!.map((i) => s.grid[i]!)) + promise(LINES[col]!.map((i) => s.grid[i]!));
      const after = promise(LINES[row]!.map((i) => grid[i]!)) + promise(LINES[col]!.map((i) => grid[i]!));
      return after - before;
    });
    const sq = empty[human.pick(values)]!;
    return { k: PS_INPUT_PLACE, a: sq, b: 0, c: 0, d: 0 };
  }, game.init(seed) as PsState);
  return { events };
};
