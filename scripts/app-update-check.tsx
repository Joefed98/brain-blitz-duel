// Stale-version check (13 Oct 2026): every build carries an id (vite.config.ts
// defines __DUELZ_BUILD_ID__ for the phone and server bundles alike), the server
// hands its id out through appVersionFn, and a phone running an older copy
// reloads itself onto the new one, but never mid-round. Proven here:
//  1. a stale client is detected (and dev / equal ids never are);
//  2. outside a room it reloads straight away, onto a fresh document request;
//  3. in a room it never reloads from the countdown to the reveal, nor while an
//     answer is on its way; between rounds it shows "Updating…" first;
//  4. checks run on open, on return to the foreground and between rounds;
//  5. a reload that lands on the same old build does not loop;
//  6. after the reload the room page rejoins the same room, as the same player,
//     at the point the server holds (real useDuel, real session and api code,
//     fake Supabase underneath);
//  7. answers carry the client's version and the server logs stale ones.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mock } from "bun:test";
import { Window } from "happy-dom";

import {
  APP_BUILD_ID,
  DEV_BUILD_ID,
  VERSION_PARAM,
  isStaleVersion,
  reloadUrl,
  staleSubmissionNote,
  withoutVersionParam,
} from "../src/lib/appVersion";
import {
  MIN_CHECK_GAP_MS,
  PERIODIC_CHECK_MS,
  RETRY_SAME_TARGET_MS,
  UPDATING_MS,
  attachUpdateTriggers,
  createUpdater,
  practiceUpdateGate,
  roomUpdateGate,
  type UpdateGate,
  type Updater,
} from "../src/lib/appUpdate";
import type { DuelPhase, DuelPlayerRow, DuelRow } from "../src/lib/duel/types";

const passed: string[] = [];
const ok = (name: string) => passed.push(name);

/* ------------------------------------------------------------------ 1 ---- */

assert.equal(APP_BUILD_ID, DEV_BUILD_ID, "outside a Vite build the id is dev");
assert.equal(isStaleVersion("abc-1", "abc-2"), true);
assert.equal(isStaleVersion("abc-1", "abc-1"), false);
assert.equal(isStaleVersion("abc-1", null), false, "no answer is not stale");
assert.equal(isStaleVersion("abc-1", DEV_BUILD_ID), false);
assert.equal(isStaleVersion(DEV_BUILD_ID, "abc-2"), false, "a dev copy never reloads");
const back = reloadUrl("https://duelz.example/duel/ABCD?dev=1#x", "new-9");
assert.equal(new URL(back).pathname, "/duel/ABCD", "the reload keeps the room path");
assert.equal(new URL(back).searchParams.get(VERSION_PARAM), "new-9");
assert.equal(new URL(back).searchParams.get("dev"), "1");
assert.equal(withoutVersionParam(back), "/duel/ABCD?dev=1#x", "the marker is removed on arrival");
assert.equal(withoutVersionParam("https://duelz.example/duel/ABCD"), null);
ok("stale detection and reload address");

/* ------------------------------------------------------------------ 3 ---- */

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
const gateFor = (status: DuelRow["status"] | undefined, phase?: DuelPhase, extra = {}) =>
  roomUpdateGate({ loading: false, notFound: false, member: true, status, phase, ...extra });
assert.equal(gateFor("waiting", "intro"), "between", "lobby");
assert.equal(gateFor("countdown", "intro"), "hold", "countdown");
assert.equal(gateFor("finished", "winner_reveal"), "between", "podium / final screen");
for (const phase of PHASES) {
  const want = phase === "result" || phase === "standings" ? "between" : "hold";
  assert.equal(gateFor("in_progress", phase), want, `in_progress ${phase}`);
}
assert.equal(gateFor("in_progress", "puzzle", { loading: true }), "hold", "still loading");
assert.equal(gateFor(undefined, undefined, { notFound: true }), "now", "no such room");
assert.equal(gateFor("in_progress", "puzzle", { member: false }), "now", "not our room");
assert.equal(practiceUpdateGate("list"), "now");
for (const stage of ["loading", "intro", "puzzle", "reveal", "result"]) {
  assert.equal(practiceUpdateGate(stage), "hold", `practice ${stage}`);
}
ok("room and practice gates");

