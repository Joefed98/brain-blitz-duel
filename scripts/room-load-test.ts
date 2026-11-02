/**
 * Room load test (31 Oct 2026, rooms of 16): scripted bot clients play whole rooms of 16 and 32
 * against the REAL room server functions (src/lib/duel/duel.functions.ts: createRoomFn, joinRoomFn,
 * startRoomFn, advancePhaseFn, readyUpFn, submitAnswerFn, revealAnswerFn, continueFn, heartbeatFn) on a
 * throwaway in-memory TEST COPY of the database. Never a real room, never the real database: the
 * Supabase service client is replaced with the in-memory store below before anything is imported,
 * and the tool refuses to run if SUPABASE_* service variables are set.
 *
 * A tool, not a check (CI never runs it). The 32-player room is a test copy only: rooms seat 16
 * (MAX_PLAYERS); the test copy's room row is stored with max_players 32, which roomCapacity honours.
 *
 * Time runs on a virtual clock (100 ms steps), so a full room takes seconds; every server call's own
 * work is timed in real time. Each bot behaves as the phone does (useDuel.ts, the room route):
 *   - a heartbeat every 4 s (a duel_players update);
 *   - realtime: every duels / duel_players / round_results row change is delivered to every phone in the
 *     room (counted as messages), and the phone refetches players and results at most once a second
 *     (battery.ts `batched`), plus a results fetch on every phase change;
 *   - the host's phone calls advancePhaseFn once a second while a phase may be due, others 2.5 s
 *     after it is due (the room route's timers);
 *   - READY on the intro after 1–6 s; Continue on the results and standings after 1–4 s;
 *   - one answer per round at a random moment in the round's clock (some never answer).
 * Round content: scenario "arcade" deals six recorded arcade runs (scripts/fixtures/replay-runs.json,
 * today's revisions) into the test copy so every submission is a real server replay (the heaviest
 * grading there is, and the stored score is checked); scenario "dealt" uses startRoomFn's own deal
 * with empty answers (time-outs), proving the flow on a real deal.
 *
 *   bun scripts/room-load-test.ts [--players=16,32] [--scenario=arcade,dealt] [--json=<path>]
 */
import { mock } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";

for (const key of Object.keys(process.env))
  if (/^SUPABASE_SERVICE_ROLE_KEY$|^DATABASE_URL$/.test(key)) {
    console.log(`refusing to run: ${key} is set (this tool only ever uses its in-memory test copy)`);
    process.exit(2);
  }

/* ------------------------------------------------------------------ virtual clock */

const RealDate = Date;
let virtual = RealDate.UTC(2026, 9, 31, 18, 0, 0);
class VirtualDate extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0) super(virtual);
    else super(...(args as [number]));
  }
  static now(): number {
    return virtual;
  }
}
(globalThis as unknown as { Date: DateConstructor }).Date = VirtualDate as unknown as DateConstructor;

/* ------------------------------------------------------------------ the in-memory test copy */

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
const UNIQUE: Record<string, string[][]> = {
  duels: [["room_code"]],
  duel_players: [["duel_id", "player_slot"], ["duel_id", "user_id"], ["duel_id", "colour"]],
  round_results: [["duel_id", "player_slot", "round_number"]],
  duel_secrets: [["duel_id"]],
};
const ROOM_TABLES = new Set(["duels", "duel_players", "round_results"]);
let nextId = 1;
const metrics = {
  requests: new Map<string, number>(),
  changes: [] as { table: string; at: number; duel: string }[],
};
const bump = (key: string) => metrics.requests.set(key, (metrics.requests.get(key) ?? 0) + 1);
const onChange = (table: string, row: Row) => {
  if (ROOM_TABLES.has(table)) metrics.changes.push({ table, at: virtual, duel: String(table === "duels" ? row["id"] : row["duel_id"]) });
};

