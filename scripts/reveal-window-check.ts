/**
 * No other player's answer is readable while late answers are still accepted
 * (found in #43; 13 Oct 2026). submit_answer takes a lagging phone's answer
 * through the reveal phase, so other players' answers open only on the results
 * screen ("result") or later. Proves:
 *
 *  1. The two windows never overlap: over every status, phase and round,
 *     acceptsAnswers and othersAnswersReadable (answerWindow.ts) are never
 *     both true, and the replay gate is the same cutoff.
 *  2. The database: the newest migration defining public.duel_round_ended
 *     opens a round only in 'result', 'standings' or 'winner_reveal' (never
 *     'puzzle' or 'reveal'), only while in progress, or once finished; its
 *     predicate, evaluated over every state, matches othersAnswersReadable;
 *     the round_results read policy is still "own row, or the round ended",
 *     and no later migration adds another read path to round_results.
 *  3. The reveal server code (reveal.server.ts) driven with an in-memory
 *     database: before the cutoff it returns only the caller's own detail
 *     (no other player's answer, summary or score), plus, for arcade rounds,
 *     where the others' runs ended on the track; from the results screen on it
 *     returns every player's detail.
 *  4. A player with no answer in: before the cutoff the reveal carries no
 *     correct answer and no private solution (duel_secrets is never read);
 *     once their own answer is stored, or the cutoff passes, it does. Over
 *     every status, phase and round, whenever the reveal would hand a player
 *     with no answer the solution, submit_answer no longer takes an answer,
 *     so a late answer sent after fetching it is refused. The word checker
 *     (the other path to the private solution) works only in the puzzle phase.
 *  5. Wiring: submit_answer is gated by acceptsAnswers before grading,
 *     revealAnswerFn goes through loadRoundReveal with the caller's slot, and
 *     the phone fetches the reveal and the results again once its answer is
 *     stored or the round closes.
 *
 *   bun scripts/reveal-window-check.ts
 */
import { readdirSync, readFileSync } from "node:fs";

import { ANSWER_PHASES, OPEN_ANSWER_PHASES, acceptsAnswers, othersAnswersReadable } from "../src/lib/duel/answerWindow";
import { loadRoundReveal } from "../src/lib/duel/reveal.server";
import { replayRoundClosed } from "../src/lib/replay/access";
import type { DuelPhase, DuelRow } from "../src/lib/duel/types";
import { memoryDb } from "./fixtures/memoryDb";

let failures = 0;
let passes = 0;
function check(ok: boolean, message: string) {
  if (ok) passes++;
  else {
    failures++;
    console.log(`  FAIL ${message}`);
  }
}

const PHASES: DuelPhase[] = ["starting", "round_title", "intro", "puzzle", "reveal", "result", "standings", "winner_reveal"];
const STATUSES = ["waiting", "countdown", "in_progress", "finished"] as const;
type RoomState = Pick<DuelRow, "status" | "current_round" | "phase">;
const STATES: { room: RoomState; round: number }[] = [];
for (const status of STATUSES)
  for (const phase of PHASES)
    for (const round of [0, 1, 2, 3, 4]) STATES.push({ room: { status, current_round: 3, phase } as RoomState, round });

/* 1: the windows never overlap */
{
  let overlap = 0;
  let replayDiffers = 0;
  for (const { room, round } of STATES) {
    if (acceptsAnswers(room, round) && othersAnswersReadable(room, round)) overlap++;
    if (othersAnswersReadable(room, round) !== replayRoundClosed(room, round)) replayDiffers++;
  }
  check(overlap === 0, `late answers accepted while others' answers are readable in ${overlap} states`);
  check(replayDiffers === 0, "the reveal and the replays share one cutoff");
  for (const phase of PHASES) {
    const room = { status: "in_progress", current_round: 3, phase } as RoomState;
    check(
      acceptsAnswers(room, 3) === (phase === "puzzle" || phase === "reveal"),
      `round 3 in ${phase}: answers ${acceptsAnswers(room, 3) ? "" : "not "}accepted`,
    );
    check(!acceptsAnswers(room, 2) && !acceptsAnswers(room, 4), `phase ${phase}: only the current round takes answers`);
  }
  check(!acceptsAnswers({ status: "finished", current_round: 3, phase: "reveal" } as RoomState, 3), "a finished room takes no answers");
  check(
    (ANSWER_PHASES as readonly string[]).every((p) => !(OPEN_ANSWER_PHASES as readonly string[]).includes(p)),
    "answer phases and open phases are disjoint",
  );
}