/** A fake clock, timers and server for one updater. */
function harness(opts: { client?: string; server?: string; href?: string; storage?: Map<string, string> } = {}) {
  let now = 1_000_000;
  let server = opts.server ?? "build-2";
  let timers: { at: number; fn: () => void; id: number }[] = [];
  let nextId = 1;
  const navigations: string[] = [];
  let fetches = 0;
  let cacheClears = 0;
  const store = opts.storage ?? new Map<string, string>();
  const updater = createUpdater({
    clientVersion: opts.client ?? "build-1",
    fetchServerVersion: async () => {
      fetches += 1;
      return server;
    },
    navigate: (url) => navigations.push(url),
    href: () => opts.href ?? "https://duelz.example/",
    now: () => now,
    setTimer: (fn, ms) => {
      const id = nextId++;
      timers.push({ at: now + ms, fn, id });
      return id;
    },
    clearTimer: (id) => {
      timers = timers.filter((t) => t.id !== id);
    },
    storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) },
    clearCaches: async () => {
      cacheClears += 1;
    },
  });
  const flush = async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  };
  const advance = async (ms: number) => {
    now += ms;
    const due = timers.filter((t) => t.at <= now);
    timers = timers.filter((t) => t.at > now);
    for (const t of due) t.fn();
    await flush();
  };
  return {
    updater,
    navigations,
    store,
    flush,
    advance,
    fetches: () => fetches,
    cacheClears: () => cacheClears,
    setServer: (id: string) => {
      server = id;
    },
  };
}

/* ------------------------------------------------------------------ 2 ---- */
{
  const h = harness({ href: "https://duelz.example/practice" });
  await h.updater.check({ force: true });
  await h.flush();
  assert.equal(h.updater.status(), "updating");
  assert.equal(h.navigations.length, 1, "outside a room the reload is immediate");
  assert.equal(new URL(h.navigations[0]).pathname, "/practice");
  assert.equal(new URL(h.navigations[0]).searchParams.get(VERSION_PARAM), "build-2");
  assert.equal(h.cacheClears(), 1, "service workers and Cache Storage are dropped first");
  ok("outside a room: immediate reload");
}
{
  const h = harness({ client: "build-2", server: "build-2" });
  await h.updater.check({ force: true });
  await h.flush();
  assert.equal(h.updater.status(), "current");
  assert.equal(h.navigations.length, 0, "the current build never reloads");
  ok("current build stays");
}

/* ------------------------------------------------------------------ 3 ---- */
{
  const h = harness({ href: "https://duelz.example/duel/ABCD" });
  const room = h.updater.claimGate(gateFor("in_progress", "puzzle"));
  await h.updater.check({ force: true });
  await h.flush();
  assert.equal(h.updater.status(), "stale", "stale is detected mid-round");
  await h.advance(10 * 60_000);
  assert.equal(h.navigations.length, 0, "never reloads during the puzzle");
  for (const phase of ["reveal", "winner_reveal", "intro", "round_title", "starting"] as const) {
    room.set(gateFor("in_progress", phase));
    await h.advance(UPDATING_MS * 3);
    assert.equal(h.navigations.length, 0, `never reloads in ${phase}`);
  }
  room.set(gateFor("in_progress", "puzzle"));

  // The answer is on its way as the round closes: still no reload.
  let settle!: () => void;
  const answer = h.updater.trackSubmission(new Promise<void>((r) => (settle = r)));
  room.set(gateFor("in_progress", "result"));
  await h.advance(UPDATING_MS * 3);
  assert.equal(h.navigations.length, 0, "never reloads while the answer is in flight");
  assert.equal(h.updater.status(), "stale");
  settle();
  await answer;
  await h.flush();
  assert.equal(h.updater.status(), "updating", "Updating… once the answer is in and the round closed");
  await h.advance(UPDATING_MS - 1);
  assert.equal(h.navigations.length, 0, "Updating… shows before the reload");
  await h.advance(1);
  assert.equal(h.navigations.length, 1);
  assert.equal(new URL(h.navigations[0]).pathname, "/duel/ABCD", "reloads onto the same room");
  ok("in a room: never mid-round, reload between rounds");
}
{
  // The room moves on to the next round while Updating… shows: the reload is called off.
  const h = harness({ href: "https://duelz.example/duel/ABCD" });
  const room = h.updater.claimGate(gateFor("in_progress", "standings"));
  await h.updater.check({ force: true });
  await h.flush();
  assert.equal(h.updater.status(), "updating");
  room.set(gateFor("in_progress", "intro"));
  assert.equal(h.updater.status(), "stale", "Updating… is withdrawn");
  await h.advance(UPDATING_MS * 5);
  assert.equal(h.navigations.length, 0, "no reload once the next round has begun");
  // An answer submission starting during Updating… cancels it too.
  room.set(gateFor("in_progress", "result"));
  assert.equal(h.updater.status(), "updating");
  const sent = h.updater.trackSubmission(new Promise<void>(() => {}));
  void sent;
  assert.equal(h.updater.status(), "stale");
  await h.advance(UPDATING_MS * 5);
  assert.equal(h.navigations.length, 0);
  ok("Updating… withdrawn when a round opens or an answer starts");
}

