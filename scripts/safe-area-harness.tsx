/**
 * Browser page for safe-area-screens-check (a copy of beat-hold-harness.tsx plus the
 * home screen): mounts the real home (src/routes/index.tsx), practice
 * (src/routes/practice.tsx), tournaments, profile or room screen (src/routes/duel.$code.tsx) with the app's
 * real CSS and components. Only the network edge is replaced (the check's Vite plugin
 * swaps these modules for stubs that call `window.__harness`): server functions, the
 * room API, Supabase, the room/chat hooks and the router. The check sets the room
 * state (status, phase, results) each screen is drawn from.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";

import "../src/styles.css";
import { serverNow } from "@/lib/duel/clock";
import type { DuelPlayerRow, DuelRow, PuzzleData, RoundResultRow } from "@/lib/duel/types";
import { puzzleDef } from "@/lib/duel/registry";
import { bootPlayCards } from "@/lib/playCards";
import { TERMS_KEY, TERMS_VERSION, termsAgreed } from "@/lib/beta/terms";
import { Route as DuelRoute } from "@/routes/duel.$code";
import { Route as HomeRoute } from "@/routes/index";
import { Route as PracticeRoute } from "@/routes/practice";
import { Route as TournamentsRoute } from "@/routes/tournaments";
import { Route as ProfileRoute } from "@/routes/profile";
import { Route as DailyRoute } from "@/routes/daily";
import { Route as ChallengeRoute } from "@/routes/challenge";
import { Route as TermsRoute } from "@/routes/terms";
import { CelebrationLayer } from "@/components/fx/CelebrationLayer";
import { celebrationsOn } from "@/lib/fx/celebrations";

interface Verdict {
  isCorrect: boolean;
  score: number;
}
interface Submission {
  at: number;
  msRemaining: number;
  answer: string;
}
interface Room {
  duel: DuelRow;
  players: DuelPlayerRow[];
  results: RoundResultRow[];
}
interface Harness {
  /** The puzzle practice "generates" for each type. */
  puzzles: Record<string, PuzzleData>;
  /** What the stubbed server grades the next submission as. */
  verdict: Verdict;
  /** Server latency for grading / storing a result (ms). */
  latencyMs: number;
  submissions: Submission[];
  /** When the stubbed server's result reached the phone. */
  verdictAt: number | null;
  room: Room | null;
  /** Display names drawn in place of a game's own (the room play header's longest-name case). */
  names?: Record<string, string>;
  call: (module: string, name: string, args: unknown[]) => unknown;
  /**
   * The daily challenge's server (daily-shots, no-wrap-check): today's status, each board by
   * "<kind>:<day>", the attempt view and each round's reveal. Absent: the daily is unavailable.
   */
  daily?: {
    status: unknown;
    boards: Record<string, unknown>;
    view: unknown;
    reveals: unknown[];
  };
  /**
   * Friend challenges' server (challenge-shots, theme-check, no-wrap-check): the link's info, the
   * run's roster, pings and round boards, the final board and Profile's list. Absent: unavailable.
   * The run's rounds themselves go through the async-room stand-ins above (H.daily's view).
   */
  challenge?: {
    info: unknown;
    roster: unknown;
    pings: number[];
    boards: Record<number, unknown>;
    final: unknown;
    list: unknown[];
  };
  /** play-tab-shift-check: the stand-in server's delay, challenge availability and the last room's state. */
  slowMs?: number;
  challengesAvailable?: boolean;
  rejoin?: { code: string; status: string; players: number };
  /** The route's search (useSearch): the challenge screen's ?code=. */
  search?: Record<string, string>;
  /** Where useNavigate was sent (share-check: a shared link's redirect). */
  navigations?: unknown[];
  /** The link join's room preview (share-check sets window.__harnessPreview before load: a finished or full room); an open lobby if unset. */
  preview?: unknown;
  /** Share loop events the page sent (share-check), in order. */
  shareEvents?: unknown[];
  /** A chat message arriving live (chat-notice-check: the toast); set through H.chat. */
  chatIncoming?: unknown;
  chat?: (message: unknown) => void;
  /** The stubbed exports called, in order (beta-extras-check: nothing is created before the terms). */
  calls?: string[];
  /** Change the room from a check (room-extras-check: a player finishing) and redraw. */
  update?: (change: (room: Room) => void) => void;
  /**
   * Intro demos (demo-intro-check): the saved demo getIntroDemoFn returns for each type (absent: none),
   * after demoDelayMs (a slow server, so the still shows first).
   */
  demos?: Record<string, unknown>;
  demoDelayMs?: number;
  /** The closed round roundReplayFn returns on the results screen (demo-intro-check's replay pass; absent: none). */
  replay?: unknown;
}

