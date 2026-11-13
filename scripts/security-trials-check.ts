/**
 * security-trials-check (13 Nov 2026, Security B): the trials and tidying, mostly without a browser.
 *
 *   1. The content security policy, report-only: its directives, the two inline boot scripts' hashes (worked out here
 *      with node's own SHA-256 and compared), the Supabase and Sentry sources, the headers on a response, the enforced
 *      header still frame-ancestors only, and the server answering /csp-report before the app.
 *   2. /csp-report: both report formats read, only the directive and the blocked host kept (never a path, query or
 *      sample), the per-network limit, a GET refused, an oversized body ignored; on a local PostgreSQL the table, its
 *      grants (nobody but the service role) and a report stored through the real data function.
 *   3. The arcade wall-clock trial, log only: the line (run length × 1.3 + 15 s), puzzles never judged, the recorder
 *      firing only past the line, the room and practice calls, nothing flagged; the phone's timing event and the
 *      server's rules for it.
 *   4. Tally: the link carries the server's keyed reference, never the device's id.
 *   5. The runbook worker: kept under docs/runbook, never built in; the page's switch off by default.
 *   6. No code comment under src/ names a security audit item.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { ANON_KEY, postgresBin, SERVICE_KEY, startLocalDb, startRestServer, type LocalDb, type RestServer } from "./server-fn-harness";

let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) passes++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}
const src = (path: string) => readFileSync(path, "utf8");
const quietWarn = console.warn;
console.warn = () => {};

/* ------------------------------------------------------------------ 1. the policy */
{
  const csp = await import("../src/lib/security/csp");
  const { PLAY_CARDS_BOOT } = await import("../src/lib/playCards");
  const { OFFLINE_BOOT } = await import("../src/lib/offline/online");
  const nodeHash = (text: string) => `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;
  check((await csp.scriptHash(PLAY_CARDS_BOOT)) === nodeHash(PLAY_CARDS_BOOT) && (await csp.scriptHash(OFFLINE_BOOT)) === nodeHash(OFFLINE_BOOT), "the boot scripts' hashes match node's SHA-256 of their text");
  check(csp.INLINE_BOOT_SCRIPTS.length === 2 && csp.INLINE_BOOT_SCRIPTS[0] === PLAY_CARDS_BOOT && csp.INLINE_BOOT_SCRIPTS[1] === OFFLINE_BOOT, "both inline boot scripts are hashed, in the root's order");
  const root = src("src/routes/__root.tsx");
  const inline = [...root.matchAll(/<script dangerouslySetInnerHTML=\{\{ __html: (\w+) \}\} \/>/g)].map((m) => m[1]);
  check(inline.join() === "PLAY_CARDS_BOOT,OFFLINE_BOOT", `the root writes exactly those two inline scripts (${inline.join(", ")})`);
  const policy = await csp.serverCspPolicy({ supabaseUrl: "https://abcd.supabase.co", sentryDsn: "https://k@o1.ingest.de.sentry.io/2" });
  const dir = (name: string) => policy.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";
  check(dir("default-src") === "default-src 'self'" && dir("object-src") === "object-src 'none'" && dir("base-uri") === "base-uri 'self'", "default 'self', no objects, base 'self'");
  check(dir("script-src").includes(nodeHash(PLAY_CARDS_BOOT)) && dir("script-src").includes(nodeHash(OFFLINE_BOOT)) && !/unsafe-inline|unsafe-eval/.test(dir("script-src")), "scripts: 'self', the two hashes and Turnstile; no unsafe-inline or eval (the trial shows what hydration needs)");
  check(/https:\/\/abcd\.supabase\.co/.test(dir("connect-src")) && /wss:\/\/abcd\.supabase\.co/.test(dir("connect-src")) && /https:\/\/o1\.ingest\.de\.sentry\.io/.test(dir("connect-src")), "connect: Supabase (https and wss) and Sentry once set");
  check(dir("report-uri") === "report-uri /csp-report" && dir("report-to") === "report-to csp", "reports go to /csp-report (report-uri and report-to)");
  check(csp.supabaseSources(undefined).length === 0 && csp.supabaseSources("not a url").length === 0 && csp.sentrySources("").length === 0, "no Supabase or Sentry source without a value");
  const headers = await csp.cspReportOnlyHeaders("https://joulz.uk/practice?x=1", {});
  check(!!headers["Content-Security-Policy-Report-Only"] && headers["Reporting-Endpoints"] === 'csp="https://joulz.uk/csp-report"', `the report-only header and the reporting endpoint on the page's origin (${headers["Reporting-Endpoints"]})`);
  const h = await import("../src/lib/securityHeaders");
  check(h.SECURITY_HEADERS["Content-Security-Policy"] === h.FRAME_ANCESTORS && !("Content-Security-Policy-Report-Only" in h.SECURITY_HEADERS), "the enforced policy is still frame-ancestors only");
  const server = src("src/server.ts");
  check(/if \(new URL\(request\.url\)\.pathname === CSP_REPORT_PATH\) return secured\(await cspReport\(request\), request\);/.test(server) && server.indexOf("CSP_REPORT_PATH) return") < server.indexOf("const handler = await getServerEntry()"), "the server answers /csp-report before the app");
  check(/withReportOnly\(withSecurityHeaders\(response, request\.url\), request\)/.test(server) && /if \(!import\.meta\.env\.PROD\) return response;/.test(server), "production responses get the report-only policy after the security headers");
}

