import { SWING_REV_TALL } from "@/lib/arcade/swing";
import { INK_REV3, INK_REV4, INK_REV_BAND, INK_REV_TUNEC } from "@/lib/arcade/inkBridge";
import { CLAY_REV } from "@/lib/arcade/clayShoot";
import { WORDFALL_REV } from "@/lib/arcade/wordfall";
import { BRK_REV_TALL } from "@/lib/arcade/breaker";
import { RALLY_REV_TALL } from "@/lib/arcade/rally";
import { WAV_REV_TALL } from "@/lib/arcade/wavefront";
import { BURST_REV_TALL } from "@/lib/arcade/burst";
import { BEAT_REV_TALL } from "@/lib/arcade/beat";
import { SLICE_REV_TALL } from "@/lib/arcade/slice";
import { BUB_REV_TALL } from "@/lib/arcade/bubble";
import { chainDemoCompatible } from "./chain";
import { STRIKEOUT_REV3 } from "./strikeout";
import { createServerFn } from "@tanstack/react-start";

import type { PuzzleData } from "./types";
import type { PuzzleDemoLog } from "./puzzleDemo";
import { ORBIT_BELT_PERIOD_TICKS, ORBIT_BELT_REVISION, ORBIT_REV3, ORBIT_REV4, ORBIT_REV_BAND, ORBIT_REV_TALL, ORBIT_REV_TUNED } from "@/lib/arcade/orbit";
import { BT_BALLS, BT_REV_TALL } from "@/lib/arcade/ballTrack";
import { clashPlays3, CLASH_REV_TALL } from "@/lib/arcade/colourClash";

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
    if (data.type === "orbit" && demo?.puzzle.type === "orbit" && (demo.puzzle.orbitRev ?? 0) !== ORBIT_REV3 && demo.puzzle.orbitRev !== ORBIT_REV4 && demo.puzzle.orbitRev !== ORBIT_REV_BAND && demo.puzzle.orbitRev !== ORBIT_REV_TUNED) return null;

    // The fixed-splitter demo cannot replay the new movable-piece example.
    if (data.type === "laser" && demo?.puzzle.type === "laser" && demo.puzzle.splitterPieces !== 1) return null;
    // Old Ball Track queues and release timings cannot replay the current run.
    if (data.type === "balltrack" && demo?.puzzle.type === "balltrack" && demo.puzzle.course.balls.length !== BT_BALLS) return null;
    // Open-stream Colour Clash demos cannot replay the fixed-queue run.
    if (data.type === "stroop" && demo?.puzzle.type === "stroop" && !clashPlays3(demo.puzzle.clashRev)) return null;
    // Four-step bomb demos cannot replay the six-step example, and version-2 demos show the old clue wording (version 3 rewrote every clue, 14 Oct 2026).
    if (data.type === "bomb" && demo?.puzzle.type === "bomb" && demo.puzzle.bombVersion !== 3) return null;
    // strikeoutRev 3 (15 Oct 2026) shows ten strike markers, three vowel dots and an extra starting letter on words 1–3:
    // an older demo would show the rev-2 board, so Strikeout's demo stays stopped until one is recorded on a rev-3 puzzle.
    if (data.type === "strikeout" && demo?.puzzle.type === "strikeout" && demo.puzzle.strikeoutRev !== STRIKEOUT_REV3) return null;
    // Block-era Rainbow Bridge demos would show red blocks under the birds wording.
    if (data.type === "inkbridge" && demo?.puzzle.type === "inkbridge" && demo.puzzle.inkRev !== INK_REV3 && demo.puzzle.inkRev !== INK_REV4 && demo.puzzle.inkRev !== INK_REV_BAND && demo.puzzle.inkRev !== INK_REV_TUNEC) return null;
    // clayRev 5 (14 Oct 2026) flies 14–16 birds and clayRev 6 (16 Oct 2026, taller worlds batch 2) flies them under a
    // taller sky: an older demo would show the old sky, so only a demo recorded on today's clayRev plays.
    if (data.type === "clayshoot" && demo?.puzzle.type === "clayshoot" && demo.puzzle.clayRev !== CLAY_REV) return null;
    if (data.type === "chain" && demo?.puzzle.type === "chain" && !chainDemoCompatible(demo.puzzle)) return null;
    // Rev-1 Letterfall demos fall faster, deal vowel-heavy runs and have no Enter box under the well.
    if (data.type === "wordfall" && demo?.puzzle.type === "wordfall" && demo.puzzle.wordfallRev !== WORDFALL_REV) return null;
    // Taller worlds batch 1 (16 Oct 2026): a demo recorded on an older revision would show the short world (and its
    // touches would land on the old paddle, ship or floor line), so these four stay stopped until one is recorded on the tall revision.
    if (data.type === "breaker" && demo?.puzzle.type === "breaker" && demo.puzzle.brkRev !== BRK_REV_TALL) return null;
    if (data.type === "rally" && demo?.puzzle.type === "rally" && demo.puzzle.rallyRev !== RALLY_REV_TALL) return null;
    if (data.type === "wavefront" && demo?.puzzle.type === "wavefront" && demo.puzzle.wavRev !== WAV_REV_TALL) return null;
    if (data.type === "burst" && demo?.puzzle.type === "burst" && demo.puzzle.burstRev !== BURST_REV_TALL) return null;
    // Taller worlds batch 2 (16 Oct 2026): the same for Tempo, Slice, Coral Pop and Mixed Signals (Pull! above), each stopped
    // until a demo is recorded on its tall revision.
    if (data.type === "beat" && demo?.puzzle.type === "beat" && demo.puzzle.beatRev !== BEAT_REV_TALL) return null;
    if (data.type === "slice" && demo?.puzzle.type === "slice" && demo.puzzle.sliceRev !== SLICE_REV_TALL) return null;
    if (data.type === "bubble" && demo?.puzzle.type === "bubble" && demo.puzzle.bubbleRev !== BUB_REV_TALL) return null;
    if (data.type === "stroop" && demo?.puzzle.type === "stroop" && demo.puzzle.clashRev !== CLASH_REV_TALL) return null;
    // Taller worlds batch 3 (16 Oct 2026): Grappler's taller cavern, Orbit's taller view and Ball Tracker's 12-row board.
    // An older demo would show the short world (and Ball Tracker's would play a 9-row course), so each stays stopped
    // until one is recorded on its tall revision.
    if (data.type === "swing" && demo?.puzzle.type === "swing" && demo.puzzle.swingRev !== SWING_REV_TALL) return null;
    if (data.type === "orbit" && demo?.puzzle.type === "orbit" && demo.puzzle.orbitRev !== ORBIT_REV_TALL) return null;
    if (data.type === "balltrack" && demo?.puzzle.type === "balltrack" && demo.puzzle.btRev !== BT_REV_TALL) return null;
    return demo;
  });

