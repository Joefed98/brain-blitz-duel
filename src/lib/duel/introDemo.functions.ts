import { BASTION_REV_DEALT } from "@/lib/arcade/bastionTank";
import { DEPTH_DEMO_STOPS, DEPTH_REV, depthRevOf } from "./logicDepth";
import { SWING_REV_DARK } from "@/lib/arcade/swing";
import { INK_REV_SPREAD, INK_REV_STD } from "@/lib/arcade/inkBridge";
import { CLAY_REV_DEPTH } from "@/lib/arcade/clayShoot";
import { WHACK_REV_NOTES } from "@/lib/arcade/whack";
import { WORDFALL_REV } from "@/lib/arcade/wordfall";
import { BRK_REV_STD } from "@/lib/arcade/breaker";
import { TILT_REV_STD } from "@/lib/arcade/tilt";
import { CROSS_REV_STD } from "@/lib/arcade/cross";
import { FLIP_REV_STD } from "@/lib/arcade/flip";
import { SNIP_REV_EXPAND } from "@/lib/arcade/snip";
import { HOVER_REV_STANDARD } from "@/lib/arcade/hover";
import { RALLY_REV_STD } from "@/lib/arcade/rally";
import { WAV_REV_STD } from "@/lib/arcade/wavefront";
import { BURST_REV_STD } from "@/lib/arcade/burst";
import { BULLSEYE_REV_STD } from "@/lib/arcade/bullseye";
import { BEAT_REV_STD } from "@/lib/arcade/beat";
import { SNAKE_REV_12 } from "@/lib/arcade/snake";
import { SLICE_REV_BIG, SLICE_REV_STANDARD, SLICE_REV_TALL } from "@/lib/arcade/slice";
import { BINTOSS_REV_STD } from "@/lib/arcade/binToss";
import { BUB_REV_STD } from "@/lib/arcade/bubble";
import { MATCHUP_REV_SIX } from "@/lib/arcade/matchup";
import { TEN_DROP_DEPTH_REV } from "@/lib/arcade/tenDrop";
import { SKYLINE_REV_STD } from "@/lib/arcade/skyline";
import { pinIsExpanded } from "@/lib/arcade/pinball";
import { PIN_REV_STD } from "@/lib/arcade/pinball";
import { chainDemoCompatible } from "./chain";
import { pairUsesDepth } from "./depth/matchmaker";
import { STRIKEOUT_REV4 } from "./strikeout";
import { createServerFn } from "@tanstack/react-start";
import { isD4Type, isDepth4 } from "./depth4/stamps";

import type { PuzzleData } from "./types";
import type { PuzzleDemoLog } from "./puzzleDemo";
import { ORBIT_BELT_PERIOD_TICKS, ORBIT_BELT_REVISION, ORBIT_REV3, ORBIT_REV4, ORBIT_REV_BAND, ORBIT_REV_TUNED, ORBIT_REV_XP, ORBIT_REV_STD, ORBIT_REV_FUEL } from "@/lib/arcade/orbit";
import { BT_BALLS, BT_V7_BALLS, btIsV7Play } from "@/lib/arcade/ballTrack";
import { clashPlays3, CLASH_REV_DEPTH } from "@/lib/arcade/colourClash";

export interface IntroDemoRow {
  game_type: string;
  seed: number;
  puzzle: PuzzleData;
  /** Engine games: { run }. Puzzle games: a PuzzleDemoLog. */
  input_log: { run?: string; orbitBeltPeriodTicks?: number; orbitBeltRevision?: number } & Partial<PuzzleDemoLog>;
  example_id?: string | null;
  start_tick: number;
  length_ticks: number;
}

