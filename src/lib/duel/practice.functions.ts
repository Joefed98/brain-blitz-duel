import { createServerFn } from "@tanstack/react-start";

import { type SubmitExtra } from "./grade";
import { mergePuzzle, splitPuzzle } from "./secrets";
import { PUZZLE_TYPES } from "./registry";
import type { PuzzleData, PuzzleType } from "./types";

/* -------------------------------------------------------------------------- */
/*  Practice mode: one puzzle, on this device only.                            */
/*                                                                             */
/*  Nothing is stored — no room, no players, no results. The answer half of the */
/*  puzzle travels back to the device sealed (encrypted with a server-only key) */
/*  so it stays unreadable until the practice answer has been graded here.      */
/* -------------------------------------------------------------------------- */

type Loose = Record<string, unknown>;

async function sealKey(): Promise<CryptoKey> {
  const material = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["SUPABASE_URL"] ?? "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += String.fromCharCode(byte);
  return btoa(out);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const raw = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function seal(payload: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await sealKey(), data),
  );
  return `${toBase64(iv)}.${toBase64(cipher)}`;
}

async function unseal(sealed: string): Promise<Loose> {
  const [ivPart, cipherPart] = sealed.split(".");
  if (!ivPart || !cipherPart) throw new Error("Bad practice puzzle.");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(ivPart) },
    await sealKey(),
    fromBase64(cipherPart),
  );
  return JSON.parse(new TextDecoder().decode(plain)) as Loose;
}

function validType(type: string): PuzzleType {
  if (!(PUZZLE_TYPES as string[]).includes(type)) throw new Error("Unknown puzzle type.");
  return type as PuzzleType;
}

/** Generates one puzzle of the requested type with the same code rooms use. */
export const practiceGenerateFn = createServerFn({ method: "POST" })
  .inputValidator((input: { type: string }) => input)
  .handler(async ({ data }) => {
    const type = validType(data.type);
    const { generatePuzzle } = await import("./generate.server");
    let unblockRow = null;
    if (type === "unblock") {
      const { drawUnblockRow } = await import("./unblock.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      unblockRow = await drawUnblockRow(supabaseAdmin);
    }
    const { pub, priv } = splitPuzzle(generatePuzzle(type, { unblockRow }));
    return { puzzle: pub, sealed: await seal(priv) };
  });

/** Checks and scores a practice answer, then hands back the full puzzle. */
export const practiceGradeFn = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      puzzle: PuzzleData;
      sealed: string;
      answer: string;
      msRemaining: number;
      extra?: SubmitExtra;
    }) => input,
  )
  .handler(async ({ data }) => {
    const priv = await unseal(data.sealed);
    if (priv["type"] !== data.puzzle.type) throw new Error("Bad practice puzzle.");
    const puzzle = mergePuzzle(data.puzzle, priv);
    const { gradeAnswer } = await import("./generate.server");
    const graded = gradeAnswer(puzzle, data.answer, data.msRemaining, data.extra);
    return {
      puzzle,
      isCorrect: graded.isCorrect,
      score: graded.score,
      msRemaining: graded.storedMs,
      reactionAvgMs: graded.reactionAvgMs,
      answer: graded.answer,
      // Serialised as JSON text so the RPC boundary sees a plain string.
      extraJson: graded.extra ? JSON.stringify(graded.extra) : null,
    };
  });

