# Identity art still flat after PRs A–D (S5, 28 Nov 2026, for Joe's PR E decision)

Joe: nothing flat should survive to the beta. This lists every piece of art in the app that is still a flat drawing
and isn't covered by PRs A–D, then the art re-rendered earlier and whether it matches the new Blender look. Nothing
here is rendered yet; Joe decides what goes into PR E.

**Kinds of art in the app today:**

1. **This work (S5):** `scripts/identity-art/` (Blender, Cycles), PRs A–D.
2. **The earlier cosmetics redraws:** `docs/design/cosmetics-redraws/blender/*.py` (Blender) into
   `public/cosmetics/redrawn/` (99 files).
   - Each is drawn only where its switch is `true` in `src/config/cosmeticRedraws.ts` (84 switches: 51 on, 33 off).
   - Where a switch is off, the flat drawing is live.
3. **The style guide's art kit:** a raymarched WebGL shader (`docs/design/style-guide/source/art.html`), cut into
   `public/nav`, `home`, `profile-art`, `tournaments-art`, `shop-art`, `settings-art`.
   - Glossy and 3D-looking, but not Blender.
4. **Flat stills:** screenshots of the approved flat drawings.
   - `public/shop/*.webp` (78, `scripts/shop-previews.ts`).
   - `public/looks/*.webp` (27, `scripts/look-previews.ts`).

Identity art means rewards, cosmetics and characters, worth rendering. UI means icons, chrome and typography, which
stay as they are.

## Covered by PRs A–D (for reference)

- **A: avatars and gems.**
  - The 32 avatars (`AVATARS`), all 7 finishes and the 10 gems, with the gem glow and shimmer.
  - Supersedes the four earlier finish redraws (`fin.chrome`, `carbon`, `holographic`, `neon-glow`): flat avatars
    with a material texture.
- **B: emblems and badges.**
  - The tier emblems (`Emblem`, `public/art/emblems/top-500.svg`) and the 54 badges.
  - The season emblem (`SeasonEmblem`, `SeasonSection.tsx`) is `Emblem` plus an "S1" mark, so it follows.
- **C: trophies, medals, podium, awards and Captain.**
  - Trophies, medals (`Medal`, `MedalArt`), the podium steps, the podium award art and Captain Joulz's two app poses.
  - Empty, error, offline and onboarding screens (`EmptyState`, `ErrorState`, `OfflineState`, `AppErrorScreen`,
    `FirstOpen`) only reuse Captain and the reward art, so they follow.
- **D: frames and the nameplate strip.**
  - Every frame: the 16 in `FRAMES`, `frame.championship`, the 7 season frames and Founding Supporter (new).

## Still flat: identity art (candidates for PR E)

| Piece | Ids / paths | Where it shows | Count | Now |
| --- | --- | --- | --- | --- |
| Avatar accessory | `avatar-accessory.neon-bolt` | On the avatar everywhere (`cosmetics.ts` `dressAvatar`; PR A keeps it as an overlay) | 1 | Flat SVG; a redraw `acc.bolt3` exists, switch off |
| Special edition | `avatar-special-edition.neon-captain-joulz` | In place of the avatar (`cosmetics.ts`) | 1 | Flat SVG, never redrawn |
| Reactions (emotes) | `reaction.banter`, `holo-stickers`, `live-wire` | Room chat (`RoomChat.tsx`), Customise | 12 emotes | Flat SVG, never redrawn |
| Reactions | `reaction.spark`, `zap`, `retro-arcade` | as above | 6 emotes | Redrawn (`emote3.*`), switches off: flat live |
| Celebrations | `celebration.confetti-pop`, `fireworks`, `gold-rush`, `power-surge` | Podium entrance (`PodiumCelebrations.tsx`) | 4 | Flat SVG, never redrawn (two animated) |
| Celebrations | `celebration.spotlight`, `shockwave`, `circuit-overload` | as above | 3 | Redrawn with the 3D Captain (`cel3.*`), switches off |
| Tile styles | `tile-style.brushed-gold`, `blueprint`, `obsidian-glass`, `neon-dots`, `neon-grid` | Your own Practice tiles (`GameIcon.tsx`) | 5 | Flat SVG (`circuit-trace` is redrawn, on) |
| Card arts | `card-art.circuit`, `sunset`, `neon-city`, `gold-circuit`, `aurora`, `neon-wave`, `grid-runner`, `neon-pulse`, `neon-circuit` (Season 1) | The player card everywhere (`PlayerCard.tsx`), Customise, the pass | 9 | Flat SVG, never redrawn |
| Card arts | `card-art.joulz-navy`, `tier.top-500`, `crimson`, `royal`, `emerald`, `diamond-plate`, `frost`, `neon-skyline`, `static` | as above | 9 | Redrawn, switches off: flat live |
| Game skins and themes | `game-skin.apex.molten-gold`, `neon-paint`, `racing-stripes`; `game-skin.top-bins.comet`, `retro-leather`, `neon-football`; `world-theme.cue-ball.neon-table` | In those games (`racing.skins.ts`, `freekick.skins.ts`, `ballArt.ts`) | 7 | Drawn in code on the canvas (game art; the other skins and themes are Blender, on) |
| Shop item pictures | `public/shop/*.webp` | Shop cards, bundles, confirm, the pass's item rewards (`ShopArt.tsx`) | 78 | Flat stills of the wave-2 drawings, even where the item itself is now rendered |
| Look previews | `public/looks/*.webp` | Customise's Games tab (`LookPreview`) | 27 | Flat stills, including looks whose in-game art is now Blender |