/** Public read: the saved demo for one game, or null. */
export const getIntroDemoFn = createServerFn({ method: "GET" })
  .inputValidator((input: { type: string }) => ({ type: String(input?.type ?? "").slice(0, 40) }))
  .handler(async ({ data }): Promise<IntroDemoRow | null> => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
    const client = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: row, error } = await client
      .from("intro_demos" as never)
      .select("game_type, seed, puzzle, input_log, start_tick, length_ticks, example_id")
      .eq("game_type", data.type)
      .maybeSingle();
    if (error) {
      console.error("[intro demo] read failed", error.message);
      return null;
    }
    const demo = (row as IntroDemoRow | null) ?? null;
    if (data.type === "orbit" && (demo?.input_log.orbitBeltPeriodTicks !== ORBIT_BELT_PERIOD_TICKS || demo?.input_log.orbitBeltRevision !== ORBIT_BELT_REVISION)) return null;
    // Rev3 (scrolling-camera, wider zig-zag world) demos cannot replay as the legacy fixed-camera course, and vice versa.
    if (data.type === "orbit" && demo?.puzzle.type === "orbit" && (demo.puzzle.orbitRev ?? 0) !== ORBIT_REV3 && demo.puzzle.orbitRev !== ORBIT_REV4 && demo.puzzle.orbitRev !== ORBIT_REV_BAND && demo.puzzle.orbitRev !== ORBIT_REV_TUNED && demo.puzzle.orbitRev !== ORBIT_REV_XP && demo.puzzle.orbitRev !== ORBIT_REV_STD && demo.puzzle.orbitRev !== ORBIT_REV_FUEL) return null;

    // The fixed-splitter demo cannot replay the new movable-piece example.
    if (data.type === "laser" && demo?.puzzle.type === "laser" && demo.puzzle.splitterPieces !== 1) return null;
    // Old Ball Track queues and release timings cannot replay the current run.
    if (data.type === "balltrack" && demo?.puzzle.type === "balltrack" && demo.puzzle.course.balls.length !== (btIsV7Play(demo.puzzle.btRev) ? BT_V7_BALLS : BT_BALLS)) return null;
    // Open-stream Colour Clash demos cannot replay the fixed-queue run.
    if (data.type === "stroop" && demo?.puzzle.type === "stroop" && !clashPlays3(demo.puzzle.clashRev)) return null;
    // The D5 remodels (25 Oct 2026): Topsy-Turvy gravityRev 3 and Jumbled tilesRev 3 are new games on new boards, so an
    // older demo stays stopped (the intro shows its still) until one is recorded on the new stamp.
    // Joe's phone notes (27 Oct 2026): Topsy-Turvy gravityRev 4 (a ball home blocks) and Gradient tilesRev 4 (tiles lock,
    // new colour schemes) play differently, so only demos recorded on those stamps play.
    if (data.type === "gravity" && demo?.puzzle.type === "gravity" && (demo.puzzle.gravityRev ?? 0) < 4) return null;
    if (data.type === "tiles" && demo?.puzzle.type === "tiles" && (demo.puzzle.tilesRev ?? 0) < 4) return null;
    // Four-step bomb demos cannot replay the six-step example, and version-2 demos show the old clue wording (version 3 rewrote every clue, 14 Oct 2026).
    if (data.type === "bomb" && demo?.puzzle.type === "bomb" && demo.puzzle.bombVersion !== 3) return null;
    // strikeoutRev 3 (15 Oct 2026) shows ten strike markers, three vowel dots and an extra starting letter on words 1–3,
    // and strikeoutRev 4 (19 Oct 2026) twelve strike markers: an older demo would show the old board under the twelve-strike
    // help, so Strikeout's demo stays stopped until one is recorded on a rev-4 puzzle.
    if (data.type === "strikeout" && demo?.puzzle.type === "strikeout" && demo.puzzle.strikeoutRev !== STRIKEOUT_REV4) return null;
    // Block-era Rainbow Bridge demos would show red blocks under the birds wording.
    // x200 (inkRev 10): a taller world with clouds, wind, coins and a shamrock; inkRev 11 (phone notes, 27 Oct 2026) drops
    // the wind and spreads the pickups, so its levels differ: only a demo recorded on inkRev 11 plays (the still shows until then).
    // inkRev 12 (the arcade scoring standard, 29 Oct 2026) keeps inkRev 11's play and HUD exactly, so a demo recorded on either plays.
    if (data.type === "inkbridge" && demo?.puzzle.type === "inkbridge" && demo.puzzle.inkRev !== INK_REV_SPREAD && demo.puzzle.inkRev !== INK_REV_STD) return null;
    // clayRev 5 (14 Oct 2026) flies 14–16 birds and clayRev 6 (16 Oct 2026, taller worlds batch 2) flies them under a
    // taller sky: an older demo would show the old sky, so only a demo recorded on today's clayRev plays.
    // Depth to 200 (25 Oct 2026): clayRev 9 adds doubles and the hit streak, Bonk's whackRev 3 the gold combo and
    // diamonds; an older demo shows none of them, so each stays stopped (the intro shows its still) until re-recorded.
    if (data.type === "clayshoot" && demo?.puzzle.type === "clayshoot" && demo.puzzle.clayRev !== CLAY_REV_DEPTH) return null;
    // Joe's phone notes (27 Oct 2026): whackRev 4 keeps the diamond up longer, so only a demo recorded on it plays.
    if (data.type === "whack" && demo?.puzzle.type === "whack" && demo.puzzle.whackRev !== WHACK_REV_NOTES) return null;
    if (data.type === "chain" && demo?.puzzle.type === "chain" && !chainDemoCompatible(demo.puzzle)) return null;
    // Depth to 200 (25 Oct 2026): Matchmaker's pairRev 1 deals a gold pair and shows the streak; an older demo has
    // neither, so it stays stopped (the intro shows its still) until one is recorded on pairRev 1.
    if (data.type === "pairmatch" && demo?.puzzle.type === "pairmatch" && !pairUsesDepth(demo.puzzle)) return null;
    // Rev-1 Letterfall demos fall faster, deal vowel-heavy runs and have no Enter box under the well.
    if (data.type === "wordfall" && demo?.puzzle.type === "wordfall" && demo.puzzle.wordfallRev !== WORDFALL_REV) return null;
    // Taller worlds batch 1 (16 Oct 2026): a demo recorded on an older revision would show the short world (and its
    // touches would land on the old paddle, ship or floor line), so these four stay stopped until one is recorded on the tall revision.
    // The 200-point expansion (25 Oct 2026, docs/expansions/e3.md): Breaker brkRev 9 plays on a wider, taller court with
    // new features, so its demo stays stopped (the intro shows its still) until one is recorded there.
    // Phone notes (27 Oct 2026): brkRev 10 changes the gold bricks (any 4 hits) and adds a second double-ball brick, so
    // the demo stays stopped until one is recorded on brkRev 10.
    // The arcade scoring standard (29 Oct 2026): brkRev 11 keeps brkRev 10's play but its HUD shows GOLD n/3 and every
    // brick, so the demo stays stopped until one is recorded on brkRev 11.
    if (data.type === "breaker" && demo?.puzzle.type === "breaker" && demo.puzzle.brkRev !== BRK_REV_STD) return null;
    // Bastion bastionRev 2 (1 Nov 2026) is a new game (the tank-defence shooter): a demo of the original turret stays
    // stopped (the intro shows its still) until one is recorded on bastionRev 2.
    if (data.type === "bastion" && demo?.puzzle.type === "bastion" && demo.puzzle.bastionRev !== BASTION_REV_DEALT) return null;
    // Tilt's expansion (tiltRev 8, 26 Oct 2026): three bigger mazes under a camera, keys, ice and quick stars. An older
    // demo would show the small disc, so the intro shows its still until a demo is recorded on tiltRev 8.
    // tiltRev 9 (27 Oct 2026) keeps tiltRev 8's play on lifted curves, under a fixed camera: only a demo recorded on 9 plays.
    // tiltRev 10 (29 Oct 2026, the arcade scoring standard) adds a fourth maze: only a demo recorded on 10 plays.
    if (data.type === "tilt" && demo?.puzzle.type === "tilt" && demo.puzzle.tiltRev !== TILT_REV_STD) return null;
    // Roofbound flipRev 8 (expansion E7, docs/expansions/x200-flip.md): a taller cave whose height changes, moving spikes,
    // trails, checkpoints, speed zones and sweet spots. An older demo would show the short corridor (and none of them),
    // so Roofbound's stays stopped (the intro shows its still) until one is recorded on flipRev 8. flipRev 9 (27 Oct 2026)
    // keeps flipRev 8's play on lifted curves and flipRev 10 (29 Oct 2026) on the arcade scoring standard; its HUD shows the
    // run's score, so only a demo recorded on flipRev 10 plays.
    if (data.type === "flip" && demo?.puzzle.type === "flip" && demo.puzzle.flipRev !== FLIP_REV_STD) return null;
    // The 200-point expansion (26 Oct 2026, docs/expansions/x200-hover.md): Hover hoverRev 9 plays in a 390 × 727 world with
    // tight gates, centre lines, star chains and shields, so its demo stays stopped until one is recorded there. hoverRev 10
    // (the arcade scoring standard, 29 Oct 2026) keeps hoverRev 9's play on new scoring (its HUD's centre figure is the
    // new part), so only a demo recorded on hoverRev 10 plays.
    if (data.type === "hover" && demo?.puzzle.type === "hover" && demo.puzzle.hoverRev !== HOVER_REV_STANDARD) return null;
    // Rally rallyRev 11 (phone notes, 27 Oct 2026): spin shots now curve visibly and targets last 5 s, so an older demo
    // would play differently; it stays stopped until one is recorded on rallyRev 11. rallyRev 12 (the arcade scoring
    // standard, 29 Oct 2026) reverses the spin and scores 200 on the standard, so only a rallyRev 12 demo plays.
    if (data.type === "rally" && demo?.puzzle.type === "rally" && demo.puzzle.rallyRev !== RALLY_REV_STD) return null;
    // The 200 expansion (wavRev 10), then Joe's phone notes (wavRev 11: power-ups from carriers, no streak, the mothership
    // only after wave 5): an older demo shows other play, so it stays stopped until one is recorded on wavRev 11. wavRev 12 (the
    // arcade scoring standard, 29 Oct 2026) keeps wavRev 11 play in new parts; its HUD shows the run's score, so only a demo
    // recorded on wavRev 12 plays.
    if (data.type === "wavefront" && demo?.puzzle.type === "wavefront" && demo.puzzle.wavRev !== WAV_REV_STD) return null;
    // Phone-test notes (27 Oct 2026): Fission burstRev 9's power-ups ride on atoms and its golden atom bounces, so an
    // older demo stays stopped until one is recorded on burstRev 9.
    // The arcade scoring standard (29 Oct 2026): burstRev 10's run is five waves with a golden atom that hurts, so an
    // older demo stays stopped until one is recorded on burstRev 10.
    if (data.type === "burst" && demo?.puzzle.type === "burst" && demo.puzzle.burstRev !== BURST_REV_STD) return null;
    // Expansion E9 (26 Oct 2026, docs/expansions/e9.md): Flightpath bullRev 8 too (Rally and Fission above).
    // bullRev 9 (the arcade scoring standard, 29 Oct 2026) plays as bullRev 8 but a dead-centre dart shows +2, not +7, so
    // only a demo recorded on bullRev 9 plays.
    if (data.type === "bullseye" && demo?.puzzle.type === "bullseye" && demo.puzzle.bullRev !== BULLSEYE_REV_STD) return null;
    // Expansion E2 (25 Oct 2026): Meteor and Tempo demos stay stopped until one is recorded on the 200-point revision.
    // Joe's phone notes (27 Oct 2026): snakeRev 10 adds 2 × 2 rocks, a third wormhole pair and a second lane, so the
    // Meteor demo stays stopped until one is recorded on snakeRev 10. The arcade scoring standard (29 Oct 2026): snakeRev 11
    // scores in new parts (its combo and warp windows are longer), so the demo stays stopped until one is recorded on snakeRev 11.
    // snakeRev 12 (1 Nov 2026): the HUD's star count counts gold stars twice, so only a demo recorded on snakeRev 12 plays.
    if (data.type === "snake" && demo?.puzzle.type === "snake" && demo.puzzle.snakeRev !== SNAKE_REV_12) return null;
    // x200 (26 Oct 2026, docs/expansions/x200-cross.md): Jaywalk crossRev 9 plays a taller 13-lane road with the island,
    // coins, buses and motorbikes; an older demo would show the 9-lane road, so it stays stopped until one is recorded there.
    // The arcade scoring standard (29 Oct 2026, docs/arcade-standard/cross.md): crossRev 10 thins the first crossings'
    // traffic and thickens the later ones, so a crossRev 9 demo stays stopped until one is recorded on crossRev 10.
    if (data.type === "cross" && demo?.puzzle.type === "cross" && demo.puzzle.crossRev !== CROSS_REV_STD) return null;
    // Taller worlds batch 2 (16 Oct 2026): the same for Tempo, Slice, Coral Pop and Mixed Signals (Pull! above), each stopped
    // until a demo is recorded on its tall revision.
    // Phone notes (27 Oct 2026): Tempo's beatRev 10 plays a lighter chart with wider windows; stopped until one is recorded on it.
    // The arcade scoring standard (beatRev 11, 29 Oct 2026): beatRev 10's play, but its HUD shows the standard's points
    // (no "FEVER x2"), so only a demo recorded on beatRev 11 plays.
    if (data.type === "beat" && demo?.puzzle.type === "beat" && demo.puzzle.beatRev !== BEAT_REV_STD) return null;
    if (data.type === "slice" && demo?.puzzle.type === "slice" && demo.puzzle.sliceRev !== SLICE_REV_TALL) return null;
    // Expansion E6 (25 Oct 2026): Coral Pop's deeper reef (bubbleRev 8) replaces the tall tank's field; a demo stays stopped until one is recorded on it.
    // Phone notes (27 Oct 2026): bubbleRev 10's mine blasts two rings, so the demo stays stopped until one is recorded on it.
    // Arcade scoring standard (29 Oct 2026): bubbleRev 11's mine pops only the 4 nearest bubbles; stopped until recorded on it.
    if (data.type === "bubble" && demo?.puzzle.type === "bubble" && demo.puzzle.bubbleRev !== BUB_REV_STD) return null;
    // Depth to 200 (25 Oct 2026): Mixed Signals' clashRev 8 deals "don't sort" and gold words and a streak; a demo
    // recorded on an older revision shows none of them, so it stays stopped until one is recorded on clashRev 8.
    if (data.type === "stroop" && demo?.puzzle.type === "stroop" && demo.puzzle.clashRev !== CLASH_REV_DEPTH) return null;
    // Taller worlds batch 3 (16 Oct 2026): Grappler's taller cavern, Orbit's taller view and Ball Tracker's 12-row board.
    // An older demo would show the short world (and Ball Tracker's would play a 9-row course), so each stays stopped
    // until one is recorded on its tall revision.
    // Grappler's swinging course (swingRev 15, 29 Oct 2026; the assault course, swingRev 14, before it) and its dark
    // ledge runs over 90 s (swingRev 16, 1 Nov 2026): only a demo recorded on swingRev 16 plays; until one is, the intro
    // shows its still. (swingRev 13's, 14's and 15's rules were the same.)
    if (data.type === "swing" && demo?.puzzle.type === "swing" && demo.puzzle.swingRev !== SWING_REV_DARK) return null;
    // The expansion to 200 (orbitRev 12) shows a wider view with stardust, moons and asteroid fields, so Orbit's demo
    // stays stopped (the intro shows its still) until one is recorded on orbitRev 12.
    // orbitRev 13 (the arcade scoring standard) keeps orbitRev 12's play on new scoring; as flipRev 9 did, only a demo recorded on
    // orbitRev 13 plays (its stored score is on the standard), and until one is the intro shows its still.
    // orbitRev 14 (the fuel meter, 1 Nov 2026): new courses, fuel and catching any planet, so only a demo recorded on
    // orbitRev 14 plays; until one is, the intro shows its still.
    if (data.type === "orbit" && demo?.puzzle.type === "orbit" && demo.puzzle.orbitRev !== ORBIT_REV_FUEL) return null;
    // Expansion E6 (25 Oct 2026): Ball Tracker's 13-row board, Gemstone's taller board with goals: each stays stopped
    // until a demo is recorded on its new revision (btRev 7, matchupRev 9). Ball Tracker btRev 8 (the arcade scoring
    // standard, 29 Oct 2026) keeps btRev 7's play exactly (its board shows no score), so a demo recorded on 7 or 8 plays.
    if (data.type === "balltrack" && demo?.puzzle.type === "balltrack" && !btIsV7Play(demo.puzzle.btRev)) return null;
    // Gemstone's matchupRev 10 (27 Oct 2026: 90 s, swaps into and out of ice, ice laid once) plays differently again, so
    // only a demo recorded on matchupRev 10 plays; until one is, the intro shows its still. matchupRev 11 (the arcade scoring
    // standard: four treasures that swap, four goal levels) moves it on again, and matchupRev 12 (six goals shown at once,
    // six treasures) again: only a demo recorded on matchupRev 12 plays.
    if (data.type === "matchup" && demo?.puzzle.type === "matchup" && demo.puzzle.matchupRev !== MATCHUP_REV_SIX) return null;
    // The 200-point expansion (26 Oct 2026, docs/expansions/x200-snip.md): Scrumper's snipRev 11 tall courses with several
    // fruits and a vertical camera. An older demo shows the old one-apple levels, so the intro shows its still until a demo
    // is recorded on snipRev 11.
    if (data.type === "snip" && demo?.puzzle.type === "snip" && demo.puzzle.snipRev !== SNIP_REV_EXPAND) return null;
    // Tenfall tenRev 4 (25 Oct 2026, depth to 200): gold tiles. An older demo shows no gold tile under the gold-tile
    // help, so Tenfall's intro shows its still until a demo is recorded on tenRev 4.
    if (data.type === "tendrop" && demo?.puzzle.type === "tendrop" && (demo.puzzle.tenRev ?? 0) < TEN_DROP_DEPTH_REV) return null;
    // Logic depth to 200 (depthRev 1, 25 Oct 2026): Mosaic, Tents and Trees, Shikaku and Lamplighter deal bigger boards, and
    // Blackout, Hanoi, Polypotions and Safe Cracker show their par line or clean crack: an older demo would show the old
    // board or no feature, so these stay stopped (the intro shows its still) until one is recorded on depthRev 1.
    if (DEPTH_DEMO_STOPS.has(data.type) && depthRevOf(demo?.puzzle) < DEPTH_REV) return null;
    // Depth batch 4 (25 Oct 2026, docs/depth/d4-pattern.md): Gridlock, Tessellate, Pipeline, Chroma Lines, Skid, Heave,
    // Lightbender and Turntable deal new stamps (par, gems, the gold crate, spare mirrors, the 7×7 board). A demo recorded
    // on an older puzzle would show the old rules, so each intro shows its still until a demo is recorded on the new stamp.
    if (isD4Type(data.type) && demo && !isDepth4(demo.puzzle)) return null;
    // Expansion E4 (25 Oct 2026, docs/expansions/e4.md): High Rise's skylineRev 7 (taller view, special blocks, the
    // next-block preview, milestones). An older demo would show the old view without them, so the intro shows the
    // still until a demo is recorded on skylineRev 7. skylineRev 8 (27 Oct 2026, Joe's phone notes) keeps rev 7's play on a
    // gentler curve. skylineRev 9 (29 Oct 2026, the arcade scoring standard) deals five gold blocks at new places and
    // scores on the standard: only a skylineRev 9 demo plays (its gold blocks and score are the ones the help states).
    if (data.type === "skyline" && demo?.puzzle.type === "skyline" && demo.puzzle.skylineRev !== SKYLINE_REV_STD) return null;
    // Pinball's pinRev 4 (the taller table, its ramps, lanes, lock and plunger): only a demo on that table plays
    // (pinRev 4 or 5: pinRev 5 plays the same table tick for tick, only for 90 s instead of 60).
    // pinRev 6 (29 Oct 2026, the arcade scoring standard): the same play with no multiplier, so an older demo's table
    // would light multiplier inserts and count table points the help no longer states; only a pinRev 6 demo plays
    // (as High Rise's skylineRev 8), and until one is recorded the intro shows its still.
    if (data.type === "pinball" && demo?.puzzle.type === "pinball" && demo.puzzle.pinRev !== PIN_REV_STD) return null;
    // World expansion E5 (25 Oct 2026, docs/expansions/e5.md): Swish binRev 7 and Slice sliceRev 9
    // play in larger worlds with new features; an older demo would show the old world (and its touches would land
    // elsewhere), so each shows its still until a demo is recorded on its new revision.
    // Swish binRev 8 (phone notes, 27 Oct 2026): the far bucket is 60 % of its size, so an older demo's far baskets
    // could miss; it stays stopped until one is recorded on binRev 8.
    // Swish binRev 9 (the arcade scoring standard, 29 Oct 2026): new scoring and, on some seeds, a re-placed hoop; only a
    // binRev 9 demo plays (its score is the one the help states).
    if (data.type === "bintoss" && demo?.puzzle.type === "bintoss" && demo.puzzle.binRev !== BINTOSS_REV_STD) return null;
    // Slice sliceRev 10 (27 Oct 2026, Joe's phone notes): bigger onions and golden fruit; only a sliceRev 10 demo plays.
    if (data.type === "slice" && demo?.puzzle.type === "slice" && demo.puzzle.sliceRev !== SLICE_REV_BIG) return null;
    // Slice sliceRev 11 (29 Oct 2026, the arcade scoring standard): the new parts and bread tickets; only a sliceRev 11 demo plays.
    if (data.type === "slice" && demo?.puzzle.type === "slice" && demo.puzzle.sliceRev !== SLICE_REV_STANDARD) return null;

    return demo;
  });

