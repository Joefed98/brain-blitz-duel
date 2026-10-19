/**
 * chat-notice-check (18 Oct 2026, presentation only): room chat makes new messages obvious between
 * rounds and stays out of the way during play (src/lib/duel/chatNotice.ts, RoomChat.tsx,
 * useRoomChat.ts, the room route).
 *
 *  1. The composer's placeholder is "Chat…".
 *  2. Unread: only other players' messages not yet seen in the open sheet count (never your own);
 *     the chat button shows that count in gold and nothing when there is none.
 *  3. Between rounds, a message from another player arriving live shows a toast with their badge
 *     (colour and icon or initial), name and the first words, plays the soft chat blip once and a
 *     haptic once; tapping it opens the messages; your own message never toasts.
 *  4. During a round (chat unavailable): no toast, no sound, no haptic; afterwards that message never
 *     toasts late; the play header shows only the small unread dot (RoundChatDot), silent and
 *     untappable, and only while something is unread.
 *  5. Wiring: the hook plays no sound itself; the room route shows the dot through
 *     showRoundChatDot on the live round's header.
 *
 *   bun scripts/chat-notice-check.tsx
 */
import { readFileSync } from "node:fs";
import { mock } from "bun:test";
import { Window } from "happy-dom";

import {
  CHAT_TOAST_CHARS,
  CHAT_TOAST_WORDS,
  chatToastText,
  shouldToast,
  showRoundChatDot,
  unreadCount,
} from "../src/lib/duel/chatNotice";
import type { RoomMessageRow } from "../src/lib/duel/chatConstants";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}

/* ------------------------------------------------------------ pure rules */

check(chatToastText("gg") === "gg", "short message kept whole");
check(chatToastText("  one two  three ") === "one two three", "whitespace collapsed");
check(chatToastText("a b c d e f g h i j") === "a b c d e f g h…", `first ${CHAT_TOAST_WORDS} words: ${chatToastText("a b c d e f g h i j")}`);
const long = chatToastText("supercalifragilistic expialidocious antidisestablishmentarianism words");
check(long.length <= CHAT_TOAST_CHARS + 1 && long.endsWith("…"), `long words cut to ${CHAT_TOAST_CHARS} characters: ${long}`);
check(chatToastText("x".repeat(120)).length === CHAT_TOAST_CHARS + 1, "one unbroken word cut");

const msg = (id: string, sender: string, text = "hello there"): RoomMessageRow => ({
  id, duel_id: "room", sender_user_id: sender, sender_name: sender === "me" ? "Me" : "Sam", text, created_at: "2026-10-18T12:00:00Z",
});
const list = [msg("1", "me"), msg("2", "u2"), msg("3", "u2"), msg("4", "me")];
check(unreadCount(list, "me", new Set()) === 2, "own messages counted as unread");
check(unreadCount(list, "me", new Set(["2"])) === 1, "seen messages counted as unread");
check(shouldToast(msg("5", "u2"), { myUserId: "me", chatAvailable: true, sheetOpen: false }), "a live message between rounds must toast");
check(!shouldToast(msg("5", "me"), { myUserId: "me", chatAvailable: true, sheetOpen: false }), "own message toasted");
check(!shouldToast(msg("5", "u2"), { myUserId: "me", chatAvailable: false, sheetOpen: false }), "toast during a round");
check(!shouldToast(msg("5", "u2"), { myUserId: "me", chatAvailable: true, sheetOpen: true }), "toast with the sheet open");
check(showRoundChatDot(2, false) && !showRoundChatDot(0, false) && !showRoundChatDot(3, true), "round dot rule");

/* ------------------------------------------------------------ the real RoomChat in happy-dom */

const win = new Window({ url: "https://brain-blitz-duel.lovable.app/duel/ABCD" });
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "localStorage", "sessionStorage", "location", "getComputedStyle", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame"] as const) {
  const value = (win as unknown as Record<string, unknown>)[key];
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: typeof value === "function" && key !== "HTMLElement" && key !== "Element" && key !== "Node" && key !== "Event" ? (value as (...a: unknown[]) => unknown).bind(win) : value });
}
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let vibrations = 0;
Object.defineProperty(win.navigator, "vibrate", { configurable: true, value: () => { vibrations++; return true; } });

let blips = 0;
const realSound = await import("../src/lib/sound");
mock.module("../src/lib/sound", () => ({ ...realSound, playBlip: () => { blips++; } }));
mock.module("@/lib/sound", () => ({ ...realSound, playBlip: () => { blips++; } }));

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { RoomChat, RoundChatDot } = await import("../src/components/duel/RoomChat");
const { resolvePlayerLooks } = await import("../src/lib/duel/playerLook");
type ChatState = Parameters<typeof RoomChat>[0]["chat"];

const players = [
  { id: "p1", duel_id: "room", player_slot: 1, display_name: "Me", user_id: "me", status: "active", colour: 0, icon: null },
  { id: "p2", duel_id: "room", player_slot: 2, display_name: "Sam", user_id: "u2", status: "active", colour: 6, icon: "rocket" },
] as unknown as Parameters<typeof RoomChat>[0]["players"];
const looks = resolvePlayerLooks(players!);
let sheetOpen = false;
const state = (over: Partial<ChatState> = {}): ChatState => ({
  messages: [], reactions: [], unread: 0, incoming: null, sheetOpen, setSheetOpen: (open: boolean) => { sheetOpen = open; },
  sending: false, error: null, notice: null, send: async () => {}, react: async () => {}, report: async () => {},
  mutedUserIds: [], toggleLocalMute: () => {}, ...over,
});

