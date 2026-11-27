/**
 * Records the person-like Slider solver's runs on every level (scripts/slider-human.ts; the Word overhaul, stage 3,
 * Joe's last push of 16 Nov 2026) into scripts/fixtures/slider-human-levels.json: 24 room seeds a level, the strong and
 * the elite player, each run's server-graded score, whether it finished and its slides. wordslide-levels-check replays
 * a sample exactly and reads the step from the file.
 *
 *   bun scripts/slider-human-record.ts --level=<easy|normal|hard|expert>   (one level into the scratch dir; run four at once)
 *   bun scripts/slider-human-record.ts --merge=<dir>                         (the four into the fixture)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { WordSlidePuzzleData } from "../src/lib/duel/types";
import { roomDeal } from "./word-levels-shared";
import { SLIDER_HUMANS, sliderHumanScore } from "./slider-human";

export const SLIDER_HUMAN_SEEDS = Array.from({ length: 100 }, (_, n) => 9000 + n * 37); // Changed with Joe's approval, 22 Nov 2026
export const SLIDER_HUMAN_FIXTURE = "scripts/fixtures/slider-human-levels.json";
export type SliderHumanFixture = Record<string, Record<string, { seed: number; score: number; finished: boolean; slides: number }[]>>;

const args = process.argv.slice(2);
const level = args.find((a) => a.startsWith("--level="))?.slice(8);
const merge = args.find((a) => a.startsWith("--merge="))?.slice(8);
const out = args.find((a) => a.startsWith("--out="))?.slice(6) ?? ".shots/slider-human";

if (import.meta.main && level) {
  mkdirSync(out, { recursive: true });
  const rows: SliderHumanFixture[string] = {};
  for (const skill of ["strong", "elite"] as const) {
    rows[skill] = SLIDER_HUMAN_SEEDS.map((seed, n) => {
      const d = roomDeal("wordslide", seed, level === "normal" ? undefined : (level as "easy")) as WordSlidePuzzleData;
      return { seed, ...sliderHumanScore(d, SLIDER_HUMANS[skill], n + 1) };
    });
  }
  writeFileSync(`${out}/${level}.json`, JSON.stringify(rows));
  console.log(`recorded ${level}`);
} else if (import.meta.main && merge) {
  const all: SliderHumanFixture = {};
  for (const l of ["easy", "normal", "hard", "expert"]) all[l] = JSON.parse(readFileSync(`${merge}/${l}.json`, "utf8"));
  writeFileSync(SLIDER_HUMAN_FIXTURE, `${JSON.stringify(all)}\n`);
  console.log(`wrote ${SLIDER_HUMAN_FIXTURE}`);
}
