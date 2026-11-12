import { ORBIT_BELT_PERIOD_TICKS, ORBIT_BELT_REVISION } from "@/lib/arcade/orbit";
import { createServerFn } from "@tanstack/react-start";

import { staleSubmissionNote } from "@/lib/appVersion";

import { type SubmitExtra } from "./grade";
import { mergePuzzle, splitPuzzle } from "./secrets";
import type { PracticeRunProgress } from "@/lib/practice/progress";
import { levelOf } from "@/lib/practice/progressRules";
import { PUZZLE_TYPES } from "./catalogue";
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

/* The seal and the deal digest live in practiceSeal.server.ts (security fixes H1 and L8); loaded inside handlers only. */
const sealing = () => import("./practiceSeal.server");
async function sealDeal(pub: PuzzleData, priv: Loose, tags: Loose = {}): Promise<string> {
  return (await sealing()).sealDeal(pub, priv, tags);
}
async function openDeal(sealed: unknown, puzzle: unknown) {
  return (await sealing()).openDeal(sealed, puzzle);
}
async function openDealOrThrow(sealed: unknown, puzzle: unknown) {
  return (await sealing()).openDealOrThrow(sealed, puzzle);
}
async function unsealRaw(sealed: string): Promise<Loose> {
  return (await sealing()).unsealRaw(sealed);
}

/** M4: practice needs no sign-in, so it is limited per network address (rateLimit.server.ts). */
const PRACTICE_BUSY = "Practice is busy right now. Try again in a few minutes.";
async function practiceLimit(kind: "deal" | "pack" | "grade" | "check"): Promise<boolean> {
  const limits = await import("./rateLimit.server");
  const limit =
    kind === "deal" ? limits.IP_PRACTICE_DEAL_LIMIT
    : kind === "pack" ? limits.IP_PRACTICE_PACK_LIMIT
    : kind === "grade" ? limits.IP_PRACTICE_GRADE_LIMIT
    : limits.IP_PRACTICE_CHECK_LIMIT;
  return limits.withinIpRateLimit(limit);
}

function validType(type: string): PuzzleType {
  if (!(PUZZLE_TYPES as string[]).includes(type)) throw new Error("Unknown puzzle type.");
  return type as PuzzleType;
}

/** What the phone shows when Practice is asked for a game held back for Joulz Plus members (wave 2 E2). */
const EARLY_ACCESS_HELD = "That game is in early access for Joulz Plus members. Everyone can play it soon.";

/**
 * The games early access holds back from this caller today (src/lib/plus/access.server.ts): none unless a game is
 * marked; then every marked game for anyone but a member. Never an error: a failed read holds nothing back.
 */
async function heldGames(): Promise<string[]> {
  try {
    const { adminDb } = await import("@/lib/data/db.server");
    const client = await adminDb();
    const { earlyAccessGames, heldGamesFor } = await import("@/lib/plus/access.server");
    if (!(await earlyAccessGames(client, Date.now())).length) return [];
    const { callerUserId } = await import("./betaRecord.server");
    return await heldGamesFor(client, await callerUserId(client), Date.now());
  } catch {
    return [];
  }
}
async function heldBack(type: string): Promise<boolean> {
  return (await heldGames()).includes(type);
}

/** One fresh practice deal of a type (the board picked by a new seed), split into its public and private halves. */
async function dealPractice(type: PuzzleType, unblockRow: unknown): Promise<{ pub: PuzzleData; priv: Loose; seed: number }> {
  // The round engine's single deal (src/lib/round/deal.server.ts): no tie-break stamp, a fresh bank seed.
  const { dealOne } = await import("./generate.server");
  const { newRoomSeed } = await import("./selection");
  const seed = newRoomSeed();
  const { pub, priv } = splitPuzzle(dealOne(type, { unblockRow: unblockRow as never, bankSeed: seed }));
  return { pub: pub as PuzzleData, priv: priv as Loose, seed };
}

