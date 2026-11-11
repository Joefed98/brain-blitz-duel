/**
 * Game skins and world themes (wave 2, E1; docs/art/wave-2/items/game-skin, items/world-theme; docs/skins.md).
 *
 * Display only. A look is the pair of item ids a player has equipped for one game: its skin (balls, stones, card
 * backs, felt, car paint) and its world theme (the course, table, rink or night circuit round it). Each skinnable
 * game's renderer takes an optional look on its public draw calls and reads its colours and surfaces from the look's
 * theme object; with no look (every replay, reveal, intro demo, tile and other player) it draws its default theme,
 * which is today's look exactly (skins-default-check proves the pixels against main).
 *
 * Nothing here is read by a sim, a grader or a deal: a look never changes sizes, hit areas, motion or physics, and the
 * live stage alone passes one (the player's own equipped items; src/lib/skins/equipped.ts).
 */

export interface GameLook {
  /** A `game-skin.<game>.<name>` catalogue id, or null for the default. */
  skin: string | null;
  /** A `world-theme.<game>.<name>` catalogue id, or null for the default. */
  world: string | null;
  /** A `card-back.<name>` catalogue id (the account's one card back; only games with a face-down deck draw it). */
  back?: string | null;
}

export const NO_LOOK: GameLook = Object.freeze({ skin: null, world: null, back: null });

/** The seven skinnable games (their PuzzleType ids) and the catalogue's name for each. */
export const SKIN_GAME_NAMES = {
  racing: "apex",
  minigolf: "crazy-golf",
  pool: "cue-ball",
  curling: "curl-champ",
  pokersquares: "full-house",
  freekick: "top-bins",
} as const;
export type SkinnableGame = keyof typeof SKIN_GAME_NAMES;

/** Every skin and world theme drawn, per game (catalogue.json, the 23 skins and 4 world themes). */
export const GAME_SKIN_IDS: Readonly<Record<SkinnableGame, readonly string[]>> = {
  racing: ["game-skin.apex.racing-stripes", "game-skin.apex.molten-gold", "game-skin.apex.neon-paint"],
  minigolf: ["game-skin.crazy-golf.watermelon", "game-skin.crazy-golf.disco", "game-skin.crazy-golf.neon-glow", "game-skin.crazy-golf.plasma"],
  pool: ["game-skin.cue-ball.pixel-pool", "game-skin.cue-ball.galaxy-set", "game-skin.cue-ball.neon-8-ball", "game-skin.cue-ball.neon-ball-set"],
  curling: ["game-skin.curl-champ.glacier", "game-skin.curl-champ.aurora", "game-skin.curl-champ.neon-stones"],
  pokersquares: ["game-skin.full-house.midnight-felt", "game-skin.full-house.crimson-velvet", "game-skin.full-house.neon-felt"],
  freekick: ["game-skin.top-bins.comet", "game-skin.top-bins.retro-leather", "game-skin.top-bins.neon-football"],
};
export const WORLD_THEME_IDS: Readonly<Record<SkinnableGame, readonly string[]>> = {
  racing: ["world-theme.apex.neon-night"],
  minigolf: ["world-theme.crazy-golf.neon-course"],
  pool: ["world-theme.cue-ball.neon-table"],
  curling: ["world-theme.curl-champ.neon-rink"],
  pokersquares: [],
  freekick: [],
};

/** The card backs (catalogue kind `card-back`, one slot for the account; 11 Nov 2026, Joe). */
export const CARD_BACK_IDS: readonly string[] = ["card-back.royal-damask", "card-back.holo-foil", "card-back.neon"];
/** The games whose face-down cards draw the equipped back: Full House's deck (behind Next card). */
export const CARD_BACK_GAMES: readonly SkinnableGame[] = ["pokersquares"];

export const isSkinnableGame = (g: string): g is SkinnableGame => Object.prototype.hasOwnProperty.call(SKIN_GAME_NAMES, g);

/** The look kept to items this game knows (anything else draws the default). */
export function lookFor(game: SkinnableGame, skin: string | null | undefined, world: string | null | undefined, back?: string | null): GameLook {
  const s = skin && GAME_SKIN_IDS[game].includes(skin) ? skin : null;
  const w = world && WORLD_THEME_IDS[game].includes(world) ? world : null;
  const b = back && CARD_BACK_GAMES.includes(game) && CARD_BACK_IDS.includes(back) ? back : null;
  return s || w || b ? { skin: s, world: w, back: b } : NO_LOOK;
}

/** A stored result's look (round_results.look / async_results.look: `{skin, world, back}`), kept to this game's items. */
export function lookFromStored(game: string, stored: unknown): GameLook {
  if (!isSkinnableGame(game) || !stored || typeof stored !== "object") return NO_LOOK;
  const r = stored as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  return lookFor(game, str(r["skin"]), str(r["world"]), str(r["back"]));
}

/**
 * A replay's or a ghost's look: the player's own skin and card back with the viewer's own world theme (the scenery is
 * always the viewer's).
 */
export function playerLookIn(player: GameLook, viewer: GameLook): GameLook {
  const out = { skin: player.skin, world: viewer.world, back: player.back ?? null };
  return out.skin || out.world || out.back ? out : NO_LOOK;
}

/** A cache key for a look ("" for the default, so default caches keep their keys). */
export const lookKey = (look: GameLook | null | undefined): string =>
  look && (look.skin || look.world || look.back) ? `${look.skin ?? ""}|${look.world ?? ""}${look.back ? `|${look.back}` : ""}` : "";

/* --------------------------------------------------------------- the contrast check */

function lin(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
/** WCAG relative luminance of a #RRGGBB colour. */
export function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`not a #RRGGBB colour: ${hex}`);
  const n = parseInt(m[1]!, 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The non-text contrast the check asks of a game object against the background it is played on (WCAG 1.4.11). */
export const SKIN_MIN_CONTRAST = 3;

/**
 * What the contrast check reads from a theme: each object that must stand out (the ball, the stone, a card back, the
 * car) with the colours it is drawn in (body, outline, rim, spot), and the background colours it is played on. An
 * object passes when one of its colours reaches SKIN_MIN_CONTRAST against every one of its backgrounds.
 */
export interface ContrastPair {
  object: string;
  colours: readonly string[];
  backgrounds: readonly string[];
}

export function bestContrast(pair: ContrastPair): number {
  return Math.min(...pair.backgrounds.map((bg) => Math.max(...pair.colours.map((c) => contrastRatio(c, bg)))));
}

/** The looks that move (the catalogue's animated items, every one a Legendary): still under Reduce Motion. */
export const ANIMATED_LOOKS: readonly string[] = ["game-skin.apex.molten-gold", "world-theme.apex.neon-night", "world-theme.crazy-golf.neon-course"];
