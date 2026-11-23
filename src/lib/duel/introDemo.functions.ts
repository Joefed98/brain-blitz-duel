import type { Database } from "@/integrations/supabase/types";
import { record, text } from "@/lib/validate";
import { SHORT_MAX } from "./inputLimits";
import { attentionDemoPlays } from "./attentionDemoRules";
import { cardsDemoPlays } from "./cardsDemoRules";
import { sportsDemoPlays } from "./sportsDemoRules";
import { BASTION_REV_DEALT } from "@/lib/arcade/bastionTank";
import { DEPTH_DEMO_STOPS, DEPTH_REV, depthRevOf } from "./logicDepth";
import { fillominoStrokes, trailUndoEach } from "./logicOverhaul2";
import { SWING_REV_BIG } from "@/lib/arcade/swing";
import { INK_REV_HILLS } from "@/lib/arcade/inkBridge";
import { CLAY_REV_WIDE } from "@/lib/arcade/clayShoot";
import { WHACK_REV_NOTES } from "@/lib/arcade/whack";
import { WORDFALL_REV } from "@/lib/arcade/wordfall";
import { BRK_REV_CLEAR } from "@/lib/arcade/breaker";
import { TILT_REV_BIG } from "@/lib/arcade/tilt";
import { CROSS_REV_LIGHT } from "@/lib/arcade/cross";
import { FLIP_REV_GRACE } from "@/lib/arcade/flip";
import { MOON_MID_REV } from "@/lib/arcade/ricochetNinja";
import { SNIP_REV_EXPAND } from "@/lib/arcade/snip";
import { HOVER_REV_SHIELD } from "@/lib/arcade/hover";
import { RALLY_REV_LIVES, RALLY_REV_STD } from "@/lib/arcade/rally";
import { WAV_REV_BIG } from "@/lib/arcade/wavefront";
import { BURST_REV_SMALL } from "@/lib/arcade/burst";
import { BULLSEYE_REV_STD } from "@/lib/arcade/bullseye";
import { BEAT_REV_FLOOR, BEAT_REV_STD } from "@/lib/arcade/beat";
import { BLOCKFALL_REV_ZONE } from "@/lib/arcade/blockfall";
import { SNAKE_REV_GRACE } from "@/lib/arcade/snake";
import { POOL_REV } from "@/lib/arcade/pool";
import { CURLING_REV } from "@/lib/arcade/curling";
import { RACING_REV_DEALT } from "@/lib/arcade/racing";
import { SLICE_REV_BIG, SLICE_REV_FOOD, SLICE_REV_STANDARD, SLICE_REV_TALL } from "@/lib/arcade/slice";
import { BINTOSS_REV_STD } from "@/lib/arcade/binToss";
import { BUB_REV_FAST } from "@/lib/arcade/bubble";
import { MATCHUP_REV_ICE2 } from "@/lib/arcade/matchup";
import { TEN_DROP_RESET_REV } from "@/lib/arcade/tenDrop";
import { SKYLINE_REV_COUNT, SKYLINE_REV_LIVES } from "@/lib/arcade/skyline";
import { pinIsExpanded } from "@/lib/arcade/pinball";
import { PIN_REV_JOULZ, PIN_REV_SAVE, PIN_REV_STD } from "@/lib/arcade/pinball";
import { chainDemoCompatible } from "./chain";
import { pairUsesDepth } from "./depth/matchmaker";
import { STRIKEOUT_REV4 } from "./strikeout";
import { wordDemoStampOk } from "./wordDemoStamps";
import { createServerFn } from "@tanstack/react-start";
import { NORMAL, puzzleLevel } from "@/lib/levels/levels";

/** The Strategy games whose intro demos are recorded on the intro example deal at Normal (strategy-demos-check). */
const STRATEGY_DEMO_GAMES: ReadonlySet<string> = new Set(["tilt", "matchup", "bubble", "inkbridge", "balltrack"]);
import { puzzleInputDemoCompatible } from "@/components/puzzles/wordInput";
import { isPuzzleDemoLog } from "./puzzleDemo";
import { isD4Type, isDepth4 } from "./depth4/stamps";
import { logicDemoPlays } from "./logicDemoRules";

import type { PuzzleData } from "./types";
import type { PuzzleDemoLog } from "./puzzleDemo";

/**
 * The stamps whose saved intro demo plays, for the games whose newest stamp (the scoring audit's, Nov 2026) changed only
 * the score and kept the previous stamp's play exactly: the stamp rooms deal and the one whose play it keeps (15 Nov 2026;
 * the rules named only the older one, so a demo recorded on the dealt stamp was refused).
 */
