/**
 * seat-key-check (14 Nov 2026, Security C1b): how a phone tells room-mates apart without account ids
 * (src/lib/duel/seatKey.ts). Rows a phone reads carry `public_id` and no `user_id`; a check's stand-in rows carry
 * `user_id` only, and the same rules read both.
 *
 *  1. Keys: seatKey / hostKey / senderKey answer the public id, else the account id (stand-ins); isSeat matches either.
 *  2. Me: myKeyAmong answers this phone's public id among public-id rows (null until it is known), its account id among
 *     stand-in rows; useDuel finds its own seat and the host by them.
 *  3. Absent rivals and Finish now (roomFlow.ts, shared with the server): the same answers keyed by public id as by
 *     account id.
 *  4. Chat (the real RoomChat in happy-dom): my own message is drawn as mine by its sender's public id, another player's
 *     is not, and the mute in its menu names the sender by public id; unread counts and toasts skip my own.
 *  5. Reactions: acceptReaction names a sender by public id from the room's rows.
 *  6. Lobby (the real RoomLobby in happy-dom): my row reads "You" and the host's row its host label, by public id.
 *  7. Rated (Security C3): W3b's answers name players by public id, and both bindings (w3Binding, multiView) take "me"
 *     from myPublicId (the account id only where a stand-in can't answer it); abort and forfeit lines, the 4-player
 *     seats and standings find "you" by public id.
 *
 *   bun scripts/seat-key-check.tsx
 */
import { Window } from "happy-dom";

import { hostKey, isSeat, myKeyAmong, seatKey, senderKey } from "../src/lib/duel/seatKey";
import { absentRivals, canFinishNow, everyoneElseAway, finishNowInSeconds } from "../src/lib/duel/roomFlow";
import { shouldToast, unreadCount } from "../src/lib/duel/chatNotice";
import type { DuelPlayerRow } from "../src/lib/duel/types";
import type { RoomMessageRow } from "../src/lib/duel/chatConstants";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else {
    failures.push(message);
    console.log(`  FAIL ${message}`);
  }
}

