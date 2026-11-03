/**
 * Room settings (31 Oct 2026; room setup only, no game's rules, scoring or stamps changed): the host picks
 * which categories a room deals from (the six puzzle categories and the five arcade groups, arcadeGroups.ts)
 * and how many rounds it plays (3–12), in the lobby only. The server validates and stores them
 * (roomSettings.server.ts) and deals from them (selection.ts `dealRoomRounds`).
 *
 * Stored in the room's existing `duels.selected_categories` jsonb, so no migration: the picks, in
 * ROOM_PICKS order, then one `rounds:N` token. The token marks the new format; a room without it (every
 * room made before this) is a *legacy* room and keeps dealing exactly as before (selection.ts
 * `pickRoundOrder`: 6 rounds, 7 with all seven categories) until its host saves new settings.
 *
 * Legacy picks read as settings for the sheet: each old category stays itself and "arcade" becomes the five
 * arcade groups (all of Arcade).
 *
 * The Strategy split (1 Nov 2026): six games left Action for the new Strategy group. Settings saved since carry a
 * `groups:2` token after `rounds:N`; a settings room without it was saved when Action held all nine, so its
 * Action pick reads as Action and Strategy, and it keeps dealing the games it had. The old "memory" option (`add_memory`) was deleted with the Memory
 * category on 14 Oct 2026 (its games removed, not moved), so it maps to nothing; "Add maths" was Number and
 * "Add arcade" was Arcade (the 23 Sep migration turned those toggles into category lists).
 */
import { ROOM_SETTINGS_PLUS_ONLY } from "@/config/betaConfig";

import { typesAlsoIn } from "./alsoIn";
import { arcadeGroupInfo, arcadeGroupOf, arcadeGroupTypes, type ArcadeGroup } from "./arcadeGroups";
import { normaliseCategories } from "./categories";
import { puzzleDef, typesInCategory } from "./registry";
import { roomRoundCount } from "./selection";
import type { PuzzleCategory, PuzzleType } from "./types";

export type PuzzlePick = Exclude<PuzzleCategory, "arcade">;
export type RoomPick = PuzzlePick | ArcadeGroup;

export const PUZZLE_PICKS: readonly PuzzlePick[] = [
  "word",
  "number",
  "speed",
  "attention",
  "pattern",
  "logic",
];
export const ARCADE_PICKS: readonly ArcadeGroup[] = ["retro", "sports", "cards", "action", "strategy"];
/** The sheet's chip order (and the stored order). */
export const ROOM_PICKS: readonly RoomPick[] = [...PUZZLE_PICKS, ...ARCADE_PICKS];

export const MIN_ROUNDS = 3;
export const MAX_ROUNDS = 12;
export const DEFAULT_ROUNDS = 6;
/** The quick buttons above the slider. */
export const QUICK_ROUNDS = [3, 6, 9, 12] as const;

export interface RoomSettings {
  picks: RoomPick[];
  rounds: number;
}

export type PresetId = "mixed" | "puzzles" | "arcade";
export const ROOM_PRESETS: readonly { id: PresetId; label: string; picks: readonly RoomPick[] }[] =
  [
    {
      id: "mixed",
      label: "Mixed",
      picks: ["word", "speed", "attention", "pattern", "logic", ...ARCADE_PICKS],
    },
    { id: "puzzles", label: "Puzzles only", picks: PUZZLE_PICKS },
    { id: "arcade", label: "Arcade only", picks: ARCADE_PICKS },
  ];
export const DEFAULT_SETTINGS: RoomSettings = {
  picks: [...ROOM_PRESETS[0]!.picks],
  rounds: DEFAULT_ROUNDS,
};

const PICK_LABEL: Record<RoomPick, string> = {
  word: "Word",
  number: "Number",
  speed: "Speed",
  attention: "Attention",
  pattern: "Pattern",
  logic: "Logic",
  retro: "Retro",
  sports: "Sports",
  cards: "Cards & Board",
  action: "Action",
  strategy: "Strategy",
};
export const pickLabel = (pick: RoomPick) => PICK_LABEL[pick];
export const isArcadePick = (pick: RoomPick): pick is ArcadeGroup =>
  (ARCADE_PICKS as readonly string[]).includes(pick);
export const isRoomPick = (value: unknown): value is RoomPick =>
  typeof value === "string" && (ROOM_PICKS as readonly string[]).includes(value);

/**
 * Duelz Plus switch: false, settings are free for every host. True would keep them for Plus hosts only
 * (`hasDuelzPlus`, false for everyone until Plus exists): the sheet shows read-only and the server refuses.
 */
export function roomSettingsUnlocked(plus = hasDuelzPlus()): boolean {
  return !ROOM_SETTINGS_PLUS_ONLY || plus;
}
/** No one has Duelz Plus yet. */
export function hasDuelzPlus(): boolean {
  return false;
}

