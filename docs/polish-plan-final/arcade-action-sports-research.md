# Arcade look regressions (Action + Sports): research for the design-polish plan

HEAD = `774e5ddb` (main, 18 Nov 2026). Pre-overhaul = `82f2f648` (worktree `/home/user/old`). All paths relative to `/home/user/brain-blitz-duel` unless prefixed `old/`. Line numbers are HEAD's unless marked `old`.

Shared facts used below:

- **skins-default-check** (`scripts/skins-default-check.ts`, frames from `scripts/skins/frames.ts`) pins pixel digests for `pool`, `minigolf`, `curling`, `racing`, `freekick` (+ the card games). Base record `scripts/fixtures/skins-default-frames.json` (never re-recorded); redrawn-on-purpose record `scripts/fixtures/skins-default-frames-overhaul.json` holds `pool` (13 frames), `curling` (10), `racing` (5), re-recorded with `bun scripts/skins-default-check.ts --record-overhaul=<games>`. `minigolf` and `freekick` are still pinned to the *base* record: minigolf's frames are drawn on `MINIGOLF_REV_CLASSIC` (1) and `MINIGOLF_REV` (= 2, `src/lib/arcade/minigolf.ts:38`), never golfRev 3 (frames.ts:86–104), so golfRev-3-only art is free to change. Frames are drawn in Bun, where `Image` does not exist: every `sportsSprite()` / `sceneImage()` lookup returns null, so the Blender-rendered Captain arm (Cue Ball), race car (Apex) and golf Captain are **not in any stored digest** — removing those draw calls does not disturb skins-default-check.
- **Tiles** (`public/tiles/<id>.webp`, `bun scripts/shots/tile-scenes.ts <ids>`): swing's tile uses only `JUNGLE` + `drawJungleRope` (arcade2.tsx:17, 207); ricochet's uses `drawNinja(..., scale 1)` (arcade2.tsx:407); bastion's `paintBastionTile` (bastionTank.renderer.ts:2464–2485) calls `paintBackdrop` + `paintTank` with no outline/badge; skyline's uses `drawBlock` (arcade2.tsx:14, 119–131) → **re-export after a High Rise block change**; minigolf's uses `paintMinigolfTileV3` (sports.tsx:48); racing's `paintRacingIntro`; pool's `drawPool` (no image in Bun).
- **Intro stills**: Iron Wall, High Rise, Moon Climb, Grappler draw `ArtStill` from the live renderer (`src/puzzles/bastion.tsx:200`, `skyline.tsx:54`, `ricochet.tsx:324`); nothing stored. `public/intro/*.webp` holds only Strategy stills.
- **Intro demos** are input logs on fixed seeds: display changes never touch them. Stop rules: `ACTION_DEMO_REVS` (`src/lib/duel/introDemo.functions.ts:92–99`: swing `SWING_REV_BIG`, ricochet `MOON_BIG_REV`, bastion `BASTION_REV_DEALT`, skyline `SKYLINE_REV_LIVES`), fixture `scripts/fixtures/action-demos.json`; Crazy Golf `scripts/fixtures/crazy-golf-demos.json` on golfRev 3 (`crazy-golf-demos-check.ts:33`); Top Bins `sportsDemoRules.ts:12` plays only `FREEKICK_REV_DEALT` Normal. A **new stamp** on any of these games stops its demo until re-recorded.
- **art-check** (`scripts/art-check.tsx`, fixture `scripts/fixtures/hero-bounds-main.json`: keys `grappler-cave-*`, `grappler-jungle-*`, `ninja-p*-f*-t*`) holds each game's hero pose extent to main's figure; section 4a (lines 196–215) holds Moon Climb's ricoRev 4 figure to main × `ninjaArtScale(4)` = 17/13.

---

## 1. Iron Wall (`bastion`)

### Files and commits
`src/lib/arcade/bastionTank.renderer.ts` (2,525 lines), `bastionLook.ts`, `bastionView.ts`, sim `bastionTank.ts`. Commits since 82f2f648: `b46f16db` (merge, Action overhaul stage 1: **introduced the far-tank outline and S/M/H badges**), `e6e0c74c` (materials pass: painted-metal tanks), `dfd5a620` (stage 2: effects, end card, run picture), `f9ec8aa1` (bastionRev 4 levels), `02f44a37` (bigger weak spots inside the tank). At 82f2f648 the renderer has **no** `paintTankOutline`, `BT_FAR_MARK_Z`, `BT_BADGES` or `paintTankBadge` (grep empty).

