/**
 * speed-demos-check (15 Nov 2026, the Speed overhaul; the merge captain's rule for every overhaul's intro demos):
 *
 *   1. scripts/fixtures/speed-demos.json holds one row for each Speed engine game (Bonk, Tenfall, Pull!), each exactly the
 *      intro_demos columns saveIntroDemoFn writes (game type, seed, the public half, { run }, start and length ticks).
 *   2. Each row's puzzle is the live deal: the stamps rooms deal today (generatePuzzle), with only the seed chosen.
 *   3. Each run scores exactly what the server's replay says: gradeAnswer's stored score equals the fixture's figure and
 *      the run's own claimed score, and the replay flags nothing (no desync, no bad input).
 *   4. Each run shows play inside the intro's window (taps before length_ticks) and fits the save's size limit.
 *   5. The demo rules (introDemo.functions.ts) play only demos on the dealt stamps (whackRev 4, tenRev 6, clayRev 10), so
 *      older demos stop where the stamp changed.
 *   6. The fixture rebuilds byte for byte from the bots (scripts/speed-demos-record.ts), so it follows the stamps.
 *
 *   bun scripts/speed-demos-check.ts
 */
import { readFileSync } from "node:fs";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { DEMO_LENGTH_TICKS, DEMO_MAX_CHARS, DEMO_START_TICK, runSeed } from "../src/lib/arcade/introDemo";
import { decodeInputEvents } from "../src/lib/arcade/engine";
import { WHACK_REV_NOTES } from "../src/lib/arcade/whack";
import { TEN_DROP_RESET_REV } from "../src/lib/arcade/tenDrop";
import { CLAY_REV_WIDE } from "../src/lib/arcade/clayShoot";
import { SPEED_DEMO_FIXTURE, SPEED_DEMO_GAMES, recordSpeedDemos, speedDemoText, type SpeedDemoFixture } from "./speed-demos-record";
import type { PuzzleData } from "../src/lib/duel/types";

