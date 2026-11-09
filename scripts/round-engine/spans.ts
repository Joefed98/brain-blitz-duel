/**
 * The spans of main da93f5d that scripts/round-engine/legacy.ts copies for round-engine-parity-check (B6,
 * docs/round-engine/plan.md). Each is cut from the file at LEGACY_COMMIT between `begin` (included) and `end`
 * (excluded; null = the end of the file), with `subs` applied in order (exact text → exact text: only the dynamic
 * imports a copy outside src/lib/duel can't resolve, and the one database call the room row is captured from).
 * `sha256` is the span's hash before the subs, so the check can prove the copy without git history.
 *
 * Temporary: retired with legacy.ts and the parity check at the start of wave 3, with Joe's approval.
 */
import { createHash } from "node:crypto";

export const LEGACY_COMMIT = "da93f5d";

export interface LegacySpan {
  id: string;
  file: string;
  begin: string;
  end: string | null;
  /** The end marker is included (snippets ending on a closing line). */
  endIncluded?: boolean;
  subs: [string, string][];
  sha256: string;
}

export const SPANS: Omit<LegacySpan, "sha256">[] = [
  { id: "roomGrade", file: "src/lib/duel/roomGrade.server.ts", begin: "export interface RoomReceipt {", end: null, subs: [] },
  { id: "asyncWindow", file: "src/lib/duel/asyncRoom.ts", begin: "export interface AsyncRoundWindow {", end: "/** One round as its player sees it", subs: [] },
  {
    id: "gradeAsync",
    file: "src/lib/duel/asyncRoom.server.ts",
    begin: "/** The room's grading of an async answer",
    end: "/** Grades and stores the caller's answer",
    subs: [['const { gradeRoomAnswer } = await import("./roomGrade.server");', "const { gradeRoomAnswer } = LEGACY_ROOM_GRADE;"]],
  },
  { id: "asyncValues", file: "src/lib/duel/asyncRoom.server.ts", begin: "  const values = {\n    answered: true,", end: "\n  };\n", endIncluded: true, subs: [] },
  {
    id: "roomRow",
    file: "src/lib/duel/duel.functions.ts",
    begin: "    const { answer, isCorrect, score, reactionAvgMs",
    end: "    if (error && error.code !== UNIQUE_VIOLATION)",
    subs: [["await insertRoundResult(client, {", "await captureRow(client, {"]],
  },
  { id: "practiceReceipt", file: "src/lib/duel/practiceReceipt.ts", begin: "export const PRACTICE_START_SLACK_MS", end: null, subs: [] },
  { id: "buildRoomPuzzles", file: "src/lib/duel/generate.server.ts", begin: "/** Generated ONCE per room", end: "// Grading lives in", subs: [] },
  { id: "dealDaily", file: "src/lib/duel/daily.server.ts", begin: "/** Deals one daily from its seed", end: "export async function dailyRoom(", subs: [] },
  { id: "dealChallenge", file: "src/lib/duel/challenge.server.ts", begin: "/** Deals one challenge:", end: "function newCode", subs: [] },
  {
    id: "dealPractice",
    file: "src/lib/duel/practice.functions.ts",
    begin: "/** One fresh practice deal of a type",
    end: "/** Generates one puzzle of the requested type",
    subs: [
      ['await import("./generate.server")', 'await import("../../src/lib/duel/generate.server")'],
      ['await import("./selection")', 'await import("../../src/lib/duel/selection")'],
    ],
  },
];

/** The span of `text` a spec names (throws when a marker is missing or not unique). */
export function cutSpan(text: string, spec: Pick<LegacySpan, "id" | "begin" | "end" | "endIncluded">): string {
  const at = text.indexOf(spec.begin);
  if (at < 0 || text.indexOf(spec.begin, at + 1) >= 0) throw new Error(`${spec.id}: begin marker missing or not unique`);
  if (spec.end === null) return text.slice(at);
  const endAt = text.indexOf(spec.end, at + spec.begin.length);
  if (endAt < 0) throw new Error(`${spec.id}: end marker missing`);
  return text.slice(at, spec.endIncluded ? endAt + spec.end.length : endAt);
}

export const applySubs = (text: string, subs: [string, string][]) => subs.reduce((t, [from, to]) => t.split(from).join(to), text);
export const reverseSubs = (text: string, subs: [string, string][]) =>
  [...subs].reverse().reduce((t, [from, to]) => t.split(to).join(from), text);
export const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

/** The copy of a span in legacy.ts, between its `// legacy:begin <id>` and `// legacy:end <id>` lines. */
export function copyIn(legacy: string, id: string): string | null {
  const begin = `// legacy:begin ${id}\n`;
  const end = `// legacy:end ${id}\n`;
  const at = legacy.indexOf(begin);
  const endAt = legacy.indexOf(end, at);
  return at < 0 || endAt < 0 ? null : legacy.slice(at + begin.length, endAt);
}
