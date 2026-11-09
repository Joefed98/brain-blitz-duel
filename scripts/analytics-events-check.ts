/**
 * analytics-events-check (9 Nov 2026; docs/analytics.md): our own analytics, `analytics.events`
 * (supabase/migrations/20261109140000_analytics_events.sql), written by src/lib/data/events.server.ts.
 *
 * On the server-function harness (scripts/server-fn-harness.ts: the real handlers, middleware and supabase-js
 * clients over a local PostgreSQL 16 with every migration applied) it proves:
 * - a room flow (create, join, start, three rounds, finish) writes room_created, room_joined, room_started, each
 *   round's game_started / game_finished for both players and room_finished, in order, with the right fields;
 * - a Daily attempt writes daily_started, each round's game_started / game_finished and daily_finished; a friend
 *   challenge writes challenge_created and each player's rounds and challenge_played;
 * - practice records game_started (the round's start token) and game_finished (the server's grade);
 * - recordClientEventsFn accepts only the five phone events, refuses unknown and server-side events, scores and
 *   score-like props, out-of-range times and oversized batches, keeps a queued event's time, and is rate limited;
 * - a failing, refused or hanging events write changes no server function's response (and doesn't slow it down);
 * - analytics.events has no column for an email, an IP address, a user agent or a name, and anon / authenticated
 *   have no access to the analytics schema, its table, its view or the write RPC (service_role may only call it);
 * - analytics.player_activity counts only players with a game_started, and its favourite_games, last_played,
 *   games_played and days_active come out right on test data;
 * - the retention function deletes only events older than 13 months.
 *
 * Needs the PostgreSQL 16 binaries (preinstalled on GitHub's ubuntu runners): without them it fails on CI and prints
 * a NOTE locally. No browser.
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
  if (process.env["ANALYTICS_CHECK_DEBUG"]) process.stderr.write(`section ${name}\n`);
  try {
    await body();
  } catch (err) {
    check(
      false,
      `${name}: threw ${err instanceof Error ? (err.stack ?? err.message).split("\n").slice(0, 3).join(" | ") : String(err)}`,
    );
  }
}

// The handlers log room selection and notes; keep the output to the check's own lines, but keep analytics warnings.
const quietLog = console.log;
const quietWarn = console.warn;
const quietError = console.error;
const warnings: string[] = [];
console.log = (...args: unknown[]) => {
  const line = args.map(String).join(" ");
  if (/^\s*(FAIL|NOTE)|^analytics-events-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = (...args: unknown[]) => {
  warnings.push(args.map(String).join(" "));
};
console.error = () => {};
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

let db: LocalDb | null = null;
let rest: RestServer | null = null;

if (!postgresBin()) {
  restore();
  if (process.env["CI"]) {
    console.log("analytics-events-check: 0 passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL");
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: analytics not checked (CI runs it)");
  console.log("analytics-events-check: skipped locally");
  process.exit(0);
}

try {
  db = startLocalDb("analytics-check-");
  check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
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
  const daily = await import("../src/lib/duel/daily.functions");
  const asyncFns = await import("../src/lib/duel/asyncRoom.functions");
  const challenge = await import("../src/lib/duel/challenge.functions");
  const analytics = await import("../src/lib/analytics/analytics.functions");
  const events = await import("../src/lib/data/events.server");
  const { acceptClientEvent } = await import("../src/lib/analytics/clientEvents.server");
  const { ANALYTICS_EVENTS, CLIENT_EVENTS } = await import("../src/lib/analytics/events");
  const { ANALYTICS_CLIENT_LIMIT } = await import("../src/lib/duel/rateLimit.server");
  const types = await import("../src/lib/duel/types");
  const { createClient } = await import("@supabase/supabase-js");

  const tok = { ali: userToken(ALI), bo: userToken(BO), cy: userToken(CY), dee: userToken(DEE) };
  const call = callServerFn;
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out;
  };
  const flush = () => events.flushAnalytics();
  type Row = {
    event: string;
    player_id: string | null;
    game: string | null;
    mode: string | null;
    score: number | null;
    completed: boolean | null;
    duration_ms: number | null;
    room_id: string | null;
    app_version: string | null;
    platform: string | null;
    input_type: string | null;
    props: Record<string, unknown> | null;
    occurred_at: string;
  };
  const rowsWhere = (where: string): Row[] =>
    JSON.parse(
      q(`SELECT coalesce(json_agg(e ORDER BY occurred_at, id), '[]')::text FROM analytics.events e WHERE ${where}`) || "[]",
    ) as Row[];
  const eventCount = () => Number(q(`SELECT count(*) FROM analytics.events`));

  /* ----------------------------------------------------------- privacy and access */
  await section("privacy", async () => {
    const columns = q(
      `SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema = 'analytics' AND table_name = 'events'`,
    );
    check(
      columns ===
        "id,occurred_at,received_at,event,player_id,game,mode,score,completed,duration_ms,room_id,app_version,platform,input_type,props",
      `privacy: analytics.events has exactly the agreed columns (${columns})`,
    );
    check(
      !columns.split(",").some((c) => /(^|_)(email|e_mail|ip|ip_address|address|user_agent|agent|ua|name|display_name|username)($|_)/.test(c)),
      "privacy: no column for an email, an IP address, a user agent or a name",
    );
    for (const role of ["anon", "authenticated"]) {
      check(q(`SELECT has_schema_privilege('${role}', 'analytics', 'USAGE')`) === "f", `access: ${role} has no USAGE on the analytics schema`);
      for (const priv of ["SELECT", "INSERT", "UPDATE", "DELETE"])
        check(
          q(`SELECT has_table_privilege('${role}', 'analytics.events', '${priv}')`) === "f",
          `access: ${role} has no ${priv} on analytics.events`,
        );
      check(
        q(`SELECT has_table_privilege('${role}', 'analytics.player_activity', 'SELECT')`) === "f",
        `access: ${role} can't read analytics.player_activity`,
      );
      check(
        q(`SELECT has_function_privilege('${role}', 'public.record_analytics_events(jsonb)', 'EXECUTE')`) === "f",
        `access: ${role} can't call record_analytics_events`,
      );
      check(
        q(`SELECT has_function_privilege('${role}', 'analytics.purge_old_events()', 'EXECUTE')`) === "f",
        `access: ${role} can't call the retention function`,
      );
    }
    check(
      q(`SELECT has_function_privilege('service_role', 'public.record_analytics_events(jsonb)', 'EXECUTE')`) === "t",
      "access: service_role may call record_analytics_events (the server's one write path)",
    );
    check(
      q(`SELECT has_table_privilege('service_role', 'analytics.events', 'SELECT')`) === "f",
      "access: service_role can't read the table directly either (dashboard only)",
    );
    check(
      q(`SELECT relrowsecurity FROM pg_class WHERE oid = 'analytics.events'::regclass`) === "t" &&
        q(`SELECT count(*) FROM pg_policies WHERE schemaname = 'analytics'`) === "0",
      "access: RLS on with no policies",
    );
    const device = createClient(rest.url, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${tok.bo}` } },
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
    const viaRpc = await device.rpc("record_analytics_events", { p_events: [{ event: "game_started" }] });
    check(!!viaRpc.error && eventCount() === 0, `access: a device's own client can't write events through the RPC (${viaRpc.error?.code})`);
    const anon = createClient(rest.url, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, storage: undefined } });
    const anonRpc = await anon.rpc("record_analytics_events", { p_events: [{ event: "app_opened" }] });
    check(!!anonRpc.error && eventCount() === 0, `access: an anonymous caller can't write events (${anonRpc.error?.code})`);
    check(
      [...ANALYTICS_EVENTS].sort().join() ===
        q(`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'analytics.events'::regclass AND conname LIKE '%event_check'`)
          .match(/'([a-z_]+)'/g)!
          .map((s) => s.slice(1, -1))
          .sort()
          .join(),
      "schema: the table's event list is the code's ANALYTICS_EVENTS",
    );
    check(events.platformOf("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)") === "ios", "platform: iPhone → ios");
    check(events.platformOf("Mozilla/5.0 (Linux; Android 14; Pixel 8)") === "android", "platform: Android → android");
    check(events.platformOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)") === "desktop", "platform: a Mac → desktop");
    check(events.platformOf(null) === null, "platform: no user agent → null");
  });

  /* ------------------------------------------------------------------ the room flow */
  let roomId = "";
  const elapse = (ms: number) =>
    q(
      `UPDATE public.duels SET phase_started_at = phase_started_at - interval '${ms} milliseconds', round_started_at = round_started_at - interval '${ms} milliseconds' WHERE id = '${roomId}'`,
    );
  const phaseOf = () =>
    q(`SELECT status || ':' || current_round || ':' || coalesce(phase, '') FROM public.duels WHERE id = '${roomId}'`);
  const advanceAfter = async (ms: number) => {
    elapse(ms);
    await call(duel.advancePhaseFn, { roomId }, tok.bo);
    return phaseOf();
  };

  await section("room flow", async () => {
    const made = await call(duel.createRoomFn, { displayName: "Ali" }, tok.ali);
    roomId = made.roomId;
    await call(duel.joinRoomFn, { roomCode: made.roomCode, displayName: "Bo", via: "code" }, tok.bo);
    await call(duel.setRoomSettingsFn, { roomId, picks: ["retro"], rounds: 3 }, tok.ali);
    await call(duel.startRoomFn, { roomId }, tok.ali);
    const rounds = Number(q(`SELECT round_count FROM public.duels WHERE id = '${roomId}'`));
    await advanceAfter(60_000);
    await advanceAfter(60_000);
    for (let round = 1; round <= rounds; round++) {
      await call(duel.heartbeatFn, { roomId }, tok.ali);
      await call(duel.heartbeatFn, { roomId }, tok.bo);
      await call(duel.readyUpFn, { roomId, roundNumber: round }, tok.ali);
      await call(duel.readyUpFn, { roomId, roundNumber: round }, tok.bo);
      await advanceAfter(types.INTRO_MS + 1_000);
      await call(duel.submitAnswerFn, { roomId, roundNumber: round, answer: "", msRemaining: 20_000, inputType: "touch" }, tok.ali);
      await call(duel.submitAnswerFn, { roomId, roundNumber: round, answer: "", msRemaining: 20_000, inputType: "mouse+keyboard" }, tok.bo);
      await advanceAfter(60_000);
      await call(duel.continueFn, { roomId, roundNumber: round, phase: "result" }, tok.ali);
      await call(duel.continueFn, { roomId, roundNumber: round, phase: "result" }, tok.bo);
      if (round < rounds) {
        await call(duel.continueFn, { roomId, roundNumber: round, phase: "standings" }, tok.ali);
        await call(duel.continueFn, { roomId, roundNumber: round, phase: "standings" }, tok.bo);
        await advanceAfter(60_000);
      }
    }
    await advanceAfter(60_000);
    await flush();
    check(phaseOf().startsWith("finished:"), `room flow: the room played to the end (${phaseOf()})`);

    const rows = rowsWhere(`room_id = '${roomId}'`);
    const perRound = ["game_started", "game_started", "game_finished", "game_finished"];
    const expected = [
      "room_created",
      "room_joined",
      "room_started",
      ...Array.from({ length: rounds }, () => perRound).flat(),
      "room_finished",
    ];
    check(
      rows.map((r) => r.event).join() === expected.join(),
      `room flow: the events in order (${rows.map((r) => r.event).join(", ")})`,
    );
    const created = rows.find((r) => r.event === "room_created");
    check(created?.player_id === ALI && created.mode === "room", "room flow: room_created by the host, mode room");
    const joined = rows.find((r) => r.event === "room_joined");
    check(joined?.player_id === BO && joined.props?.["via"] === "code", "room flow: room_joined by the joiner, via code");
    const started = rows.find((r) => r.event === "room_started");
    check(
      started?.player_id === ALI && started.props?.["players"] === 2 && started.props?.["rounds"] === rounds,
      `room flow: room_started by the host with 2 players and ${rounds} rounds (${JSON.stringify(started?.props)})`,
    );
    const results = JSON.parse(
      q(`SELECT json_agg(r ORDER BY round_number, player_slot)::text FROM public.round_results r WHERE duel_id = '${roomId}'`),
    ) as { round_number: number; player_slot: number; score: number; is_correct: boolean }[];
    const puzzles = JSON.parse(q(`SELECT puzzles_public::text FROM public.duels WHERE id = '${roomId}'`)) as { type: string }[];
    for (let round = 1; round <= rounds; round++) {
      const startedRows = rows.filter((r) => r.event === "game_started" && r.props?.["round"] === round);
      check(
        startedRows.length === 2 &&
          new Set(startedRows.map((r) => r.player_id)).size === 2 &&
          startedRows.every((r) => r.game === puzzles[round - 1]!.type && r.mode === "room"),
        `room flow: round ${round}'s game_started for both players with the round's game (${startedRows.map((r) => r.game).join(",")})`,
      );
      const finished = rows.filter((r) => r.event === "game_finished" && r.props?.["round"] === round);
      const byPlayer = new Map(finished.map((r) => [r.player_id, r]));
      const ali = byPlayer.get(ALI);
      const bo = byPlayer.get(BO);
      const stored = results.filter((r) => r.round_number === round);
      check(
        !!ali && !!bo &&
          ali.score === stored.find((r) => r.player_slot === 1)!.score &&
          bo.score === stored.find((r) => r.player_slot === 2)!.score &&
          ali.completed === stored.find((r) => r.player_slot === 1)!.is_correct &&
          ali.game === puzzles[round - 1]!.type,
        `room flow: round ${round}'s game_finished carries the stored score and verdict (${finished.map((r) => `${r.score}/${r.completed}`).join(" ")})`,
      );
      check(
        ali?.input_type === "touch" && bo?.input_type === "mouse+keyboard",
        `room flow: round ${round}'s game_finished carries the input type (${ali?.input_type}, ${bo?.input_type})`,
      );
      check(
        finished.every((r) => typeof r.duration_ms === "number" && r.duration_ms >= 0),
        `room flow: round ${round}'s game_finished has a duration (${finished.map((r) => r.duration_ms).join(",")})`,
      );
    }
    const done = rows.find((r) => r.event === "room_finished");
    check(done?.props?.["reason"] === "completed" && done.mode === "room", `room flow: room_finished (completed) (${JSON.stringify(done?.props)})`);
    check(rows.every((r) => r.app_version === "dev" && r.platform === null), "room flow: every row has the build id, and no platform without a user agent");
    check(
      q(`SELECT count(*) FROM public.room_events WHERE duel_id = '${roomId}'`) === String(2 + rounds * 2),
      "room flow: the beta room_events are written exactly as before, alongside",
    );
  });

  /* ------------------------------------------------------------------- async rooms */
  const playAsync = async (asyncRoomId: string, token: string) => {
    const roomRounds = Number(q(`SELECT round_count FROM public.async_rooms WHERE id = '${asyncRoomId}'`));
    for (let round = 1; round <= roomRounds; round++) {
      const started = await call(asyncFns.asyncRoundStartFn, { roomId: asyncRoomId, roundNumber: round }, token);
      if (!started.ok) throw new Error(`round ${round} start: ${JSON.stringify(started)}`);
      const sent = await call(
        asyncFns.asyncSubmitFn,
        { roomId: asyncRoomId, roundNumber: round, answer: "", msRemaining: 1000, inputType: "keyboard" },
        token,
      );
      if (!sent.ok) throw new Error(`round ${round} submit: ${JSON.stringify(sent)}`);
    }
    return roomRounds;
  };
  const asyncSequence = (rounds: number) =>
    Array.from({ length: rounds }, () => ["game_started", "game_finished"]).flat();

  await section("daily", async () => {
    const start = await call(daily.dailyStartFn, { kind: "puzzle", displayName: "Ali" }, tok.ali);
    if (!start.ok) throw new Error(`daily start: ${JSON.stringify(start)}`);
    const rounds = await playAsync(start.roomId, tok.ali);
    await flush();
    const rows = rowsWhere(`room_id = '${start.roomId}'`);
    check(
      rows.map((r) => r.event).join() === ["daily_started", ...asyncSequence(rounds), "daily_finished"].join(),
      `daily: the events in order (${rows.map((r) => r.event).join(", ")})`,
    );
    check(rows.every((r) => r.player_id === ALI && r.mode === "daily"), "daily: every row is the player's, mode daily");
    const stored = JSON.parse(
      q(`SELECT json_agg(r ORDER BY round_number)::text FROM public.async_results r WHERE room_id = '${start.roomId}'`),
    ) as { round_number: number; score: number; is_correct: boolean }[];
    const finished = rows.filter((r) => r.event === "game_finished");
    check(
      finished.length === rounds &&
        finished.every((r, i) => r.score === stored[i]!.score && r.completed === stored[i]!.is_correct && r.input_type === "keyboard" && r.props?.["round"] === i + 1),
      "daily: each game_finished carries the stored score, verdict, input type and round",
    );
    const types = JSON.parse(q(`SELECT puzzles_public::text FROM public.async_rooms WHERE id = '${start.roomId}'`)) as { type: string }[];
    check(
      rows.filter((r) => r.event === "game_started").every((r, i) => r.game === types[i]!.type),
      "daily: each game_started names the round's game",
    );
    const total = Number(q(`SELECT total_score FROM public.async_attempts WHERE room_id = '${start.roomId}' AND user_id = '${ALI}'`));
    const end = rows.at(-1)!;
    check(end.event === "daily_finished" && end.score === total && end.completed === true, `daily: daily_finished carries the total (${end.score} vs ${total})`);
    const again = await call(daily.dailyStartFn, { kind: "puzzle", displayName: "Ali" }, tok.ali);
    await flush();
    check(again.ok === true && rowsWhere(`room_id = '${start.roomId}' AND event = 'daily_started'`).length === 1, "daily: starting again records no second daily_started");
  });

  await section("challenge", async () => {
    const made = await call(
      challenge.createChallengeFn,
      { categories: ["word", "number", "pattern"], rounds: 3, displayName: "Ali" },
      tok.ali,
    );
    if (!made.ok) throw new Error(`challenge create: ${JSON.stringify(made)}`);
    const room = made.roomId as string;
    const code = q(`SELECT code FROM public.challenges WHERE room_id = '${room}'`);
    const rounds = await playAsync(room, tok.ali);
    const friend = await call(challenge.startChallengeFn, { code, displayName: "Bo" }, tok.bo);
    if (!friend.ok) throw new Error(`challenge start: ${JSON.stringify(friend)}`);
    await playAsync(room, tok.bo);
    await flush();
    const ali = rowsWhere(`room_id = '${room}' AND player_id = '${ALI}'`);
    check(
      ali.map((r) => r.event).join() === ["challenge_created", ...asyncSequence(rounds), "challenge_played"].join(),
      `challenge: the creator's events in order (${ali.map((r) => r.event).join(", ")})`,
    );
    const bo = rowsWhere(`room_id = '${room}' AND player_id = '${BO}'`);
    check(
      bo.map((r) => r.event).join() === [...asyncSequence(rounds), "challenge_played"].join(),
      `challenge: the friend's events in order (${bo.map((r) => r.event).join(", ")})`,
    );
    check([...ali, ...bo].every((r) => r.mode === "challenge"), "challenge: every row is mode challenge");
    check(ali[0]?.props?.["source"] === "play", "challenge: challenge_created says it was made to play");
    const boTotal = Number(q(`SELECT total_score FROM public.async_attempts WHERE room_id = '${room}' AND user_id = '${BO}'`));
    check(bo.at(-1)?.score === boTotal, "challenge: challenge_played carries the attempt's total");
    check(rowsWhere(`room_id = '${room}' AND event = 'daily_started'`).length === 0, "challenge: no daily events for a challenge");

    // A challenge made from the finished room copies its players' results without recording them as plays.
    const fromRoom = await call(challenge.challengeFromRoomFn, { duelId: roomId }, tok.bo);
    await flush();
    if (fromRoom.ok) {
      const copied = rowsWhere(`room_id = '${fromRoom.roomId}'`);
      check(
        copied.map((r) => r.event).join() === "challenge_created" && copied[0]!.player_id === BO && copied[0]!.props?.["source"] === "room",
        `challenge from room: only challenge_created, by its maker (${copied.map((r) => r.event).join(", ")})`,
      );
    } else check(false, `challenge from room: made (${JSON.stringify(fromRoom)})`);
  });

  /* ------------------------------------------------------------------------ practice */
  await section("practice", async () => {
    const practice = await import("../src/lib/duel/practice.functions");
    const dealt = await call(practice.practiceGenerateFn, { type: "tilegrid" }, tok.ali);
    const { start } = await call(practice.practiceStartFn, { sealed: dealt.sealed }, tok.ali);
    const graded = await call(
      practice.practiceGradeFn,
      { puzzle: dealt.puzzle, sealed: dealt.sealed, answer: "", msRemaining: 30_000, start, inputType: "touch" },
      tok.ali,
    );
    await flush();
    const rows = rowsWhere(`mode = 'practice' AND player_id = '${ALI}'`);
    check(
      rows.map((r) => r.event).join() === "game_started,game_finished",
      `practice: the round's start and finish (${rows.map((r) => r.event).join(", ")})`,
    );
    check(rows.every((r) => r.game === "tilegrid" && r.room_id === null), "practice: the game from the sealed deal, no room");
    const fin = rows.find((r) => r.event === "game_finished");
    check(
      fin?.score === graded.score && fin.completed === graded.isCorrect && fin.input_type === "touch" && typeof fin.duration_ms === "number",
      `practice: game_finished carries the server's grade (${fin?.score} vs ${graded.score})`,
    );
    check(
      q(`SELECT count(*) FROM public.practice_plays WHERE user_id = '${ALI}'`) === "1",
      "practice: the beta practice_plays row is written as before",
    );
  });

  /* ------------------------------------------------------------- the phone's events */
  await section("client events", async () => {
    const now = Date.now();
    const before = eventCount();
    const good = await call(
      analytics.recordClientEventsFn,
      {
        events: [
          { event: "app_opened", at: now - 1000, props: { standalone: true } },
          { event: "share_tapped", at: now - 900, props: { source: "room", method: "copy" } },
          { event: "invite_opened", at: now - 800, props: { source: "challenge" } },
          { event: "error_shown", at: now - 700, props: { code: "room_not_found" } },
          { event: "offline_game_played", at: now - 3_600_000, game: "tilegrid" },
        ],
      },
      tok.cy,
    );
    await flush();
    check(good.ok === true && good.accepted === 5 && good.rejected === 0, `client: five phone events accepted (${JSON.stringify(good)})`);
    const cy = rowsWhere(`player_id = '${CY}'`);
    check(
      cy.map((r) => r.event).join() === "offline_game_played,app_opened,share_tapped,invite_opened,error_shown",
      `client: stored for the caller, ordered by when they happened (${cy.map((r) => r.event).join(", ")})`,
    );
    const offline = cy.find((r) => r.event === "offline_game_played");
    check(
      !!offline && Math.abs(Date.parse(offline.occurred_at) - (now - 3_600_000)) < 1000 && offline.game === "tilegrid" && offline.mode === "practice",
      `client: an offline event keeps its own time and game (${offline?.occurred_at})`,
    );
    check(cy.every((r) => r.score === null && r.completed === null), "client: no score or result on any phone event");

    const refused: [string, unknown][] = [
      ["an unknown event", { event: "hacked" }],
      ["a server-side event (game_started)", { event: "game_started", game: "tilegrid" }],
      ["a server-side event (game_finished)", { event: "game_finished" }],
      ["a server-side event (room_created)", { event: "room_created" }],
      ["a server-side event (daily_finished)", { event: "daily_finished" }],
      ["a score field", { event: "offline_game_played", game: "tilegrid", score: 200 }],
      ["a completed field", { event: "app_opened", completed: true }],
      ["a player id", { event: "app_opened", playerId: ALI }],
      ["a score prop", { event: "share_tapped", props: { score: 200 } }],
      ["a total prop", { event: "share_tapped", props: { total_points: 612 } }],
      ["a game on another event", { event: "app_opened", game: "tilegrid" }],
      ["an unknown game", { event: "offline_game_played", game: "not-a-game" }],
      ["an error with no code", { event: "error_shown" }],
      ["an error with a stack trace", { event: "error_shown", props: { code: "Error: at foo (bar.ts:1)" } }],
      ["a nested prop", { event: "app_opened", props: { x: { y: 1 } } }],
      ["an event older than 30 days", { event: "app_opened", at: now - 31 * 24 * 3600 * 1000 }],
    ];
    for (const [label, value] of refused) check(acceptClientEvent(value, now) === null, `client rules: ${label} is refused`);
    const mixed = await call(analytics.recordClientEventsFn, { events: [...refused.map(([, v]) => v), { event: "app_opened" }] }, tok.cy);
    await flush();
    check(
      mixed.ok === true && mixed.accepted === 1 && mixed.rejected === refused.length && rowsWhere(`player_id = '${CY}'`).length === 6,
      `client: a batch keeps only its valid event (${JSON.stringify(mixed)})`,
    );
    const future = acceptClientEvent({ event: "app_opened", at: now + 60_000 }, now);
    check(!!future && Date.parse(future.occurredAt) === now, "client rules: a phone clock slightly ahead is held to now");
    const tooMany = await call(analytics.recordClientEventsFn, { events: Array.from({ length: 21 }, () => ({ event: "app_opened" })) }, tok.cy);
    check(tooMany.ok === false && tooMany.reason === "bad_batch", "client: a batch over 20 events is refused whole");
    const notList = await call(analytics.recordClientEventsFn, { events: { event: "app_opened" } }, tok.cy);
    check(notList.ok === false && notList.reason === "bad_batch", "client: a batch that isn't a list is refused");
    await flush();
    check(eventCount() === before + 6, "client: refused events wrote nothing");
    check(
      await (async () => {
        try {
          await call(analytics.recordClientEventsFn, { events: [{ event: "app_opened" }] }, null);
          return false;
        } catch {
          return true;
        }
      })(),
      "client: a caller without a session is refused",
    );

    // Rate limit: ANALYTICS_CLIENT_LIMIT calls per window, then refused with nothing written.
    let okCalls = 0;
    let limited = false;
    for (let i = 0; i < ANALYTICS_CLIENT_LIMIT.max + 2; i++) {
      const reply = await call(analytics.recordClientEventsFn, { events: [{ event: "app_opened" }] }, tok.dee);
      if (reply.ok) okCalls++;
      else if (reply.reason === "rate_limited") {
        limited = true;
        break;
      }
    }
    await flush();
    check(okCalls === ANALYTICS_CLIENT_LIMIT.max && limited, `client: rate limited after ${ANALYTICS_CLIENT_LIMIT.max} calls (${okCalls} ok, limited ${limited})`);
    check(rowsWhere(`player_id = '${DEE}'`).length === ANALYTICS_CLIENT_LIMIT.max, "client: a rate-limited call writes nothing");
    check(
      q(`SELECT count(*) FROM public.rate_limit_hits WHERE bucket = '${ANALYTICS_CLIENT_LIMIT.bucket}'`) !== "0",
      "client: the limit is counted through take_rate_limit",
    );
    check(CLIENT_EVENTS.length === 5, "client: five phone-side events in the list");
  });

  /* ----------------------------------------------- a failing write changes nothing */
  await section("failure isolation", async () => {
    /** A room's create and join, their replies' shapes. */
    const shapes = async () => {
      const made = await call(duel.createRoomFn, { displayName: "Dee" }, tok.dee);
      const joined = await call(duel.joinRoomFn, { roomCode: made.roomCode, displayName: "Cy" }, tok.cy);
      return {
        made: Object.keys(made).sort().join() + (/^[0-9a-f-]{36}$/.test(made.roomId) ? ":id" : ":noid"),
        joined: JSON.stringify({ ...joined, roomId: "x", roomCode: "x" }),
        roomId: made.roomId as string,
      };
    };
    const normal = await shapes();
    await flush();
    const leave = async (id: string) => call(duel.leaveRoomFn, { roomId: id }, tok.dee);
    await leave(normal.roomId);

    // 1. The insert fails in the database.
    q(`CREATE FUNCTION analytics.fail_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'analytics down'; END $$`);
    q(`CREATE TRIGGER fail_insert BEFORE INSERT ON analytics.events FOR EACH ROW EXECUTE FUNCTION analytics.fail_insert()`);
    warnings.length = 0;
    const before = eventCount();
    const failing = await shapes();
    await flush();
    check(failing.made === normal.made && failing.joined === normal.joined, `failure: a failing insert leaves create and join's replies unchanged (${failing.made} ${failing.joined})`);
    check(eventCount() === before, "failure: nothing was written");
    check(warnings.some((w) => /^\[analytics\].*analytics down/.test(w)), "failure: the failure is logged as [analytics]");
    const practiceCount = Number(q(`SELECT count(*) FROM public.room_joins WHERE duel_id = '${failing.roomId}'`));
    check(practiceCount === 2, "failure: the beta room_joins are still written");
    await leave(failing.roomId);
    q(`DROP TRIGGER fail_insert ON analytics.events`);

    // 2. The service role may no longer call the RPC (a missing grant or function).
    q(`REVOKE EXECUTE ON FUNCTION public.record_analytics_events(jsonb) FROM service_role`);
    warnings.length = 0;
    const refused = await shapes();
    await flush();
    check(refused.made === normal.made && refused.joined === normal.joined, "failure: a refused RPC leaves the replies unchanged");
    check(warnings.some((w) => /^\[analytics\]/.test(w)), "failure: the refusal is logged");
    await leave(refused.roomId);
    q(`GRANT EXECUTE ON FUNCTION public.record_analytics_events(jsonb) TO service_role`);

    // 3. The insert hangs: the reply doesn't wait for it, and the write is abandoned after its timeout.
    q(`CREATE FUNCTION analytics.slow_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(4); RETURN NEW; END $$`);
    q(`CREATE TRIGGER slow_insert BEFORE INSERT ON analytics.events FOR EACH ROW EXECUTE FUNCTION analytics.slow_insert()`);
    warnings.length = 0;
    const t0 = performance.now();
    const made = await call(duel.createRoomFn, { displayName: "Dee" }, tok.dee);
    const took = performance.now() - t0;
    check(typeof made.roomId === "string" && took < 2_000, `failure: a hanging insert doesn't hold up the reply (${Math.round(took)} ms)`);
    await flush();
    check(warnings.some((w) => /^\[analytics\].*gave up/.test(w)), "failure: the hanging write is abandoned after its timeout");
    // The abandoned insert is still sleeping in the database: wait for it (asynchronously, so the stand-in server can
    // finish it) before the DROP, which would otherwise block on its lock.
    for (let i = 0; i < 100; i++) {
      const busy = q(`SELECT count(*) FROM pg_stat_activity WHERE query LIKE '%record_analytics_events%' AND state <> 'idle' AND pid <> pg_backend_pid()`);
      if (busy === "0") break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    q(`DROP TRIGGER slow_insert ON analytics.events`);
    await leave(made.roomId);

    // 4. recordEvents itself never throws, whatever it is given.
    let threw = false;
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      events.recordEvents(null as never);
      events.recordEvents([{ event: "app_opened", playerId: () => Promise.reject(new Error("x")) }]);
      events.recordEvents({ event: "nope" as never, score: Number.NaN, roomId: "not-a-uuid" });
    } catch {
      threw = true;
    }
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 50));
    process.off("unhandledRejection", onUnhandled);
    check(!threw && unhandled.length === 0, `failure: recordEvents never throws or leaves a rejection unhandled (${unhandled.length})`);
    check(warnings.some((w) => /^\[analytics\] dropped/.test(w)), "failure: malformed events are dropped with a warning");
  });

  /* ---------------------------------------------------------- the player activity view */
  await section("player activity", async () => {
    const p1 = uid(101);
    const p2 = uid(102);
    const p3 = uid(103);
    q(`INSERT INTO auth.users (id) VALUES ('${p1}'), ('${p2}'), ('${p3}')`);
    const ev = (player: string, event: string, game: string | null, at: string) =>
      `('${player}', '${event}', ${game ? `'${game}'` : "NULL"}, timestamptz '${at}')`;
    q(`INSERT INTO analytics.events (player_id, event, game, occurred_at) VALUES
      ${[
        ev(p1, "app_opened", null, "2026-11-01 08:00+00"),
        ev(p1, "game_started", "gridlock", "2026-11-01 09:00+00"),
        ev(p1, "game_started", "gridlock", "2026-11-01 09:10+00"),
        ev(p1, "game_started", "gridlock", "2026-11-02 09:00+00"),
        ev(p1, "game_started", "orbit", "2026-11-02 10:00+00"),
        ev(p1, "game_started", "orbit", "2026-11-03 10:00+00"),
        ev(p1, "game_started", "tilt", "2026-11-03 11:00+00"),
        ev(p1, "game_started", "blackout", "2026-11-03 12:00+00"),
        ev(p1, "game_finished", "blackout", "2026-11-03 12:01+00"),
        ev(p1, "app_opened", null, "2026-11-05 12:00+00"),
        ev(p2, "app_opened", null, "2026-11-01 09:00+00"),
        ev(p2, "share_tapped", null, "2026-11-01 09:00+00"),
        ev(p3, "game_finished", "tilt", "2026-11-01 09:00+00"),
      ].join(",")}`);
    // Names: the latest of a room seat and a daily attempt.
    const room = q(
      `INSERT INTO public.duels (room_code, host_user_id, status, round_order) VALUES ('VW12', '${p1}', 'waiting', '[]') RETURNING id`,
    ).split("\n")[0]!;
    q(`INSERT INTO public.duel_players (duel_id, player_slot, user_id, display_name, joined_at) VALUES ('${room}', 1, '${p1}', 'Old Name', '2026-10-01')`);
    q(`INSERT INTO public.duel_players (duel_id, player_slot, user_id, display_name, joined_at) VALUES ('${room}', 2, '${p2}', 'Pat', '2026-10-01')`);
    const view = JSON.parse(
      q(`SELECT coalesce(json_agg(v ORDER BY player_id), '[]')::text FROM analytics.player_activity v WHERE player_id IN ('${p1}', '${p2}', '${p3}')`),
    ) as { player_id: string; name: string | null; first_seen: string; last_played: string; games_played: number; favourite_games: string[]; days_active: number }[];
    check(view.length === 1 && view[0]!.player_id === p1, `view: only the player with a game_started is listed (${view.map((v) => v.player_id).join(",")})`);
    const row = view[0]!;
    check(row.games_played === 7, `view: games_played counts game_started (${row.games_played})`);
    check(
      JSON.stringify(row.favourite_games) === JSON.stringify(["gridlock", "orbit", "blackout"]),
      `view: favourite_games is the top 3 by count, ties by name (${JSON.stringify(row.favourite_games)})`,
    );
    check(Date.parse(row.last_played) === Date.parse("2026-11-03T12:00:00Z"), `view: last_played is the last game_started, not a later app_opened (${row.last_played})`);
    check(Date.parse(row.first_seen) === Date.parse("2026-11-01T08:00:00Z"), `view: first_seen is the first event of any kind (${row.first_seen})`);
    check(row.days_active === 3, `view: days_active counts the UK days with a game (${row.days_active})`);
    check(row.name === "Old Name", `view: the name comes from the existing tables (${row.name})`);
    const later = q(
      `INSERT INTO public.duels (room_code, host_user_id, status, round_order) VALUES ('VW13', '${p1}', 'waiting', '[]') RETURNING id`,
    ).split("\n")[0]!;
    q(`INSERT INTO public.duel_players (duel_id, player_slot, user_id, display_name, joined_at) VALUES ('${later}', 1, '${p1}', 'New Name', '2026-11-04')`);
    check(
      q(`SELECT name FROM analytics.player_activity WHERE player_id = '${p1}'`) === "New Name",
      "view: the latest display name wins",
    );
    check(
      q(`SELECT count(*) FROM analytics.player_activity WHERE player_id IN ('${ALI}', '${BO}')`) === "2" &&
        q(`SELECT count(*) FROM analytics.player_activity WHERE player_id = '${CY}'`) === "0",
      "view: the flows' players are listed; a device with only phone events is not",
    );
  });

  /* ---------------------------------------------------------------------- retention */
  await section("retention", async () => {
    q(`INSERT INTO analytics.events (event, occurred_at) VALUES ('app_opened', now() - interval '14 months'), ('app_opened', now() - interval '12 months')`);
    const total = eventCount();
    const deleted = Number(q(`SELECT analytics.purge_old_events()`));
    check(deleted === 1 && eventCount() === total - 1, `retention: only events older than 13 months are deleted (${deleted})`);
    check(
      q(`SELECT count(*) FROM analytics.events WHERE occurred_at < now() - interval '13 months'`) === "0",
      "retention: nothing older than 13 months is left",
    );
  });
}

restore();
console.log(`analytics-events-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS");
