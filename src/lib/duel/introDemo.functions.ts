import { DEPTH_DEMO_STOPS, DEPTH_REV, depthRevOf } from "./logicDepth";
import { SWING_REV_EXPAND } from "@/lib/arcade/swing";
import { INK_REV_EXPAND } from "@/lib/arcade/inkBridge";
import { CLAY_REV_DEPTH } from "@/lib/arcade/clayShoot";
import { WHACK_REV_DEPTH } from "@/lib/arcade/whack";
import { WORDFALL_REV } from "@/lib/arcade/wordfall";
import { BRK_REV_DEEP } from "@/lib/arcade/breaker";
import { TILT_REV_EXPAND } from "@/lib/arcade/tilt";
import { CROSS_REV_EXPAND } from "@/lib/arcade/cross";
import { FLIP_REV_EXPAND } from "@/lib/arcade/flip";
import { SNIP_REV_EXPAND } from "@/lib/arcade/snip";
import { HOVER_REV_EXPAND } from "@/lib/arcade/hover";
import { RALLY_REV_BONUS } from "@/lib/arcade/rally";
import { WAV_REV_EXPAND } from "@/lib/arcade/wavefront";
import { BURST_REV_CLEAN } from "@/lib/arcade/burst";
import { BULLSEYE_REV_EXPAND } from "@/lib/arcade/bullseye";
import { BEAT_REV_200 } from "@/lib/arcade/beat";
import { SNAKE_REV_200 } from "@/lib/arcade/snake";
import { SLICE_REV_EXPAND, SLICE_REV_TALL } from "@/lib/arcade/slice";
import { BINTOSS_REV_EXPAND } from "@/lib/arcade/binToss";
import { BUB_REV_REEF } from "@/lib/arcade/bubble";
import { MATCHUP_REV_GOALS } from "@/lib/arcade/matchup";
import { TEN_DROP_DEPTH_REV } from "@/lib/arcade/tenDrop";
import { SKYLINE_REV_EXPAND } from "@/lib/arcade/skyline";
import { pinIsExpanded } from "@/lib/arcade/pinball";
import { chainDemoCompatible } from "./chain";
import { pairUsesDepth } from "./depth/matchmaker";
import { STRIKEOUT_REV4 } from "./strikeout";
import { createServerFn } from "@tanstack/react-start";
import { isD4Type, isDepth4 } from "./depth4/stamps";

