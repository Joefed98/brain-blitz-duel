/**
 * server-functions-check (7 Nov 2026; docs/audit-nov-2026/build-health.md items 3 and 4): runs the real room,
 * daily, async-room, challenge and chat server functions, through their real `requireSupabaseAuth` middleware
 * and real supabase-js clients, against a local PostgreSQL 16 with every migration applied in order
 * (scripts/server-fn-harness.ts: the Start server split, the request context and a PostgREST / GoTrue stand-in
 * that applies roles, RLS and column grants as Supabase does). It is the safety net for the Supabase move: it
 * fails the day a migration, policy or client call drifts from what the handlers expect.
 *
 * What it proves:
 * - auth: no token, a forged token and a token for an unknown user are refused by the middleware;
 * - the core room flow in duel.functions.ts: create, preview, join (and joining again), settings, remove, start
 *   (host only, dealt once under racing starts, answers kept in duel_secrets), ready, every phase through the
 *   timers, submit (racing duplicate submits give one row, one row per active player per round, the stored score
 *   equals practice's grade of the stored answer, input_type written), reveal (refused before the round ends),
 *   continue, the winner reveal and finish, Play again (host only; results cleared, winner archived, players
 *   kept), leave (a leaving host disbands), heartbeat, the stale-host RPC and disband (host only);
 * - heartbeats (Speed fix 3): stored in duel_presence, outside the realtime publication, the room's last-seen times in
 *   the reply (members only), the stale-host RPC reading both columns, and the player-row write before the migration;
 * - RLS through a device's own client: no direct writes to rooms or results, no reading duel_secrets;
 * - chat: send (members only, the gap rule), report (read through the caller's RLS), host-only mute, reactions;
 * - the daily: status, start (one attempt per device), board;
 * - async rooms: attempt, round start, submit (input_type written), reveal, until finished;
 * - a friend challenge: create, play, info from a friend's device, start, roster, round board, final board;
 * - recordInputType's failures are logged and returned, never swallowed, and never fail a submission.
 *
 * Needs the PostgreSQL 16 binaries (preinstalled on GitHub's ubuntu runners). Without them it fails on CI and
 * prints a NOTE locally. No browser.
 */

import {
  ANON_KEY,
  callServerFn,
  installServerFnPlugin,
  postgresBin,
  SERVICE_KEY,
  startLocalDb,
  startRestServer,
  userToken,
  type LocalDb,
  type RestServer,
} from "./server-fn-harness";

let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) passes++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}
async function section(name: string, body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } catch (err) {
    check(
      false,
      `${name}: threw ${err instanceof Error ? (err.stack ?? err.message).split("\n").slice(0, 3).join(" | ") : String(err)}`,
    );
  }
}
async function rejects(promise: Promise<unknown>, pattern: RegExp): Promise<boolean> {
  try {
    await promise;
    return false;
  } catch (err) {
    return pattern.test(err instanceof Error ? err.message : String(err));
  }
}

