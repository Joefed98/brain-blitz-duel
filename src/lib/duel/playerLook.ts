/**
 * Player colours and icons (17 Oct 2026; presentation and room data only). Each player in a room
 * has one of the colour wheel's 32 swatches (ten until 31 Oct 2026), never two the same, and optionally one of sixteen icons
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
 * The colour wheel (31 Oct 2026, rooms of up to 16): 32 swatches for the app's dark background
 * (#0B0B0F). Every one has at least 4.5:1 contrast against the background, and the near-black glyph
 * drawn on it (#0B0B0F) has the same, so the initial or icon inside a badge is readable. Every pair
 * is at least PLAYER_COLOUR_MIN_DE (14) ΔE2000 apart with normal vision (player-looks-check and
 * room-16-check prove both; the set was grown from the first ten by farthest-point search over sRGB).
 *
 * Indices are stored (duel_players.colour, the device's remembered look): never reorder or remove
 * one. 0–9 are the October palette exactly, still at least 10 ΔE2000 apart with normal vision and
 * simulated protanopia, deuteranopia and tritanopia (Machado 2009, full severity): a room seats its
 * first ten players on them when nobody has chosen (autoColour). Colour never means anything on
 * its own: every badge carries the player's initial or icon next to their name.
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
  // The wheel's other 22 (31 Oct 2026).
  { name: "Emerald", hex: "#008F4F" },
  { name: "Peach", hex: "#FFC7B7" },
  { name: "Olive", hex: "#8F7F00" },
  { name: "Teal", hex: "#3F8787" },
  { name: "Orchid", hex: "#FF87FF" },
  { name: "Sage", hex: "#8FA77F" },
  { name: "Azure", hex: "#0087C7" },
  { name: "Cream", hex: "#F7DFB7" },
  { name: "Coral", hex: "#FF7F7F" },
  { name: "Amber", hex: "#FFAF00" },
  { name: "Blush", hex: "#FFCFEF" },
  { name: "Lavender", hex: "#C7CFFF" },
  { name: "Green", hex: "#00C73F" },
  { name: "Magenta", hex: "#E700E7" },
  { name: "Moss", hex: "#679700" },
  { name: "Mauve", hex: "#BF8FAF" },
  { name: "Jade", hex: "#00BF9F" },
  { name: "Copper", hex: "#BF6700" },
  { name: "Sand", hex: "#BFA767" },
  { name: "Lime", hex: "#97F700" },
  { name: "Clay", hex: "#A76F6F" },
  { name: "Mocha", hex: "#9F7F5F" },
] as const;

/** The October palette's ten (indices 0–9), still colour-blind separated; the first ten auto colours. */
export const CVD_SAFE_COLOURS = 10;
/** The least ΔE2000 (normal vision) between any two wheel swatches. */
export const PLAYER_COLOUR_MIN_DE = 14;

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
  "compass",
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

/**
 * The first colour not in `taken`, starting from the slot's own (slot 1 → Lemon, slots 1–10 the
 * colour-blind-separated ten) and wrapping round the wheel's indices.
 */
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
 * The colour the server gives a new player in `slot`: their remembered colour (their default, set
 * on Profile or in a lobby) when it is free; when someone here already has it, the nearest free
 * swatch to it (ΔE2000, nearestFreeColour); with no default, the first free one from the slot's
 * own. `players` are the room's existing rows.
 */
export function pickJoinColour(players: readonly LookRow[], slot: number, preferred?: unknown): number {
  const taken = new Set([...resolvePlayerLooks(players).values()].map((look) => look.colour));
  if (isPlayerColour(preferred)) return taken.has(preferred) ? nearestFreeColour(preferred, taken) : preferred;
  return autoColour(slot, taken);
}

/**
 * The free swatch closest to `colour` by ΔE2000 (ties to the lower index), or `colour` itself when
 * it is free. With every swatch taken (never in a room of 16) it returns `colour`.
 */
export function nearestFreeColour(colour: number, taken: ReadonlySet<number>): number {
  if (!taken.has(colour)) return colour;
  let best = colour;
  let bestD = Infinity;
  for (let i = 0; i < PLAYER_COLOUR_COUNT; i++) {
    if (taken.has(i)) continue;
    const d = colourDistance(colour, i);
    if (d < bestD) [best, bestD] = [i, d];
  }
  return best;
}

/* ------------------------------------------------------------ colour distance */

const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function hexLab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => linear(parseInt(hex.slice(i, i + 2), 16) / 255)) as [number, number, number];
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

