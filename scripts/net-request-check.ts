/**
 * net-request-check (8 Nov 2026, items 4 and 6 of docs/audit-nov-2026/performance.md; no browser, ~15 s, most of it
 * the clock's three 3 s sample limits).
 *
 *  1. policyFetch: a try that never answers is aborted at its limit (RequestTimeoutError); reads are retried on a
 *     dropped request, a time-out and a gateway 502/503/504, never on an answer from the app (500, 4xx) or the
 *     caller's own abort; single-try policies never retry.
 *  2. The room's answer: a send that hangs now fails at its limit and the room's sender sends it again
 *     (roomSend.ts), so a stalled request no longer leaves the round's answer unsent.
 *  3. supabaseRead: retried when supabase-js reports a request that failed on the way (no code), never on a
 *     database answer.
 *  4. The clock: a sample that never answers ends at CLOCK_SAMPLE_TIMEOUT_MS, so the room screen isn't held,
 *     and a slow sample (round trip over CLOCK_MAX_RTT_MS) doesn't replace a measured clock.
 *  5. The room's results: the refetch's columns are every column the room reads but the stored answer, and
 *     this device's own answers are fetched once a row (OwnAnswers).
 *  6. The wiring: the room's calls pass their policies (api.ts), the app's default time limit (start.ts), the
 *     room page's catch-up read when a phase stays due.
 */
import { readFileSync } from "node:fs";

import {
  POLICIES,
  RETRY_BACKOFF_MS,
  RequestTimeoutError,
  policyFetch,
  supabaseRead,
  type RequestPolicy,
} from "../src/lib/net/request";
import { createRoomSender } from "../src/lib/duel/roomSend";
import { OwnAnswers, ROOM_RESULT_COLUMNS, type RoomResultRow } from "../src/lib/duel/roomResults";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}

type Base = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
/** A server that never answers (until the request is aborted). */
const hang: Base = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal!.reason ?? new Error("aborted")), { once: true });
  });
/** A base that answers from a script, counting tries. */
function scripted(steps: (() => Promise<Response>)[]) {
  let tries = 0;
  const base: Base = (input, init) => {
    const step = steps[Math.min(tries, steps.length - 1)]!;
    tries += 1;
    return init?.signal?.aborted ? Promise.reject(init.signal.reason) : step();
  };
  return { base, tries: () => tries };
}
const ok = () => Promise.resolve(new Response("ok", { status: 200 }));
const status = (n: number) => () => Promise.resolve(new Response("x", { status: n }));
const drop = () => Promise.reject(new TypeError("Failed to fetch"));

const quick = (p: RequestPolicy): RequestPolicy => ({ ...p, timeoutMs: 40 });

// 1. policyFetch.
{
  const started = Date.now();
  const error = await policyFetch(quick(POLICIES.submit), hang)("https://x/_serverFn/a", { method: "POST", body: "{}" }).then(
    () => null,
    (e) => e,
  );
  const took = Date.now() - started;
  check(error instanceof RequestTimeoutError, `a hung try ends in RequestTimeoutError (${String(error)})`);
  check(took >= 35 && took < 1_000, `…at its limit (${took} ms)`);
}
{
  const s = scripted([drop, ok]);
  const res = await policyFetch(quick(POLICIES.read), s.base)("https://x/a");
  check(res.status === 200 && s.tries() === 2, `a read is retried after a dropped request (${s.tries()} tries)`);
}
{
  let n = 0;
  const base: Base = (input, init) => (n++ === 0 ? hang(input, init) : ok());
  const res = await policyFetch(quick(POLICIES.read), base)("https://x/a");
  check(res.status === 200 && n === 2, `a read is retried after a time-out (${n} tries)`);
}
for (const code of [502, 503, 504]) {
  const s = scripted([status(code), ok]);
  const res = await policyFetch(quick(POLICIES.read), s.base)("https://x/a");
  check(res.status === 200 && s.tries() === 2, `a read is retried after a gateway ${code}`);
}
for (const code of [500, 400, 401, 404]) {
  const s = scripted([status(code), ok]);
  const res = await policyFetch(quick(POLICIES.read), s.base)("https://x/a");
  check(res.status === code && s.tries() === 1, `a read is not retried on the app's own ${code}`);
}
{
  const s = scripted([drop, drop, drop, ok]);
  const error = await policyFetch(quick(POLICIES.read), s.base)("https://x/a").then(() => null, (e) => e);
  check(error instanceof TypeError && s.tries() === POLICIES.read.attempts, `a read gives up after ${POLICIES.read.attempts} tries`);
}
for (const name of ["submit", "heartbeat", "step", "standard", "clock"] as const) {
  const s = scripted([drop, ok]);
  const error = await policyFetch(quick(POLICIES[name]), s.base)("https://x/a", { method: "POST", body: "{}" }).then(() => null, (e) => e);
  check(!!error && s.tries() === 1, `${name}: a single try, never retried here`);
}
{
  const controller = new AbortController();
  const s = scripted([drop, ok]);
  const pending = policyFetch(quick(POLICIES.read), (input, init) => {
    controller.abort(new Error("caller gave up"));
    return s.base(input, init);
  })("https://x/a", { signal: controller.signal });
  const error = await pending.then(() => null, (e) => e);
  check(!!error && s.tries() === 1, "the caller's own abort is not retried");
}
{
  // A POST body is sent again unchanged on a retry.
  const bodies: unknown[] = [];
  let n = 0;
  const base: Base = (_input, init) => {
    bodies.push(init?.body);
    return n++ === 0 ? drop() : ok();
  };
  await policyFetch(quick(POLICIES.read), base)("https://x/a", { method: "POST", body: '{"data":1}' });
  check(bodies.length === 2 && bodies.every((b) => b === '{"data":1}'), "a retried read sends the same body");
}
check(POLICIES.read.attempts > 1 && RETRY_BACKOFF_MS.every((ms) => ms > 0), "reads retry after a backoff");
check(
  Object.values(POLICIES).every((p) => p.timeoutMs >= 3_000 && p.timeoutMs <= 180_000),
  "every policy's limit is between 3 s and 3 min",
);
check(POLICIES.standard.timeoutMs >= 60_000, "the default limit never cuts off a slow but working call (60 s or more)");
check(POLICIES.background.timeoutMs >= 180_000 && POLICIES.background.attempts === 1, "background work (pack deals) gets 3 minutes, one try");

