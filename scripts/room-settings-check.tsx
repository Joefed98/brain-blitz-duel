/**
 * room-settings-check (31 Oct 2026): the host's room settings (src/lib/duel/roomSettings.ts, roomDeal.ts,
 * roomSettings.server.ts, RoomSettingsSheet.tsx).
 *
 *  1. Presets: Mixed is Word, Speed, Attention, Pattern, Logic and the four arcade groups (the default, with
 *     6 rounds); Puzzles only the six puzzle categories; Arcade only the four groups. In the real sheet
 *     (happy-dom), each preset sets exactly its chips, editing a chip afterwards deselects it, and the last chip
 *     on stays on.
 *  2. The round cap follows the picks: min(12, the picks' room-eligible games: active, not retired); in the
 *     sheet the quick buttons above it are disabled, the count drops to it, a note says "Only n games in your
 *     picks", and buttons and slider are linked both ways (a button moves the slider; the slider highlights the
 *     matching button, none in between). The estimate updates live.
 *  3. The server (changeRoomSettings, on an in-memory duels table): the host's valid change in the lobby is
 *     stored; a guest's, a started room's, a disbanded room's and every invalid input (no picks, unknown or
 *     repeated picks, rounds under 3, over 12, over the cap, not whole) are refused and leave the row as it was.
 *     setRoomSettingsFn goes through it; remembered settings for the next room; Play again keeps them.
 *  4. Deals (dealRoomRounds) over every preset, every single pick, pairs and random sets, every round count
 *     3…cap, 120 seeds each: the count dealt, only picked games, the shares within 1 of each other (a share
 *     lower only when its pick has dealt all its games), never a pick twice running (where the shares allow),
 *     no game repeated within a pick before all its games are used (and so none at all), the previous room's games skipped while a pick has alternatives, the same deal for
 *     the same seed and history, and the seed (not a rule) choosing the order and the extras.
 *  5. Old rooms: a room without saved settings is read as legacy and startRoomFn deals it with pickRoundOrder,
 *     unchanged (a digest of its deals recorded before this change, scripts/fixtures/room-settings-legacy.json);
 *     the old memory option maps to nothing, Arcade to its four groups.
 *
 *   bun scripts/room-settings-check.tsx [--record]
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

import { arcadeGroupOf } from "../src/lib/duel/arcadeGroups";
import { categoryOrderFor, pickRoundOrder } from "../src/lib/duel/selection";
import { puzzleDef } from "../src/lib/duel/registry";
import { dealRoomRounds } from "../src/lib/duel/roomDeal";
import {
  ARCADE_PICKS,
  DEFAULT_SETTINGS,
  MAX_ROUNDS,
  MIN_ROUNDS,
  PUZZLE_PICKS,
  ROOM_PICKS,
  ROOM_PRESETS,
  clampRounds,
  eligibleCount,
  encodeRoomSettings,
  estimateRoomMinutes,
  isSettingsRoom,
  pickTypes,
  picksFromCategories,
  presetOf,
  readRoomSettings,
  roundCap,
  settingsSummary,
  validateRoomSettings,
  type RoomPick,
} from "../src/lib/duel/roomSettings";
import { changeRoomSettings, rememberedSettings } from "../src/lib/duel/roomSettings.server";
import { ROOM_SETTINGS_PLUS_ONLY } from "../src/config/betaConfig";
import type { PuzzleCategory, PuzzleType } from "../src/lib/duel/types";

const RECORD = process.argv.includes("--record");
const failures: string[] = [];
let checks = 0;
const check = (ok: boolean, message: string) => {
  checks++;
  if (!ok) {
    failures.push(message);
    if (failures.length <= 40) console.log(`FAIL ${message}`);
  }
};
const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

/* ------------------------------------------------------------------ 1. presets */
const preset = (id: string) => ROOM_PRESETS.find((p) => p.id === id)!.picks;
check(same(preset("mixed"), ["word", "speed", "attention", "pattern", "logic", "retro", "sports", "cards", "action"]), "Mixed is Word, Speed, Attention, Pattern, Logic and the four arcade groups");
check(same(preset("puzzles"), ["word", "number", "speed", "attention", "pattern", "logic"]), "Puzzles only is the six puzzle categories");
check(same(preset("arcade"), ["retro", "sports", "cards", "action"]), "Arcade only is the four arcade groups");
check(same(DEFAULT_SETTINGS.picks, preset("mixed")) && DEFAULT_SETTINGS.rounds === 6, "the default is Mixed with 6 rounds");
check(ROOM_PICKS.length === 10 && same(ROOM_PICKS, [...PUZZLE_PICKS, ...ARCADE_PICKS]), "ten chips: six puzzle categories and four arcade groups");
for (const p of ROOM_PRESETS) check(presetOf(p.picks) === p.id, `presetOf recognises ${p.label}`);
check(presetOf(["word", "logic"]) === null, "a custom set matches no preset");
check(ROOM_SETTINGS_PLUS_ONLY === false, "room settings are free for every host (ROOM_SETTINGS_PLUS_ONLY off)");