const NOW = Date.parse("2026-11-14T12:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
/** Rows as a phone reads them: public ids, no account ids. */
const seat = (slot: number, publicId: string, over: Partial<DuelPlayerRow> = {}) =>
  ({ id: `p${slot}`, duel_id: "room", player_slot: slot, display_name: ["", "Ali", "Bo", "Cy"][slot], public_id: publicId, status: "active", last_seen_at: iso(NOW), ready_round: 0, intro_ready_round: 0, muted_by_host: false, last_reaction_at: null, joined_at: iso(NOW), colour: slot, icon: null, ...over }) as unknown as DuelPlayerRow;
/** The same rows as a check's stand-in draws them: account ids only. */
const standIn = (row: DuelPlayerRow, userId: string) => {
  const { public_id: _drop, ...rest } = row as DuelPlayerRow & { public_id?: string };
  return { ...rest, user_id: userId } as DuelPlayerRow;
};
const PUB = { ali: "a1111111-0000-4000-8000-000000000001", bo: "b2222222-0000-4000-8000-000000000002", cy: "c3333333-0000-4000-8000-000000000003" };
const ACC = { ali: "00000000-0000-4000-8000-0000000000a1", bo: "00000000-0000-4000-8000-0000000000b2", cy: "00000000-0000-4000-8000-0000000000c3" };
const rows = [seat(1, PUB.ali), seat(2, PUB.bo), seat(3, PUB.cy)];
const stand = [standIn(rows[0]!, ACC.ali), standIn(rows[1]!, ACC.bo), standIn(rows[2]!, ACC.cy)];

/* 1. Keys */
check(seatKey(rows[1]) === PUB.bo && seatKey(stand[1]) === ACC.bo && seatKey(null) === null, "1: seatKey answers the public id, else the account id");
check(hostKey({ host_public_id: PUB.ali, host_user_id: null } as never) === PUB.ali && hostKey({ host_user_id: ACC.ali } as never) === ACC.ali && hostKey(null) === null, "1: hostKey answers the host's public id, else the account id");
check(senderKey({ sender_public_id: PUB.bo }) === PUB.bo && senderKey({ sender_user_id: ACC.bo }) === ACC.bo && senderKey(null) === null, "1: senderKey answers the sender's public id, else the account id");
check(isSeat(rows[1], PUB.bo) && !isSeat(rows[1], PUB.ali) && isSeat(stand[1], ACC.bo) && !isSeat(rows[1], null), "1: isSeat matches a row's own id only");
check(isSeat({ public_id: PUB.bo, user_id: ACC.bo } as never, ACC.bo) && isSeat({ public_id: PUB.bo, user_id: ACC.bo } as never, PUB.bo), "1: a server row (both ids) matches either");

/* 2. Me and the host */
check(myKeyAmong(rows, { publicId: PUB.bo, userId: ACC.bo }) === PUB.bo, "2: among public-id rows, my key is my public id");
check(myKeyAmong(rows, { publicId: null, userId: ACC.bo }) === null, "2: among public-id rows with my public id not yet known, no key (no seat is taken for mine)");
check(myKeyAmong(stand, { publicId: null, userId: ACC.bo }) === ACC.bo, "2: among stand-in rows, my key is my account id");
const me = rows.find((p) => isSeat(p, myKeyAmong(rows, { publicId: PUB.bo, userId: ACC.bo })));
check(me?.player_slot === 2, "2: my own seat is found by my key");
check(rows.find((p) => isSeat(p, hostKey({ host_public_id: PUB.ali } as never)))?.player_slot === 1, "2: the host's seat is found by the host's key");

/* 3. Absent rivals and Finish now */
const away = (list: DuelPlayerRow[]) => list.map((p, i) => (i === 0 ? p : ({ ...p, last_seen_at: iso(NOW - 60_000) } as DuelPlayerRow)));
const awayPub = away(rows);
const awayAcc = away(stand);
check(absentRivals(awayPub, PUB.ali, NOW).map((p) => p.player_slot).join() === "2,3" && absentRivals(awayAcc, ACC.ali, NOW).map((p) => p.player_slot).join() === "2,3", "3: absent rivals are the same by public id as by account id (never me)");
check(everyoneElseAway(awayPub, PUB.ali, NOW) && everyoneElseAway(awayAcc, ACC.ali, NOW) && !everyoneElseAway(rows, PUB.ali, NOW), "3: everyone else away: the same answer either way");
check(canFinishNow(awayPub, PUB.ali, NOW) === canFinishNow(awayAcc, ACC.ali, NOW) && finishNowInSeconds(awayPub, PUB.ali, NOW) === finishNowInSeconds(awayAcc, ACC.ali, NOW), "3: Finish now: the same answer and countdown either way");
check(!canFinishNow(awayPub, null, NOW) && absentRivals(rows, PUB.ali, NOW).length === 0, "3: no key, no Finish now; everyone here, no absent rival");

/* 4. Chat: unread and toasts */
const msg = (id: string, sender: string, text = "hello"): RoomMessageRow => ({ id, duel_id: "room", sender_public_id: sender, sender_name: sender === PUB.ali ? "Ali" : "Bo", text, created_at: iso(NOW) });
const chatList = [msg("1", PUB.ali), msg("2", PUB.bo), msg("3", PUB.bo)];
check(unreadCount(chatList, PUB.ali, new Set()) === 2 && unreadCount(chatList, PUB.ali, new Set(["2"])) === 1, "4: unread counts only other players' messages, by public id");
check(shouldToast(msg("4", PUB.bo), { myUserId: PUB.ali, chatAvailable: true, sheetOpen: false }) && !shouldToast(msg("4", PUB.ali), { myUserId: PUB.ali, chatAvailable: true, sheetOpen: false }), "4: my own message never toasts, by public id");

/* 5. Reactions */
const { acceptReaction } = await import("../src/lib/duel/reactionRoster");
check(acceptReaction({ emoji: "👍", playerId: PUB.bo, name: "x" }, rows)?.name === "Bo", "5: a reaction is named from the room's rows by public id");
check(acceptReaction({ emoji: "👍", playerId: ACC.bo, name: "x" }, rows) === null, "5: an account id names nobody among public-id rows");

/* 4 and 6, in happy-dom: the real RoomChat and RoomLobby */
const win = new Window({ url: "https://joulz.uk/duel/ABCD" });
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "localStorage", "sessionStorage", "location", "getComputedStyle", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame", "MutationObserver", "CustomEvent"] as const) {
  const value = (win as unknown as Record<string, unknown>)[key];
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: typeof value === "function" && !["HTMLElement", "Element", "Node", "Event", "MutationObserver", "CustomEvent"].includes(key) ? (value as (...a: unknown[]) => unknown).bind(win) : value });
}
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { RoomChat } = await import("../src/components/duel/RoomChat");
const { RoomLobby } = await import("../src/components/duel/RoomLobby");
const { resolvePlayerLooks } = await import("../src/lib/duel/playerLook");
type ChatState = Parameters<typeof RoomChat>[0]["chat"];
const looks = resolvePlayerLooks(rows);
const muted: string[] = [];
const state = (over: Partial<ChatState> = {}): ChatState =>
  ({ messages: [], reactions: [], unread: 0, incoming: null, sheetOpen: true, setSheetOpen: () => {}, sending: false, error: null, notice: null, send: async () => {}, react: async () => {}, report: async () => {}, mutedUserIds: [], toggleLocalMute: (id: string) => muted.push(id), ...over }) as ChatState;

