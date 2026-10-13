/**
 * Replays never serve another player's log or answer before the round has
 * closed for everyone (docs/replays.md):
 *
 *  1. The gate (src/lib/replay/access.ts) over every status and phase: a round
 *     opens on its results screen ("result") or later, never during "puzzle" or
 *     "reveal" (the reveal still accepts a lagging phone's answer); the whole
 *     game opens only once the room is finished.
 *  2. The server code itself (src/lib/replay/replay.server.ts), driven with an
 *     in-memory database: before the round closes it refuses and never reads
 *     round_results at all; after, it returns the round winner (ties broken as
 *     the standings break them) and only the winner's answer; a non-member is
 *     refused; the podium call refuses until the room is finished.
 *  3. Source scan: replay screens get answers only through roundReplayFn /
 *     gameReplaysFn (never the Supabase client or round_results directly), and
 *     both server functions go through the gated loaders.
 *
 *   bun scripts/replay-access-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readdirSync, readFileSync } from "node:fs";

import { replayGameClosed, replayRoundClosed } from "../src/lib/replay/access";
import { loadGameReplays, loadRoundReplay } from "../src/lib/replay/replay.server";
import type { DuelPhase } from "../src/lib/duel/types";

const failures: string[] = [];
let checks = 0;
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};

/* 1: the gate */
const PHASES: DuelPhase[] = [
  "starting",
  "round_title",
  "intro",
  "puzzle",
  "reveal",
  "result",
  "standings",
  "winner_reveal",
];
for (const phase of PHASES) {
  const open = phase === "result" || phase === "standings" || phase === "winner_reveal";
  ok(
    replayRoundClosed({ status: "in_progress", current_round: 3, phase }, 3) === open,
    `round 3 in phase ${phase}: gate says ${!open}`,
  );
  ok(
    replayRoundClosed({ status: "in_progress", current_round: 3, phase }, 2),
    `round 2 while round 3 is in ${phase}: should be open`,
  );
  ok(
    !replayRoundClosed({ status: "in_progress", current_round: 3, phase }, 4),
    `round 4 while round 3 is in ${phase}: should be closed`,
  );
}
for (const status of ["waiting", "countdown"] as const)
  ok(
    !replayRoundClosed({ status, current_round: 1, phase: "result" }, 1),
    `status ${status}: should be closed`,
  );
ok(
  replayRoundClosed({ status: "finished", current_round: 6, phase: "result" }, 6),
  "finished room: open",
);
ok(
  !replayRoundClosed({ status: "finished", current_round: 6, phase: "result" }, 0),
  "round 0: closed",
);
ok(
  replayGameClosed({ status: "finished" }) &&
    !replayGameClosed({ status: "in_progress" }) &&
    !replayGameClosed({ status: "waiting" }),
  "game gate: only a finished room",
);

/* 2: the server loaders against an in-memory database */
interface Db {
  duels: any[];
  duel_players: any[];
  duel_secrets: any[];
  round_results: any[];
}
function stub(db: Db) {
  const reads: string[] = [];
  const client = {
    from(table: keyof Db) {
      let rows = [...db[table]];
      const q: any = {
        select: () => q,
        eq: (col: string, v: unknown) => ((rows = rows.filter((r) => r[col] === v)), q),
        in: (col: string, vs: unknown[]) => ((rows = rows.filter((r) => vs.includes(r[col]))), q),
        order: () => q,
        maybeSingle: () => {
          reads.push(table);
          return Promise.resolve({ data: rows[0] ?? null, error: null });
        },
        then: (resolve: (v: unknown) => void) => {
          reads.push(table);
          resolve({ data: rows, error: null });
        },
      };
      return q;
    },
  };
  return { client, reads };
}
const RUN = "12345|80|1:7:100:0:0:0|3600|";
function room(phase: DuelPhase, status = "in_progress", round = 2): Db {
  return {
    duels: [
      {
        id: "r1",
        status,
        current_round: round,
        phase,
        round_count: 2,
        puzzles_public: [
          { type: "hover", seed: 1 },
          { type: "rally", seed: 12345, rallyRev: 3 },
        ],
      },
    ],
    duel_players: [
      { duel_id: "r1", user_id: "u1", player_slot: 1, display_name: "Ana", status: "active" },
      { duel_id: "r1", user_id: "u2", player_slot: 2, display_name: "Bo", status: "active" },
      { duel_id: "r1", user_id: "u3", player_slot: 3, display_name: "Cy", status: "active" },
    ],
    duel_secrets: [{ duel_id: "r1", puzzles_private: [{}, {}] }],
    round_results: [
      {
        duel_id: "r1",
        round_number: 1,
        player_slot: 1,
        answer: "1|0||0|",
        score: 40,
        is_correct: false,
        ms_remaining: 0,
        reaction_avg_ms: null,
        extra: null,
      },
      // Round 2: Bo and Cy tie on score; Cy answered quicker, so the standings put Cy first.
      {
        duel_id: "r1",
        round_number: 2,
        player_slot: 1,
        answer: "secret-ana",
        score: 60,
        is_correct: false,
        ms_remaining: 1000,
        reaction_avg_ms: null,
        extra: null,
      },
      {
        duel_id: "r1",
        round_number: 2,
        player_slot: 2,
        answer: "secret-bo",
        score: 80,
        is_correct: false,
        ms_remaining: 1000,
        reaction_avg_ms: null,
        extra: null,
      },
      {
        duel_id: "r1",
        round_number: 2,
        player_slot: 3,
        answer: RUN,
        score: 80,
        is_correct: false,
        ms_remaining: 9000,
        reaction_avg_ms: null,
        extra: null,
      },
    ],
  };
}