export const SAME_PLAY_DEMO_REVS = {
  // wavRev 14 (the Retro overhaul) plays wavRev 13 exactly until a charged shot is fired; a demo on either plays.
  // wavRev 15 (stage 3) has larger hit cells, so only a demo recorded on wavRev 15 plays.
  wavefront: [WAV_REV_BIG],
  // burstRev 13 (the Retro overhaul, 15 Nov 2026) has bigger atoms, so only a demo recorded on burstRev 13 plays (burstRev
  // 12 played burstRev 11 exactly; its demos and 11's are stopped now).
  // burstRev 14 (D5, 22 Nov 2026) has the middle atoms, so only a demo recorded on burstRev 14 plays (13's is stopped).
  burst: [BURST_REV_SMALL],
  // crossRev 13 (stage 3) has lighter traffic, so only a demo recorded on crossRev 13 plays.
  cross: [CROSS_REV_LIGHT],
  // rallyRev 13 (the Retro overhaul) plays rallyRev 12 tick for tick until the first miss, so a demo on either plays.
  rally: [RALLY_REV_STD, RALLY_REV_LIVES],
  // beatRev 12 (the Retro overhaul) plays beatRev 11 exactly (a miss scores 0, not less), so a demo on either plays.
  beat: [BEAT_REV_STD, BEAT_REV_FLOOR],
  // Blockzone blockfallRev 2: only a demo recorded on it plays (blockfallRev 1 had the hold and the pads).
  blockfall: [BLOCKFALL_REV_ZONE],
  // skylineRev 11 (15 Nov 2026, lives): skylineRev 10's play until a miss, so a demo recorded on 10 or 11 plays.
  skyline: [SKYLINE_REV_COUNT, SKYLINE_REV_LIVES],
} as const;

export function demoRevAccepted(game: keyof typeof SAME_PLAY_DEMO_REVS, rev: number | null | undefined): boolean {
  return rev != null && (SAME_PLAY_DEMO_REVS[game] as readonly number[]).includes(rev);
}

/**
 * The stamps the six Action games' intro demos are recorded on (the Action overhaul, stage 3, 15 Nov 2026): the stamps
 * rooms deal. scripts/fixtures/action-demos.json holds a run on each (scripts/action-demos-record.ts), which
 * scripts/action-demos-save.ts saves through saveIntroDemoFn; scripts/action-demos-check.ts proves each equals the
 * live deal's stamp, that introDemoFor plays a demo on it and stops older ones. A new stamp for one of these games
 * moves its entry, its stop rule below and its recorded run together.
 */
export const ACTION_DEMO_REVS = {
  flip: FLIP_REV_GRACE,
  swing: SWING_REV_BIG,
  ricochet: MOON_MID_REV,
  bastion: BASTION_REV_DEALT,
  skyline: SKYLINE_REV_LIVES,
  orbit: ORBIT_REV_BIG,
} as const;
import { ORBIT_BELT_PERIOD_TICKS, ORBIT_BELT_REVISION, ORBIT_REV3, ORBIT_REV4, ORBIT_REV_BAND, ORBIT_REV_TUNED, ORBIT_REV_XP, ORBIT_REV_STD, ORBIT_REV_FUEL, ORBIT_REV_GRACE, ORBIT_REV_BIG } from "@/lib/arcade/orbit";
import { BT_BALLS, BT_V7_BALLS, btIsV7Play } from "@/lib/arcade/ballTrack";
import { minigolfDemoPlays } from "./minigolfDemoRule";
import { clashPlays3, CLASH_REV_DEPTH } from "@/lib/arcade/colourClash";

/**
 * The Number overhaul's intro demos (15 Nov 2026): the eight Number games got new pieces, layouts and controls, so a
 * coordinate demo recorded before it would tap the wrong places. A demo of one of them plays only when its log carries
 * NUMBER_DEMO_REV (added by scripts/number-demos-record.ts, saved by scripts/number-demos-save.ts) and its example
 * carries at least the stamp its Normal deals today (NUMBER_DEMO_MIN_STAMPS; number-demos-check fails when the example
 * deal's stamp moves on without this table, so a new Normal stops the older demo until one is recorded on it).
 */
export const NUMBER_DEMO_GAMES = ["balance", "target", "equation", "numpyramid", "measure", "checkout", "numline", "kakuro"] as const;
export const NUMBER_DEMO_REV = 1;
export const NUMBER_DEMO_MIN_STAMPS: Partial<Record<(typeof NUMBER_DEMO_GAMES)[number], { field: string; min: number }>> = {
  balance: { field: "balanceRev", min: 5 },
  equation: { field: "gapsRev", min: 2 },
  measure: { field: "measureRev", min: 5 },
  checkout: { field: "checkoutRev", min: 4 },
  kakuro: { field: "kakuroRev", min: 3 },
};

/** Whether a saved demo of `type` may play under the Number overhaul's rule (other games: always). */
export function numberDemoPlays(type: string, demo: { puzzle: unknown; input_log: unknown }): boolean {
  if (!(NUMBER_DEMO_GAMES as readonly string[]).includes(type)) return true;
  const log = demo.input_log as { numberDemoRev?: unknown } | null;
  if (log?.numberDemoRev !== NUMBER_DEMO_REV) return false;
  const puzzle = demo.puzzle as Record<string, unknown> | null;
  if (puzzle?.["type"] !== type) return false;
  const stamp = NUMBER_DEMO_MIN_STAMPS[type as (typeof NUMBER_DEMO_GAMES)[number]];
  return !stamp || Number(puzzle[stamp.field] ?? 0) >= stamp.min;
}

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
  .inputValidator((input: { type: string }) => ({ type: text(record(input)["type"], SHORT_MAX, "type") }))
  .handler(async ({ data }): Promise<IntroDemoRow | null> => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
    // A public read with the publishable key (RLS applies), typed on the generated schema.
    const client = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
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
    const { readIntroDemo } = await import("@/lib/data/practice.server");
    const { data: row, error } = await readIntroDemo(client, data.type);
    if (error) console.error("[intro demo] read failed", error.message);
    const live = error ? null : acceptIntroDemo(data.type, (row as unknown as IntroDemoRow | null) ?? null);
    // A demo bundled with the app (bundledDemos/) plays when the live row is missing, refused for an older stamp or
    // recorded on an older presentation; a live row recorded on today's stamp and presentation still wins.
    const { bundledIntroDemo } = await import("./bundledDemos");
    return pickIntroDemo(data.type, live, bundledIntroDemo(data.type));
  });

