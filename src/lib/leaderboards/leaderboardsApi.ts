/**
 * Leaderboards on the phone (wave 4, session W4a; docs/leaderboards.md): the server calls the screens use. Nothing
 * here works out a rank or decides who is shown; the server answers.
 */
import type {
  BoardPeriod,
  BoardScope,
  BoardVisibility,
  DailyBoardKind,
  DailyBoardPage,
  DailyBoardScope,
  RatingBoard,
  RatingBoardPage,
} from "./boards";

export type BoardRefusal = { ok: false; reason: string; message: string };
type Answer<T> = ({ ok: true } & T) | BoardRefusal;

type Functions = typeof import("./leaderboards.functions");
let override: Partial<Functions> | null = null;

/** Checks only: stands in for the server functions (leaderboards-ui-check); null puts the real ones back. */
export function setLeaderboardFunctionsForChecks(stand: Partial<Functions> | null): void {
  override = stand;
}

async function fns(): Promise<Functions> {
  if (override) return override as Functions;
  return import("./leaderboards.functions");
}

const OFFLINE: BoardRefusal = { ok: false, reason: "error", message: "We couldn’t load the board. Try again in a moment." };

/** Runs a call; a network failure, or an answer that isn't the server's shape, reads as the plain "couldn't load". */
async function call<T>(run: () => Promise<Answer<T>>): Promise<Answer<T>> {
  try {
    const answer = await run();
    return answer && typeof answer === "object" && typeof (answer as { ok?: unknown }).ok === "boolean" ? answer : OFFLINE;
  } catch {
    return OFFLINE;
  }
}

export const leaderboardsApi = {
  rating: (input: { board: RatingBoard; scope: BoardScope; period: BoardPeriod; offset?: number }) =>
    call(async () => (await fns()).ratingBoardFn({ data: input }) as Promise<Answer<{ page: RatingBoardPage }>>),
  daily: (input: { kind: DailyBoardKind; day?: string; scope: DailyBoardScope }) =>
    call(async () => (await fns()).dailyBoardFn({ data: input }) as Promise<Answer<{ page: DailyBoardPage }>>),
  visibility: () =>
    call(async () => (await fns()).boardVisibilityFn() as Promise<Answer<{ visibility: BoardVisibility }>>),
  setVisibility: (show: boolean | null) =>
    call(async () => (await fns()).setBoardVisibilityFn({ data: { show } }) as Promise<Answer<{ visibility: BoardVisibility }>>),
};