const host = document.createElement("div");
document.body.appendChild(host);
const root = createRoot(host as unknown as HTMLElement);
await act(async () => {
  root.render(React.createElement(RoomChat, { chat: state({ messages: [msg("m1", PUB.ali, "mine here"), msg("m2", PUB.bo, "theirs here")] }), myUserId: PUB.ali, players: rows, looks, available: true, screenLabel: "Lobby" }));
});
const items = [...document.querySelectorAll("li")].filter((li) => /here/.test(li.textContent ?? ""));
const mineLi = items.find((li) => /mine here/.test(li.textContent ?? ""));
const theirsLi = items.find((li) => /theirs here/.test(li.textContent ?? ""));
check(!!mineLi?.querySelector(".text-primary") && !theirsLi?.querySelector(".text-primary"), "4: my own message is drawn as mine by public id, another player's is not");
await act(async () => {
  (theirsLi as unknown as HTMLElement | undefined)?.click();
});
const muteButton = [...document.querySelectorAll("button")].find((b) => /^Mute Bo/.test(b.textContent ?? ""));
check(!!muteButton, "4: another player's message opens a menu with Mute");
await act(async () => {
  (muteButton as unknown as HTMLElement | undefined)?.click();
});
check(muted.join() === PUB.bo, `4: Mute names the sender by public id (${muted.join()})`);
await act(async () => {
  root.render(React.createElement(RoomChat, { chat: state({ messages: [msg("m1", PUB.ali, "mine here")] }), myUserId: PUB.ali, players: rows, looks, available: true, screenLabel: "Lobby" }));
});
const mineAgain = [...document.querySelectorAll("li")].find((li) => /mine here/.test(li.textContent ?? ""));
await act(async () => {
  (mineAgain as unknown as HTMLElement | undefined)?.click();
});
check(![...document.querySelectorAll("button")].some((b) => /^Mute /.test(b.textContent ?? "")), "4: my own message opens no Mute");