/** A game's main pick: its puzzle category, or its arcade group (null for a game in neither). */
export function mainPickOf(type: PuzzleType): RoomPick | null {
  const category = puzzleDef(type).category;
  return category === "arcade" ? arcadeGroupOf(type) : category;
}

/**
 * A pick's room-eligible games (active, not retired), in registry / group order, then the games listed also in it
 * (alsoIn.ts, 3 Nov 2026) whose main pick is not among `picks` (a room with both counts such a game once, under
 * its main category). `picks` defaults to this pick alone.
 */
export function pickTypes(pick: RoomPick, picks: readonly RoomPick[] = [pick]): PuzzleType[] {
  const main = isArcadePick(pick) ? arcadeGroupTypes(pick) : typesInCategory(pick);
  const also = typesAlsoIn(pick).filter((t) => {
    const home = mainPickOf(t);
    return home !== null && !picks.includes(home) && !main.includes(t);
  });
  return [...main, ...also];
}

/** How many different games the picks hold: the most rounds they can deal without a repeat. */
export function eligibleCount(picks: readonly RoomPick[]): number {
  return new Set(picks.flatMap((p) => pickTypes(p, picks))).size;
}

/** The highest round count these picks allow (3–12, never above their games). */
export function roundCap(picks: readonly RoomPick[]): number {
  return Math.min(MAX_ROUNDS, eligibleCount(picks));
}

/** Picks in the stored order, unknowns and duplicates dropped. */
export function orderPicks(values: readonly unknown[]): RoomPick[] {
  return ROOM_PICKS.filter((pick) => values.includes(pick));
}

const ROUNDS_TOKEN = /^rounds:(\d{1,2})$/;
/** Marks settings saved after the Strategy split (1 Nov 2026); see the header. */
export const GROUPS_TOKEN = "groups:2";

/** The stored form: picks, `rounds:N`, then `groups:2`. */
export function encodeRoomSettings(settings: RoomSettings): string[] {
  return [...orderPicks(settings.picks), `rounds:${settings.rounds}`, GROUPS_TOKEN];
}

/**
 * A settings room's stored picks. One saved before the Strategy split (no `groups:2`) chose Action when it held
 * Strategy's games too, so its Action reads as both groups: the same games as when it was saved.
 */
export function storedPicks(values: readonly unknown[]): RoomPick[] {
  const picks = orderPicks(values);
  if (values.includes(GROUPS_TOKEN) || !picks.includes("action")) return picks;
  return orderPicks([...picks, "strategy"]);
}

/** True for a room saved with settings (it carries the `rounds:N` token). */
export function isSettingsRoom(stored: unknown): boolean {
  return Array.isArray(stored) && stored.some((v) => typeof v === "string" && ROUNDS_TOKEN.test(v));
}

/** The old category list as picks: Arcade is all five groups; deleted names ("memory") drop out. */
export function picksFromCategories(categories: readonly PuzzleCategory[]): RoomPick[] {
  const out = categories.flatMap((c): RoomPick[] => (c === "arcade" ? [...ARCADE_PICKS] : [c]));
  return orderPicks(out);
}

/** The categories a settings room plays (Arcade for any group), for places that list categories (challenges). */
export function categoriesOfPicks(picks: readonly RoomPick[]): PuzzleCategory[] {
  const out: PuzzleCategory[] = picks.filter((p): p is PuzzlePick => !isArcadePick(p));
  if (picks.some(isArcadePick)) out.push("arcade");
  return normaliseCategories(out);
}

export interface StoredSettings {
  settings: RoomSettings;
  /** A room from before settings: it deals with the old rule (pickRoundOrder) until the host saves. */
  legacy: boolean;
  /** For a legacy room, its categories as stored (normalised). */
  categories: PuzzleCategory[];
}

/** Reads a room's `selected_categories` as settings. */
export function readRoomSettings(stored: unknown): StoredSettings {
  const values = Array.isArray(stored) ? stored : [];
  if (isSettingsRoom(values)) {
    const token = values.find((v): v is string => typeof v === "string" && ROUNDS_TOKEN.test(v))!;
    const rounds = Number(ROUNDS_TOKEN.exec(token)![1]);
    const picks = storedPicks(values).filter((p) => pickTypes(p).length > 0);
    const settings = { picks: picks.length ? picks : [...DEFAULT_SETTINGS.picks], rounds };
    return {
      settings: { ...settings, rounds: clampRounds(settings.rounds, settings.picks) },
      legacy: false,
      categories: categoriesOfPicks(settings.picks),
    };
  }
  const categories = normaliseCategories(values);
  const picks = picksFromCategories(categories).filter((p) => pickTypes(p).length > 0);
  const safe = picks.length ? picks : [...DEFAULT_SETTINGS.picks];
  return {
    settings: { picks: safe, rounds: clampRounds(roomRoundCount(categories), safe) },
    legacy: true,
    categories,
  };
}

