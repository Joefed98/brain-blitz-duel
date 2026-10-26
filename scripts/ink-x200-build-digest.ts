/**
 * Rainbow Bridge inkRev 10 build digest (a tool, not a check): builds the levels of skill-band seeds through
 * `inkBridgeGameFor(10).init` and prints each seed's build time and a sha-256 of the whole starting state, so a
 * speed change can be proved to deal byte-identical runs:
 *
 *   bun scripts/ink-x200-build-digest.ts [count] [--rev=10] [--out=<json>] [--compare=<json>]
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { inkBridgeGameFor, INK_REV_EXPAND } from "../src/lib/arcade/inkBridge";
import { roomSeed } from "./arcade-skill-bands/games";

const args = process.argv.slice(2);
const opt = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const count = Number(args.find((a) => !a.startsWith("--")) ?? 50);
const rev = Number(opt("rev") ?? INK_REV_EXPAND);
const game = inkBridgeGameFor(rev);
const rows: { n: number; seed: number; ms: number; digest: string }[] = [];
for (let n = 0; n < count; n++) {
  const seed = roomSeed(n);
  const t = performance.now();
  const s = game.init(seed);
  const ms = performance.now() - t;
  rows.push({ n, seed, ms, digest: createHash("sha256").update(JSON.stringify(s)).digest("hex") });
}
const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
const q = (p: number) => ms[Math.min(ms.length - 1, Math.floor(p * ms.length))]!;
console.log(`inkRev ${rev}, ${count} seeds: median ${q(0.5).toFixed(0)} ms, p90 ${q(0.9).toFixed(0)} ms, max ${ms[ms.length - 1]!.toFixed(0)} ms, total ${(ms.reduce((a, b) => a + b, 0) / 1000).toFixed(1)} s`);
const out = opt("out");
if (out) writeFileSync(out, JSON.stringify(rows));
const cmp = opt("compare");
if (cmp) {
  const before = JSON.parse(readFileSync(cmp, "utf8")) as typeof rows;
  const diff = rows.filter((r) => before.find((b) => b.n === r.n)?.digest !== r.digest);
  console.log(diff.length ? `DIFFERENT on ${diff.length} seeds: ${diff.map((d) => d.n).join(", ")}` : `identical on all ${rows.length} seeds`);
  if (diff.length) process.exit(1);
}
