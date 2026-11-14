/**
 * server-input-check (Security C2, 14 Nov 2026): every server function outside the room and chat area checks its
 * input's type, shape and size before its handler runs, through the shared helpers in src/lib/validate.ts. Grown batch
 * by batch (batch 2: accounts, safety, friends, push, analytics, beta and identity); the Security session adds batch 1
 * (rooms and chat) later.
 *
 *   1. Static: in every file of the batches, each `createServerFn` that takes an input builds it through validate.ts
 *      (or one of the named normalisers in NORMALISERS, which are themselves built on it), no `(input: T) => input`
 *      pass-through remains, and a function without an input validator never reads `data`. Every input-taking
 *      function in those files has an entry in SPECS, so a new one can't go unchecked.
 *   2. Live (the real server functions through scripts/server-fn-harness.ts on a local PostgreSQL with every
 *      migration applied): each function is called with a non-object, each field wrong-typed, each field as a 1 MB
 *      string and as a 100,000-item list, and every call is refused as InvalidInput (naming the field) before the
 *      handler runs: no row anywhere in the database changes. Then each is called once with a good input, which the
 *      validator lets through (whatever the handler answers). The good-input flows themselves are proved by each
 *      area's own checks (accounts-check, friends-check, push-notifications-check, analytics-events-check…).
 *
 * Fields marked `soft` are ones whose shape the handler judges itself and answers softly (analytics' `events`: a value
 * that isn't a list of at most 20 is "bad_batch", proved by analytics-events-check), so only their size is refused here.
 */
import { readFileSync } from "node:fs";

import {
  accountToken,
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
    quietLog(`  FAIL ${label}`);
  }
}