**Notes on the table:**

- **Shop and look pictures:** they show the item, so they follow whatever PRs A–E render. Re-shooting them from the
  renders is mechanical (a script change, no new art). Without it, the Shop keeps showing the flat versions.
- **The Neon Circuit set:** `card-art.neon-circuit` is above; `frame.neon-circuit` is in PR D.
- **The season pass:** it has no hero or banner art of its own. Its rewards are the items above and the art-kit coin
  and Joules.

## Still flat: UI (stays as it is unless Joe says otherwise)

- **Icon set:** the Joulz icons, about 104 at 24 px (`src/design/icons/icons.data.ts`).
- **Small marks:** `TabIcons`, `LevelMark`, `Stars`, `ProfileGauges`, the Shop heart, the lobby tick.
- **Header icons:** the coin in the header (`CoinCounter.tsx`, 20 px) and the Joules bolt (`JoulesBolt.tsx`, 14–18 px).
  - Larger art-kit versions of both exist.
- **Player icons:** 17 line glyphs (`playerIcons.tsx`), the badge on a player with no avatar.
- **Name colours (11):** CSS text styles on the player's name, not drawings. Only `name-colour.chrome` has a material
  texture, on.
- **Brand:** the wordmark and logo bolt, the app icons, launch screens and link preview (`scripts/brand-icons.ts`,
  `scripts/og-image.ts`).

## Already 3D, but not from this pipeline

- **The art kit (WebGL):** nav (43), home (38), profile (12), tournaments (35), settings (6), shop-art (coin packs,
  Joules, Plus).
  - Glossy 3D already. Re-rendering in Blender would only unify the engine.
- **Game art already in Blender:** `public/logic-art`, `pattern-art`, `number`, `attention`, `speed-art`, `sports`,
  `strategy`, `orbit`, `word-art`, `cards-board`.
  - Game tiles (`public/tiles`, 104) are screenshots of the games themselves.

## Re-rendered earlier: do they match the new look?

| Group | Ids | Live | Matches the S5 look? |
| --- | --- | --- | --- |
| Card arts | bolt-stripes, grid, waves, hexes, dots, sunburst, galaxy, lava, tier.spark … tier.lightning (14) | on | Yes: they are rendered scenes behind the card's text (space, a storm, lit metal), so they sit well with the new avatars and frames. No pass needed. |
| Card arts | joulz-navy, tier.top-500, crimson, royal, emerald, diamond-plate, frost, neon-skyline, static (9) | off | Rendered but never approved. Tier.top-500 should follow Top 500's new platinum-white and gold. |
| Card backs | royal-damask, holo-foil, neon (3) | on | Yes (in-game card backs, rendered). |
| Frames | bronze, silver, obsidian on; founding, top-500, championship, s1-* off | mixed | Close: real lit metal, but thinner and lit by a different studio. All frames are redone in PR D for one consistent look. |
| Avatar finishes | fin.chrome, carbon, holographic, neon-glow | on | Superseded by PR A: the rendered avatar takes their place, so their switches stop mattering. |
| Emotes | clutch, captains-calls ×4, neon-signs ×4 on; spark, zap, retro-arcade off | mixed | Partly: rendered, but simpler and flatter-lit than the S5 studio. A light pass (same studio and materials) would match them. |
| Tile style | circuit-trace | on | Partly, as the emotes. |
| Celebrations | spotlight, shockwave, circuit-overload | off | They use an earlier 3D Captain. They should follow PR C's Captain before being switched on. |
| Name colour | chrome | on | A material texture on text: fine as it is. |
| Game skins and themes | crazy-golf ×4, cue-ball ×4, curl-champ ×3, full-house ×3, the three neon themes | on | Yes (in-game art). |

## Summary of PR E candidates

- **Flat and never rendered:** 1 accessory, 1 special edition, 12 emotes, 4 celebrations, 5 tile styles, 9 card arts.
- **Rendered but switched off:**
  - 6 emotes, 3 celebrations and 9 card arts.
  - Each needs Joe's verdict, or a re-render in the S5 studio.
- **Game looks still drawn in code:** 7.
- **Pictures that should follow the renders:** 78 Shop and 27 look previews (a script, no new art).
