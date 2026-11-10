/**
 * moderation-ui-check (safety, 10 Nov 2026; docs/moderation.md "Reports"): reporting is two taps, from a player's
 * name and from a chat message, in the real RoomLobby and RoomChat (happy-dom); the reported player is never shown
 * who reported them; the safety notices on open (warning, ban, forced rename) render from the server's answer.
 * The server side is moderation-check.
 */
import { Window } from "happy-dom";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else {
    failures.push(message);
    console.log(`  FAIL ${message}`);
  }
}

const { noticesWanted } = await import("../src/lib/safety/notices");
check(noticesWanted("/") && noticesWanted("/practice") && noticesWanted("/profile/"), "notices: asked for on the tab pages");
check(!noticesWanted("/duel/ABCD") && !noticesWanted("/daily"), "notices: never over a room or a round");
check(!noticesWanted("/", { webdriver: true }) && noticesWanted("/", { webdriver: true, allow: true }), "notices: not under automation unless allowed");
check(!noticesWanted("/", { online: false }), "notices: not offline");

const win = new Window({ url: "https://joulz.uk/duel/ABCD" });
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "KeyboardEvent", "PointerEvent", "HTMLInputElement", "HTMLButtonElement", "localStorage", "sessionStorage", "location", "getComputedStyle", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame", "MutationObserver", "CustomEvent"] as const) {
  const value = (win as unknown as Record<string, unknown>)[key];
  const bind = typeof value === "function" && !/^[A-Z]/.test(key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: bind ? (value as (...a: unknown[]) => unknown).bind(win) : value });
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
(win as unknown as { ResizeObserver: unknown }).ResizeObserver = (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { RoomLobby } = await import("../src/components/duel/RoomLobby");
const { RoomChat } = await import("../src/components/duel/RoomChat");
const { resolvePlayerLooks } = await import("../src/lib/duel/playerLook");
const { REPORT_THANKS } = await import("../src/lib/safety/reports");

const $ = (sel: string) => document.querySelector(sel) as unknown as HTMLElement | null;
const $$ = (sel: string) => [...document.querySelectorAll(sel)] as unknown as HTMLElement[];
/** One tap: a real click event, counted. */
let taps = 0;
const tap = async (el: HTMLElement | null) => {
  taps++;
  await act(async () => void el?.click());
};

type Players = Parameters<typeof RoomLobby>[0]["players"];
const players = [
  { id: "p1", duel_id: "room", player_slot: 1, display_name: "Me", user_id: "me", status: "active", colour: 0, icon: null, muted_by_host: false },
  { id: "p2", duel_id: "room", player_slot: 2, display_name: "Sam", user_id: "u2", status: "active", colour: 6, icon: null, muted_by_host: false },
  { id: "p3", duel_id: "room", player_slot: 3, display_name: "Kit", user_id: "u3", status: "active", colour: 9, icon: null, muted_by_host: false },
] as unknown as Players;
const looks = resolvePlayerLooks(players);

/* ---------------------------------------------------------------- from a name (the lobby) */
{
  const reports: [number, string][] = [];
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host as unknown as HTMLElement);
  await act(async () => {
    root.render(
      React.createElement(RoomLobby, {
        players,
        storedSettings: null,
        onSettingsChange: async () => {},
        hostUserId: "u2",
        meUserId: "me",
        isHost: false,
        starting: false,
        onStart: () => {},
        onRemove: () => {},
        onMuteForEveryone: () => {},
        tournamentHistory: [],
        looks,
        allPlayers: players,
        canChooseLook: true,
        onLookChange: async () => {},
        onReport: async (slot: number, reason: string) => void reports.push([slot, reason]),
      }),
    );
  });
  // The name chip round the badge and name: a button for other players (a tap reports them), my own the look toggle.
  const nameOf = (slot: number) =>
    ($(`[data-lobby-player='${slot}'] .rs-name`)?.parentElement?.parentElement as HTMLElement | null | undefined) ?? null;
  check(!!nameOf(1) && !!nameOf(3), "lobby: the name chips drawn");
  const chip = (slot: number) => $(`[data-lobby-player='${slot}'] > button:not([data-look-toggle])`);
  check(!!chip(2) && !!chip(3) && !chip(1), "lobby: other players' names are buttons; my own is my look toggle");
  check(
    [2, 3].every((s) => chip(s)?.getAttribute("class") === "flex min-h-11 min-w-0 flex-1 items-center gap-2" && chip(s) === nameOf(s)),
    "lobby: the name button keeps the span's classes and holds the name",
  );
  await tap($("[data-look-toggle]"));
  check(!$("[data-report-sheet]") && !!$("[data-lobby-picker]"), "lobby: tapping my own name opens my look, never a report");
  await tap(nameOf(2));
  check(!!$("[data-report-sheet]"), "lobby: the host's name can be reported too");
  await tap($("[data-report-cancel]"));
  check(!$("[data-report-sheet]"), "lobby: Cancel closes the reasons");
  taps = 0;
  await tap(nameOf(3));
  check(!!$("[data-report-sheet]") && $$("[data-report-reason]").length === 3, "lobby: tap 1 (the name) shows the three reasons");
  check(/Report Kit/.test($("[data-report-sheet]")?.textContent ?? ""), "lobby: the sheet names whom it is about");
  await tap($("[data-report-reason='offensive_name']"));
  check(taps === 2 && JSON.stringify(reports) === '[[3,"offensive_name"]]', "lobby: tap 2 (the reason) files it: two taps");
  check(($("[data-report-sheet]")?.textContent ?? "").includes(REPORT_THANKS), "lobby: a plain thank-you");
  await act(async () => root.unmount());
  host.remove();
}