/* 2: the database read policy */
{
  const dir = "supabase/migrations";
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const defining = files.filter((f) =>
    /CREATE OR REPLACE FUNCTION public\.duel_round_ended/i.test(readFileSync(`${dir}/${f}`, "utf8")),
  );
  const latest = defining.at(-1)!;
  const sql = readFileSync(`${dir}/${latest}`, "utf8");
  const body = sql.slice(sql.search(/CREATE OR REPLACE FUNCTION public\.duel_round_ended/i));
  const phaseList = /d\.phase IN \(([^)]*)\)/.exec(body)?.[1] ?? "";
  const phases = [...phaseList.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!);
  check(
    JSON.stringify([...phases].sort()) === JSON.stringify([...OPEN_ANSWER_PHASES].sort()),
    `${latest}: duel_round_ended opens on [${phases.join(", ")}], want [${OPEN_ANSWER_PHASES.join(", ")}]`,
  );
  check(!phases.includes("reveal") && !phases.includes("puzzle"), `${latest}: never opens during 'puzzle' or 'reveal'`);
  check(/d\.status = 'finished'/.test(body), `${latest}: a finished room is open`);
  check(/d\.status = 'in_progress'\s*AND/.test(body), `${latest}: the round checks apply only while in progress`);
  check(/is_duel_participant\(_duel_id\)/.test(body), `${latest}: members only`);
  check(/_round >= 1/.test(body), `${latest}: round 0 never opens`);
  // The SQL predicate, read from the migration's own structure, over every state.
  const sqlOpen = (room: RoomState, round: number) =>
    round >= 1 &&
    (room.status === "finished" ||
      (room.status === "in_progress" &&
        (room.current_round > round || (room.current_round === round && phases.includes(room.phase)))));
  let differs = 0;
  let leaks = 0;
  for (const { room, round } of STATES) {
    if (sqlOpen(room, round) !== othersAnswersReadable(room, round)) differs++;
    if (sqlOpen(room, round) && acceptsAnswers(room, round)) leaks++;
  }
  check(differs === 0, `duel_round_ended differs from othersAnswersReadable in ${differs} states`);
  check(leaks === 0, `round_results readable by other members while answers are accepted in ${leaks} states`);

  // The read policy itself, and nothing later opening another read path.
  const all = files.map((f) => ({ f, sql: readFileSync(`${dir}/${f}`, "utf8") }));
  const policy = all.filter(({ sql }) => /CREATE POLICY[^;]*ON public\.round_results[^;]*FOR SELECT/i.test(sql)).at(-1);
  check(
    !!policy &&
      /player_slot = public\.my_duel_slot\(duel_id\)\s*OR public\.duel_round_ended\(duel_id, round_number\)/.test(policy.sql),
    "round_results read policy: own row, or the round has ended (duel_round_ended)",
  );
  const policyIndex = policy ? files.indexOf(policy.f) : -1;
  // Any permissive policy on round_results after it would add a read path.
  const laterReads = all
    .slice(policyIndex + 1)
    .filter(({ sql }) =>
      (sql.match(/CREATE POLICY[^;]*ON public\.round_results[^;]*;/gi) ?? []).some((stmt) => !/AS RESTRICTIVE/i.test(stmt)),
    );
  check(laterReads.length === 0, `later migrations add round_results read policies: ${laterReads.map((r) => r.f).join(", ")}`);
}

