/**
 * The review's verdicts, one per item (13 Nov 2026). Keep / Improve / Withdraw, one line why, and for Improve what
 * would make it premium. "placeholder" marks art that is not the approved drawing (it can't be offered under Joe's
 * rule until drawn). Read by build-sheet.ts.
 */
export type Verdict = "Keep" | "Improve" | "Withdraw";
export interface Review {
  v: Verdict;
  why: string;
  fix?: string;
  placeholder?: boolean;
  /** Wait for the overhaul's style guide before redrawing (true), or improve now (false/absent). */
  wait?: boolean;
}

const K = (why: string): Review => ({ v: "Keep", why });
const I = (why: string, fix: string, wait = false): Review => ({ v: "Improve", why, fix, wait });
const W = (why: string, fix?: string): Review => ({ v: "Withdraw", why, fix });

export const REVIEWS: Record<string, Review> = {
  /* Card art: free starters */
  "card-art.joulz-navy": I("The default every new player wears: a flat navy panel with nothing on it.", "A subtle navy-to-ink gradient with a faint bolt watermark and a soft top sheen, so even the default card feels finished.", true),
  "card-art.bolt-stripes": I("Two thin diagonal stripes on navy; reads as unfinished at phone size.", "Bolder, glowing bolt stripes with depth (a darker under-stripe) and a light sweep.", true),
  "card-art.grid": I("A faint 1 px grid that nearly disappears on a phone.", "A perspective grid (horizon glow) rather than a flat one; doubles as a 'starter neon' look.", true),
  "card-art.waves": I("Thin outline waves at low contrast; looks like a placeholder texture.", "Layered filled waves with a gradient, like a night sea; keep the name area calm.", true),
  "card-art.hexes": I("Faint hex outlines, barely visible.", "Raised hex tiles with a soft bevel and a few lit cells.", true),
  "card-art.circuit": K("Readable green traces with nodes; a decent free design."),
  "card-art.dots": I("A dot grid at very low contrast; disappears on the strip.", "A halftone fade (big dots to small) in a brand colour.", true),
  "card-art.sunburst": I("Muddy brown rays; looks dated rather than premium.", "Gold rays on deep navy with a glow at the centre, so it matches the brand gold.", true),
  /* Card art: season tier (earned) */
  "card-art.tier.spark": I("Flat brown panel with one bolt; the lowest tier looks drab rather than bronze.", "A bronze metal finish (gradient, edge sheen) behind the bolt; the six tiers should step up in finish, not just hue.", true),
  "card-art.tier.charge": I("Flat green panel with a single bolt; very close to its siblings.", "Give each tier its own finish step (bronze → silver → gold → platinum → obsidian → diamond) as the rarity ladder does.", true),
  "card-art.tier.volt": I("Same template, teal.", "As Charge: a distinct finish per tier.", true),
  "card-art.tier.surge": I("Same template, blue.", "As Charge.", true),
  "card-art.tier.storm": I("Same template, purple.", "As Charge.", true),
  "card-art.tier.lightning": K("Bright gold rays and bolts; reads as a top tier."),
  "card-art.tier.top-500": I("The rarest card art is a washed-out beige; it looks less special than Lightning.", "The most prestigious art in the game: diamond-plate or prism finish, animated sheen, a crown mark.", true),
  /* Card art: shop */
  "card-art.crimson": K("Rich red with chevrons; reads well at every size."),
  "card-art.royal": I("The crown is a faint smudge behind the pill; at phone size it reads as a stain.", "A crisp gold crown outline and filigree border; keep the navy."),
  "card-art.emerald": K("Faceted green gem surface; looks like a paid item."),
  "card-art.sunset": K("Clear synthwave sun and grid; strong at every size."),
  "card-art.galaxy": K("Deep nebula with stars; good."),
  "card-art.lava": I("A flat orange gradient with two faint arcs; Epic at 1,000 coins but looks like a free starter.", "Molten cracks with an inner glow over dark rock, ember specks."),
  "card-art.neon-city": K("Skyline with lit windows; good, the name stays readable."),
  "card-art.gold-circuit": K("Gold traces on black; premium and on brand."),
  "card-art.aurora": K("Legendary: animated aurora over mountains; clearly the best of the shop's card arts."),
  "card-art.diamond-plate": I("Legendary, but the diamonds are clip-art stickers over a gold tread plate and crowd the right side.", "Fewer, faceted diamonds set into the plate with real highlights; a slow light sweep across the plate."),
  "card-art.frost": I("A snowflake is drawn through the player's name ('Sky*Racer') and the moon competes with it.", "Move the flakes and moon to the right third, away from the name; keep the mountains."),
  /* Card art: pass */
  "card-art.neon-wave": K("Free-track Rare: dotted neon waves, fine for its level."),
  "card-art.neon-skyline": I("Legendary (free level 60): the buildings and lit windows run behind the name and title, which then read poorly.", "Keep the skyline to the right half or darken the left behind the name."),
  "card-art.neon-pulse": K("Heartbeat line and rings; clean and on theme."),
  "card-art.static": I("Premium level 14 Rare, but it is near-black noise you barely see on a phone.", "Visible TV static bands with a scan line and a little colour bleed."),
  "card-art.grid-runner": K("Retro runner on a grid; good."),
  "card-art.neon-circuit": K("Legendary: bold neon circuit and bolt; strong."),
  /* Frames */
  "frame.plain": K("The default thin outline; correct for a default."),
  "frame.bronze": I("A plain orange line (Common, free level 6); nothing says 'bronze'.", "A metal bronze bevel with small corner studs.", true),
  "frame.silver": I("A plain grey line (Rare, free level 26).", "A brushed-silver bevel with a light sweep at the corners.", true),
  "frame.gold": K("Ornate gold with corner brackets; reads premium."),
  "frame.obsidian": I("Elite at 1,600, but the triangle corners look like folded paper and the violet edge is faint.", "A glossy black frame with a crisp violet edge light and faceted corners."),
  "frame.diamond": K("Legendary: prism edge with diamond corners; strong."),
  "frame.founding": I("Earned; beautiful on the card, but on the 44 px nameplate strip the 'FOUNDER #0042' plaque is unreadable and the bolt tabs run into the score.", "A strip variant: no plaque text (or a small bolt mark) and nothing outside the strip's box."),
  "frame.top-500": I("Earned, but its plaque shows the sample's fixed 'TOP 500 #214' (not the player's place), the crown is cut off at the top, and on the strip it covers the score.", "Draw the player's own place (or no number), keep the crown inside the card's box, and a strip variant that stays inside the name area. Nothing grants it yet."),
  "frame.neon-circuit": K("Elite (premium level 34): animated neon tubes; strong."),
  "frame.championship": W("PLACEHOLDER: no art at all; equipping it draws the Plain frame.", "Draw it (animated, the most prestigious frame) before any Championship is held; until then don't grant it.") ,
  "frame.s1-spark": I("PLACEHOLDER art (a generated metal outline with a 'SEASON 1' tab); the tab is unreadable on the strip.", "Draw the seven Season 1 frames as a set, each with its tier's emblem; the tab hidden on the strip.", true),
  "frame.s1-charge": I("PLACEHOLDER art.", "As Spark.", true),
  "frame.s1-volt": I("PLACEHOLDER art.", "As Spark.", true),
  "frame.s1-surge": I("PLACEHOLDER art.", "As Spark.", true),
  "frame.s1-storm": I("PLACEHOLDER art.", "As Spark.", true),
  "frame.s1-lightning": I("PLACEHOLDER art.", "As Spark.", true),
  "frame.s1-top-500": I("PLACEHOLDER art.", "As Spark.", true),
  /* Name colours */
  "name-colour.gold-leaf": K("Metallic gold with a dark edge; premium."),
  "name-colour.chrome": I("Epic at 1,000, but it reads as plain grey text at phone size.", "A real chrome gradient (bright top, dark band, bright bottom) with a white glint."),
  "name-colour.sapphire": K("Blue metal with a deep shadow; fine."),
  "name-colour.amethyst": K("Violet glow; fine."),
  "name-colour.emerald-glow": K("Green neon outline; good."),
  "name-colour.prism": K("Legendary rainbow gradient (animated); strong."),
  "name-colour.neon-pink": I("Free level 10 Common: a flat pink fill, the same as a plain colour.", "A neon tube look: a light core with a pink glow, as Emerald Glow does."),
  "name-colour.neon-cyan": I("Premium level 3 Rare: a flat cyan fill.", "As Neon Pink: a glowing tube."),
  "name-colour.neon-red": I("Premium level 18 Rare: a flat red fill; red names also read as 'error'.", "A glowing tube in a warmer red-orange."),
  "name-colour.electric-orange": I("The pixel font (Silkscreen) becomes hard to read on the 44 px strip and long names lose letters.", "Keep the orange glow in the normal font, or keep pixels only on the full card."),
  "name-colour.neon-flux": K("Legendary: animated neon shift; strong."),
  /* Card backs (drawn in-game) */
  "card-back.royal-damask": I("A handsome back, but today it shows only in Full House (practice only since 1 Nov), on one small card.", "Show backs in more games (section 5) before selling it; the art itself can stay."),
  "card-back.holo-foil": I("Elite at 1,600: attractive, but seen only in Full House practice.", "As Royal Damask."),
  "card-back.neon": I("Premium level 4: seen only in Full House practice.", "As Royal Damask."),
  /* Game skins */
  "game-skin.full-house.midnight-felt": W("Full House is retired from rooms (practice only); a 1,000-coin table for a practice-only game.", "Stop selling; keep it working for owners. If Five Hands takes table skins later, move the felt there."),
  "game-skin.full-house.crimson-velvet": W("As Midnight Felt.", "As Midnight Felt."),
  "game-skin.full-house.neon-felt": W("Premium pass level 12 for a practice-only game.", "Replace the pass level with a Five Hands or Summit look, or coins."),
  "game-skin.crazy-golf.watermelon": I("The ball is about 8 px across on a phone; the skin is barely visible during play.", "Show it where it can be seen: a larger ball draw is not allowed (nothing bigger), so add a short trail and a bigger skinned ball on the hole-in and the reveal.", true),
  "game-skin.crazy-golf.disco": I("As Watermelon: invisible at play size.", "As Watermelon.", true),
  "game-skin.crazy-golf.neon-glow": I("Free level 14: as Watermelon, though its glow helps a little.", "As Watermelon.", true),
  "game-skin.crazy-golf.plasma": I("As Watermelon; the approved plasma glow is fainter than the art.", "Match the approved glow (section 4) and add the trail.", true),
  "game-skin.cue-ball.pixel-pool": I("At play size the balls are ~16 px; the approved pixel digits read as smudges.", "Pixel digits drawn on whole device pixels (3 × 5) as the art shows; a pixel cue.", false),
  "game-skin.cue-ball.galaxy-set": I("Elite at 1,600: at play size the nebula balls read as dark dots and the numbers vanish.", "Lighter nebula with brighter stars and a clear number disc; it must stay as legible as the default set."),
  "game-skin.cue-ball.neon-8-ball": I("Free level 36: changes one ball; hardly noticed.", "Add the neon cue and a neon pocket flash when the 8 drops."),
  "game-skin.cue-ball.neon-ball-set": I("Rims show, but the approved glow is missing.", "The approved outer glow inside the ball's 2 px allowance (section 4)."),
  "game-skin.top-bins.comet": K("The ball sits large near the camera; the comet ball reads well."),
  "game-skin.top-bins.retro-leather": K("A clear leather ball; good."),
  "game-skin.top-bins.neon-football": K("Neon panels read; good."),
  "game-skin.apex.racing-stripes": K("The car is large on screen; stripes read clearly."),
  "game-skin.apex.molten-gold": K("Legendary: gold car with shine; clearly premium."),
  "game-skin.apex.neon-paint": K("Neon pink car; reads well."),
  "game-skin.curl-champ.glacier": I("Only the player's own stone changes, and at the far end it is a few pixels; the handle the art shows is a flat bar.", "The approved handle shape (section 4) and a frosty trail while sliding."),
  "game-skin.curl-champ.aurora": I("As Glacier; the aurora swirl on the stone top is lost at play size.", "As Glacier, with a stronger aurora band."),
  "game-skin.curl-champ.neon-stones": I("As Glacier.", "As Glacier, with the approved neon handle."),
  /* World themes */
  "world-theme.apex.neon-night": I("Legendary: the night circuit looks good, but the approved chasing kerbs and pulsing lights are slower and dimmer than the art.", "Match the approved motion (section 4)."),
  "world-theme.crazy-golf.neon-course": I("Legendary (free level 50): strong, but the windmill's neon sails are flat compared with the art.", "The approved sails (section 4)."),
  "world-theme.curl-champ.neon-rink": I("Elite: dark ice with pink lines; plain next to the other three themes.", "Ice with a faint reflected neon city, glowing house rings that pulse once when a stone stops."),
  "world-theme.cue-ball.neon-table": K("Elite: a convincing neon table; strong."),
  /* Avatar finishes and specials (drawn on Captain Joulz on the card) */
  "avatar-finish.chrome": I("On the card the avatar is ~70 px and the finish changes a small helmet disc; Chrome, Pearl gem and Diamond gem look almost the same.", "A finish should change the whole avatar (body and scene) with a visible material: reflections for Chrome.", true),
  "avatar-finish.carbon": I("Reads as 'dark avatar'; the weave is invisible at card size.", "A larger, higher-contrast weave and a red accent line.", true),
  "avatar-finish.comic-ink": K("Bold outline and halftone read even small; distinctive."),
  "avatar-finish.holographic": I("Elite: a pastel tint, easily mistaken for a gem colour.", "A moving rainbow foil (still under Reduce Motion) across the whole avatar.", true),
  "avatar-finish.wireframe": K("Elite: cyan wireframe reads clearly and looks special."),
  "avatar-finish.lightning-core": K("Legendary: ring and sparks; clearly the top finish."),
  "avatar-finish.neon-glow": I("Premium level 40: a pink glow round a small disc.", "A glow round the whole avatar silhouette, plus a neon rim.", true),
  "avatar-accessory.neon-bolt": I("Premium level 52: a tiny bolt over the head; at card size it is a few pixels.", "Larger (within the avatar box), glowing, and drawn on every avatar shape the same way.", true),
  "avatar-special-edition.neon-captain-joulz": K("Premium level 1 (the pass's headline): pink neon helmet; distinctive."),
  /* Reactions */
  "reaction.banter": K("Four clear stickers; readable at chat size."),
  "reaction.retro-arcade": I("Epic at 1,000: four plain boxes with small pixel words ('GLHF' is hard to read).", "Fuller pixel stickers (coin, 1UP, heart) with colour and a pixel shadow."),
  "reaction.captains-calls": I("Epic at 1,000: plain white speech bubbles with ~7 px text; the cheapest-looking pack.", "Captain Joulz himself in each sticker (the approved ready and win poses) with a short line."),
  "reaction.holo-stickers": K("Elite: holographic stickers; good."),
  "reaction.spark": I("Free level 22: a 'pack' of a single star.", "Two to four emotes per pack, or call it a single emote.", true),
  "reaction.zap": I("Premium level 8: a single bolt.", "As Spark.", true),
  "reaction.clutch": I("Premium level 28: one sticker.", "As Spark.", true),
  "reaction.neon-signs": I("'BRB CRYING' is unreadable at 34 px; the signs' text is thin.", "Shorter words and thicker neon strokes so each reads at chat size."),
  "reaction.live-wire": K("Elite: animated electric words; strong."),
  /* Celebrations */
  "celebration.confetti-pop": K("Bright confetti; reads at once."),
  "celebration.spotlight": I("Epic at 1,000: two faint grey cones; most players won't notice it.", "Warm stage spotlights with dust in the beams and a sweep onto the winner."),
  "celebration.fireworks": K("Elite: clear bursts; good."),
  "celebration.shockwave": I("Elite at 1,600: three thin rings; looks unfinished.", "A visible energy ring with distortion and sparks, in the brand gold."),
  "celebration.gold-rush": K("Legendary: coins and crown; strong."),
  "celebration.power-surge": K("Legendary: lightning and stage glow; strong."),
  "celebration.circuit-overload": I("Elite (premium level 58, the podium entrance): two flat lines; weak for the pass's late levels.", "Traces that light up along the podium with nodes flashing, ending in a burst."),
  /* Tile styles */
  "tile-style.brushed-gold": K("Gold border; clearly a paid look."),
  "tile-style.blueprint": K("Blue border and grid; distinctive."),
  "tile-style.obsidian-glass": K("Violet glass edge; good."),
  "tile-style.circuit-trace": I("Free level 16: almost identical to the plain tile.", "Visible traces across the tile's border."),
  "tile-style.neon-dots": K("Pink neon dotted edge; fine."),
  "tile-style.neon-grid": K("Cyan glow; fine."),
};

/** Non-catalogue types, reviewed as a group. */
export const GROUPS: Record<string, Review> = {
  avatars: K("The 32 game avatars are crisp, distinctive and on brand; free for everyone."),
  gems: I("The ten gems recolour the helmet only; at card size several look alike (Pearl, Diamond, Aquamarine).", "A gem shows as a small set stone or a rim colour as well as the tint, so each reads at a glance.", true),
  badges: K("The 54 badge drawings are consistent and readable at 56 px; on the card (three small badges) they are small but clear."),
  titles: K("Text only, in the card's gold title style; fine as long as the card around them is premium."),
  trophies: K("The four trophies, medals and tier emblems are the approved F5 art; good."),
  seasonEmblem: I("The S1 emblem is the tier shield plus a small text mark; fine but plain for a once-a-season reward.", "A season-specific emblem (Neon Circuit motif) per tier.", true),
  plusChip: I("A small gold 'PLUS' text chip only the owner sees.", "A proper Plus mark (a badge-like emblem) others can see on the card, if Joe wants it shown.", true),
};