for (const phase of PHASES) {
  const { client, reads } = stub(room(phase));
  const res = await loadRoundReplay(client, "u1", { roomId: "r1", roundNumber: 2 });
  const open = phase === "result" || phase === "standings" || phase === "winner_reveal";
  ok(res.ok === open, `loadRoundReplay in ${phase}: ok=${res.ok}`);
  if (!open)
    ok(
      !reads.includes("round_results") && !reads.includes("duel_secrets"),
      `loadRoundReplay in ${phase}: read ${reads.join(",")} before the round closed`,
    );
  if (open && res.ok) {
    const json = JSON.stringify(res.data);
    ok(
      res.data?.winner?.slot === 3 && res.data.winner.answer === RUN,
      `loadRoundReplay in ${phase}: winner ${res.data?.winner?.slot} (ties must break as the standings do)`,
    );
    ok(
      !json.includes("secret-ana") && !json.includes("secret-bo"),
      `loadRoundReplay in ${phase}: served a non-winner's answer`,
    );
    ok(res.data?.runnerUp === 80, `loadRoundReplay in ${phase}: runner-up ${res.data?.runnerUp}`);
  }
}
{
  const { client, reads } = stub(room("result"));
  const res = await loadRoundReplay(client, "stranger", { roomId: "r1", roundNumber: 2 });
  ok(
    !res.ok && !reads.includes("round_results"),
    "a non-member is refused without reading results",
  );
}
for (const status of ["in_progress", "waiting"]) {
  const { client, reads } = stub(room("result", status));
  const res = await loadGameReplays(client, "u1", { roomId: "r1" });
  ok(
    !res.ok && !reads.includes("round_results"),
    `loadGameReplays with status ${status}: should refuse before reading results`,
  );
}
{
  const { client } = stub(room("result", "finished"));
  const res = await loadGameReplays(client, "u2", { roomId: "r1" });
  ok(
    res.ok &&
      res.data.length === 2 &&
      res.data[1]!.winner?.slot === 3 &&
      res.data[0]!.winner?.slot === 1,
    "loadGameReplays on a finished room: every round with its winner",
  );
}

/* 3: source scan */
const files = [
  ...readdirSync("src/components/replay").map((f) => `src/components/replay/${f}`),
  ...readdirSync("src/lib/replay").map((f) => `src/lib/replay/${f}`),
];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  ok(
    (!/integrations\/supabase\/client["']/.test(text) &&
      !/from\(["']round_results["']\)/.test(text)) ||
      file.endsWith("replay.server.ts"),
    `${file}: reads the database outside the gated loader`,
  );
}
const fnSource = readFileSync("src/lib/replay/replay.functions.ts", "utf8");
ok(
  /loadRoundReplay\(/.test(fnSource) &&
    /loadGameReplays\(/.test(fnSource) &&
    (fnSource.match(/requireSupabaseAuth\]/g) ?? []).length === 2,
  "replay.functions.ts: both functions must be authenticated and go through the gated loaders",
);
const serverSource = readFileSync("src/lib/replay/replay.server.ts", "utf8");
const gateAt = serverSource.indexOf("replayRoundClosed(room");
const readAt = serverSource.indexOf("buildRounds(client, room, [input.roundNumber])");
ok(
  gateAt > 0 && readAt > gateAt,
  "replay.server.ts: the round gate must come before any read of results",
);

if (failures.length) {
  console.log(failures.join("\n"));
  console.log(`FAIL: ${failures.length} of ${checks} replay access checks`);
  process.exit(1);
}
console.log(
  `Replay access: ${checks} checks passed — logs and answers are served only after a round closes for everyone (results screen on), the podium only once the game is finished, only the round winner's answer, never to a non-member`,
);