/* ------------------------------------------------------------------ 2. the cap */
for (const pick of ROOM_PICKS) {
  const games = pickTypes(pick);
  check(games.length >= 3, `${pick}: ${games.length} games, a room needs at least 3`);
  for (const t of games) {
    const def = puzzleDef(t);
    check(!def.retired, `${pick}: ${t} is retired but eligible`);
    check(ARCADE_PICKS.includes(pick as never) ? def.category === "arcade" && arcadeGroupOf(t) === pick : def.category === pick, `${pick}: ${t} is not in it`);
  }
  check(roundCap([pick]) === Math.min(MAX_ROUNDS, games.length), `${pick}: cap ${roundCap([pick])}, want min(12, ${games.length})`);
}
for (const p of ROOM_PRESETS) check(roundCap(p.picks) === MAX_ROUNDS, `${p.label}: cap ${roundCap(p.picks)}, want 12`);
check(eligibleCount(["cards"]) === pickTypes("cards").length, "eligibleCount counts the pick's games");
check(clampRounds(12, ["cards"]) === roundCap(["cards"]) && clampRounds(1, ["word"]) === MIN_ROUNDS, "clampRounds holds 3…cap");
// The estimate grows with rounds and follows the picks' round lengths.
check(estimateRoomMinutes({ picks: ["word"], rounds: 9 }) > estimateRoomMinutes({ picks: ["word"], rounds: 3 }), "the estimate grows with the rounds");
check(/^9 rounds · Pattern, Logic, Retro, Sports · about \d+ min$/.test(settingsSummary({ picks: ["logic", "pattern", "retro", "sports"], rounds: 9 })), `summary line: ${settingsSummary({ picks: ["logic", "pattern", "retro", "sports"], rounds: 9 })}`);
check(/^6 rounds · Mixed · about \d+ min$/.test(settingsSummary(DEFAULT_SETTINGS)), `summary line names a preset: ${settingsSummary(DEFAULT_SETTINGS)}`);

/* ------------------------------------------------------------------ 3. validation and the server */
const bad: [unknown, string][] = [
  [{ picks: [], rounds: 6 }, "no picks"],
  [{ picks: ["word", "word"], rounds: 6 }, "a repeated pick"],
  [{ picks: ["memory"], rounds: 6 }, "the deleted memory category"],
  [{ picks: ["arcade"], rounds: 6 }, "the old Arcade category (the sheet picks groups)"],
  [{ picks: ["word"], rounds: 2 }, "2 rounds"],
  [{ picks: ["word", "logic"], rounds: 13 }, "13 rounds"],
  [{ picks: ["word"], rounds: 6.5 }, "6.5 rounds"],
  [{ picks: ["word"], rounds: "6" }, "rounds as text"],
  [{ picks: ["cards"], rounds: roundCap(["cards"]) + 1 }, "rounds over the picks' cap"],
  [null, "nothing"],
];
for (const [input, label] of bad) check(!validateRoomSettings(input).ok, `validation refuses ${label}`);
const good = validateRoomSettings({ picks: ["sports", "logic"], rounds: 9 });
check(good.ok && good.settings.picks.join() === "logic,sports" && good.settings.rounds === 9, "validation keeps valid settings, picks in chip order");

