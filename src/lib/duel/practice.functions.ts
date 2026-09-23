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
    };
  });

/** Word puzzles: checks one word or ladder rung using server-only vocabulary. */
export const practiceCheckWordFn = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { puzzle: PuzzleData; word: string; found: string[]; path?: number[] }) => input,
  )
  .handler(async ({ data }) => {
    const found = Array.isArray(data.found) ? data.found.slice(0, 200).map(String) : [];
    if (data.puzzle.type === "wordhunt") {
      const { checkWordHuntPath } = await import("./wordHunt.server");
      const path = Array.isArray(data.path) ? data.path.slice(0, 16).map(Number) : [];
      return checkWordHuntPath(data.puzzle.grid, path, found);
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
