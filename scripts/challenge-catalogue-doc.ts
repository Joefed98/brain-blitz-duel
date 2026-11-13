/**
 * Writes docs/challenges/catalogue.md, the live practice challenge catalogue, from the code
 * (src/lib/duel/practiceChallenges.data.ts): every challenge with its goal, level, style, the check the server runs,
 * and the reward. `--check` fails if the file differs from what the code gives.
 *
 *   bun scripts/challenge-catalogue-doc.ts [--check]
 */
import { readFileSync, writeFileSync } from "node:fs";

import { isPlayable } from "../src/lib/duel/catalogue";
import { PRACTICE_CHALLENGES, type ChallengeCond, type PracticeChallenge } from "../src/lib/duel/practiceChallenges";
import { GAME_DISPLAY_NAMES as GAME_NAMES } from "../src/lib/duel/gameNames";

const OUT = "docs/challenges/catalogue.md";

const OP: Record<string, string> = { eq: "=", gte: "≥", lte: "≤", lt: "<", gt: ">" };
const val = (v: number | string) => (typeof v === "string" ? `\`${v.slice(1)}\`` : String(v));
function cond(c: ChallengeCond): string {
  switch (c.c) {
    case "finish":
      return "finish";
    case "score":
      return `\`score\` ${OP[c.op]} ${c.v}`;
    case "correct":
      return "`isCorrect`";
    case "avgMs":
      return `\`reactionAvgMs\` ${OP[c.op]} ${c.v}`;
    case "field":
      return `\`${c.path}\` ${OP[c.op]} ${val(c.v)}`;
    case "len":
      return `\`${c.path}\` count ${OP[c.op]} ${c.v}`;
    case "all":
      return `every \`${c.path}\` true`;
    case "line":
      return `line “${c.label}” ${OP[c.op]} ${c.v}`;
    case "full":
      return `line “${c.label}” = ${c.max} of ${c.max}`;
    case "tile":
      return `tile “${c.label}” ${OP[c.op]} ${c.v}`;
  }
}
function check(c: PracticeChallenge): string {
  const g = c.goal;
  if (g.kind === "part") return `line “${g.label}” = ${g.max} of ${g.max}`;
  if (g.kind === "bonus") return `finish, \`parts.efficiency\` ≥ ${g.max}`;
  if (g.kind === "speed") return `finish, \`parts.speed\` ≥ ${g.max} (by ${g.withinS} s)`;
  if (g.kind === "score") return `\`score\` ≥ ${g.score}`;
  return g.all.map(cond).join(", ");
}
const LEVEL = { classic: "Classic", hard: "Hard", expert: "Expert" } as const;
const STYLE: Record<string, string> = { finish: "Finish", clean: "Clean", par: "Par", speed: "Speed", streak: "Streak", combo: "Combo", fullset: "Full set", target: "Target", maxout: "Max-out", bigscore: "Big score", perfect: "Perfect" };

const CATEGORY_ORDER: [string, string[]][] = [];
function render(): string {
  const byType = new Map<string, PracticeChallenge[]>();
  for (const c of PRACTICE_CHALLENGES) byType.set(c.type, [...(byType.get(c.type) ?? []), c]);
  // Retired games' challenges (catalogue.ts RETIRED_TYPES, 13 Nov 2026) stay in the catalogue, hidden and counting for
  // nothing until the game returns.
  const playable = PRACTICE_CHALLENGES.filter((c) => isPlayable(c.type));
  const retiredGames = new Set(PRACTICE_CHALLENGES.filter((c) => !isPlayable(c.type)).map((c) => c.type));
  const live = playable.filter((c) => c.level === "classic").length;
  const coins = (lv: string) => playable.filter((c) => c.level === lv && c.coins > 0);
  const lines: string[] = [
    "# Practice challenges: the live catalogue",
    "",
    "**Live.** Written by `bun scripts/challenge-catalogue-doc.ts` from `src/lib/duel/practiceChallenges.data.ts`, the one",
    "data file the phone and the server read; practice-goals-check proves it matches the code and every number in every goal",
    "against the live game (`scripts/practice-challenge-numbers.ts`). It replaces the draft Joe reviewed on 10 Nov 2026",
    "(`catalogue-draft.md`, in the git history), with his renames (Five Hands' Full house is Handsome, Breaker's Gold rush",
    "is Twenty-four carat) and the goals written in scoring language rewritten as the real action.",
    "",
    `${PRACTICE_CHALLENGES.length} challenges over ${byType.size} games. ${PRACTICE_CHALLENGES.length - playable.length} of them, on the ${retiredGames.size} retired games, are`,
    "kept but hidden and count for nothing until their game returns (`RETIRED_TYPES`, 13 Nov 2026). Of the rest,",
    `${live} Classic ones are live in wave 2; the Hard and Expert ones are in the catalogue but switched off until wave 3.5`,
    "deals those levels (`LIVE_CHALLENGE_LEVELS`). Counts below are for live games.",
    "",
    `Coins (● in the table): ${coins("classic").length} Classic pay 100 (live), ${coins("hard").length} Hard pay 100 and ${coins("expert").length} Expert pay 250 once`,
    "their level is live; through the coin ledger (reason `challenge_reward`), once per challenge per account. A guest's",
    "completions are kept and paid when that guest becomes an account.",
    "",
    "A challenge is complete only when the server's own grade of a Practice run meets its check (`evaluateChallenge` in",
    "`src/lib/duel/practiceChallenges.ts`, run by `src/lib/challenges/challenges.server.ts`). Rooms, the Daily and friend",
    "challenges never count. How the checks read a run:",
    "",
    "| Written as | Reads |",
    "|---|---|",
    "| finish | a puzzle on the scoring standard that finished (`extra.parts.kind` \"finish\") |",
    "| `parts.speed`, `parts.efficiency` | that finish's speed and bonus points |",
    "| `a.b` | a number (or true / false) the server stores in the run's `extra` |",
    "| line “Label” | an arcade standard part's points, from its stored reveal line “Label: … → n of m” |",
    "| tile “Label” | an arcade reveal tile's number |",
    "| `score`, `isCorrect`, `reactionAvgMs` | the result's own columns |",
    "",
  ];
  let cat = "";
  for (const [type, list] of byType) {
    const c0 = list[0]!;
    void cat;
    lines.push(`#### ${(GAME_NAMES as Record<string, string>)[type] ?? type} (\`${type}\`)`, "");
    lines.push("| Name | Goal | Level | Style | Check | Coin | Id |", "|---|---|---|---|---|:-:|---|");
    for (const c of list)
      lines.push(`| ${c.name} | ${c.text} | ${LEVEL[c.level]} | ${STYLE[c.style]} | ${check(c)} | ${c.coins ? "●" : ""} | \`${c.id}\` |`);
    lines.push("");
    cat = c0.type;
  }
  return lines.join("\n");
}

const text = render();
if (process.argv.includes("--check")) {
  let now = "";
  try {
    now = readFileSync(OUT, "utf8");
  } catch {
    /* missing */
  }
  if (now !== text) {
    console.log(`FAIL ${OUT} is out of date: run bun scripts/challenge-catalogue-doc.ts`);
    process.exit(1);
  }
  console.log(`PASS ${OUT} matches the code`);
} else {
  writeFileSync(OUT, text);
  console.log(`wrote ${OUT} (${PRACTICE_CHALLENGES.length} challenges)`);
}
void CATEGORY_ORDER;
