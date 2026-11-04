# Sports arcade polish (3 Nov 2026)

From Joe's audit of the Sports group. **Look and input mapping only: no stamp, no sim, hitbox, rule, timing or
scoring change** for any game. Older rounds replay and score exactly as before (each game's own check).

Shared: `src/lib/arcade/sportsHud.renderer.ts` (`sportsChip`, `sportsChipRow`): the Sports pill chip (a dark
rounded pill, a muted label and a bright value, 22 px). Swish and Flightpath move to it from their dotted text lines.

| Game | What changed | Where | Input |
| --- | --- | --- | --- |
| Swish (binRev 7+) | A seaside boardwalk at dusk (sky, moon, gulls, the sun into the sea, a headland and lighthouse, the pier with its pavilion and lights, the white railing, two lamp posts, a planked deck to the screen's bottom) in place of the shared fairground. A taller view (430 × 792, `BINTOSS_VIEW_H`, the world's rows from `BINTOSS_VIEW_TOP` = −64), so the deck reaches the screen's bottom where the lamp-post strip was. The wind flag 1.35× on a tall mast on the railing. Chips THROW n/10 · IN n · FAR n · +p. | `boardwalk.renderer.ts`, `binTossArt.renderer.ts` (`binTossViewFor`, `binTossFrame`) | A drag is measured in world px at the box's own scale, as before. |
| Flightpath (bullRev 8+) | Inside a darts stall: an awning with bulbs, a red plank back wall with prize shelves, two spotlights, the counter across the bottom. No Ferris wheel. The range drawn 1.15× (`FP_VIEW_K`) in a 390 × 800 box, panned sideways only as far as keeps a drifting board whole (`flightpathPan`). Chips DART n/10 · STREAK n · CENTRE n; the wind flag hangs at the awning's right end. | `dartStall.renderer.ts`, `bullseye.renderer.ts` | A drag is measured at the box's own (unzoomed) scale, so a throw lands where it always did. |
| Home Run (homerunRev 4) | The camera pulled up and back as a warp of the world the sim measures in (`hvPt`): the stands as they were (rows 0–168), the outfield and infield about 2.1× as tall (168–300 → 168–450), a blend (300–380 → 450–520), then the near field and batter at 0.59 (`HV_NEAR_K`). The call ("37 FT · IN PLAY", "LATE · 117 MS") in a banner along the bottom (`paintCallBanner`), never over the field. | `homerun.renderer.ts`, `homerunSceneV4` | A tap goes back through the exact inverse (`homerunV4ViewToWorld`) before it is sent. |
| Top Bins (freekickRev 4) | The camera's picture zoomed 1.4 (`FK_VIEW_K`) about the horizon's centre, the horizon raised to row 190 (the same camera with a longer lens): the goal, wall and keeper larger, less crowd. The HUD, the power bar, the prompt and the result stay put. The prompt reads "2  HOLD THE BAR". | `freekick.renderer.ts` (`freekickViewOn`, `freekickViewToWorld`) | The stroke is taken back through the inverse before the shot is read; the bar is not zoomed. The skill-band bots never see the zoom. |
| Apex | The horizon raised from row 270 to 185 and the camera lifted (CH 1714 → 2200) so the car's contact line stays at row 570: the sky about a quarter of the world instead of 40 %, more road ahead. | `racing.renderer.ts` | Unchanged. |
| Curl Champ (curlRev 4) | A longer lens from a little further back on a taller world (390 × 640, `CURL_VIEW_V4`, `CURLING_H_V4`): the far house about 1.37× as wide, the stone's path 340 rows (was 300), only the top of the near house below the In / Out / Throw row. `CURL_TURN_ROW_MID` and `CURL_TURN_ROW_TOP` are worked out from this view, so the row's placement rule and room-practice-parity's pinned curlRev 4 exception stay in step. | `curling.renderer.ts`, `sportsFx.renderer.ts` (`CURLING_FX_V4`) | The broom, the start slide and the sweep side read the view. |
| Cue Ball | Balls drawn 1.5 px larger (`POOL_BALL_DRAW_R`, inside the bounds rule's 2 px, so no hitbox change and no stamp). A stripe is the colour with a broad white band through its middle (the number in the band); a spot the solid colour with a small white spot. The HUD's rack balls show the pattern alone. | `pool.renderer.ts` | Unchanged. |
| Crazy Golf | A 390 × 720 view (`MINIGOLF_VIEW_H`) and a fixed camera per hole from the hole's box (`minigolfCamera`, up to 1.3×), so the course reaches over the bare terrace band; the ball drawn 1.5 px larger (inside the bounds rule). | `minigolf.renderer.ts` (`drawMinigolfPlay`) | A putt is a pull relative to where the finger went down: unchanged. |
| Ringer | "· MOVING" (a mockup note) gone from GOLD CUP 150; the cup numbers 16–17 px (were 12–13), the pockets' 100 too, with a dark outline. | `alleyroll.renderer.ts` | Unchanged. |

## Assumptions

- The brief's "Lower the horizon" for Apex is read as less sky (the horizon line higher on the screen).
- Swish's world must stay 430 px wide (the far bucket reaches x 420), so on a 414 px phone the bucket and ball cannot
  be drawn larger without cropping play; the reframe is the taller view with the deck at the bottom and the scenery
  and flag filling the sky.
- Cue Ball's balls are drawn larger only within the bounds rule (1.5 px), so no stamp or re-proved bank is needed;
  a larger hitbox would need both.
- Top Bins' prompt keeps its step number: "2  HOLD THE BAR".
- Tiles: Swish's and Flightpath's tile backgrounds are the boardwalk and the stall (`scripts/shots/tile-scenes/backgrounds.ts`).

Screenshots: `screenshots/sports-polish-nov-2026/` (before and after at 414×896 for every game changed, 375×667 for
Home Run and Cue Ball).