const quietLog = console.log;
const quietWarn = console.warn;
const quietError = console.error;
console.log = (...args: unknown[]) => {
  const line = args.map(String).join(" ");
  if (/^\s*(FAIL|NOTE)|^server-input-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = () => {};
const restore = () => {
  console.log = quietLog;
  console.warn = quietWarn;
  console.error = quietError;
};

/* ------------------------------------------------------------------ the batches */

/** Every server-function file of each batch (all of its functions are covered, input-taking or not). */
const BATCHES: Record<string, string[]> = {
  "batch 2": [
    "src/lib/account/account.functions.ts",
    "src/lib/account/saveProgress.functions.ts",
    "src/lib/safety/safety.functions.ts",
    "src/lib/friends/friends.functions.ts",
    "src/lib/push/push.functions.ts",
    "src/lib/analytics/analytics.functions.ts",
    "src/lib/beta/terms.functions.ts",
    "src/lib/beta/feedback.functions.ts",
    "src/lib/identity/identityEvents.functions.ts",
    "src/lib/appVersion.functions.ts",
  ],
};

/** Named normalisers a validator may call besides validate.ts's helpers (each built on validate.ts in its file). */
const NORMALISERS = ["usernameInput", "idText"];

/** validate.ts's helpers (read from the file, so a new one counts). */
const HELPERS = [...readFileSync("src/lib/validate.ts", "utf8").matchAll(/^export function (\w+)/gm)].map((m) => m[1]!);

type Kind = "text" | "bool" | "num" | "object" | "soft";
interface Spec {
  file: string;
  name: string;
  /** A good input: the validator lets it through. */
  good: unknown;
  /** Each field (a dotted path for a nested one) and what it must be. Leave out for a `whole` input. */
  fields?: Record<string, Kind>;
  /** An input that is a flat object of short strings or booleans, its keys kept as sent (validate.ts recordOf). */
  whole?: "strings" | "flags";
  /** "account": the caller is signed up; "guest" (default): an anonymous guest. */
  as?: "account" | "guest";
}

const AC = "src/lib/account/account.functions.ts";
const FR = "src/lib/friends/friends.functions.ts";
const PU = "src/lib/push/push.functions.ts";
const P1 = "00000000-0000-4000-8000-000000000101";

const SPECS: Spec[] = [
  /* accounts */
  { file: AC, name: "checkUsernameFn", good: { username: "Gia_One" }, fields: { username: "text" } },
  {
    file: AC,
    name: "startSignUpFn",
    good: { method: "email", dateOfBirth: "1990-05-01", username: "Gia_One" },
    fields: { method: "text", dateOfBirth: "text", username: "text" },
  },
  {
    file: AC,
    name: "completeSignUpFn",
    good: { username: "Gia_One", dateOfBirth: "1990-05-01", colour: 3, country: "GB", turnstileToken: null },
    fields: { username: "text", dateOfBirth: "text", colour: "num", country: "text", turnstileToken: "text" },
  },
  { file: AC, name: "changeUsernameFn", good: { username: "Gia_Two" }, fields: { username: "text" }, as: "account" },
  { file: AC, name: "noteSignInFn", good: { method: "email" }, fields: { method: "text" } },
  {
    file: AC,
    name: "requestSignInEmailFn",
    good: { email: "gia@example.com", captchaToken: null },
    fields: { email: "text", captchaToken: "text" },
  },
  { file: AC, name: "requestSignUpEmailFn", good: { email: "gia@example.com" }, fields: { email: "text" } },
  {
    file: "src/lib/account/saveProgress.functions.ts",
    name: "recordSaveProgressFn",
    good: { event: "save_progress_shown", prompt: "sheet", from: "room" },
    whole: "strings",
  },
  /* safety */
  { file: "src/lib/safety/safety.functions.ts", name: "pickForcedNameFn", good: { name: "Volt" }, fields: { name: "text" } },
  /* friends */
  { file: FR, name: "friendProfileFn", good: { playerId: P1 }, fields: { playerId: "text" }, as: "account" },
  { file: FR, name: "friendSearchFn", good: { query: "gia" }, fields: { query: "text" }, as: "account" },
  { file: FR, name: "friendRequestFn", good: { playerId: P1 }, fields: { playerId: "text" }, as: "account" },
  { file: FR, name: "friendLinkRequestFn", good: { token: "abcdefghjkmn" }, fields: { token: "text" }, as: "account" },
  {
    file: FR,
    name: "friendRespondFn",
    good: { requestId: P1, accept: true },
    fields: { requestId: "text", accept: "bool" },
    as: "account",
  },
  { file: FR, name: "friendRemoveFn", good: { playerId: P1 }, fields: { playerId: "text" }, as: "account" },
  { file: FR, name: "friendBlockFn", good: { playerId: P1 }, fields: { playerId: "text" }, as: "account" },
  { file: FR, name: "friendUnblockFn", good: { playerId: P1 }, fields: { playerId: "text" }, as: "account" },
  {
    file: FR,
    name: "friendReportFn",
    good: { playerId: P1, reason: "abusive_chat" },
    fields: { playerId: "text", reason: "text" },
    as: "account",
  },
  { file: FR, name: "friendInviteFn", good: { playerId: P1 }, fields: { playerId: "text" }, as: "account" },
  {
    file: FR,
    name: "friendChallengeFn",
    good: { playerId: P1, code: "ABC234" },
    fields: { playerId: "text", code: "text" },
    as: "account",
  },
  { file: FR, name: "friendLinkFn", good: { reset: false }, fields: { reset: "bool" }, as: "account" },
  { file: FR, name: "friendLinkOwnerFn", good: { token: "abcdefghjkmn" }, fields: { token: "text" }, as: "account" },
  { file: FR, name: "friendShowOnlineFn", good: { show: null }, fields: { show: "bool" }, as: "account" },
  { file: FR, name: "friendBeatFn", good: { activity: "app" }, fields: { activity: "text" }, as: "account" },
  /* push */
  {
    file: PU,
    name: "savePushSubscriptionFn",
    good: { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "BAbc", auth: "xyz" }, timeZone: "Europe/London" },
    fields: { endpoint: "text", keys: "object", "keys.p256dh": "text", "keys.auth": "text", timeZone: "text" },
    as: "account",
  },
  { file: PU, name: "removePushSubscriptionFn", good: { endpoint: "https://fcm.googleapis.com/fcm/send/abc" }, fields: { endpoint: "text" }, as: "account" },
  { file: PU, name: "setPushSettingsFn", good: { enabled: true, bogus: false }, whole: "flags", as: "account" },
  {
    file: PU,
    name: "notePushAnswerFn",
    good: { answer: "declined", moment: "friend_request_sent" },
    fields: { answer: "text", moment: "text" },
    as: "account",
  },
  { file: PU, name: "notePushOpenedFn", good: { event: "room_invite" }, fields: { event: "text" }, as: "account" },
  /* analytics, beta, identity */
  {
    file: "src/lib/analytics/analytics.functions.ts",
    name: "recordClientEventsFn",
    good: { events: [{ event: "app_opened" }] },
    fields: { events: "soft" },
  },
  {
    file: "src/lib/beta/terms.functions.ts",
    name: "recordTermsAgreedFn",
    good: { version: 1, agreedAt: "2026-11-14T12:00:00.000Z" },
    fields: { version: "num", agreedAt: "text" },
  },
  {
    file: "src/lib/identity/identityEvents.functions.ts",
    name: "recordIdentityEventFn",
    good: { event: "customise_opened" },
    whole: "strings",
  },
];

/* ------------------------------------------------------------------ 1. static */

/** The text from an opening bracket at `start` to its match (quotes, templates and comments skipped). */
function balanced(src: string, start: number): string {
  const open = src[start]!;
  const close = open === "(" ? ")" : open === "{" ? "}" : "]";
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i]!;
    if (c === "/" && src[i + 1] === "/") {
      i = src.indexOf("\n", i);
      if (i < 0) break;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i = src.indexOf("*/", i + 2) + 1;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === "\\") i++;
      continue;
    }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`unbalanced ${open} at ${start}`);
}

