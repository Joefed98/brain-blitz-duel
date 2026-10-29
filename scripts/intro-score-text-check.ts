// Round intro SCORE lines stay short and plain (first-run audit, 11 Oct 2026):
// at most two short lines on a phone, no scoring terms. The "?" help keeps the formula.
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { BAND_SPECS } from "../src/lib/arcade/bandParts";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { LIVE_BANDS, type LiveBand } from "../src/lib/arcade/liveBands";
import { STD_TOTAL } from "../src/lib/arcade/arcadeStandard";

/** About two lines of text-sm on a 360 px phone. */
const MAX_CHARS = 90;
const JARGON = [/\bpar\b/i, /speed bonus/i, /word points/i, /\bstages?\b(?! you survive)/i, /half the time/i, /round down/i, /[×÷]/, /floor\(/i, /\bclamp/i];

let checks = 0;
const failures: string[] = [];
for (const type of Object.keys(PUZZLE_INSTRUCTIONS)) {
  const text = INTRO_SCORE[type as keyof typeof INTRO_SCORE];
  checks++;
  if (!text) {
    failures.push(`${type}: no intro score line`);
    continue;
  }
  if (text.length > MAX_CHARS) failures.push(`${type}: ${text.length} chars (max ${MAX_CHARS}): ${text}`);
  for (const term of JARGON) if (term.test(text)) failures.push(`${type}: scoring term ${term} in "${text}"`);
  checks++;
  if (!PUZZLE_INSTRUCTIONS[type as keyof typeof PUZZLE_INSTRUCTIONS]?.score) failures.push(`${type}: no "?" help score text`);
}
// Oct 2026 score bands: every active arcade intro says how to reach the top (no partial cap is stated),
// and the "?" help says it plainly (more, higher score; what a good run takes; arcade-help-bands-check has the numbers).
for (const type of Object.keys(BAND_SPECS) as (keyof typeof INTRO_SCORE)[]) {
  checks++;
  const text = INTRO_SCORE[type];
  // The top is the game's own maximum (roundMax.ts; 150 today).
  if (!new RegExp(`\\b${roundMaxFor(type)}\\b|10 more`).test(text)) failures.push(`${type}: intro does not say how to reach the top: "${text}"`);
  if (/otherwise up to \d+/.test(text)) failures.push(`${type}: intro still states a partial cap: "${text}"`);
  const help = PUZZLE_INSTRUCTIONS[type].score;
  // Games on the arcade scoring standard (arcadeStandard.ts) list their parts and say they total 200 instead of a band
  // line (arcade-help-bands-check proves the parts and maximums).
  const std = (LIVE_BANDS as Record<string, LiveBand>)[type]?.std;
  if (std) {
    if (!help.includes(`Together ${STD_TOTAL} points.`)) failures.push(`${type}: "?" help does not say the standard's parts total ${STD_TOTAL}`);
  } else if (!help.includes("higher score") || !help.includes("A good run (100 points)")) failures.push(`${type}: "?" help has no plain band line`);
  if (/→|Points follow/.test(help)) failures.push(`${type}: "?" help still lists band knots`);
}
if (failures.length) {
  console.log(failures.join("\n"));
  console.log(`FAIL: ${failures.length} intro score line(s)`);
  process.exit(1);
}
console.log(`Intro score text: ${checks} length/wording/help checks passed (max ${MAX_CHARS} chars)`);
