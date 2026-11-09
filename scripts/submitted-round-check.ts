/**
 * submitted-round-check (9 Nov 2026, hotfix found during the Supabase move): duel_players.submitted_round, the
 * column behind the live "finished" pings (finishedPing.server.ts), must hold every round a room can have.
 * 20261017140000 limited it to 0–7; room settings allow MAX_ROUNDS (12), and markSubmitted's write is best
 * effort, so rounds 8–12 failed silently and never pinged. 20261109120000 widens the check.
 *
 * What it proves:
 * - the newest migration that sets duel_players_submitted_round_range allows 0..N with N >= MAX_ROUNDS (read from
 *   src/lib/duel/roomSettings.ts), so the bound can't fall behind the code again;
 * - on a local PostgreSQL 16 with every migration applied in order (scripts/server-fn-harness.ts), the live
 *   constraint allows 0..MAX_ROUNDS and still refuses -1;
 * - the migration is idempotent and safe at any time: applied again, applied with the column missing (before
 *   20261017140000), and with 20261017140000 applied after it, the bound stays and existing values are kept;
 * - a MAX_ROUNDS-round room, created and started through the real server functions with a real
 *   requireSupabaseAuth token, stores submitted_round = r after the player's answer in every round r, 1..12,
 *   through the real submitAnswerFn → markSubmitted path.
 *
 * Needs the PostgreSQL 16 binaries (preinstalled on GitHub's ubuntu runners). Without them it fails on CI and
 * prints a NOTE locally. No browser.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
import { MAX_ROUNDS, ROOM_PRESETS, roundCap } from "../src/lib/duel/roomSettings";

let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) passes++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}

const out = console.log;
const finish = () => {
  console.log = out;
  out(`submitted-round-check: ${passes} passed, ${failures.length} failed`);
  if (failures.length) {
    out("FAIL");
    process.exit(1);
  }
  out("PASS");
};

/* ------------------------------------------------------ the migrations' bound */
const MIGRATIONS = join(import.meta.dirname, "..", "supabase", "migrations");
const FIX = "20261109120000_submitted_round_max_rounds.sql";
const ORIGINAL = "20261017140000_player_submitted_round.sql";
const files = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const bounds = files.flatMap((f) => {
  const sql = readFileSync(join(MIGRATIONS, f), "utf8").replace(/--.*$/gm, "");
  const m = /duel_players_submitted_round_range\s+CHECK\s*\(\s*submitted_round\s+BETWEEN\s+0\s+AND\s+(\d+)\s*\)/i.exec(sql);
  return m ? [{ file: f, max: Number(m[1]) }] : [];
});
const latest = bounds[bounds.length - 1];
check(files.includes(FIX), `the fix migration ${FIX} is present`);
check(
  !!latest && latest.max >= MAX_ROUNDS,
  `the newest submitted_round range (${latest?.file}: 0..${latest?.max}) covers MAX_ROUNDS ${MAX_ROUNDS}`,
);
check(MAX_ROUNDS === 12, `MAX_ROUNDS is 12, as the fix migration's comment says (${MAX_ROUNDS})`);

/* ----------------------------------------------------------- the live database */
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ALI = uid(1);
const BO = uid(2);

if (!postgresBin()) {
  if (process.env["CI"]) {
    check(false, "no PostgreSQL binaries on the CI runner");
  } else {
    out("  NOTE no PostgreSQL binaries found: the database part is not run (CI runs it)");
  }
  finish();
  process.exit(failures.length ? 1 : 0);
}

// The handlers log room selection and version notes; keep the output to the check's own lines.
console.log = (...args: unknown[]) => {
  const line = args.map(String).join(" ");
  if (/^\s*(FAIL|NOTE)/.test(line)) out(...args);
};
console.warn = () => {};
console.error = () => {};