const w = window as unknown as { __harness: Harness };
const H = w.__harness;

/* ---------------------------------------------------------------- room store */

const listeners = new Set<() => void>();
let version = 0;
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const bump = () => {
  version++;
  listeners.forEach((fn) => fn());
};

function useNow(intervalMs = 100): number {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const id = window.setInterval(() => setNow(serverNow()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function useDuel() {
  useSyncExternalStore(subscribe, () => version);
  const now = useNow(100);
  const room = H.room!;
  const me = room.players[0]!;
  return {
    loading: false,
    notFound: false,
    duel: room.duel,
    players: room.players,
    results: room.results,
    me,
    opponent: room.players[1] ?? null,
    roomPlayers: room.players,
    isHost: true,
    isMulti: room.players.length > 2,
    now,
    refresh: async () => undefined,
  };
}

function useRoomChat() {
  useSyncExternalStore(subscribe, () => version);
  return {
    incoming: H.chatIncoming ?? null,
    messages: [],
    reactions: [],
    unread: 0,
    sheetOpen: false,
    setSheetOpen: () => undefined,
    sending: false,
    error: null,
    notice: null,
    send: async () => undefined,
    react: async () => undefined,
    report: async () => undefined,
    mutedUserIds: [],
    toggleLocalMute: () => undefined,
  };
}

/** A Supabase client that does nothing: every property is a callable no-op. */
function inert(): unknown {
  const fn = () => proxy;
  const proxy: unknown = new Proxy(fn, {
    get: (_t, key) => (key === "then" ? undefined : proxy),
    apply: () => proxy,
  });
  return proxy;
}

function submitAnswer(params: { msRemaining: number; answer: string }) {
  H.submissions.push({ at: Date.now(), msRemaining: params.msRemaining, answer: params.answer });
  const room = H.room!;
  const verdict = H.verdict;
  setTimeout(() => {
    room.results = [
      ...room.results,
      {
        id: `r${room.results.length}`,
        duel_id: room.duel.id,
        player_slot: 1,
        round_number: room.duel.current_round,
        answer: params.answer,
        is_correct: verdict.isCorrect,
        ms_remaining: params.msRemaining,
        reaction_avg_ms: null,
        correct_count: null,
        errors: null,
        extra: null,
        score: verdict.score,
        submitted_at: new Date().toISOString(),
      },
    ];
    H.verdictAt = Date.now();
    bump();
  }, H.latencyMs);
  return Promise.resolve();
}

async function practiceGenerateFn({ data }: { data: { type: string } }) {
  return { puzzle: H.puzzles[data.type], sealed: "sealed" };
}

async function practiceGradeFn({
  data,
}: {
  data: { puzzle: PuzzleData; answer: string; msRemaining: number };
}) {
  H.submissions.push({ at: Date.now(), msRemaining: data.msRemaining, answer: data.answer });
  const verdict = H.verdict;
  await new Promise((resolve) => setTimeout(resolve, H.latencyMs));
  H.verdictAt = Date.now();
  return {
    puzzle: data.puzzle,
    isCorrect: verdict.isCorrect,
    score: verdict.score,
    msRemaining: data.msRemaining,
    reactionAvgMs: null,
    answer: data.answer,
    extraJson: null,
  };
}

/** The link-join preview: an open lobby with room to join. */
async function fetchRoomPreview(roomCode: string) {
  const forced = (window as unknown as { __harnessPreview?: unknown }).__harnessPreview;
  return H.preview ?? forced ?? { found: true, roomCode, state: "lobby", playerCount: 2, maxPlayers: 10 };
}

/** Word checks (practice and room): every word is "not a word", so word boards (Slider) can be drawn. */
async function practiceCheckWordFn({ data }: { data: { word: string } }) {
  return { valid: false, points: 0, word: data.word, reason: "harness" };
}
async function checkWord(_duelId: string, _round: number, word: string) {
  return { valid: false, points: 0, word, reason: "harness" };
}

/* The daily challenge (daily.functions.ts, asyncRoom.functions.ts) from H.daily. */
async function dailyStatusFn() {
  await slow();
  if (!H.daily) throw new Error("no daily");
  // The same call says whether challenges are available (daily.server.ts).
  return { ...(H.daily.status as object), challenges: H.challengesAvailable ?? !!H.challenge };
}
async function dailyBoardFn({ data }: { data: { kind: string; day: string } }) {
  return H.daily?.boards[`${data.kind}:${data.day}`] ?? null;
}
async function dailyStartFn() {
  return { ok: true, roomId: "daily-room", created: false };
}
async function asyncAttemptFn() {
  return { ok: true, view: H.daily?.view, serverNow: Date.now() };
}
async function asyncRevealFn({ data }: { data: { roundNumber: number } }) {
  const reveal = H.daily?.reveals[data.roundNumber - 1];
  return reveal ? { ok: true, json: JSON.stringify(reveal) } : { ok: false, message: "none" };
}

/** A round starts on the stand-in server's clock and its puzzle (H.puzzles by type) arrives. */
async function asyncRoundStartFn({ data }: { data: { roundNumber: number } }) {
  const view = H.daily?.view as { rounds: { type: string; startedAt: number | null }[] } | undefined;
  const round = view?.rounds[data.roundNumber - 1];
  if (!round) return { ok: false, message: "none" };
  round.startedAt ??= Date.now();
  return { ok: true, puzzle: H.puzzles[round.type], startedAt: round.startedAt };
}
/** Stores H.verdict's score for the round (the stand-in grade) and its reveal. */
async function asyncSubmitFn({ data }: { data: { roundNumber: number; answer: string; msRemaining: number } }) {
  H.submissions.push({ at: Date.now(), msRemaining: data.msRemaining, answer: data.answer });
  const view = H.daily?.view as { rounds: { type: string; score: number | null }[]; total: number; finished: boolean };
  const round = view.rounds[data.roundNumber - 1]!;
  if (round.score !== null) return { ok: true, alreadySubmitted: true };
  round.score = H.verdict.score;
  view.total = view.rounds.reduce((sum, r) => sum + (r.score ?? 0), 0);
  view.finished = view.rounds.every((r) => r.score !== null);
  H.daily!.reveals[data.roundNumber - 1] = {
    puzzle: H.puzzles[round.type],
    result: { id: "r", duel_id: "daily-room", player_slot: 1, round_number: data.roundNumber, answer: data.answer, is_correct: H.verdict.isCorrect, ms_remaining: data.msRemaining, reaction_avg_ms: null, correct_count: null, errors: null, extra: null, score: H.verdict.score, submitted_at: "" },
    missed: false,
    summary: "Sample",
    detail: [],
    correctAnswer: null,
  };
  return { ok: true, score: H.verdict.score };
}

/** The stand-in server's answer time for the Play tab's late cards (play-tab-shift-check: a slow server). */
const slow = () => new Promise((resolve) => setTimeout(resolve, H.slowMs ?? 0));

/* Friend challenges (challenge.functions.ts) from H.challenge (or H.challengesAvailable). */
async function challengeStatusFn() {
  await slow();
  return { available: H.challengesAvailable ?? !!H.challenge };
}

/** The device's last room for the Play tab's Rejoin card (H.rejoin; none: not found). */
const SUPABASE = inert();
async function fetchDuelByCode(code: string) {
  await slow();
  const r = H.rejoin;
  if (!r || r.code !== code) return null;
  return { id: "rejoin-duel", room_code: code, status: r.status, disbanded_at: null };
}
async function fetchPlayers() {
  const r = H.rejoin;
  // The device's own row carries the stand-in session's id (the inert client's), as currentUserId reads it.
  return Array.from({ length: r?.players ?? 0 }, (_, i) => ({ player_slot: i + 1, status: "active", user_id: i === 0 ? SUPABASE : `u${i}` }));
}
async function challengeInfoFn() {
  return H.challenge?.info ?? { found: false };
}
async function createChallengeFn() {
  return { ok: true, code: "K7QM2X", roomId: "challenge-room" };
}
async function startChallengeFn() {
  return { ok: true, roomId: "challenge-room", created: true };
}
async function challengeFromRoomFn() {
  return { ok: true, code: "K7QM2X", roomId: "challenge-room", created: true };
}
async function challengeRosterFn() {
  return H.challenge?.roster ?? null;
}
async function challengePingsFn() {
  return H.challenge?.pings ?? [];
}
async function challengeRoundBoardFn({ data }: { data: { roundNumber: number } }) {
  const board = H.challenge?.boards[data.roundNumber];
  return board ? { ok: true, json: JSON.stringify(board) } : { ok: false, message: "none" };
}
async function challengeFinalFn() {
  return H.challenge?.final ? { ok: true, json: JSON.stringify(H.challenge.final) } : { ok: false, message: "none" };
}
async function myChallengesFn() {
  return H.challenge?.list ?? [];
}

/** The saved intro demo for a type (H.demos), after H.demoDelayMs. */
async function getIntroDemoFn({ data }: { data: { type: string } }) {
  await new Promise((resolve) => setTimeout(resolve, H.demoDelayMs ?? 0));
  return (H.demos?.[data.type] as unknown) ?? null;
}
/** The results screen's closed round (H.replay). */
async function roundReplayFn() {
  return H.replay ? { ok: true, data: H.replay } : { ok: false, message: "none" };
}

/** The share loop's beta recording: kept for share-check to read. */
async function recordShareEventFn({ data }: { data: unknown }) {
  (H.shareEvents ??= []).push(data);
  return { ok: true };
}

const IMPLEMENTATIONS: Record<string, unknown> = {
  getIntroDemoFn,
  roundReplayFn,
  challengeStatusFn,
  challengeInfoFn,
  createChallengeFn,
  startChallengeFn,
  challengeFromRoomFn,
  challengeRosterFn,
  challengePingsFn,
  challengeRoundBoardFn,
  challengeFinalFn,
  myChallengesFn,
  asyncRoundStartFn,
  asyncSubmitFn,
  dailyStatusFn,
  dailyBoardFn,
  dailyStartFn,
  asyncAttemptFn,
  asyncRevealFn,
  fetchRoomPreview,
  recordShareEventFn,
  practiceCheckWordFn,
  checkWord,
  useDuel,
  useNow,
  useRoomChat,
  submitAnswer,
  practiceGenerateFn,
  practiceGradeFn,
  supabase: SUPABASE,
  fetchDuelByCode,
  fetchPlayers,
  DuelError: class DuelError extends Error {},
};

H.chat = (message) => {
  H.chatIncoming = message;
  bump();
};

H.update = (change) => {
  change(H.room!);
  bump();
};

/** Every stubbed export resolves here; anything not listed is an async no-op. Each call's name is kept in order (beta-extras-check). */
H.call = (_module, name) => {
  (H.calls ??= []).push(name);
  return IMPLEMENTATIONS[name] ?? (async () => null);
};

/* --------------------------------------------------------------------- mount */

// A returning device: the beta terms (lib/beta/terms.ts) were agreed on an earlier visit, so the room,
// daily and challenge screens draw themselves. ?terms=0 draws a device that hasn't agreed yet
// (beta-extras-check: the terms come first).
if (new URLSearchParams(location.search).get("terms") !== "0")
  try {
    if (!termsAgreed()) localStorage.setItem(TERMS_KEY, JSON.stringify({ version: TERMS_VERSION, agreedAt: "2026-10-20T12:00:00.000Z" }));
  } catch {
    /* ignore */
  }

// The root's inline boot script (playCards.ts): which Play tab cards to reserve before the first paint.
bootPlayCards();

for (const [type, name] of Object.entries(H.names ?? {}))
  (puzzleDef(type as never) as { name: string }).name = name;

const mode = new URLSearchParams(location.search).get("mode");
const Screen = (
  mode === "room"
    ? DuelRoute
    : mode === "home"
      ? HomeRoute
      : mode === "tournaments"
        ? TournamentsRoute
        : mode === "profile"
          ? ProfileRoute
          : mode === "daily"
            ? DailyRoute
            : mode === "challenge"
              ? ChallengeRoute
              : mode === "terms"
                ? TermsRoute
                : PracticeRoute
).options.component as () => JSX.Element;
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}>
    <Screen />
    {/* The root's celebrations layer (src/routes/__root.tsx), while FX_CELEBRATIONS is on. */}
    {celebrationsOn() ? <CelebrationLayer /> : null}
  </QueryClientProvider>,
);
