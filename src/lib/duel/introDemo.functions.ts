import { chainDemoCompatible } from "./chain";
import { createServerFn } from "@tanstack/react-start";

import type { PuzzleData } from "./types";
import type { PuzzleDemoLog } from "./puzzleDemo";
import { BT_BALLS } from "@/lib/arcade/ballTrack";

export interface IntroDemoRow {
  game_type: string;
  seed: number;
  puzzle: PuzzleData;
  /** Engine games: { run }. Puzzle games: a PuzzleDemoLog. */
  input_log: { run?: string } & Partial<PuzzleDemoLog>;
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
    // The fixed-splitter demo cannot replay the new movable-piece example.
    if (data.type === "laser" && demo?.puzzle.type === "laser" && demo.puzzle.splitterPieces !== 1) return null;
    // Old Ball Track queues and release timings cannot replay the current run.
    if (data.type === "balltrack" && demo?.puzzle.type === "balltrack" && demo.puzzle.course.balls.length !== BT_BALLS) return null;
    if (data.type === "chain" && demo?.puzzle.type === "chain" && !chainDemoCompatible(demo.puzzle)) return null;
    return demo;
  });