function query(table: string, op: "select" | "update" | "insert" | "upsert" | "delete", values?: Row | Row[]) {
  const tests: ((r: Row) => boolean)[] = [];
  let orderBy: { key: string; asc: boolean } | null = null;
  let limit = Infinity;
  let returning = op === "select";
  const rowsOf = () => (tables[table] ??= []);
  const run = (): { data: unknown; error: unknown } => {
    bump(`${op} ${table}`);
    const rows = rowsOf();
    if (op === "insert" || op === "upsert") {
      const list = (Array.isArray(values) ? values : [values!]).map((v) => ({ id: `id${nextId++}`, created_at: new Date().toISOString(), ...v }));
      const out: Row[] = [];
      for (const row of list) {
        const keys = UNIQUE[table] ?? [];
        const clash = rows.find((r) => keys.some((k) => k.every((c) => row[c] != null && r[c] === row[c])));
        if (clash) {
          if (op === "upsert") {
            Object.assign(clash, row, { id: clash["id"] });
            onChange(table, clash);
            out.push(clash);
            continue;
          }
          return { data: null, error: { code: "23505", message: `duplicate key value violates unique constraint "${table}_key"` } };
        }
        rows.push(row);
        onChange(table, row);
        out.push(row);
      }
      return { data: returning ? structuredClone(out) : null, error: null };
    }
    let matched = rows.filter((r) => tests.every((t) => t(r)));
    if (op === "delete") {
      tables[table] = rows.filter((r) => !matched.includes(r));
      for (const r of matched) onChange(table, r);
      return { data: null, error: null };
    }
    if (op === "update") {
      const keys = UNIQUE[table] ?? [];
      for (const r of matched) {
        const next = { ...r, ...(values as Row) };
        if (rows.some((o) => o !== r && keys.some((k) => k.every((c) => next[c] != null && o[c] === next[c]))))
          return { data: null, error: { code: "23505", message: `duplicate key value violates unique constraint "${table}_key"` } };
      }
      for (const r of matched) {
        Object.assign(r, values as Row);
        onChange(table, r);
      }
      return { data: returning ? structuredClone(matched) : null, error: null };
    }
    if (orderBy) {
      const { key, asc } = orderBy;
      matched = [...matched].sort((a, b) => ((a[key] as number) > (b[key] as number) ? 1 : (a[key] as number) < (b[key] as number) ? -1 : 0) * (asc ? 1 : -1));
    }
    return { data: structuredClone(matched.slice(0, limit)), error: null };
  };
  const cmp = (key: string, test: (v: unknown) => boolean) => (tests.push((r) => test(r[key])), q);
  const q: Record<string, unknown> = {
    select: () => ((returning = true), q),
    eq: (k: string, v: unknown) => cmp(k, (x) => x === v),
    neq: (k: string, v: unknown) => cmp(k, (x) => x !== v),
    is: (k: string, v: unknown) => cmp(k, (x) => (x ?? null) === v),
    in: (k: string, v: unknown[]) => cmp(k, (x) => v.includes(x)),
    lt: (k: string, v: never) => cmp(k, (x) => (x as never) < v),
    lte: (k: string, v: never) => cmp(k, (x) => (x as never) <= v),
    gt: (k: string, v: never) => cmp(k, (x) => (x as never) > v),
    gte: (k: string, v: never) => cmp(k, (x) => (x as never) >= v),
    not: () => q,
    filter: () => q,
    order: (key: string, opts?: { ascending?: boolean }) => ((orderBy = { key, asc: opts?.ascending !== false }), q),
    limit: (n: number) => ((limit = n), q),
    maybeSingle: async () => {
      const out = run();
      const data = Array.isArray(out.data) ? (out.data[0] ?? null) : out.data;
      return { data, error: out.error };
    },
    single: async () => {
      const out = run();
      const data = Array.isArray(out.data) ? (out.data[0] ?? null) : out.data;
      return { data, error: out.error ?? (data ? null : { code: "PGRST116", message: "no rows" }) };
    },
    then: (resolve: (r: unknown) => void, reject?: (e: unknown) => void) => {
      try {
        resolve(run());
      } catch (error) {
        reject?.(error);
      }
    },
  };
  return q;
}
const testCopy = {
  from: (table: string) => ({
    select: () => query(table, "select"),
    insert: (values: Row | Row[]) => query(table, "insert", values),
    upsert: (values: Row | Row[]) => query(table, "upsert", values),
    update: (values: Row) => query(table, "update", values),
    delete: () => query(table, "delete"),
  }),
  rpc: async (name: string) => {
    bump(`rpc ${name}`);
    return name === "take_rate_limit" ? { data: true, error: null } : { data: null, error: null };
  },
  auth: {},
};

/* ------------------------------------------------------------------ the server functions, unwrapped */

