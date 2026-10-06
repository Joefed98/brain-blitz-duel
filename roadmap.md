## Slice kitchen retheme (Oct 6)
- [x] Replace Slice sea art with full-arena kitchen background, four collision-sized foods/condiments/chilli, swipe cut faces and capped particles.
- [x] Replace only Slice sea sounds; preserve shared combo and haptics, remove duplicate correct/wrong audio.
- [x] Native drawing/size/bounds/cache/motion checks and shared FX passed; protected files unchanged. Mapping/cache report: .lovable/audits/slice-kitchen.md.
- [ ] Actual phone appearance/no-scroll/audio/performance awaits user device testing; no browsers or identity proofs.

## Shared red-box bug and fitted Wordsmith letters (Oct 6)
- [x] Cause: FxLayer created untargeted shake/glow outline spans at 10% screen height, coloured red for wrong feedback; removed these globally and their CSS. Recorder already requires example recording and accepted key; intro touch dots are off. Touch focus outlines suppressed, keyboard focus retained. Diagnostics now require a server-accepted key, not dev=1 alone.
- [x] Wordsmith targets tripled to 312px live/192px example and reveal, capped by actual font glyph bounds against all polygon edges with 1% board margin; equal centre/outer font size, remeasured on resize/font load. Existing geometry, controls and colours retained.
- [x] Passed shared-box/dev-gate regression, 14 polygon/phase geometry checks, 60 input/phase checks, 336 surface checks and shared FX. 306 protected fingerprints unchanged; only diagnostic display permission changed. Preview build OK; no browsers or identity proofs. Actual appearance/no-scroll awaits user device testing.

## Reveal marker and dark Wordsmith tuning (Oct 6)
- [x] Audited all 26 registered engine reveal paths: Hover crash-coloured saucer/tint, Cross hit circle/tint, Junction crash star/flash, Rally crash-coloured ball/tint and Skyline miss tint now use reveal-only suppression; live/demo art and gold finish ring retained. Swerve is not a registered engine reveal.
- [x] Doubled Wordsmith letters again to 104px live/64px intro and reveal; near-black wedges, white letters/light outlines, gold selection and accent centre share the existing board.
- [x] Passed five immutable reveal drawing variants at both widths, 14 geometry checks, 60 input/phase checks, 336 surface checks and shared FX; 211 protected source fingerprints unchanged (only arcade architecture notes differ). Preview build OK; no browser tests or identity proofs.

## Presentation geometry tuning (Oct 6)
- [x] Removed only the ArcadeReveal crash marker, retaining the gold finish marker.
- [x] Shared one segmented octagonal Wordsmith board across live, intro and reveal; controls/verdicts unchanged, stale Wordsmith coordinate demos rejected separately from other puzzles.
- [x] Anchored Sudoku box strokes to actual cell edges; clipped each Shikaku board/label with equal tracks and cell-relative readable text.
- [x] Passed 14 focused phase/geometry checks at 390x700 and 375x667, 60 input/phase checks, 336 surface checks and shared FX. All 250 library/integration files unchanged; preview build OK. Audit: .lovable/audits/presentation-geometry-oct6.md.
- [ ] Actual appearance/no-scroll awaits user device testing; no browsers ran. Existing long Wordsmith reveal lists remain internally scrollable.

## Colour Clash four-lane spawn fix (Oct 6)
- [x] Cause: fixed centre-lane spawn (`floor(lanes / 2)`) always chose index 2 (third lane) after expansion. Replaced with one seeded PRNG draw, saved after consumption; shared integer lane-count/transition constants.
- [x] Colour Clash-only identity proof passed 200/200; 200-seed spawn regression covers every lane, exact PRNG state and integer state. Four-lane counts: 716/735/665/684. Preview build OK; no browser tests, devices remain user-tested.

## Chain 30-link rework (Oct 6)
- [x] Extend seeded generation/client/server replay to 30 links and six five-link boards; preserve 45s and momentum, add FASTER at 26.
- [x] Set five-point links and update SCORE, goal and reveal breakdown; fixed intro illustration has no link count and stays unchanged.
- [x] Passed 200 seeded cycle/replay/server-grade checks, 200 scatter/score checks and all 1,410 stored-score rows; preview build OK. No browser tests; device checks remain with the user.

## Puzzle input and layout tuning (Oct 6)
- [x] Suppress native tap/hold highlights globally and explicitly on Beat canvas; gameplay input/replay untouched.
- [x] Shared tap-only Wordsmith ring/fixed intro with Clear/Enter, no typing/drag/shuffle; preserved word verdicts/dropdown/gold chip. Word Hunt strict inner-60% hit boxes, adjacent-only extension/backtrack, one active pointer and cancelled gesture cleanup; drag retained.
- [x] Centred 44px Target/Lights SVG controls; removed Maze Reset and enlarged separated arrows with shared mode preference; removed Rings Undo/Reset and Flood Undo. Heavy non-scaling Sudoku box outlines; equal square Shikaku tracks and aligned reveals.
- [x] Revision-gated old coordinate demos for changed controls; new recordings save the revision, old demos fall back to updated static examples.
- [x] 500 strict-hit samples and 60 phase/size source-SSR audits across 10 games passed; 336 full surface checks, shared FX and 1,410 stored-score checks passed. 198 protected files unchanged; only user-facing help wording changed among sampled lib files. Preview build OK.
- [ ] Device fit, native hold highlight and drag reliability at 390x700 and 375x667 await user testing. Existing long-list/multi-board internal-scroll reveals remain explicitly uncertified; report in .lovable/audits/puzzle-input-oct6.md.

## Cross reveal-score investigation (Oct 6)
- [x] Reproduced 15 false failures: stored 0, component lines 0+0, total 0; check incorrectly required a first-line total.
- [x] Fixed test-only Cross three-line arithmetic/cap validation, added zero/partial/crossing/capped and corrupted-line regressions; full registry passes 1,410 rows across 94 types. Scoring and reveal builder unchanged; no browsers.

## Shared puzzle surface polish (Oct 6)
- [x] Add shared presentation scope to all 42 active non-engine games, preserving game source and meaningful colours; specialised glyphs/objects remain exceptions.
- [x] Run no-browser source/SSR checks and per-game size-labelled audit; rendered fit is explicitly unverified.
- [x] Verify 327 protected fingerprints and shared FX checks; report exceptions and existing Cross reveal-check failure.
- [ ] Device sizing/appearance verification at 390x700 and 375x667; blocked on user device testing (no browsers requested). Uniform action heights and universal 44px hits remain exceptions to preserve layouts and input ownership.

## Night scenes and outlined aim dots (Oct 6)
- [x] White Bin Toss round aim dots have matching wider dark under-strokes. Skyline/Ink Bridge use shared static night skies, stars/moon, lamps, high-contrast glass/cloud edges, dim towers/windows, moonlit river and a faint navigation-light plane; Skyline clouds removed.
- [x] No-browser checks passed 2,400 night-scene frames and 3,840 existing drawing frames across both sizes/motion modes, immutability, exact platform/pit geometry, identical aim vertices and paired dot strokes; Fairground smoke/shared FX passed and preview build OK. Only renderer files and project notes changed; no simulation/input/grader/scoring/sound changes or identity proofs. Device appearance remains user-tested.

## Seven-game artwork tuning (Oct 6)
- [x] Junction's 2D pose is explicitly render-only; simulation uses 1D progress/occupancy. Corrected all eight outgoing lanes with continuous visual turns and enlarged lights 18%, without changing authoritative progress or collision decisions.
- [x] Tuned Fairground scenery, Bin Toss matte tin/deep-red ball/darker identical no-wind aim, Bullseye 500ms gold landing numbers, Tilt full-square pits/blue glass cup, Ball Track brass, Skyline sky/buildings and Ink Bridge exact-bound cloud ledges/ambient bird/sky.
- [x] Drawing checks passed 3,840 immutable frames across two sizes/motion modes, exact pit/cloud footprints, all eight turn lanes/continuity, landing expiry and identical aim vertices. Fairground/Toybox smoke and shared FX checks passed; 296 protected files unchanged, sole stage change is Bin Toss artwork import wiring. Preview build OK; no browser tests or identity proofs. Device appearance remains user-tested.