/* 3: the reveal server code */
function db(phase: DuelPhase, status: DuelRow["status"] = "in_progress") {
  const row = (slot: number, answer: string, score: number, axis?: number) => ({
    duel_id: "r1",
    round_number: 2,
    player_slot: slot,
    answer,
    score,
    is_correct: false,
    ms_remaining: 1000,
    reaction_avg_ms: null,
    correct_count: 3,
    errors: 0,
    extra: axis === undefined ? null : { reveal: { axis: { value: axis, max: 20, label: "gates" }, lines: [`secret-line-${slot}`], tiles: [], outcome: "time" } },
  });
  return memoryDb({
    duels: [],
    duel_secrets: [{ duel_id: "r1", puzzles_private: [{}, {}] }],
    round_results: [row(1, "mine-answer", 61, 7), row(2, "secret-bo", 87, 12), row(3, "secret-cy", 93, 15)],
    _room: [{ id: "r1", status, current_round: 2, phase, puzzles_public: [{ type: "hover", seed: 1 }, { type: "hover", seed: 2 }] }],
  });
}
for (const phase of ["reveal", "result", "standings", "winner_reveal"] as DuelPhase[]) {
  const { client, tables } = db(phase);
  const room = tables["_room"]![0] as unknown as DuelRow;
  const res = await loadRoundReveal(client, room, 2, 1);
  const open = othersAnswersReadable(room, 2);
  check(res.ok, `reveal in ${phase}: ok`);
  if (!res.ok) continue;
  const json = JSON.stringify(res.data);
  const slots = res.data.players.map((p) => p.playerSlot);
  if (!open) {
    check(acceptsAnswers(room, 2), `${phase}: the closed case is the late-answer window`);
    check(JSON.stringify(slots) === "[1]", `${phase}: only my own detail (got slots ${slots.join(",")})`);
    check(
      !/secret-bo|secret-cy|secret-line-2|secret-line-3|"score":87|"score":93/.test(json),
      `${phase}: another player's answer or score leaked: ${json.slice(0, 200)}`,
    );
    check(res.data.partial === true, `${phase}: marked partial so the phone fetches again`);
    check(
      JSON.stringify(res.data.progress) ===
        JSON.stringify([
          { playerSlot: 2, axis: { value: 12, max: 20, label: "gates" } },
          { playerSlot: 3, axis: { value: 15, max: 20, label: "gates" } },
        ]),
      `${phase}: the arcade track carries the others' progress only (${JSON.stringify(res.data.progress)})`,
    );
  } else {
    check(JSON.stringify(slots) === "[1,2,3]", `${phase}: every player's detail once closed (got ${slots.join(",")})`);
    check(!res.data.partial && res.data.progress === undefined, `${phase}: a full reveal`);
  }
}
{
  const { client, tables } = db("puzzle");
  const res = await loadRoundReveal(client, tables["_room"]![0] as unknown as DuelRow, 2, 1);
  check(!res.ok, "during the puzzle phase the reveal refuses");
  const finished = db("result", "finished");
  const done = await loadRoundReveal(finished.client, finished.tables["_room"]![0] as unknown as DuelRow, 2, 2);
  check(done.ok && done.data.players.length === 3, "a finished room reveals everyone");
}

/* 4: a player with no answer in */
const SECRET = "SECRET-SOLUTION-STEP";
function noAnswerDb(room: Record<string, unknown>, mineIn: boolean) {
  const row = (slot: number) => ({
    duel_id: "r1", round_number: 2, player_slot: slot, answer: `answer-${slot}`, score: 40, is_correct: false,
    ms_remaining: 0, reaction_avg_ms: null, correct_count: null, errors: null, extra: null,
  });
  const store = memoryDb({
    duels: [],
    duel_secrets: [{ duel_id: "r1", puzzles_private: [{}, { solution: [SECRET] }] }],
    // Slot 2 has answered; slot 1 (the caller) only when mineIn.
    round_results: mineIn ? [row(1), row(2)] : [row(2)],
  });
  const reads: string[] = [];
  const client = { from: (table: string) => (reads.push(table), store.client.from(table)) };
  const fullRoom = {
    id: "r1",
    puzzles_public: [{ type: "target", numbers: [1, 2], target: 3 }, { type: "target", numbers: [2, 3, 4], target: 24 }],
    ...room,
  } as unknown as DuelRow;
  return { client, reads, room: fullRoom };
}
{
  const reveal = noAnswerDb({ status: "in_progress", current_round: 2, phase: "reveal" }, false);
  const res = await loadRoundReveal(reveal.client, reveal.room, 2, 1);
  const json = JSON.stringify(res);
  check(res.ok && res.data.awaitingAnswer === true && res.data.partial === true, "no answer, reveal phase: marked awaiting so the phone fetches again");
  check(res.ok && res.data.correctAnswer === null && res.data.players.length === 0 && !json.includes(SECRET),
    `no answer, reveal phase: no correct answer or solution (${json.slice(0, 160)})`);
  check(!reveal.reads.includes("duel_secrets"), "no answer, reveal phase: the private solution is never read");
  check(res.ok && JSON.stringify(res.data.puzzle) === JSON.stringify(reveal.room.puzzles_public[1]), "no answer, reveal phase: only the public puzzle the phone already holds");
  check(acceptsAnswers(reveal.room, 2), "no answer, reveal phase: this is the late-answer window");

  const answered = noAnswerDb({ status: "in_progress", current_round: 2, phase: "reveal" }, true);
  const mine = await loadRoundReveal(answered.client, answered.room, 2, 1);
  check(mine.ok && !mine.data.awaitingAnswer && JSON.stringify(mine).includes(SECRET) && mine.data.players.map((p) => p.playerSlot).join() === "1",
    "answered, reveal phase: the solution and my own detail, as before");

  for (const phase of ["result", "standings", "winner_reveal"] as DuelPhase[]) {
    const after = noAnswerDb({ status: "in_progress", current_round: 2, phase }, false);
    const res2 = await loadRoundReveal(after.client, after.room, 2, 1);
    check(res2.ok && !res2.data.awaitingAnswer && !res2.data.partial && JSON.stringify(res2).includes(SECRET) && res2.data.players.map((p) => p.playerSlot).join() === "2",
      `no answer, ${phase}: the full reveal once late answers stop`);
  }
  const finished = noAnswerDb({ status: "finished", current_round: 2, phase: "reveal" }, false);
  const res3 = await loadRoundReveal(finished.client, finished.room, 2, 1);
  check(res3.ok && JSON.stringify(res3).includes(SECRET), "no answer, finished room: the full reveal");

  // Fetch, then answer: wherever a player with no answer can read the solution,
  // submit_answer refuses (and wherever it still takes answers, the reveal holds it back).
  let exposedWhileOpen = 0;
  let exposures = 0;
  for (const status of STATUSES)
    for (const phase of PHASES)
      for (const current of [1, 2, 3]) {
        const state = noAnswerDb({ status, current_round: current, phase }, false);
        const got = await loadRoundReveal(state.client, state.room, 2, 1);
        const exposed = got.ok && JSON.stringify(got).includes(SECRET);
        if (exposed) exposures++;
        if (exposed && acceptsAnswers(state.room, 2)) exposedWhileOpen++;
        if (acceptsAnswers(state.room, 2) && state.reads.includes("duel_secrets")) exposedWhileOpen++;
      }
  check(exposures > 0, "the fetch-then-answer sweep does reach states where the solution is shown");
  check(exposedWhileOpen === 0, `a player with no answer could read the solution and still send a late answer in ${exposedWhileOpen} states`);
}

