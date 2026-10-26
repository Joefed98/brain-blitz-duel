/**
 * Expansion E9 (26 Oct 2026, docs/expansions/e9.md): the perfect-play ceiling of Rally rallyRev 10, Fission
 * burstRev 8 and Flightpath bullRev 8 on every tuning and fresh seed (room seeds 0–299). For each seed it plays
 * a flawless player (the elite bot with every human error set to nothing) through the server's encode + replay
 * path, several times with different choices, and keeps the best replayed score: an input log that scores it,
 * so the ceiling is at least that. A seed whose best stays under 200 is listed.
 *
 *   bun scripts/expansion-e9-ceiling.ts [rally burst bullseye] [--from=0] [--to=300] [--tries=12] [--json=out.json]
 *
 * A tuning tool, not a check (expansion-e9-check proves each game's analytic floor and replays stored 200s).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { writeFileSync } from "node:fs";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, type SkillProfile } from "./arcade-skill-bands/human";
import { E9_GAMES, playE9 } from "./expansion-e9-bands";
import { bullseyeOracle, burstOracle, rallyOracle } from "./expansion-e9-oracles";

/** The exact oracles, tried first (scripts/expansion-e9-oracles.ts). */
const ORACLES: Record<string, any> = { bullseye: bullseyeOracle, rally: rallyOracle, burst: burstOracle };

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const FROM = Number(opt("from") ?? 0);
const TO = Number(opt("to") ?? 300);
const TRIES = Number(opt("tries") ?? 12);
const ONLY = args.filter((a) => !a.startsWith("--"));

/** A flawless player: instant (but human-floor) reactions, no aim, timing, power or reading error, no slips. */
export const FLAWLESS: SkillProfile = { reactionMs: [120, 0], lapse: 0, timingSdMs: 0, aimSdPx: 0, powerSd: 0, mistake: 0, thinkScale: 0.25, judgement: 0, trackLagMs: 17 };

if (import.meta.main) {
const out: Record<string, { n: number; best: number }[]> = {};
for (const g of E9_GAMES) {
  if (ONLY.length && !ONLY.includes(g.type)) continue;
  const { bot } = await import(new URL(`./arcade-skill-bands/bots/${g.type}.ts`, import.meta.url).href);
  const rows: { n: number; best: number }[] = [];
  for (let n = FROM; n < TO; n++) {
    let best = 0;
    if (ORACLES[g.type]) {
      const run = playE9(g, ORACLES[g.type], "new", "elite", n);
      if (run.mismatch) throw new Error(`${g.type} ${n}: oracle replay mismatch`);
      best = run.score;
    }
    for (let k = 0; k < TRIES && best < 200; k++) {
      // Each try: the same seed, a different stream for the player's choices.
      const flawless = (ctx: any) => {
        const human = new Human(`${g.type}#${k}`, ctx.seed, "elite");
        (human as any).p = FLAWLESS;
        return bot({ ...ctx, human });
      };
      const run = playE9(g, flawless, "new", "elite", n);
      if (run.mismatch) throw new Error(`${g.type} ${n}: replay mismatch`);
      best = Math.max(best, run.score);
    }
    rows.push({ n, best });
  }
  out[g.type] = rows;
  const under = rows.filter((r) => r.best < 200);
  const sorted = rows.map((r) => r.best).sort((a, b) => a - b);
  console.log(`${g.type}: seeds ${FROM}–${TO - 1}, flawless best: min ${sorted[0]}, median ${sorted[sorted.length >> 1]}; under 200 on ${under.length}${under.length ? ` (${under.slice(0, 20).map((r) => `${r.n}:${r.best}`).join(" ")})` : ""}`);
}
void GAME_BY_TYPE;
if (opt("json")) writeFileSync(opt("json")!, JSON.stringify(out));
}