// 2. The room's answer: a hung send is sent again.
{
  let tries = 0;
  const fetchImpl = policyFetch(quick(POLICIES.submit), (input, init) => {
    tries += 1;
    return tries === 1 ? hang(input, init) : ok();
  });
  const sender = createRoomSender(async (payload) => {
    const res = await fetchImpl("https://x/_serverFn/submit", { method: "POST", body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(String(res.status));
  });
  const key = "room-1";
  sender.send(key, { duelId: "room", roundNumber: 1, answer: "log", msRemaining: 0 }, 0);
  check(sender.status(key).status === "sending", "a send starts");
  await new Promise((r) => setTimeout(r, 120));
  check(sender.status(key).status === "waiting", `a hung send fails at its limit and waits to be sent again (${sender.status(key).status})`);
  sender.tick(key, 10_000, true);
  await new Promise((r) => setTimeout(r, 20));
  const st = sender.status(key);
  check(st.status === "landed" && st.attempts === 2 && tries === 2, `…and the second send lands (${st.status}, ${st.attempts} sends)`);
}

// 3. supabaseRead.
{
  let n = 0;
  const result = await supabaseRead(async () => (n++ === 0 ? { data: null, error: { code: "", message: "TypeError: Failed to fetch" } } : { data: [1], error: null }), quick(POLICIES.read));
  check(!result.error && n === 2, `a Supabase read that failed on the way is retried (${n} tries)`);
}
{
  let n = 0;
  const result = await supabaseRead(async () => {
    n++;
    return { data: null, error: { code: "42501", message: "permission denied" } };
  }, quick(POLICIES.read));
  check(result.error?.code === "42501" && n === 1, "a Supabase read the database refused is not retried");
}
{
  let n = 0;
  const result = await supabaseRead(
    (signal) =>
      new Promise((resolve) => {
        n++;
        if (n < 3) signal.addEventListener("abort", () => resolve({ data: null, error: { code: "", message: "AbortError" } }));
        else resolve({ data: "ok", error: null });
      }),
    quick(POLICIES.read),
  );
  check(!result.error && n === 3, `a Supabase read that stalls is aborted and tried again (${n} tries)`);
}

// 4. The clock.
{
  (globalThis as { window?: unknown }).window ??= globalThis;
  const clock = await import("../src/lib/duel/clock");
  let trueNow = 1_760_000_000_000;
  let mode: "fast" | "hang" | "slow" = "fast";
  clock.setClockSourcesForCheck({
    deviceNow: () => trueNow,
    serverTime: () => {
      if (mode === "hang") return new Promise(() => {});
      const trip = mode === "slow" ? 2_400 : 40;
      trueNow += trip / 2;
      const now = trueNow + 5_000; // the server reads 5 s ahead of this device
      trueNow += trip / 2;
      return Promise.resolve({ now });
    },
  });
  await clock.calibrateServerClock();
  check(Math.abs(clock.clockOffsetMs() - 5_000) <= 40, `a quick measurement sets the clock (${clock.clockOffsetMs()})`);
  const before = clock.clockOffsetMs();
  mode = "slow";
  trueNow += 0;
  const slowStart = clock.serverNow();
  await clock.calibrateServerClock();
  check(clock.clockOffsetMs() === before, `slow samples (2.4 s trips) don't replace a measured clock (${clock.clockOffsetMs()})`);
  void slowStart;
  mode = "hang";
  const started = Date.now();
  await clock.calibrateServerClock();
  const took = Date.now() - started;
  check(took >= clock.CLOCK_SAMPLE_TIMEOUT_MS * 3 - 100 && took < clock.CLOCK_SAMPLE_TIMEOUT_MS * 3 + 1_000, `a server that never answers ends the measurement (${took} ms)`);
  check(clock.clockOffsetMs() === before, "…and keeps the clock");
}

// 5. The room's results.
{
  const columns = ROOM_RESULT_COLUMNS.split(",").map((c) => c.trim());
  const types = readFileSync("src/lib/duel/types.ts", "utf8");
  const block = types.slice(types.indexOf("export interface RoundResultRow {"));
  const fields = [...block.slice(0, block.indexOf("\n}")).matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]!);
  check(!columns.includes("answer") && !columns.includes("*"), "the results refetch leaves the stored answer out");
  check(
    fields.filter((f) => f !== "answer").every((f) => columns.includes(f)) && columns.every((c) => fields.includes(c)),
    `the refetch names every other column the room reads (${fields.filter((f) => f !== "answer" && !columns.includes(f)).join(",")})`,
  );
  const row = (id: string, slot: number, round: number): RoomResultRow => ({
    id,
    duel_id: "d",
    player_slot: slot,
    round_number: round,
    is_correct: true,
    ms_remaining: 0,
    reaction_avg_ms: null,
    correct_count: null,
    errors: null,
    extra: null,
    score: 100,
    submitted_at: "",
  });
  const own = new OwnAnswers();
  const rows = [row("a", 1, 1), row("b", 2, 1), row("c", 1, 2), row("d", 3, 2)];
  check(JSON.stringify(own.missing(rows, 1)) === '["a","c"]', "only this device's own rows' answers are asked for");
  check(own.missing(rows, null).length === 0, "nothing asked for before this device's slot is known");
  own.remember([
    { id: "a", answer: "log a" },
    { id: "c", answer: "log c" },
  ]);
  check(own.missing(rows, 1).length === 0, "an answer is fetched once");
  const attached = own.attach(rows, 1);
  check(attached[0]!.answer === "log a" && attached[2]!.answer === "log c", "this device's answers are filled in");
  check(attached[1]!.answer === null && attached[3]!.answer === null, "other players' answers stay null");
  check(attached.every((r, i) => r.score === rows[i]!.score && r.id === rows[i]!.id), "every other field is kept");
}

// 6. The wiring.
{
  const api = readFileSync("src/lib/duel/api.ts", "utf8");
  for (const [fn, policy] of [
    ["submitAnswerFn", "submit"],
    ["heartbeatFn", "heartbeat"],
    ["advancePhaseFn", "step"],
    ["readyUpFn", "step"],
    ["continueFn", "step"],
    ["checkHostPresenceFn", "step"],
    ["revealAnswerFn", "read"],
    ["checkWordFn", "read"],
    ["checkMovesFn", "read"],
    ["roomPreviewFn", "read"],
  ] as const) {
    // The call, to the end of the function that makes it.
    const at = api.indexOf(`${fn}({`);
    const call = api.slice(at, api.indexOf("\n}", at));
    check(at >= 0 && call.includes(`fetch: fetchFor(POLICIES.${policy})`), `api.ts: ${fn} carries the ${policy} policy`);
  }
  check(/select\(ROOM_RESULT_COLUMNS\)/.test(api) && !/from\("round_results"\)\.select\("\*"\)/.test(api), "api.ts: the results refetch names its columns");
  check(/select\("id, answer"\)\.in\("id", missing\)/.test(api), "api.ts: own answers by row id");
  check((api.match(/supabaseRead\(/g) ?? []).length >= 5, "api.ts: the room's Supabase reads have a time limit and retries");
  const start = readFileSync("src/start.ts", "utf8");
  check(/serverFns: \{ fetch: fetchFor\(POLICIES\.standard\) \}/.test(start), "start.ts: every server call has a time limit");
  const room = readFileSync("src/routes/duel.$code.tsx", "utf8");
  check(/now - dueSince\.current > CATCH_UP_AFTER_MS[\s\S]{0,120}state\.refresh\(\)/.test(room), "room page: a phase still due re-reads the room");
  const packsSrc = readFileSync("src/lib/offline/packs.ts", "utf8");
  check(/practicePackFn\(\{ data: \{ types, count \}, fetch: fetchFor\(POLICIES\.background\) \}\)/.test(packsSrc), "packs.ts: pack deals carry the background policy");
  const installSrc = readFileSync("src/lib/offline/install.ts", "utf8");
  check(/void fillWorker\(\)\.catch\(\(\) => \{\}\);\s*return topUpPacks\(\);/.test(installSrc), "install.ts: the packs never wait for the worker's download");
  const clockSrc = readFileSync("src/lib/duel/clock.ts", "utf8");
  check(/serverTimeFn\(\{ fetch: fetchFor\(POLICIES\.clock\) \}\)/.test(clockSrc), "clock.ts: the clock's sample has its policy");
}

if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FAIL net-request-check: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log(`PASS net-request-check: ${passes} assertions`);
