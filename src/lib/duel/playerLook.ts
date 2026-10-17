/**
 * Player colours and icons (17 Oct 2026; presentation and room data only). Each player in a room
 * has one of ten colours, never two the same, and optionally one of sixteen icons
 * (PLAYER_ICONS_ENABLED in src/lib/brand.ts). The server assigns a colour on join and stores it on
 * duel_players.colour (an index into PLAYER_COLOURS) and duel_players.icon (an id from
 * PLAYER_ICON_IDS); a player changes them in the lobby through setPlayerLookFn. Play again keeps
 * them (restart_duel_room never touches either column).
 *
 * Rows from before the columns exist (or before the migration is applied) have no colour: every
 * device resolves those the same way from the player slot (resolvePlayerLooks), so a room still
 * shows distinct colours and initials. Nothing here reads or writes a round, score or timing.
 */
import type { DuelPlayerRow } from "./types";

/**
 * Ten colours for the app's dark background (#0B0B0F). Each one has at least 4.5:1 contrast
 * against the background, and the near-black glyph drawn on it (#0B0B0F) has the same, so the
 * initial or icon inside a badge is readable. Tuned for colour-blind players: every pair is at
 * least 11 ΔE2000 apart with normal vision and with simulated protanopia, deuteranopia and
 * tritanopia (Machado 2009, full severity); player-looks-check proves both. Colour never means
 * anything on its own: every badge carries the player's initial or icon next to their name.
 */
export const PLAYER_COLOURS = [
  { name: "Lemon", hex: "#DFD855" },
  { name: "Apricot", hex: "#E3945F" },
  { name: "Vermilion", hex: "#ED3920" },
  { name: "Rose", hex: "#D45389" },
  { name: "Violet", hex: "#8A65F0" },
  { name: "Periwinkle", hex: "#8D97F4" },
  { name: "Sky", hex: "#77C1DD" },
  { name: "Aqua", hex: "#76F4F4" },
  { name: "Mint", hex: "#A7E9A4" },
  { name: "Steel", hex: "#8A8EA3" },
] as const;

export const PLAYER_COLOUR_COUNT = PLAYER_COLOURS.length;

/** The glyph colour inside a badge (the app background). */
export const BADGE_GLYPH = "#0B0B0F";

/** The sixteen icons, drawn in src/components/duel/playerIcons.tsx. Ids are stored: never rename one. */
export const PLAYER_ICON_IDS = [
  "bolt",
  "flame",
  "star",
  "spark",
  "comet",
  "moon",
  "planet",
  "rocket",
  "gem",
  "target",
  "die",
  "wave",
  "peak",
  "leaf",
  "anchor",
  "shield",
] as const;

export type PlayerIconId = (typeof PLAYER_ICON_IDS)[number];

export interface PlayerLook {
  /** Index into PLAYER_COLOURS. */
  colour: number;
  /** An icon id, or null for the player's initial. */
  icon: PlayerIconId | null;
}

/** Slot → look for everyone in a room. */
export type PlayerLooks = ReadonlyMap<number, PlayerLook>;

export function isPlayerColour(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < PLAYER_COLOUR_COUNT;
}

export function isPlayerIcon(value: unknown): value is PlayerIconId {
  return typeof value === "string" && (PLAYER_ICON_IDS as readonly string[]).includes(value);
}

type LookRow = Pick<DuelPlayerRow, "player_slot"> & { colour?: number | null; icon?: string | null };

/**
 * Whether this room's rows come from a database with the colour and icon columns (applied
 * migration). Before it, `colour` is absent from every row (not null), and the lobby hides the
 * picker: there is nowhere to store a choice yet.
 */
export function lookColumnsPresent(players: readonly LookRow[]): boolean {
  return players.length > 0 && players.every((p) => "colour" in p);
}

/** The first colour not in `taken`, starting from the slot's own (slot 1 → Lemon) and wrapping. */
function autoColour(slot: number, taken: ReadonlySet<number>): number {
  const start = (((slot - 1) % PLAYER_COLOUR_COUNT) + PLAYER_COLOUR_COUNT) % PLAYER_COLOUR_COUNT;
  for (let i = 0; i < PLAYER_COLOUR_COUNT; i++) {
    const colour = (start + i) % PLAYER_COLOUR_COUNT;
    if (!taken.has(colour)) return colour;
  }
  return start;
}

/**
 * Every player's look, the same on every device and on the server. Stored colours win in slot
 * order (a duplicate, which the unique index rules out, would fall back to auto for the later
 * slot); rows without one take the first free colour from their slot's own. Pass every row in the
 * room, left players included, so a departure never shifts anyone's colour.
 */
export function resolvePlayerLooks(players: readonly LookRow[]): Map<number, PlayerLook> {
  const sorted = [...players].sort((a, b) => a.player_slot - b.player_slot);
  const taken = new Set<number>();
  const colours = new Map<number, number>();
  for (const p of sorted)
    if (isPlayerColour(p.colour) && !taken.has(p.colour)) {
      taken.add(p.colour);
      colours.set(p.player_slot, p.colour);
    }
  for (const p of sorted) {
    if (colours.has(p.player_slot)) continue;
    const colour = autoColour(p.player_slot, taken);
    taken.add(colour);
    colours.set(p.player_slot, colour);
  }
  const looks = new Map<number, PlayerLook>();
  for (const p of sorted)
    looks.set(p.player_slot, {
      colour: colours.get(p.player_slot)!,
      icon: isPlayerIcon(p.icon) ? p.icon : null,
    });
  return looks;
}

/**
 * The colour the server gives a new player in `slot`: their remembered colour when it is free,
 * else the first free one from the slot's own. `players` are the room's existing rows.
 */
export function pickJoinColour(players: readonly LookRow[], slot: number, preferred?: unknown): number {
  const taken = new Set([...resolvePlayerLooks(players).values()].map((look) => look.colour));
  if (isPlayerColour(preferred) && !taken.has(preferred)) return preferred;
  return autoColour(slot, taken);
}

/** Colours another player already holds (for the lobby picker and setPlayerLookFn). */
export function takenColours(players: readonly LookRow[], mySlot: number): Map<number, number> {
  const taken = new Map<number, number>();
  for (const [slot, look] of resolvePlayerLooks(players)) if (slot !== mySlot) taken.set(look.colour, slot);
  return taken;
}

/** The letter shown in a badge without an icon. */
export function playerInitial(name: string): string {
  const letter = [...(name ?? "").trim()][0];
  return letter ? letter.toLocaleUpperCase() : "?";
}

/* --------------------------------------------------------------- device memory */

const LOOK_KEY = "duelz_player_look";

/** The colour and icon this device last chose, sent with a create or join (used when free). */
export function rememberedLook(): Partial<PlayerLook> {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(window.localStorage.getItem(LOOK_KEY) ?? "{}") as Record<string, unknown>;
    return {
      ...(isPlayerColour(raw["colour"]) ? { colour: raw["colour"] } : {}),
      ...(raw["icon"] === null || isPlayerIcon(raw["icon"]) ? { icon: raw["icon"] as PlayerIconId | null } : {}),
    };
  } catch {
    return {};
  }
}

export function rememberLook(look: Partial<PlayerLook>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOOK_KEY, JSON.stringify({ ...rememberedLook(), ...look }));
  } catch {
    /* storage is a nicety */
  }
}