/* ------------------------------------------------------------------ 4 ---- */
{
  const h = harness({ client: "build-2", server: "build-2" });
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" as DocumentVisibilityState });
  const win = new EventTarget();
  let interval: (() => void) | null = null;
  const detach = attachUpdateTriggers(h.updater, {
    doc: doc as unknown as Document,
    win: win as unknown as Window & typeof globalThis,
    setInterval: (fn, ms) => {
      assert.equal(ms, PERIODIC_CHECK_MS);
      interval = fn;
      return 1;
    },
    clearInterval: () => {
      interval = null;
    },
  });
  await h.flush();
  assert.equal(h.fetches(), 1, "checked on open");
  doc.visibilityState = "hidden";
  doc.dispatchEvent(new Event("visibilitychange"));
  await h.flush();
  assert.equal(h.fetches(), 1, "not when going to the background");
  doc.visibilityState = "visible";
  doc.dispatchEvent(new Event("visibilitychange"));
  await h.flush();
  assert.equal(h.fetches(), 2, "checked on return to the foreground");
  win.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
  await h.flush();
  assert.equal(h.fetches(), 3, "checked on a back-forward restore");
  await h.advance(PERIODIC_CHECK_MS);
  (interval as (() => void) | null)?.();
  await h.flush();
  assert.equal(h.fetches(), 4, "checked periodically while visible");

  // Between rounds: reaching a results, standings, lobby or final screen asks again.
  const room = h.updater.claimGate(gateFor("in_progress", "puzzle"));
  await h.advance(MIN_CHECK_GAP_MS);
  room.set(gateFor("in_progress", "result"));
  await h.flush();
  assert.equal(h.fetches(), 5, "checked as the results screen opens");
  room.set(gateFor("in_progress", "standings"));
  await h.flush();
  assert.equal(h.fetches(), 5, "not again within the same between-round stretch");
  room.release();
  detach();
  assert.equal(interval, null);
  ok("checks on open, foreground, periodic and between rounds");
}

/* ------------------------------------------------------------------ 5 ---- */
{
  const storage = new Map<string, string>();
  const first = harness({ storage });
  await first.updater.check({ force: true });
  await first.flush();
  assert.equal(first.navigations.length, 1);
  // The reload landed on the old build again (e.g. the new one not yet everywhere).
  const again = harness({ storage });
  await again.updater.check({ force: true });
  await again.flush();
  assert.equal(again.navigations.length, 0, "no reload loop onto the same build");
  await again.advance(RETRY_SAME_TARGET_MS);
  await again.updater.check({ force: true });
  await again.flush();
  assert.equal(again.navigations.length, 1, "tries again after a while");
  // A newer build still reloads at once.
  const newer = harness({ storage, server: "build-3" });
  await newer.updater.check({ force: true });
  await newer.flush();
  assert.equal(newer.navigations.length, 1, "a different new build is not blocked");
  ok("no reload loops");
}