/** Word puzzles: checks one word or ladder rung using server-only vocabulary. */
export const practiceCheckWordFn = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { puzzle: PuzzleData; word: string; found: string[]; path?: number[]; sealed?: string }) => input,
  )
  .handler(async ({ data }) => {
    const found = Array.isArray(data.found) ? data.found.slice(0, 200).map(String) : [];
    if (data.puzzle.type === "letterwheel") {
      const priv = await unseal(String(data.sealed ?? ""));
      if (priv["type"] !== "letterwheel") throw new Error("Bad practice puzzle.");
      const puzzle = mergePuzzle(data.puzzle, priv);
      if (puzzle.type !== "letterwheel") return { valid: false as const, points: 0, word: "" };
      const { checkLetterWheelWord } = await import("./letterWheel");
      const { isWord } = await import("./dictionary.server");
      const word = String(data.word ?? "").trim().toLowerCase();
      return checkLetterWheelWord(puzzle.words ?? [], word, found, word.length >= 3 && isWord(word));
    }
    if (data.puzzle.type === "wordsearch") {
      const priv = await unseal(String(data.sealed ?? ""));
      if (priv["type"] !== "wordsearch") throw new Error("Bad practice puzzle.");
      const puzzle = mergePuzzle(data.puzzle, priv);
      if (puzzle.type !== "wordsearch") return { valid: false as const, points: 0, word: "" };
      const { checkWordSearchPath } = await import("./wordSearch");
      const path = Array.isArray(data.path) ? data.path.slice(0, 16).map(Number) : [];
      return checkWordSearchPath(puzzle.placements ?? [], puzzle.size, path, found);
    }
    if (data.puzzle.type === "wordhunt") {
      const { checkWordHuntPath } = await import("./wordHunt.server");
      const path = Array.isArray(data.path) ? data.path.slice(0, 16).map(Number) : [];
      return checkWordHuntPath(data.puzzle.grid, path, found);
    }
    if (data.puzzle.type === "tilegrid") {
      const { checkTileGridWord } = await import("./tileGrid.server");
      return checkTileGridWord(String(data.word ?? ""));
    }
    if (data.puzzle.type === "wordslide") {
      const { checkWordSlideRow } = await import("./wordSlide.server");
      return checkWordSlideRow(String(data.word ?? ""));
    }
    if (data.puzzle.type === "ladder") {
      const { checkLadderRung } = await import("./wordLadder.server");
      const previous = found.at(-1) ?? data.puzzle.startWord;
      return { ...checkLadderRung(previous, data.word), points: 0 };
    }
    if (data.puzzle.type !== "wordsmith") {
      return { valid: false as const, points: 0, word: "", reason: "Not this round." };
    }
    const { checkWordsmithWord } = await import("./wordsmith.server");
    return checkWordsmithWord(data.puzzle.letters, String(data.word ?? ""), found);
  });

/** Groups practice: checks one candidate against the sealed private partition. */
export const practiceCheckGroupFn = createServerFn({ method: "POST" })
  .inputValidator((input: { puzzle: PuzzleData; sealed: string; indices: number[] }) => input)
  .handler(async ({ data }) => {
    if (data.puzzle.type !== "groups") return { valid: false as const };
    const priv = await unseal(data.sealed);
    if (priv["type"] !== "groups") throw new Error("Bad practice puzzle.");
    const puzzle = mergePuzzle(data.puzzle, priv);
    if (puzzle.type !== "groups") return { valid: false as const };
    const { matchGroupsSelection } = await import("./groups.server");
    const groupIndex = matchGroupsSelection(puzzle, data.indices.slice(0, 4));
    if (groupIndex === null) return { valid: false as const };
    return {
      valid: true as const,
      groupIndex,
      theme: puzzle.groups?.[groupIndex]?.theme ?? "Group",
    };
  });

async function demoKeyOk(key: unknown): Promise<boolean> {
  const expected = process.env["INTRO_DEMO_KEY"];
  if (!expected || typeof key !== "string" || !key) return false;
  const { createHash, timingSafeEqual } = await import("crypto");
  const a = createHash("sha256").update(key).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Whether the ?key= on the URL is the private intro-demo key. */
export const checkDemoKeyFn = createServerFn({ method: "POST" })
  .inputValidator((input: { key: string }) => input)
  .handler(async ({ data }) => ({ ok: await demoKeyOk(data.key) }));

/**
 * Dev-only save (?dev=1&key=… practice reveal). Requires the private
 * INTRO_DEMO_KEY. The run must belong to a puzzle this server issued (the
 * sealed practice half), and only the public half is kept.
 */
export const saveIntroDemoFn = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { puzzle: PuzzleData; sealed: string; answer: string; dev: boolean; key: string }) =>
      input,
  )
  .handler(async ({ data }) => {
    if (data.dev !== true) throw new Error("Demo saving is only available in dev practice.");
    if (!(await demoKeyOk(data.key))) throw new Error("Forbidden");
    const { ARCADE_REVEAL_RENDERERS } = await import("@/lib/arcade/revealRenderers");
    const { DEMO_LENGTH_TICKS, DEMO_MAX_CHARS, DEMO_START_TICK, runSeed } = await import(
      "@/lib/arcade/introDemo"
    );
    const type = String(data.puzzle?.type ?? "");
    if (!ARCADE_REVEAL_RENDERERS[type]) throw new Error("Only engine games have intro demos.");
    const run = String(data.answer ?? "");
    if (!run || run.length > DEMO_MAX_CHARS) throw new Error("Run log is empty or too long.");
    const priv = await unseal(String(data.sealed ?? ""));
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
