/**
 * room-code-check (7 Nov 2026, from the design audit): new rooms' codes come from the challenge codes'
 * alphabet (no I, L, O, 0 or 1; src/lib/duel/roomCode.ts), and every place that reads a room code accepts
 * both the new codes (with digits) and every code made before (four letters, I, L and O included).
 *
 *   bun scripts/room-code-check.ts
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { CHALLENGE_CODE_ALPHABET } from "../src/lib/duel/challenge";
import { RESERVED_ROOM_CODES, generateRoomCode } from "../src/lib/duel/puzzles";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, isRoomCode, roomCodeChars } from "../src/lib/duel/roomCode";
import { codeFromInput, roomInvite } from "../src/lib/duel/roomLink";
import { PLAY_CARDS_BOOT, playCardTokens } from "../src/lib/playCards";

const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else failures.push(message);
};

// 1. The alphabet is the challenge codes' one, with none of the easily misread characters.
check(ROOM_CODE_ALPHABET === CHALLENGE_CODE_ALPHABET, `room alphabet ${ROOM_CODE_ALPHABET} is not the challenge alphabet ${CHALLENGE_CODE_ALPHABET}`);
for (const ch of ["I", "L", "O", "0", "1"]) check(!ROOM_CODE_ALPHABET.includes(ch), `the room alphabet has ${ch}`);
check(new Set(ROOM_CODE_ALPHABET).size === ROOM_CODE_ALPHABET.length, "the room alphabet repeats a character");

// 2. New codes: 20,000 of them use only that alphabet, are 4 long, never reserved, and use every character.
const seen = new Set<string>();
let bad = "";
for (let i = 0; i < 20_000; i++) {
  const code = generateRoomCode();
  if (code.length !== ROOM_CODE_LENGTH || [...code].some((c) => !ROOM_CODE_ALPHABET.includes(c)) || RESERVED_ROOM_CODES.has(code) || !isRoomCode(code))
    bad ||= code;
  for (const c of code) seen.add(c);
}
check(!bad, `a new room got the code ${bad}`);
check(seen.size === ROOM_CODE_ALPHABET.length, `new codes used ${seen.size} of ${ROOM_CODE_ALPHABET.length} characters`);

// 3. Old codes keep working: the public room, letter codes with I, L and O, and new codes with digits.
const OLD = ["JULZ", "WXYZ", "OILS", "ABCD", "LOIL"];
const NEW = ["AB2C", "K7QM", "2345", "Z9Z9"];
for (const code of [...OLD, ...NEW]) {
  check(isRoomCode(code), `${code} is not read as a room code`);
  check(codeFromInput(code.toLowerCase()) === code, `typing ${code.toLowerCase()} gives ${codeFromInput(code.toLowerCase())}`);
  check(codeFromInput(roomInvite(code, "https://joulz.uk").text) === code, `pasting the invite for ${code} gives ${codeFromInput(roomInvite(code, "https://joulz.uk").text)}`);
  check(codeFromInput(`https://joulz.uk/duel/${code.toLowerCase()}?ref=share`) === code, `pasting the link for ${code} fails`);
  // The Play tab's Rejoin card (playCards.ts and its boot script's copy) for the device's last room.
  const store = { getItem: (key: string) => (key === "duelz-last-room:v1" ? JSON.stringify({ code, at: 0 }) : null) };
  check(playCardTokens(store, "").includes("rejoin"), `the Rejoin card isn't reserved for the last room ${code}`);
}
check(codeFromInput("ab 2c") === "AB2C" && codeFromInput("ab-2c-9") === "AB2C", `spaces and dashes: ${codeFromInput("ab 2c")}`);
check(roomCodeChars("k7 qm!") === "K7QM", `roomCodeChars: ${roomCodeChars("k7 qm!")}`);
for (const code of ["ABC", "ABCDE", "AB-C", "abcd", ""]) check(!isRoomCode(code), `${JSON.stringify(code)} is read as a room code`);
check(PLAY_CARDS_BOOT.includes("/^[A-Z0-9]{4}$/.test(l.code)"), "the boot script's Rejoin test isn't the four letters or digits one");

// 4. Nothing in the app still reads a room code as letters only.
const LETTERS_ONLY = [/\/\^\[A-Z\]\{4\}\$\//, /\/\^\[A-Za-z\]\{4\}\$\//, /\/duel\\\/\(\[a-zA-Z\]\+\)/];
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
for (const file of walk("src")) {
  const text = readFileSync(file, "utf8");
  for (const re of LETTERS_ONLY) if (re.test(text)) failures.push(`${file} still reads room codes as letters only (${re})`);
}
const errorState = readFileSync("src/components/app/ErrorState.tsx", "utf8");
check(!/replace\(\/\[\^a-z\]\/gi/.test(errorState), "the error screen's code box still drops digits");

// 5. share_events takes the new codes (the migration widens its check; no stored row changes).
const migration = readFileSync("supabase/migrations/20261107120000_room_code_digits.sql", "utf8");
check(migration.includes("'^[A-Z0-9]{4}$'") && migration.includes("share_events_room_code_check"), "the share_events room-code migration is missing or wrong");
check(!/\b(UPDATE|DELETE)\b/i.test(migration.replace(/--[^\n]*/g, "")), "the migration rewrites stored rows");

if (failures.length) {
  console.log(`room-code-check: FAIL (${failures.length} failed, ${passes} passed)`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`room-code-check: ${passes} checks passed`);