### (b) What draws the white outline
- `BT_FAR_MARK_Z = 620` (:947), `bastionFarMark(z256)` (:954–956: 0 near, 1 from 620 px, fading in over 200 px).
- `paintTankOutline(ctx, kind, lane, z)` (:959–981): `strokeStyle rgba(255,246,226, 0.75·k)`, `lineWidth 1.1`, a closed path round the hull + turret rectangles from `bastionTankRects`.
- `paintTankBadge` (:997–1017) and `bastionBadgeBox` (:984–994): the S/M/H chip (`BT_BADGES` :941–945, `BT_BADGE_W/H/FONT` 16/15/11 :949–951) drawn in view px above the pips.
- Called from `drawBastionWorld` (:1986): `paintTankOutline` at :2009 (inside the tank's view transform) and `paintTankBadge` at :2011.
- Not the outline but near it: the health pips (:1125–1144) are orange on a dark back (`BT2_PIP_FILL/BACK` :135–137), unchanged from old; the painted-metal lit edge (`rgba(255,248,226,0.42)` strip at :1072) is from the materials pass.

### (b) Scenery / where to add ruins
- `BT_SCENERY` (:556–579): 22 lane-edge items `[side, out, z, kind]`, kinds `rock | wall | scrub | trap | wreck` (type at :555), `out ≥ 214` px from the vanishing point at scale 1 so nothing covers a lane (comment :550–554). Identical to `old/…:191–214`.
- `paintScenery` (:582–601) places each at `x = BT2_VP_X + side·out·s`, `y = HY + (BT2_WALL_Y − HY)·s` with `s = btViewS(bastionScale256(z·256)/256)`; painters `paintRock` :649, `paintBrokenWall` :676, `paintScrub` :717, `paintTankTrap` :736, `paintWreck` :760 (+ `paintWreckPlume` :489 in the storm).
- Ruined buildings already exist **only on the skyline**: `paintRuins` (:604–647, a 360 px repeating pattern of broken silhouettes at the horizon `HY`, windows), skipped in the desert setting (`if (setting !== 1)` :584).
- Layout (`bastionView.ts`): view horizon `BT_VIEW_HORIZON = 190` (sim 250, sky shifted up `BT_VIEW_SKY_SHIFT` 60), field from `HY` to `BT2_WALL_Y`, depth scale `s^P` (`btViewS`); backdrop painted once per setting (`paintBackdrop` :166–222, three settings `BT_SETTING_LOOK` :159–163, `paintScenery` called at :218 before the haze and `paintWall`).

### (c) What a change disturbs
- `scripts/bastion-overhaul-check.ts` section 2 (:187–246) **asserts the outline and badges exist**: one stroke per far tank, badges S/M/H ≥ 10 px, none on near tanks, lane badges never overlapping, a live frame's badges = its far tanks. Removing the outline needs that section rewritten (Joe's approval line).
- Text naming badges: `src/lib/duel/instructions.ts:1749` ("Far tanks wear a badge: S Scout, M Medium, H Heavy.") and the intro caption `src/puzzles/bastion.tsx:209` — update if the badges go too; intro-score-text-check reads help text.
- Scenery: `iron-wall-view-check` proves the view warp only; nothing pins `BT_SCENERY`'s contents. Tile and still draw from the live renderer (tile paints no scenery items but calls `paintBackdrop`, so new roadside ruins would appear on the tile → re-export `bastion`).

### (d) Recipe (display only, no stamp: the sim never reads any of this)
1. Outline: delete the `paintTankOutline(...)` call at :2009 (keep or delete the function; `bastionFarMark` stays if badges stay). If Joe wants the badges kept, leave :2011. Then rewrite bastion-overhaul-check section 2 (:217–233) to assert *no* outline strokes.
2. Ruined buildings beside the road: add a kind `"ruin"` to `SceneryKind` (:555) and entries to `BT_SCENERY` (:556–579) with `out ≥ 214` (e.g. `[-1, 240, 160, "ruin"]`, `[1, 250, 520, "ruin"]`, `[-1, 300, 880, "ruin"]`…), a `paintRuinBuilding(ctx, x, y, s, side)` beside `paintBrokenWall` (:676) drawn with the same depth scale `s` (walls of `#30363F`-ish stone, a broken top like `paintRuins`' `broken` modes, dark windows, a scorch), and the dispatch in `paintScenery` (:591–599). Keep every piece on the field side of the road edge (the road's half-width at the wall is 192 px, outer hulls end 175 px out). Re-export the tile.

---

## 2. Grappler (`swing`): "the rings are too thick"

### Files and commits
`src/lib/arcade/swingJungle.renderer.ts` (849 lines; old 572), ring art in `src/lib/arcade/swingJungleArt.renderer.ts` (new since the materials pass). Commits: `a7a73359` (materials pass: "enamel grab rings"), `d66435d7` (stage 2: "target-ring hooks", loop 14 px, swingRev 18), `67f318e4`, `8f2ca351`, `53efc938`, `134e8c29`.

### (b) HEAD
- `JUNGLE_LOOP_R = 14` (swingJungle.renderer.ts:727; comment: 10 before the overhaul, 12 in stage 1, 14 in stage 2).
- `drawJungleGrabPoints` (:736–787): vine rope via `strokeVineRope(…, 1.2)` (:752–755), then `drawGrabRing(ctx, x, y, R, flash)` (:765); the miss tint redraws the ring at `lineWidth 6` (:777–780).
- `paintGrabRing` (swingJungleArt.renderer.ts:388–463) is the thickness: dark pad disc to `R + 7` (:390–397), contact shadow `lineWidth 7` (:400–403), dark well `R − 2` (:405–411), **heavy rim `lineWidth 8.6`** (:413–417), **enamel band `lineWidth 5.8`** (:418–432), inner edge 0.9 (:434–438), bullseye ring `lineWidth 2` at `R·0.32` (:440–445), specular 1.6 (:447–452), three lime bindings 1.8 (:454–462). `drawGrabRing` (:465–482) caches it as a sprite keyed by `R|gold|scale`.
- The river reflects the rings at `JUNGLE_LOOP_R·1.6` wide (swingJungle.renderer.ts:445–470, line 461).