interface ServerFn {
  file: string;
  name: string;
  validator: string | null;
  handler: string;
}

function serverFns(file: string): ServerFn[] {
  const src = readFileSync(file, "utf8");
  const out: ServerFn[] = [];
  const starts = [...src.matchAll(/export const (\w+) = createServerFn\(/g)];
  for (let k = 0; k < starts.length; k++) {
    const m = starts[k]!;
    const end = k + 1 < starts.length ? starts[k + 1]!.index! : src.length;
    const block = src.slice(m.index!, end);
    const v = block.indexOf(".inputValidator(");
    const h = block.indexOf(".handler(");
    out.push({
      file,
      name: m[1]!,
      validator: v < 0 ? null : balanced(block, v + ".inputValidator".length),
      handler: h < 0 ? "" : balanced(block, h + ".handler".length),
    });
  }
  return out;
}

const PASS_THROUGH = /\(\s*input\s*(?::[^)]*)?\)\s*=>\s*input\s*[,)]/;
const SPEC_KEYS = new Set(SPECS.map((s) => `${s.file}#${s.name}`));
const covered = new Set<string>();

for (const [batch, files] of Object.entries(BATCHES)) {
  let withInput = 0;
  let without = 0;
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const fns = serverFns(file);
    check(fns.length > 0, `${file}: has server functions`);
    const usesValidate = /from "@\/lib\/validate"/.test(src);
    for (const fn of fns) {
      const label = `${batch}: ${fn.name} (${file})`;
      if (fn.validator === null) {
        without++;
        // The handler's own parameter (`async ({ data, context })`), not a local `data` it reads from a query.
        const param = /^\(\s*async\s*\(([^)]*)\)/.exec(fn.handler)?.[1] ?? "";
        check(!/\bdata\b/.test(param), `${label}: takes no input and never reads data`);
        continue;
      }
      withInput++;
      check(!PASS_THROUGH.test(fn.validator), `${label}: no (input: T) => input pass-through`);
      const calls = [...fn.validator.matchAll(/\b(\w+)\(/g)].map((c) => c[1]!);
      const viaHelper = calls.some((c) => HELPERS.includes(c));
      const viaNormaliser = calls.some((c) => NORMALISERS.includes(c));
      check(viaHelper || viaNormaliser, `${label}: builds its input through validate.ts or a named normaliser`);
      if (viaHelper) check(usesValidate, `${label}: its file imports src/lib/validate.ts`);
      if (viaNormaliser) {
        for (const n of calls.filter((c) => NORMALISERS.includes(c))) {
          const def = new RegExp(`function ${n}\\([^)]*\\)[^{]*\\{([\\s\\S]*?)\\n\\}`).exec(src);
          check(
            !!def && [...def[1]!.matchAll(/\b(\w+)\(/g)].some((c) => HELPERS.includes(c[1]!)),
            `${label}: normaliser ${n} is defined in its file on validate.ts`,
          );
        }
      }
      const key = `${file}#${fn.name}`;
      check(SPEC_KEYS.has(key), `${label}: has a live entry in SPECS`);
      covered.add(key);
    }
  }
  check(withInput > 0, `${batch}: ${withInput} input-taking functions checked, ${without} without input`);
  quietLog(`  ${batch}: ${withInput} functions with an input, ${without} without`);
}
for (const s of SPECS) check(covered.has(`${s.file}#${s.name}`), `SPECS ${s.name}: names an input-taking function in a batch file`);
check(NORMALISERS.every((n) => !HELPERS.includes(n)), "normalisers are not validate.ts helpers");

/* ------------------------------------------------------------------ 2. the bad inputs */

const MB = "a".repeat(1024 * 1024);
const HUGE_LIST = Array.from({ length: 100_000 }, () => "a");

function withField(good: unknown, path: string, value: unknown): unknown {
  const copy = structuredClone(good) as Record<string, unknown>;
  const parts = path.split(".");
  let at = copy;
  for (const p of parts.slice(0, -1)) at = at[p] as Record<string, unknown>;
  at[parts.at(-1)!] = value;
  return copy;
}

const WRONG: Record<Exclude<Kind, "soft">, unknown[]> = {
  text: [12345, true, {}],
  bool: ["yes", 1, {}],
  num: ["5", true, {}],
  object: ["x", 5, []],
};

/** Every refused case of a spec: a label, the input and the field the refusal must name. */
function badCases(spec: Spec): { label: string; data: unknown; field: string }[] {
  const out: { label: string; data: unknown; field: string }[] = [
    { label: "a string", data: "x", field: "input" },
    { label: "a number", data: 5, field: "input" },
    { label: "null", data: null, field: "input" },
    { label: "a list", data: [spec.good], field: "input" },
    { label: "nothing", data: undefined, field: "input" },
  ];
  if (spec.whole) {
    const key = Object.keys(spec.good as object)[0]!;
    out.push(
      { label: "10,000 keys", data: Object.fromEntries(Array.from({ length: 10_000 }, (_, i) => [`k${i}`, false])), field: "input" },
      { label: "a 1 MB key", data: { ...(spec.good as object), [MB]: false }, field: "input" },
      { label: `${key} wrong-typed`, data: withField(spec.good, key, spec.whole === "strings" ? 5 : "yes"), field: `input.${key}` },
      { label: `${key} a 1 MB string`, data: withField(spec.good, key, MB), field: `input.${key}` },
      { label: `${key} a 100,000-item list`, data: withField(spec.good, key, HUGE_LIST), field: `input.${key}` },
    );
    return out;
  }
  for (const [path, kind] of Object.entries(spec.fields ?? {})) {
    if (kind !== "soft")
      for (const wrong of WRONG[kind]) out.push({ label: `${path} = ${JSON.stringify(wrong)}`, data: withField(spec.good, path, wrong), field: path });
    out.push({ label: `${path} a 1 MB string`, data: withField(spec.good, path, MB), field: path });
    out.push({ label: `${path} a 100,000-item list`, data: withField(spec.good, path, HUGE_LIST), field: path });
  }
  return out;
}

/* ------------------------------------------------------------------ 3. live */

let db: LocalDb | null = null;
let rest: RestServer | null = null;

if (!postgresBin()) {
  restore();
  if (process.env["CI"]) {
    console.log(`server-input-check: ${passes} passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL`);
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: the live part didn't run (CI runs it)");
} else {
  try {
    db = startLocalDb("server-input-check-");
    check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
    rest = await startRestServer(db.socketDir);
    process.env["SUPABASE_URL"] = rest.url;
    process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
    await installServerFnPlugin();
    await live(db);
  } catch (err) {
    check(false, `harness: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
  } finally {
    await rest?.stop();
    db?.stop();
  }
}

async function live(db: LocalDb): Promise<void> {
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
  };
  const GUEST = "00000000-0000-4000-8000-000000000001";
  const ACCOUNT = "00000000-0000-4000-8000-000000000002";
  q(`INSERT INTO auth.users (id, is_anonymous, email) VALUES ('${GUEST}', true, NULL), ('${ACCOUNT}', false, 'acc@example.com'), ('${P1}', false, 'p1@example.com')`);
  const token = { guest: userToken(GUEST), account: accountToken(ACCOUNT) };

  /** Every row of every table (a crafted input that reached a handler would leave a rate-limit bucket at least). */
  const snapshot = () =>
    q(`SELECT string_agg(table_schema || '.' || table_name || '=' ||
         (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text, ',' ORDER BY 1)
       FROM information_schema.tables
       WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema')`);

  const modules = new Map<string, Record<string, unknown>>();
  for (const s of SPECS) if (!modules.has(s.file)) modules.set(s.file, await import(`../${s.file}`));

  const before = snapshot();
  let refused = 0;
  for (const spec of SPECS) {
    const fn = modules.get(spec.file)![spec.name];
    const tok = spec.as === "account" ? token.account : token.guest;
    const wrong: string[] = [];
    const cases = badCases(spec);
    for (const c of cases) {
      try {
        await callServerFn(fn, c.data, tok);
        wrong.push(`${c.label}: accepted`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const name = err instanceof Error ? err.name : "";
        if (name !== "InvalidInput" || message !== `Invalid input: ${c.field}`) wrong.push(`${c.label}: ${name} ${message.slice(0, 80)}`);
        else refused++;
      }
    }
    check(wrong.length === 0, `${spec.name}: all ${cases.length} bad inputs refused as InvalidInput naming the field${wrong.length ? ` (${wrong.join("; ")})` : ""}`);
  }
  const after = snapshot();
  const changed = diffSnapshots(before, after);
  check(changed.length === 0, `${refused} refused calls changed no row in any table${changed.length ? ` (${changed.join(", ")})` : ""}`);

  // The good inputs pass the validator (the handler's own answer, whatever it is, is the area checks' business).
  for (const spec of SPECS) {
    const fn = modules.get(spec.file)![spec.name];
    const tok = spec.as === "account" ? token.account : token.guest;
    let outcome = "answered";
    try {
      await callServerFn(fn, spec.good, tok);
    } catch (err) {
      outcome = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    }
    check(!/InvalidInput|Invalid input/.test(outcome), `${spec.name}: its good input passes the validator (${outcome.slice(0, 100)})`);
  }
}

function diffSnapshots(a: string, b: string): string[] {
  const left = new Map(a.split(",").map((p) => p.split("=") as [string, string]));
  return b
    .split(",")
    .map((p) => p.split("=") as [string, string])
    .filter(([t, n]) => left.get(t) !== n)
    .map(([t, n]) => `${t} ${left.get(t)} → ${n}`);
}

restore();
console.log(`server-input-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: every server function in the batches builds its input through validate.ts and refuses bad inputs before its handler runs.");
process.exit(0);