/* ------------------------------------------------------------------ 2. the report receiver */
{
  const r = await import("../src/lib/security/cspReport.server");
  const legacy = { "csp-report": { "document-uri": "https://joulz.uk/duel/ABCD?secret=1", "violated-directive": "script-src-elem 'self'", "effective-directive": "script-src-elem", "blocked-uri": "inline", "script-sample": "alert(1)" } };
  const api = [
    { type: "csp-violation", url: "https://joulz.uk/profile", body: { documentURL: "https://joulz.uk/profile", effectiveDirective: "connect-src", blockedURL: "https://tracker.example.com/path/to?q=1#x", sample: "" } },
    { type: "csp-violation", body: { effectiveDirective: "img-src", blockedURL: "data" } },
    { type: "deprecation", body: { id: "x" } },
  ];
  check(JSON.stringify(r.cspReportRows(legacy)) === JSON.stringify([{ directive: "script-src-elem", blocked_host: "inline" }]), "the older format: the directive and 'inline', nothing else");
  check(JSON.stringify(r.cspReportRows(api)) === JSON.stringify([{ directive: "connect-src", blocked_host: "tracker.example.com" }, { directive: "img-src", blocked_host: "data" }]), "the Reporting API's list: host only (no path, query or fragment), other report types skipped");
  check(r.blockedHostOf("https://a.b.c:8443/x?y") === "a.b.c" && r.blockedHostOf("blob:https://joulz.uk/123") === "blob" && r.blockedHostOf("eval") === "eval" && r.blockedHostOf("") === "other" && r.blockedHostOf({}) === "other", "blocked hosts: hostname, keyword or 'other'");
  check(r.directiveOf("script-src 'self' 'sha256-x'") === "script-src" && r.directiveOf("<b>") === null && r.directiveOf(5) === null, "directives: the name only, or nothing");
  check(r.cspReportRows(Array.from({ length: 30 }, () => api[0])).length === r.CSP_REPORTS_PER_REQUEST, "at most 10 reports a request");
  check(r.cspReportRows("x").length === 0 && r.cspReportRows(null).length === 0 && r.cspReportRows({ "csp-report": { "blocked-uri": "x" } }).length === 0, "anything else is no report");
  const stored: unknown[] = [];
  let limited = false;
  const deps = {
    db: async () => ({ from: () => ({ insert: async (rows: unknown[]) => (stored.push(...rows), { error: null }) }) }) as never,
    within: async () => !limited,
    addressKey: async (a: string) => `key:${a}`,
  };
  const post = (body: string) => new Request("https://joulz.uk/csp-report", { method: "POST", body, headers: { "content-type": "application/csp-report", "cf-connecting-ip": "203.0.113.5" } });
  const a = await r.handleCspReport(post(JSON.stringify(legacy)), deps);
  check(a.status === 204 && stored.length === 1, "a report is stored and answered 204");
  limited = true;
  const b = await r.handleCspReport(post(JSON.stringify(legacy)), deps);
  check(b.status === 204 && stored.length === 1, "over the network's limit: answered 204, nothing stored");
  limited = false;
  const big = await r.handleCspReport(post("x".repeat(r.CSP_REPORT_MAX_BYTES + 1)), deps);
  check(big.status === 204 && stored.length === 1, "an oversized body is ignored");
  const get = await r.handleCspReport(new Request("https://joulz.uk/csp-report"), deps);
  check(get.status === 405, "only POST");
  check(JSON.stringify(stored).indexOf("secret") < 0 && JSON.stringify(stored).indexOf("alert") < 0 && JSON.stringify(stored).indexOf("203.0.113") < 0, "nothing stored names a page, a sample or an address");
  check(r.CSP_REPORT_LIMIT.max === 120 && r.CSP_REPORT_LIMIT.windowSeconds === 600, "120 reports a network every 10 minutes");
  const doc = src("docs/security/csp-trial.md");
  check(/FROM public\.csp_reports[\s\S]*interval '7 days'[\s\S]*GROUP BY directive, blocked_host/.test(doc), "the doc gives Joe a week's query");
}

