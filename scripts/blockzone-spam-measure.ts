/**
 * Blockzone hard-drop spam (3 Nov 2026, Joe's audit; a measuring tool, not a check): a player who does nothing but
 * hammer DROP (one hard drop every `--every` ticks, no moves or turns) against the skill-band bots, on the seeds rooms
 * deal, through the server's replay. Prints each run's "Pieces placed" part and total, beside the bots' medians.
 *
 *   bun scripts/blockzone-spam-measure.ts [--seeds=60] [--every=6,12,30]
 */
import { BF_INPUT_DROP } from "../src/lib/arcade/blockfall";
import { measure } from "./new-arcade-bands";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Number(opt("seeds") ?? 60);
const EVERY = (opt("every") ?? "6,12,30").split(",").map(Number);
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
const spec = GAME_BY_TYPE.get("blockfall" as never)!;
for (const every of EVERY) {
  const pieces: number[] = [];
  const totals: number[] = [];
  for (let n = 0; n < SEEDS; n++) {
    const seed = spec.seedFor(n);
    const events = [];
    for (let t = 1; t < 90 * 60; t += every) events.push({ t, k: BF_INPUT_DROP, a: 0, b: 0, c: 0, d: 0 });
    const raw = spec.encode({ seed, claimedScore: 0, events, endTick: 0, checkpoints: [] }, spec.live, seed);
    const r = spec.replay(seed, raw, spec.live) as { score: number; parts?: { key: string; points: number }[] };
    pieces.push(r.parts?.find((p) => p.key === "pieces")?.points ?? 0);
    totals.push(r.score);
  }
  console.log(`spam: a hard drop every ${every} ticks: pieces part median ${med(pieces)} (max ${Math.max(...pieces)}), total median ${med(totals)} (max ${Math.max(...totals)})`);
}
const rows = await measure("blockfall", SEEDS, 0);
for (const r of rows) console.log(`bot ${r.level.padEnd(8)} total median ${r.median}  pieces part ${r.parts.pieces ?? "?"}`);
