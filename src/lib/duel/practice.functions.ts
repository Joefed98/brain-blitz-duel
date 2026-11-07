import { ORBIT_BELT_PERIOD_TICKS, ORBIT_BELT_REVISION } from "@/lib/arcade/orbit";
import { createServerFn } from "@tanstack/react-start";

import { staleSubmissionNote } from "@/lib/appVersion";

import { type SubmitExtra } from "./grade";
import { sealPractice, toBase64, unsealPractice } from "./practiceSeal";
import { mergePuzzle, splitPuzzle } from "./secrets";
import { PUZZLE_TYPES } from "./registry";
import type { PuzzleData, PuzzleType } from "./types";

/* -------------------------------------------------------------------------- */
/*  Practice mode: one puzzle, on this device only.                            */
/*                                                                             */
/*  No room, players or results. Each graded play adds one practice_plays row  */
/*  (outcome only, for the beta numbers; betaRecord.server.ts). The answer half of the */
/*  puzzle travels back to the device sealed (encrypted with a server-only key, */
/*  practiceSeal.ts: PRACTICE_SEAL_KEY, else the service-role key)            */
/*  so it stays unreadable until the practice answer has been graded here.      */
/* -------------------------------------------------------------------------- */

type Loose = Record<string, unknown>;

async function seal(payload: unknown): Promise<string> {
  return sealPractice(payload);
}

/** The sealed half minus its intro-example tag. */
async function unseal(sealed: string): Promise<Loose> {
  const { __example: _example, ...priv } = await unsealRaw(sealed);
  return priv;
}

async function unsealRaw(sealed: string): Promise<Loose> {
  return unsealPractice(sealed);
}

function validType(type: string): PuzzleType {
  if (!(PUZZLE_TYPES as string[]).includes(type)) throw new Error("Unknown puzzle type.");
  return type as PuzzleType;
}

/** One fresh practice deal of a type (the board picked by a new seed), split into its public and private halves. */
async function dealPractice(type: PuzzleType, unblockRow: unknown): Promise<{ pub: PuzzleData; priv: Loose; seed: number }> {
  const { generatePuzzle } = await import("./generate.server");
  const { newRoomSeed } = await import("./selection");
  const seed = newRoomSeed();
  const { pub, priv } = splitPuzzle(generatePuzzle(type, { unblockRow: unblockRow as never, bankSeed: seed }));
  return { pub: pub as PuzzleData, priv: priv as Loose, seed };
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
      const { pub, priv } = await dealPractice(type, unblockRow);
      return { puzzle: pub, sealed: await seal(priv) };
    }
    const { withSeededRandom } = await import("./random");
    const { INTRO_EXAMPLE_ID, INTRO_EXAMPLE_SEED } = await import("./puzzleDemo");
    const { generateWordsmithExample } = await import("./wordsmith.server");
    // The six banked types store their example, so it needs no live solve.
    const { bankedIntroExample } = await import("./puzzleBank.server");
    // Skid, Chroma Lines and Tessellate (puzzle polish, 3 Nov 2026): their live boards come from the depth banks, which
    // deal only from a bank seed, so the stored example (the bank's first board) carried none of the live stamps and
    // graded on the older 120 + 30 shape (the audit's "150 at par"). Their example is the live deal at the example seed.
    const liveFromBank = type === "iceslide" || type === "flow" || type === "blockparty";
    const made = liveFromBank
      ? withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(type, { bankSeed: INTRO_EXAMPLE_SEED }))
      : bankedIntroExample(type) ?? withSeededRandom(INTRO_EXAMPLE_SEED, () => type === "wordsmith" ? generateWordsmithExample() : generatePuzzle(type, { unblockRow }));
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
      /** How the round was played (lib/inputType.ts); stored with the practice play, never graded. */
      inputType?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    // Log only: grading never depends on the client's version.
    const staleNote = staleSubmissionNote("practice_grade", data.clientVersion, data.puzzle.type);
    if (staleNote) console.warn(staleNote);
    const { __example: example, ...priv } = await unsealRaw(data.sealed);
    if (priv["type"] !== data.puzzle.type) throw new Error("That puzzle didn’t load. Try another.");
    return gradePracticeRun(data, mergePuzzle(data.puzzle, priv), example !== undefined);
  });

interface PracticeRunInput {
  answer: string;
  msRemaining: number;
  extra?: SubmitExtra;
  inputType?: string;
}

/** Grades a practice run on its full puzzle (practice's own grading, the same for a live deal and a pack deal). */
async function gradePracticeRun(data: PracticeRunInput, puzzle: PuzzleData, example: boolean) {
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
        example,
        claimedMsRemaining: data.msRemaining,
        timeLimitMs: puzzleTimeLimitMs(puzzle),
        graded,
      }),
      undefined,
      data.inputType,
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
}

