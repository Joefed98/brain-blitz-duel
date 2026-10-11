// Round intro SCORE lines stay short and plain (first-run audit, 11 Oct 2026):
// at most two short lines on a phone, no scoring terms. The "?" help keeps the formula.
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";

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
if (failures.length) {
  console.log(failures.join("\n"));
  console.log(`FAIL: ${failures.length} intro score line(s)`);
  process.exit(1);
}
console.log(`Intro score text: ${checks} length/wording/help checks passed (max ${MAX_CHARS} chars)`);