type Handler = (args: { data: unknown; context: { userId: string } }) => Promise<unknown>;
const serverFn = () => {
  const chain = {
    middleware: () => chain,
    inputValidator: () => chain,
    validator: () => chain,
    handler: (fn: Handler) => async (userId: string, data: unknown) => fn({ data, context: { userId } }),
  };
  return chain;
};
mock.module("@tanstack/react-start", () => ({ createServerFn: serverFn, createMiddleware: serverFn }));
mock.module("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin: testCopy }));
// The server's own logs (desync notes on time-out answers, stale-version notes) are counted, not printed.
let serverLogs = 0;
console.warn = () => void serverLogs++;
console.error = () => void serverLogs++;
console.dir = () => void serverLogs++;
const quiet = console.log;
console.log = (...args: unknown[]) => {
  if (typeof args[0] === "string" && !/^(arcade|dealt) × |^refusing|^wrote /.test(args[0])) return void serverLogs++;
  quiet(...args);
};

type Fn = (userId: string, data: unknown) => Promise<Record<string, unknown>>;
const fns = (await import("../src/lib/duel/duel.functions")) as unknown as Record<string, Fn>;
const { splitPuzzle } = await import("../src/lib/duel/secrets");
const { puzzleTimeLimitMs } = await import("../src/lib/duel/registry");

/* ------------------------------------------------------------------ timing */

const timings = new Map<string, number[]>();
async function call(name: string, userId: string, data: unknown): Promise<Record<string, unknown>> {
  const t0 = performance.now();
  try {
    return await fns[name]!(userId, data);
  } finally {
    const list = timings.get(name) ?? [];
    list.push(performance.now() - t0);
    timings.set(name, list);
  }
}
const pct = (list: number[], p: number) => {
  if (!list.length) return 0;
  const s = [...list].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!;
};

/* ------------------------------------------------------------------ one room */

interface Run {
  type: string;
  puzzle: Record<string, unknown>;
  answer: string;
  score: number;
}
const RUNS: Run[] = JSON.parse(readFileSync("scripts/fixtures/replay-runs.json", "utf8")).runs;
const ARCADE_TYPES = ["racing", "swing", "orbit", "wavefront", "matchup", "pinball"];

let seed = 31;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed / 2147483648);

interface Result {
  players: number;
  scenario: string;
  rounds: number;
  virtualSeconds: number;
  failures: string[];
  answersStored: number;
  answersExpected: number;
  scoreMismatches: number;
  messages: { total: number; perPhonePerSecond: number; roomPerSecond: number; peakRoomPerSecond: number; byTable: Record<string, number> };
  requests: { total: number; perSecond: number; byCall: Record<string, number> };
  grading: { submits: number; p50: number; p95: number; max: number; roundCloseMs: number[] };
  advance: { calls: number; p95: number };
}