const host = document.createElement("div");
document.body.appendChild(host);
const root = createRoot(host as unknown as HTMLElement);
const draw = async (chat: ChatState, available: boolean) => {
  await act(async () => {
    root.render(React.createElement(RoomChat, { chat, myUserId: "me", players, looks, available, screenLabel: "Lobby" }));
  });
};
const toast = () => document.querySelector("[data-chat-toast]");

// 1, 2: placeholder and the unread badge.
await draw(state(), true);
check(document.querySelector("input[data-room-chat-input]")?.getAttribute("placeholder") === "Chat…", `placeholder is "${document.querySelector("input[data-room-chat-input]")?.getAttribute("placeholder")}"`);
check(!document.querySelector("[data-chat-unread]"), "a badge with nothing unread");
const two = [msg("a", "u2", "first"), msg("b", "u2", "second")];
await draw(state({ messages: two, unread: 2 }), true);
check(document.querySelector("[data-chat-unread]")?.textContent === "2", "unread count badge missing or wrong");
check(/2 unread/.test(document.querySelector("button[aria-label^='Messages']")?.getAttribute("aria-label") ?? ""), "the chat button's label does not say how many are unread");

// 3: a live message between rounds toasts once, with sound and haptic.
const live = msg("c", "u2", "nice one that was a really close finish there mate");
await draw(state({ messages: [...two, live], unread: 3, incoming: live }), true);
check(!!toast(), "no toast for a new message between rounds");
check(toast()?.textContent?.includes("Sam") === true, "toast lacks the sender's name");
check(toast()?.textContent?.includes(chatToastText(live.text)) === true, `toast lacks the first words: ${toast()?.textContent}`);
check(!!toast()?.querySelector("[data-player-badge], svg, span"), "toast lacks the sender's badge");
check((toast() as HTMLElement | null)?.style.borderColor !== "", "toast lacks the sender's colour");
check(blips === 1 && vibrations === 1, `toast sound ${blips} / haptic ${vibrations}, expected 1 / 1`);
await draw(state({ messages: [...two, live], unread: 3, incoming: live }), true);
check(blips === 1, "the same message played its sound twice");
await act(async () => (toast() as HTMLElement).click());
check(sheetOpen, "tapping the toast does not open the messages");
sheetOpen = false;

// Your own message never toasts.
const mine = msg("d", "me", "thanks");
await draw(state({ messages: [...two, live, mine], unread: 3, incoming: mine }), true);
check(blips === 1, "own message played a sound");

// 4: during a round, nothing but the dot; and no late toast afterwards.
await draw(state({ messages: [...two, live, mine], unread: 0, incoming: null }), true);
const inRound = msg("e", "u2", "hurry up");
await draw(state({ messages: [...two, live, mine, inRound], unread: 1, incoming: inRound }), false);
check(!toast() && blips === 1 && vibrations === 1, "toast, sound or haptic during a round");
await draw(state({ messages: [...two, live, mine, inRound], unread: 1, incoming: inRound }), true);
check(!toast() && blips === 1, "a message from during the round toasted afterwards");

const dotHost = document.createElement("div");
document.body.appendChild(dotHost);
const dotRoot = createRoot(dotHost as unknown as HTMLElement);
await act(async () => dotRoot.render(React.createElement(RoundChatDot, { unread: 2 })));
const dot = dotHost.querySelector("[data-round-chat-dot]") as HTMLElement | null;
check(!!dot && /pointer-events-none/.test(dot.className) && !dot.querySelector("button") && /h-2 w-2/.test(dot.className), "round dot is not a small untappable dot");
check(!/\d/.test((dot?.textContent ?? "").replace(/\d+ unread messages?/, "")), "round dot shows more than a screen-reader count");
await act(async () => dotRoot.render(React.createElement(RoundChatDot, { unread: 0 })));
check(!dotHost.querySelector("[data-round-chat-dot]"), "round dot with nothing unread");

// 5: wiring.
const hookSrc = readFileSync("src/lib/duel/useRoomChat.ts", "utf8");
check(!/playBlip|playCue|soundCue/.test(hookSrc), "useRoomChat plays a sound itself (it would sound during rounds)");
check(/unreadCount\(/.test(hookSrc), "useRoomChat does not count unread through unreadCount");
const routeSrc = readFileSync("src/routes/duel.$code.tsx", "utf8");
check(/showRoundChatDot\(chat\.unread, chatAvailable\)/.test(routeSrc) && /\{chatDot\}/.test(routeSrc), "the live round's header does not show the chat dot");

await act(async () => {
  root.unmount();
  dotRoot.unmount();
});

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL: ${failures.length} of ${passes + failures.length} checks failed`);
  process.exit(1);
}
console.log(`PASS: ${passes} checks (placeholder, unread badge, toast with badge, name and first words, one blip and haptic, silent dot during rounds)`);
process.exit(0);
