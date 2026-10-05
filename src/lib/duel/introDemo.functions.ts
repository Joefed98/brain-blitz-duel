import { createServerFn } from "@tanstack/react-start";

import type { PuzzleData } from "./types";

export interface IntroDemoRow {
  game_type: string;
  seed: number;
  puzzle: PuzzleData;
  input_log: { run: string };
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
      .select("game_type, seed, puzzle, input_log, start_tick, length_ticks")
      .eq("game_type", data.type)
      .maybeSingle();
    if (error) {
      console.error("[intro demo] read failed", error.message);
      return null;
    }
    return (row as IntroDemoRow | null) ?? null;
  });

/**
 * Dev-only save (?dev=1 practice reveal). The run must belong to a puzzle this
 * server issued (the sealed practice half), and only the public half is kept.
 */
export const saveIntroDemoFn = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { puzzle: PuzzleData; sealed: string; answer: string; dev: boolean }) => input,
  )
  .handler(async ({ data }) => {
    if (data.dev !== true) throw new Error("Demo saving is only available in dev practice.");
    const { ARCADE_REVEAL_RENDERERS } = await import("@/lib/arcade/revealRenderers");
    const { DEMO_LENGTH_TICKS, DEMO_MAX_CHARS, DEMO_START_TICK, runSeed } = await import(
      "@/lib/arcade/introDemo"
    );
    const { unsealPractice } = await import("./practice.functions");
    const { mergePuzzle, splitPuzzle } = await import("./secrets");
    const type = String(data.puzzle?.type ?? "");
    if (!ARCADE_REVEAL_RENDERERS[type]) throw new Error("Only engine games have intro demos.");
    const run = String(data.answer ?? "");
    if (!run || run.length > DEMO_MAX_CHARS) throw new Error("Run log is empty or too long.");
    const priv = await unsealPractice(String(data.sealed ?? ""));
    if (priv["type"] !== type) throw new Error("Bad practice puzzle.");
    const { pub } = splitPuzzle(mergePuzzle(data.puzzle, priv));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("intro_demos" as never).upsert(
      {
        game_type: type,
        seed: runSeed(run),
        puzzle: pub,
        input_log: { run },
        start_tick: DEMO_START_TICK,
        length_ticks: DEMO_LENGTH_TICKS,
        recorded_at: new Date().toISOString(),
      } as never,
      { onConflict: "game_type" },
    );
    if (error) throw new Error("Could not save the demo.");
    return { ok: true };
  });