interface Row { id: string; room_code: string; host_user_id: string; status: string; disbanded_at: string | null; selected_categories: unknown }
function fakeClient(rows: Row[]) {
  const table = () => {
    const filters: [string, unknown][] = [];
    let patch: Record<string, unknown> | null = null;
    const match = () => rows.filter((r) => filters.every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v));
    const q = {
      select: () => q,
      update: (p: Record<string, unknown>) => ((patch = p), q),
      eq: (k: string, v: unknown) => (filters.push([k, v]), q),
      maybeSingle: async () => {
        const hit = match();
        if (patch) for (const r of hit) Object.assign(r, structuredClone(patch));
        return { data: hit[0] ? { ...hit[0] } : null, error: null };
      },
    };
    return q;
  };
  return { from: (name: string) => (name === "duels" ? table() : (() => { throw new Error(`unexpected table ${name}`); })()) };
}
const row = (over: Partial<Row> = {}): Row => ({ id: "r1", room_code: "ABCD", host_user_id: "host", status: "waiting", disbanded_at: null, selected_categories: rememberedSettings(undefined), ...over });
const quiet = console.log;
console.log = () => {};
try {
  const cases: [string, Row, string, unknown, boolean][] = [
    ["the host in the lobby", row(), "host", { picks: ["logic", "retro"], rounds: 9 }, true],
    ["a guest", row(), "guest", { picks: ["logic"], rounds: 3 }, false],
    ["a started room", row({ status: "in_progress" }), "host", { picks: ["logic"], rounds: 3 }, false],
    ["a finished room", row({ status: "finished" }), "host", { picks: ["logic"], rounds: 3 }, false],
    ["a disbanded room", row({ disbanded_at: "2026-10-31T10:00:00Z" }), "host", { picks: ["logic"], rounds: 3 }, false],
    ["invalid rounds", row(), "host", { picks: ["logic"], rounds: 40 }, false],
    ["an unknown pick", row(), "host", { picks: ["logic", "memory"], rounds: 6 }, false],
  ];
  for (const [label, r, user, input, ok] of cases) {
    const before = JSON.stringify(r.selected_categories);
    const result = await changeRoomSettings(fakeClient([r]), r.id, user, input);
    console.log = quiet;
    check(result.ok === ok, `server: ${label} is ${ok ? "stored" : "refused"} (${result.ok ? "stored" : (result as { message: string }).message})`);
    if (ok) check(JSON.stringify(r.selected_categories) === JSON.stringify(encodeRoomSettings({ picks: ["logic", "retro"], rounds: 9 })), `server: ${label}: stored as picks then rounds:N (${JSON.stringify(r.selected_categories)})`);
    else check(JSON.stringify(r.selected_categories) === before, `server: ${label}: the room's settings are unchanged`);
    console.log = () => {};
  }
  // A start landing between the read and the write: the write needs the room still waiting.
  const racing = row();
  const racedBefore = JSON.stringify(racing.selected_categories);
  const client = fakeClient([racing]);
  const real = client.from;
  let reads = 0;
  client.from = ((name: string) => {
    if (reads++ === 1) racing.status = "in_progress";
    return real(name);
  }) as typeof client.from;
  const raced = await changeRoomSettings(client, racing.id, "host", { picks: ["word"], rounds: 3 });
  console.log = quiet;
  check(!raced.ok && JSON.stringify(racing.selected_categories) === racedBefore, "server: a change racing the start is refused and not written");
} finally {
  console.log = quiet;
}
const fns = readFileSync("src/lib/duel/duel.functions.ts", "utf8");
const settingsFn = /export const setRoomSettingsFn[\s\S]*?\n {2}\}\);/.exec(fns)?.[0] ?? "";
check(/requireParticipant\(/.test(settingsFn) && /changeRoomSettings\(client, data\.roomId, context\.userId/.test(settingsFn), "setRoomSettingsFn stores through changeRoomSettings with the signed-in user");
const createFn = /export const createRoomFn[\s\S]*?\n {2}\}\);/.exec(fns)?.[0] ?? "";
check(/rememberedSettings\(previous\?\.selected_categories\)/.test(createFn), "createRoomFn starts a room with the host's last settings");
const rematch = /export const rematchFn[\s\S]*?\n {2}\}\);/.exec(fns)?.[0] ?? "";
check(rematch.length > 0 && !/selected_categories/.test(rematch), "rematchFn never touches the settings");
const restarts = readdirSync("supabase/migrations").sort().map((f) => readFileSync(`supabase/migrations/${f}`, "utf8")).filter((t) => /FUNCTION public\.restart_duel_room/.test(t));
const lastRestart = restarts[restarts.length - 1] ?? "";
const restartBody = /FUNCTION public\.restart_duel_room[\s\S]*?\$\$;/.exec(lastRestart.slice(lastRestart.lastIndexOf("CREATE OR REPLACE FUNCTION public.restart_duel_room")))?.[0] ?? "";
check(restartBody.length > 0 && !/selected_categories/.test(restartBody), "Play again (restart_duel_room) keeps the settings");
// Remembered settings.
check(JSON.stringify(rememberedSettings(undefined)) === JSON.stringify(encodeRoomSettings(DEFAULT_SETTINGS)), "a host's first room is Mixed, 6 rounds");
const v2 = encodeRoomSettings({ picks: ["number", "cards"], rounds: 5 });
check(JSON.stringify(rememberedSettings(v2)) === JSON.stringify(v2), "the host's last settings carry to the next room");
check(JSON.stringify(rememberedSettings(["logic", "pattern", "speed", "attention", "word", "arcade"])) === JSON.stringify(encodeRoomSettings(DEFAULT_SETTINGS)), "an older room's Standard mix carries over as Mixed, 6 rounds");
check(JSON.stringify(rememberedSettings(["logic", "pattern", "speed", "attention", "word", "number", "arcade"])) === JSON.stringify(encodeRoomSettings({ picks: [...ROOM_PICKS], rounds: 7 })), "an older room with all seven categories carries over as all ten picks, 7 rounds");