## Eat and Grow blazing meteor
- [x] Restyle cached sprites as a rocky fire-wrapped directional head, orange/red flame cells and smoke-grey tail with bounded rising embers and death smoke; preserve cell geometry, arena palette, stars, sounds and static reduced-motion fallback.
- [x] No-browser 300-cell/600-frame cache, directional head, colour, bounds, particle and reduced-motion checks passed; native canvas stills inspected, shared FX checks passed, all 297 protected fingerprints unchanged and preview build OK. No browser tests or identity proofs; phone appearance/performance remain user-tested.

## Eat and Grow neon comet
- [x] Replace square snake art with cached cell-centred comet beads, pixel-star pellets and bounded presentation-only sparks; preserve full-cell envelopes, sounds and reduced-motion behaviour. Bright inner beads taper to 75%; collision-sized outer beads never shrink.
- [x] No-browser 300-segment/600-frame cache, cell bounds, pellet/death, 32-spark cap and reduced-motion checks passed; native canvas stills inspected, shared FX checks passed, all 297 protected fingerprints unchanged and preview build OK. Phone appearance and 60 fps remain user-tested; no browser tests or identity proofs.

## Burst performance
- [x] Profile crowded Burst drawing; cache artwork/glow/scanlines and cap particles (32; skip above 24 enemies or 8 shots). Warm frame filled rectangles fell from about 1,653 to 19, with no live blur; desktop DPR-2 crowded-frame median fell from 2.64 ms to 0.31–0.46 ms (cached p95 0.96–2.40 ms).
- [x] Add dev frame interval/FPS, p95, draw/work readout across shared and 16 dedicated arcade drawing paths. Cache/particle checks, shared FX checks, native raster image inspection and 188 pre-change fingerprint comparisons passed; preview build OK. No browser tests or identity proofs; 60 fps on phones awaits user device checks.

## Matchup facets and Swing ceiling correction (Oct 5)
- [x] Replace standard-gem flecks with deterministic flat own-colour facets and bright joins; specials and bomb unchanged.
- [x] Anchor Swing's narrow rock band and stalactites to the authoritative cave ceiling; clip cave scenery below that line and clear above it for the shared background.
- [x] Mock-canvas facet, unchanged-special/bomb, ceiling-envelope and seven drawing smoke checks passed; shared FX checks passed, protected source unchanged and preview build OK. No browser tests or identity proofs; device appearance remains user-tested.

## Matchup, Swing and Flip visual refinement (Oct 5)
- [x] Restore white Matchup specials, outline bomb and add six stable own-colour flecks per standard gem.
- [x] Clip Swing stalactites at the arena top boundary, including negative ceiling heights.
- [x] Replace Flip robot with gravity-boot figure; add exact-gap-span exterior lava pools, 420ms presentation-only death sink and warmer mineral-streaked rock.
- [x] Mock-canvas gem/pool/sink checks, 13 three-game smoke frames, 72 Flip frames and shared FX checks passed; protected source fingerprints unchanged and preview build OK. No browser tests or identity proofs; device appearance remains user-tested.

## Shared visual and audio foundation
- [x] Shared category themes/tokens, layered backgrounds and bounded reduced-motion effects; 94 registry themes, no individual overrides yet.
- [x] Manifest effects/voice placeholders, separate persisted music mute, ducking and lobby/standings/podium-only silent music. Spoken recordings and music await supplied assets.
- [x] Shared 20px ring timer, score/progress rows, existing shared help, server-verdict puzzle feedback and all dedicated/shared arcade run-end observers. Focused FX tests and build passed; 47 protected files unchanged. No browser tests or identity proofs; phone fit and 60fps remain device-unverified. Granular placement feedback is only emitted where an existing validated event exists.

