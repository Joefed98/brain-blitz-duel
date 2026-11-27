/**
 * Tempo's two-thumb proof (D5's ladder, 23 Nov 2026; docs/polish-plan-final/difficulty-spec.md "Tempo", "Proof"): a
 * chart is playable by two thumbs at Joe's human limits when its notes can be shared between two thumbs so that each
 * thumb plays one note at a time (a hold keeps its thumb down from the head to the tail) and, after a note, needs
 * BEAT_THUMB_TICKS (0.15 s) to reach a note in another lane (a note in the same lane only has to come after it). Two
 * thumbs means never more than two notes at once, held tails included.
 *
 * `beatTwoThumbs` decides it exactly: the notes in tick order, keeping every way of sharing them seen so far as the pair
 * of notes each thumb played last (at most one state a note per earlier note, so O(notes²)). A script library: the deal
 * builder (scripts/beat-lanes-deal.ts) and beat-ladder-check run it on every dealt chart.
 *
 *   bun scripts/beat-thumbs.ts [--rev=13] [--level=expert] [--seeds=200]      (a report on fresh seeds)
 */
import { BEAT_THUMB_TICKS, beatGameFor, type BeatChart } from "../src/lib/arcade/beat";
import type { Level } from "../src/lib/levels/levels";

export interface ThumbsVerdict {
  ok: boolean;
  /** The first note no sharing can reach (its tick), or null. */
  at: number | null;
  notes: number;
  /** The most notes down at once anywhere in the chart (held tails included). */
  most: number;
}

export function beatTwoThumbs(chart: Pick<BeatChart, "ticks" | "lanes" | "holds">, gap = BEAT_THUMB_TICKS): ThumbsVerdict {
  const n = chart.ticks.length;
  const end = (j: number) => chart.ticks[j]! + (chart.holds[j] ?? 0);
  const free = (j: number, i: number): boolean => {
    if (j < 0) return true;
    const t = chart.ticks[i]!;
    if (t <= end(j)) return false;
    return chart.lanes[i] === chart.lanes[j] || t - end(j) >= gap;
  };
  // A state: the last note each thumb played (−1 none), as "a,b" with a ≤ b (the thumbs are alike).
  let states = new Set<string>(["-1,-1"]);
  let at: number | null = null;
  for (let i = 0; i < n; i++) {
    const next = new Set<string>();
    for (const key of states) {
      const [a, b] = key.split(",").map(Number) as [number, number];
      // Note i to the thumb that played a (the pair is then b and i), or to the one that played b.
      if (free(a, i)) next.add(`${b},${i}`);
      if (free(b, i)) next.add(`${a},${i}`);
    }
    if (!next.size) {
      at = chart.ticks[i]!;
      break;
    }
    states = next;
  }
  // The most notes down at once (a tap is down on its own tick only).
  let most = 0;
  for (let i = 0; i < n; i++) {
    const t = chart.ticks[i]!;
    let down = 0;
    for (let j = 0; j < n; j++) if (chart.ticks[j]! <= t && end(j) >= t) down++;
    most = Math.max(most, down);
  }
  return { ok: at === null, at, notes: n, most };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const rev = Number(opt("rev") ?? 13);
  const levels = (opt("level")?.split(",") ?? ["easy", "normal", "hard", "expert"]) as Level[];
  const seeds = Number(opt("seeds") ?? 200);
  for (const level of levels) {
    const game = beatGameFor(rev, level);
    let ok = 0;
    let three = 0;
    for (let s = 1; s <= seeds; s++) {
      const v = beatTwoThumbs(game.init(s * 7919).chart);
      if (v.ok) ok++;
      if (v.most > 2) three++;
    }
    console.log(`beatRev ${rev} ${level.padEnd(6)}: ${ok}/${seeds} two-thumb playable, ${three} with three notes down at once`);
  }
}