import type { PuzzleData } from "./types";
import type { PuzzleDemoLog } from "./puzzleDemo";
import { ORBIT_BELT_PERIOD_TICKS, ORBIT_BELT_REVISION, ORBIT_REV3, ORBIT_REV4, ORBIT_REV_BAND, ORBIT_REV_TUNED, ORBIT_REV_XP } from "@/lib/arcade/orbit";
import { BT_BALLS, BT_REV_RUSH, BT_V7_BALLS } from "@/lib/arcade/ballTrack";
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
    if (data.type === "orbit" && demo?.puzzle.type === "orbit" && (demo.puzzle.orbitRev ?? 0) !== ORBIT_REV3 && demo.puzzle.orbitRev !== ORBIT_REV4 && demo.puzzle.orbitRev !== ORBIT_REV_BAND && demo.puzzle.orbitRev !== ORBIT_REV_TUNED && demo.puzzle.orbitRev !== ORBIT_REV_XP) return null;

    // The fixed-splitter demo cannot replay the new movable-piece example.
    if (data.type === "laser" && demo?.puzzle.type === "laser" && demo.puzzle.splitterPieces !== 1) return null;
    // Old Ball Track queues and release timings cannot replay the current run.
    if (data.type === "balltrack" && demo?.puzzle.type === "balltrack" && demo.puzzle.course.balls.length !== (demo.puzzle.btRev === BT_REV_RUSH ? BT_V7_BALLS : BT_BALLS)) return null;
    // Open-stream Colour Clash demos cannot replay the fixed-queue run.
    if (data.type === "stroop" && demo?.puzzle.type === "stroop" && !clashPlays3(demo.puzzle.clashRev)) return null;
    // The D5 remodels (25 Oct 2026): Topsy-Turvy gravityRev 3 and Jumbled tilesRev 3 are new games on new boards, so an
    // older demo stays stopped (the intro shows its still) until one is recorded on the new stamp.
    if (data.type === "gravity" && demo?.puzzle.type === "gravity" && (demo.puzzle.gravityRev ?? 0) < 3) return null;
    if (data.type === "tiles" && demo?.puzzle.type === "tiles" && (demo.puzzle.tilesRev ?? 0) < 3) return null;
    // Four-step bomb demos cannot replay the six-step example, and version-2 demos show the old clue wording (version 3 rewrote every clue, 14 Oct 2026).
    if (data.type === "bomb" && demo?.puzzle.type === "bomb" && demo.puzzle.bombVersion !== 3) return null;
    // strikeoutRev 3 (15 Oct 2026) shows ten strike markers, three vowel dots and an extra starting letter on words 1–3,
    // and strikeoutRev 4 (19 Oct 2026) twelve strike markers: an older demo would show the old board under the twelve-strike
    // help, so Strikeout's demo stays stopped until one is recorded on a rev-4 puzzle.
    if (data.type === "strikeout" && demo?.puzzle.type === "strikeout" && demo.puzzle.strikeoutRev !== STRIKEOUT_REV4) return null;
    // Block-era Rainbow Bridge demos would show red blocks under the birds wording.
    // x200 (inkRev 10): a taller world with clouds, wind, coins and a shamrock; only a demo recorded on it plays (the still shows until then).
    if (data.type === "inkbridge" && demo?.puzzle.type === "inkbridge" && demo.puzzle.inkRev !== INK_REV_EXPAND) return null;
    // clayRev 5 (14 Oct 2026) flies 14–16 birds and clayRev 6 (16 Oct 2026, taller worlds batch 2) flies them under a
    // taller sky: an older demo would show the old sky, so only a demo recorded on today's clayRev plays.
    // Depth to 200 (25 Oct 2026): clayRev 9 adds doubles and the hit streak, Bonk's whackRev 3 the gold combo and
    // diamonds; an older demo shows none of them, so each stays stopped (the intro shows its still) until re-recorded.
    if (data.type === "clayshoot" && demo?.puzzle.type === "clayshoot" && demo.puzzle.clayRev !== CLAY_REV_DEPTH) return null;
    if (data.type === "whack" && demo?.puzzle.type === "whack" && demo.puzzle.whackRev !== WHACK_REV_DEPTH) return null;
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
    if (data.type === "breaker" && demo?.puzzle.type === "breaker" && demo.puzzle.brkRev !== BRK_REV_DEEP) return null;
    // Tilt's expansion (tiltRev 8, 26 Oct 2026): three bigger mazes under a camera, keys, ice and quick stars. An older
    // demo would show the small disc, so the intro shows its still until a demo is recorded on tiltRev 8.
    if (data.type === "tilt" && demo?.puzzle.type === "tilt" && demo.puzzle.tiltRev !== TILT_REV_EXPAND) return null;
    // Roofbound flipRev 8 (expansion E7, docs/expansions/x200-flip.md): a taller cave whose height changes, moving spikes,
    // trails, checkpoints, speed zones and sweet spots. An older demo would show the short corridor (and none of them),
    // so Roofbound's stays stopped (the intro shows its still) until one is recorded on flipRev 8.
    if (data.type === "flip" && demo?.puzzle.type === "flip" && demo.puzzle.flipRev !== FLIP_REV_EXPAND) return null;
    // The 200-point expansion (26 Oct 2026, docs/expansions/x200-hover.md): Hover hoverRev 9 plays in a 390 × 727 world with
    // tight gates, centre lines, star chains and shields, so its demo stays stopped until one is recorded there.
    if (data.type === "hover" && demo?.puzzle.type === "hover" && demo.puzzle.hoverRev !== HOVER_REV_EXPAND) return null;
    if (data.type === "rally" && demo?.puzzle.type === "rally" && demo.puzzle.rallyRev !== RALLY_REV_BONUS) return null;
    // The 200 expansion (wavRev 10): a demo recorded on an older revision shows the shorter arena and no power-ups, so it stays stopped until one is recorded on wavRev 10.
    if (data.type === "wavefront" && demo?.puzzle.type === "wavefront" && demo.puzzle.wavRev !== WAV_REV_EXPAND) return null;
    if (data.type === "burst" && demo?.puzzle.type === "burst" && demo.puzzle.burstRev !== BURST_REV_CLEAN) return null;
    // Expansion E9 (26 Oct 2026, docs/expansions/e9.md): Flightpath bullRev 8 too (Rally and Fission above).
    if (data.type === "bullseye" && demo?.puzzle.type === "bullseye" && demo.puzzle.bullRev !== BULLSEYE_REV_EXPAND) return null;
    // Expansion E2 (25 Oct 2026): Meteor and Tempo demos stay stopped until one is recorded on the 200-point revision.
    if (data.type === "snake" && demo?.puzzle.type === "snake" && demo.puzzle.snakeRev !== SNAKE_REV_200) return null;
    // x200 (26 Oct 2026, docs/expansions/x200-cross.md): Jaywalk crossRev 9 plays a taller 13-lane road with the island,
    // coins, buses and motorbikes; an older demo would show the 9-lane road, so it stays stopped until one is recorded there.
    if (data.type === "cross" && demo?.puzzle.type === "cross" && demo.puzzle.crossRev !== CROSS_REV_EXPAND) return null;
    // Taller worlds batch 2 (16 Oct 2026): the same for Tempo, Slice, Coral Pop and Mixed Signals (Pull! above), each stopped
    // until a demo is recorded on its tall revision.
    if (data.type === "beat" && demo?.puzzle.type === "beat" && demo.puzzle.beatRev !== BEAT_REV_200) return null;
    if (data.type === "slice" && demo?.puzzle.type === "slice" && demo.puzzle.sliceRev !== SLICE_REV_TALL) return null;
    // Expansion E6 (25 Oct 2026): Coral Pop's deeper reef (bubbleRev 8) replaces the tall tank's field; a demo stays stopped until one is recorded on it.
    if (data.type === "bubble" && demo?.puzzle.type === "bubble" && demo.puzzle.bubbleRev !== BUB_REV_REEF) return null;
    // Depth to 200 (25 Oct 2026): Mixed Signals' clashRev 8 deals "don't sort" and gold words and a streak; a demo
    // recorded on an older revision shows none of them, so it stays stopped until one is recorded on clashRev 8.
    if (data.type === "stroop" && demo?.puzzle.type === "stroop" && demo.puzzle.clashRev !== CLASH_REV_DEPTH) return null;
    // Taller worlds batch 3 (16 Oct 2026): Grappler's taller cavern, Orbit's taller view and Ball Tracker's 12-row board.
    // An older demo would show the short world (and Ball Tracker's would play a 9-row course), so each stays stopped
    // until one is recorded on its tall revision.
    // Grappler's 200 expansion (swingRev 13, 26 Oct 2026): a wider, deeper cave with ledges, gems, gates and par
    // times, so only a demo recorded on swingRev 13 plays; until one is, the intro shows its still.
    if (data.type === "swing" && demo?.puzzle.type === "swing" && demo.puzzle.swingRev !== SWING_REV_EXPAND) return null;
    // The expansion to 200 (orbitRev 12) shows a wider view with stardust, moons and asteroid fields, so Orbit's demo
    // stays stopped (the intro shows its still) until one is recorded on orbitRev 12.
    if (data.type === "orbit" && demo?.puzzle.type === "orbit" && demo.puzzle.orbitRev !== ORBIT_REV_XP) return null;
    // Expansion E6 (25 Oct 2026): Ball Tracker's 13-row board, Gemstone's taller board with goals: each stays stopped
    // until a demo is recorded on its new revision (btRev 7, matchupRev 9).
    if (data.type === "balltrack" && demo?.puzzle.type === "balltrack" && demo.puzzle.btRev !== BT_REV_RUSH) return null;
    if (data.type === "matchup" && demo?.puzzle.type === "matchup" && demo.puzzle.matchupRev !== MATCHUP_REV_GOALS) return null;
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
    // still until a demo is recorded on skylineRev 7.
    if (data.type === "skyline" && demo?.puzzle.type === "skyline" && demo.puzzle.skylineRev !== SKYLINE_REV_EXPAND) return null;
    // Pinball's pinRev 4 (the taller table, its ramps, lanes, lock and plunger): only a demo on that table plays
    // (pinRev 4 or 5: pinRev 5 plays the same table tick for tick, only for 90 s instead of 60).
    if (data.type === "pinball" && demo?.puzzle.type === "pinball" && !pinIsExpanded(demo.puzzle.pinRev)) return null;
    // World expansion E5 (25 Oct 2026, docs/expansions/e5.md): Swish binRev 7 and Slice sliceRev 9
    // play in larger worlds with new features; an older demo would show the old world (and its touches would land
    // elsewhere), so each shows its still until a demo is recorded on its new revision.
    if (data.type === "bintoss" && demo?.puzzle.type === "bintoss" && demo.puzzle.binRev !== BINTOSS_REV_EXPAND) return null;
    if (data.type === "slice" && demo?.puzzle.type === "slice" && demo.puzzle.sliceRev !== SLICE_REV_EXPAND) return null;

    return demo;
  });

