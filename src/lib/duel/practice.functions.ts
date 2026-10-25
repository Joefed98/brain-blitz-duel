import { ORBIT_BELT_PERIOD_TICKS, ORBIT_BELT_REVISION } from "@/lib/arcade/orbit";
import { createServerFn } from "@tanstack/react-start";

import { staleSubmissionNote } from "@/lib/appVersion";

import { type SubmitExtra } from "./grade";
import { mergePuzzle, splitPuzzle } from "./secrets";
import { PUZZLE_TYPES } from "./registry";
import type { PuzzleData, PuzzleType } from "./types";

/* -------------------------------------------------------------------------- */
/*  Practice mode: one puzzle, on this device only.                            */
/*                                                                             */
/*  No room, players or results. Each graded play adds one practice_plays row  */
/*  (outcome only, for the beta numbers; betaRecord.server.ts). The answer half of the */
/*  puzzle travels back to the device sealed (encrypted with a server-only key) */
/*  so it stays unreadable until the practice answer has been graded here.      */
/* -------------------------------------------------------------------------- */

type Loose = Record<string, unknown>;

async function sealKey(): Promise<CryptoKey> {
  const secret = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  // The public URL is no secret: only a dev server (practice in checks) may seal with it.
  if (!secret && import.meta.env.PROD) throw new Error("Practice is unavailable right now.");
  const material = secret ?? process.env["SUPABASE_URL"] ?? "";
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

/** The sealed half minus its intro-example tag. */
async function unseal(sealed: string): Promise<Loose> {
  const { __example: _example, ...priv } = await unsealRaw(sealed);
  return priv;
}

async function unsealRaw(sealed: string): Promise<Loose> {
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
  .inputValidator((input: { type: string; example?: boolean }) => input)
  .handler(async ({ data }) => {
    const type = validType(data.type);
    const { generatePuzzle } = await import("./generate.server");
    const example = data.example === true;
    let unblockRow = null;
    if (type === "unblock") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      if (example) {
        // The fixed example always uses the bank's first board, without marking it used.
        const { data: rows } = await supabaseAdmin
          .from("unblock_bank")
          .select("id, layout, min_moves, solution")
          .order("id", { ascending: true })
          .limit(1);
        unblockRow = (rows?.[0] as never) ?? null;
      } else {
        const { drawUnblockRow } = await import("./unblock.server");
        unblockRow = await drawUnblockRow(supabaseAdmin);
      }
    }
    if (!example) {
      // Slow types come from their precomputed bank; a fresh seed picks the board.
      const { newRoomSeed } = await import("./selection");
      const { pub, priv } = splitPuzzle(generatePuzzle(type, { unblockRow, bankSeed: newRoomSeed() }));
      return { puzzle: pub, sealed: await seal(priv) };
    }
    const { withSeededRandom } = await import("./random");
    const { INTRO_EXAMPLE_ID, INTRO_EXAMPLE_SEED } = await import("./puzzleDemo");
    const { generateWordsmithExample } = await import("./wordsmith.server");
    // The six banked types store their example, so it needs no live solve.
    const { bankedIntroExample } = await import("./puzzleBank.server");
    const made = bankedIntroExample(type) ?? withSeededRandom(INTRO_EXAMPLE_SEED, () => type === "wordsmith" ? generateWordsmithExample() : generatePuzzle(type, { unblockRow }));
    const { pub, priv } = splitPuzzle(made);
    return { puzzle: pub, sealed: await seal({ ...priv, __example: INTRO_EXAMPLE_ID }) };
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
      /** The phone's build id (appVersion.ts); missing from copies older than it. */
      clientVersion?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    // Log only: grading never depends on the client's version.
    const staleNote = staleSubmissionNote("practice_grade", data.clientVersion, data.puzzle.type);
    if (staleNote) console.warn(staleNote);
    const { __example: example, ...priv } = await unsealRaw(data.sealed);
    if (priv["type"] !== data.puzzle.type) throw new Error("Bad practice puzzle.");
    const puzzle = mergePuzzle(data.puzzle, priv);
    const { gradeAnswer } = await import("./generate.server");
    const graded = gradeAnswer(puzzle, data.answer, data.msRemaining, data.extra);
    // Beta recording (practice_plays): the outcome only, best-effort, never blocks the answer.
    // Skipped where there is no database (local dev servers in checks).
    if (process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
      const { practicePlayRow, recordPracticePlay } = await import("./betaRecord.server");
      const { puzzleTimeLimitMs } = await import("./registry");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await recordPracticePlay(supabaseAdmin, (userId) =>
        practicePlayRow({
          userId,
          puzzle: puzzle as unknown as Record<string, unknown> & { type: string },
          example: example !== undefined,
          claimedMsRemaining: data.msRemaining,
          timeLimitMs: puzzleTimeLimitMs(puzzle),
          graded,
        }),
      );
    }
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

/** Word puzzles: checks one word using server-only vocabulary. */
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
      return checkWordSearchPath(puzzle.placements ?? [], puzzle.size, path, found, puzzle.bonus);
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
    if (data.puzzle.type !== "wordsmith") {
      return { valid: false as const, points: 0, word: "", reason: "Not this round." };
    }
    const { checkWordsmithWord } = await import("./wordsmith.server");
    return checkWordsmithWord(data.puzzle.letters, String(data.word ?? ""), found);
  });

/** Strikeout, Cryptogrid and Swapword practice: replays the moves against the sealed answer half. */
export const practiceCheckMovesFn = createServerFn({ method: "POST" })
  .inputValidator((input: { puzzle: PuzzleData; sealed: string; moves: string }) => input)
  .handler(async ({ data }) => {
    const type = data.puzzle?.type;
    if (type !== "strikeout" && type !== "codeword" && type !== "swapword") return null;
    const priv = await unseal(String(data.sealed ?? ""));
    if (priv["type"] !== type) throw new Error("Bad practice puzzle.");
    const { checkPuzzleMoves } = await import("./moves.server");
    return checkPuzzleMoves(mergePuzzle(data.puzzle, priv), data.moves);
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
        input_log: { run, ...(type === "orbit" ? { orbitBeltPeriodTicks: ORBIT_BELT_PERIOD_TICKS, orbitBeltRevision: ORBIT_BELT_REVISION } : {}) },
        start_tick: DEMO_START_TICK,
        length_ticks: DEMO_LENGTH_TICKS,
        recorded_at: new Date().toISOString(),
      } as never,
      { onConflict: "game_type" },
    );
    if (error) throw new Error("Could not save the demo.");
    return { ok: true };
  });