/* ------------------------------------------------------------------ 4. deals */
const pickOf = (t: PuzzleType): RoomPick => (puzzleDef(t).category === "arcade" ? arcadeGroupOf(t)! : (puzzleDef(t).category as RoomPick));
let rng = 12345;
const rand = () => ((rng = (Math.imul(rng, 1103515245) + 12345) >>> 0) / 2 ** 32);
const SETS: RoomPick[][] = [
  ...ROOM_PRESETS.map((p) => [...p.picks]),
  ...ROOM_PICKS.map((p) => [p]),
  ["word", "retro"],
  ["cards", "sports"],
  ["logic", "pattern", "retro", "sports"],
  ...Array.from({ length: 12 }, () => ROOM_PICKS.filter(() => rand() < 0.45)).filter((s) => s.length > 0),
];
const SEEDS = 120;
let deals = 0;
const extrasSeen = new Map<string, Set<string>>();
for (const picks of SETS) {
  const cap = roundCap(picks);
  for (let rounds = MIN_ROUNDS; rounds <= cap; rounds++) {
    const orders = new Set<string>();
    for (let s = 0; s < SEEDS; s++) {
      const seed = (s * 7919 + rounds * 104729 + picks.length) % 0x8000_0000;
      const recent: PuzzleType[][] = s % 3 === 0 ? [] : [dealRoomRounds({ picks: [...ROOM_PICKS], rounds: 12 }, { seed: seed + 1 }).types];
      const deal = dealRoomRounds({ picks, rounds }, { seed, recent });
      deals++;
      const tag = `${picks.join("+")} ×${rounds} seed ${seed}`;
      check(deal.types.length === rounds && deal.picks.length === rounds, `${tag}: ${deal.types.length} rounds dealt`);
      check(deal.types.every((t, i) => pickOf(t) === deal.picks[i] && picks.includes(pickOf(t))), `${tag}: a game outside its pick or the picks`);
      check(deal.types.every((t) => !puzzleDef(t).retired), `${tag}: a retired game was dealt`);
      const counts = picks.map((p) => deal.picks.filter((x) => x === p).length);
      // Within 1 of each other where the pools allow: a share more than 1 below another's only when that pick has
      // dealt every one of its games (no game repeats in a room, so it can give no more).
      const pools = picks.map((p) => pickTypes(p).length);
      check(counts.every((c, i) => c <= pools[i]!), `${tag}: shares ${counts.join("/")} exceed pools ${pools.join("/")}`);
      check(
        counts.every((c, i) => counts.every((d) => c >= d - 1 || c === pools[i])),
        `${tag}: shares ${counts.join("/")} differ by more than 1 (pools ${pools.join("/")})`,
      );
      // Never twice running where the shares allow it: the largest share fits between the others.
      if (picks.length > 1 && Math.max(...counts) <= rounds - Math.max(...counts) + 1)
        check(deal.picks.every((p, i) => i === 0 || p !== deal.picks[i - 1]), `${tag}: a pick twice running (${deal.picks.join(",")})`);
      for (const p of picks) {
        const mine = deal.types.filter((t) => pickOf(t) === p);
        const pool = pickTypes(p).length;
        for (let i = 0; i < mine.length; i++) {
          const cycleStart = Math.floor(i / pool) * pool;
          check(!mine.slice(cycleStart, i).includes(mine[i]!), `${tag}: ${p} repeats ${mine[i]} before its games are used`);
        }
      }
      check(new Set(deal.types).size === deal.types.length, `${tag}: a game repeats in the room`);
      const last = recent[0] ?? [];
      for (const p of picks) {
        const mine = deal.types.filter((t) => pickOf(t) === p);
        const fresh = pickTypes(p).filter((t) => !last.includes(t)).length;
        // Skipped while the pick has enough others (3, the room rule) for every round it plays.
        if (fresh >= mine.length + 3) for (const t of mine) check(!last.includes(t), `${tag}: replayed ${t} from the previous room despite alternatives`);
      }
      const again = dealRoomRounds({ picks, rounds }, { seed, recent });
      check(again.types.join() === deal.types.join(), `${tag}: the same seed dealt differently`);
      orders.add(deal.picks.join());
      // The extras are the seed's choice only while every pick has games for an extra round.
      if (rounds % picks.length && pools.every((n) => n >= Math.ceil(rounds / picks.length))) {
        const key = `${picks.join("+")}×${rounds}`;
        const extras = picks.filter((_, i) => counts[i] === Math.max(...counts)).join();
        (extrasSeen.get(key) ?? extrasSeen.set(key, new Set()).get(key)!).add(extras);
      }
    }
    // Two picks can only alternate (both ways round when their shares are equal); more picks have many orders.
    const poolsOf = picks.map((p) => pickTypes(p).length);
    const equalShares = rounds % 2 === 0 && poolsOf.every((n) => n >= rounds / 2);
    const want = picks.length > 2 && rounds >= 4 ? 5 : picks.length === 2 && equalShares ? 2 : 1;
    check(orders.size >= want, `${picks.join("+")} ×${rounds}: only ${orders.size} orders from ${SEEDS} seeds`);
  }
}
for (const [key, seen] of extrasSeen) check(seen.size >= 2, `${key}: the extra rounds always go to the same picks`);