// The handlers log room selection and stale-version notes; keep the output to the check's own lines.
const quietLog = console.log;
const quietWarn = console.warn;
const quietError = console.error;
const captured: string[] = [];
console.log = (...args: unknown[]) => {
  const line = args.map(String).join(" ");
  if (/^\s*(FAIL|NOTE)|^server-functions-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = (...args: unknown[]) => {
  captured.push(args.map(String).join(" "));
};
const restore = () => {
  console.log = quietLog;
  console.warn = quietWarn;
  console.error = quietError;
};

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ALI = uid(1);
const BO = uid(2);
const CY = uid(3);
const DEE = uid(4);
const GHOST = uid(99); // never in auth.users

let db: LocalDb | null = null;
let rest: RestServer | null = null;

if (!postgresBin()) {
  restore();
  if (process.env["CI"]) {
    console.log(
      "server-functions-check: 0 passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL",
    );
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: server functions not run (CI runs them)");
  console.log("server-functions-check: skipped locally");
  process.exit(0);
}

try {
  db = startLocalDb("server-fn-check-");
  check(
    db.failed === null,
    `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""} (${db.applied.length} applied)`,
  );
  rest = await startRestServer(db.socketDir);
  process.env["SUPABASE_URL"] = rest.url;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
  db.psql(`INSERT INTO auth.users (id) VALUES ('${ALI}'), ('${BO}'), ('${CY}'), ('${DEE}')`);
  await installServerFnPlugin();
  await runAll(db, rest);
} catch (err) {
  check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await rest?.stop();
  db?.stop();
}

async function runAll(db: LocalDb, rest: RestServer): Promise<void> {
  const duel = await import("../src/lib/duel/duel.functions");
  const presence = await import("../src/lib/duel/presence.server");
  const chat = await import("../src/lib/duel/chat.functions");
  const daily = await import("../src/lib/duel/daily.functions");
  const asyncFns = await import("../src/lib/duel/asyncRoom.functions");
  const challenge = await import("../src/lib/duel/challenge.functions");
  const { supabaseAdmin } = await import("../src/integrations/supabase/client.server");
  const { createClient } = await import("@supabase/supabase-js");
  const { mergePuzzle } = await import("../src/lib/duel/secrets");
  const { gradeAnswer } = await import("../src/lib/duel/generate.server");
  const { recordInputType } = await import("../src/lib/duel/inputType.server");
  const types = await import("../src/lib/duel/types");
  const { puzzleTimeLimitMs } = await import("../src/lib/duel/registry");
  const { GAMES } = await import("./arcade-skill-bands/games");
  const { Human } = await import("./arcade-skill-bands/human");
  const { LIVE_BANDS } = await import("../src/lib/arcade/liveBands");
  const { appendClientCounters, arcadeCounters } = await import("../src/lib/arcade/diagnostics");
  const { existsSync } = await import("node:fs");
  type SkillBot = import("./arcade-skill-bands/bot").SkillBot;

  /**
   * A real input log for a dealt arcade round: the skill-band bot at the good level plays the stored seed on the
   * stored stamp, encoded as the phone sends it (the bands tool's path). "" for a game with no bot.
   */
  const botAnswer = async (puzzle: Record<string, unknown>): Promise<string> => {
    const type = String(puzzle["type"]);
    const spec = GAMES.find((g) => g.type === type);
    const botFile = new URL(`./arcade-skill-bands/bots/${type}.ts`, import.meta.url);
    if (!spec || type === "balltrack" || !existsSync(botFile)) return "";

    const { bot } = (await import(botFile.href)) as { bot: SkillBot };
    const seed = Number(puzzle["seed"]);
    const field = (LIVE_BANDS as Record<string, { field: string } | undefined>)[type]?.field;
    const rev = field && typeof puzzle[field] === "number" ? (puzzle[field] as number) : null;
    let game: ReturnType<typeof spec.gameFor>;
    try {
      game = spec.gameFor(rev, seed);
    } catch {
      return ""; // a game whose bands spec needs a bank course the stored seed doesn't name (Orbit): an empty run
    }
    const out = bot({ game, seed, rev, human: new Human(type, seed, "good"), fixes: true });
    const events = out.events ?? [];
    const taps = out.taps ?? [];
    const byTick = new Map(events.map((e) => [e.t, e]));
    const tapSet = new Set(taps);
    let state = game.init(seed);
    const checkpoints: unknown[] = [];
    while (!game.isOver(state) && state.tick < game.runTicks) {
      const t = state.tick + 1;
      state = game.step(state, spec.taps ? tapSet.has(t) : (byTick.get(t) ?? null));
      if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
    }
    const score = game.score(state);
    const body = {
      seed,
      claimedScore: score,
      events,
      inputs: taps,
      taps: [],
      endTick: state.tick,
      checkpoints,
    };
    return appendClientCounters(spec.encode(body, rev, seed), arcadeCounters(type, state, score));
  };
  let nonZeroRounds = 0;

  const tok = { ali: userToken(ALI), bo: userToken(BO), cy: userToken(CY), dee: userToken(DEE) };
  const call = callServerFn;
  /** One SQL value (psql -tA). */
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out;
  };
  /** A device's own supabase-js client (what the phone holds): RLS and grants apply. */
  const deviceClient = (token: string) =>
    createClient(rest.url, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });

  /* --------------------------------------------------------------- auth */
  await section("auth", async () => {
    check(
      await rejects(
        call(duel.createRoomFn, { displayName: "Nobody" }, null),
        /No authorization header/,
      ),
      "auth: no token is refused by requireSupabaseAuth",
    );
    const forged = `${tok.ali.split(".").slice(0, 2).join(".")}.c2lnbmF0dXJl`;
    check(
      await rejects(call(duel.createRoomFn, { displayName: "Forger" }, forged), /Invalid token/),
      "auth: a token with a forged signature is refused",
    );
    check(
      await rejects(
        call(duel.createRoomFn, { displayName: "Ghost" }, userToken(GHOST)),
        /Invalid token/,
      ),
      "auth: a token for a user not in auth.users is refused",
    );
    check(
      await rejects(call(duel.createRoomFn, { displayName: "Odd" }, "not-a-jwt"), /Invalid token/),
      "auth: a malformed token is refused",
    );
    check(
      Number(q(`SELECT count(*) FROM public.duels`)) === 0,
      "auth: refused calls wrote nothing",
    );
  });

  /* ---------------------------------------------------- the core room flow */
  let roomId = "";
  let roomCode = "";
  await section("create/join", async () => {
    const made = await call(duel.createRoomFn, { displayName: "Ali" }, tok.ali);
    roomId = made.roomId;
    roomCode = made.roomCode;
    check(
      /^[0-9a-f-]{36}$/.test(roomId) && /^[A-Z0-9]{4}$/.test(roomCode),
      `create: returns the room's id and a four-character code (${roomCode})`,
    );
    check(
      q(
        `SELECT status || ',' || host_user_id || ',' || current_round FROM public.duels WHERE id = '${roomId}'`,
      ) === `waiting,${ALI},0`,
      "create: the room is waiting, hosted by the caller, at round 0",
    );
    check(
      q(
        `SELECT player_slot || ',' || display_name || ',' || status FROM public.duel_players WHERE duel_id = '${roomId}'`,
      ) === "1,Ali,active",
      "create: the host is slot 1, active",
    );
    check(
      q(`SELECT count(*) FROM public.room_joins WHERE duel_id = '${roomId}' AND via = 'host'`) ===
        "1",
      "create: the host's join is recorded (room_joins)",
    );

    const preview = await call(duel.roomPreviewFn, { roomCode: roomCode.toLowerCase() }, tok.dee);
    check(
      preview.found === true &&
        preview.playerCount === 1 &&
        preview.state === "lobby" &&
        !("players" in preview),
      `preview: an outsider sees the room joinable with 1 player and no names (${JSON.stringify(preview)})`,
    );
    check(
      (await call(duel.roomPreviewFn, { roomCode: "ZZZZ" }, tok.dee)).found === false,
      "preview: an unknown code is not found",
    );

    const bad = await call(duel.joinRoomFn, { roomCode: "ZZZZ", displayName: "Bo" }, tok.bo);
    check(bad.ok === false && /No room/.test(bad.message), "join: an unknown code is refused");
    const bo = await call(duel.joinRoomFn, { roomCode, displayName: "Bo", via: "code" }, tok.bo);
    check(bo.ok === true && bo.roomId === roomId, "join: a second device joins by code");
    const again = await call(duel.joinRoomFn, { roomCode, displayName: "Bo again" }, tok.bo);
    check(
      again.ok === true &&
        q(
          `SELECT count(*) FROM public.duel_players WHERE duel_id = '${roomId}' AND user_id = '${BO}'`,
        ) === "1",
      "join: joining again keeps the one player row",
    );
    const cy = await call(duel.joinRoomFn, { roomCode, displayName: "Cy", via: "link" }, tok.cy);
    check(cy.ok === true, "join: a third device joins by link");
    check(
      q(
        `SELECT string_agg(player_slot::text || display_name, ',' ORDER BY player_slot) FROM public.duel_players WHERE duel_id = '${roomId}'`,
      ) === "1Ali,2Bo,3Cy",
      "join: slots 1-3 in join order",
    );
    check(
      q(`SELECT count(DISTINCT colour) FROM public.duel_players WHERE duel_id = '${roomId}'`) ===
        "3",
      "join: every player gets their own colour (unique per room)",
    );
  });

  await section("lobby", async () => {
    const notHost = await call(
      duel.setRoomSettingsFn,
      { roomId, picks: ["retro"], rounds: 3 },
      tok.bo,
    );
    check(notHost.ok === false, "settings: a non-host is refused");
    // Arcade groups only, three rounds: every round's stored score is a replay of the stored input log.
    const set = await call(
      duel.setRoomSettingsFn,
      { roomId, picks: ["retro"], rounds: 3 },
      tok.ali,
    );
    check(
      set.ok === true,
      `settings: the host saves Retro only, 3 rounds (${JSON.stringify(set)})`,
    );
    check(
      /rounds:3/.test(
        q(`SELECT selected_categories::text FROM public.duels WHERE id = '${roomId}'`),
      ),
      "settings: stored in selected_categories with the rounds token",
    );
    const look = await call(duel.setPlayerLookFn, { roomId, colour: 5 }, tok.bo);
    check(
      look.ok !== false,
      `look: a player changes colour in the lobby (${JSON.stringify(look)})`,
    );

    const kick = await call(duel.removePlayerFn, { roomId, slot: 3 }, tok.bo);
    check(
      kick.ok === false && /Only the host/.test(kick.message),
      "remove: a non-host can't remove a player",
    );
    const self = await call(duel.removePlayerFn, { roomId, slot: 1 }, tok.ali);
    check(
      self.ok === true &&
        q(
          `SELECT count(*) FROM public.duel_players WHERE duel_id = '${roomId}' AND player_slot = 1`,
        ) === "1",
      "remove: the host can't remove themselves",
    );
    const removed = await call(duel.removePlayerFn, { roomId, slot: 3 }, tok.ali);
    check(
      removed.ok === true &&
        q(
          `SELECT count(*) FROM public.duel_players WHERE duel_id = '${roomId}' AND user_id = '${CY}'`,
        ) === "0",
      "remove: the host removes slot 3",
    );
  });

  await section("rls", async () => {
    const bo = deviceClient(tok.bo);
    const secrets = await bo.from("duel_secrets").select("*").eq("duel_id", roomId);
    check(
      !!secrets.error || (secrets.data ?? []).length === 0,
      `rls: a player can't read duel_secrets (${secrets.error?.code ?? "no rows"})`,
    );
    const write = await bo.from("duels").update({ status: "finished" }).eq("id", roomId);
    check(
      !!write.error && q(`SELECT status FROM public.duels WHERE id = '${roomId}'`) === "waiting",
      `rls: a player can't update a room directly (${write.error?.code})`,
    );
    const insert = await bo
      .from("round_results")
      .insert({ duel_id: roomId, player_slot: 2, round_number: 1, score: 200, is_correct: true });
    check(!!insert.error, `rls: a player can't insert a result directly (${insert.error?.code})`);
    const own = await bo.from("duels").select("id, status").eq("id", roomId);
    check(
      !own.error && (own.data ?? []).length === 1,
      `rls: a player reads their room (${own.error?.message ?? "ok"})`,
    );
    const msg = await bo
      .from("room_messages")
      .insert({ duel_id: roomId, sender_user_id: BO, sender_name: "Bo", text: "hi" });
    check(!!msg.error, `rls: a player can't insert a chat message directly (${msg.error?.code})`);
  });

  /** Moves the room's phase stamp into the past: the room's clock running on by `ms`. */
  const elapse = (ms: number) =>
    q(
      `UPDATE public.duels SET phase_started_at = phase_started_at - interval '${ms} milliseconds', round_started_at = round_started_at - interval '${ms} milliseconds' WHERE id = '${roomId}'`,
    );
  const phaseOf = () =>
    q(
      `SELECT status || ':' || current_round || ':' || coalesce(phase, '') FROM public.duels WHERE id = '${roomId}'`,
    );
  /** Calls advancePhaseFn once the phase's own timer has run out; the phase it reaches. */
  const advanceAfter = async (ms: number) => {
    elapse(ms);
    await call(duel.advancePhaseFn, { roomId }, tok.bo);
    return phaseOf();
  };

  let rounds = 0;
  await section("start", async () => {
    const notHost = await call(duel.startRoomFn, { roomId }, tok.bo);
    check(
      notHost.ok === false && /Only the host/.test(notHost.message),
      "start: a non-host can't start",
    );
    check(
      phaseOf() === "waiting:0:" || phaseOf().startsWith("waiting:0"),
      "start: the room is still waiting after the refusal",
    );
    const [a, b] = await Promise.all([
      call(duel.startRoomFn, { roomId }, tok.ali),
      call(duel.startRoomFn, { roomId }, tok.ali),
    ]);
    check(a.ok === true && b.ok === true, "start: two racing starts both answer ok");
    rounds = Number(q(`SELECT round_count FROM public.duels WHERE id = '${roomId}'`));
    check(
      rounds === 3 && phaseOf() === "in_progress:1:starting",
      `start: in progress at round 1, starting, 3 rounds (${phaseOf()}, ${rounds})`,
    );
    check(
      q(
        `SELECT jsonb_array_length(puzzles_public)::text || ',' || (SELECT jsonb_array_length(puzzles_private) FROM public.duel_secrets WHERE duel_id = '${roomId}') FROM public.duels WHERE id = '${roomId}'`,
      ) === "3,3",
      "start: 3 public puzzles and 3 private halves stored, dealt once",
    );
    const types = q(
      `SELECT string_agg(p ->> 'type', ',') FROM public.duels, jsonb_array_elements(puzzles_public) p WHERE id = '${roomId}'`,
    ).split(",");
    const { puzzleDef } = await import("../src/lib/duel/registry");
    check(
      types.every((t) => puzzleDef(t as never)?.category === "arcade"),
      `start: the Retro-only settings dealt arcade games (${types.join(", ")})`,
    );
    check(
      q(
        `SELECT count(*) FROM public.room_events WHERE duel_id = '${roomId}' AND event = 'game_started'`,
      ) === "1",
      "start: one game_started event under racing starts",
    );
    const priv = JSON.stringify(
      q(`SELECT puzzles_private::text FROM public.duel_secrets WHERE duel_id = '${roomId}'`),
    );
    check(priv.length > 10, "start: the private half is stored server-side");
  });

  await section("phases", async () => {
    check(
      (await call(duel.advancePhaseFn, { roomId }, tok.bo)).ok === true &&
        phaseOf() === "in_progress:1:starting",
      "advance: nothing moves before Prepare to Duel's time",
    );
    check(
      await rejects(call(duel.advancePhaseFn, { roomId }, tok.cy), /not part of this room/),
      "advance: a removed player is refused",
    );
    check(
      (await advanceAfter(types.INTRO_MS * 0 + 60_000)) === "in_progress:1:round_title",
      "advance: starting → round_title after its time",
    );
    check(
      (await advanceAfter(60_000)) === "in_progress:1:intro",
      "advance: round_title → intro after its time",
    );
  });

  /** Plays one round: both ready, the puzzle, answers, reveal, results and standings. */
  const playRound = async (round: number) => {
    await call(duel.heartbeatFn, { roomId }, tok.ali);
    await call(duel.heartbeatFn, { roomId }, tok.bo);
    await call(duel.readyUpFn, { roomId, roundNumber: round }, tok.ali);
    await call(duel.readyUpFn, { roomId, roundNumber: round }, tok.bo);
    check(
      q(
        `SELECT min(intro_ready_round) FROM public.duel_players WHERE duel_id = '${roomId}' AND status = 'active'`,
      ) === String(round),
      `round ${round}: both READY taps stored`,
    );
    const reached = await advanceAfter(types.INTRO_MS + 1_000);
    check(reached === `in_progress:${round}:puzzle`, `round ${round}: intro → puzzle (${reached})`);
    const early = await call(duel.revealAnswerFn, { roomId, roundNumber: round }, tok.ali);
    check(early.ok === false, `round ${round}: the answer can't be revealed while the round runs`);
    const wrongRound = await call(
      duel.submitAnswerFn,
      { roomId, roundNumber: round + 1, answer: "", msRemaining: 1000 },
      tok.ali,
    );
    check(wrongRound.ok === false, `round ${round}: an answer for another round is refused`);
    check(
      await rejects(
        call(
          duel.submitAnswerFn,
          { roomId, roundNumber: round, answer: "", msRemaining: 1000 },
          tok.cy,
        ),
        /not part of this room/,
      ),
      `round ${round}: a removed player's answer is refused`,
    );

    // Ali's phone sends the same answer (a good player's real input log) twice at once: a retried send racing the first.
    const pub = JSON.parse(
      q(`SELECT (puzzles_public -> ${round - 1})::text FROM public.duels WHERE id = '${roomId}'`),
    );
    const priv = JSON.parse(
      q(
        `SELECT (puzzles_private -> ${round - 1})::text FROM public.duel_secrets WHERE duel_id = '${roomId}'`,
      ),
    );
    const puzzle = mergePuzzle(pub, priv);
    const ms = Math.floor(puzzleTimeLimitMs(puzzle) / 2);
    const aliAnswer = await botAnswer(puzzle as unknown as Record<string, unknown>);
    const [first, second] = await Promise.all([
      call(
        duel.submitAnswerFn,
        { roomId, roundNumber: round, answer: aliAnswer, msRemaining: ms, inputType: "touch" },
        tok.ali,
      ),
      call(
        duel.submitAnswerFn,
        { roomId, roundNumber: round, answer: aliAnswer, msRemaining: ms, inputType: "touch" },
        tok.ali,
      ),
    ]);
    check(
      first.ok === true && second.ok === true,
      `round ${round}: racing duplicate submits both answer ok`,
    );
    check(
      q(
        `SELECT count(*) FROM public.round_results WHERE duel_id = '${roomId}' AND round_number = ${round} AND player_slot = 1`,
      ) === "1",
      `round ${round}: racing duplicate submits store one row`,
    );
    check(
      phaseOf() === `in_progress:${round}:puzzle`,
      `round ${round}: the round waits for the other active player`,
    );
    const bo = await call(
      duel.submitAnswerFn,
      {
        roomId,
        roundNumber: round,
        answer: "",
        msRemaining: ms,
        inputType: "mouse+keyboard",
        clientVersion: "old-build",
      },
      tok.bo,
    );
    check(bo.ok === true, `round ${round}: the second player's answer is taken`);
    check(
      phaseOf() === `in_progress:${round}:reveal`,
      `round ${round}: the last answer ends the round (reveal)`,
    );
    check(
      q(
        `SELECT count(*) FROM public.room_events WHERE duel_id = '${roomId}' AND round_number = ${round} AND event = 'round_ended' AND reason = 'all_answered'`,
      ) === "1",
      `round ${round}: one round_ended (all_answered) event`,
    );
    const rows = JSON.parse(
      q(
        `SELECT json_agg(r ORDER BY player_slot)::text FROM public.round_results r WHERE duel_id = '${roomId}' AND round_number = ${round}`,
      ),
    ) as {
      player_slot: number;
      score: number;
      is_correct: boolean;
      answer: string | null;
      input_type: string | null;
    }[];
    check(
      rows.length === 2 && rows.map((r) => r.player_slot).join() === "1,2",
      `round ${round}: one result row per active player`,
    );
    // Each stored score is the server's replay of the stored input log, exactly as practice grades it.
    const graded = rows.map((r) => gradeAnswer(puzzle, r.answer ?? "", ms, undefined));
    check(
      rows.every((r, i) => r.score === graded[i]!.score && r.is_correct === graded[i]!.isCorrect),
      `round ${round}: each stored score equals practice's replay of the stored log (${pub.type}: ${rows.map((r) => r.score).join("/")} vs ${graded.map((g) => g.score).join("/")})`,
    );
    if (rows[0]!.score > 0) nonZeroRounds++;
    check(
      rows[0]!.input_type === "touch" && rows[1]!.input_type === "mouse+keyboard",
      `round ${round}: input_type written beside each result (${rows.map((r) => r.input_type).join(", ")})`,
    );
    const late = await call(
      duel.submitAnswerFn,
      { roomId, roundNumber: round, answer: "x", msRemaining: 0 },
      tok.ali,
    );
    check(
      late.ok === true && "alreadySubmitted" in late && late.alreadySubmitted === true,
      `round ${round}: a second answer after storing is "already submitted"`,
    );

    const reveal = await call(duel.revealAnswerFn, { roomId, roundNumber: round }, tok.ali);
    check(reveal.ok === true, `round ${round}: the reveal is served once the round has ended`);
    const reached2 = await advanceAfter(60_000);
    check(
      reached2 === `in_progress:${round}:result`,
      `round ${round}: reveal → result after the reveal's time (${reached2})`,
    );
    await call(duel.continueFn, { roomId, roundNumber: round, phase: "result" }, tok.ali);
    check(
      phaseOf() === `in_progress:${round}:result`,
      `round ${round}: one Continue doesn't move the results on`,
    );
    await call(duel.continueFn, { roomId, roundNumber: round, phase: "result" }, tok.bo);
    const last = round === rounds;
    check(
      phaseOf() === `in_progress:${round}:${last ? "winner_reveal" : "standings"}`,
      `round ${round}: everyone's Continue → ${last ? "winner_reveal" : "standings"} (${phaseOf()})`,
    );
    if (!last) {
      await call(duel.continueFn, { roomId, roundNumber: round, phase: "standings" }, tok.ali);
      await call(duel.continueFn, { roomId, roundNumber: round, phase: "standings" }, tok.bo);
      check(
        phaseOf() === `in_progress:${round + 1}:round_title`,
        `round ${round}: standings → round ${round + 1}'s title (${phaseOf()})`,
      );
      check(
        (await advanceAfter(60_000)) === `in_progress:${round + 1}:intro`,
        `round ${round + 1}: round_title → intro`,
      );
    }
  };

  await section("rounds", async () => {
    for (let round = 1; round <= rounds; round++) await playRound(round);
    check(
      nonZeroRounds >= 1,
      `rounds: the good bot's runs scored above 0 in at least 1 of ${rounds} rounds, so the replay comparison is not all zeros (${nonZeroRounds})`,
    );
    check(
      (await advanceAfter(60_000)) === `finished:${rounds}:winner_reveal`,
      `finish: the winner reveal's time ends the game (${phaseOf()})`,
    );
    check(
      q(`SELECT count(*) FROM public.round_results WHERE duel_id = '${roomId}'`) ===
        String(rounds * 2),
      `finish: ${rounds * 2} results stored (2 players × ${rounds} rounds)`,
    );
    check(
      q(
        `SELECT count(*) FROM public.room_events WHERE duel_id = '${roomId}' AND event = 'game_ended' AND reason = 'completed'`,
      ) === "1",
      "finish: one game_ended (completed) event",
    );
  });

  // The room's results refetch (8 Nov 2026, the performance audit's item 4; api.ts fetchResults): the named
  // columns without the stored answers, then this device's own answers by row id, through a device's own client
  // (RLS and grants apply), give the same rows as select("*") with only the other players' answers left out.
  await section("results refetch", async () => {
    const { ROOM_RESULT_COLUMNS, OwnAnswers } = await import("../src/lib/duel/roomResults");
    const ali = deviceClient(tok.ali);
    const all = await ali.from("round_results").select("*").eq("duel_id", roomId);
    const slim = await ali.from("round_results").select(ROOM_RESULT_COLUMNS).eq("duel_id", roomId);
    check(!all.error && !slim.error, `results refetch: both reads served (${all.error?.message ?? slim.error?.message ?? "ok"})`);
    const full = (all.data ?? []) as Record<string, unknown>[];
    const rows = (slim.data ?? []) as unknown as import("../src/lib/duel/roomResults").RoomResultRow[];
    check(rows.length === full.length && rows.length === rounds * 2, `results refetch: every row (${rows.length} of ${full.length})`);
    check(rows.every((r) => !("answer" in r)), "results refetch: no stored answer in the refetch");
    const own = new OwnAnswers();
    const missing = own.missing(rows, 1);
    check(missing.length === rounds, `results refetch: Ali's own ${rounds} answers asked for (${missing.length})`);
    const mine = await ali.from("round_results").select("id, answer").in("id", missing);
    check(!mine.error && (mine.data ?? []).length === rounds, `results refetch: own answers served by id (${mine.error?.message ?? (mine.data ?? []).length})`);
    own.remember((mine.data ?? []) as { id: string; answer: string | null }[]);
    const attached = own.attach(rows, 1);
    const byId = new Map(full.map((r) => [r["id"] as string, r]));
    const same = attached.every((r) => {
      const f = byId.get(r.id)!;
      const { input_type: _drop, ...rest } = f;
      const expect = { ...rest, answer: r.player_slot === 1 ? f["answer"] : null };
      return JSON.stringify(Object.keys(expect).sort().map((k) => [k, expect[k]])) ===
        JSON.stringify(Object.keys(r).sort().map((k) => [k, (r as Record<string, unknown>)[k]]));
    });
    check(same, "results refetch: the same rows as select(\"*\"), other players' answers null");
    check(own.missing(rows, 1).length === 0, "results refetch: the next refetch asks for no answer again");
    const bytes = (v: unknown) => Buffer.byteLength(JSON.stringify(v));
    console.log(
      `NOTE results refetch: ${rows.length} rows, select("*") ${bytes(full)} bytes, named columns ${bytes(rows)} bytes, own answers once ${bytes(mine.data)} bytes`,
    );
  });

  await section("chat", async () => {
    const outsider = await call(chat.sendRoomMessageFn, { roomId, text: "hello" }, tok.dee);
    check(
      outsider.ok === false && /not in this room/.test(outsider.message),
      "chat: an outsider can't send",
    );
    const sent = await call(chat.sendRoomMessageFn, { roomId, text: "  good   game  " }, tok.bo);
    check(
      sent.ok === true &&
        q(
          `SELECT text || ',' || sender_name FROM public.room_messages WHERE duel_id = '${roomId}'`,
        ) === "good game,Bo",
      "chat: a player's message is stored, spaces collapsed",
    );
    const fast = await call(chat.sendRoomMessageFn, { roomId, text: "again" }, tok.bo);
    check(
      fast.ok === false && /Slow down/.test(fast.message),
      "chat: a second message straight after is refused",
    );
    const messageId = q(`SELECT id FROM public.room_messages WHERE duel_id = '${roomId}' LIMIT 1`);
    const report = await call(chat.reportMessageFn, { roomId, messageId }, tok.ali);
    check(
      report.ok === true &&
        q(
          `SELECT count(*) FROM public.room_reports WHERE message_id = '${messageId}' AND reporter_user_id = '${ALI}'`,
        ) === "1",
      "chat: a member reports a message (read through their own RLS)",
    );
    const foreign = await call(chat.reportMessageFn, { roomId, messageId: uid(777) }, tok.ali);
    check(foreign.ok === false, "chat: a message not in the room can't be reported");
    const muteByGuest = await call(chat.setPlayerMutedFn, { roomId, slot: 1, muted: true }, tok.bo);
    check(
      muteByGuest.ok === false && /Only the host/.test(muteByGuest.message),
      "chat: a non-host can't mute",
    );
    const muted = await call(chat.setPlayerMutedFn, { roomId, slot: 2, muted: true }, tok.ali);
    q(
      `UPDATE public.room_messages SET created_at = created_at - interval '1 minute' WHERE duel_id = '${roomId}'`,
    );
    const silenced = await call(
      chat.sendRoomMessageFn,
      { roomId, text: "can you hear me" },
      tok.bo,
    );
    check(
      muted.ok === true && silenced.ok === false && /muted/.test(silenced.message),
      "chat: the host mutes a player, whose next message is refused",
    );
    const { ROOM_EMOJI } = await import("../src/lib/duel/chatConstants");
    const unknown = await call(chat.allowReactionFn, { roomId, emoji: "not-an-emoji" }, tok.ali);
    check(
      unknown.ok === false && /That reaction doesn.t exist/.test(unknown.message),
      "chat: an unknown reaction is refused",
    );
    const allowed = await call(chat.allowReactionFn, { roomId, emoji: ROOM_EMOJI[0] }, tok.ali);
    check(
      allowed.ok === true &&
        allowed.name === "Ali" &&
        q(
          `SELECT last_reaction_at IS NOT NULL FROM public.duel_players WHERE duel_id = '${roomId}' AND player_slot = 1`,
        ) === "t",
      "chat: a reaction is allowed and its time stored",
    );
    const tooSoon = await call(chat.allowReactionFn, { roomId, emoji: ROOM_EMOJI[0] }, tok.ali);
    check(
      tooSoon.ok === false && /One reaction a second/.test(tooSoon.message),
      "chat: a second reaction within the second is refused",
    );
  });

  await section("play again", async () => {
    const notHost = await call(duel.rematchFn, { roomId }, tok.bo);
    check(notHost.ok === false, "play again: a non-host is refused");
    const again = await call(duel.rematchFn, { roomId }, tok.ali);
    check(
      again.ok === true && again.roomCode === roomCode,
      `play again: the host restarts the same room (${JSON.stringify(again)})`,
    );
    check(
      phaseOf().startsWith("waiting:0"),
      `play again: the room is waiting at round 0 (${phaseOf()})`,
    );
    check(
      q(`SELECT count(*) FROM public.round_results WHERE duel_id = '${roomId}'`) === "0",
      "play again: the room's results are cleared",
    );
    check(
      Number(
        q(
          `SELECT jsonb_array_length(coalesce(tournament_history, '[]'::jsonb)) FROM public.duels WHERE id = '${roomId}'`,
        ),
      ) === 1,
      "play again: the finished game is archived in tournament_history",
    );
    check(
      q(
        `SELECT string_agg(player_slot::text || status, ',' ORDER BY player_slot) FROM public.duel_players WHERE duel_id = '${roomId}'`,
      ) === "1active,2active",
      "play again: both players stay, active",
    );
    check(
      q(
        `SELECT count(*) FROM public.duel_players WHERE duel_id = '${roomId}' AND (submitted_round IS NOT NULL AND submitted_round > 0)`,
      ) === "0",
      "play again: the finished pings are cleared",
    );
    check(
      /rounds:3/.test(
        q(`SELECT selected_categories::text FROM public.duels WHERE id = '${roomId}'`),
      ),
      "play again: the room keeps its settings",
    );
  });

  /* Speed fix 3 (9 Nov 2026): heartbeats go to duel_presence (no realtime) and come back in the reply. */
  await section("heartbeat presence", async () => {
    const seenOf = (user: string) =>
      q(`SELECT last_seen_at FROM public.duel_players WHERE duel_id = '${roomId}' AND user_id = '${user}'`);
    check(
      q(`SELECT count(*) FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'duel_presence'`) === "0" &&
        q(`SELECT count(*) FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'duel_players'`) === "1",
      "presence: duel_presence is not in the realtime publication (duel_players still is)",
    );
    const rowBefore = seenOf(BO);
    const beat = (await call(duel.heartbeatFn, { roomId }, tok.bo)) as { ok: boolean; seen?: Record<string, string> };
    check(
      beat.ok === true && !!beat.seen?.[BO] && !!beat.seen?.[ALI] &&
        q(`SELECT count(*) FROM public.duel_presence WHERE duel_id = '${roomId}' AND user_id = '${BO}'`) === "1",
      "heartbeat: stored in duel_presence; the reply carries the room's last-seen times",
    );
    check(seenOf(BO) === rowBefore, "heartbeat: the player row (realtime-published) is not written");
    const outsider = (await call(duel.heartbeatFn, { roomId }, tok.dee)) as { ok: boolean; seen?: unknown };
    check(
      outsider.ok === true && outsider.seen === undefined &&
        q(`SELECT count(*) FROM public.duel_presence WHERE user_id = '${DEE}'`) === "0",
      "heartbeat: an outsider stores nothing and is told nothing",
    );
    const read = await deviceClient(tok.bo).from("duel_presence").select("*");
    check(!!read.error || (read.data ?? []).length === 0, "presence: a device can't read duel_presence");
    // The stale-host RPC reads the later of the two columns: an old player row with a fresh heartbeat stays open.
    const hostRow = seenOf(ALI);
    q(`UPDATE public.duel_players SET last_seen_at = now() - interval '10 minutes' WHERE duel_id = '${roomId}' AND user_id = '${ALI}'`);
    await call(duel.heartbeatFn, { roomId }, tok.ali);
    check(
      (await call(duel.checkHostPresenceFn, { roomId }, tok.bo)).ok === true && phaseOf().startsWith("waiting"),
      "host presence: a host seen through duel_presence keeps the room open",
    );
    q(`UPDATE public.duel_players SET last_seen_at = '${hostRow}' WHERE duel_id = '${roomId}' AND user_id = '${ALI}'`);
    // Before the migration (no table): the heartbeat writes the player row as it always did.
    q(`ALTER TABLE public.duel_presence RENAME TO duel_presence_off`);
    presence.resetPresenceCache();
    try {
      const old = (await call(duel.heartbeatFn, { roomId }, tok.bo)) as { ok: boolean; seen?: Record<string, string> };
      check(
        old.ok === true && !!old.seen?.[BO] && seenOf(BO) !== rowBefore,
        "heartbeat without duel_presence: the player row is written and the reply carries its times",
      );
      const out = (await call(duel.heartbeatFn, { roomId }, tok.dee)) as { ok: boolean; seen?: unknown };
      check(out.ok === true && out.seen === undefined, "heartbeat without duel_presence: an outsider is told nothing");
    } finally {
      q(`ALTER TABLE public.duel_presence_off RENAME TO duel_presence`);
      presence.resetPresenceCache();
    }
  });

  await section("leave/disband", async () => {
    check((await call(duel.heartbeatFn, { roomId }, tok.bo)).ok === true, "heartbeat: answers ok");
    check(
      (await call(duel.checkHostPresenceFn, { roomId }, tok.bo)).ok === true &&
        phaseOf().startsWith("waiting"),
      "host presence: the stale-host RPC runs and leaves a live host's room open",
    );
    check(
      await rejects(call(duel.checkHostPresenceFn, { roomId }, tok.dee), /not part of this room/),
      "host presence: an outsider is refused",
    );
    const bo = await call(duel.leaveRoomFn, { roomId }, tok.bo);
    check(
      bo.ok === true &&
        q(
          `SELECT status FROM public.duel_players WHERE duel_id = '${roomId}' AND user_id = '${BO}'`,
        ) === "left" &&
        phaseOf().startsWith("waiting"),
      "leave: a guest leaving is stored as left; the room stays open",
    );
    const back = await call(duel.joinRoomFn, { roomCode, displayName: "Bo" }, tok.bo);
    check(
      back.ok === true &&
        q(
          `SELECT status FROM public.duel_players WHERE duel_id = '${roomId}' AND user_id = '${BO}'`,
        ) === "active",
      "leave: a guest who left rejoins the lobby",
    );
    const disbandByGuest = await call(duel.disbandRoomFn, { roomId }, tok.bo);
    check(
      disbandByGuest.ok === false &&
        q(`SELECT disbanded_at IS NULL FROM public.duels WHERE id = '${roomId}'`) === "t",
      "disband: a non-host can't disband",
    );
    const host = await call(duel.leaveRoomFn, { roomId }, tok.ali);
    check(
      host.ok === true &&
        q(
          `SELECT status || ',' || (disbanded_at IS NOT NULL) FROM public.duels WHERE id = '${roomId}'`,
        ) === "finished,true",
      "leave: the host leaving disbands the room",
    );
    const joinDead = await call(duel.joinRoomFn, { roomCode, displayName: "Dee" }, tok.dee);
    check(
      joinDead.ok === false && /disbanded/.test(joinDead.message),
      "join: a disbanded room can't be joined",
    );
    const other = await call(duel.createRoomFn, { displayName: "Bo" }, tok.bo);
    const disbanded = await call(duel.disbandRoomFn, { roomId: other.roomId }, tok.bo);
    check(
      disbanded.ok === true &&
        q(`SELECT disbanded_at IS NOT NULL FROM public.duels WHERE id = '${other.roomId}'`) === "t",
      "disband: the host disbands their room",
    );
  });

  /* ------------------------------------------------- async rooms and the daily */
  /** Plays every round of an async room on `token`'s device with empty answers; the attempt's view at the end. */
  const playAsync = async (asyncRoomId: string, token: string, label: string) => {
    const roomRounds = Number(
      q(`SELECT round_count FROM public.async_rooms WHERE id = '${asyncRoomId}'`),
    );
    for (let round = 1; round <= roomRounds; round++) {
      const started = await call(
        asyncFns.asyncRoundStartFn,
        { roomId: asyncRoomId, roundNumber: round },
        token,
      );
      if (!started.ok) {
        check(false, `${label} round ${round}: start (${JSON.stringify(started).slice(0, 200)})`);
        return null;
      }
      const sent = await call(
        asyncFns.asyncSubmitFn,
        {
          roomId: asyncRoomId,
          roundNumber: round,
          answer: "",
          msRemaining: 1000,
          inputType: "keyboard",
        },
        token,
      );
      if (!sent.ok) {
        check(false, `${label} round ${round}: submit (${JSON.stringify(sent).slice(0, 200)})`);
        return null;
      }
      const reveal = await call(
        asyncFns.asyncRevealFn,
        { roomId: asyncRoomId, roundNumber: round },
        token,
      );
      if (!reveal.ok) {
        check(false, `${label} round ${round}: reveal (${JSON.stringify(reveal).slice(0, 200)})`);
        return null;
      }
    }
    return {
      rounds: roomRounds,
      attempt: await call(asyncFns.asyncAttemptFn, { roomId: asyncRoomId }, token),
    };
  };

  await section("daily", async () => {
    const status = await call(daily.dailyStatusFn, undefined, tok.ali);
    check(
      status.available === true,
      `daily: status is available with the tables applied (${JSON.stringify(status).slice(0, 120)})`,
    );
    const noName = await call(daily.dailyStartFn, { kind: "puzzle", displayName: "  " }, tok.ali);
    check(noName.ok === false, "daily: a blank name is refused");
    const start = await call(daily.dailyStartFn, { kind: "puzzle", displayName: "Ali" }, tok.ali);
    check(
      start.ok === true && start.created === true,
      `daily: the first start deals today's puzzle daily and the attempt (${JSON.stringify(start).slice(0, 160)})`,
    );
    if (!start.ok) return;
    const again = await call(daily.dailyStartFn, { kind: "puzzle", displayName: "Ali" }, tok.ali);
    check(
      again.ok === true && again.roomId === start.roomId && again.created === false,
      "daily: starting again returns the same attempt (one per device)",
    );
    check(
      q(
        `SELECT count(*) FROM public.async_attempts WHERE room_id = '${start.roomId}' AND user_id = '${ALI}'`,
      ) === "1",
      "daily: one attempt row",
    );
    const before = await call(daily.dailyBoardFn, { kind: "puzzle", day: "today" }, tok.bo);
    check(
      Array.isArray(before.rows) && before.rows.length === 0,
      "daily: the board shows nobody before anyone finishes",
    );

    // Async rooms: the daily's rounds go through the async-room calls.
    const notMine = await call(asyncFns.asyncAttemptFn, { roomId: start.roomId }, tok.bo);
    check(notMine.ok === false, "async: a device without an attempt is refused");
    const view = await call(asyncFns.asyncAttemptFn, { roomId: start.roomId }, tok.ali);
    check(view.ok === true, "async: the attempt's view is served");
    const tooFar = await call(
      asyncFns.asyncRoundStartFn,
      { roomId: start.roomId, roundNumber: 3 },
      tok.ali,
    );
    check(tooFar.ok === false, "async: a round can't start before the ones ahead of it");
    const played = await playAsync(start.roomId, tok.ali, "daily");
    if (!played) return;
    check(
      played.attempt.ok === true &&
        q(
          `SELECT finished_at IS NOT NULL FROM public.async_attempts WHERE room_id = '${start.roomId}' AND user_id = '${ALI}'`,
        ) === "t",
      `async: all ${played.rounds} rounds played finish the attempt`,
    );
    check(
      q(
        `SELECT count(*) FROM public.async_results WHERE room_id = '${start.roomId}' AND user_id = '${ALI}'`,
      ) === String(played.rounds),
      "async: one result per round",
    );
    check(
      q(
        `SELECT count(*) FROM public.async_results WHERE room_id = '${start.roomId}' AND input_type = 'keyboard'`,
      ) === String(played.rounds),
      "async: input_type written beside every async result",
    );
    const board = await call(daily.dailyBoardFn, { kind: "puzzle", day: "today" }, tok.ali);
    check(
      Array.isArray(board.rows) && board.rows.length === 1 && board.me !== null,
      `daily: the finished player sees the board with their row (${JSON.stringify(board).slice(0, 160)})`,
    );
  });

  await section("challenge", async () => {
    const status = await call(challenge.challengeStatusFn, undefined, tok.ali);
    check(status.available === true, "challenge: available with the tables applied");
    const made = await call(
      challenge.createChallengeFn,
      { categories: ["word", "number", "pattern"], rounds: 3, displayName: "Ali" },
      tok.ali,
    );
    check(
      made.ok === true,
      `challenge: the creator makes a 3-round challenge (${JSON.stringify(made).slice(0, 200)})`,
    );
    if (!made.ok) return;
    const challengeRoom = made.roomId as string;
    const code = q(`SELECT code FROM public.challenges WHERE room_id = '${challengeRoom}'`);
    check(/^[A-Z0-9]{6}$/.test(code), `challenge: a six-character code is stored (${code})`);
    const mine = await playAsync(challengeRoom, tok.ali, "challenge creator");
    if (!mine) return;
    check(mine.attempt.ok === true, "challenge: the creator plays every round first");
    const info = await call(
      challenge.challengeInfoFn,
      { code: code.toLowerCase(), opened: true },
      tok.bo,
    );
    check(
      info.found === true && info.isCreator === false,
      `challenge: a friend's device opens the link (${JSON.stringify(info).slice(0, 160)})`,
    );
    check(
      q(
        `SELECT count(*) FROM public.challenge_events WHERE code = '${code}' AND event = 'link_opened'`,
      ) === "1",
      "challenge: the link opening is recorded",
    );
    const friend = await call(challenge.startChallengeFn, { code, displayName: "Bo" }, tok.bo);
    check(friend.ok === true && friend.roomId === challengeRoom, "challenge: the friend starts it");
    const roster = await call(challenge.challengeRosterFn, { roomId: challengeRoom }, tok.bo);
    check(roster !== null, "challenge: the friend's roster is served");
    const early = await call(
      challenge.challengeRoundBoardFn,
      { roomId: challengeRoom, roundNumber: 1 },
      tok.bo,
    );
    check(early.ok === false, "challenge: the round board waits for the friend's own result");
    const theirs = await playAsync(challengeRoom, tok.bo, "challenge friend");
    if (!theirs) return;
    const board = await call(
      challenge.challengeRoundBoardFn,
      { roomId: challengeRoom, roundNumber: 1 },
      tok.bo,
    );
    const parsed = board.ok
      ? (JSON.parse(board.json) as { players: unknown[]; results: { round_number: number }[] })
      : null;
    check(
      !!parsed &&
        parsed.players.length === 2 &&
        parsed.results.filter((r) => r.round_number === 1).length === 2,
      `challenge: round 1's board is served once the friend has played it, with both players (${board.ok ? "" : board.message})`,
    );
    const final = await call(challenge.challengeFinalFn, { roomId: challengeRoom }, tok.bo);
    check(final.ok === true, "challenge: the final board is served");
    const outsider = await call(challenge.challengeRosterFn, { roomId: challengeRoom }, tok.dee);
    check(outsider === null, "challenge: a device without an attempt gets no roster");
    const list = await call(challenge.myChallengesFn, { codes: [code] }, tok.ali);
    check(
      Array.isArray(list) ? list.length >= 1 : !!list,
      "challenge: the creator's list includes it",
    );
  });

  /* --------------------------------------------- recordInputType's failures */
  await section("input type", async () => {
    captured.length = 0;
    const none = await recordInputType(
      supabaseAdmin,
      "round_results",
      { duel_id: uid(500) },
      undefined,
    );
    check(
      none.ok === true && none.inputType === null && captured.length === 0,
      "input type: nothing sent stores nothing and logs nothing",
    );
    const missing = await recordInputType(
      supabaseAdmin,
      "round_results",
      { duel_id: uid(500), player_slot: 1, round_number: 1 },
      "touch",
    );
    check(
      missing.ok === false &&
        /no stored result/.test(missing.error) &&
        captured.some((l) => /\[input-type\].*no stored result/.test(l)),
      "input type: an update that matches no result is returned and logged",
    );
    const broken = await recordInputType(
      supabaseAdmin,
      "round_results",
      { no_such_column: 1 },
      "mouse",
    );
    check(
      broken.ok === false &&
        /no_such_column|does not exist/.test(broken.error) &&
        captured.some((l) => /\[input-type\]/.test(l)),
      `input type: a database error is returned and logged (${broken.ok ? "" : broken.error})`,
    );
    const throwing = {
      from: () => {
        throw new Error("client down");
      },
    };
    const thrown = await recordInputType(
      throwing,
      "async_results",
      { attempt_id: uid(1) },
      "keyboard",
    );
    check(
      thrown.ok === false && thrown.error === "client down",
      "input type: a throwing client is returned and logged, never thrown",
    );

    // A database without the column (migration 20261031170000 not applied): the submission still succeeds and stores its
    // result, and the missing column is logged instead of vanishing.
    const room = await call(duel.createRoomFn, { displayName: "Ali" }, tok.ali);
    await call(duel.joinRoomFn, { roomCode: room.roomCode, displayName: "Dee" }, tok.dee);
    await call(
      duel.setRoomSettingsFn,
      { roomId: room.roomId, picks: ["retro"], rounds: 3 },
      tok.ali,
    );
    await call(duel.startRoomFn, { roomId: room.roomId }, tok.ali);
    q(
      `UPDATE public.duels SET phase = 'puzzle', phase_started_at = now() WHERE id = '${room.roomId}'`,
    );
    q(`ALTER TABLE public.round_results RENAME COLUMN input_type TO input_type_moved`);
    captured.length = 0;
    try {
      const sent = await call(
        duel.submitAnswerFn,
        { roomId: room.roomId, roundNumber: 1, answer: "", msRemaining: 1000, inputType: "touch" },
        tok.dee,
      );
      check(
        sent.ok === true &&
          q(`SELECT count(*) FROM public.round_results WHERE duel_id = '${room.roomId}'`) === "1",
        "input type: without the column the answer is still stored",
      );
      check(
        captured.some((l) => /\[input-type\] round_results/.test(l) && /input_type/.test(l)),
        `input type: without the column the failure is logged (${captured.join(" | ").slice(0, 160)})`,
      );
    } finally {
      q(`ALTER TABLE public.round_results RENAME COLUMN input_type_moved TO input_type`);
    }
  });

  const unsupported = rest.log.filter((entry) =>
    /server-fn harness: unsupported/.test(entry.error ?? ""),
  );
  check(
    unsupported.length === 0,
    `every query the handlers made is one the stand-in serves (${unsupported
      .map((e) => `${e.method} ${e.path}: ${e.error}`)
      .slice(0, 3)
      .join("; ")})`,
  );
}

restore();
console.log(`server-functions-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log(
  "PASS: the room, chat, daily, async-room and challenge server functions run against every migration, with auth, host rules, RLS and input_type.",
);
