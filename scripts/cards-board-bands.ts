/**
 * Cards & Board skill bands (30 Oct 2026; docs/arcade-standard/minesweeper.md and mahjong.md): the skill-band bots
 * (scripts/arcade-skill-bands/bots/<type>.ts) play Minesweeper and Mahjong Solitaire at every level on fixed room seeds
 * through the server's encode + replay path, and this prints each level's median score (p10–p90), its clear rate, its
 * median clear time (cleared runs) and its median parts. The near-perfect level's median clear time is what each
 * game's Speed part is full by (MINES_SPEED_FULL_S, MAHJONG_SPEED_FULL_S). A tool, not a check.
 *
 *   bun scripts/cards-board-bands.ts [minesweeper|mahjong] [--seeds=60] [--from=0] [--json=<file>]
 */
import { writeFileSync } from "node:fs";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { ALL_LEVELS, Human, LEVEL_LABEL } from "./arcade-skill-bands/human";
import type { SkillBot } from "./arcade-skill-bands/bot";
import { minesParts } from "../src/lib/arcade/minesweeper";
import { mahjongParts } from "../src/lib/arcade/mahjong";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const SEEDS = Number(arg("seeds") ?? 60);
const FROM = Number(arg("from") ?? 0);
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const TYPES = (only.length ? only : ["minesweeper", "mahjong"]) as ("minesweeper" | "mahjong")[];

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))]!;
};

const out: Record<string, unknown> = {};
for (const type of TYPES) {
  const spec = GAME_BY_TYPE.get(type)!;
  const bot = (await import(`./arcade-skill-bands/bots/${type}.ts`)).bot as SkillBot;
  console.log(`\n${type} (seeds ${FROM}–${FROM + SEEDS - 1})`);
  console.log("level          median (p10–p90)   cleared   clear time (median, p10–p90)   core / clean / speed / cost");
  const rows: Record<string, unknown> = {};
  for (const level of ALL_LEVELS) {
    const scores: number[] = [];
    const times: number[] = [];
    const parts: number[][] = [];
    let cleared = 0;
    for (let n = FROM; n < FROM + SEEDS; n++) {
      const seed = spec.seedFor(n);
      const rev = spec.live;
      const game = spec.gameFor(rev, seed);
      const human = new Human(type, seed, level);
      const run = bot({ game, seed, rev, human });
      const raw = spec.encode({ seed, claimedScore: 0, events: run.events ?? [], endTick: 0, checkpoints: [] }, rev, seed);
      const result = spec.replay(seed, raw, rev);
      scores.push(result.score);
      if (result.cleared) {
        cleared += 1;
        times.push(result.clearedSeconds);
      }
      const p = type === "minesweeper" ? minesParts(result.state) : mahjongParts(result.state);
      parts.push([p.core, p.clean, p.speed, p.penalty]);
    }
    const partMed = [0, 1, 2, 3].map((i) => median(parts.map((p) => p[i]!)));
    const time = times.length ? `${median(times).toFixed(1)} s (${pct(times, 10).toFixed(1)}–${pct(times, 90).toFixed(1)})` : "—";
    console.log(
      `${LEVEL_LABEL[level].padEnd(14)} ${String(median(scores)).padStart(5)} (${pct(scores, 10)}–${pct(scores, 90)})`.padEnd(34) +
        `${String(cleared).padStart(3)}/${SEEDS}   ${time.padEnd(31)}${partMed.join(" / ")}`,
    );
    rows[level] = { median: median(scores), p10: pct(scores, 10), p90: pct(scores, 90), cleared, clearTime: times.length ? median(times) : null, clearP10: times.length ? pct(times, 10) : null, clearP90: times.length ? pct(times, 90) : null, parts: partMed };
  }
  out[type] = rows;
}
const json = arg("json");
if (json) writeFileSync(json, JSON.stringify(out, null, 2));