/* ------------------------------------------------------------------ 3. the arcade wall clock, log only */
{
  const w = await import("../src/lib/round/wallClock");
  const { puzzleRunMs, usesArcadeClock, puzzleRevealMs } = await import("../src/lib/duel/catalogue");
  const { roomPuzzleCloseMs } = await import("../src/lib/duel/roomClose");
  const breaker = { type: "breaker" } as never;
  const run = puzzleRunMs(breaker)!;
  const limit = Math.round(run * 1.3 + 15_000);
  check(w.WALL_CLOCK_SHARE === 1.3 && w.WALL_CLOCK_SLACK_MS === 15_000, "the line: run length × 1.3 + 15 s");
  check(w.arcadeWallClock(breaker, 1_000, 1_000 + limit)?.overMs === 0 && w.arcadeWallClock(breaker, 1_000, 1_001 + limit)?.overMs === 1, "inside the line: 0 over; a millisecond past: 1");
  check(w.arcadeWallClock({ type: "sudoku" } as never, 0, 10_000_000) === null && w.arcadeWallClock(breaker, undefined, 5) === null, "puzzles, and runs with no start, are never judged");
  const { ACTIVE_ARCADE_GAMES } = await import("../src/lib/arcade/arcadeFxGames.renderer");
  const insideRoom = ACTIVE_ARCADE_GAMES.filter((t) => usesArcadeClock(t as never)).every((t) => {
    const p = { type: t } as never;
    return roomPuzzleCloseMs(p) + puzzleRevealMs(p) < Math.round(puzzleRunMs(p)! * 1.3 + 15_000);
  });
  check(insideRoom, "a room's own window (close plus the reveal) ends before the line for every active arcade game");
  const ws = src("src/lib/round/wallClock.server.ts");
  check(/event: "arcade_run_slow"/.test(ws) && !/flag/i.test(ws.replace(/\/\*\*[\s\S]*?\*\//g, "")), "the recorder records arcade_run_slow and flags nothing");
  const duel = src("src/lib/duel/duel.functions.ts");
  const submit = duel.slice(duel.indexOf("export const submitAnswerFn"), duel.indexOf("export const", duel.indexOf("export const submitAnswerFn") + 10));
  check(/if \(room\.phase === "puzzle"\) \{[\s\S]*?noteSlowArcadeRun\(\{ mode: "room"/.test(submit), "a room's answer in the puzzle phase is timed from that phase");
  const practice = src("src/lib/duel/practice.functions.ts");
  check(/noteSlowArcadeRun\(\{ mode: "practice", puzzle, startMs: practiceStartMs\(\{ dealtAt, startAt, nowMs \}\), nowMs, dealtAtMs: dealtAt \}\)/.test(practice), "a live practice run is timed from the server's start, with its token's age");
  const { ANALYTICS_EVENTS, CLIENT_EVENTS } = await import("../src/lib/analytics/events");
  check((ANALYTICS_EVENTS as readonly string[]).includes("arcade_run_slow") && (ANALYTICS_EVENTS as readonly string[]).includes("arcade_run_timed") && (CLIENT_EVENTS as readonly string[]).includes("arcade_run_timed") && !(CLIENT_EVENTS as readonly string[]).includes("arcade_run_slow"), "the server's event and the phone's are on the list; only the timing comes from the phone");
  const { acceptClientEvent } = await import("../src/lib/analytics/clientEvents.server");
  const now = 1_800_000_000_000;
  const good = { event: "arcade_run_timed", at: now, game: "breaker", props: { wall_ms: 61_000, hidden_ms: 0, dropped_ticks: 12, run_ticks: 3600 } };
  check(acceptClientEvent(good, now)?.game === "breaker", "the phone's timing is accepted with its game");
  check(acceptClientEvent({ ...good, props: { ...good.props, score: 150 } }, now) === null && acceptClientEvent({ ...good, props: { ...good.props, wall_ms: -1 } }, now) === null && acceptClientEvent({ ...good, game: undefined }, now) === null && acceptClientEvent({ ...good, props: { wall_ms: 1 } }, now) === null && acceptClientEvent({ ...good, game: "no-such-game" }, now) === null, "anything but the four whole numbers and a real game is refused (never a score)");
  const { arcadeRunTiming } = await import("../src/lib/arcade/runTiming");
  const t = arcadeRunTiming({ wallMs: 70_000, hiddenMs: 10_000, runTicks: 3500 });
  check(t.wall_ms === 70_000 && t.hidden_ms === 10_000 && t.run_ticks === 3500 && t.dropped_ticks === 100, "the timing: wall, hidden, ticks and the ticks behind the visible wall time");
  check(arcadeRunTiming({ wallMs: 5, hiddenMs: 50, runTicks: -3 }).hidden_ms === 5 && arcadeRunTiming({ wallMs: 1000, hiddenMs: 0, runTicks: 600 }).dropped_ticks === 0, "never negative, hidden never past the wall time");
  const stage = src("src/components/puzzles/ArcadeCanvasStage.tsx");
  check(/trackClientEvent\("arcade_run_timed", \{ game, props: \{ \.\.\.timing \} \}\)/.test(stage) && /if \(timed \|\| runStartedAt === null\) return;/.test(stage), "the stage sends the timing once a run, from its first tick");
}

/* ------------------------------------------------------------------ 4. Tally */
{
  const link = src("src/components/beta/FeedbackLink.tsx");
  check(/feedbackRefFn\(\)/.test(link) && !/currentUserId|ensureSession/.test(link), "the link asks the server for its reference; the phone's id is never read for it");
  const { feedbackUrl } = await import("../src/lib/beta/feedback");
  const id = "0f8e5b8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
  check(!/device=/.test(feedbackUrl("https://tally.so/r/x", id, "v") ?? "") && feedbackUrl("", "0123456789abcdef0123456789abcdef", "v") === null, "a raw id is never added; no form address, no link");
  check(/process\.env\["FEEDBACK_HMAC_KEY"\]/.test(src("src/lib/beta/feedback.functions.ts")) && /if \(!key\) return \{ ref: null \};/.test(src("src/lib/beta/feedback.functions.ts")), "the key is the Worker secret FEEDBACK_HMAC_KEY; without it, no reference");
}

/* ------------------------------------------------------------------ 5. the runbook worker */
{
  const file = "docs/runbook/unregister-sw.js";
  const worker = existsSync(file) ? src(file) : "";
  check(/self\.skipWaiting\(\)/.test(worker) && /self\.registration\.unregister\(\)/.test(worker) && /startsWith\("joulz-"\)/.test(worker) && !/addEventListener\("fetch"/.test(worker) && !/indexedDB/.test(worker), "the runbook worker takes over, clears the joulz caches, unregisters itself, serves nothing and keeps IndexedDB");
  check(existsSync("docs/runbook/service-worker-off.md") && /STOP_WORKER_REGISTRATION = true/.test(src("docs/runbook/service-worker-off.md")), "its steps are written down");
  const files: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|js)$/.test(n)) files.push(p);
    }
  };
  walk("src");
  check(files.every((f) => !/runbook|unregister-sw/.test(src(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""))) && !/runbook/.test(src("vite.config.ts")), "it is never built into the app");
  const sw = await import("../src/lib/offline/serviceWorker");
  check(sw.STOP_WORKER_REGISTRATION === false && /if \(!api \|\| !import\.meta\.env\.PROD \|\| STOP_WORKER_REGISTRATION\) return \(\) => \{\};/.test(src("src/lib/offline/serviceWorker.ts")), "the page's switch is off by default and, on, stops the registration");
}

/* ------------------------------------------------------------------ 6. comments */
{
  const files: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|js)$/.test(n) && !/\.data\.ts$/.test(n)) files.push(p);
    }
  };
  walk("src");
  const named: string[] = [];
  const code = /\b(security (fix|fixes|audit)|Security fix)\b|(?:^|[\s(])(H[12]|M[2-7]|L(?:1|3|4|6|7|8|13)):/;
  for (const f of files) {
    src(f).split("\n").forEach((line, i) => {
      const comment = /^\s*(\/\/|\*|\/\*)/.test(line) ? line : line.includes("// ") ? line.slice(line.indexOf("// ")) : "";
      if (comment && code.test(comment)) named.push(`${f}:${i + 1}`);
    });
  }
  check(named.length === 0, `no comment under src/ names a security audit item (${named.slice(0, 8).join(", ") || "none"})`);
}

