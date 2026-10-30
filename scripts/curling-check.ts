/**
 * curling-check (the Sports group, 30 Oct 2026; docs/arcade-standard/curling.md): Curling curlRev 1.
 *
 *  - the bank: every sheet's witness (scripts/fixtures/curling-witness.json) scores exactly 200 through the server's
 *    replay, unflagged: eight stones each at rest on the button when thrown, every opponent stone out of the house,
 *    holding shot; rooms deal only bank sheets;
 *  - the sheets: two or three opponent stones in the house, apart, the same seed placing the same stones;
 *  - the rules: a throw while a stone travels does nothing; a stone too light to pass the far hog line is removed;
 *    sweeping carries a stone further; no input scores 0, any throw 1+;
 *  - determinism and input repair.
 *
 *   bun scripts/curling-check.ts
 */
import { readFileSync } from "node:fs";
import { witnessRaw, type Witness } from "./curling-bank";
import { curlingCheckpoint, curlingGameFor, curlingOpponents, curlInHouse, CURL_AIM, CURL_INPUT_SWEEP, CURL_INPUT_THROW, CURLING_REV, CURLING_STONES, CU, TEAM_THEIRS, type CurlingState } from "../src/lib/arcade/curling";
import { encodeCurlingRun, replayCurlingRun } from "../src/lib/duel/curling";
import { CURLING_BANK } from "../src/lib/duel/curlingBank.server";
import { generateCurling } from "../src/lib/duel/sports.server";

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
// The fixture holds each sheet's throw plan; witnessRaw plays it into the log the phone would send.
const witness: Record<string, string> = Object.fromEntries(
  (JSON.parse(readFileSync(new URL("./fixtures/curling-witness.json", import.meta.url), "utf8")) as Witness[]).map((w) => [String(w.seed), witnessRaw(w)]),
);

/* The bank. */
ok(CURLING_BANK.length >= 40 && new Set(CURLING_BANK).size === CURLING_BANK.length, `at least 40 unique bank sheets (${CURLING_BANK.length})`);
let perfect = 0;
for (const seed of CURLING_BANK) {
  const run = replayCurlingRun(seed, witness[String(seed)] ?? "", CURLING_REV);
  if (run.score === 200 && !run.flagged && run.onButton === CURLING_STONES && run.takeouts === run.opponents && run.holding) perfect++;
}
ok(perfect === CURLING_BANK.length, `every bank witness: eight on the button, every opponent out, holding shot, 200 through the server replay (${perfect} of ${CURLING_BANK.length})`);
for (let i = 0; i < 50; i++) {
  const p = generateCurling();
  ok(CURLING_BANK.includes(p.seed) && p.curlRev === CURLING_REV, `rooms deal a bank sheet (${p.seed})`);
}

/* The sheets. */
for (const seed of CURLING_BANK) {
  const opp = curlingOpponents(seed);
  ok(JSON.stringify(opp) === JSON.stringify(curlingOpponents(seed)), `sheet ${seed}: the same seed places the same stones`);
  ok(opp.length >= 2 && opp.length <= 3 && opp.every((o) => curlInHouse(o.x * CU, o.y * CU)), `sheet ${seed}: two or three opponent stones, all in the house`);
  const s = curlingGameFor().init(seed);
  ok(s.team.every((t) => t === TEAM_THEIRS) && s.theirs === opp.length, `sheet ${seed}: only the opponent's stones before the first throw`);
}

/* The rules. */
const game = curlingGameFor();
const throwAt = (s: CurlingState, bx: number, by: number, weight: number, turn: number) => game.step(s, { t: s.tick + 1, k: CURL_INPUT_THROW, a: bx, b: by, c: weight * 2 + turn, d: 0 });
const settle = (s: CurlingState, sweep = false) => {
  let x = s;
  while (x.phase !== CURL_AIM && !x.over) x = game.step(x, sweep ? { t: x.tick + 1, k: CURL_INPUT_SWEEP, a: 100, b: 0, c: 0, d: 0 } : null);
  return x;
};
{
  const s0 = game.init(CURLING_BANK[0]!);
  const travelling = throwAt(s0, 0, 0, 500, 0);
  const again = throwAt(travelling, 50, 0, 900, 1);
  ok(again.thrown === travelling.thrown, "a throw while a stone travels is ignored");
  const light = settle(throwAt(s0, 0, 0, 1, 0));
  ok(light.thrown === 1 && light.live[light.live.length - 1] === 0, "a stone too light for the far hog line is out of play");
  // Sweeping: the same throw, swept all the way, comes to rest further down the sheet (or out of play).
  const plain = settle(throwAt(s0, 0, 300, 300, 0));
  const swept = settle(throwAt(s0, 0, 300, 300, 0), true);
  const i = plain.y.length - 1;
  ok(swept.live[i] === 0 || swept.y[i]! < plain.y[i]! || plain.live[i] === 0, "sweeping carries the stone further");
  let idle = game.init(CURLING_BANK[0]!);
  while (!idle.over) idle = game.step(idle, null);
  ok(game.score(idle) === 0, "no input scores 0");
  let played = settle(throwAt(game.init(CURLING_BANK[0]!), 200, 0, 1, 0));
  while (!played.over) played = game.step(played, null);
  ok(game.score(played) >= 1, `any throw scores at least 1 (${game.score(played)})`);
}

/* Determinism and input repair. */
{
  const seed = CURLING_BANK[1]!;
  const a = replayCurlingRun(seed, witness[String(seed)]!, CURLING_REV);
  const b = replayCurlingRun(seed, witness[String(seed)]!, CURLING_REV);
  ok(JSON.stringify(a.checkpoints) === JSON.stringify(b.checkpoints) && JSON.stringify(curlingCheckpoint(a.state)) === JSON.stringify(curlingCheckpoint(b.state)), "the same log replays the same twice");
  const r = replayCurlingRun(seed, encodeCurlingRun({ seed, claimedScore: 0, events: [{ t: 3, k: 1, a: 99999, b: -99999, c: 99999, d: 0 }], endTick: 0, checkpoints: [] }), CURLING_REV);
  ok(r.inputDiag.clamped === 1 && r.inputDiag.dropped === 0 && r.flagged, "an out-of-range throw is clamped, replayed and flagged");
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`FAIL: ${f}`);
  console.log(`FAIL: ${failures.length} of ${checks} curling checks`);
  process.exit(1);
}
console.log(`PASS: ${checks} curling checks`);