/* ------------------------------------------------------------------ 6 ---- */
// Rejoin after the reload. The phone's identity lives in localStorage (the
// Supabase session), the room in the URL and every bit of room state on the
// server, so the reloaded page must find the same player at the same point.
{
  const win = new Window({ url: "https://brain-blitz-duel.lovable.app/duel/ABCD" });
  const globals = ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "localStorage", "sessionStorage", "location"] as const;
  for (const key of globals) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value: (win as unknown as Record<string, unknown>)[key],
    });
  }
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  // The published site keeps the session in localStorage (not the editor broker).
  const { brokeredPreviewStorage } = await import("../src/integrations/supabase/previewAuthStorage");
  assert.equal(brokeredPreviewStorage(), win.localStorage, "published site: session in localStorage");
  const clientSrc = readFileSync("src/integrations/supabase/client.ts", "utf8");
  assert.match(clientSrc, /persistSession: true/, "the Supabase session survives a reload");

  const SESSION_KEY = "fake-auth-session";
  const nowIso = new Date().toISOString();
  const duelRow = {
    id: "room-1",
    room_code: "ABCD",
    status: "in_progress",
    phase: "standings",
    current_round: 3,
    host_user_id: "u-host",
    round_order: ["reaction"],
    puzzles_public: [],
    tournament_history: [],
    phase_started_at: nowIso,
    round_started_at: nowIso,
  } as unknown as DuelRow;
  const playerRow = (slot: number, user: string): DuelPlayerRow =>
    ({
      id: `p${slot}`,
      duel_id: "room-1",
      player_slot: slot,
      display_name: `P${slot}`,
      user_id: user,
      ready_round: 6,
      intro_ready_round: 3,
      muted_by_host: false,
      last_reaction_at: null,
      last_seen_at: nowIso,
      status: "active",
      joined_at: nowIso,
    }) as DuelPlayerRow;
  const tables: Record<string, Record<string, unknown>[]> = {
    duels: [duelRow as unknown as Record<string, unknown>],
    duel_players: [playerRow(1, "u-host"), playerRow(2, "u-me")] as unknown as Record<string, unknown>[],
    round_results: [],
  };
  let anonymousSignIns = 0;
  const calls: string[] = [];
  const fakeSupabase = {
    auth: {
      getSession: async () => {
        const raw = win.localStorage.getItem(SESSION_KEY);
        return { data: { session: raw ? (JSON.parse(raw) as { user: { id: string } }) : null } };
      },
      signInAnonymously: async () => {
        anonymousSignIns += 1;
        const session = { user: { id: `u-new-${anonymousSignIns}` } };
        win.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return { data: { user: session.user, session }, error: null };
      },
    },
    from(table: string) {
      const conditions: [string, unknown][] = [];
      const rows = () =>
        (tables[table] ?? []).filter((r) => conditions.every(([k, v]) => r[k] === v)).map((r) => structuredClone(r));
      const query = {
        select: () => query,
        eq: (k: string, v: unknown) => (conditions.push([k, v]), query),
        order: () => query,
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        then: (resolve: (r: { data: unknown[]; error: null }) => void) => resolve({ data: rows(), error: null }),
      };
      return query;
    },
    channel() {
      const ch = { on: () => ch, subscribe: () => ch };
      return ch;
    },
    removeChannel: async () => {},
  };
  mock.module("../src/integrations/supabase/client", () => ({ supabase: fakeSupabase }));
  mock.module("../src/lib/duel/time.functions", () => ({
    serverTimeFn: async () => ({ now: Date.now() }),
  }));
  const realFns = await import("../src/lib/duel/duel.functions");
  const record =
    (name: string) =>
    async (arg?: unknown) => {
      calls.push(name);
      if (name === "submitAnswerFn") submitted.push((arg as { data: Record<string, unknown> }).data);
      return { ok: true };
    };
  const submitted: Record<string, unknown>[] = [];
  const fakeFns: Record<string, unknown> = {};
  for (const key of Object.keys(realFns)) fakeFns[key] = key.endsWith("Fn") ? record(key) : (realFns as Record<string, unknown>)[key];
  mock.module("../src/lib/duel/duel.functions", () => fakeFns);

  const { createElement } = await import("react");
  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { useDuel } = await import("../src/lib/duel/useDuel");

  // Before the update: this phone joined the room earlier and holds its session.
  win.localStorage.setItem(SESSION_KEY, JSON.stringify({ user: { id: "u-me" } }));

  type Seen = { loading: boolean; slot: number | null; phase?: string; round?: number; gate: UpdateGate };
  const mountRoom = async (href: string) => {
    // What the reload asks for: /duel/$code, the room code taken from the path.
    const match = /^\/duel\/([^/]+)$/.exec(new URL(href).pathname);
    assert.ok(match, `the reload goes to a room route: ${href}`);
    const seen: Seen[] = [];
    function Probe({ code }: { code: string }) {
      const s = useDuel(code.toUpperCase());
      seen.push({
        loading: s.loading,
        slot: s.me?.player_slot ?? null,
        phase: s.duel?.phase,
        round: s.duel?.current_round,
        gate: roomUpdateGate({ loading: s.loading, notFound: s.notFound, member: !!s.me, status: s.duel?.status, phase: s.duel?.phase }),
      });
      return null;
    }
    const host = win.document.createElement("div");
    win.document.body.appendChild(host);
    const root = createRoot(host as unknown as Element);
    await act(async () => root.render(createElement(Probe, { code: match[1] })));
    for (let i = 0; i < 20 && (seen.at(-1)?.loading ?? true); i += 1) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 5));
      });
    }
    return { seen, unmount: () => act(async () => root.unmount()) };
  };

  const before = await mountRoom(win.location.href);
  const atStandings = before.seen.at(-1)!;
  assert.equal(atStandings.slot, 2, "in the room as player 2");
  assert.equal(atStandings.gate, "between", "standings: a between-round screen");

  // The update: a stale copy at standings reloads onto the same room.
  const h = harness({ href: win.location.href });
  const claim = h.updater.claimGate(atStandings.gate);
  await h.updater.check({ force: true });
  await h.advance(UPDATING_MS);
  assert.equal(h.navigations.length, 1);
  const target = h.navigations[0];
  claim.release();
  await before.unmount();

  // The page is replaced: in-memory state is gone; localStorage and the server stay.
  const callsBeforeReload = calls.length;
  const leftOnReload = calls.includes("leaveRoomFn");
  assert.equal(leftOnReload, false, "a reload never leaves the room");
  const routeTree = readFileSync("src/routeTree.gen.ts", "utf8");
  assert.match(routeTree, /'\/duel\/\$code'/, "the room route exists for the reload to land on");
  assert.equal(withoutVersionParam(target), "/duel/ABCD", "the marker comes off, the room stays");

  const after = await mountRoom(target);
  const landed = after.seen.at(-1)!;
  assert.equal(anonymousSignIns, 0, "the same anonymous identity, no new sign-in");
  assert.equal(landed.slot, 2, "rejoined as the same player");
  assert.equal(landed.phase, "standings", "at the same screen");
  assert.equal(landed.round, 3, "in the same round");
  assert.ok(calls.slice(callsBeforeReload).includes("heartbeatFn"), "back to sending heartbeats");
  assert.ok(!calls.includes("joinRoomFn"), "no re-join needed: the seat was never given up");
  assert.ok(after.seen.every((s) => s.gate !== "now" || !s.loading), "never 'now' while loading");
  await after.unmount();

  // The same room in the middle of a round instead: rejoining holds any reload.
  tables["duels"]![0]!["phase"] = "puzzle";
  const midRound = await mountRoom(target);
  assert.equal(midRound.seen.at(-1)!.gate, "hold");
  await midRound.unmount();
  ok("rejoins the same room as the same player after the reload");

  /* ---------------------------------------------------------------- 7 ---- */
  const { submitAnswer } = await import("../src/lib/duel/api");
  await submitAnswer({ duelId: "room-1", roundNumber: 3, answer: "x", msRemaining: 100 });
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0]!["clientVersion"], APP_BUILD_ID, "every answer carries the build id");
  assert.equal(staleSubmissionNote("submit_answer", "b-1", "ctx", "b-1"), null, "current build: no log");
  assert.match(staleSubmissionNote("submit_answer", "b-0", "ctx", "b-1") ?? "", /stale_client submit_answer: client b-0, server b-1/);
  assert.match(staleSubmissionNote("submit_answer", undefined, "ctx", "b-1") ?? "", /no client version/);
  assert.equal(staleSubmissionNote("submit_answer", undefined, "ctx", DEV_BUILD_ID), null);
  const fnSrc = readFileSync("src/lib/duel/duel.functions.ts", "utf8");
  const handler = fnSrc.slice(fnSrc.indexOf("export const submitAnswerFn"), fnSrc.indexOf("export const readyUpFn"));
  assert.ok(
    handler.indexOf("staleSubmissionNote(") > 0 && handler.indexOf("staleSubmissionNote(") < handler.indexOf("gradeRoomAnswer("),
    "the server logs before grading",
  );
  assert.doesNotMatch(handler.slice(handler.indexOf("gradeRoomAnswer(")), /clientVersion/, "grading ignores the version");
  const practiceSrc = readFileSync("src/lib/duel/practice.functions.ts", "utf8");
  assert.match(practiceSrc, /staleSubmissionNote\("practice_grade"/, "practice answers are logged too");
  ok("answers carry the version; the server logs stale ones");
}

// The build id really is defined for both bundles, once per build.
const viteConfig = readFileSync("vite.config.ts", "utf8");
assert.match(viteConfig, /__DUELZ_BUILD_ID__: JSON\.stringify\(buildId\(\)\)/);
assert.ok(!/serviceWorker\.register/.test(readFileSync("src/routes/__root.tsx", "utf8")), "no service worker");
ok("build id defined in vite.config");

for (const name of passed) console.log(`PASS ${name}`);
console.log(`app-update-check: ${passed.length} passed`);
process.exit(0);
