/**
 * The phone's copy of its player's practice progress (wave 2 C1a; docs/practice-progress.md): read from the server
 * (getMyPracticeProgressFn) once per player per visit, again when the player changes (signing in, out, or to another
 * account), and updated in place by each graded run's own answer (`applyPracticeRun`), so another phone signed in to
 * the same account shows exactly the same stars and bests. The server's last answer is also kept as a display-only
 * copy (progressCache.ts) under the session's auth id, shown only until the server answers (Practice opened offline
 * after a restart); it is never sent anywhere or trusted.
 */
import { useEffect, useState } from "react";

import { useAccount } from "@/lib/account/accountApi";

import { clearDeviceProgressOnce } from "./deviceFreshStart";
import { readShownProgress, saveShownProgress } from "./progressCache";
import { EMPTY_PROGRESS, withRun, type PracticeProgressView, type PracticeRunProgress } from "./progress";

let current: PracticeProgressView | null = null;
let currentFor: string | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<(v: PracticeProgressView | null) => void>();

function publish(next: PracticeProgressView | null): void {
  current = next;
  for (const fn of listeners) fn(next);
}

/** The signed-in session's auth id (read from the device's own session, so it answers offline too), or null. */
async function sessionUserId(): Promise<string | null> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/** Keeps the server's answer as the display-only copy (progressCache.ts). Only the server's answers come here. */
function keepFromServer(view: PracticeProgressView): void {
  void sessionUserId().then((id) => {
    if (id) saveShownProgress(id, view);
  });
}

/** Before the server answers: the display-only copy of its last answer for this session's player, if any. */
export async function seedFromCopy(): Promise<void> {
  const id = await sessionUserId();
  const copy = readShownProgress(id);
  if (copy && !current) publish(copy);
}

/** The progress now (null until the server has answered). */
export function practiceProgressNow(): PracticeProgressView | null {
  return current;
}

/** Reads the player's progress from the server (a failure keeps what was shown). */
export function refreshPracticeProgress(player: string | null = currentFor): Promise<void> {
  currentFor = player;
  const run = (async () => {
    try {
      const { getMyPracticeProgressFn } = await import("./progress.functions");
      const answer = (await getMyPracticeProgressFn()) as PracticeProgressView | { busy: true };
      if (currentFor !== player) return;
      if ("busy" in answer) return;
      publish(answer);
      keepFromServer(answer);
    } catch {
      /* offline or signed out: keep what is shown */
    }
  })();
  loading = run;
  return run;
}

/** Lays one graded run's answer over the progress shown (the grade's own `progress`). */
export function applyPracticeRun(type: string, run: PracticeRunProgress | null | undefined): void {
  if (!run || !run.counted) return;
  const next = withRun(current ?? EMPTY_PROGRESS, type, run);
  publish(next);
  keepFromServer(next);
}

/**
 * Records on the server that the one-time refresh note has been shown (it stays on screen for this visit; the next
 * read answers it as seen, on this phone and every other).
 */
export function notePracticeRefreshSeen(): void {
  void (async () => {
    try {
      const { markPracticeRefreshNoteSeenFn } = await import("./progress.functions");
      await markPracticeRefreshNoteSeenFn();
    } catch {
      /* shown again next visit at most */
    }
  })();
}

/** The player's practice progress, shared by every screen (null until the server has answered). */
export function usePracticeProgress(): PracticeProgressView | null {
  const account = useAccount();
  const player = account.kind === "unknown" ? null : (account as { userId?: string | null }).userId ?? "guest";
  const [view, setView] = useState<PracticeProgressView | null>(current);
  useEffect(() => {
    clearDeviceProgressOnce();
    listeners.add(setView);
    setView(current);
    if (!current) void seedFromCopy();
    return () => {
      listeners.delete(setView);
    };
  }, []);
  useEffect(() => {
    if (player === null) return;
    if (player !== currentFor) {
      if (currentFor !== null) publish(null);
      void refreshPracticeProgress(player);
    } else if (!current && !loading) void refreshPracticeProgress(player);
  }, [player]);
  return view;
}

/** Checks only: forget the copy. */
export function resetPracticeProgressForChecks(): void {
  current = null;
  currentFor = null;
  loading = null;
}