/* ---------------------------------------------------------------- from a message (chat) */
{
  type ChatState = Parameters<typeof RoomChat>[0]["chat"];
  const reports: [string, string | undefined][] = [];
  const message = (id: string, sender: string, name: string) => ({ id, duel_id: "room", sender_user_id: sender, sender_name: name, text: "some words", created_at: "2026-11-10T12:00:00Z" });
  const chat: ChatState = {
    messages: [message("m1", "u2", "Sam"), message("m2", "me", "Me")], reactions: [], unread: 0, incoming: null, sheetOpen: true, setSheetOpen: () => {},
    sending: false, error: null, notice: null, send: async () => {}, react: async () => {},
    report: async (id: string, reason?: string) => void reports.push([id, reason]),
    mutedUserIds: [], toggleLocalMute: () => {},
  };
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host as unknown as HTMLElement);
  await act(async () => {
    root.render(React.createElement(RoomChat, { chat, myUserId: "me", players: players as never, looks, available: true, screenLabel: "Lobby" }));
  });
  const rows = $$("li").filter((li) => /some words/.test(li.textContent ?? ""));
  check(rows.length === 2, `chat: both messages drawn (${rows.length})`);
  const mine = rows.find((li) => /Me:/.test(li.textContent ?? ""));
  check(!!mine, "chat: my own message found");
  await tap(mine ?? null);
  check(!$("[data-report-reasons]"), "chat: tapping my own message offers no report");
  taps = 0;
  const theirs = rows.find((li) => /Sam:/.test(li.textContent ?? "")) ?? null;
  await tap(theirs);
  check($$("[data-report-reason]").length === 3, "chat: tap 1 (the message) shows the three reasons");
  await tap($("[data-report-reason='abusive_chat']"));
  check(taps === 2 && JSON.stringify(reports) === '[["m1","abusive_chat"]]', "chat: tap 2 (the reason) files it: two taps");
  // The same message, reported as cheating.
  await tap(theirs);
  await tap($("[data-report-reason='cheating']"));
  check(JSON.stringify(reports[1]) === '["m1","cheating"]', "chat: any of the three reasons");
  await act(async () => root.unmount());
  host.remove();
}

/* ---------------------------------------------------------------- the wiring */
{
  const { readFileSync, readdirSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  // Turnstile on sign-up: every call of completeSignUpFn in the app (the sign-up screens) passes a fresh token, so
  // the switch can be turned on without a screen change. Comments don't count as calls.
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(name)) files.push(path);
    }
  };
  walk("src");
  const calls: { file: string; call: string }[] = [];
  for (const file of files) {
    if (file.endsWith("account.functions.ts")) continue;
    const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const m of code.matchAll(/completeSignUpFn\(\s*\{\s*data:\s*\{[\s\S]*?\}\s*\}\s*\)/g)) calls.push({ file, call: m[0] });
    for (const m of code.matchAll(/completeSignUpFn\s*\(/g)) {
      if (!calls.some((c) => c.file === file && code.indexOf(c.call) === m.index)) calls.push({ file, call: code.slice(m.index, m.index + 80) });
    }
  }
  const missing = calls.filter((c) => !/turnstileToken:\s*await signUpTurnstileToken\(\)/.test(c.call));
  check(missing.length === 0, `sign-up: every completeSignUpFn call passes turnstileToken: await signUpTurnstileToken() (${missing.map((c) => c.file).join(", ") || `${calls.length} call(s)`})`);
  check(calls.some((c) => c.file.endsWith("SignUpFlow.tsx")), `sign-up: the sign-up screens' completeSignUpFn call is among them (${calls.length} call(s))`);
  // The sign-in email is sent by the server (requestSignInEmailFn → Auth's /otp, which captcha protection covers):
  // every call passes the phone's fresh token.
  const signIns: string[] = [];
  for (const file of files) {
    if (file.endsWith("account.functions.ts")) continue;
    const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const m of code.matchAll(/requestSignInEmailFn\(\s*\{\s*data:\s*\{[^}]*\}\s*\}\s*\)/g)) signIns.push(m[0]);
  }
  check(
    signIns.length >= 1 && signIns.every((c) => /captchaToken:\s*await signInCaptchaToken\(\)/.test(c)),
    `sign-in: every requestSignInEmailFn call passes captchaToken: await signInCaptchaToken() (${signIns.length} call(s))`,
  );
  const route = readFileSync("src/routes/duel.$code.tsx", "utf8");
  check(/onReport=\{\(slot, reason\) => reportPlayer\(duel\.id, slot, reason\)\}/.test(route), "wiring: the room's lobby reports through reportPlayerFn");
  const hook = readFileSync("src/lib/duel/useRoomChat.ts", "utf8");
  check(/reportMessageFn\(\{ data: \{ roomId, messageId, reason \} \}\)/.test(hook), "wiring: a message report sends its reason");
  const rootRoute = readFileSync("src/routes/__root.tsx", "utf8");
  check(/<SafetyNotices \/>/.test(rootRoute), "wiring: the root shows the safety notices");
}

if (failures.length) {
  console.log(`FAIL: ${failures.length} of ${passes + failures.length} moderation-ui check(s)`);
  process.exit(1);
}
console.log(`PASS: ${passes} checks: two taps to report from a name and from a message, never your own, the notices' rules and wiring`);
process.exit(0);
