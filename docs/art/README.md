# Joulz art v1

Approved 6 Nov 2026 on the "Joulz – bold new looks" design canvas. This folder is the source of truth for the
rank emblems, medals, trophies, badges and the Joulz Hero (Captain Joulz).

- `svg/`: every approved piece as a standalone SVG, exactly as approved. Treat these as the reference images.
- `source/`: the Python that drew them (`gen.py` for rewards and emblems, `hero.py` + `hero2.py` for the hero;
  Captain Joulz is variant `'4'` in `hero2.py`), and `captain-poses.json` with the joint positions for each pose.
  Port geometry from here rather than guessing from the pictures.

## Materials (move these into `src/design/tokens.css`)

Each metal is a four-stop linear gradient. Fill gradient A runs top-left to bottom-right; the inner face uses
gradient B, the reverse. A white sheen band (0 → 55 % → 0 opacity at 30 / 45 / 55 %) sits over faces.

| Metal | Stops | Ink on it |
|---|---|---|
| Bronze | `#F6D2AE` `#D49461` `#9A5E30` `#E2AB76` | `#2A1608` |
| Silver | `#FFFFFF` `#D3DCEF` `#97A4C0` `#E6ECF8` | `#151B2C` |
| Gold (ring gold) | `#FBEDC4` `#E6C67E` `#D2AC5E` `#EED79C` | `#1A1206` |
| Platinum | `#F2FCFF` `#AEEAF7` `#62B9CE` `#D6F7FF` | `#08202A` |
| Obsidian | `#4A5680` `#1E2640` `#0B0F1C` `#36406A` | gold |

Every piece has a `#06080F` outline (2–2.5 px at the 120-unit artboard size). Glows are a radial gradient of
`#F3D894`, 50 % opacity in the centre to 0.

## Rank emblems (`emblem-*.svg`)

One shield shape, rising in material and decoration. The bolt "charges up" across the first three tiers.

| Tier | Material | Symbol | Extras |
|---|---|---|---|
| Spark | Bronze | Bolt outline only | — |
| Charge | Silver | Bolt outline, lower half filled | — |
| Volt | Gold | Solid bolt | — |
| Surge | Platinum | Solid bolt with three speed lines | Platinum wings |
| Storm | Obsidian with a gold inner edge | Gold bolt | Gold wings, crown of three gold bolts |
| Lightning | Gold | Solid bolt | Gold wings, crown, 12 gold rays, warm glow |

Divisions show as three diamonds under the emblem (filled gold = earned). Lightning shows a numbered rank instead.
Must read clearly at 28 px in a standings row.

## Medals (`medal-*.svg`)

Gold, silver, bronze. No numbers. Navy and cyan ribbon, rim in gradient A, face in gradient B, an engraved laurel
ring of 12 leaves at 50 % ink, a raised centre disc and a bolt stamp. Sizes in use: 22, 36 and 64 px.

## Trophies (`trophy-*.svg`)

Progressively grander. Bronze cup (plain base) → silver (rim band, two-tier base) → gold (domed lid with a bolt
finial, laurel engraving, thicker handles) → Championship (much larger: crown of three bolts on the lid, wings on
the handles, rays and a glow behind, three-tier plinth with a CHAMPION plate).

## Badges (`badge-*.svg`)

Each has a gold ribbon banner. Tournament Winner (laurel wreath, star, hexagon with a cup, WINNER), Arena
Champion (crossed cyan and gold bolts in a gold hexagon, ARENA), 200 Club (angular slanted bolt-style "200",
rays, CLUB), Founding Player (bolt, FOUNDER banner, the player's number such as #0042, which is data).

## Captain Joulz (`captain-joulz-*.svg`)

Drawn in a 160 × 200 unit box, ground at y 190, figure facing the viewer (the run pose leans right). Joint
positions per pose are in `source/captain-poses.json` (neck, hip, shoulders, elbows, hands, hip joints, knees,
feet, lean).

| Part | Construction |
|---|---|
| Suit | `#141A2E`, outline `#06080F` |
| Limbs | Three stacked round-capped strokes along shoulder → elbow → hand and hip → knee → foot: outline `#06080F` at w + 7, gold at w + 4, suit at w. Arms w = 11, legs w = 12 |
| Torso | Trapezoid from shoulders (±3) to hips (±3), suit fill, 2.5 outline. Gold seams: a curve under the collar and two side lines |
| Chest | One large gold bolt (the bolt path at scale 0.5) centred on the chest |
| Belt | Gold band 8 high at the hips with a suit-coloured buckle outlined in gold |
| Helmet | Rounded helmet (about 40 wide, 42 tall) in suit with a 2.5 outline; gold cheek guards (3 px curves); cyan `#22E4FF` V-shaped visor with a white glint at 55 %; three straight cyan lines from the crown down to the visor at 32 % opacity, 1.3 px. No halo, no crest stripe |
| Gauntlets | Gold cuff, a trapezoid from 60 % to 86 % of the forearm, widening from 13 to 20; a darker band `#9A7A3A` across it. Hand: a 15 × 11 rounded palm (r 4) in suit with a gold 2 px edge, gold knuckle band, small bolt stamp, a thumb and four fingers fanning slightly (each finger a three-stroke line like the limbs, about 8–10 long) |
| Boots | Tall gold boots from 42 % of the shin to the foot (14 wide), a `#9A7A3A` cuff line, a rounded gold foot and a 3 px black sole |
| Cape | Gold metal polygon from the shoulders with a jagged lightning hem, 82 % of the original length, sheen at 45 %, an inner dark line at 35 %. Behind everything else. Streams back in the run pose and flares in the win pose |
| Draw order | cape, back arm and gauntlet, back leg and boot, torso, chest bolt, front leg and boot, front arm and gauntlet, helmet |