/** Generates one puzzle of the requested type with the same code rooms use. */
export const practiceGenerateFn = createServerFn({ method: "POST" })
  .inputValidator((input: { type: string; example?: boolean }) => input)
  .handler(async ({ data }) => {
    const type = validType(data.type);
    if (!(await practiceLimit("deal"))) throw new Error(PRACTICE_BUSY);
    const { generatePuzzle } = await import("./generate.server");
    const example = data.example === true;
    let unblockRow = null;
    if (type === "unblock") {
      const { adminDb } = await import("@/lib/data/db.server");
      const supabaseAdmin = await adminDb();
      if (example) {
        // The fixed example always uses the bank's first board, without marking it used.
        const { readFirstUnblockRows } = await import("@/lib/data/practice.server");
        const { data: rows } = await readFirstUnblockRows(supabaseAdmin);
        unblockRow = (rows?.[0] as never) ?? null;
      } else {
        const { drawUnblockRow } = await import("./unblock.server");
        unblockRow = await drawUnblockRow(supabaseAdmin);
      }
    }
    if (!example) {
      // Early access (Joulz Plus, wave 2 E2): a game marked for members is held back from everyone else until its day.
      if (await heldBack(type)) throw new Error(EARLY_ACCESS_HELD);
      // Slow types come from their precomputed bank; a fresh seed picks the board.
      const { pub, priv } = await dealPractice(type, unblockRow);
      return { puzzle: pub, sealed: await sealDeal(pub, priv, { __dealtAt: Date.now() }) };
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
    return { puzzle: pub as PuzzleData, sealed: await sealDeal(pub as PuzzleData, priv as Loose, { __example: INTRO_EXAMPLE_ID, __dealtAt: Date.now() }) };
  });

/**
 * The round's clock has started on the phone (practiceReceipt.ts): the server's time, sealed for this deal, sent back
 * with the answer. Best effort on the phone; the grade bounds the claim without it too.
 */
export const practiceStartFn = createServerFn({ method: "POST" })
  .inputValidator((input: { sealed: string }) => input)
  .handler(async ({ data }) => {
    const start = await (await sealing()).sealStart(String(data.sealed ?? ""));
    await recordPracticeEvent("game_started", data.sealed);
    return { start };
  });

/**
 * Analytics (src/lib/data/events.server.ts): practice's game_started / game_finished, fire-and-forget. The player is
 * the caller's anonymous id, read from its token in the background; the game from the sealed deal it played.
 */
async function recordPracticeEvent(
  event: "game_started" | "game_finished",
  sealed: unknown,
  finished?: () => Promise<{ score: number; isCorrect: boolean; durationMs: number; inputType?: unknown }>,
): Promise<void> {
  try {
    if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) return;
    const outcome = finished ? await finished() : undefined;
    const raw = await unsealRaw(String(sealed ?? ""));
    const { recordEvents } = await import("@/lib/data/events.server");
    const { callerUserId } = await import("./betaRecord.server");
    const admin = await (await import("@/lib/data/db.server")).adminDb();
    recordEvents({
      event,
      playerId: () => callerUserId(admin),
      game: typeof raw["type"] === "string" ? raw["type"] : null,
      mode: "practice",
      score: outcome?.score ?? null,
      completed: outcome ? outcome.isCorrect : null,
      durationMs: outcome?.durationMs ?? null,
      inputType: outcome?.inputType,
      props: raw["__example"] !== undefined ? { example: true } : null,
    });
  } catch {
    /* analytics never fails a practice call */
  }
}

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
      /** The start token from practiceStartFn, when the phone got one. */
      start?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const nowMs = Date.now();
    // Log only: grading never depends on the client's version.
    const staleNote = staleSubmissionNote("practice_grade", data.clientVersion, data.puzzle.type);
    if (staleNote) console.warn(staleNote);
    if (!(await practiceLimit("grade"))) throw new Error(PRACTICE_BUSY);
    const { priv, pub, example, dealtAt } = await openDealOrThrow(data.sealed, data.puzzle);
    const puzzle = mergePuzzle(pub, priv);
    // The claim held to the server's receipt, as in a room (practiceReceipt.ts).
    const { practiceReceiptMsRemaining } = await import("./practiceReceipt");
    const startAt = await (await sealing()).startAtFor(data.start, String(data.sealed ?? ""));
    const received = practiceReceiptMsRemaining(puzzle, { dealtAt, startAt, nowMs });
    const result = await gradePracticeRun(data, puzzle, example !== undefined, received);
    await recordPracticeEvent("game_finished", data.sealed, async () => {
      const { playedMs } = await import("@/lib/data/events.server");
      const { puzzleTimeLimitMs } = await import("./catalogue");
      return {
        score: result.score,
        isCorrect: result.isCorrect,
        durationMs: playedMs(
          puzzleTimeLimitMs(puzzle),
          result.msRemaining,
          result.extraJson ? (JSON.parse(result.extraJson) as Record<string, unknown>) : null,
        ),
        inputType: data.inputType,
      };
    });
    return result;
  });

