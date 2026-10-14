/**
 * Browser page for safe-area-screens-check (a copy of beat-hold-harness.tsx plus the
 * home screen): mounts the real home (src/routes/index.tsx), practice
 * (src/routes/practice.tsx) or room screen (src/routes/duel.$code.tsx) with the app's
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
import { Route as DuelRoute } from "@/routes/duel.$code";
import { Route as HomeRoute } from "@/routes/index";
import { Route as PracticeRoute } from "@/routes/practice";

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
  call: (module: string, name: string, args: unknown[]) => unknown;
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
  return {
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
  return { found: true, roomCode, state: "lobby", playerCount: 2, maxPlayers: 10 };
}

const IMPLEMENTATIONS: Record<string, unknown> = {
  fetchRoomPreview,
  useDuel,
  useNow,
  useRoomChat,
  submitAnswer,
  practiceGenerateFn,
  practiceGradeFn,
  supabase: inert(),
  DuelError: class DuelError extends Error {},
};

/** Every stubbed export resolves here; anything not listed is an async no-op. */
H.call = (_module, name) => IMPLEMENTATIONS[name] ?? (async () => null);

/* --------------------------------------------------------------------- mount */

const mode = new URLSearchParams(location.search).get("mode");
const Screen = (mode === "room" ? DuelRoute : mode === "home" ? HomeRoute : PracticeRoute).options
  .component as () => JSX.Element;
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}>
    <Screen />
  </QueryClientProvider>,
);