async function playRoom(count: number, scenario: "arcade" | "dealt"): Promise<Result> {
  for (const key of Object.keys(tables)) delete tables[key];
  metrics.requests.clear();
  metrics.changes.length = 0;
  timings.clear();
  const failures: string[] = [];
  const startVirtual = virtual;
  const users = Array.from({ length: count }, (_, i) => `bot-${count}-${i + 1}`);
  const host = users[0]!;

  const created = await call("createRoomFn", host, { displayName: "Bot 1" });
  if (!created["roomId"]) throw new Error(`create: ${JSON.stringify(created)}`);
  const code = String(created["roomCode"]);
  const roomId = String(created["roomId"]);
  const duel = () => tables["duels"]!.find((r) => r["id"] === roomId)!;
  // The test copy only: 32 seats.
  if (count > 16) duel()["max_players"] = count;
  for (let i = 1; i < count; i++) {
    const out = await call("joinRoomFn", users[i]!, { roomCode: code, displayName: `Bot ${i + 1}`, look: { colour: Math.floor(rand() * 32) } });
    if (!out["ok"]) failures.push(`join ${i + 1}: ${out["message"]}`);
  }
  if (count === 16) {
    const extra = await call("joinRoomFn", "bot-17th", { roomCode: code, displayName: "Bot 17" });
    if (extra["ok"] || extra["message"] !== "That room is full (16 players).") failures.push(`17th join: ${JSON.stringify(extra)}`);
  }
  const seated = tables["duel_players"]!.filter((p) => p["duel_id"] === roomId).length;
  if (seated !== count) failures.push(`${seated} seated, want ${count}`);
  const colours = tables["duel_players"]!.filter((p) => p["duel_id"] === roomId).map((p) => p["colour"]);
  if (count <= 16 && new Set(colours).size !== colours.length) failures.push("two players share a colour");

  const started = await call("startRoomFn", host, { roomId });
  if (!started["ok"]) throw new Error(`start: ${JSON.stringify(started)}`);
  // Scenario "arcade": the test copy's six rounds become recorded runs (each answer a real replay).
  const expected = new Map<number, Run>();
  if (scenario === "arcade") {
    const runs = ARCADE_TYPES.map((t) => RUNS.filter((r) => r.type === t).at(-1)!);
    const split = runs.map((r) => splitPuzzle(r.puzzle as never));
    duel()["round_order"] = runs.map((r) => r.type);
    duel()["round_count"] = runs.length;
    duel()["puzzles_public"] = split.map((s) => s.pub);
    tables["duel_secrets"]!.find((s) => s["duel_id"] === roomId)!["puzzles_private"] = split.map((s) => s.priv);
    runs.forEach((r, i) => expected.set(i + 1, r));
  }
  const rounds = Number(duel()["round_count"]);

  // Per-phone state.
  const phones = users.map((user, i) => ({
    user,
    slot: i + 1,
    heartbeatAt: virtual + Math.floor(rand() * 4000),
    lastPlayersFetch: -Infinity,
    playersDue: false,
    lastResultsFetch: -Infinity,
    resultsDue: false,
    seenPhase: "",
    readyAt: 0,
    answerAt: 0,
    answered: 0,
    continueAt: 0,
    continued: "",
    skip: rand() < 0.06, // a few never answer a round
    lastAdvance: -Infinity,
  }));
  let delivered = 0;
  let consumed = 0;
  const roundClose: number[] = [];
  let answersExpected = 0;
  let lastPhase = "";
  let phaseSince = virtual;
  const STEP = 100;
  const LIMIT = virtual + 25 * 60_000;
  while (duel()["status"] !== "finished" && virtual < LIMIT) {
    virtual += STEP;
    const d = duel();
    const phase = `${d["current_round"]}:${d["phase"]}`;
    if (phase !== lastPhase) {
      lastPhase = phase;
      phaseSince = virtual;
    }
    // Realtime: every row change in the room reaches every phone (each one a message).
    const fresh = metrics.changes.slice(consumed);
    consumed = metrics.changes.length;
    for (const change of fresh) {
      if (change.duel !== roomId) continue;
      delivered += phones.length;
      for (const p of phones) {
        if (change.table === "duel_players") p.playersDue = true;
        if (change.table === "round_results") p.resultsDue = true;
      }
    }
    const round = Number(d["current_round"]);
    const name = String(d["phase"]);
    const pub = (d["puzzles_public"] as Record<string, unknown>[])[round - 1];
    const limitMs = pub ? puzzleTimeLimitMs(pub as never) : 60_000;
    for (const p of phones) {
      // Batched refetches (at most one a second each), and a results read on every phase change.
      if (p.playersDue && virtual - p.lastPlayersFetch >= 1000) {
        p.playersDue = false;
        p.lastPlayersFetch = virtual;
        bump("phone fetch players");
      }
      if ((p.resultsDue && virtual - p.lastResultsFetch >= 1000) || p.seenPhase !== phase) {
        p.resultsDue = false;
        p.lastResultsFetch = virtual;
        bump("phone fetch results");
      }
      if (p.seenPhase !== phase) {
        p.seenPhase = phase;
        if (name === "intro") p.readyAt = virtual + 1000 + Math.floor(rand() * 5000);
        if (name === "puzzle") {
          p.answerAt = p.skip ? Infinity : virtual + 1500 + Math.floor(rand() * (limitMs - 2500));
          if (!p.skip) answersExpected++;
        }
        if (name === "result" || name === "standings") p.continueAt = virtual + 1000 + Math.floor(rand() * 3000);
        if (name === "reveal") {
          bump("phone fetch reveal");
          await call("revealAnswerFn", p.user, { roomId, roundNumber: round });
        }
      }
      if (virtual >= p.heartbeatAt) {
        p.heartbeatAt += 4000;
        await call("heartbeatFn", p.user, { roomId });
      }
      if (name === "intro" && p.readyAt && virtual >= p.readyAt) {
        p.readyAt = 0;
        await call("readyUpFn", p.user, { roomId, roundNumber: round });
      }
      if (name === "puzzle" && p.answered < round && virtual >= p.answerAt) {
        p.answered = round;
        const run = expected.get(round);
        const msRemaining = Math.max(0, limitMs - (virtual - phaseSince));
        const out = await call("submitAnswerFn", p.user, { roomId, roundNumber: round, answer: run ? run.answer : "", msRemaining });
        if (!out["ok"]) failures.push(`round ${round} slot ${p.slot}: ${out["message"]}`);
      }
      if ((name === "result" || name === "standings") && p.continued !== phase && p.continueAt && virtual >= p.continueAt) {
        p.continued = phase;
        await call("continueFn", p.user, { roomId, roundNumber: round, phase: name });
      }
      // Phase timers: the host once a second, the others 2.5 s after the phase is late.
      const lateFor = virtual - phaseSince;
      const due = p.slot === 1 ? virtual - p.lastAdvance >= 1000 : lateFor > 2500 + 60_000 && virtual - p.lastAdvance >= 1500;
      if (due) {
        p.lastAdvance = virtual;
        const before = String(duel()["phase"]);
        const t0 = performance.now();
        await call("advancePhaseFn", p.user, { roomId });
        if (before === "puzzle" && duel()["phase"] === "reveal") roundClose.push(performance.now() - t0);
      }
    }
  }
  if (duel()["status"] !== "finished") failures.push(`room not finished after ${Math.round((virtual - startVirtual) / 1000)} s (phase ${lastPhase})`);
  const results = (tables["round_results"] ?? []).filter((r) => r["duel_id"] === roomId);
  let scoreMismatches = 0;
  for (const r of results) {
    const run = expected.get(Number(r["round_number"]));
    if (run && r["score"] !== run.score) scoreMismatches++;
  }
  if (scoreMismatches) failures.push(`${scoreMismatches} replays stored a score other than the recorded run's`);
  if (results.length !== answersExpected) failures.push(`${results.length} answers stored, ${answersExpected} sent`);

  const seconds = (virtual - startVirtual) / 1000;
  const byTable: Record<string, number> = {};
  for (const c of metrics.changes) if (c.duel === roomId) byTable[c.table] = (byTable[c.table] ?? 0) + phones.length;
  // Peak messages in any one-second window.
  const perSecond = new Map<number, number>();
  for (const c of metrics.changes) if (c.duel === roomId) perSecond.set(Math.floor(c.at / 1000), (perSecond.get(Math.floor(c.at / 1000)) ?? 0) + phones.length);
  const requests = [...metrics.requests.entries()].filter(([k]) => k.startsWith("phone ")).reduce((s, [, n]) => s + n, 0) + [...timings.values()].reduce((s, l) => s + l.length, 0);
  const byCall: Record<string, number> = {};
  for (const [k, l] of timings) byCall[k] = l.length;
  for (const [k, n] of metrics.requests) if (k.startsWith("phone ")) byCall[k] = n;
  const submits = timings.get("submitAnswerFn") ?? [];
  return {
    players: count,
    scenario,
    rounds,
    virtualSeconds: Math.round(seconds),
    failures,
    answersStored: results.length,
    answersExpected,
    scoreMismatches,
    messages: {
      total: delivered,
      perPhonePerSecond: +(delivered / phones.length / seconds).toFixed(2),
      roomPerSecond: +(delivered / seconds).toFixed(1),
      peakRoomPerSecond: Math.max(0, ...perSecond.values()),
      byTable,
    },
    requests: { total: requests, perSecond: +(requests / seconds).toFixed(1), byCall },
    grading: {
      submits: submits.length,
      p50: +pct(submits, 50).toFixed(1),
      p95: +pct(submits, 95).toFixed(1),
      max: +Math.max(0, ...submits).toFixed(1),
      roundCloseMs: roundClose.map((x) => +x.toFixed(1)),
    },
    advance: { calls: timings.get("advancePhaseFn")?.length ?? 0, p95: +pct(timings.get("advancePhaseFn") ?? [], 95).toFixed(2) },
  };
}