/* 5: wiring */
{
  const server = readFileSync("src/lib/duel/duel.functions.ts", "utf8");
  const submit = server.slice(server.indexOf("export const submitAnswerFn"), server.indexOf("export const readyUpFn"));
  const gate = submit.indexOf("if (!acceptsAnswers(room, data.roundNumber))");
  check(gate > 0 && gate < submit.indexOf("gradeAnswer("), "submit_answer is gated by acceptsAnswers before grading");
  const reveal = server.slice(server.indexOf("export const revealAnswerFn"), server.indexOf("export const rematchFn"));
  check(/return loadRoundReveal\(client, room, data\.roundNumber, me\.player_slot\)/.test(reveal), "revealAnswerFn goes through loadRoundReveal with the caller's slot");
  check(!/round_results/.test(reveal), "revealAnswerFn reads no results itself");
  const route = readFileSync("src/routes/duel.$code.tsx", "utf8");
  check(/!revealed\.data\.partial \|\|\s*\(phase === "reveal" && !\(revealed\.data\.awaitingAnswer && myResult\)\)/.test(route),
    "the phone fetches the reveal again once its answer is stored or the round closes");
  check(/answersReady=\{!!currentReveal && !currentReveal\.awaitingAnswer\}/.test(route), "an awaiting reveal shows no answer (the reveal waits, the score line shows Scoring…)");
  const word = server.slice(server.indexOf("export const checkWordFn"), server.indexOf("export const checkMovesFn"));
  check(/room\.phase !== "puzzle"/.test(word.slice(0, word.indexOf("privatePuzzles("))), "the word checker reads the private solution only in the puzzle phase");
  for (const fn of ["checkMovesFn"]) {
    const body = server.slice(server.indexOf(`export const ${fn}`));
    check(/room\.phase !== "puzzle"/.test(body.slice(0, body.indexOf("privatePuzzles("))), `${fn} reads the private solution only in the puzzle phase`);
  }
  const fnsWithSecrets = [...server.matchAll(/export const (\w+Fn)[\s\S]*?(?=export const |$)/g)]
    .filter((m) => /privatePuzzles\(|duel_secrets/.test(m[0]))
    .map((m) => m[1]);
  check(JSON.stringify(fnsWithSecrets.sort()) === JSON.stringify(["checkMovesFn", "checkWordFn", "startRoomFn", "submitAnswerFn"]),
    `room server functions touching the private solution: ${fnsWithSecrets.join(", ")}`);
  check(/currentReveal\?\.progress\?\.find/.test(route), "the arcade reveal track uses the reveal's progress for the others");
  const hook = readFileSync("src/lib/duel/useDuel.ts", "utf8");
  check(/\[userId, duel\?\.status, duel\?\.current_round, duel\?\.phase\]/.test(hook), "the phone fetches the results again on every phase change");
  const access = readFileSync("src/lib/replay/replay.server.ts", "utf8");
  check(/replayRoundClosed/.test(access), "replays keep the same gate");
}

console.log(`reveal-window-check: ${passes} passed, ${failures} failed`);
if (failures) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: no other player's answer is readable (reveal, replays or the round_results policy) while late answers are still accepted, and a player with no answer can't read the correct answer or solution until then");