interface PracticeRunInput {
  answer: string;
  /** The sealed deal (its digest keys the coin challenges' first-run rule). */
  sealed?: string;
  msRemaining: number;
  extra?: SubmitExtra;
  inputType?: string;
}

/** Grades a practice run on its full puzzle (practice's own grading, the same for a live deal and a pack deal). */
async function gradePracticeRun(data: PracticeRunInput, puzzle: PuzzleData, example: boolean, received?: number) {
  // Speed fix 7: practice keeps reading gradeAnswer through generate.server (its deal loads that chunk anyway), which
  // also keeps the built generate.server chunk exporting gradeAnswer by name (standard-live-check grades with it).
  const { gradeAnswer } = await import("./generate.server");
  const { practiceTrustedMs } = await import("./practiceReceipt");
  // A live deal: the claim held to the server's receipt as in a room (practiceReceipt.ts); else the length clamp alone.
  const { ms, received: bound } = practiceTrustedMs(puzzle, data.msRemaining, received);
  const graded = gradeAnswer(puzzle, data.answer, ms, data.extra, bound);
  // Practice progress (wave 2 C1a): the row also stores the grade's breakdown and level, and is counted towards the
  // player's stars and bests on the server (never the intro example; see the migration for what never counts).
  let progress: PracticeRunProgress | null = null;
  // The counted play (its player and stored row), once practice_record_play has counted it.
  let counted: CountedPlay | null = null;
  // Beta recording (practice_plays): the outcome only, best-effort, never blocks the answer.
  // Skipped where there is no database (local dev servers in checks).
  if (process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
    const { practicePlayRow, recordPracticePlay } = await import("./betaRecord.server");
    const { runProgressOf, recordProgressEvents } = await import("@/lib/practice/progress.server");
    const { puzzleTimeLimitMs } = await import("./catalogue");
    const supabaseAdmin = await (await import("@/lib/data/db.server")).adminDb();
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
      {
        breakdown: graded.extra ?? null,
        level: levelOf((puzzle as unknown as Loose)["level"]),
        onCounted: (outcome, userId, playId) => {
          progress = runProgressOf(outcome);
          void recordProgressEvents(outcome, userId);
          if (outcome.counted) counted = { userId, playId };
          // Rated matchmaking (wave 3 W3b): a counted play's deal is kept, so it can be a recorded-run fallback
          // (src/lib/rated/practiceDeals.server.ts; best effort, never awaited by the grade).
          if (outcome.counted && !example)
            void import("@/lib/rated/practiceDeals.server")
              .then((d) => d.storePracticeDeal(supabaseAdmin, { playId, userId, puzzle, graded }))
              .catch(() => {});
          // C2: a new star or gem can earn First Star, All-Rounder or Gem Hunter at once (never awaited: the grade
          // answers first; the badge's moment shows on the next tab page, and a tab page's sync catches any miss).
          if (outcome.star_earned || (outcome.gems_unlocked?.length ?? 0) > 0)
            void import("@/lib/badges/badges.server").then((b) => b.evaluateBadges(supabaseAdmin, userId)).catch(() => {});
        },
      },
    );
  }
  // Practice challenges (wave 2 C1b): the server's checker on a play C1a counted (never the intro example, a flagged
  // run, a play with no player or one graded before the fresh start), read from that play's stored breakdown.
  const countedPlay = counted as CountedPlay | null;
  const challenges = countedPlay && !example ? await practiceChallengesFor(countedPlay, graded, data.sealed ?? "") : [];
  return {
    puzzle,
    isCorrect: graded.isCorrect,
    score: graded.score,
    msRemaining: graded.storedMs,
    reactionAvgMs: graded.reactionAvgMs,
    answer: graded.answer,
    // Serialised as JSON text so the RPC boundary sees a plain string.
    extraJson: graded.extra ? JSON.stringify(graded.extra) : null,
    // What the run did to the player's stars and bests (null when it couldn't be counted: no database or player).
    progress: progress as PracticeRunProgress | null,
    // The challenges this run completed ({ id, coins, paid }); the phone shows its small moment from these alone.
    challenges,
  };
}