let db: LocalDb | null = null;
let rest: RestServer | null = null;
try {
  db = startLocalDb("submitted-round-check-");
  check(
    db.failed === null,
    `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""} (${db.applied.length} applied)`,
  );
  const live = db;
  const q = (sql: string) => {
    const r = live.psql(sql);
    if (!r.ok) throw new Error(`psql: ${r.err}`);
    return r.out;
  };
  const tryQ = (sql: string) => live.psql(sql).ok;
  const fileSql = (f: string) => readFileSync(join(MIGRATIONS, f), "utf8");
  const constraintDef = () =>
    q(
      `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.duel_players'::regclass AND conname = 'duel_players_submitted_round_range'`,
    );
  const liveMax = () => {
    const m = /<=\s*(\d+)/.exec(constraintDef());
    return m ? Number(m[1]) : -1;
  };

  check(liveMax() === 12, `the applied constraint allows up to 12 (${constraintDef()})`);
  // Check constraints only (contype 'c'): from PostgreSQL 18 a NOT NULL is also a pg_constraint row
  // ("NOT NULL submitted_round", contype 'n'), which is the column's NOT NULL, not a second range check.
  const checks = q(
    `SELECT coalesce(string_agg(conname || ': ' || pg_get_constraintdef(oid), ' | '), '') FROM pg_constraint WHERE conrelid = 'public.duel_players'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%submitted_round%'`,
  );
  check(
    checks.split(" | ").length === 1 && checks.startsWith("duel_players_submitted_round_range: "),
    `exactly one check constrains submitted_round, the range check (${checks})`,
  );

  // Idempotent: applied again, and the original applied after it, change nothing.
  check(tryQ(fileSql(FIX)), "the fix migration applies a second time");
  check(tryQ(fileSql(ORIGINAL)), "the original migration re-applied after the fix is a no-op");
  check(liveMax() === 12, `the bound stays 12 after re-applying both (${constraintDef()})`);

  // Safe at any time: on a table without the column (20261017140000 never applied) it adds the column and the
  // wide bound, and 20261017140000 applied afterwards leaves both alone.
  q(`ALTER TABLE public.duel_players DROP COLUMN submitted_round`);
  check(tryQ(fileSql(FIX)), "the fix migration applies before 20261017140000 (no column yet)");
  check(
    q(
      `SELECT data_type || ',' || is_nullable || ',' || column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'duel_players' AND column_name = 'submitted_round'`,
    ) === "integer,NO,0",
    "it adds submitted_round as integer NOT NULL DEFAULT 0, as 20261017140000 does",
  );
  check(tryQ(fileSql(ORIGINAL)), "20261017140000 applied after the fix still applies");
  check(liveMax() === 12, `and the bound stays 12 (${constraintDef()})`);

  rest = await startRestServer(live.socketDir);
  process.env["SUPABASE_URL"] = rest.url;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
  q(`INSERT INTO auth.users (id) VALUES ('${ALI}'), ('${BO}')`);
  await installServerFnPlugin();

  const duel = await import("../src/lib/duel/duel.functions");
  const tok = { ali: userToken(ALI), bo: userToken(BO) };

  const made = await callServerFn(duel.createRoomFn, { displayName: "Ali" }, tok.ali);
  const roomId: string = made.roomId;
  const joined = await callServerFn(
    duel.joinRoomFn,
    { roomCode: made.roomCode, displayName: "Bo", via: "code" },
    tok.bo,
  );
  check(joined.ok === true, "a second player joins the room");

  const picks = [...ROOM_PRESETS[0]!.picks];
  check(roundCap(picks) === MAX_ROUNDS, `the Mixed preset allows MAX_ROUNDS rounds (${roundCap(picks)})`);
  const set = await callServerFn(
    duel.setRoomSettingsFn,
    { roomId, picks, rounds: MAX_ROUNDS },
    tok.ali,
  );
  check(set.ok === true, `the host saves ${MAX_ROUNDS} rounds (${JSON.stringify(set)})`);
  const started = await callServerFn(duel.startRoomFn, { roomId }, tok.ali);
  check(started.ok === true, `the host starts the room (${JSON.stringify(started)})`);
  check(
    q(`SELECT round_count FROM public.duels WHERE id = '${roomId}'`) === String(MAX_ROUNDS) &&
      q(`SELECT jsonb_array_length(puzzles_public) FROM public.duels WHERE id = '${roomId}'`) ===
        String(MAX_ROUNDS),
    `the room is dealt ${MAX_ROUNDS} rounds`,
  );

  const stored: number[] = [];
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    // The round's puzzle phase, just started: its whole clock left, so the answer is a finish before the buzzer.
    q(
      `UPDATE public.duels SET current_round = ${round}, phase = 'puzzle', phase_started_at = now(), round_started_at = now() WHERE id = '${roomId}'`,
    );
    const sent = await callServerFn(
      duel.submitAnswerFn,
      { roomId, roundNumber: round, answer: "", msRemaining: 1_000_000 },
      tok.ali,
    );
    const value = Number(
      q(`SELECT submitted_round FROM public.duel_players WHERE duel_id = '${roomId}' AND user_id = '${ALI}'`),
    );
    stored.push(value);
    check(
      sent.ok === true &&
        q(
          `SELECT count(*) FROM public.round_results WHERE duel_id = '${roomId}' AND round_number = ${round} AND player_slot = 1`,
        ) === "1",
      `round ${round}: the answer is stored (${JSON.stringify(sent)})`,
    );
    check(value === round, `round ${round}: submitted_round is stored as ${round} (${value})`);
  }
  check(
    stored.slice(7).every((v, i) => v === i + 8),
    `rounds 8-${MAX_ROUNDS}, refused by the old 0..7 check, are stored (${stored.join(",")})`,
  );

  // The bound refuses what no room has, and a re-apply keeps the stored value.
  check(
    !tryQ(`UPDATE public.duel_players SET submitted_round = -1 WHERE duel_id = '${roomId}'`),
    "a negative submitted_round is still refused",
  );
  check(
    !tryQ(`UPDATE public.duel_players SET submitted_round = ${latest!.max + 1} WHERE duel_id = '${roomId}'`),
    `a submitted_round past the bound (${latest!.max + 1}) is refused`,
  );
  check(tryQ(fileSql(FIX)), "the fix migration applies again over a room at round 12");
  check(
    q(`SELECT submitted_round FROM public.duel_players WHERE duel_id = '${roomId}' AND user_id = '${ALI}'`) ===
      String(MAX_ROUNDS),
    "and the stored round 12 is kept",
  );
} catch (err) {
  check(false, `harness: ${err instanceof Error ? (err.stack ?? err.message).split("\n").slice(0, 3).join(" | ") : String(err)}`);
} finally {
  await rest?.stop();
  db?.stop();
}
finish();