### (b) 82f2f648
`old/src/lib/arcade/swingJungle.renderer.ts:454–509` `drawJungleGrabPoints`: vine `lineWidth 4` dark + `2` light with leaf ellipses (:470–488); glow `drawJungleGlow(… 28 px, "rgba(255,236,140,0.7)" …)` unless lite (:491–494); loop **radius 10**, dark ring `lineWidth 5.5` (6 on flash) `#2E4A16` (:495–499), light ring `lineWidth 3` (3.4) `#CDEB7A` (:500–504), gold knot dot r 4 at the top (:505–509). No pad, no shadow, no bullseye.

### (c) Disturbed by a change
- `scripts/swing-overhaul-check.ts:213` (`JUNGLE_LOOP_R >= 12`) and :437 (`JUNGLE_LOOP_R === 14`), :441–455 (paints `paintGrabRing(x, 40, 40, 14, false)` and requires the cream band at radius 14 vs the pad at radius 20 ≥ 7:1 contrast) — any thinner ring or smaller R needs these three assertions changed (routine, Joe's approval line).
- Nothing else: hero bounds, deals, swingRev 18 and the tile are unaffected; the intro demo (action-demos.json, swingRev 18) is an input log.

### (d) Recipe (display only, no stamp: "a grab is by reach", the sim reads `JUNGLE_LOOP_R` nowhere)
Either (i) thin the ring in place: `paintGrabRing` rim 8.6 → ~5, band 5.8 → ~3, pad radius `R + 7` → `R + 3` or drop it, shadow 7 → 3, and `JUNGLE_LOOP_R` 14 → 10–12; or (ii) restore the 82f2f648 loop verbatim (old :489–509) inside `drawJungleGrabPoints` in place of the `drawGrabRing` call at :765, keeping the HEAD vine rope. Then update swing-overhaul-check :213/:437/:443 and the river reflection width (:461) follows `JUNGLE_LOOP_R` automatically.

---

## 3. Moon Climb (`ricochet`)

### Files and commits
`src/lib/arcade/ricochetNinja.renderer.ts` (2,171 lines; old 1,0xx), `ricochetNinjaScene.renderer.ts` (43 lines; the play-screen fill only: slate walls/floor, **no stars or lanterns**), sim `ricochetNinja.ts`. Commits: `6f5e3d57` (stage 1 look), `5438c963` (materials), `9b28c5f7` (stage 2 look pass + **ricoRev 4, the bigger ninja**), `2eee263f` (effects, run picture), `53efc938` (levels).

### (b) Stars and lanterns at HEAD (all in ricochetNinja.renderer.ts)
- Sky painted once per size, `paintMoonSky` (:183–224): star-dust band with **140** fine stars (:199–205) + **170** stars (:207–223, `drawStar` :226 for the bright ones).
- Per frame, `drawMoonNight` (:472–528): **46 more** stars coming out with the night (:490–501), the moon, wisps, mist, and the **far paper lanterns**: `FAR_LANTERNS` (:435–439, 6 of them), `farLanternAt` (:440–445), `drawFarLantern` (:448–469), drawn at :523–527. These are **decorative only** ("display only, never touched"). The real pickups are the six seeded sky lanterns of ricoRev 3+ (`drawSkyLantern` :1186, positions from the sim's `lanternAt`, ridden on `MODE_RIDE`); don't confuse the two.
- At 82f2f648: sky had **70** stars (`old/…:90`) + **80** stars (`old/…:142`); no far lanterns (`FAR_LANTERN` absent).

### (b) The ninja's size
- Sim: `NINJA_HW/HH = 13/26` (ricochetNinja.ts:43–44), `NINJA_BODY` (:65); `MOON_BIG_REV = 4`, `MOON_BIG_HW/HH = 17/34` (:834–837), `ninjaBodyFor(rev)` (:843–845: MOON_BIG_BODY for rev ≥ 4, NINJA_BODY before). Everything reads the body through it (cling x, floor height, leap, ledges, hazards, `moonBuildDeal` witness proof, cache key :1477, `MOON_LEVELS` gated `rev >= MOON_BIG_REV` :885).
- Renderer: `ninjaArtScale(rev) = ninjaBodyFor(rev).hw / NINJA_HW` (:1298–1300, 17/13 on rev 4); `drawNinja(…, scale)` (:1381, `ctx.scale(scale, scale)` :1386), called with `ninjaArtScale(s.rev)` at :1919. The moonlit backing ellipse is drawn inside `NINJA_HW+1 × NINJA_HH+1` (:1390–1395) before scaling.

### (c) Disturbed by a change
- Stars/lanterns: `scripts/ricochet-overhaul-check.ts` look b (:510–523) asserts `FAR_LANTERN_COUNT >= 4`, placed by tick, inside the shaft, each ≤ half a sky lantern. No check counts stars. Changing counts is display only; update look b if the far lanterns go.
- Hero size: `ricochet-overhaul-check` 9 (:387–423: rooms deal ricoRev 4, body 34×68, towers proved with the big body) and 10e (:543–567: `ninjaArtScale(4) === 17/13`, the big figure ≥ 1.25× the small one's ink); `art-check.tsx` 4a (:196–215); `ricochet-levels-check` (built on `MOON_BIG_REV`); legacy fixtures `scripts/fixtures/ricochet-big-legacy.json` (rev 3, recorded on 14ce058d, never re-record) and `moon-blockzone-legacy.json`; `LIVE_BANDS.ricochet` / `ARCADE_STANDARD.ricochet` specs (`MOON_BIG_STD_SPEC` :839); `ACTION_DEMO_REVS.ricochet = MOON_BIG_REV`; bots `scripts/arcade-skill-bands/bots/ricochet.ts` (`moonBot`), `bun scripts/ninja-bands.ts --rev=…`; `scripts/ricochet-big-legacy-record.ts` is the pattern for recording a legacy fixture before a new stamp.

### (d) Recipes
- Fewer stars / lanterns: **display only**. Cut the loop counts at :199 (140), :207 (170), :490 (46) back toward the old 70 + 80, and either delete the far-lantern loop at :523–527 (then drop look b in ricochet-overhaul-check :510–523) or reduce `FAR_LANTERNS` to 4 (the check's minimum).
- Smaller ninja, two options:
  - **A. Draw smaller inside the 34×68 box** (e.g. `ninjaArtScale(4)` → 1): display only, but it **breaks rule 3** (art within 2 px of the sim's collision bounds: a 26×52 figure in a 34×68 box leaves 4 px / 8 px of invisible hit area) and fails art-check 4a and ricochet-overhaul-check 10e as written. Not recommended.
  - **B. New stamp `ricoRev 5` with a smaller body** (the compliant route): add e.g. `MOON_V5_HW/HH` (or simply return `NINJA_BODY` for rev 5) in `ninjaBodyFor` (:843–845) and `ninjaArtScale` follows; `moonDeal`/`moonBuildDeal` builds and proves every tower in the sim with that body (no bank), so towers re-prove automatically but differ from rev 4's; `MOON_LEVELS` keeps working (gate is `>= MOON_BIG_REV`); bump the dealt stamp in `generateRicochet`, LIVE_BANDS/ARCADE_STANDARD spec `rev`, `ACTION_DEMO_REVS.ricochet` (demo stopped until re-recorded on 5), record a rev-4 legacy fixture with a copy of `ricochet-big-legacy-record.ts`, extend ricochet-overhaul-check 9/10e and art-check 4a for rev 5, re-run `ninja-bands.ts --rev=5` for the bands (height part "full at 245 m" may need re-measuring if the body changes reach). Gameplay change: rev 4 rounds replay exactly as before via `ninjaBodyFor(4)`.

---

## 4. High Rise (`skyline`): old colours vs the glass look

### Files and commits
`src/lib/arcade/skyline.renderer.ts` (1,750 lines; old 1,020). Commits: `82db6f97` (skylineRev 11 lives, **dusk-to-night city, plaza, edge to edge**), `eaeff80f` (materials: **glass curtain-wall floors**, steel jib, still city, harbour), `2ce36f52` (effects, run picture), `d482b39b`, `ee6435d0` (levels).

### (b) HEAD
- `drawBlock(ctx, x, top, w, h, index, age, night)` (:389–462): glass gradient `#2C4166 / #18294A / #0E1A31` (:392–396), 11 px panes with lit windows (`#FFD993` warm / `#C8DCFF` cool) by `night` (:406–425), mullions `#7D90AA` (:427–431), gold spandrel band (:434–440), slab line `#08101F` (:442), lit/shaded edges (:445–448), the fixed glass highlight at `SKYLINE_WORLD_W·0.43` (:450–461). Called at :763 (placed floors), :799 (hanging floor), :830 (chunks), :1456.
- The old palette constants survive unused by the floors: `GLASS[]` :39, `STEEL` :40, `STEEL_LIGHT` :41, `WINDOW_LIGHT` :42, `GROUND` :44 (used by the NEXT panel :1507–1509 and the tile).
- Backdrop: `SKY_TOP/MID/LOW` :118–120, `paintNight` :121, `paintDusk` :192–, `skylineNightStep/Share` :243–253, `paintCity` :310–375 (concept A's three layers), `drawCityBand` :278, `drawPlaza` :892–, `QUAY` :940.

### (b) 82f2f648 (`old/src/lib/arcade/skyline.renderer.ts`)
- `drawBlock(ctx, x, top, w, h, index, age)` (:233–273): `STEEL` fill, `GLASS[index % 8]` panes 16 px wide with `PANE_GLOW` (:43 `rgba(216,243,255,0.18)`) and a 28 % white left highlight, `STEEL_LIGHT` 2 px top, shading (:248–252), warm `WINDOW_LIGHT`/`#FFE3A3` windows fading in over 20 ticks on placed floors (:255–272).
- Old backdrop: `BACKDROP` tower list :167–170, `paintSkylines` :178–216 (`TOWER_DARK` :40 `#131D2C`, indigo far towers `#1E2150`), `drawBackdrop` :217–232 with parallax.

### (c) Disturbed by a change
- `scripts/skyline-overhaul-check.ts:286–291` greps the renderer's **source** for `drawPlaza(`, `paintCity(`, `paintDusk(`, `drawCityBand(ctx, rect.x`, `drawJib(ctx, rect.x`, `drawPlaza(ctx, worldH - GROUND_LIFT`, `function drawBackdrop(ctx: CanvasRenderingContext2D, worldH: number` and `!drawEdgeRamps`, plus `label: "LIVES"` (:288). Restoring the **block colours** only is safe; bringing back the old parallax city would fail :287–291.
- Tile scene `scripts/shots/tile-scenes/arcade2.tsx:119–131` calls `drawBlock(c, x, y, w, H, i, 100)` → re-run `bun scripts/shots/tile-scenes.ts skyline` and `bun scripts/reveal-palette.ts`. Intro still is live art. Demo unaffected.

### (d) Recipe (display only, no stamp)
Replace the body of `drawBlock` (:389–462) with old :233–273's drawing (keep the HEAD signature with `night`; use `night` only for the window-light alpha if wanted), keeping the HEAD constants `GLASS/STEEL/STEEL_LIGHT/WINDOW_LIGHT` and re-adding `PANE_GLOW`. Optionally soften the concept-A city palette in `paintCity` (:310–375) toward the old `#1E2150`/`#131D2C` indigo without changing function names. Re-export the tile.

---

## 5. Crazy Golf (`minigolf`)

### Files and commits
Sim `src/lib/arcade/minigolf.ts` (1,732; old 1,274), art `minigolf.renderer.ts` (3,008; old 1,554), `minigolfV3Ground.renderer.ts` (new), stage `src/puzzles/minigolf.tsx` (253; old 216), skins `src/lib/arcade/skins/minigolf.skins.ts`, `minigolfCourse.ts`. Commits (all on #443 in the arcade train): `2d7973e6` (golfRev 3 sim, hole catalogue, oracle, deal), `ed84445a` (golfRev 3 art, Putt/Chip switch, reveal), `bab8903d` (360-hole proven bank), `f1cff704` (lit materials), `cd29f9f0` (round 2: crazy-golf layouts, loops, bridges, bowls, **bigger Captain**), `fd2d0047`, `0af3480e` (round 3: solid windmill houses and **castles**, 3+ big features a hole, **lit Captain with a backswing**), `f1a4277d` (357 holes re-proven, **castle art**, demo fixture), `9825abac`, `e1a09546`, `da69551b` (sounds). The Blender course redraw `e0aa53f2` (#423, 13 Nov, *before* the train) is separate: `skins/minigolfCourse.ts` behind the switch `default.crazy-golf.course` in `src/config/cosmeticRedraws.ts:101` (**true** at HEAD; turf/paving/stone/sand/boulders/planters/shrubs from `public/cosmetics/redrawn/mg.*.webp`, drawn in `paintMinigolfHole` :1305–1325 when `art` is loaded).

### Stamps and input
- `MINIGOLF_REV = 2` (minigolf.ts:38), `MINIGOLF_REV_COURSE = 3` (:61); rooms deal golfRev 3 (`src/lib/duel/sports.server.ts:105–114`).
- Input kinds: `MG_INPUT_PUTT = 1` (:271), **new `MG_INPUT_CHIP = 2`** (:275), `MINIGOLF_INPUT_RANGES_V3` (:276–279); the sim reads a chip only on rev ≥ 3 (:1538–1552). The input *encoding* of a putt (a, b = direction ×4000, c = power 1…1000) is unchanged.
- Stage finger mapping is **unchanged**: `FULL_PULL 150 / MIN_PULL 12` (minigolf.tsx:39–40 = old :34–35), `pullOf` (:107–116 = old :83–91, pull back from the touch-down point, putt the other way), `pointer` (:137–152 = old :94–115). New: `shotPayload` picks PUTT/CHIP by `chipRef` (:130–135), the `Segmented` Putt | Chip control (:208–222), a rising aim tone (:118–129), desktop `C` key.

### (b) What "the new aiming" is: the drawing
- golfRev 1–2 still draw `drawAim` (minigolf.renderer.ts:1760–1798: a **dotted aim line ahead of the ball, length 24 + power·150**, a short gold pull handle behind, a **power % pill**), called at :1741.
- golfRev 3 draws `drawAimV3` (:2271–2340+, called from `drawCourseV3` at :2252): a **rubber band** from either side of the ball to the finger (:2276–2297), then the level's preview — a chip's arc with the landing ring (:2303–2320), Easy's rolled line to the first bounce on a sim copy (`mgRollTickV3`, :2321–2340+), Normal the full line, Hard 35 %, Expert 20 % (`MG_LEVELS[*].preview`, docs table).
- So "go back to the old aiming system" = draw the old dotted line + power pill on golfRev 3. **Display only.** Recipe: in `drawCourseV3` (:2252) call `drawAim(ctx, bx, by, aim)` (it is still in the file) instead of `drawAimV3`, or keep `drawAimV3` only for the chip arc. If Joe also means the **Chip** shot itself: removing the Chip control is input-only (the sim keeps accepting kind 2, old logs replay) but the proven hole bank was proved with chips (bunkers, water, bowls; `crazy-golf-v3-check.ts:97–102` requires ≥ 2 big features a layout) — holes that need a chip to score would then be unreachable → that is a **gameplay change needing golfRev 4** with a re-proved bank (`scripts/minigolf-holes-bank.ts`, `minigolf-oracle.ts`, `crazy-golf-levels.ts`).

### (b) Captain Joulz (size and view)
- `MG_CAPTAIN_PX = 120` (:1972) is the sprite's world size; `CAPTAIN_BALL = {152, 198}` (:1973) is the ball's point in the 256 px sprite and scales with `k = MG_CAPTAIN_PX / 256`, so halving the size keeps him on the ball. `drawCaptain` (:2059–2071), poses `address | back | putt | chipback | chip` (:2053), images `mg.captain-<pose>` via `sceneImage` (`gameArt.renderer.ts:8` `CAPTAIN_IMAGES`; files `public/cosmetics/redrawn/mg.captain-*.webp`), rendered by `docs/design/cosmetics-redraws/blender/captain/golf_sprites.py` (camera **tip 38°**, line 145; 256 px square, line 11). Drawn in `drawCourseV3` :2090–2107 (address while aiming, backswing past 15 % power, follow-through `CAPTAIN_HOLD` 70 ticks).
- At 82f2f648 there was no Captain on the course at all (old renderer has no `drawCaptain`; the intro still at old :1519 mentions only the ball and dotted aim).
- **50 % smaller**: `MG_CAPTAIN_PX` 120 → 60 (display only; the docs say he was lit "so he reads at 120 px", so a re-render with bolder lighting may be wanted). "The Captain view": `docs/arcade-standard/minigolf.md:274–275` already lists Joe's note "Captain Joulz in a slightly more upright three-quarter view (golf_sprites.py: the camera's tip, now 38°)" → re-render the five sprites with a smaller `tip` (e.g. 25–30°) and re-run `bun scripts/shots/tile-scenes.ts minigolf` if the tile shows him (`paintMinigolfTileV3` :1918 draws `drawCaptain(c, 118, 186, …)`).

### (b) Castles
- Art: `paintCastleV3` (:2515–) draws curtain walls, round towers with slate roofs, the gatehouse arch and keep **on the sim's own gate segments and tower circles**; dispatched from `paintMinigolfHole` :1312–1321 (`g.kind === "castle"` vs `paintMillHouseV3`), wall pieces `paintWallPiece(…, "castle" | "mill")` :803–. Docs :274: "Castles should read more clearly as castles from above."
- Geometry is gameplay: gates `kind: "castle" | "mill"` live in the sim's hole templates (minigolf.ts:490, :811, e.g. :907) and the proven bank. Redrawing castles (or drawing them as something else) is display only; removing or moving them = new hole bank = **golfRev 4**.

### (c) Disturbed by a change
- skins-default-check: minigolf is pinned on golfRev 1–2 only → golfRev 3 art is free. `skins-check` (minigolf.skins.ts looks, drawn through `drawCourseLooked`), `cosmetic-redraws-check` (the course redraw switch), `crazy-golf-v3-check` (hole rules, no aim/Captain pixel assertions: grep for `MG_CAPTAIN_PX`, `drawAim`, `rubber`, `Captain` in `scripts/*-check*` finds nothing), `crazy-golf-demos-check` (input log on golfRev 3 Normal), `minigolf-check`, `arcade-standard-check` entry. Tile `public/tiles/minigolf.webp` → re-export after a look change.

---

## 6. Cue Ball (`pool`): remove the Captain's arm

### Files and commits
`src/lib/arcade/pool.renderer.ts`; asset `public/sports/pool/arm.webp` (+ `table.webp`), anchors in `src/lib/arcade/sportsSprites.data.ts` (`SPORTS_SPRITES.pool.arm`, from `docs/design/game-art/sports/render_sports.py`). Commits: `854a5a3b` (stage 1: concept C table, **the Captain's cue arm**), `507c4497`, `aa16fc50`, `b76cdd4c`, `2f6c6a4e`. No arm at 82f2f648 (no `sportsCaptain.renderer.ts` there either).

### (b) Code
- Section "The Captain's arm" :874–928: `POOL_ARM_GRIP` (:879, 0.85·`CUE_LEN`), `POOL_ARM_LEN = 104` (:880), `POOL_ARM_TURN = 0.48` (:882), `ARM` anchors (:884), `poolArmPlacement(cx, cy, ux, uy, pull)` (:890–903), `drawCaptainArm` (:909–928: `sportsSprite("pool", "arm", true)`, `if (!img) return`, shadow stroke, rotated/scaled `drawImage`).
- Call sites: :1074 (the strike's follow-through, with `drawCueStick` at :1073) and :1495 (aiming, with `drawCueStick` at :1494). Preloads: `src/puzzles/pool.tsx:76, 245` (`preloadSportsSprites("pool", ["arm"], true)`).

### (c) Disturbed
- `scripts/pool-overhaul-check.ts` section 1 (:4–6, :50–70) exercises `poolArmPlacement` geometry (never over the cue ball) — keep the exported function or delete that section.
- `scripts/sports-sprites-check.ts:47, 93–96` expects `pool/arm.webp` to exist and load — keep the file (harmless, ~KB) or update the list.
- skins-default-check overhaul record for pool (13 frames): drawn in Bun with no `Image`, `drawCaptainArm` returns at :911 before any pixel → removing both calls leaves the digests **unchanged**. Tile `pool` likewise (sports.tsx:50–57).

### (d) Recipe (display only)
Delete the two `drawCaptainArm(...)` calls (:1074, :1495) and the preloads; optionally delete :874–928 and the asset, with pool-overhaul-check section 1 and sports-sprites-check's `pool: ["arm", "table"]` updated.

---

## 7. Top Bins (`freekick`)

### Files and commits
`src/lib/arcade/sportsCaptain.renderer.ts` (69 lines, new in `a54f8475`), `freekick.renderer.ts`, `freekickStroke.ts` (new), sim `freekick.ts`, stage `src/puzzles/freekick.tsx`. Commits: `a3d44a77` (freekickRev 5 sims/levels/deals), `a54f8475` (controls, art), `ddea2fd1`, `72b7b38f`, `36c00f0f`, `f5511a0a`, `820494cb` (freekickRev 6).

### (b) "Captain Joulz has no neck"
- `paintKicker` (sportsCaptain.renderer.ts:16–69) sets the hero's joints then `drawHero(ctx, p)` (:68). Head/neck constants: `headR = 0.085·h` (:28), `neckY = feetY − 0.78·h` (:30), `headY = neckY − 0.12·h` (:32), `shoulderY = neckY + 0.04·h` (:36); `h = 0.95·q.s` from `freekick.renderer.ts:1413` (call :1418).
- `drawHero` → `retarget` (`hero.renderer.ts:897–995`): torso `T = |hip − neck|` = 0.32h, `k = T/50`; shoulders are put 8k below the neck (:920–924); the helmet is drawn at `headScale = headR / 21.25 / kw` (:962) with the approved path spanning `hy − 22 … hy + 20` art units (`helmet` :585–600), i.e. its chin reaches ~0.94·headR = 0.08h below the head centre → 0.04h above the neck joint, while the chest plate's collar (`torso` :506, collar seam :524) rises to the neck joint and the shoulders sit 0.05h below it. In the approved art the head centre is only 17 units above the neck (`:197–198`, `:1217–1218`) with the chin 20 below it, so the approved Captain's helmet overlaps the collar by design; the kicker keeps near that ratio (0.12h ≈ 17k = 0.109h) so the helmet sits on the collar with no visible neck.
- At 82f2f648 there was no kicker figure. Nothing in `scripts/` references `paintKicker` or `sportsCaptain` (grep empty); `freekick` is pinned by skins-default-check on the *base* record but those frames were drawn before rev 5 existed and the kicker draws only on `v5` rounds (`freekick.renderer.ts:1411`) — check `scripts/skins/frames.ts`'s freekick revisions before relying on this.
- **Recipe (display only)**: raise the head: `headY = neckY − 0.17·h` (or more) and/or `headR` 0.085 → 0.075, keeping `shoulderY`; or draw a short neck segment by setting `shoulderY = neckY + 0.07·h`. Verify with `bun scripts/shots/capture.ts freekick --phases=play`.

### (b) "Most shots dip when they should curl"
- The phone classifies the drawn stroke into the SHOT's `d` (`src/puzzles/freekick.tsx:52` imports `strikeFromStroke`); the sim only reads `d` (`freekick.ts:851` `f.st === FK_STRIKE_DIP`, `:790–795` dip drop `FK_DIP_DROP`).
- `src/lib/arcade/freekickStroke.ts`: `FLICK_SHARE = 0.2`, `FLICK_TURN_DEG = 35`, `FLICK_MIN_PX = 14`, `DRIVE_CURL = 22` (:12–15); `strokeFlicks(pts)` (:27–49) takes the point `m` at 80 % of the stroke's length and compares the direction of chord `s→m` with the direction of the tail `m→e`; ≥ 35° → **dip**; `strikeFromStroke` (:51–54): flick → DIP, else `|curl| < 22` → DRIVE, else CURL.
- Why a smooth curve reads as a flick: for a circular arc with total turning θ, the chord of the first 80 % points at ≈ 0.4θ and the last 20 % at ≈ 0.9θ, so the test sees ≈ 0.5θ. The curl is the stroke's bow (`freekickStrokeKick`, freekick.tsx:175–181: `BOW_FULL = 0.25` of the chord = full ±100 curl). A quarter-chord bow is an arc of ≈ 106° total turning → the flick test sees ≈ 53° ≥ 35° → **DIP**; even a bow of ⅛ chord (curl ≈ 50, which is barely a "curler" — `FK_V4_BENT` 70 is the curl bonus line) gives ≈ 28°, so every stroke bent hard enough to be worth drawing is read as a dip. `freekick-layered-check.ts:210–218` only tests a gentle 4-point `bent` stroke (bow ≈ 8 % of chord) and a right-angle flick, so the band between never fails a check.
- **Recipe (input mapping only, no stamp: the sim never sees the stroke, and stored logs carry `d`)**: make the flick test relative to the stroke's own curvature, e.g. compare the tail's direction with the tangent at `m` (the direction of the segment ending at `m`) instead of the chord from `s`, or require the tail's turn to exceed `FLICK_TURN_DEG` *plus* the turn expected from the bow (`atan2(bow, chord)·…`), or raise `FLICK_TURN_DEG` to ~60 and `FLICK_MIN_PX` to ~24 and cap `FLICK_SHARE` at 0.15. Add a bowed-arc case to freekick-layered-check section 7 (:210–218) asserting CURL. Bots/oracle choose `d` directly (`freekick-oracle.ts:632`), so bands and the proved deals are untouched. A sim-side change (e.g. dip drop `FK_DIP_DROP` :150) would instead be **freekickRev 7**.

### (c) Sports skins for Top Bins
`src/lib/arcade/skins/freekick.skins.ts`; skins-default-check pins freekick on the base record (frames drawn at the revisions listed in `scripts/skins/frames.ts`; the kicker only draws on rev 5+ so check which revisions the frames cover before changing `paintKicker`; the stroke classifier touches no frame).

---

## 8. Apex (`racing`): "less 3D on the cars; the car turns the wrong way"

### Files and commits
`src/lib/arcade/racing.renderer.ts`, **`racingCar.renderer.ts` (new)**, assets `public/sports/racing/{car,brake,mask}-{0..6}.webp` + `SPORTS_SPRITES.racing` (sportsSprites.data.ts:66–); render script `docs/design/game-art/sports/render_sports.py:285–346`. Commits: `59e7e1a7` (racingRev 4 circuits), **`f68ec7d6` (the rendered car with Captain Joulz, closer chase camera)**, `9bc96b2c` (dusk), `c18bc201`, `ead617f3`, `553c700e`, `2f6c6a4e`.

### (b) The car drawing at HEAD (racing.renderer.ts:1395–1475)
- `steerShare = wheel / RACING_STICK_MAX` (:1423; the sim's `a` steer is "right positive", racing.ts:11), `yaw = clamp(steerShare·(0.35 + 0.65·min(1, speedShare·1.6)))` (:1424).
- **New**: `drawRacingCarSprite(ctx, { cx, contactY, width: carW, yawDeg: yaw·RACING_CAR_TURN_MAX·180/π, braking, paint })` (:1445–1452) → `racingCarFrameFor(yawDeg)` ("positive = turning right", racingCar.renderer.ts:31–37) picks the nearest of seven frames at −5, −3.3, −1.7, 0, 1.7, 3.3, 5° (`RACING_CAR_FRAMES` from `SPORTS_SPRITES.racing.frames`), placed at the collision width (`racingCarPlacement` :40–47).
- **Fallback (= the 82f2f648 look)**: `if (!rendered)` (:1453–1470): the painted car / skin sprite, one shape rotated `ctx.rotate(yaw·RACING_CAR_TURN_MAX)` (:1462) about its centre with `racingCarTurnFit` — byte for byte `old/…racing.renderer.ts:1094–1112`.

### (b) The wrong-way turn: sign analysis
- Blender (`render_sports.py:306–314`): camera at (0, −9.5, 3.1) looking at +y (screen right = +x); each yaw turns the car about world +z by `+yaw` → the nose (+y) swings toward −x, i.e. **screen left**, for positive yaw. The packed frame boxes confirm it: yaw −5 spans x 2…403, yaw +5 spans 63…464 (the near tail swings right as the nose goes left); viewing `public/sports/racing/car-6.webp` (+5°) shows the **left** flank and `car-0.webp` (−5°) the **right** flank.
- The game feeds `yawDeg > 0` when steering **right** → frame +5 → nose drawn turning **left**. The sprite is mirrored against the steer. The old painted path rotates clockwise for a right steer (nose right), which is why the bug arrived with the rendered car.
- **Recipe (display only)**: negate the sign at one place — `yawDeg: -(yaw * RACING_CAR_TURN_MAX * 180) / Math.PI` at racing.renderer.ts:1449 (also the ghosts' call at :1368 passes 0, unaffected), or flip the sign in `racingCarFrameFor`, or re-render with `-yaw` in render_sports.py:309 and repack. Fix the comment at racingCar.renderer.ts:31/107.
- "Less 3D": the rendered car is only the sprite path; to return to the flat car, skip `drawRacingCarSprite` (:1445) so the painted/skin car (:1453–1470) always draws, or soften the render (lower `coat`, flatter lights in `render_sports.py:293–298`) and repack with `python render_sports.py racing` (Blender; bbox data goes into `sportsSprites.data.ts`).

### (c) Disturbed
- `scripts/apex-overhaul-check.ts` section 1 (:3–4, :66–108): 21 sprites exist, 7 yaws with the middle straight, each drawn at the collision width, `drawRacingCarSprite` returns false without images. A sign flip passes untouched; removing the sprites would need section 1 rewritten; keeping the files but not calling the sprite passes.
- skins-default-check overhaul record for racing (5 frames): drawn in Bun → `drawRacingCarSprite` returns false → the painted car is what the digests hold → a sign flip or dropping the sprite leaves them **unchanged**. `skins/racing.skins.ts` paints (`racingCarPaint`) apply to both paths (mask layer on the sprite, `L.car` sprites on the painted path). `racing-render-check` compares frames with/without the grass saving (both paths equal). Tile `racing` uses `paintRacingIntro` (sports.tsx:39–41) with `RACING_CAR_SPRITE_NAMES` listed — check `paintRacingIntro` before dropping the sprites. Intro demo rule unaffected.

---

## Sports skins summary (what pins frames, what to re-record)

| Game | skins file | skins-default-check record | Effect of the asked change |
|---|---|---|---|
| Crazy Golf | `skins/minigolf.skins.ts`, `minigolfCourse.ts` | base record, golfRev 1 & 2 only | golfRev 3 aim/Captain/castle art changes: no re-record |
| Cue Ball | `skins/pool.skins.ts` | overhaul record (13) | arm removal: no re-record (never drawn in Bun) |
| Top Bins | `skins/freekick.skins.ts` | base record | kicker/stroke change: no re-record if frames are pre-rev-5; verify `scripts/skins/frames.ts` |
| Apex | `skins/racing.skins.ts` | overhaul record (5) | yaw sign / sprite removal: no re-record (sprite never drawn in Bun); a *painted-car* change would need `--record-overhaul=racing` |
| Curl Champ | `skins/curling.skins.ts` | overhaul record (10) | not in this list |

Re-record only when a Bun-drawn pixel changes: `bun scripts/skins-default-check.ts --record-overhaul=<game>` (Joe's approval line in the check header), never the base record.
