/**
 * Poker Squares: a player building hands as the cards come. Flawless knows the deal's target grid (the ceiling every
 * deal is built to allow) and places each card on its square there. Every other level places by sight: each empty
 * square is valued by what the card adds to its row and column now (the hands made) and what it keeps open (cards of
 * one suit gathering in a line for a flush, ranks repeating for pairs and trips, a run staying close for a straight),
 * blurred by the level's judgement, with the odd hasty tap. An average player takes about 2.1 s a card.
 *
 * Elite (31 Oct 2026, Full House pokerSquaresRev 2, whose core is full at the elite median): a top player also plans
 * ahead. Each empty square is valued by rollouts: the cards not yet seen dealt out in a few random orders (the bot's
 * own stream, never the deal) and placed by the same sight rule, scoring the finished grids; the mean, plus the sight
 * value as a tie-break, is then blurred by the elite judgement as before.
 */
import { NO_CARD, rankOf, suitOf } from "../../../src/lib/arcade/cards/cards";
import { PS_INPUT_PLACE, PS_LINES, PS_SIZE, PS_SQUARES, psHand, psLine, psTargetGrid, type PsState } from "../../../src/lib/arcade/cards/pokerSquares";
import { driveEvents, type SkillBot } from "../bot";
import type { Human } from "../human";

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

/** The sight rule's value of each empty square for `card` (the change in the two lines' promise). */
function sightValues(grid: readonly number[], card: number, empty: readonly number[]): number[] {
  return empty.map((sq) => {
    const row = Math.floor(sq / PS_SIZE);
    const col = PS_SIZE + (sq % PS_SIZE);
    const rowCards = LINES[row]!.map((i) => grid[i]!);
    const colCards = LINES[col]!.map((i) => grid[i]!);
    const before = promise(rowCards) + promise(colCards);
    rowCards[sq % PS_SIZE] = card;
    colCards[row] = card;
    return promise(rowCards) + promise(colCards) - before;
  });
}

function gridTotal(grid: readonly number[]): number {
  let t = 0;
  for (let l = 0; l < PS_LINES; l++) t += psHand(LINES[l]!.map((i) => grid[i]!)).points;
  return t;
}

const ROLLOUTS = 10;

/** Elite: each empty square's mean finished total over rollouts of the unseen cards, placed by sight. */
function rolloutValues(grid: readonly number[], card: number, empty: readonly number[], seen: ReadonlySet<number>, human: Human): number[] {
  const unseen: number[] = [];
  for (let c = 0; c < 52; c++) if (!seen.has(c)) unseen.push(c);
  const toCome = empty.length - 1;
  const sight = sightValues(grid, card, empty);
  return empty.map((sq, k) => {
    let sum = 0;
    for (let r = 0; r < ROLLOUTS; r++) {
      const g = grid.slice();
      g[sq] = card;
      const pool = unseen.slice();
      for (let i = 0; i < toCome; i++) {
        const j = i + Math.floor(human.u() * (pool.length - i));
        const t = pool[i]!;
        pool[i] = pool[j]!;
        pool[j] = t;
        const next = pool[i]!;
        const open: number[] = [];
        for (let q = 0; q < PS_SQUARES; q++) if (g[q] === NO_CARD) open.push(q);
        const v = sightValues(g, next, open);
        let best = 0;
        for (let o = 1; o < open.length; o++) if (v[o]! > v[best]!) best = o;
        g[open[best]!] = next;
      }
      sum += gridTotal(g);
    }
    return sum / ROLLOUTS + sight[k]! * 0.05;
  });
}

export const bot: SkillBot = ({ game, seed, rev, human }) => {
  const level = human.level;
  const target = level === "perfect" ? psTargetGrid(seed, rev ?? 1).grid : null;
  let nextAt = human.thinkTicks(THINK_MS * 1.3);
  const { events } = driveEvents<PsState>(game, (s, t) => {
    if (t < nextAt || s.next >= PS_SQUARES) return null;
    nextAt = t + human.thinkTicks(THINK_MS);
    const card = s.order[s.next]!;
    if (target) return { k: PS_INPUT_PLACE, a: target.indexOf(card), b: 0, c: 0, d: 0 };
    const empty: number[] = [];
    for (let sq = 0; sq < PS_SQUARES; sq++) if (s.grid[sq] === NO_CARD) empty.push(sq);
    let values: number[];
    if (level === "elite" && empty.length > 1) {
      const seen = new Set<number>(s.grid.filter((c) => c !== NO_CARD));
      seen.add(card);
      values = rolloutValues(s.grid, card, empty, seen, human);
    } else values = sightValues(s.grid, card, empty);
    const sq = empty[human.pick(values)]!;
    return { k: PS_INPUT_PLACE, a: sq, b: 0, c: 0, d: 0 };
  }, game.init(seed) as PsState);
  return { events };
};