/* ------------------------------------------------------------------ 5. old rooms */
const LEGACY: unknown[] = [
  [],
  ["logic", "pattern", "speed", "attention", "word", "arcade"],
  ["arcade"],
  ["logic", "number"],
  ["word", "memory", "arcade"],
  ["logic", "pattern", "speed", "attention", "word", "number", "arcade"],
];
for (const stored of LEGACY) check(readRoomSettings(stored).legacy && !isSettingsRoom(stored), `${JSON.stringify(stored)} is an older room (deals as before)`);
check(isSettingsRoom(v2) && !readRoomSettings(v2).legacy, "a saved room is read as settings");
check(same(picksFromCategories(["word", "memory" as PuzzleCategory, "number"]), ["word", "number"]), "the old memory option maps to nothing; Number stays Number");
check(same(picksFromCategories(["arcade"]), [...ARCADE_PICKS]), "the old Arcade category maps to all four arcade groups");
check(same(readRoomSettings(["word", "memory", "arcade"]).categories, ["word", "arcade"]), "an older room keeps its categories for its deal");
const start = /export const startRoomFn[\s\S]*?\n {2}\}\);/.exec(fns)?.[0] ?? "";
check(/stored\.legacy \? undefined : dealRoomRounds\(stored\.settings/.test(start) && /normaliseCategories\(room\.selected_categories\)/.test(start), "startRoomFn deals older rooms with pickRoundOrder on their categories, saved rooms from their settings");
const legacyDigest = createHash("sha256");
for (const stored of LEGACY) {
  const categories = readRoomSettings(stored).categories;
  for (let s = 0; s < 200; s++) {
    const seed = s * 104729 + 17;
    legacyDigest.update(`${pickRoundOrder({ categories, seed }).join()}|${categoryOrderFor(categories, seed).join()};`);
  }
}
const digest = legacyDigest.digest("hex");
const FIXTURE = "scripts/fixtures/room-settings-legacy.json";
if (RECORD) writeFileSync(FIXTURE, `${JSON.stringify({ note: "pickRoundOrder deals for older rooms (6 stored category lists x 200 seeds), recorded on main before room settings", digest }, null, 2)}\n`);
const want = existsSync(FIXTURE) ? (JSON.parse(readFileSync(FIXTURE, "utf8")) as { digest: string }).digest : "";
check(digest === want, `older rooms deal exactly as before (digest ${digest.slice(0, 12)}, recorded ${want.slice(0, 12)})`);

/* ------------------------------------------------------------------ 1–2. the real sheet in happy-dom */
const { Window } = await import("happy-dom");
const win = new Window({ url: "https://joulz.uk/duel/ABCD" });
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "KeyboardEvent", "PointerEvent", "HTMLFormElement", "HTMLInputElement", "HTMLButtonElement", "getComputedStyle", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame", "localStorage"] as const) {
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
const { RoomSettingsSheet } = await import("../src/components/duel/RoomSettingsSheet");
let saved: { picks: RoomPick[]; rounds: number } | null = null;
const host = document.createElement("div");
document.body.appendChild(host);
const root = createRoot(host as unknown as HTMLElement);
await act(async () => {
  root.render(React.createElement(RoomSettingsSheet, { initial: { picks: ["word", "retro"], rounds: 9 }, onSave: async (s) => void (saved = s), onClose: () => {} }));
});
const $ = (sel: string) => document.querySelector(sel) as unknown as HTMLElement | null;
const $$ = (sel: string) => [...document.querySelectorAll(sel)] as unknown as HTMLElement[];
const on = () => $$("[data-room-pick][aria-pressed='true']").map((b) => b.getAttribute("data-room-pick")!);
const pressedPreset = () => $$("[data-room-preset][aria-pressed='true']").map((b) => b.getAttribute("data-room-preset"));
const pressedRounds = () => $$("[data-room-rounds][aria-pressed='true']").map((b) => Number(b.getAttribute("data-room-rounds")));
const sliderValue = () => Number($("[data-rounds-slider] [role='slider']")?.getAttribute("aria-valuenow"));
const click = async (el: HTMLElement | null) => act(async () => void el?.click());
check($$("[data-room-pick]").length === 10, "the sheet draws ten chips");
check(pressedPreset().length === 0 && same(on(), ["word", "retro"]), "the sheet opens on the room's own picks, no preset");
check(pressedRounds().join() === "9" && sliderValue() === 9, "the sheet opens on the room's count, its button and the slider");
for (const p of ROOM_PRESETS) {
  await click($(`[data-room-preset='${p.id}']`));
  check(same(on(), p.picks), `sheet: ${p.label} sets its chips (${on().join(",")})`);
  check(pressedPreset().join() === p.id, `sheet: ${p.label} shows as chosen`);
}
await click($("[data-room-preset='mixed']"));
await click($("[data-room-pick='number']"));
check(pressedPreset().length === 0 && on().includes("number"), "sheet: editing a chip after a preset deselects the preset");
await click($("[data-room-preset='arcade']"));
for (const p of ["sports", "cards", "action"]) await click($(`[data-room-pick='${p}']`));
check(same(on(), ["retro"]), "sheet: chips turn off");
await click($("[data-room-pick='retro']"));
check(same(on(), ["retro"]), "sheet: the last chip on stays on");
// Round count, both ways.
await click($("[data-room-pick='word']"));
await click($("[data-room-rounds='12']"));
check(sliderValue() === 12 && pressedRounds().join() === "12", "sheet: a quick button moves the slider");
const thumb = () => $("[data-rounds-slider] [role='slider']")!;
await act(async () => void thumb().dispatchEvent(new (win as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }) as unknown as Event));
check(sliderValue() === 11 && pressedRounds().length === 0, `sheet: the slider between quick counts highlights none (slider ${sliderValue()}, buttons ${pressedRounds().join()})`);
for (let k = 0; k < 2; k++)
  await act(async () => void thumb().dispatchEvent(new (win as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }) as unknown as Event));
