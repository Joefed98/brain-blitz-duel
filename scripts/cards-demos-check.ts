/**
 * The Cards & Board intro demos (the overhaul's stage 3, 15 Nov 2026; scripts/fixtures/cards-demos.json, recorded by
 * scripts/cards-demos-record.ts, saved by scripts/cards-demos-save.ts):
 *
 *  1. one demo for each of Free Cell, Mahjong Solitaire, Summit, Five Hands and Thirteen;
 *  2. each demo's puzzle is exactly its game's intro example deal's public half (the only deal saveIntroDemoFn takes),
 *     on the stamps rooms deal today, at Normal;
 *  3. each run scores exactly what the server's grade gives it, unflagged, and fits the save's limits;
 *  4. the demo version rule (cardsDemoRules.ts, read by getIntroDemoFn) plays these and stops a demo recorded on an older
 *     stamp or at a level.
 */
import { readFileSync } from "node:fs";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { DEMO_MAX_CHARS } from "../src/lib/arcade/introDemo";
import { CARDS_DEMO_STAMPS, cardsDemoPlays } from "../src/lib/duel/cardsDemoRules";
import { FC_REV } from "../src/lib/arcade/cards/freecell";
import { MAHJONG_REV_DEALT } from "../src/lib/arcade/mahjong";
import { TP_REV } from "../src/lib/arcade/cards/tripeaks";
import { FH_REV } from "../src/lib/arcade/cards/fiveHands";
import { PY_REV } from "../src/lib/arcade/cards/pyramid";
import { CARDS_DEMO_GAMES, CARDS_DEMOS_FILE, exampleDeal, type CardsDemo } from "./cards-demos-record";

let passed = 0;
const failures: string[] = [];
function check(ok: boolean, what: string): void {
  if (ok) passed++;
  else {
    failures.push(what);
    console.log(`  FAIL ${what}`);
  }
}

const demos = JSON.parse(readFileSync(CARDS_DEMOS_FILE, "utf8")) as CardsDemo[];
check(demos.map((d) => d.type).join(",") === CARDS_DEMO_GAMES.join(","), "one demo for each of the five games, in order");
const dealt: Record<string, number> = { freecell: FC_REV, mahjong: MAHJONG_REV_DEALT, tripeaks: TP_REV, fivehands: FH_REV, pyramid: PY_REV };
for (const t of CARDS_DEMO_GAMES) check(CARDS_DEMO_STAMPS[t]!.rev === dealt[t], `${t}: the demo rule names the dealt stamp (${dealt[t]})`);
for (const d of demos) {
  const made = exampleDeal(d.type);
  const pub = splitPuzzle(made).pub;
  check(JSON.stringify(d.puzzle) === JSON.stringify(pub), `${d.type}: the demo's puzzle is the intro example deal's public half`);
  check(!("level" in (d.puzzle as object)), `${d.type}: recorded at Normal`);
  const g = gradeAnswer(made, d.run, 0);
  const extra = g.extra as { flagged?: boolean };
  check(g.score === d.score && !extra.flagged, `${d.type}: the run scores ${d.score} through the server's grade, unflagged (${g.score})`);
  check(d.run.length > 0 && d.run.length <= DEMO_MAX_CHARS, `${d.type}: the run fits the save's limit (${d.run.length} characters)`);
  check(d.score >= 150, `${d.type}: the demo is a strong run (${d.score})`);
  check(cardsDemoPlays(d.type, d.puzzle), `${d.type}: the demo rule plays it`);
  const field = CARDS_DEMO_STAMPS[d.type]!.field;
  check(!cardsDemoPlays(d.type, { ...d.puzzle, [field]: dealt[d.type]! - 1 }), `${d.type}: a demo on the stamp before stops`);
  check(!cardsDemoPlays(d.type, { ...d.puzzle, level: "hard" }), `${d.type}: a demo at a level stops`);
}
check(cardsDemoPlays("orbit", { type: "orbit" }), "another game's demo is untouched by the rule");

console.log(failures.length ? `FAIL cards-demos-check: ${failures.length} failed, ${passed} passed` : `PASS cards-demos-check: ${passed} checks`);
process.exit(failures.length ? 1 : 0);