/* -------------------------------------------------------------------------- */
/*  Offline practice (31 Oct 2026): packs of deals for playing with no signal, */
/*  and the grading of runs queued on the phone.                               */
/*                                                                             */
/*  A pack deal is a practice deal like any other: the public half the phone   */
/*  plays and the private half sealed with the server-only key (unreadable on  */
/*  the phone, exactly what every online practice round already carries). Its  */
/*  sealed half also holds a digest of the public half, so a queued run whose  */
/*  deal was changed on the phone is rejected, never graded.                   */
/* -------------------------------------------------------------------------- */

/** Keys sorted, undefined dropped: the same text on the server that dealt and the server that grades. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? "null" : canonical(v))).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Loose)
      .filter(([, v]) => v !== undefined && typeof v !== "function")
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

async function pubDigest(pub: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(pub)));
  return toBase64(new Uint8Array(digest));
}

/** Up to PACK_MAX_DEALS fresh deals for each of up to PACK_MAX_TYPES games (games that fail to deal are left out). */
export const practicePackFn = createServerFn({ method: "POST" })
  .inputValidator((input: { types: string[]; count?: number }) => input)
  .handler(async ({ data }) => {
    const { PACK_MAX_DEALS, PACK_MAX_TYPES, offlineStatusOf } = await import("@/lib/offline/offlineStatus");
    const count = Math.max(1, Math.min(PACK_MAX_DEALS, Math.floor(Number(data.count) || PACK_MAX_DEALS)));
    const types = [...new Set((Array.isArray(data.types) ? data.types : []).map(String))].slice(0, PACK_MAX_TYPES);
    const packs: { type: PuzzleType; deals: { id: number; puzzle: PuzzleData; sealed: string }[] }[] = [];
    for (const raw of types) {
      if (!(PUZZLE_TYPES as string[]).includes(raw)) continue;
      const type = raw as PuzzleType;
      // Games that ask the server during play are online only: no pack.
      if (offlineStatusOf(type) === "online") continue;
      const deals: { id: number; puzzle: PuzzleData; sealed: string }[] = [];
      try {
        for (let i = 0; i < count; i++) {
          let unblockRow = null;
          if (type === "unblock") {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { drawUnblockRow } = await import("./unblock.server");
            unblockRow = await drawUnblockRow(supabaseAdmin);
          }
          const { pub, priv, seed } = await dealPractice(type, unblockRow);
          deals.push({ id: seed, puzzle: pub, sealed: await seal({ ...priv, __pack: seed, __pub: await pubDigest(pub) }) });
        }
      } catch (error) {
        console.warn(`[offline] no pack for ${type}: ${String(error)}`);
        if (deals.length === 0) continue;
      }
      packs.push({ type, deals });
    }
    return { packs };
  });

/**
 * Grades one run played away from the server (a pack deal, or a live deal whose answer couldn't be sent),
 * exactly as practiceGradeFn would. A run that can't be trusted comes back as rejected, never as an error,
 * so the phone knows to stop sending it; any other failure is thrown and the phone tries again later.
 */
export const practiceGradeQueuedFn = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      puzzle: PuzzleData;
      sealed: string;
      answer: string;
      msRemaining: number;
      extra?: SubmitExtra;
      clientVersion?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const staleNote = staleSubmissionNote("practice_grade", data.clientVersion, data.puzzle?.type);
    if (staleNote) console.warn(staleNote);
    let raw: Loose;
    try {
      raw = await unsealRaw(String(data.sealed ?? ""));
    } catch {
      return { status: "rejected" as const, reason: "seal" };
    }
    const { __example: example, __pack: pack, __pub: digest, ...priv } = raw;
    if (!data.puzzle || priv["type"] !== data.puzzle.type) return { status: "rejected" as const, reason: "type" };
    if (pack !== undefined && digest !== (await pubDigest(data.puzzle))) return { status: "rejected" as const, reason: "deal" };
    const graded = await gradePracticeRun(data, mergePuzzle(data.puzzle, priv), example !== undefined);
    return { status: "graded" as const, ...graded };
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
      if (priv["type"] !== "letterwheel") throw new Error("That puzzle didn’t load. Try another.");
      const puzzle = mergePuzzle(data.puzzle, priv);
      if (puzzle.type !== "letterwheel") return { valid: false as const, points: 0, word: "" };
      const { checkLetterWheelWord } = await import("./letterWheel");
      const { isWord } = await import("./dictionary.server");
      const word = String(data.word ?? "").trim().toLowerCase();
      return checkLetterWheelWord(puzzle.words ?? [], word, found, word.length >= 3 && isWord(word));
    }
    if (data.puzzle.type === "wordsearch") {
      const priv = await unseal(String(data.sealed ?? ""));
      if (priv["type"] !== "wordsearch") throw new Error("That puzzle didn’t load. Try another.");
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
    if (priv["type"] !== type) throw new Error("That puzzle didn’t load. Try another.");
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
    if (priv["type"] !== type) throw new Error("That puzzle didn’t load. Try another.");
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
    if (raw["type"] !== type) throw new Error("That puzzle didn’t load. Try another.");
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
