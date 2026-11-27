/**
 * Wavefront wavRev 16's spread, measured (a tool, not a check; D5, 22 Nov 2026; docs/arcade-standard/wavefront.md
 * "wavRev 16"): plays wavRev 16 with other spreads of the shaped waves put in place of WAV_FORMS_XW for the run (the grid
 * is always wavRev 16's 52 px pitch), beside wavRev 15, so the chosen width can be compared with the plan's first recipe.
 *
 *  - rev15: wavRev 15 itself;
 *  - gridOnly: the wider grid, the shapes as wavRev 15's;
 *  - cap326: every shape 326 px wide (wavRev 16 as dealt);
 *  - pitch: the shapes spread by the pitch's 52 / 44 (336–356 px, the plan's first recipe).
 *
 * Each player is the skill-band bot held to HUMAN_LIMITS (the flawless player with the first eight reaction jitters of the
 * deal builder; any other level once), on the deal builder's candidate seeds. "reached" counts runs the formation ended by
 * reaching the ship's line (lives left).
 *
 *   bun scripts/wavefront-wide-variants.ts [--seeds=40] [--level=normal] [--skill=average] [--variants=rev15,gridOnly,cap326,pitch]
 */
import { wavefrontGameFor, WAV_ARMOUR_BY_WAVE, WAV_CELL, WAV_FORMS, WAV_FORMS_XW, type WavState } from "../src/lib/arcade/wavefront";
import type { Level } from "../src/lib/levels/levels";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, HUMAN_LIMITS, type SkillLevel } from "./arcade-skill-bands/human";
import * as mod from "./arcade-skill-bands/bots/wavefront";
import { proveWideWitness, WAV_WIDE_CANDIDATES, WAV_WIDE_JITTERS } from "./wavefront-wide-deal";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const seeds = Number(opt("seeds") ?? 40);
const level = (opt("level") ?? "normal") as Level;
const skill = (opt("skill") ?? "average") as SkillLevel;
const names = (opt("variants") ?? "rev15,gridOnly,cap326,pitch").split(",");

const roundHalfUp = (n: number, d: number) => Math.floor((2 * n + d) / (2 * d));
/** A shape's outline spread about its centre by num / den; the core keeps its 44 px pitch, its centre moved alike. */
function spread(wave: number, num: number, den: number): (readonly [number, number])[] {
  const form = WAV_FORMS[wave]!;
  const cells = WAV_ARMOUR_BY_WAVE[Math.min(wave - 2, 3)]![0];
  const xs = form.map((p) => p[0]);
  const s2 = Math.min(...xs) + Math.max(...xs);
  const core = form.slice(0, cells).map((p) => p[0]);
  const c2 = Math.min(...core) + Math.max(...core);
  const out = form.map((p, i) => (i < cells ? ([roundHalfUp(2 * den * p[0] - den * c2 + den * s2 + num * (c2 - s2), 2 * den), p[1]] as const) : ([roundHalfUp(den * s2 + num * (2 * p[0] - s2), 2 * den), p[1]] as const)));
  const mn = Math.min(...out.map((p) => p[0]));
  return out.map((p) => [p[0] - mn, p[1]] as const);
}
const original = WAV_FORMS_XW.map((f) => f);
function install(widthFor: ((wave: number, w: number) => number) | null): void {
  for (let wave = 2; wave <= 5; wave++) {
    if (!widthFor) {
      (WAV_FORMS_XW as unknown as unknown[])[wave] = original[wave];
      continue;
    }
    const xs = WAV_FORMS[wave]!.map((p) => p[0]);
    const den = Math.max(...xs) - Math.min(...xs);
    const form = spread(wave, widthFor(wave, den + WAV_CELL) - WAV_CELL, den);
    let w = 0;
    let h = 0;
    for (const [x, y] of form) {
      w = Math.max(w, x + WAV_CELL);
      h = Math.max(h, y + WAV_CELL);
    }
    const escorts = Array.from({ length: 6 }, (_, k) => [Math.round((k * (w - WAV_CELL)) / 5), h + 10] as const);
    (WAV_FORMS_XW as unknown as unknown[])[wave] = [...form, ...escorts];
  }
}
const VARIANTS: Record<string, { rev: number; width: ((wave: number, w: number) => number) | null }> = {
  rev15: { rev: 15, width: null },
  gridOnly: { rev: 16, width: (_, w) => w },
  cap326: { rev: 16, width: null },
  pitch: { rev: 16, width: (_, w) => WAV_CELL + Math.round(((w - WAV_CELL) * 52) / 44) },
};
const spec = GAME_BY_TYPE.get("wavefront")!;
const jitters = skill === "perfect" ? WAV_WIDE_JITTERS.slice(0, 8) : [0];
for (const name of names) {
  const v = VARIANTS[name];
  if (!v) throw new Error(`unknown variant ${name}`);
  install(v.width);
  let runs = 0;
  let reached = 0;
  let at200 = 0;
  let kills = 0;
  let sum = 0;
  let seeds200 = 0;
  for (const n of WAV_WIDE_CANDIDATES.slice(0, seeds)) {
    const seed = spec.seedFor(n);
    let any = false;
    for (const j of jitters) {
      mod.wavefrontBotOptions.reactJitter = j;
      const out = mod.bot({ game: wavefrontGameFor(v.rev, level), seed, rev: v.rev, human: new Human("wavefront", seed, skill, HUMAN_LIMITS), fixes: true } as never);
      const p = proveWideWitness(seed, level, (out.events ?? []) as never, v.rev);
      const s = p.state as WavState;
      runs += 1;
      sum += p.score;
      if (s.ended === 2 && s.lives > 0) reached += 1;
      if (s.bossKilled) kills += 1;
      if (p.score === 200 && !p.flagged) {
        at200 += 1;
        any = true;
      }
    }
    if (any) seeds200 += 1;
  }
  mod.wavefrontBotOptions.reactJitter = 0;
  install(null);
  console.log(`${name.padEnd(8)} ${level.padEnd(6)} ${skill.padEnd(7)} ${runs} runs: mean ${(sum / runs).toFixed(1)}, formation reached the ship ${reached}, boss killed ${kills}, at 200 ${at200} (${seeds200} of ${seeds} seeds)`);
}
