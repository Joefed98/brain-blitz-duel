/**
 * Five Hands: a player building five poker hands as the cards come, a row at a time. Flawless knows the deal's witness
 * (the arrangement every deal is built to allow) and taps its row for each card. Every other level places by sight:
 * each open row is valued by what the card adds to it now and what it keeps open (cards of one suit gathering for a
 * flush, ranks repeating, a run staying close for a straight), with the outs already seen (dealt, placed or discarded)
 * counted off, blurred by the level's judgement, with the odd hasty tap. An average player takes about 2.3 s a card.
 *
 * Elite (a top player plans ahead): each open row is valued by rollouts, the cards not yet seen dealt out in a few
 * random orders (the bot's own stream, never the deal) as the remaining turns' cards and discards, each placed by the
 * same sight rule under the even-filling rule, scoring the finished rows; the mean (the sight value as a tie-break) is
 * blurred by the elite judgement.
 */
import { rankOf, suitOf } from "../../../src/lib/arcade/cards/cards";
import { FH_INPUT_PLACE, FH_ROWS, FH_SLOTS, FH_TURNS, fhDeal, fhDiscard, fhDiscardsShown, fhOpenRows, fhYours, type FhState } from "../../../src/lib/arcade/cards/fiveHands";
import { psHand } from "../../../src/lib/arcade/cards/pokerSquares";
import { driveEvents, type SkillBot } from "../bot";
import type { Human } from "../human";

const THINK_MS = 2300;

/** A row's worth: its hand now, plus what it still promises given the cards gone (`dead` per suit and per rank). */
function promise(row: readonly number[], deadSuit: readonly number[], deadRank: readonly number[]): number {
  if (row.length === 0) return 0;
  const hand = psHand(row).points;
  if (row.length >= FH_SLOTS) return hand;
  const suits = new Set(row.map(suitOf));
  const ranks = row.map(rankOf);
  const distinct = new Set(ranks);
  const span = Math.max(...ranks) - Math.min(...ranks);
  let open = 0;
  if (suits.size === 1 && row.length >= 2) {
    const s = suitOf(row[0]!);
    const left = 13 - deadSuit[s]! - row.length;
    if (left >= FH_SLOTS - row.length) open += 2.2 * row.length * Math.min(1, left / 6);
  }
  if (distinct.size === row.length && row.length >= 2 && span <= 4) open += 1.6 * row.length;
  for (const r of distinct) {
    const k = ranks.filter((x) => x === r).length;
    if (k >= 2) open += 2 * (k - 1) * Math.max(0.25, (4 - deadRank[r]! - k) / 2);
  }
  return hand + open;
}

function sightValues(rows: readonly (readonly number[])[], card: number, open: readonly number[], deadSuit: readonly number[], deadRank: readonly number[]): number[] {
  return open.map((r) => promise([...rows[r]!, card], deadSuit, deadRank) - promise(rows[r]!, deadSuit, deadRank));
}

function deadCounts(seen: Iterable<number>): { deadSuit: number[]; deadRank: number[] } {
  const deadSuit = [0, 0, 0, 0];
  const deadRank = new Array<number>(14).fill(0);
  for (const c of seen) {
    deadSuit[suitOf(c)]!++;
    deadRank[rankOf(c)]!++;
  }
  return { deadSuit, deadRank };
}

/** The cards a player has seen at turn `turn`: the rows, this turn's card and the discards face up. */
function seenAt(s: FhState): number[] {
  const out: number[] = [];
  for (const row of s.rows) out.push(...row);
  if (s.turn < FH_TURNS) out.push(fhYours(s.deck, s.turn));
  for (let i = 0; i < fhDiscardsShown(s); i++) out.push(fhDiscard(s.deck, i));
  return out;
}

const ROLLOUTS = 16;

function rolloutValues(s: FhState, card: number, open: readonly number[], human: Human): number[] {
  const seen = seenAt(s);
  const seenSet = new Set(seen);
  const unseen: number[] = [];
  for (let c = 0; c < 52; c++) if (!seenSet.has(c)) unseen.push(c);
  const { deadSuit, deadRank } = deadCounts(seen);
  const sight = sightValues(s.rows, card, open, deadSuit, deadRank);
  const turnsLeft = FH_TURNS - s.turn - 1;
  return open.map((r, k) => {
    let sum = 0;
    for (let n = 0; n < ROLLOUTS; n++) {
      const rows = s.rows.map((row, i) => (i === r ? [...row, card] : row.slice()));
      const pool = unseen.slice();
      let p = 0;
      const draw = () => {
        const j = p + Math.floor(human.u() * (pool.length - p));
        const t = pool[p]!;
        pool[p] = pool[j]!;
        pool[j] = t;
        return pool[p++]!;
      };
      for (let t = 0; t < turnsLeft; t++) {
        const next = draw();
        draw();
        const openNow = fhOpenRows(rows);
        const v = sightValues(rows, next, openNow, deadSuit, deadRank);
        let best = 0;
        for (let o = 1; o < openNow.length; o++) if (v[o]! > v[best]!) best = o;
        rows[openNow[best]!]!.push(next);
      }
      for (const row of rows) sum += psHand(row).points;
    }
    return sum / ROLLOUTS + sight[k]! * 0.05;
  });
}

export const bot: SkillBot = ({ game, seed, human }) => {
  const level = human.level;
  const taps = level === "perfect" ? fhDeal(seed).witnessTaps : null;
  let nextAt = human.thinkTicks(THINK_MS * 1.3);
  const { events } = driveEvents<FhState>(game, (s, t) => {
    if (t < nextAt || s.turn >= FH_TURNS) return null;
    nextAt = t + human.thinkTicks(THINK_MS);
    if (taps) return { k: FH_INPUT_PLACE, a: taps[s.turn]!, b: 0, c: 0, d: 0 };
    const card = fhYours(s.deck, s.turn);
    const open = fhOpenRows(s.rows);
    let values: number[];
    if (level === "elite" && open.length > 1) values = rolloutValues(s, card, open, human);
    else {
      const { deadSuit, deadRank } = deadCounts(seenAt(s));
      values = sightValues(s.rows, card, open, deadSuit, deadRank);
    }
    // A hasty tap now and then lands on a greyed row (refused; the next tap a moment later).
    if (human.slip(0.5)) return { k: FH_INPUT_PLACE, a: human.int(0, FH_ROWS - 1), b: 0, c: 0, d: 0 };
    return { k: FH_INPUT_PLACE, a: open[human.pick(values)]!, b: 0, c: 0, d: 0 };
  }, game.init(seed) as FhState);
  return { events };
};