/* ------------------------------------------------------------------ the table, on a local PostgreSQL */
let db: LocalDb | null = null;
let rest: RestServer | null = null;
if (!postgresBin()) {
  if (process.env["CI"]) check(false, "no PostgreSQL binaries on the CI runner");
  else console.log("  NOTE no PostgreSQL binaries found: the table part didn't run (CI runs it)");
} else {
  try {
    db = startLocalDb("security-trials-check-");
    check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
    rest = await startRestServer(db.socketDir);
    process.env["SUPABASE_URL"] = rest.url;
    process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
    const q = (sql: string) => db!.psql(sql).out.trim();
    check(q(`SELECT relrowsecurity::text FROM pg_class WHERE oid = 'public.csp_reports'::regclass`) === "true", "csp_reports has row level security");
    check(["anon", "authenticated"].every((role) => q(`SELECT has_table_privilege('${role}', 'public.csp_reports', 'SELECT')::text || has_table_privilege('${role}', 'public.csp_reports', 'INSERT')::text`) === "falsefalse"), "neither API role can read or write it");
    const { adminDb } = await import("../src/lib/data/db.server");
    const { insertCspReports } = await import("../src/lib/data/csp.server");
    const { error } = await insertCspReports(await adminDb(), [{ directive: "script-src-elem", blocked_host: "inline" }]);
    check(!error && q(`SELECT directive || ',' || blocked_host FROM public.csp_reports`) === "script-src-elem,inline", `a report is stored through the data function (${error?.message ?? "ok"})`);
    check(!db.psql(`INSERT INTO public.csp_reports (directive, blocked_host) VALUES ('<b>', 'x')`).ok, "the table refuses a directive that isn't a name");
    // 30 days kept, on the existing daily analytics clean-up (its own count of analytics events unchanged).
    q(`INSERT INTO public.csp_reports (directive, blocked_host, created_at) VALUES ('img-src', 'old.example', now() - interval '31 days'), ('img-src', 'recent.example', now() - interval '29 days')`);
    q(`INSERT INTO analytics.events (event, occurred_at) VALUES ('app_opened', now() - interval '14 months')`);
    const removed = q(`SELECT analytics.purge_old_events()`);
    check(removed === "1" && q(`SELECT string_agg(blocked_host, ',' ORDER BY blocked_host) FROM public.csp_reports`) === "inline,recent.example", `the daily analytics clean-up removes reports older than 30 days and still answers its events count (${removed})`);
    check(q(`SELECT prosrc FROM pg_proc WHERE oid = 'analytics.purge_old_events()'::regprocedure`).includes("interval '13 months'"), "the clean-up keeps its 13-month analytics rule");
    check(q(`SELECT count(*) FROM pg_constraint WHERE conname = 'events_event_check' AND pg_get_constraintdef(oid) LIKE '%arcade_run_slow%' AND pg_get_constraintdef(oid) LIKE '%arcade_run_timed%' AND pg_get_constraintdef(oid) LIKE '%app_opened%'`) === "1", "analytics keeps every event and adds the two timing events");
  } catch (err) {
    check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await rest?.stop();
    db?.stop();
  }
}

console.warn = quietWarn;
console.log(`security-trials-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: the report-only policy and its receiver, the arcade wall-clock log, Tally's keyed reference, the runbook worker and the comments.");
process.exit(0);