let checks = 0;
const failures: string[] = [];
function ok(cond: unknown, label: string) {
  checks++;
  if (!cond) {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}
const section = (name: string) => console.log(`\n${name}`);

const text = readFileSync(SPEED_DEMO_FIXTURE, "utf8");
const fixture = JSON.parse(text) as SpeedDemoFixture;
const COLUMNS = ["game_type", "seed", "puzzle", "input_log", "start_tick", "length_ticks"].sort().join(",");
const STAMP: Record<string, [string, number]> = { whack: ["whackRev", WHACK_REV_NOTES], tendrop: ["tenRev", TEN_DROP_RESET_REV], clayshoot: ["clayRev", CLAY_REV_WIDE] };
const withoutSeed = (p: unknown) => {
  const { seed: _seed, ...rest } = p as Record<string, unknown>;
  return JSON.stringify(Object.keys(rest).sort().map((k) => [k, rest[k]]));
};

section("1. One row a game, in the intro_demos shape");
ok(fixture.rows.map((r) => r.game_type).join(",") === SPEED_DEMO_GAMES.join(","), "rows for Bonk, Tenfall and Pull!, once each");
for (const row of fixture.rows) {
  ok(Object.keys(row).sort().join(",") === COLUMNS, `${row.game_type}: exactly the intro_demos columns`);
  ok(Object.keys(row.input_log).join(",") === "run", `${row.game_type}: input_log is { run }`);
  ok(row.start_tick === DEMO_START_TICK && row.length_ticks === DEMO_LENGTH_TICKS, `${row.game_type}: the save's start and length ticks`);
  ok(fixture.proof[row.game_type]?.bot === "elite", `${row.game_type}: the proof names its bot`);
}

section("2. Each puzzle is the live deal");
for (const row of fixture.rows) {
  const live = splitPuzzle(generatePuzzle(row.game_type as PuzzleData["type"], {})).pub;
  ok(withoutSeed(row.puzzle) === withoutSeed(live), `${row.game_type}: the stamps rooms deal today (${withoutSeed(live)})`);
  const [field, rev] = STAMP[row.game_type]!;
  ok((row.puzzle as unknown as Record<string, unknown>)[field] === rev, `${row.game_type}: ${field} ${rev}`);
  ok(JSON.stringify(splitPuzzle(row.puzzle).pub) === JSON.stringify(row.puzzle), `${row.game_type}: only the public half is stored`);
  const seed = (row.puzzle as unknown as { seed: number }).seed;
  ok(row.seed === seed && runSeed(row.input_log.run) === seed, `${row.game_type}: the row, puzzle and run share seed ${seed}`);
}

section("3. Each run scores exactly what the server's replay says");
for (const row of fixture.rows) {
  const graded = gradeAnswer(row.puzzle, row.input_log.run, 0);
  const claimed = Number.parseInt(row.input_log.run.split("|")[1] ?? "", 10);
  const extra = (graded.extra ?? {}) as Record<string, unknown>;
  ok(graded.score === fixture.proof[row.game_type]!.score, `${row.game_type}: the server's score ${graded.score} is the fixture's ${fixture.proof[row.game_type]!.score}`);
  ok(claimed === graded.score, `${row.game_type}: the run's own claimed score ${claimed} is the server's ${graded.score}`);
  ok(!extra["flagged"], `${row.game_type}: the replay flags nothing`);
  ok(graded.score >= 150, `${row.game_type}: a strong run to watch (${graded.score})`);
}

section("4. Play inside the intro's window, within the save's size");
for (const row of fixture.rows) {
  const events = decodeInputEvents((row.input_log.run.split("~")[0] ?? "").split("|")[2] ?? "");
  const early = events.filter((e) => e.t <= DEMO_LENGTH_TICKS).length;
  ok(early >= 3, `${row.game_type}: ${early} inputs in the first ${DEMO_LENGTH_TICKS} ticks`);
  ok(row.input_log.run.length <= DEMO_MAX_CHARS, `${row.game_type}: the run fits DEMO_MAX_CHARS`);
}

section("5. The demo rules play only the dealt stamps");
{
  const src = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
  ok(/data\.type === "whack" && demo\?\.puzzle\.type === "whack" && demo\.puzzle\.whackRev !== WHACK_REV_NOTES\) return null/.test(src), "Bonk's demo plays only on whackRev 4");
  ok(/data\.type === "tendrop" && demo\?\.puzzle\.type === "tendrop" && demo\.puzzle\.tenRev !== TEN_DROP_RESET_REV\) return null/.test(src), "Tenfall's demo plays only on tenRev 6 (older demos stop)");
  ok(/data\.type === "clayshoot" && demo\?\.puzzle\.type === "clayshoot" && demo\.puzzle\.clayRev !== CLAY_REV_WIDE\) return null/.test(src), "Pull!'s demo plays only on clayRev 10 (older demos stop)");
  ok(WHACK_REV_NOTES === 4 && TEN_DROP_RESET_REV === 6 && CLAY_REV_WIDE === 10, "the rules' stamps are 4, 6 and 10");
  for (const row of fixture.rows) {
    const [field, rev] = STAMP[row.game_type]!;
    ok((generatePuzzle(row.game_type as PuzzleData["type"], {}) as unknown as Record<string, unknown>)[field] === rev, `${row.game_type}: rooms deal the stamp the rule plays`);
  }
}

section("6. The fixture rebuilds from the bots");
ok(speedDemoText(recordSpeedDemos()) === text, "scripts/fixtures/speed-demos.json rebuilds byte for byte (bun scripts/speed-demos-record.ts)");

if (failures.length) {
  console.log(`\nFAIL speed-demos: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`\nspeed-demos: ${checks} checks passed — Bonk, Tenfall and Pull! demos on whackRev 4, tenRev 6 and clayRev 10, each scoring exactly the server's replay`);
