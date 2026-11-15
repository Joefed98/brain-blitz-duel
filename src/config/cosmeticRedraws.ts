/**
 * Cosmetics redraws (phase 2 step 4, 15 Nov 2026; docs/design/cosmetics-redraws/GALLERY.md and AUDIT.md).
 *
 * One switch per redrawn item. false draws today's art exactly; true draws the redraw, everywhere that item is drawn.
 * Turning one on is this one line, for Joe to approve item by item (Joe's verdicts of 15 Nov 2026: the items set true;
 * the rest wait for polish, a redo or his approval).
 *
 * A switch changes only the drawing: never who owns an item, what is offered or priced, or whether it is withdrawn.
 * A withdrawn item stays withdrawn whatever its switch says; bringing it back is its own one line,
 * `SELECT economy.restore_item('<id>', '<note>');` (docs/economy/withdrawn.md).
 */
export const REDRAWN_ART_ON: Readonly<Record<string, boolean>> = {
  "card-art.joulz-navy": false,
  "card-art.bolt-stripes": true,
  "card-art.grid": true,
  "card-art.waves": true,
  "card-art.hexes": true,
  "card-art.dots": true,
  "card-art.sunburst": true,
  "card-art.tier.spark": true,
  "card-art.tier.charge": true,
  "card-art.tier.volt": true,
  "card-art.tier.surge": true,
  "card-art.tier.storm": true,
  "card-art.tier.lightning": true,
  "card-art.tier.top-500": false,
  "card-art.crimson": false,
  "card-art.galaxy": true,
  "card-art.royal": false,
  "card-art.emerald": false,
  "card-art.lava": true,
  "card-art.diamond-plate": false,
  "card-art.frost": false,
  "card-art.neon-skyline": false,
  "card-art.static": false,
  "frame.bronze": true,
  "frame.silver": true,
  "frame.obsidian": true,
  "frame.founding": false,
  "frame.top-500": false,
  "frame.championship": false,
  "frame.s1-spark": false,
  "frame.s1-charge": false,
  "frame.s1-volt": false,
  "frame.s1-surge": false,
  "frame.s1-storm": false,
  "frame.s1-lightning": false,
  "frame.s1-top-500": false,
  "name-colour.chrome": true,
  "name-colour.neon-pink": false,
  "name-colour.neon-cyan": false,
  "name-colour.neon-red": false,
  "name-colour.electric-orange": false,
  "avatar-finish.carbon": true,
  "avatar-finish.chrome": true,
  "avatar-finish.holographic": true,
  "avatar-finish.neon-glow": true,
  "avatar-accessory.neon-bolt": true,
  "reaction.spark": false,
  "reaction.zap": true,
  "reaction.clutch": true,
  "reaction.captains-calls": true,
  "reaction.retro-arcade": false,
  "reaction.neon-signs": true,
  "celebration.spotlight": false,
  "celebration.shockwave": false,
  "celebration.circuit-overload": false,
  "tile-style.circuit-trace": true,
  "card-back.royal-damask": true,
  "card-back.holo-foil": true,
  "card-back.neon": true,
  "game-skin.crazy-golf.watermelon": true,
  "game-skin.crazy-golf.disco": true,
  "game-skin.crazy-golf.neon-glow": true,
  "game-skin.crazy-golf.plasma": true,
  "game-skin.cue-ball.pixel-pool": true,
  "game-skin.cue-ball.galaxy-set": true,
  "game-skin.cue-ball.neon-8-ball": true,
  "game-skin.cue-ball.neon-ball-set": true,
  "game-skin.curl-champ.glacier": true,
  "game-skin.curl-champ.aurora": true,
  "game-skin.curl-champ.neon-stones": true,
  "game-skin.full-house.midnight-felt": true,
  "game-skin.full-house.crimson-velvet": true,
  "game-skin.full-house.neon-felt": true,
  "world-theme.apex.neon-night": true,
  "world-theme.crazy-golf.neon-course": true,
  "world-theme.curl-champ.neon-rink": true,
};

/** Whether this item draws its redrawn art (false for anything not listed). */
export function redrawnArtOn(id: string | null | undefined): boolean {
  return !!id && REDRAWN_ART_ON[id] === true;
}

/**
 * Redrawn default looks: what every player sees with nothing equipped (not cosmetics, so not in the catalogue). Off
 * draws today's look exactly; on draws the redraw. One line per look, for Joe to approve.
 */
export const REDRAWN_DEFAULT_LOOKS: Readonly<Record<string, boolean>> = {
  "default.crazy-golf.course": true,
};

/** Whether a default look draws its redraw (false for anything not listed). */
export function redrawnDefaultOn(id: string): boolean {
  return REDRAWN_DEFAULT_LOOKS[id] === true;
}