/** A play C1a's practice_record_play counted: its player and its practice_plays row. */
interface CountedPlay {
  userId: string;
  playId: number;
}

/**
 * Checks a counted Practice play against its game's challenges (src/lib/challenges/challenges.server.ts): the play's
 * stored breakdown, score and level (C1a's practice_plays row), with the grade's correctness and reaction time, which
 * the row doesn't keep. Never fails the grade: a missing row or any error gives no completions.
 */
async function practiceChallengesFor(
  play: CountedPlay,
  graded: { isCorrect: boolean; reactionAvgMs: number | null },
  sealed: string,
): Promise<{ id: string; coins: number; paid: boolean }[]> {
  try {
    const admin = await (await import("@/lib/data/db.server")).adminDb();
    const { readPracticePlayBreakdown } = await import("@/lib/data/practiceProgress.server");
    const stored = await readPracticePlayBreakdown(admin, play.playId);
    if (stored.error || !stored.data || stored.data.user_id !== play.userId) {
      console.warn(`[challenges] not checked: ${stored.error?.message ?? "no stored play"}`);
      return [];
    }
    const row = stored.data;
    // The catalogue has Classic, Hard and Expert challenges only: an Easy run (wave 3.5) completes none.
    const level = levelOf(row.level);
    if (level === "easy") return [];
    const breakdown = row.breakdown && typeof row.breakdown === "object" && !Array.isArray(row.breakdown)
      ? (row.breakdown as Record<string, unknown>)
      : null;
    const { challengeDealKey, checkPracticeChallenges } = await import("@/lib/challenges/challenges.server");
    return await checkPracticeChallenges(
      admin,
      play.userId,
      row.game_id,
      { score: row.score, isCorrect: graded.isCorrect, reactionAvgMs: graded.reactionAvgMs, extra: breakdown },
      await challengeDealKey(String(sealed ?? "")),
      level,
    );
  } catch (err) {
    console.warn(`[challenges] not checked: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
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

/** Up to PACK_MAX_DEALS fresh deals for each of up to PACK_MAX_TYPES games (games that fail to deal are left out). */
export const practicePackFn = createServerFn({ method: "POST" })
  .inputValidator((input: { types: string[]; count?: number }) => input)
  .handler(async ({ data }) => {
    // Over the limit: no packs this time (the phone tops up again on a later visit).
    if (!(await practiceLimit("pack"))) return { packs: [] };
    const { PACK_MAX_DEALS, PACK_MAX_TYPES, offlineStatusOf } = await import("@/lib/offline/offlineStatus");
    const count = Math.max(1, Math.min(PACK_MAX_DEALS, Math.floor(Number(data.count) || PACK_MAX_DEALS)));
    const types = [...new Set((Array.isArray(data.types) ? data.types : []).map(String))].slice(0, PACK_MAX_TYPES);
    const packs: { type: PuzzleType; deals: { id: number; puzzle: PuzzleData; sealed: string }[] }[] = [];
    // Early access (wave 2 E2): no offline pack of a game held back from this caller.
    const held = await heldGames();
    for (const raw of types) {
      if (!(PUZZLE_TYPES as string[]).includes(raw)) continue;
      if (held.includes(raw)) continue;
      const type = raw as PuzzleType;
      // Games that ask the server during play are online only: no pack.
      if (offlineStatusOf(type) === "online") continue;
      const deals: { id: number; puzzle: PuzzleData; sealed: string }[] = [];
      try {
        for (let i = 0; i < count; i++) {
          let unblockRow = null;
          if (type === "unblock") {
            const supabaseAdmin = await (await import("@/lib/data/db.server")).adminDb();
            const { drawUnblockRow } = await import("./unblock.server");
            unblockRow = await drawUnblockRow(supabaseAdmin);
          }
          const { pub, priv, seed } = await dealPractice(type, unblockRow);
          deals.push({ id: seed, puzzle: pub, sealed: await sealDeal(pub, priv, { __pack: seed }) });
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
    // Thrown, not rejected: the phone keeps the run and sends it again later.
    if (!(await practiceLimit("grade"))) throw new Error(PRACTICE_BUSY);
    let raw: Loose;
    try {
      raw = await unsealRaw(String(data.sealed ?? ""));
    } catch {
      return { status: "rejected" as const, reason: "seal" };
    }
    if (!data.puzzle || raw["type"] !== data.puzzle.type) return { status: "rejected" as const, reason: "type" };
    // Every deal, pack or live, must match the digest it was sealed with (H1): a token from before the digest, or a
    // changed deal, is rejected, never graded.
    const opened = await openDeal(data.sealed, data.puzzle);
    if (!opened) return { status: "rejected" as const, reason: "deal" };
    const graded = await gradePracticeRun(data, mergePuzzle(opened.pub, opened.priv), opened.example !== undefined);
    return { status: "graded" as const, ...graded };
  });

/** Word puzzles: checks one word using server-only vocabulary. */
export const practiceCheckWordFn = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { puzzle: PuzzleData; word: string; found: string[]; path?: number[]; sealed?: string }) => input,
  )
  .handler(async ({ data }) => {
    if (!(await practiceLimit("check"))) return { valid: false as const, points: 0, word: "", reason: PRACTICE_BUSY };
    const found = Array.isArray(data.found) ? data.found.slice(0, 200).map(String) : [];
    if (data.puzzle.type === "letterwheel") {
      const { priv, pub } = await openDealOrThrow(data.sealed, data.puzzle);
      if (priv["type"] !== "letterwheel") throw new Error("That puzzle didn’t load. Try another.");
      const puzzle = mergePuzzle(pub, priv);
      if (puzzle.type !== "letterwheel") return { valid: false as const, points: 0, word: "" };
      const { checkLetterWheelWord } = await import("./letterWheel");
      const { isWord } = await import("./dictionary.server");
      const word = String(data.word ?? "").trim().toLowerCase();
      return checkLetterWheelWord(puzzle.words ?? [], word, found, word.length >= 3 && isWord(word));
    }
    if (data.puzzle.type === "wordsearch") {
      const { priv, pub } = await openDealOrThrow(data.sealed, data.puzzle);
      if (priv["type"] !== "wordsearch") throw new Error("That puzzle didn’t load. Try another.");
      const puzzle = mergePuzzle(pub, priv);
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
    if (!(await practiceLimit("check"))) return null;
    const { priv, pub } = await openDealOrThrow(data.sealed, data.puzzle);
    const { checkPuzzleMoves } = await import("./moves.server");
    return checkPuzzleMoves(mergePuzzle(pub, priv), data.moves);
  });

async function demoKeyOk(key: unknown): Promise<boolean> {
  const expected = process.env["INTRO_DEMO_KEY"];
  if (!expected || typeof key !== "string" || !key) return false;
  const { createHash, timingSafeEqual } = await import("crypto");
  const a = createHash("sha256").update(key).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Security fix M7 (Nov 2026 audit): demo saves are refused by the server itself in a production build unless the
 * server sets INTRO_DEMO_SAVES=1 (the client's `dev` flag alone no longer opens them), and guesses at the key are
 * limited per network address.
 */
async function demoSavesAllowed(): Promise<boolean> {
  const { demoSavesOpen } = await import("./demoSaves.server");
  return demoSavesOpen(import.meta.env.PROD, process.env["INTRO_DEMO_SAVES"]);
}
const DEMO_SAVES_CLOSED = "Demo saving is only available in dev practice.";

/** Whether the ?key= on the URL is the private intro-demo key. */
export const checkDemoKeyFn = createServerFn({ method: "POST" })
  .inputValidator((input: { key: string }) => input)
  .handler(async ({ data }) => {
    const { IP_DEMO_KEY_LIMIT, withinIpRateLimit } = await import("./rateLimit.server");
    if (!(await withinIpRateLimit(IP_DEMO_KEY_LIMIT))) return { ok: false };
    return { ok: await demoKeyOk(data.key) };
  });

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
    if (data.dev !== true || !(await demoSavesAllowed())) throw new Error(DEMO_SAVES_CLOSED);
    if (!(await demoKeyOk(data.key))) throw new Error("Forbidden");
    const { ARCADE_REVEAL_RENDERERS } = await import("@/lib/arcade/revealRenderers");
    const { DEMO_LENGTH_TICKS, DEMO_MAX_CHARS, DEMO_START_TICK, runSeed } = await import(
      "@/lib/arcade/introDemo"
    );
    const type = String(data.puzzle?.type ?? "");
    if (!ARCADE_REVEAL_RENDERERS[type]) throw new Error("Only engine games have intro demos.");
    const run = String(data.answer ?? "");
    if (!run || run.length > DEMO_MAX_CHARS) throw new Error("Run log is empty or too long.");
    const { pub } = await openDealOrThrow(data.sealed, data.puzzle);
    const { adminDb } = await import("@/lib/data/db.server");
    const { upsertIntroDemo } = await import("@/lib/data/practice.server");
    const { error } = await upsertIntroDemo(await adminDb(), {
      game_type: type,
      seed: runSeed(run),
      puzzle: pub,
      input_log: { run, ...(type === "orbit" ? { orbitBeltPeriodTicks: ORBIT_BELT_PERIOD_TICKS, orbitBeltRevision: ORBIT_BELT_REVISION } : {}) },
      start_tick: DEMO_START_TICK,
      length_ticks: DEMO_LENGTH_TICKS,
      recorded_at: new Date().toISOString(),
    });
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
    if (data.dev !== true || !(await demoSavesAllowed())) throw new Error(DEMO_SAVES_CLOSED);
    if (!(await demoKeyOk(data.key))) throw new Error("Forbidden");
    const { ARCADE_REVEAL_RENDERERS } = await import("@/lib/arcade/revealRenderers");
    const { INTRO_EXAMPLE_ID, PUZZLE_DEMO_MAX_CHARS, isPuzzleDemoLog } = await import("./puzzleDemo");
    const type = validType(String(data.puzzle?.type ?? ""));
    if (ARCADE_REVEAL_RENDERERS[type]) throw new Error("Engine games use the run-log demo.");
    if (!isPuzzleDemoLog(data.log)) throw new Error("No recorded actions.");
    const text = JSON.stringify(data.log);
    if (text.length > PUZZLE_DEMO_MAX_CHARS) throw new Error("Demo is too long.");
    const { pub, example } = await openDealOrThrow(data.sealed, data.puzzle);
    if (example !== INTRO_EXAMPLE_ID) throw new Error("Only the fixed intro example can be saved.");
    const log = JSON.parse(text) as { actions: { t: number }[] };
    const lengthMs = Math.max(0, ...log.actions.map((a) => Number(a.t) || 0));
    const { adminDb } = await import("@/lib/data/db.server");
    const { upsertIntroDemo } = await import("@/lib/data/practice.server");
    const { error } = await upsertIntroDemo(await adminDb(), {
      game_type: type,
      seed: 0,
      puzzle: pub,
      input_log: log,
      start_tick: 0,
      length_ticks: Math.round(lengthMs),
      example_id: INTRO_EXAMPLE_ID,
      recorded_at: new Date().toISOString(),
    });
    if (error) throw new Error("Could not save the demo.");
    return { ok: true };
  });