/** A round count held to 3…cap (a stored count above a later, smaller cap deals the cap). */
export function clampRounds(rounds: number, picks: readonly RoomPick[]): number {
  const cap = roundCap(picks);
  return Math.max(Math.min(MIN_ROUNDS, cap), Math.min(cap, Math.round(rounds)));
}

/** Server-side validation of a host's input; a message for anything it refuses. */
export function validateRoomSettings(
  input: unknown,
): { ok: true; settings: RoomSettings } | { ok: false; message: string } {
  const value = input as { picks?: unknown; rounds?: unknown } | null;
  if (!value || !Array.isArray(value.picks) || value.picks.length === 0)
    return { ok: false, message: "Choose at least one category." };
  if (
    value.picks.length > ROOM_PICKS.length ||
    !value.picks.every(isRoomPick) ||
    new Set(value.picks).size !== value.picks.length
  )
    return { ok: false, message: "Choose valid categories." };
  const picks = orderPicks(value.picks);
  if (picks.some((p) => pickTypes(p).length === 0))
    return { ok: false, message: "A category you picked has no games yet." };
  const rounds = value.rounds;
  if (
    typeof rounds !== "number" ||
    !Number.isInteger(rounds) ||
    rounds < MIN_ROUNDS ||
    rounds > MAX_ROUNDS
  )
    return { ok: false, message: `Choose ${MIN_ROUNDS} to ${MAX_ROUNDS} rounds.` };
  const cap = roundCap(picks);
  if (rounds > cap) return { ok: false, message: `Only ${cap} games in your picks.` };
  return { ok: true, settings: { picks, rounds } };
}

/** The preset these picks match exactly, if any. */
export function presetOf(picks: readonly RoomPick[]): PresetId | null {
  const set = new Set(picks);
  return (
    ROOM_PRESETS.find((p) => p.picks.length === set.size && p.picks.every((x) => set.has(x)))?.id ??
    null
  );
}

/**
 * Seconds a round takes beyond its own clock: the intro (most rooms are ready in ~15 s of its 30), the
 * answer reveal (5 s) and the round results and standings (~18 s).
 */
export const ROUND_OVERHEAD_S = 38;
/** Prepare to Duel at the start and the winner reveal and podium at the end. */
export const ROOM_OVERHEAD_S = 40;
/** Most players finish before the clock: a round is about this share of its limit. */
export const PLAYED_SHARE = 0.8;

function averageLimitS(pick: RoomPick, picks: readonly RoomPick[]): number {
  const types = pickTypes(pick, picks);
  if (!types.length) return 0;
  return (
    types.reduce((sum, t) => sum + (puzzleDef(t).timeLimitMs ?? 60_000), 0) / types.length / 1000
  );
}

/** The room's estimated length in whole minutes (at least 1), from the chosen games' round lengths. */
export function estimateRoomMinutes(settings: RoomSettings): number {
  const picks = settings.picks.filter((p) => pickTypes(p).length > 0);
  if (!picks.length || settings.rounds <= 0) return 0;
  // Fair shares: every pick plays rounds ÷ picks of the rounds, on average.
  const perRound = picks.reduce((sum, p) => sum + averageLimitS(p, picks), 0) / picks.length;
  const seconds = settings.rounds * (perRound * PLAYED_SHARE + ROUND_OVERHEAD_S) + ROOM_OVERHEAD_S;
  return Math.max(1, Math.round(seconds / 60));
}

/** "Logic, Pattern, Retro, Sports" (or the preset's name when it's one). */
export function picksLine(picks: readonly RoomPick[]): string {
  const preset = presetOf(picks);
  if (preset) return ROOM_PRESETS.find((p) => p.id === preset)!.label;
  return orderPicks(picks).map(pickLabel).join(", ");
}

/** The lobby's summary line: "9 rounds · Logic, Pattern, Retro, Sports · about 15 min". */
export function settingsSummary(settings: RoomSettings): string {
  const n = settings.rounds;
  return `${n} ${n === 1 ? "round" : "rounds"} · ${picksLine(settings.picks)} · about ${estimateRoomMinutes(settings)} min`;
}

/** The colour token behind a pick's chip (the theme's `--category-*` and `--group-*`). */
export function pickColourVar(pick: RoomPick): string {
  return isArcadePick(pick) ? `--group-${pick}` : `--category-${pick}`;
}
/** A group's hex (arcadeGroups.ts), for places that need the literal. */
export function pickGroupHex(pick: ArcadeGroup): string {
  return arcadeGroupInfo(pick).colour;
}
