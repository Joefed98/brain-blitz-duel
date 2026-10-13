import { SWING_REV, SWING_REV_BAND, SWING_REV_TUNED, SWING_REV_TUNEC } from "@/lib/arcade/swing";
import { INK_REV3, INK_REV4, INK_REV_BAND, INK_REV_TUNEC } from "@/lib/arcade/inkBridge";
import { CLAY_REV } from "@/lib/arcade/clayShoot";
import { chainDemoCompatible } from "./chain";
import { createServerFn } from "@tanstack/react-start";

import type { PuzzleData } from "./types";
import type { PuzzleDemoLog } from "./puzzleDemo";
import { ORBIT_BELT_PERIOD_TICKS, ORBIT_BELT_REVISION, ORBIT_REV3, ORBIT_REV4, ORBIT_REV_BAND, ORBIT_REV_TUNED } from "@/lib/arcade/orbit";
import { BT_BALLS } from "@/lib/arcade/ballTrack";
import { clashPlays3 } from "@/lib/arcade/colourClash";

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
    // Four-step bomb demos cannot replay the six-step example.
    if (data.type === "bomb" && demo?.puzzle.type === "bomb" && demo.puzzle.bombVersion !== 2) return null;
    // Block-era Rainbow Bridge demos would show red blocks under the birds wording.
    if (data.type === "inkbridge" && demo?.puzzle.type === "inkbridge" && demo.puzzle.inkRev !== INK_REV3 && demo.puzzle.inkRev !== INK_REV4 && demo.puzzle.inkRev !== INK_REV_BAND && demo.puzzle.inkRev !== INK_REV_TUNEC) return null;
    if (data.type === "clayshoot" && demo?.puzzle.type === "clayshoot" && demo.puzzle.clayRev !== CLAY_REV) return null;
    if (data.type === "chain" && demo?.puzzle.type === "chain" && !chainDemoCompatible(demo.puzzle)) return null;
    if (data.type === "swing" && demo?.puzzle.type === "swing" && demo.puzzle.swingRev !== SWING_REV && demo.puzzle.swingRev !== SWING_REV_BAND && demo.puzzle.swingRev !== SWING_REV_TUNED && demo.puzzle.swingRev !== SWING_REV_TUNEC) return null;
    return demo;
  });