/** CIEDE2000 between two CIELAB colours. */
export function deltaE2000([L1, a1, b1]: readonly number[], [L2, a2, b2]: readonly number[]): number {
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1!, b1!);
  const C2 = Math.hypot(a2!, b2!);
  const Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1!;
  const ap2 = (1 + G) * a2!;
  const Cp1 = Math.hypot(ap1, b1!);
  const Cp2 = Math.hypot(ap2, b2!);
  const hue = (x: number, y: number) => (Math.atan2(y, x) / rad + 360) % 360;
  const hp1 = hue(ap1, b1!);
  const hp2 = hue(ap2, b2!);
  let dh = hp2 - hp1;
  if (Cp1 * Cp2 === 0) dh = 0;
  else if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dL = L2! - L1!;
  const dC = Cp2 - Cp1;
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh / 2) * rad);
  const Lb = (L1! + L2!) / 2;
  const Cpb = (Cp1 + Cp2) / 2;
  let hb = hp1 + hp2;
  if (Cp1 * Cp2 !== 0) hb = Math.abs(hp1 - hp2) > 180 ? (hp1 + hp2 + 360) / 2 : (hp1 + hp2) / 2;
  const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad);
  const SL = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2);
  const SC = 1 + 0.045 * Cpb;
  const SH = 1 + 0.015 * Cpb * T;
  const RT = -2 * Math.sqrt(Cpb ** 7 / (Cpb ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hb - 275) / 25) ** 2)) * rad);
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}

let labs: [number, number, number][] | null = null;
/** ΔE2000 between two wheel swatches (by index). */
export function colourDistance(a: number, b: number): number {
  labs ??= PLAYER_COLOURS.map((c) => hexLab(c.hex));
  return deltaE2000(labs[a]!, labs[b]!);
}

/** A swatch's CIELAB (L, a, b), for the wheel's layout. */
export function colourLab(index: number): readonly [number, number, number] {
  labs ??= PLAYER_COLOURS.map((c) => hexLab(c.hex));
  return labs[index]!;
}

/* ------------------------------------------------------------ the wheel's layout */

export interface WheelSwatch {
  index: number;
  /** Ring 0 is the outer (most colourful), 2 the inner (softest). */
  ring: 0 | 1 | 2;
  /** Angle in degrees, clockwise from the top. */
  angle: number;
}
/** Swatches per ring, outside in (18 + 10 + 4 = 32). */
export const WHEEL_RINGS = [18, 10, 4] as const;

/**
 * The colour wheel's places, the same on every device: swatches by chroma into three rings (the
 * most colourful outside, like a colour picker), each ring in hue order from red, evenly spaced.
 */
export function colourWheel(): WheelSwatch[] {
  const chroma = (i: number) => Math.hypot(colourLab(i)[1], colourLab(i)[2]);
  const hue = (i: number) => (Math.atan2(colourLab(i)[2], colourLab(i)[1]) * (180 / Math.PI) + 360 - 20) % 360;
  const byChroma = PLAYER_COLOURS.map((_, i) => i).sort((a, b) => chroma(b) - chroma(a) || a - b);
  const out: WheelSwatch[] = [];
  let from = 0;
  WHEEL_RINGS.forEach((count, ring) => {
    const members = byChroma.slice(from, from + count).sort((a, b) => hue(a) - hue(b) || a - b);
    from += count;
    const offset = ring === 1 ? 180 / count : 0;
    members.forEach((index, k) => out.push({ index, ring: ring as 0 | 1 | 2, angle: (offset + (360 * k) / count) % 360 }));
  });
  return out;
}

/** Colours another player already holds (for the lobby picker and setPlayerLookFn). */
export function takenColours(players: readonly LookRow[], mySlot: number): Map<number, number> {
  const taken = new Map<number, number>();
  for (const [slot, look] of resolvePlayerLooks(players)) if (slot !== mySlot) taken.set(look.colour, slot);
  return taken;
}

/**
 * Icons another player already holds (for the lobby picker and setPlayerLookFn): like colours, no
 * two players in a room pick the same icon. Their initial (no icon) is never taken.
 */
export function takenIcons(players: readonly LookRow[], mySlot: number): Map<PlayerIconId, number> {
  const taken = new Map<PlayerIconId, number>();
  for (const [slot, look] of resolvePlayerLooks(players))
    if (slot !== mySlot && look.icon && !taken.has(look.icon)) taken.set(look.icon, slot);
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
