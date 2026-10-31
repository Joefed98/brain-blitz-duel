// Item 1 (12 Oct 2026): opening a room link as someone not in the room asks
// only for a display name (remembered on the device) and joins through the
// same joinRoomByCode server function while the room is in its lobby; a
// started room says so plainly and offers Home. Also covers the invite text
// Copy/Share send (item 2) and the guest Leave wiring (item 4).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { codeFromInput, linkRoomState, roomInvite } from "../src/lib/duel/roomLink";

// What the link page offers for each room state.
assert.equal(linkRoomState({ status: "waiting", disbanded_at: null }), "lobby");
assert.equal(linkRoomState({ status: "in_progress", disbanded_at: null }), "playing");
assert.equal(linkRoomState({ status: "countdown", disbanded_at: null }), "playing");
assert.equal(linkRoomState({ status: "finished", disbanded_at: null }), "finished");
assert.equal(
  linkRoomState({ status: "waiting", disbanded_at: "2026-10-12T00:00:00Z" }),
  "disbanded",
);

// Copy and Share carry the full link plus the code.
const invite = roomInvite("ABCD", "https://joulz.uk");
assert.equal(invite.link, "https://joulz.uk/duel/ABCD");
assert.match(invite.text, /https:\/\/joulz\.uk\/duel\/ABCD/);
assert.match(invite.text, /\(code ABCD\)/);

// A link pasted into the home screen's code boxes gives its code.
assert.equal(codeFromInput("https://joulz.uk/duel/WXYZ"), "WXYZ");
assert.equal(codeFromInput("Join my Duelz room: https://x.app/duel/qrst (code QRST)"), "QRST");
assert.equal(codeFromInput("ab cd"), "ABCD");
assert.equal(codeFromInput("abcde"), "ABCD");

// Route: anyone not in the room (rows unreadable, or left while in the lobby) gets the join card.
const route = readFileSync("src/routes/duel.$code.tsx", "utf8");
assert.match(
  route,
  /if \(state\.notFound \|\| !duel \|\| !me \|\| \(me\.status === "left" && duel\.status === "waiting"\)\) \{[\s\S]{0,200}<JoinFromLink roomCode=\{roomCode\} onJoined=\{state\.refresh\} \/>/,
);
assert.doesNotMatch(route, /You're not in this room|Head back home and join with the room code/);

// Join card: name only, remembered, same server join, plain message once started.
const card = readFileSync("src/components/duel/JoinFromLink.tsx", "utf8");
assert.match(card, /setName\(getStoredName\(\)\)/);
assert.match(
  card,
  /setStoredName\(trimmed\);\s*await joinRoomByCode\(roomCode, trimmed, "link"\);\s*await onJoined\(\);/,
);
assert.equal((card.match(/<input/g) ?? []).length, 1, "only the display name is asked for");
assert.match(card, /preview\.state !== "lobby"/);
assert.match(card, /This game has already started/);
assert.match(card, /navigate\(\{ to: "\/" \}\)/);
assert.doesNotMatch(card, /createRoom|startRoom|generate/);

// Preview server function: readable without being in the room, but it tells a
// stranger only whether the room can be joined (no names, puzzles or answers).
const server = readFileSync("src/lib/duel/duel.functions.ts", "utf8");
const preview = server.slice(
  server.indexOf("export const roomPreviewFn"),
  server.indexOf("export const joinRoomFn"),
);
assert.match(preview, /\.select\("id, status, disbanded_at, max_players"\)/);
assert.match(preview, /state: linkRoomState\(room\)/);
assert.doesNotMatch(preview, /display_name|puzzles|secrets|round_results|requireParticipant/);
const join = server.slice(
  server.indexOf("export const joinRoomFn"),
  server.indexOf("export const startRoomFn"),
);
assert.match(
  join,
  /if \(room\.status !== "waiting"\) \{\s*return \{ ok: false as const, message: "Game already started\." \};/,
);

// Lobby Copy/Share use the invite; Share falls back to copying.
assert.match(route, /const \{ link, text \} = roomInvite\(roomCode/);
assert.match(route, /navigator\.clipboard\.writeText\(text\)/);
assert.match(route, /typeof navigator\.share !== "function"\) \{\s*await copy\(\);/);

// Guests can leave the lobby and between rounds, both behind a confirm.
// Polish batch R: Leave room is in the lobby header's "⋯" menu (the route), still behind the confirm.
assert.match(route, /label: "Leave room", danger: true, onSelect: \(\) => setConfirmLeave\(true\)/);
assert.match(route, /onLeave=\{\(\) => setConfirmLeave\(true\)\}/);
assert.match(route, /confirmLeave && \(\s*<ConfirmDialog/);
assert.match(
  route,
  /duel\.status === "in_progress" && !isHost \? <LeaveGameButton onLeave=\{handleLeave\} \/>/,
);
const leaveButton = readFileSync("src/components/duel/DropoutBanner.tsx", "utf8");
assert.match(leaveButton, /export function LeaveGameButton[\s\S]*<ConfirmDialog/);

console.log(
  "PASS: room links offer a name-only join through joinRoomByCode while in the lobby and a plain 'already started' + Home afterwards; preview leaks no names or puzzles; Copy/Share send link + code; guest Leave confirms. No device or share-sheet test.",
);