## Bullseye, Cross and Flip tuning
- [x] Bullseye values are 10/9/8/3/2/1; seeded arrow-7–10 permutations and value colours derive from that one list, labels/example and SCORE updated; geometry, wind and sway unchanged. Raw max 100, score max 150.
- [x] Cross scores 2 per total lane plus 4 per crossing, cap 150; shared total-lane helper feeds score and server result, intro/help/reveal/summary updated, clean bonus removed (legacy clean checkpoint field retained).
- [x] Flip renderer-only fix samples the shared curve at hazard rims, gaps, chevrons and overhangs; all physics, seeds, inputs and scoring unchanged. Shared drawing helper serves play/reveal/demo.
- [x] Bullseye, Cross and Flip identity proofs passed 200/200 each (Flip's sim-containing file had drawing edits); focused values/score/cap/reveal and every-tick curve-vertex checks passed. No browser tests. Bullseye and Cross saved demos need re-recording; Flip demo remains compatible.

## Laser and Mirrors rework
- [x] Set 60 seconds, seven/eight mirrors and one movable oriented splitter; separate inventory limits and shared tracing enforce placement/orientation in play and server grading. Three-shot scoring unchanged; legacy stored rounds remain readable.
- [x] 200 seeded layouts passed independent exact-piece tracing, every proper witness subset, terminal-edge splitter necessity and server grading. 1,000 fresh draws measured 1.55–26.07ms, median 4.62ms, p95 10.83ms; fixed intro cold draw 35.35ms. Below one second, so no precomputed bank needed. Subset proof is for the stored solution, not a global minimum-mirror search.
- [x] Updated six-gem fixed example and GOAL/HOW; incompatible old fixed-splitter demos fall back to the new static example until re-recorded. Laser-only tests and preview build passed; no browser tests, device interaction remains user-tested.

## Chain reshuffle cycles
- [x] One stored seed generates a new symbol set and order for each five-link board; shared phone/server replay uses the board's current cycle and current-cycle look-alike decoys, with legacy single-cycle fallback.
- [x] Updated code flashes gold for 650ms with its board change; FASTER, momentum and scoring unchanged. Fixed short intro example still matches; HOW now explains changing cycles. Chain-only checks passed 200/200 seeded regenerations, full server grades, boundary decoys, timing edges, scatter and legacy replays; preview build OK, no browser tests.

## Trail sequential tap correction
- [x] Removed tray/selection; shared adjacent next-number taps and last-player undo support mixed dragging. Fixed numbers remain on the board; scoring, SCORE wording and bank fingerprints unchanged.
- [x] All 300 Trail boards passed tap-only solves, last-player undo/re-tap, ignored invalid taps, mixed tap/drag and scoring checks. Source fit audit passed at 390×700 and 375×667 with 59px/56px squares and 44px controls; preview build OK, no browser tests.

## Word Search, Rings and Tubes presentation
- [x] Removed Word Search intro minimum-length line; Rings clues increased 11px to 14px (+27.3%), with auto-height reserved space instead of clipped 28px row.
- [x] Tubes use 80% of their arena height, full-width five-column tracks and proportionate balls. Source audits at 390×700 and 375×667 confirm five balls plus one-ball clearance, 67–70px tap widths, and separate controls; no browser tests.
- [x] Rings/tubes rule modules, grader and scoring checksums unchanged; preview build OK. Device appearance remains user-tested.

## Trail independent credit and tap input
- [x] Shared independent tile counting grades every correct player tile; complete scores remain 130/140/150 at zero/half/full time. Bank checksum unchanged.
- [x] Added highlighted tray selection, empty-cell tap placement and pickup with numbered slots; legacy dragging remains supported, Undo restores edits and Reset restores fixed tiles. Source phone audit keeps at least 36px squares and 44px Undo/Reset controls; no browser tests.
- [x] Updated SCORE/HOW and independent reveal tile marks; 300 bank checks, 300 early-error server grades and 900 completion grades passed. Preview build OK; device interaction remains user-tested.

## Orbit chosen checkpoint
- [x] Replaced automatic checkpoint with validated recorded input 1 while orbiting; selection is immutable, gold planet marker clears after the one respawn and no second selection is allowed. HUD uses sim-derived availability and a fixed 48px control slot.
- [x] Updated GOAL/HOW and removed timed-checkpoint help; intro SCORE and scoring code unchanged. Stored checkpoint tile shows the selected planet even after use, or none. Orbit identity 200/200 and early/late/never full-state replay checks 15/15 passed; preview build OK, no browser tests. Saved Orbit demo needs re-recording; device appearance remains user-tested.

## Flip sweeping bends
- [x] Added integer bend table: 1,560px waves until 45s, then continuously shrinking through 1,040/520/260px at 50/55/60s; displacement eases to ±145px by 25s. Integrated phase preserves continuity, constant gap and existing seeded RNG draws.
- [x] Flip-only identity proof passed 200/200; curve checks passed integer offsets, constant gap, continuous transitions and early/late change maxima 2/10px per tick. Preview build OK; no browser tests. Report cycle-rate table and saved Flip demo re-recording requirement; device feel remains user-tested.

## Cross, Burst and Ten Drop pacing
- [x] Cross preserves crossings 1-2 and adds 64 fixed-point units/tick per crossing from 3; fallback uses the same later speed progression. Report lane speed ranges for all ten courses.
- [x] Burst shot interval 8→16 ticks; gold icon fall 512→768 fixed-point units/tick; shield fall and flawless scoring unchanged.
- [x] Ten Drop holds the completed target and total for 30 sim ticks, ignores gameplay inputs but retains their logs, and advances only after the hold. Final target also holds; speed bonus still uses actual clearTick, and the 90-second timeout wins during a hold.
- [x] Cross 200/200, Burst 200/200 and Ten Drop 200/200 identity proofs passed. Additional Ten Drop full solves 20/20, 200 holds and 6,000 logged/ignored inputs plus timeout checks passed. Preview build OK; no browser tests or other-game identity proofs.

## Matchup and Bullseye renderer tuning
- [x] Add 150ms accepted swap slides and 150ms-out/150ms-back rejected swaps; original cascade presentation and input gating unchanged, sim resolves on its original tick.
- [x] Shared Bullseye arrow silhouette has near-black shaft/fletching/head with a thin light outline, in play and reveal/demo rendering; aim and wind/sway presentation unchanged.
- [x] Focused mocked-canvas checks passed at both phone widths, easing endpoints/midpoints and dark outlined drawing verified; simulation files match their original fingerprints. Preview build OK; no browser tests or identity proofs, device appearance remains user-tested.

## Six-game presentation tuning
- [x] Separate Chain code from timer with 12px top space, centre Rotating Rings in a container-sized square with scaled SVG coordinates, halve laser animation speed, shrink square Pipes tiles about 7%, and hide Tower minimum until reveal.
- [x] Confirmed every seed has ten tubes; user chose two rows of five. Tubes are 88px tall, balls 11px, with 15px headroom above five balls and tap targets at least 68.6×88px at the requested phone widths.
- [x] Source audit all six passed at 390×700 and 375×667 with conservative safe areas and room score strip; rendered tube markup confirms ten targets. Preview build OK; no browser tests or scoring/grading/sim changes. Device appearance remains user-tested.

## Three number-game stage feedback
- [x] Add one-second intermediate CORRECT holds to Balance, Equation Balancing and Number Pyramid; reserve gold slots above/below as requested, ignore input, leave final submission and scoring unchanged.
- [x] Focused hold checks passed for all intermediate stages, stable deadlines through updates, immediate final advancement and cancellation on round lock. Conservative source budgets passed at 390×700 and 375×667 with safe areas, room score strip and wrapped equation; preview build OK, no browser tests. Device appearance remains user-tested.

## Three word-game tuning
- [x] Add shared 700 ms gold/white accepted-word chips in fixed 32px slots above both boards; Wordsmith hides the chip while its dropdown is open. Square boards fit remaining height and width; error rows stay reserved. Source budget audit passed at 390×700 and 375×667, including conservative safe areas and room score strip; device appearance remains user-tested.
- [x] Share valid-word tile membership between Tile Grid counter and server grading; retain 8 points per counted tile and completion scores 130/140/150 at zero/half/full speed bonus. Crossing, invalid-run, isolated-tile, removal, tray-tampering and 320 generated partial-board parity checks passed; preview build OK, no browser tests.

## Intro wording only
- [x] Replace em/en-dashes in all 94 intro GOAL/HOW entries and 26 worked-example caption files; SCORE templates already contain no long dashes. Game logic and help formulas unchanged.
- [x] State grader-enforced minima: Wordsmith 4, Word Hunt 4, Tile Grid 3, Word Slide exactly 5, Word Search 2, Letter Wheel 3; wording checks passed, preview build OK, no browser tests.

## Practice intro Back button (Oct 5)
- [x] Add a compact outlined top-left Back button in the existing intro header, practice only; cancel and clear the run without grading.
- [x] Cancellation checks passed; Back shares the existing header row without increasing its height; preview build OK. No browser tests; phone appearance remains user-tested.

## Matchup, Flip and Snip refinement (Oct 4)
- [x] Black bomb with thin light-grey outline; deeper, more frequent shared-band Flip bends; larger Snip mouth and much wider walls.
- [x] Matchup, Flip and Snip replay proofs passed 200/200 each; all 30 template/jitter swing envelopes clear widened walls, camera visibility and 75° Flip bend check passed; no browser tests.

## Arcade correction pass (Oct 4)
- [x] Correct Matchup icons, whole-swipe Slice combos, Cross lanes, shared Flip bend, Tilt stars and elastic/larger-mouth Snip.
- [x] Curved three-disc swipe and focused rules passed; replay only Matchup, Slice, Flip and Snip passed 200/200 each; no browser tests.

## Slice combos and Snip wider arena (Oct 4)
- [x] Implement timed combo levels, revised Slice weighting, single-star Snip scoring and wider camera-followed arena.
- [x] Slice and Snip replay proofs passed 200/200 each; combo expiry/refresh, scoring, wall restitution and camera visibility checks passed; all ten templates can be fed with their star at −10/0/+10 pin wobble; automatic code checks passed; no browser tests.

## Arcade second-pass tuning (Oct 4)
- [x] Apply touch suppression and seven game-specific tuning changes; Beat canvas lanes and Burst press-safe buttons covered.
- [x] Matchup, Breaker, Cross, Wavefront, Flip and Burst replay proofs passed 200/200 each; focused power-up, cascade, course and curve checks passed; no browser tests.

## Logic timing and proven Colour Flood bank (Oct 4)
- [x] Set Shikaku and Light Up to 90 s; 50/50 unique boards each passed server scoring checks at 0/45/90 s remaining.
- [x] Fill 400 distinct exactly proven-par Colour Flood boards, rejecting fallbacks; final par range 10–14 (accepted band 10–15).
- [x] All 400 boards passed independent exact minimum, no-shorter-route, complete/partial server replay and scoring checks; 0 failures, preview build OK, no browser tests.

## Logic grid size changes (Oct 4)
- [x] Colour Flood 14×14, 60 s, full-width grid; exact par target 10–15 (proven fallback 16–20), observed 10–12 across 12 fresh boards.
- [x] Shikaku 10×10 and Light Up 9×9, 110 s each; planned-action medians 16→19 rectangles / 13→16 bulbs across 50-board samples. Human solve timing estimated, not measured.
- [x] On-demand generators have no precomputed banks to rebuild; 50/50 unique per game and actual server grading checks passed, plus 12/12 Flood minimum-par/replay checks; preview build OK and source phone fit checked; no browser tests.

## Logic layout tuning (Oct 4)
- [x] Resize Lights Out, centre Tower, prioritise Safe Cracker clues and shrink DEFUSE without changing gameplay.
- [x] Expand Nonogram and Tents grids; move Colour Flood par to its reveal.
- [x] Retire Dig from room draws while keeping practice available; registry check and 6,000 draws passed.
- [x] Audit all eight screens at 390×700 and 375×667 from source and conservative dimension calculations; preview build OK, no browser tests. Actual device appearance/taps remain user-tested.

## Ball Track 25-ball and event countdown tuning
- [x] Use 25 seeded balls (7/6/6/6), two-second drops through 48 s and base scoring out of 25.
- [x] Show gold mono 5→1 warnings aligned with the hopper and soft ticks before both seeded events; all 800 countdowns and drawing alignment checked without a browser.
- [x] Regenerate 400 courses and sync practice: 400/400 route all 25 home, Ball Track identity 200/200; preview build OK; no browser tests.

## Ball Track pace and hopper tuning
- [x] Slow movement to 12 ticks per tile and show only the next six balls with fixed clear gaps and a full-size lead ball.
- [x] Retimed proof playbooks without changing any of the 400 courses or tiers: 400/400 solve 20/20, Ball Track identity 200/200; no browser tests.

## Ball Track nine-row tuning
- [x] Apply the agreed row-8 allowance of four rotatable straights; row 7 stays at two, with fixed bottom-row interception and upper-routing alternatives for every tray.
- [x] Implement nine-row board, compact hopper/trays and fixed-row intro; 400/400 courses route 20/20 home and Ball Track identity passes 200/200. No browser tests; device fit remains user-tested.

## Ball Track 20-ball tuning
- [x] Thicken gold and grey tube outlines by 1.5× without changing tile gaps.
- [x] Use 20 balanced seeded balls dropping every 2 seconds, with existing replay and count-based scoring.
- [x] Regenerate 400 courses and sync the practice fallback: 400/400 solve 20/20, Ball Track identity 200/200; schedule/scoring checks pass; no browser tests.

## Ball Track 14-ball tuning and memory settings removal (Oct 4)
- [x] Swap rotatable/fixed tube colours and update Ball Track to 14 balanced seeded balls.
- [x] Regenerate 400 courses: 400/400 playbooks home 14/14 and Ball Track identity 200/200; no browser tests.
- [x] Remove stored memory room settings and memory draws, preserving practice games and maths/arcade options.

## Stop Watch, Chain, Whack, and Clay updates (Oct 2)

- [x] Make Stop Watch 1–7 bounce, Watches 8–10 wrap, and count right-edge arrivals from 2 through 11.
- [x] Scatter all 28 Chain nodes with a guaranteed clear gap and store each generated layout.
- [x] Run Whack-a-Target for 60 seconds with an initially empty, paced 100-ball queue and universal three-second lifetimes.
- [x] Compact Clay Shoot's status, conceal gold discs until resolved, and expand the sky area.
- [x] Run self-replay proofs only for Whack-a-Target and Clay Shoot.

## Ten Drop and Number Pyramid update (Oct 2)
- [x] Simplify Ten Drop to a gold running total on the left and centred target beneath the shared timer.
- [x] Expand Number Pyramid to four rising-difficulty boards over 150 seconds.
- [x] Add placed-tile double-tap return and rebalance the short-phone layout.
- [x] Rebuild and validate 400 unique four-board sets, then run code checks without browser tests.

## Word Search and Letter Wheel tuning (Oct 2)
- [x] Extend Word Search to 120 seconds and rescale its completion bonus.
- [x] Remove Letter Wheel shuffle and bonus words, and add neutral valid-word feedback.
- [x] Rebuild Letter Wheel as 300 validated eight- or nine-word crosswords with the new scoring.
- [x] Adjust Letter Wheel controls for short phones and run focused checks without browser tests.

## Shared play timer and full-width arenas (Oct 2)
- [x] Replace all live countdowns with the shared top timer bar.
- [x] Remove per-game timer slots and reclaim their height.
- [x] Make game screens use the viewport width minus an 8 px safe margin.
- [x] Remove height-driven narrowing from shared arcade canvases and capped puzzle arenas.
- [x] Audit 390×700 and 375×667 layouts from source and verify checks without browser tests.

## Two speed-game changes (Oct 2)
- [x] Rework Whack-a-Target as a paced 100-ball queue with persistent correct balls and two-second wrong-colour retreats.
- [x] Update Whack-a-Target scoring, HUD, instructions, reveal, and server-graded details.
- [x] Expand Clay Shoot to 60 seconds with 22 orange and 3 harder gold clays across 25 seeded trajectories.
- [x] Update Clay Shoot hit radii, scoring, colour counters, instructions, reveal, and server-graded details.
- [x] Run only Whack-a-Target and Clay Shoot identity proofs plus focused schedule, aiming-bot, and score checks; no browser tests.

## Four speed-game changes (Oct 2)
- [x] Update Reaction Time to 60 seconds, seeded 5–8 flashes, simplified play UI, and scaled decoys.
- [x] Update Number Hunt to 20 non-touching numbers, seeded 15-second relocations, and new scoring.
- [x] Expand Stop Watch to ten progressively harder watches and correct full-sweep pass counters.
- [x] Rework Don’t Break the Chain for endless seeded 28-node sets, compact timer, and link scoring.
- [x] Audit source layouts for 390×700 and 375×667; run focused checks and only applicable changed-game replay proofs, with no browser tests.


## Three number-game changes (Oct 2)
- [x] Extend Ten Drop to 90 seconds with the new ten-target bands and pace.
- [x] Move Ten Drop timing into a compact top bar and reclaim the arena space.
- [x] Rebuild Number Pyramid as 400 unique three-board sets with sequential play and skipping.
- [x] Update Number Pyramid and Trail scoring and timing.
- [x] Run only Ten Drop's replay proof plus focused bank, scoring, and code checks; no browser tests.

## Four word-game tunings (Oct 2)
- [x] Update Wordsmith scoring and all displayed conversion text.
- [x] Remove Word Slide's in-game par label only.
- [x] Rescore Word Search, clarify category headings, and rebuild its 500-board bank.
- [x] Add Letter Wheel tap input, new scoring, larger cells, compact timer, and rebuild its constrained 300-board bank.
- [x] Run focused checks, TypeScript validation, and preview diagnostics; no browser tests.

## Attention and Pattern tuning (Oct 2)
- [x] Rebuild Colour Clash as a deterministic 60-second falling-word lane game with recorded steering and drops.
- [x] Make all five Intruder Detection boards 3×3 without changing stages, timings, or scoring.
- [x] Guarantee and verify Count Up shape containment and counted-shape visibility.
- [x] Clarify Laser splitter and directional-gem symbols in the intro, game, and reveal.
- [x] Run the Colour Clash identity proof and focused generator/geometry checks; no browser tests.

## Attention and Pattern changes (Oct 1)
- [x] Rebuild Colour Clash as a deterministic 45-second attention sorting stream with seeded rules, gates, replay grading, and reveal.
- [x] Expand Intruder Detection to five timed boards with two-change and shuffled-grid stages.
- [x] Rebuild Count Up as three dense overlapping picture scenes with stored, server-counted targets.
- [x] Fit Rotating Rings controls, legend, and board into short phone play areas without scrolling.
- [x] Add Laser splitters and directional gems while preserving nine-mirror necessity and three shots.
- [x] Run Colour Clash identity proof, named generator checks, TypeScript validation, and preview build diagnostics; no browser tests.

## Reaction and Stop Watch tuning (Oct 1)
- [x] Give every Reaction Time flash 1–3 seeded decoys in three colours with irregular spacing.
- [x] Give Stop Watch three visible passes, seeded moving targets on Watches 2 and 4, and a vertical accelerating Watch 4.
- [x] Run focused timing and scoring checks plus the TypeScript check; no browser tests.

## Six-type route, controls, and intro tuning (Sep 30)
- [x] Limit Hot Floor to few exhaustive-search viable routes with pinch tiles and three failed alternatives; report 50-stage metrics.
- [x] Make Burst and every arrow/joystick control press-safe and non-selectable, with full-width Burst columns.
- [x] Let Parry arrows remain catchable inside the ring and cost a life only at the core.
- [x] Reduce Bastion arrow rotation to 3° per tick without changing touch aim.
- [x] Make every round intro scroll when needed with READY sticky at the bottom; statically verify target phone fits.
- [x] Run focused checks and 200-run identity proofs for Hot Floor, Parry, and Bastion; no browser tests.

## Eight-type difficulty and scoring tuning (Sep 30)
- [x] Add Hot Floor hop budgets, tighter tile values, choke points, failed alternatives, and naive-strategy metric.
- [x] Retune Burst, Parry, Bastion, and Wavefront controls/scoring/schedules.
- [x] Increase Shikaku, Light Up, and Tents board difficulty while preserving unique solutions.
- [x] Run four arcade identity proofs and three 50-board uniqueness checks; no browser tests.

## Four arcade and interaction changes (Sep 30)
- [x] Rebuild Hot Floor as ten deterministic 6×8 route-planning stages with three lives.
- [x] Shift Tilt's starting maze difficulty forward by one level.
- [x] Suppress iOS selection and callouts at the shared game-screen wrapper.
- [x] Make at least 40% of Flip hazards after 10 seconds solver-checked decision patterns.
- [x] Run focused generation checks and 200-run replay identity proofs; no browser tests.

## Six type tuning (Sep 30)
- [x] Burst separate control bar in both modes.
- [x] Ink Bridge stroke controls, swept collision and stuck handling.
- [x] Junction traffic, Parry ring, Flip pace, Light Up board difficulty and fit.
- [x] Replay identity and unique-board checks; no browser tests.

## Balance fixed placement controls (Sep 29)

- [x] Replace tilted measured peg targets with a fixed row of eight number buttons.
- [x] Keep the beam decorative except for placed-weight selection and double-tap return.
- [x] Raise the rack 56 px above the safe-area inset and centre the pivot in the remaining play area.
- [x] Preserve the placement encoding validated by the server; run code-level checks only.

## Four control and layout tunings (Sep 29)

- [x] Make Balance tap-only with weights above the beam, selected-only peg markers, measured targets and spaced stacked reveals.
- [x] Convert Sum Hunt to deterministic 4×4 boards with a 16-cell final clear.
- [x] Add persistent tap-built words and a Submit control to Word Hunt while preserving drag tracing.
- [x] Add a remembered shared joystick mode with step locks and 180 ms Maze Dash repeat.
- [x] Run code-level checks only; do not run browser tests.

## Three type tunings (Sep 29)

- [x] Replace Balance peg squares with hanging gold lines while retaining measured targets.
- [x] Give Sum Hunt deterministic harder stage boards, larger values and tightly controlled path counts.
- [x] Add sub-8 px wheel taps to Wordsmith while preserving drag-to-connect.
- [x] Run code-level checks only; do not run browser tests.

## Three new-round input refinements (Sep 29)

- [x] Make Tile Grid tap-only, with selected-tile glow and faint empty-cell targets.
- [x] Centre Balance vertically and hit-test the actual tilted on-screen peg targets.
- [x] Centre Sum Hunt's target, auto-resolve matching/overshot paths, and use orthogonal paths throughout.
- [x] Run code-level checks only; do not run browser tests.

## Four round refinements (Sep 29)

- [x] Tile Grid tap selection, tap-to-place and live nearest-cell drag highlight.
- [x] Word Slide 90-second limit and speed scaling.
- [x] Sum Hunt seeded nine-stage progression, final full-grid clear, 90-second timing and stage scoring.
- [x] Balance full-width progress bar, tap-to-place, double-tap return and live peg drop highlight.
- [x] Run code-level checks only; do not run browser tests.

## Four new round tunings (Sep 29)

- [x] Tile Grid: fit seven rows between HUD and tray; centre drag ghosts and snap by nearest cell centre.
- [x] Word Slide: five dictionary rows, five-to-eight shifts, live checks, scoring and reveal.
- [x] Sum Hunt: five-by-five diagonal paths, tap and drag, rising deterministic targets.
- [x] Balance: centred ghosts, generous peg zones and hanging weights.
- [x] Run code-level checks only; no browser tests.

## Three presentation fixes (Sep 26)

- [x] Add a gold Wordsmith Submit control beside Undo and Shuffle without removing box-tap or Enter submission.
- [x] Fit Count Up's filled board within the measured phone width and height with visible side gutters.
- [x] Move Bin Toss and Bullseye wind displays onto a clear line below their headings, above the bin and target.

## Phone presentation fixes (Sep 26)

- [x] Replace the four-direction pads with a compact 56 × 44 px row, 16 px gaps, beneath Push, Maze Dash, Ice Slide and Gravity Maze boards.
- [x] Remove Wordsmith's upper box, enlarge its wheel and submit from the word-entry box while retaining keyboard Enter.
- [x] Fill Count Up's measured space with a 9 × 8 grid, compact timer slot and keypad; enlarge Bin Toss and Bullseye wind displays and Bullseye play text.
- [x] Draw Breaker and Slice frames directly in their simulations' world coordinates so letterboxing cannot shift the borders. Validate without browser tests.

## Arcade presentation and tuning (Sep 26)

- [x] Simplify the requested arcade reveals: no gate/coin/pellet dots, input counts or per-arrow detail.
- [x] Enlarge Bin Toss play text; frame Breaker and Slice; add six seeded three-hit Breaker bricks with hit cracks and unchanged per-destroyed-brick score.
- [x] Delay Steady's lifted-finger penalty five seconds, cycle Cross traffic colours, and tighten Dual's final-20-second side gaps while retaining passability.
- [x] Re-run 200-run Breaker, Steady, Cross and Dual client/server identity proofs. No browser tests.

## Presentation and tuning (Sep 26)

- [x] Reaction waiting text enlarged; Count Up filled 8×7 board with unchanged answer range.
- [x] Maze Dash, Ice Slide and Push arrow pads enlarged with non-overlapping diamond spacing; Spin answer boxes enlarged; Block Party pegs doubled.
- [x] Intruder before/after comparison with marked change and tap; Rings and Colour Flood reveals stacked vertically.
- [x] Validate code and preview build without browser tests.

## Ricochet, Dual and home copy (Sep 24)

- [x] Ricochet scores floor(2 × metres), capped at 150; help and reveals reflect it.
- [x] Dual javelins enlarged 1.2× with matching collision geometry and recomputed passability spacing.
- [x] Home game-count copy updated to 40+ puzzle types and 15 arcade games.
- [x] Dual client/server identity proof passed 200/200 runs with matching checkpoints and scores; no browser tests.

## Puzzle scoring balance

- [x] Triple raw Wordsmith and Word Hunt points for the capped round score; retain raw in-game counters and show conversion in reveals.
- [x] Rebalance Reaction Time and Stop Watch to 50–150 with missed attempts counted at their worst value.
- [x] Word Match, Pipes, and all other unfinished/imperfect puzzle partial scores capped at 90; align score instructions and reveals.
- [x] Verify focused scoring formulas and preview build diagnostics without browser tests.

## Gravity Maze, Don't Break the Chain, Intruder Detection

- [x] Shared rules: `gravity.ts` (both balls tilt together, each stops on a wall, the edge or the other ball), `chain.ts` (three-step cycle, replay), `intruder.ts` (tap grading, close colour pairs)
- [x] Server generation: joint-state BFS minimum 6–10 tilts with a ball-blocks-ball tilt in the shortest route; chain layouts with two valid and four invalid nodes at every step; three escalating grids storing the changed cell and change kind
- [x] Secrets: gravity `minMoves`/`solution`, intruder `answers`; chain has nothing to hide
- [x] Server verification in `grade.ts` — tilts, taps and grid taps are all replayed, never trusted
- [x] Scoring, standings summary lines, correct-answer lines, GOAL / HOW / SCORE intros
- [x] Play, intro example and reveal screens with the shared hit-test and no-scroll layouts
- [x] Registry entries: all three core, none retired; compact timer slots
- [x] Proof script `scripts/gravity-chain-intruder-check.ts` — 40 rounds each, all pass
- [x] Follow-up fixes: explicit unique-node chain progression, easier 4×4/4×4/5×5 Intruder rounds with four colours and three shapes, and measured Gravity board space above 52px controls
- [x] Chain crossing rules and searched non-crossing solution with crossing decoys; Intruder eased to 3×3/3×3/4×4; both reveals compacted

## Five-game tuning

- [x] Safe Cracker readability; seven-wire Bomb with switch and six effective rules; eight-tube challenge; escalating 3×3 Intruder; Chain limited to 1–8 routes with two traps
- [x] Nine tunings: Target uses five+ tiles, multi-rule Number Sequence, spread Chain layout with Undo/Reset, four-gem Laser (60s), 12x12 Ice Slide (75s), 10x10 Gravity Maze (90s), Tower 90s, ten-tube partial-pour Sort the Tubes, five-clue Safe Cracker
- [x] Six tunings: Sort the Tubes 75s, Tower 60s, Laser 30s, Unblock 7x7 with a 120-layout solver-built bank (15-22 moves), Spot the Difference full 8x6 grids at 30s, Number Sequence 20s

- Added three new types: Nonogram (logic, 60s), Pair Match (attention, 45s) and Colour Flood (logic, 45s) — server generation, private answers, replay-based grading, reveals, summaries and intros. Proof script: scripts/nonogram-pair-flood-check.ts.

- Added three new types: One-Stroke (logic, 45s), Sliding Tiles (pattern, 60s) and Rotating Rings (pattern, 45s) — server generation, private answers, replay-based grading, reveals, summaries and intros. Proof script: scripts/stroke-tiles-rings-check.ts.

- [x] Nonogram 9×9 full-grid rebuild and four-ring Rotating Rings controls/generation.
- [x] Five-type tuning: Nonogram 7×7, Colour Flood 12×12, deferred Bomb DEFUSE, Groups retired, and corrected full-width Rings.

## Scoring amendments (21 types)

- [x] Wordsmith/Word Hunt score their word points directly; Word Ladder, Word Match, Target, Number Sequence, Equation, Maze Dash, Sort the Tubes, Spot the Difference, Sliding Tiles, Lights Out, Pipes, Number Hunt, Count Up, Unblock, Ice Slide, Gravity Maze, Laser and Symbol Scan rescored with progress-based partial credit; SCORE lines and word reveals updated.

## Hover integrity

- [x] Integer-only shared constants, 300-tick client/server state checksums, first-desync reporting, and 200-run path equivalence proof.

## Arcade category

- [x] New "arcade" category with a host toggle (on by default, remembered per host, one arcade round in rounds 2-6, none when off); Hover moved into it.
- [x] Added Swerve and Skyline on the shared deterministic engine: seeded integer fixed-point sims, sim-tick input logs, server replay scoring, 300-tick checkpoints, client-lag handling, fixed instructions/reveals/summaries. Proof script: scripts/arcade-check.ts.

## Arcade inputs, Bin Toss and Bullseye

- [x] Generalised input events ({ t, k, a, b, c, d }, declared per-game ranges, 2000 cap)
- [x] Bin Toss: ten flicked throws, per-throw wind, growing distance, time bonus
- [x] Bullseye: ten aimed arrows, shrinking target, wind drift, half-total scoring

## Matchup

- [x] Matchup: 7x7 six-symbol swap game on the shared engine (k = 3 swap events)
- [x] Fixed per-column refill queues, deterministic reshuffle, cascade scoring, total / 4
- [x] 200-run client/server identity proof with valid and invalid swaps

## Five-game tuning

- [x] Pair Match 5x4 layout/scoring/text
- [x] Swerve speed ramp and coin collection rendering
- [x] Bin Toss drag capture and wind layout
- [x] Bullseye HUD/ring labels/bow aiming render
- [x] Matchup next strip, animation semantics, specials
- [x] Re-run deterministic proof scripts

## Six-game tuning (done)

- [x] Number Sequence: 45-second limit, speed bonus and text scaled to it
- [x] Hover: 666 start, +31 per gate, cap 1331; total gates recomputed
- [x] Swerve: five lanes, 14 px/tick slide, 1–3 blocked lanes, ≤2-step passability, speed +20 per coin
- [x] Matchup: strip aligned to the board columns, score = raw ÷ 8
- [x] Bin Toss: flick launch from the last 80 ms, no preview arc, flight trail
- [x] Bullseye: ring values 10…5, score × 1.5, flick from the bow, no reticle

## Flick recalibration (done)

- [x] Reference swipe 1300 px/s, clamped 250–2200 px/s, square-root response from a shared integer table
- [x] Bin Toss: 1300 px/s at 60° lands in the bin on throw five (launch 1243 units/tick)
- [x] Bullseye: 1300 px/s straight up lands on the centre at arrow one (flight 282/1920)
- [x] ?dev=1 readout of swipe speed, angle and landing point in both games

## Achievable arcade scoring (done)

- [x] 1300 px/s reference flick with the deterministic square-root response and existing clamp
- [x] Bin Toss: half wind, wider forgiving bin, 110–245 px distances, floatier gravity, previous-arc ghost
- [x] Bullseye: half wind, 170 px target, gentler shrinking/drift, previous-hit ghost
- [x] Re-run the 200-run client/server identity proof and arcade regressions

## Nine-type tuning (2026-09-21)

- [x] Bomb Defusal: required-action set + ordering constraints, contradiction/cycle/ambiguity rejection, order-independent grading.
- [x] Stop Watch: sweep speeds 1.0x / 1.3x / 1.6x per try.
- [x] Laser: 6 gems, 9 mirrors, 40s, proportional partial score.
- [x] Count Up: full 8x6 field, 20s, on-screen keypad.
- [x] Percent Sprint: five items. Number Hunt: sixteen numbers.
- [x] Chain: nodes never touch (diameter + 14px minimum).
- [x] Sliding Tiles and every drag board: no page scroll while dragging.

## Drag aiming and four-step bombs (2026-09-21)

- [x] Nonogram: 90s limit, speed bonus and help text rescaled.
- [x] Count Up: compact one-row keypad plus ENTER bar (~90px), grid gets the space.
- [x] Bomb Defusal: exactly four required actions, "steps x / 4", consistency and necessity checks kept.
- [x] Bin Toss and Bullseye: drag-position aiming (anchor to finger, 20-220px strength, 20px cancel), live dotted prediction, no velocity measurement.
- [x] Chain: 15 links, at least four invalid nodes per step, scoring and counters updated.
- [x] Re-ran the arcade drag identity proof plus bomb, chain, nonogram and arcade regressions.

## Filled Count Up and arcade polish (2026-09-22)

- [x] Count Up: all 48 cells contain either the target or a valid distractor.
- [x] Bin Toss: scored-ball settle animation, delayed visible counter, and 72px drag-to-cancel zone.
- [x] Bullseye: stored seeded wind −3…+3, exact scaled-ring displacement, and per-arrow reveal details.
- [x] Re-ran the 200-run Bullseye identity proof and focused static checks.

## 2026-09-22 — Bin Toss wind, harder Bullseye, Bomb Defusal by construction

- Bin Toss: wind is a constant sideways acceleration calibrated so one wind point
  drifts the ball exactly half a bin opening (50 px) at rim height; the dotted aim
  path always shows the no-wind arc; wind −3 … +3 shown below the HUD.
- Bullseye: outer ring 114 px at arrow 1, target centre 40% down the play area.
- Bomb Defusal: plan chosen first, then four template rules true of it, then a
  proof over all 3,024 ordered four-action sequences (exactly one survives, and
  every rule is necessary). ~39 panel rolls on average, ~36 ms a panel.

## 2026-09-22 — six-rule bombs, swaying bullseye, softer wind, gentler hover
- Bomb Defusal: six rules per panel (a necessary core of four plus two confirming rules), distinct action pairs, 14 px rule lines; ~33 panel rolls per card.
- Bullseye: deterministic tick-based aim sway (120-tick circle, 0.6 ring width) from a fixed integer table; aim path and landing ring include it.
- Bin Toss: one wind point now drifts a quarter of the bin opening (25 px).
- Hover: scroll step 20 (+0.08 px/tick per gate); a clean run is now 45 gates.

## 2026-09-22 — four new arcade games: Snake, Cross, Dual, Ricochet
- Shared sims in src/lib/arcade/{snake,cross,dual,ricochet}.ts; 60 ticks/s, integer
  1/256-px constants, seeded mulberry32 in state, whole course built at init.
- Inputs: snake k=4 (swipe direction), cross k=5 (hop/left/right), dual k=6 (side),
  ricochet k=0 (tap); per-game declared ranges, 300-tick checkpoints, clientLag.
- Server replay and practice grading in src/lib/duel/{snake,cross,dual,ricochet}.ts;
  registry, help cards, reveals and standings summaries added.
- Cross proves every crossing passable with a (lane, column, tick) search; Dual
  keeps 20/12-tick separation across sides; Ricochet spikes are 90 px apart on a
  wall and never facing.
- scripts/arcade-four-check.ts: 200-run client/server identity per game, payload
  range rejection, lag handling — all passing.

## Drag arcade games (Breaker, Rally, Steady)
- [x] Shared deterministic sims `src/lib/arcade/{breaker,rally,steady}.ts` (60 ticks/s, integer 1/256-px constants, seeded mulberry32, new drag input k=7)
- [x] Server replays `src/lib/duel/{breaker,rally,steady}.ts` with 300-tick checkpoints, desync logging and clientLag handling
- [x] Screens `src/puzzles/{breaker,rally,steady}.tsx` (pointer capture, DPR<=2, no-scroll 390x700 and 375x667)
- [x] Wiring: types, secrets, generators, registry, instructions, grading, round summaries
- [x] Proof `scripts/arcade-drag-check.ts` — 200 random drag traces per game: identical states/checkpoints/scores, inflated claims caught, out-of-range payloads refused, lag handled

- [x] Arcade additions: Slice (swipe segments), Bubble Pop (drag-aim shots) and Beat (lane taps) on the shared deterministic engine, with server replay, 300-tick checkpoints and a 200-run identity proof (`scripts/arcade-slice-bubble-beat-check.ts`).

- Chat panel closes by button/outside tap/swipe; Nonogram 120s; Intruder 5s/1s/3s one-tap boards; Equation five numbers; One-Stroke 30s; arcade reveals show game stats only (metres, seconds) with desync logged but hidden.

## Arcade rework (Breaker / Rally / Steady)
- Breaker: 8x8 wall, speed +26 per brick and +51 per 10s (cap 1920), 3 seeded gold bricks dropping MULTI/SPAM/LASER capsules, multi-ball (cap 8), gold power-up button (k=10).
- Rally: +3% per hit (cap 2.2x), paddle -5 px to 40 min, seeded gold ball every 10s scoring 6.
- Steady: ball on a fixed line, x-only drag, track 44 -> 18 px (1 px per 4s), scroll 1.2 -> 3.0 px/tick (+0.15 per 5s), reveal in metres.
- 200-run identity proof re-run for all three; all other arcade proofs and the build pass.

## Six arcade tunings (done)
- Slice: launch rate ramps 1 → 4 per 1.5 s; seeded FRENZY (5 s bomb-free burst) and LINE (row of six, 2 s hang) specials, 1–2 each, never in the first 10 s; totals count specials and their spawns.
- Bubble Pop: 90 s run, five distinct colours with per-colour symbols.
- Snake renamed "Eat and Grow" (mechanics unchanged).
- Cross: four-way swipe input, one-second kerb pause between crossings with inputs dropped and unlogged, "Crossing N" banner.
- Dual: scroll 2.0 → 4.4 px/tick, +0.3 every 10 s.
- Bullseye: outer ring 91 px, new scoring curve (ten centres = 150, −10 per point dropped above 90, T × 0.55 below).
- Proofs: all arcade checks pass, incl. a new Slice specials check (payload spawn counts, no bombs in a frenzy, client/server identity).

## Fixes and tuning (Sep 23)
- [x] Unblock: no solver in rooms; 400-layout bank in the database with recent avoidance; guarded reveal.
- [x] Arcade clock shows the run (sim-driven), 0.0 when the sim ends.
- [x] Arcade reveal mismatch: 2,000-event cap made the server replay with no inputs; cap now 6,000.
- [x] One par-based arcade scoring formula; SCORE lines updated.
- [x] Mirror Match five shapes, 60 s.
- [x] Dual smaller blocks, double jump, +25% jump.
- [x] Ricochet 85% spikes, 60 px clear gap, slide keyed to height.
- [x] Breaker power-up button is its own target.

## Arcade client/server agreement
- [x] Arcade answers no longer cut at 4,000 chars (root cause)
- [x] Sim reads only the recorded log, all 16 games
- [x] Server clamps and counts bad inputs
- [x] Dev diagnostics (?dev=1)
- [x] Slice launch speed/angle variation

## Categories, persistent rooms, Slice and Dual (Sep 23)
- [x] Eight-category host picker, presets, persisted selection and even six-round draw without repeated types. Memory is displayed but unavailable while every memory type remains retired.
- [x] Reuse room/code on play again; retain tournament history, disband and host-disconnect handling.
- [x] Slice seeded speed classes and smaller faster specials; identity proof (200/200).
- [x] Dual thin javelin spikes with matching collision; identity proof (200/200).

## Arcade scoring and tuning (Sep 24)
- [x] Intro shows run length (60/90 s), not phase slack.
- [x] Ricochet: 1 pt/m, 75% ball, seeded tightening spike gaps, cross-wall offset, reachability search.
- [x] Dual: 50% spikes, ×1.3 jump, 150 × (s/60)² scoring.
- [x] Cross 4/lane +4/crossing; Eat and Grow 5/pellet; Beat 1/0.75/0.25/−2.
- [x] Bubble Pop 150 − 3 per bubble left; Slice 150 × sliced ÷ all available (specials' batches included).
- [x] Steady: centred ball, no nudge, repeating edge/lift touches, 150 − 5/touch.

## Arcade scoring and tuning, part 2 (Sep 24)
- [x] Rally: blue ball, 3 per gold hit
- [x] Breaker: bottom-quarter drag zone, 9×8 wall, 4 starred gold bricks, 2 per brick / all 72 = 150
- [x] Matchup: T/L STAR clears both diagonals; floor(150 × raw ÷ 2000)
- [x] Bullseye: 45 s, 100 = 150 else 146 − 3 per point short
- [x] Skyline 3/block + 2/perfect; Swerve exactly 75 coins, 2 each; Hover exactly 45 gates, 2 each, all = 100
- [x] Bin Toss: wind ±1..±4, 80 px bin, 10/basket + whole seconds left on 10/10
- [x] Verified: 200/200 self-replay for all 16 games, typecheck and build OK

## Two new word rounds (Sep 29)
- [x] Tile Grid (60 s, reveal 8 s)
- [x] Word Slide (60 s, reveal 6 s)
- [x] Sum Hunt (number, 45 s, reveal 6 s)
- [x] Balance (number, 60 s, reveal 8 s)

## Three-stage rounds (Sep 29)
- [x] Equation Balancing: 3/4/5-number stages, 60 s, 30/40/50 + time bonus
- [x] Symbol Scan: 5×5/6×6/7×7, 45 s, 30/35/35 − 3 per wrong tap + bonus
- [x] Count Up: 5×4/7×6/full grid, 45 s, exact/near-miss weights + bonus

## New rounds (Sep 29)
- [x] Whack-a-Target (attention, arcade engine, 30 s)
- [x] Tents and Trees (logic, 7×7, 90 s, unique solution)

## New arcade games (Sep 29)
- [x] Wavefront
- [x] Bastion
- [x] Rooftop Run

- [x] Sort Rush, Flip and Parry arcade games (200-run identity proofs passed)
- [x] Junction and Ink Bridge arcade games (200-run identity proofs passed)
- [x] Burst arcade game (200-run identity proof passed)

- [x] Orbit and Swing arcade games (200/200 identity proof)
- [ ] Swing: confirm scroll speed vs 2-per-metre cap (cap reached ~25 s at spec speed)
- [x] Tilt and Hot Floor arcade games (200/200 identity proof)
- [ ] Hot Floor: confirm pickup count (~30-38 per run vs ~60 spec)
- [x] Shikaku and Light Up logic rounds (50/50 unique each)

- [x] Hot Floor plan-then-go, Tilt harder mazes, root-level iOS selection lock, Flip harder (2026-09-30)

## Oct 2 — Logic category changes
- [x] Pipes 7×7, 120 s, new stepped scoring
- [x] Lights Out 6×6, minimum 8–12, 75 s
- [x] Colour Connect 9×9, 10–12 pairs, 2–4 walls, unique, 75 s, 60 × joined ÷ pairs
- [x] Tower 9 discs, 3 or 4 pegs per puzzle, minimum 20–40, 90 s
- [x] Sort the Tubes capacity 5, 90 s
- [x] One-Stroke retired (practice only)
- [x] Bomb Defusal 40-template rule bank

## Oct 2 — Arcade changes, part 1
- [x] Retire Swerve, Dual, Ricochet, Steady, Sort Rush, Parry, Hot Floor (practice only)
- [x] Ink Bridge collision hardening + 500-drop line check
- [x] Skyline camera pull-back (render only) + city backdrop
- [x] Bullseye moving target on arrows 6–10
- [x] Cross cars/lorries, 3 lives, clean-crossing bonus
- [x] Slice combo ×1–×3, 25% longer cut, combo meter

## Stop Watch, Chain, Whack, and Clay update (Oct 2)
- [ ] Correct Stop Watch bounce/wrap movement and right-edge pass counters from 2–11.
- [ ] Scatter each 28-node Chain set with enforced non-touching spacing.
- [ ] Extend Whack-a-Target to 60 seconds with queued pop-ups and universal three-second retreats.
- [ ] Compact Clay Shoot status, conceal gold lineup discs until resolved, and reclaim arena height.
- [ ] Run only Whack-a-Target and Clay Shoot self-replay proofs plus focused source checks; no browser tests.

## Number & Speed tuning (Oct 3)
- [x] Ten Drop sparser digits spread 1–10, operators needed on every target
- [x] Number Pyramid levels shifted, new hardest Level 4, 120 s, bank rebuilt (400 × 4)
- [x] Number Hunt 24 numbers
- [x] Chain: set counter removed, Lock in button
- [x] Whack: decoys drop at 1.5 s, 45 targets, 3 pts, +15 perfect
- [x] Clay: launch origins in lower half / middle band only

## Whack lifetimes and memory removal (Oct 3)
- [x] Whack-a-Target: every ball (target and decoy) drops after 1 s if not whacked; scoring unchanged.
- [x] Rooms never draw memory: addMemory option removed from the draw, memory filtered from saved category settings; memory games stay in practice.
- [x] Whack-only self-replay proof (200/200) and typecheck; no browser tests.

## Clay and Whack tuning follow-up (Oct 3)
- [x] Clay Shoot minimum on-screen time lowered from 1.2 s to 0.6 s; ⅔-width coverage rule unchanged.
- [x] Whack-a-Target pop gap ramps 42→10 ticks so the final third regularly has 2–3 balls up (cap 3, never same hole twice); 900→450 ms lifetimes unchanged.
- [x] Identity proofs run only for Clay Shoot and Whack-a-Target (200/200 each); no browser tests.

## Intruder and Pair Match timing follow-up (Oct 3)
- [x] Intruder Detection: per board 1 s card → 7 s memorise → 1 s blank → 5 s pick → 1 s hold; round 75 s, shared timer bar follows INTRUDER_TIME_MS.
- [x] Pair Match: 90 s; complete rounds pay 100 + round(50 × ms_remaining ÷ 90,000) plus the ≤18 flip-pairs +20; partial scoring unchanged.
- [x] Typecheck clean; no timing-proof scripts exist for either game; no browser tests.

## Pattern tuning (Oct 3)
- [x] Block Party's nine pieces use nine distinct fills, matched between tray and board; pegs and scoring unchanged.
- [x] Ice Slide displays each move along its full slide path, including portal arrival/departure and arrow turns, without changing submitted moves.
- [x] Laser direction chevron shrunk, splitter branches animated only after the beam reaches them, beam travel slowed ~25%.
- [x] Rotating Rings chain images removed from both legends; links and legends otherwise unchanged.
- [x] Source checks and typecheck; no browser tests.

## Ball Track rework (Oct 3)
- [x] Replace old blocker/GO rules with 8×6 rotating pipes, eight colour-matched balls/buckets, sequential animated drops and replay grading.
- [x] Rebuild 400 answer-first boards with proven 10–16 simultaneous-configuration minimum rotations and server-only solutions.
- [x] Update intro, reveal, scoring, instructions and round summaries; source-check narrow layouts and replay without browser tests.

## Ball Track rework pass 2 (Oct 3)
- [x] Expand to 8×8 with smaller balls and layered tube visuals.
- [x] Add 4–6 blocks, two linked pairs, and two colour gates to shared replay and UI.
- [x] Rebuild 400 boards with 12–20 stored minimum rotations and validate constraints.
- [x] Update intro and verify narrow-layout calculations, types, and build without browser tests.

## Ball Track tuning pass 3 (Oct 3)
- [x] Add deterministic shallow-right and shallow-left runs to replay and bank generation.
- [x] Fix row 1 as dim vertical pipes and rebuild 400 boards at 12–20 rotations with non-crossing pairs.
- [x] Add smaller rolling balls, doubled edge-to-edge tubes, near-wall occlusion, and heavier nested pair links.
- [x] Add the requested top clearance and validate source, bank, replay, types, and narrow-layout geometry without browser tests.

## Ball Track tuning pass 4 (Oct 3)
- [x] Restore three orientations and flat edge-to-edge pipes with visible rolling balls.
- [x] Add four central nonadjacent bombs, stored neighbour damage, shared replay, and explosion effects.
- [x] Restrict gates to rows 3–6, rebuild 400 boards, update intro, and validate without browser tests.

- Validation: 400 solution/scoring/constraint checks and 400 incremental/replay identities passed; preview build OK; no browser tests. Stored minimum remains the intended-route event-plan minimum, not an exhaustive proof over alternate routes.

## Ball Track full rework (Oct 3)
- [x] Arcade sim: 7×7 course, hopper, 5 trays + 2 pits, pipes/flippers/sliders/wheels, 15 balls
- [x] 400-course bank with playbook proof (3 tiers), server replay grading, new scoring
- [x] Intro, reveal, summaries; identity proof 200/200

## Ball Track piece tuning (Oct 3)
- [x] Centre hopper queue on column 4; flat wider pipes and half-tile balls.
- [x] Bidirectional pocket wheel, larger gold flippers, effective one-column slider deflection and drag preview.
- [x] Add piece legend; rebuild 400 courses with demonstrated slide dependence.
- [x] Ball Track-only bank, mechanics and 200-run replay checks; no browser tests.

- Validation: 400/400 courses solved and fail with slides removed; all demonstrate slot deflection; replay identity 200/200, focused piece checks passed. No browser tests.

## Ball Track tube rework (Oct 3)
- [x] 7×7 tube track, rotatable gold tiles, 8 auto-dropped balls, 400-course bank; Ball Track-only proof; no browser tests.

## Ball Track serpentine rework (Oct 4)
- [x] Fixed snaking track, toggle straights to drop, 8 balls at 15 ticks/tile, 400-course bank; Ball Track-only proof; no browser tests.

## Ball Track pace and tube tuning (Oct 4)
- [x] Plain grey rotatable tubes, black fixed tubes, small piece gaps; ten balanced balls at five-second drops over 60 seconds, updated scoring and instructions.
- [x] Regenerate 400 courses: all playbooks route 10/10 home, replay identity 200/200, drop schedule and scoring checks passed; no browser tests.

## Ball Track fixed placement and pace tuning (Oct 4)
- [x] Gold fixed tubes, four-second drops, twelve-tick movement; keep sixty-second run and scoring.
- [x] Regenerated 400 courses and practice fallback: every course uses seven extra fixed straights and the optimal one triple stack, never four.
- [x] Ball Track-only proof: 400/400 playbooks route 10/10 home, replay identity 200/200, drop schedule passed; no browser tests.

## Dig rework
- [x] Sim fixes (level flow, orthogonal drag interpolation, settling, early end), budget, acid, lava, evaporation, two-drain hard boards; bank 300 (200/100) rebuilt and proven; no browser tests.
- [x] Dig hole-seeking flow; bank 300 rebuilt (routes up to 8 along a shelf, pools 3–6 wide); dig-check 0 problems; no browser tests.

## Arcade tuning pass (Oct 4)
- [x] Hover pace/gaps, Matchup 7×8/refills, Bubble starting clusters/extra row/circles.
- [x] Beat two-ended hold judgement and visible heads/tails; Cross road lanes/start respawn.
- [x] Burst permanent arrows/two lives; Orbit red-box removal; Tilt circle/spikes; Bastion practice-only.
- [x] Focused mechanics checks and self-replay ONLY Hover, Matchup, Bubble, Beat, Cross, Burst, Orbit, Tilt; no browser tests.

- Validation: all eight requested games passed 200/200 full-state/checkpoint/score self-replays; 1,000 Hover/Bubble seed checks, 200 Matchup boards and focused hold/respawn/lives/retirement checks passed. Hover reaches 42 gates, final gate at 59.93 s; 45 generated pillars already cover the full run. No browser tests.
- [x] Puzzle intro demos: player, Intro examples switch, touch recording + save (device check pending)
- [x] Trail recordable (scaled cell lookup); retired games get no authored demos

## Orbit, Matchup, Swing and Wavefront visual tuning (Oct 5)
- [x] Tune colours, paths, facets, ceiling-connected rock, silver armour and bounded beams in renderers only.
- [x] Beam bounds/colours, white-free gem fills, renderer smoke and read-only-state checks passed; only four renderer files changed, protected gameplay and audio untouched; preview build OK. No browser tests or identity proofs; device appearance remains user-tested.

## Flip lava-tube theme (Oct 5)
- [x] Replace Flip artwork with curved glowing basalt tunnel, silhouette-clipped hot-core rock, exterior-only background decoration and runner-box-clipped headlamp robot.
- [x] Swing-volume lava hiss loop added with stop cleanup; animated intro and answer backdrop already share flipArtGame. 72 renderer-only smoke/state/clip checks and shared FX checks passed; protected gameplay files unchanged, preview build OK. No browsers or identity proofs; device appearance and FPS remain user-tested.
