/**
 * The shared set-up of room-start-check and round-release-check (Security C1a): the server-function harness on a local
 * PostgreSQL with every migration applied, the real room functions, and small helpers to make, start and play a room
 * through them. No browser.
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

export const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export interface RoomCheck {
  check: (ok: boolean, label: string) => void;
  section: (name: string, body: () => Promise<void>) => Promise<void>;
  finish: () => never;
}

/** Counters, sections and the summary line for a check named `name`. */
export function roomCheck(name: string, summary: string): RoomCheck {
  let passes = 0;
  const failures: string[] = [];
  const log = console.log;
  const check = (ok: boolean, label: string) => {
    if (ok) passes++;
    else {
      failures.push(label);
      log(`  FAIL ${label}`);
    }
  };
  // The handlers log room selection and other notes; keep the output to the check's own lines.
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  return {
    check,
    section: async (sectionName, body) => {
      try {
        await body();
      } catch (err) {
        check(false, `${sectionName}: threw ${err instanceof Error ? (err.stack ?? err.message).split("\n").slice(0, 3).join(" | ") : String(err)}`);
      }
    },
    finish: () => {
      console.log = log;
      log(`${name}: ${passes} passed, ${failures.length} failed`);
      if (failures.length) {
        log("FAIL");
        process.exit(1);
      }
      log(`PASS: ${summary}`);
      process.exit(0);
    },
  };
}

export interface RoomHarness {
  db: LocalDb;
  rest: RestServer;
  /** One SQL value (psql -tA), trimmed. */
  q: (sql: string) => string;
  call: typeof callServerFn;
  token: (user: string) => string;
  /** A device's own supabase-js client (what the phone holds): RLS and grants apply. */
  device: (user: string) => import("@supabase/supabase-js").SupabaseClient;
  duel: typeof import("../src/lib/duel/duel.functions");
}

/**
 * Runs `body` on a fresh harness with `users` in auth.users. Without PostgreSQL binaries: a FAIL on CI, a NOTE locally.
 */
export async function withRoomHarness(t: RoomCheck, name: string, users: string[], body: (h: RoomHarness) => Promise<void>): Promise<void> {
  if (!postgresBin()) {
    if (process.env["CI"]) {
      t.check(false, "no PostgreSQL binaries on the CI runner");
      return;
    }
    process.stdout.write(`  NOTE no PostgreSQL binaries found: ${name} not run (CI runs it)\n`);
    process.exit(0);
  }
  let db: LocalDb | null = null;
  let rest: RestServer | null = null;
  try {
    db = startLocalDb(`${name}-`);
    t.check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
    rest = await startRestServer(db.socketDir);
    process.env["SUPABASE_URL"] = rest.url;
    process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
    db.psql(`INSERT INTO auth.users (id) VALUES ${users.map((u) => `('${u}')`).join(", ")}`);
    await installServerFnPlugin();
    const { createClient } = await import("@supabase/supabase-js");
    const theDb = db;
    const theRest = rest;
    await body({
      db: theDb,
      rest: theRest,
      q: (sql) => {
        const out = theDb.psql(sql);
        if (!out.ok) throw new Error(`psql: ${out.err}`);
        return out.out.trim();
      },
      call: callServerFn,
      token: userToken,
      device: (user) =>
        createClient(theRest.url, ANON_KEY, {
          global: { headers: { Authorization: `Bearer ${userToken(user)}` } },
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        }),
      duel: await import("../src/lib/duel/duel.functions"),
    });
  } catch (err) {
    t.check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await rest?.stop();
    db?.stop();
  }
}

/** A room of `host` and `guests`, Retro only with `rounds` rounds (arcade deals are quick), still in the lobby. */
export async function lobby(h: RoomHarness, host: string, guests: string[], rounds = 3): Promise<{ roomId: string; roomCode: string }> {
  const made = (await h.call(h.duel.createRoomFn, { displayName: "Host" }, h.token(host))) as { roomId: string; roomCode: string };
  for (const [i, g] of guests.entries())
    await h.call(h.duel.joinRoomFn, { roomCode: made.roomCode, displayName: `Guest${i + 1}`, via: "code" }, h.token(g));
  const set = (await h.call(h.duel.setRoomSettingsFn, { roomId: made.roomId, picks: ["retro"], rounds }, h.token(host))) as { ok: boolean };
  if (!set.ok) throw new Error("the room's settings were refused");
  return made;
}

/** The room's status, round and phase, "status:round:phase". */
export function phaseOf(h: RoomHarness, roomId: string): string {
  return h.q(`SELECT status || ':' || current_round || ':' || coalesce(phase, '') FROM public.duels WHERE id = '${roomId}'`);
}

/** Moves the room's phase stamp `ms` into the past, then asks the server to advance; the phase it reaches. */
export async function advanceAfter(h: RoomHarness, roomId: string, user: string, ms: number): Promise<string> {
  h.q(`UPDATE public.duels SET phase_started_at = phase_started_at - interval '${ms} milliseconds', round_started_at = round_started_at - interval '${ms} milliseconds' WHERE id = '${roomId}'`);
  await h.call(h.duel.advancePhaseFn, { roomId }, h.token(user));
  return phaseOf(h, roomId);
}