/* ------------------------------------------------------------------ run */

const arg = (name: string, fallback: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const sizes = arg("players", "16,32").split(",").map(Number);
const scenarios = arg("scenario", "arcade,dealt").split(",") as ("arcade" | "dealt")[];
const out: Result[] = [];
for (const scenario of scenarios)
  for (const size of sizes) {
    const r = await playRoom(size, scenario);
    out.push(r);
    console.log(
      `${scenario} × ${size}: ${r.rounds} rounds in ${r.virtualSeconds} s (virtual); answers ${r.answersStored}/${r.answersExpected}; ` +
        `realtime ${r.messages.total} msgs (${r.messages.roomPerSecond}/s room, ${r.messages.perPhonePerSecond}/s a phone, peak ${r.messages.peakRoomPerSecond}/s); ` +
        `requests ${r.requests.total} (${r.requests.perSecond}/s); submit p50 ${r.grading.p50} ms p95 ${r.grading.p95} ms max ${r.grading.max} ms; ` +
        `failures ${r.failures.length ? r.failures.join(" | ") : "none"}`,
    );
  }
const json = arg("json", "");
if (json) writeFileSync(json, `${JSON.stringify(out, null, 2)}\n`);
process.exit(out.some((r) => r.failures.length) ? 1 : 0);
