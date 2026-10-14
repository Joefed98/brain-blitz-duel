/**
 * Digest of Scrumper's older revisions (unstamped, snipRev 2–6) for
 * snip-rev7-check: for each revision and 60 seeds, a scripted run that cuts
 * every rope early on each level (so all ten levels are dealt with their pin
 * wobbles), hashed with its final state and score. Taken on main before
 * snipRev 7 and stored in snip-rev7-check, it proves the older deals and play
 * are byte-identical.
 *
 *   bun scripts/snip-rev7-digest.ts [module path]
 */
import { inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { fnv } from "./arcade-tuning-a-legacy";
import { cutFor } from "./snip-check-lib";

export const SNIP_DIGEST_REVS = [null, 2, 3, 4, 5, 6] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function snipRevDigest(mod: any, rev: number | null, seeds = 60): number {
  const game = mod.snipGameFor(rev);
  const parts: string[] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    let s = game.init(seed * 7919 + 13);
    const log: ArcadeInputEvent[] = [];
    while (!game.isOver(s)) {
      const k = s.levelTick + 1 - 30;
      if (k >= 0 && k % 10 === 0 && s.ropes[k / 10]?.alive) recordInput(log, cutFor(s, k / 10), game.inputRanges);
      s = game.step(s, inputAt(log, s.tick + 1));
    }
    parts.push(`${fnv(JSON.stringify(s))}:${game.score(s)}`);
  }
  return fnv(parts.join(","));
}

if (import.meta.main) {
  const path = process.argv[2] ?? "../src/lib/arcade/snip";
  const mod = await import(path);
  console.log(JSON.stringify(Object.fromEntries(SNIP_DIGEST_REVS.map((rev) => [String(rev), snipRevDigest(mod, rev)]))));
}