/**
 * Dev-only save of a puzzle intro demo: the touches from a practice run on the
 * fixed intro example. Same private key as the engine demos; the sealed half
 * must carry the intro-example tag, so only fixed examples can be saved.
 */
export const savePuzzleDemoFn = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { puzzle: PuzzleData; sealed: string; log: unknown; dev: boolean; key: string }) => input,
  )
  .handler(async ({ data }) => {
    if (data.dev !== true) throw new Error("Demo saving is only available in dev practice.");
    if (!(await demoKeyOk(data.key))) throw new Error("Forbidden");
    const { ARCADE_REVEAL_RENDERERS } = await import("@/lib/arcade/revealRenderers");
    const { INTRO_EXAMPLE_ID, PUZZLE_DEMO_MAX_CHARS, isPuzzleDemoLog } = await import("./puzzleDemo");
    const type = validType(String(data.puzzle?.type ?? ""));
    if (ARCADE_REVEAL_RENDERERS[type]) throw new Error("Engine games use the run-log demo.");
    if (!isPuzzleDemoLog(data.log)) throw new Error("No recorded actions.");
    const text = JSON.stringify(data.log);
    if (text.length > PUZZLE_DEMO_MAX_CHARS) throw new Error("Demo is too long.");
    const raw = await unsealRaw(String(data.sealed ?? ""));
    if (raw["type"] !== type) throw new Error("Bad practice puzzle.");
    if (raw["__example"] !== INTRO_EXAMPLE_ID) throw new Error("Only the fixed intro example can be saved.");
    const { __example: _example, ...priv } = raw;
    const { pub } = splitPuzzle(mergePuzzle(data.puzzle, priv));
    const log = JSON.parse(text) as { actions: { t: number }[] };
    const lengthMs = Math.max(0, ...log.actions.map((a) => Number(a.t) || 0));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("intro_demos").upsert(
      {
        game_type: type,
        seed: 0,
        puzzle: pub as never,
        input_log: log as never,
        start_tick: 0,
        length_ticks: Math.round(lengthMs),
        example_id: INTRO_EXAMPLE_ID,
        recorded_at: new Date().toISOString(),
      },
      { onConflict: "game_type" },
    );
    if (error) throw new Error("Could not save the demo.");
    return { ok: true };
  });