/**
 * Which demo the intro plays: the live row when it plays on today's stamp and presentation, else the demo bundled with
 * the app (when there is one), else the live row as it was (an older puzzle demo the phone then refuses, as before).
 */
export function pickIntroDemo(type: string, live: IntroDemoRow | null, bundled: IntroDemoRow | null): IntroDemoRow | null {
  if (live && (!isPuzzleDemoLog(live.input_log) || puzzleInputDemoCompatible(type, live.input_log))) return live;
  return bundled ?? live;
}

/** The saved demo for `type` if its stamp still plays today's game, else null (the rules below, one a game). */
export function acceptIntroDemo(type: string, demo: IntroDemoRow | null): IntroDemoRow | null {
  const data = { type };
  // The Strategy overhaul, stage 3 (16 Nov 2026): the intro shows Normal, today's game; a Strategy demo dealt at another
  // level (Easy, Hard, Expert) never plays as the intro.
  if (STRATEGY_DEMO_GAMES.has(data.type) && demo && puzzleLevel(demo.puzzle) !== NORMAL) return null;
  // Crazy Golf golfRev 3 (the overhaul, 15 Nov 2026): only a demo recorded on golfRev 3, on Normal, plays.
  if (demo && !minigolfDemoPlays(data.type, demo.puzzle)) return null;
  // The Home Run and Top Bins overhaul (15 Nov 2026): homerunRev 5 and freekickRev 5 are new games, so only a demo
  // recorded on them, on Normal, plays (sportsDemoRules.ts); an older demo stays stopped and the still shows.
  if (demo && !sportsDemoPlays(data.type, demo.puzzle)) return null;
  // The Sports overhaul (15 Nov 2026): Cue Ball, Curl Champ and Apex demos play only when recorded on the stamp rooms
  // deal (poolRev 4, curlRev 4 with its bigger house view and buttons, racingRev 4's three circuits), so an older
  // recording never shows the old table, sheet or road under today's look.
  if (data.type === "pool" && demo?.puzzle.type === "pool" && demo.puzzle.poolRev !== POOL_REV) return null;
  if (data.type === "curling" && demo?.puzzle.type === "curling" && demo.puzzle.curlRev !== CURLING_REV) return null;
  if (data.type === "racing" && demo?.puzzle.type === "racing" && demo.puzzle.racingRev !== RACING_REV_DEALT) return null;
  if (data.type === "orbit" && (demo?.input_log.orbitBeltPeriodTicks !== ORBIT_BELT_PERIOD_TICKS || demo?.input_log.orbitBeltRevision !== ORBIT_BELT_REVISION)) return null;
  // Rev3 (scrolling-camera, wider zig-zag world) demos cannot replay as the legacy fixed-camera course, and vice versa.
  if (data.type === "orbit" && demo?.puzzle.type === "orbit" && (demo.puzzle.orbitRev ?? 0) !== ORBIT_REV3 && demo.puzzle.orbitRev !== ORBIT_REV4 && demo.puzzle.orbitRev !== ORBIT_REV_BAND && demo.puzzle.orbitRev !== ORBIT_REV_TUNED && demo.puzzle.orbitRev !== ORBIT_REV_XP && demo.puzzle.orbitRev !== ORBIT_REV_STD && demo.puzzle.orbitRev !== ORBIT_REV_FUEL && demo.puzzle.orbitRev !== ORBIT_REV_BIG) return null;

  // The fixed-splitter demo cannot replay the new movable-piece example.
  if (data.type === "laser" && demo?.puzzle.type === "laser" && demo.puzzle.splitterPieces !== 1) return null;
  // The Cards & Board overhaul (15 Nov 2026): only a demo recorded on today's stamps, at Normal, plays (cardsDemoRules.ts).
  if (demo && !cardsDemoPlays(data.type, demo.puzzle)) return null;
  // Old Ball Track queues and release timings cannot replay the current run.
  if (data.type === "balltrack" && demo?.puzzle.type === "balltrack" && demo.puzzle.course.balls.length !== (btIsV7Play(demo.puzzle.btRev) ? BT_V7_BALLS : BT_BALLS)) return null;
  // Open-stream Colour Clash demos cannot replay the fixed-queue run.
  if (data.type === "stroop" && demo?.puzzle.type === "stroop" && !clashPlays3(demo.puzzle.clashRev)) return null;
  // The D5 remodels (25 Oct 2026): Topsy-Turvy gravityRev 3 and Jumbled tilesRev 3 are new games on new boards, so an
  // older demo stays stopped (the intro shows its still) until one is recorded on the new stamp.
  // Joe's phone notes (27 Oct 2026): Topsy-Turvy gravityRev 4 (a ball home blocks) and Gradient tilesRev 4 (tiles lock,
  // new colour schemes) play differently, so only demos recorded on those stamps play.
  // The Pattern overhaul (15 Nov 2026): gravityRev 8 gives undone tilts back and limits each board to par + 8 (and
  // older demos may show stars), so only a demo recorded on gravityRev 8 plays; until then the intro shows its still.
  if (data.type === "gravity" && demo?.puzzle.type === "gravity" && (demo.puzzle.gravityRev ?? 0) < 8) return null;
  // The Pattern overhaul (15 Nov 2026): Chroma Lines flowRev 3 cuts a crossed line and a tap on a dot no longer clears
  // it, so only a demo recorded on flowRev 3 plays; until then the intro shows its still.
  if (data.type === "flow" && demo?.puzzle.type === "flow" && (demo.puzzle.flowRev ?? 0) < 3) return null;
  // The Pattern overhaul (15 Nov 2026): pipesRev 5 turns tiles both ways and shows leaks live, so a demo recorded
  // before it (clockwise taps, no spills) stays stopped until one is recorded on pipesRev 5; the intro shows its still.
  if (data.type === "pipes" && demo?.puzzle.type === "pipes" && (demo.puzzle.pipesRev ?? 0) < 5) return null;
  // The Pattern overhaul (15 Nov 2026): Skid's slideRev 5 gives undone slides back (and older demos may show ice gems),
  // so only a demo recorded on slideRev 5 plays; until then the intro shows its still.
  if (data.type === "iceslide" && demo?.puzzle.type === "iceslide" && (demo.puzzle.slideRev ?? 0) < 5) return null;
  // The Pattern overhaul (15 Nov 2026): Tessellate's blockRev 4 (its presentation already refuses older coordinate demos,
  // wordInput.ts); the stamp too, as the other overhaul games, so only a demo recorded on blockRev 4 plays.
  if (data.type === "blockparty" && demo?.puzzle.type === "blockparty" && (demo.puzzle.blockRev ?? 0) < 4) return null;
  // The Pattern overhaul (15 Nov 2026): Gridlock's unblockRev 4 gives an undone slide back (a demo recorded before it
  // counts the Undo as a move) and Lightbender's laserRev 4 undoes turns and moves too, so only a demo recorded on each
  // new stamp plays; until a live one is saved, the bundled demo plays (bundledDemos/).
  if (data.type === "unblock" && demo?.puzzle.type === "unblock" && (demo.puzzle.unblockRev ?? 0) < 4) return null;
  if (data.type === "laser" && demo?.puzzle.type === "laser" && (demo.puzzle.laserRev ?? 0) < 4) return null;
  if (data.type === "tiles" && demo?.puzzle.type === "tiles" && (demo.puzzle.tilesRev ?? 0) < 4) return null;
  // Operator's gaps (puzzle polish, 3 Nov 2026, gapsRev 1): number and mixed gaps on a new screen, so a signs-only demo
  // stays stopped (the intro shows its still) until one is recorded on gapsRev 1.
  if (data.type === "equation" && demo?.puzzle.type === "equation" && (demo.puzzle.gapsRev ?? 0) < 1) return null;
  // The Attention overhaul (15 Nov 2026): an Attention demo plays only when recorded on today's stamp, on Normal.
  if (demo && !attentionDemoPlays(data.type, demo.puzzle)) return null;
  // Four-step bomb demos cannot replay the six-step example, and version-2 demos show the old clue wording (version 3 rewrote every clue, 14 Oct 2026).
  if (data.type === "bomb" && demo?.puzzle.type === "bomb" && demo.puzzle.bombVersion !== 3) return null;
  // strikeoutRev 3 (15 Oct 2026) shows ten strike markers, three vowel dots and an extra starting letter on words 1–3,
  // and strikeoutRev 4 (19 Oct 2026) twelve strike markers: an older demo would show the old board under the twelve-strike
  // help, so Strikeout's demo stays stopped until one is recorded on a rev-4 puzzle.
  // The Word overhaul (15 Nov 2026): Strikeout deals strikeoutRev 7, and every Word game's demo plays only on the stamp
  // rooms deal today (wordDemoStamps.ts), so a rev-4 demo stays stopped as before and a rev-7 one plays.
  if (data.type === "strikeout" && demo?.puzzle.type === "strikeout" && (demo.puzzle.strikeoutRev ?? 0) < STRIKEOUT_REV4) return null;
  if (demo && !wordDemoStampOk(data.type, demo.puzzle)) return null;
  // Block-era Rainbow Bridge demos would show red blocks under the birds wording.
  // x200 (inkRev 10): a taller world with clouds, wind, coins and a shamrock; inkRev 11 (phone notes, 27 Oct 2026) drops
  // the wind and spreads the pickups, so its levels differ: only a demo recorded on inkRev 11 plays (the still shows until then).
  // inkRev 12 (the arcade scoring standard, 29 Oct 2026) kept inkRev 11's play and HUD exactly, so a demo recorded on either played.
  // inkRev 13 (Nov 2026: clovers, ink par, more birds, no stars or silver coins) deals other levels: only a demo recorded
  // on inkRev 13 plays (the still shows until then). inkRev 14 (3 Nov 2026) draws a bigger coin, clovers and birds on other
  // levels: only a demo recorded on inkRev 14 plays.
  if (data.type === "inkbridge" && demo?.puzzle.type === "inkbridge" && demo.puzzle.inkRev !== INK_REV_HILLS) return null;
  // clayRev 5 (14 Oct 2026) flies 14–16 birds and clayRev 6 (16 Oct 2026, taller worlds batch 2) flies them under a
  // taller sky: an older demo would show the old sky, so only a demo recorded on today's clayRev plays.
  // Depth to 200 (25 Oct 2026): clayRev 9 adds doubles and the hit streak, Bonk's whackRev 3 the gold combo and
  // diamonds; an older demo shows none of them, so each stays stopped (the intro shows its still) until re-recorded.
  // The Speed overhaul (15 Nov 2026): Pull! clayRev 10 (the wider quick-hit window) scores a run differently, so only a
  // demo recorded on clayRev 10 plays (scripts/fixtures/speed-demos.json, speed-demos-check).
  if (data.type === "clayshoot" && demo?.puzzle.type === "clayshoot" && demo.puzzle.clayRev !== CLAY_REV_WIDE) return null;
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
  // brkRev 12 (the Retro overhaul): a 9-row wall, so a demo stays stopped until recorded on brkRev 12.
  if (data.type === "breaker" && demo?.puzzle.type === "breaker" && demo.puzzle.brkRev !== BRK_REV_CLEAR) return null;
  // Bastion bastionRev 2 (1 Nov 2026) is a new game (the tank-defence shooter): a demo of the original turret stays
  // stopped (the intro shows its still) until one is recorded on bastionRev 2.
  if (data.type === "bastion" && demo?.puzzle.type === "bastion" && demo.puzzle.bastionRev !== BASTION_REV_DEALT) return null;
  // Moon Climb (15 Nov 2026, ricoRev 4, the Action overhaul): the bigger ninja on its own collision box. A demo of the old
  // shaft, the ninja wall-climb (ricoRev 2) or the smaller ninja (ricoRev 3) would show other rules, so only a demo
  // recorded on ricoRev 4 plays; until one is, the intro shows its still. ricoRev 5 (22 Nov 2026) the 30 × 60 ninja on
  // its own towers: a ricoRev 4 demo would show the bigger ninja on another tower, so only a demo recorded on 5 plays.
  if (data.type === "ricochet" && demo?.puzzle.type === "ricochet" && demo.puzzle.ricoRev !== MOON_MID_REV) return null;
  // Tilt's expansion (tiltRev 8, 26 Oct 2026): three bigger mazes under a camera, keys, ice and quick stars. An older
  // demo would show the small disc, so the intro shows its still until a demo is recorded on tiltRev 8.
  // tiltRev 9 (27 Oct 2026) keeps tiltRev 8's play on lifted curves, under a fixed camera: only a demo recorded on 9 plays.
  // tiltRev 10 (29 Oct 2026, the arcade scoring standard) adds a fourth maze: only a demo recorded on 10 plays.
  // tiltRev 11 (3 Nov 2026) takes the gold stars away and its HUD shows the par: only a demo recorded on 11 plays.
  // tiltRev 12 (3 Nov 2026) draws bigger marbles, cups and keys in walnut and brass: only a demo recorded on 12 plays.
  if (data.type === "tilt" && demo?.puzzle.type === "tilt" && demo.puzzle.tiltRev !== TILT_REV_BIG) return null;
  // Roofbound flipRev 8 (expansion E7, docs/expansions/x200-flip.md): a taller cave whose height changes, moving spikes,
  // trails, checkpoints, speed zones and sweet spots. An older demo would show the short corridor (and none of them),
  // so Roofbound's stays stopped (the intro shows its still) until one is recorded on flipRev 8. flipRev 9 (27 Oct 2026)
  // keeps flipRev 8's play on lifted curves and flipRev 10 (29 Oct 2026) on the arcade scoring standard; its HUD shows the
  // run's score, so only a demo recorded on flipRev 10 plays. flipRev 11 (3 Nov 2026) deals no gold stars, never takes the
  // trails and shows the flow streak: only a demo recorded on flipRev 11 plays.
  // flipRev 12 (3 Nov 2026) plays flipRev 11 exactly, so a demo recorded on either played.
  // flipRev 13 (15 Nov 2026, the Action overhaul's grace): a crash respawns on the spot and costs 10 s of clean time, on
  // new parts its HUD shows, so only a demo recorded on flipRev 13 plays (scripts/action-demos-save.ts records one).
  if (data.type === "flip" && demo?.puzzle.type === "flip" && demo.puzzle.flipRev !== FLIP_REV_GRACE) return null;
  // The 200-point expansion (26 Oct 2026, docs/expansions/x200-hover.md): Hover hoverRev 9 plays in a 390 × 727 world with
  // tight gates, centre lines, star chains and shields, so its demo stays stopped until one is recorded there. hoverRev 10
  // (the arcade scoring standard, 29 Oct 2026) keeps hoverRev 9's play on new scoring (its HUD's centre figure is the
  // new part), so only a demo recorded on hoverRev 10 plays. hoverRev 11 (stage 3) starts shielded: only a demo on 11 plays.
  if (data.type === "hover" && demo?.puzzle.type === "hover" && demo.puzzle.hoverRev !== HOVER_REV_SHIELD) return null;
  // Rally rallyRev 11 (phone notes, 27 Oct 2026): spin shots now curve visibly and targets last 5 s, so an older demo
  // would play differently; it stays stopped until one is recorded on rallyRev 11. rallyRev 12 (the arcade scoring
  // standard, 29 Oct 2026) reverses the spin and scores 200 on the standard, so only a rallyRev 12 demo plays.
  if (data.type === "rally" && demo?.puzzle.type === "rally" && !demoRevAccepted("rally", demo.puzzle.rallyRev)) return null;
  // The 200 expansion (wavRev 10), then Joe's phone notes (wavRev 11: power-ups from carriers, no streak, the mothership
  // only after wave 5): an older demo shows other play, so it stays stopped until one is recorded on wavRev 11. wavRev 12 (the
  // arcade scoring standard, 29 Oct 2026) keeps wavRev 11 play in new parts; its HUD shows the run's score, so only a demo
  // recorded on wavRev 12 plays.
  // wavRev 13 (the scoring audit) plays wavRev 12 exactly, so a demo recorded on either plays (15 Nov 2026: the rule
  // named only 12, so a demo recorded on the stamp rooms deal was refused).
  if (data.type === "wavefront" && demo?.puzzle.type === "wavefront" && !demoRevAccepted("wavefront", demo.puzzle.wavRev)) return null;
  // Phone-test notes (27 Oct 2026): Fission burstRev 9's power-ups ride on atoms and its golden atom bounces, so an
  // older demo stays stopped until one is recorded on burstRev 9.
  // The arcade scoring standard (29 Oct 2026): burstRev 10's run is five waves with a golden atom that hurts, so an
  // older demo stays stopped until one is recorded on burstRev 10.
  // burstRev 11 (the scoring audit) plays burstRev 10 exactly, so a demo recorded on either plays; burstRev 12 (the Retro
  // overhaul) plays burstRev 11 exactly, so on 15 Nov 2026 a demo recorded on 11 or 12 played; burstRev 13's bigger atoms
  // change the play, so only a demo recorded on burstRev 13 plays.
  if (data.type === "burst" && demo?.puzzle.type === "burst" && !demoRevAccepted("burst", demo.puzzle.burstRev)) return null;
  // Expansion E9 (26 Oct 2026, docs/expansions/e9.md): Flightpath bullRev 8 too (Rally and Fission above).
  // bullRev 9 (the arcade scoring standard, 29 Oct 2026) plays as bullRev 8 but a dead-centre dart shows +2, not +7, so
  // only a demo recorded on bullRev 9 plays.
  if (data.type === "bullseye" && demo?.puzzle.type === "bullseye" && demo.puzzle.bullRev !== BULLSEYE_REV_STD) return null;
  // Expansion E2 (25 Oct 2026): Meteor and Tempo demos stay stopped until one is recorded on the 200-point revision.
  // Joe's phone notes (27 Oct 2026): snakeRev 10 adds 2 × 2 rocks, a third wormhole pair and a second lane, so the
  // Meteor demo stays stopped until one is recorded on snakeRev 10. The arcade scoring standard (29 Oct 2026): snakeRev 11
  // scores in new parts (its combo and warp windows are longer), so the demo stays stopped until one is recorded on snakeRev 11.
  // snakeRev 12 (1 Nov 2026): the HUD's star count counts gold stars twice, so only a demo recorded on snakeRev 12 plays.
  // snakeRev 13 (the Retro overhaul): the edges wrap; snakeRev 14 adds rocks in three sizes, so a demo stays stopped
  // until recorded on snakeRev 14. snakeRev 15 (stage 3) forgives the first crash, so a demo plays only on snakeRev 15.
  if (data.type === "snake" && demo?.puzzle.type === "snake" && demo.puzzle.snakeRev !== SNAKE_REV_GRACE) return null;
  // x200 (26 Oct 2026, docs/expansions/x200-cross.md): Jaywalk crossRev 9 plays a taller 13-lane road with the island,
  // coins, buses and motorbikes; an older demo would show the 9-lane road, so it stays stopped until one is recorded there.
  // The arcade scoring standard (29 Oct 2026, docs/arcade-standard/cross.md): crossRev 10 thins the first crossings'
  // traffic and thickens the later ones, so a crossRev 9 demo stays stopped until one is recorded on crossRev 10.
  // crossRev 11 (3 Nov 2026): no coins and a no-stop streak in the HUD, so only a demo recorded on crossRev 11 plays.
  // crossRev 12 (the scoring audit) plays crossRev 11 exactly, so a demo recorded on either plays.
  if (data.type === "cross" && demo?.puzzle.type === "cross" && !demoRevAccepted("cross", demo.puzzle.crossRev)) return null;
  // Taller worlds batch 2 (16 Oct 2026): the same for Tempo, Slice, Coral Pop and Mixed Signals (Pull! above), each stopped
  // until a demo is recorded on its tall revision.
  // Phone notes (27 Oct 2026): Tempo's beatRev 10 plays a lighter chart with wider windows; stopped until one is recorded on it.
  // The arcade scoring standard (beatRev 11, 29 Oct 2026): beatRev 10's play, but its HUD shows the standard's points
  // (no "FEVER x2"), so only a demo recorded on beatRev 11 plays.
  if (data.type === "beat" && demo?.puzzle.type === "beat" && !demoRevAccepted("beat", demo.puzzle.beatRev)) return null;
  if (data.type === "blockfall" && demo?.puzzle.type === "blockfall" && !demoRevAccepted("blockfall", demo.puzzle.blockfallRev)) return null;
  if (data.type === "slice" && demo?.puzzle.type === "slice" && demo.puzzle.sliceRev !== SLICE_REV_TALL) return null;
  // Expansion E6 (25 Oct 2026): Coral Pop's deeper reef (bubbleRev 8) replaces the tall tank's field; a demo stays stopped until one is recorded on it.
  // Phone notes (27 Oct 2026): bubbleRev 10's mine blasts two rings, so the demo stays stopped until one is recorded on it.
  // Arcade scoring standard (29 Oct 2026): bubbleRev 11's mine pops only the 4 nearest bubbles; stopped until recorded on it.
  if (data.type === "bubble" && demo?.puzzle.type === "bubble" && demo.puzzle.bubbleRev !== BUB_REV_FAST) return null;
  // Depth to 200 (25 Oct 2026): Mixed Signals' clashRev 8 deals "don't sort" and gold words and a streak; a demo
  // recorded on an older revision shows none of them, so it stays stopped until one is recorded on clashRev 8.
  if (data.type === "stroop" && demo?.puzzle.type === "stroop" && demo.puzzle.clashRev !== CLASH_REV_DEPTH) return null;
  // Taller worlds batch 3 (16 Oct 2026): Grappler's taller cavern, Orbit's taller view and Ball Tracker's 12-row board.
  // An older demo would show the short world (and Ball Tracker's would play a 9-row course), so each stays stopped
  // until one is recorded on its tall revision.
  // Grappler's swinging course (swingRev 15, 29 Oct 2026; the assault course, swingRev 14, before it) and its dark
  // ledge runs over 90 s (swingRev 16, 1 Nov 2026) and its sliding hooks and streak (swingRev 17, 3 Nov 2026): only a
  // demo recorded on swingRev 17 plays; until one is, the intro shows its still. (swingRev 13's to 16's rules were the same.)
  // swingRev 18 (15 Nov 2026, the bigger hero on its own courses): only a demo recorded on swingRev 18 plays.
  if (data.type === "swing" && demo?.puzzle.type === "swing" && demo.puzzle.swingRev !== SWING_REV_BIG) return null;
  // The expansion to 200 (orbitRev 12) shows a wider view with stardust, moons and asteroid fields, so Orbit's demo
  // stays stopped (the intro shows its still) until one is recorded on orbitRev 12.
  // orbitRev 13 (the arcade scoring standard) keeps orbitRev 12's play on new scoring; as flipRev 9 did, only a demo recorded on
  // orbitRev 13 plays (its stored score is on the standard), and until one is the intro shows its still.
  // orbitRev 14 (the fuel meter, 1 Nov 2026): new courses, fuel and catching any planet, so only a demo recorded on
  // orbitRev 14 plays; until one is, the intro shows its still.
  // orbitRev 15 (15 Nov 2026, the Action overhaul's grace): a crash or empty tank respawns at the planet left, so only a
  // demo recorded on orbitRev 15 plays (the rule named only 14, so a demo recorded on the stamp rooms deal was refused).
  // orbitRev 16 (stage 3, bigger planets): orbitRev 15's play, drawn with the bigger bodies, so its demo is recorded on 16.
  // A later Orbit stamp moves this line and ACTION_DEMO_REVS.orbit together (scripts/action-demos-check.ts).
  if (data.type === "orbit" && demo?.puzzle.type === "orbit" && demo.puzzle.orbitRev !== ORBIT_REV_BIG) return null;
  // Expansion E6 (25 Oct 2026): Ball Tracker's 13-row board, Gemstone's taller board with goals: each stays stopped
  // until a demo is recorded on its new revision (btRev 7, matchupRev 9). Ball Tracker btRev 8 (the arcade scoring
  // standard, 29 Oct 2026) keeps btRev 7's play exactly (its board shows no score), so a demo recorded on 7 or 8 plays.
  if (data.type === "balltrack" && demo?.puzzle.type === "balltrack" && !btIsV7Play(demo.puzzle.btRev)) return null;
  // Gemstone's matchupRev 10 (27 Oct 2026: 90 s, swaps into and out of ice, ice laid once) plays differently again, so
  // only a demo recorded on matchupRev 10 plays; until one is, the intro shows its still. matchupRev 11 (the arcade scoring
  // standard: four treasures that swap, four goal levels) moves it on again, and matchupRev 12 (six goals shown at once,
  // six treasures) again, and matchupRev 13 (two-hit ice, levels) again: only a demo recorded on matchupRev 13 plays.
  if (data.type === "matchup" && demo?.puzzle.type === "matchup" && demo.puzzle.matchupRev !== MATCHUP_REV_ICE2) return null;
  // The 200-point expansion (26 Oct 2026, docs/expansions/x200-snip.md): Scrumper's snipRev 11 tall courses with several
  // fruits and a vertical camera. An older demo shows the old one-apple levels, so the intro shows its still until a demo
  // is recorded on snipRev 11.
  if (data.type === "snip" && demo?.puzzle.type === "snip" && demo.puzzle.snipRev !== SNIP_REV_EXPAND) return null;
  // Tenfall tenRev 4 (25 Oct 2026, depth to 200): gold tiles. An older demo shows no gold tile under the gold-tile
  // help, so Tenfall's intro shows its still until a demo is recorded on tenRev 4.
  // The Speed overhaul (15 Nov 2026): tenRev 6 charges resets on a finished run too, so only a demo recorded on tenRev 6
  // plays (its score and HUD are the dealt stamp's).
  if (data.type === "tendrop" && demo?.puzzle.type === "tendrop" && demo.puzzle.tenRev !== TEN_DROP_RESET_REV) return null;
  // Logic depth to 200 (depthRev 1, 25 Oct 2026): Mosaic, Tents and Trees, Shikaku and Lamplighter deal bigger boards, and
  // Blackout, Hanoi, Polypotions and Safe Cracker show their par line or clean crack: an older demo would show the old
  // board or no feature, so these stay stopped (the intro shows its still) until one is recorded on depthRev 1.
  if (DEPTH_DEMO_STOPS.has(data.type) && depthRevOf(demo?.puzzle) < DEPTH_REV) return null;
  // Logic overhaul 2 (15 Nov 2026): Trail's depthRev 3 (2.5 a undo) and Regions' fillominoRev 2 (a stroke a mistake) score
  // differently, so only a demo recorded on those stamps plays (their presentation, LOGIC2_PRESENTATION, stops the rest).
  if (data.type === "trail" && demo && !trailUndoEach(demo.puzzle)) return null;
  if (data.type === "fillomino" && demo && !fillominoStrokes(demo.puzzle)) return null;
  // Depth batch 4 (25 Oct 2026, docs/depth/d4-pattern.md): Gridlock, Tessellate, Pipeline, Chroma Lines, Skid, Heave,
  // Lightbender and Turntable deal new stamps (par, gems, the gold crate, spare mirrors, the 7×7 board). A demo recorded
  // on an older puzzle would show the old rules, so each intro shows its still until a demo is recorded on the new stamp.
  if (isD4Type(data.type) && demo && !isDepth4(demo.puzzle)) return null;
  // The Number overhaul (15 Nov 2026): new boards, pieces and layout for all eight Number games, so only a demo saved
  // from scripts/fixtures/number-demos.json (NUMBER_DEMO_REV, on today's Normal stamps) plays.
  if (demo && !numberDemoPlays(data.type, demo)) return null;
  // Expansion E4 (25 Oct 2026, docs/expansions/e4.md): High Rise's skylineRev 7 (taller view, special blocks, the
  // next-block preview, milestones). An older demo would show the old view without them, so the intro shows the
  // still until a demo is recorded on skylineRev 7. skylineRev 8 (27 Oct 2026, Joe's phone notes) keeps rev 7's play on a
  // gentler curve. skylineRev 9 (29 Oct 2026, the arcade scoring standard) deals five gold blocks at new places and
  // scores on the standard: only a skylineRev 9 demo plays (its gold blocks and score are the ones the help states).
  // skylineRev 10 (the scoring audit) plays skylineRev 9 exactly, so a demo recorded on either plays.
  if (data.type === "skyline" && demo?.puzzle.type === "skyline" && !demoRevAccepted("skyline", demo.puzzle.skylineRev)) return null;
  // Pinball's pinRev 4 (the taller table, its ramps, lanes, lock and plunger): only a demo on that table plays
  // (pinRev 4 or 5: pinRev 5 plays the same table tick for tick, only for 90 s instead of 60).
  // pinRev 6 (29 Oct 2026, the arcade scoring standard): the same play with no multiplier, so an older demo's table
  // would light multiplier inserts and count table points the help no longer states; only a pinRev 6 demo plays
  // (as High Rise's skylineRev 8), and until one is recorded the intro shows its still.
  // pinRev 7 (the Retro overhaul) plays pinRev 6 exactly: a demo recorded on either plays.
  if (data.type === "pinball" && demo?.puzzle.type === "pinball" && demo.puzzle.pinRev !== PIN_REV_STD && demo.puzzle.pinRev !== PIN_REV_JOULZ && demo.puzzle.pinRev !== PIN_REV_SAVE) return null;
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
  // Slice sliceRev 12 (3 Nov 2026, the Action polish): bigger, recognisable food; only a sliceRev 12 demo plays.
  if (data.type === "slice" && demo?.puzzle.type === "slice" && demo.puzzle.sliceRev !== SLICE_REV_FOOD) return null;
  // The Logic overhaul (15 Nov 2026, logicDemoRules.ts): Minefield plays only a minesRev 3 (Normal) demo; the six puzzle
  // games' demos must be on Normal (and on the new presentation, puzzleInputDemoCompatible).
  if (demo && !logicDemoPlays(data.type, demo.puzzle)) return null;
  return demo;
}

/**
 * The stop rules under the Action overhaul's name (action-demos-check and the arcade overhauls' checks call it): the
 * same rules as acceptIntroDemo, which the server function uses (the arcade train combine, 16 Nov 2026: main's
 * refactor and the Action overhaul's both moved the rules out of the handler; one copy, two names).
 */
export function introDemoFor(data: { type: string }, demo: IntroDemoRow | null): IntroDemoRow | null {
  return acceptIntroDemo(data.type, demo);
}