await act(async () => {
  root.render(
    React.createElement(RoomLobby, {
      roomCode: "ABCD",
      storedSettings: null,
      onSettingsChange: async () => {},
      players: rows,
      hostUserId: PUB.ali,
      meUserId: PUB.bo,
      isHost: false,
      starting: false,
      onStart: () => {},
      onRemove: () => {},
      onMuteForEveryone: () => {},
      tournamentHistory: [],
      looks,
      allPlayers: rows,
      canChooseLook: true,
      onLookChange: async () => {},
    } as unknown as Parameters<typeof RoomLobby>[0]),
  );
});
const you = document.querySelector("[data-you]");
check(!!you && /Bo/.test(you.textContent ?? ""), `6: my lobby row (Bo) is marked mine by public id (${you?.textContent?.slice(0, 40)})`);
const hostLabel = document.querySelector("[data-host-label]");
check(!!hostLabel && /host/i.test(hostLabel.textContent ?? ""), `6: the host's row carries its host label by public id (${hostLabel?.textContent})`);
check(document.querySelectorAll("[data-you]").length === 1, "6: exactly one row is mine");
await act(async () => root.unmount());


// 7. Rated (Security C3).
{
  const { readFileSync } = await import("node:fs");
  for (const f of ["src/lib/rated/w3Binding.ts", "src/lib/rated/multi/multiView.ts"]) {
    const src = readFileSync(f, "utf8");
    check(/myPublicId\(userId\)\)\s*\?\?\s*userId/.test(src), `7: ${f.split("/").pop()} takes "me" from myPublicId, the account id only as a stand-in's fallback`);
  }
  const w3 = await import("../src/lib/rated/w3Binding");
  const them = { them: { userId: PUB.bo, username: "Bo" } } as never;
  const match = { id: "m", pick: "mixed", format: "bo3", ...(them as object) } as never;
  const stay = w3.abortedOf([PUB.bo], match, PUB.ali);
  const left = w3.abortedOf([PUB.ali], match, PUB.ali);
  check(stay.leaverNames.join() === "Bo" && !stay.youLeft && left.youLeft && left.leaverNames.length === 0, "7: an abort names the leaver for the stayer and tells the leaver it was them, by public id");
  const end = w3.endingOf([PUB.bo], them, PUB.ali);
  check(end?.kind === "forfeit" && end.leaverNames.join() === "Bo" && !end.youLeft && w3.endingOf([PUB.ali], them, PUB.ali)?.youLeft === true, "7: a forfeit, by public id");
  const mv = await import("../src/lib/rated/multi/multiView");
  const players = [PUB.ali, PUB.bo, PUB.cy, "pub-dee"].map((id, i) => ({ userId: id, slot: i + 1, displayName: ["Ali", "Bo", "Cy", "Dee"][i]!, guest: false }));
  const settled = {
    format: "ffa4",
    players: players.map((p) => ({ userId: p.userId, slot: p.slot, scores: [100 - p.slot] })),
    games: [{ type: "sudoku" }],
    placings: { [PUB.ali]: 1, [PUB.bo]: 2, [PUB.cy]: 3, "pub-dee": 4 },
    ending: { kind: "forfeit" as const, leavers: ["pub-dee"] },
    ratings: null,
  };
  const fin = mv.multiFinalFrom(settled, players, PUB.bo)!;
  check(fin.seats.filter((x) => x.you).map((x) => x.name).join() === "Bo" && fin.seats.find((x) => x.name === "Dee")?.left === true && fin.rows[0]?.seatId === "slot:1",
    "7: the 4-player final finds you, the leaver and the stored places by public id");
  const st = mv.multiStandingsFrom({ format: "ffa4", players, gameTypes: ["sudoku", "flow"], results: players.map((p) => ({ player_slot: p.slot, round_number: 1, score: 100 - p.slot })), meId: PUB.cy })!;
  check(st.seats.filter((x) => x.you).map((x) => x.name).join() === "Cy" && st.headline.yourPlace === 3, "7: the 4-player standings find you by public id");
}

console.log(`seat-key-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: phones tell room-mates apart by public id (me, host, chat, muting, reactions, absent rivals), and stand-in rows by account id.");
process.exit(0);