check(sliderValue() === 9 && pressedRounds().join() === "9", `sheet: the slider on a quick count highlights its button (slider ${sliderValue()}, buttons ${pressedRounds().join()})`);
const minutes9 = $("[data-room-rounds-value]")?.textContent ?? "";
await click($("[data-room-rounds='3']"));
check(($("[data-room-rounds-value]")?.textContent ?? "") !== minutes9 && /^3 rounds · about \d+ min$/.test($("[data-room-rounds-value]")?.textContent ?? ""), `sheet: the estimate updates live (${minutes9} → ${$("[data-room-rounds-value]")?.textContent})`);
// The cap: Cards & Board alone.
await click($("[data-room-rounds='12']"));
await click($("[data-room-preset='arcade']"));
for (const p of ["retro", "sports", "action"]) await click($(`[data-room-pick='${p}']`));
const cardsCap = roundCap(["cards"]);
check(sliderValue() === cardsCap, `sheet: the count drops to the picks' cap (${sliderValue()}, cap ${cardsCap})`);
const quick = $$("[data-room-rounds]") as HTMLButtonElement[];
check(
  quick.length > 0 && quick.every((b) => b.disabled === Number(b.dataset.roomRounds) > cardsCap) && quick.some((b) => b.disabled) && quick.some((b) => !b.disabled),
  `sheet: quick buttons above the cap are disabled (cap ${cardsCap}: ${quick.map((b) => `${b.dataset.roomRounds}${b.disabled ? " off" : " on"}`).join(", ")})`,
);
check($("[data-room-cap-note]")?.textContent?.startsWith(`Only ${pickTypes("cards").length} games in your picks`) === true, `sheet: the cap note (${$("[data-room-cap-note]")?.textContent})`);
await act(async () => void thumb().dispatchEvent(new (win as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent("keydown", { key: "End", bubbles: true }) as unknown as Event));
check(sliderValue() === cardsCap, `sheet: the slider stops at the cap (${sliderValue()})`);
await click($("[data-room-settings-save]"));
check(saved !== null && same(saved!.picks, ["cards"]) && saved!.rounds === cardsCap && validateRoomSettings(saved).ok, "sheet: Save sends valid settings");
await act(async () => root.unmount());

if (failures.length) {
  console.log(`FAIL: ${failures.length} of ${checks} room-settings check(s)`);
  process.exit(1);
}
console.log(
  `PASS: ${checks} checks: presets set their chips (Mixed the default, 6 rounds), the cap follows the picks with its note and linked buttons and slider, the server refuses guests, started rooms and invalid input, ${deals} seeded deals fair (shares within 1), mixed, never repeating a game within a pick before it's used up and identical for the same seed, and older rooms deal exactly as before`,
);
