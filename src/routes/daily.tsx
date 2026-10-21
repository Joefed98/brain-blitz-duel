import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AsyncResults } from "@/components/async/AsyncResults";
import { AsyncRun } from "@/components/async/AsyncRun";
import { DailyBoard } from "@/components/daily/DailyBoard";
import { Dots, WaitingLine } from "@/components/duel/Dots";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { asyncAttempt, dailyBoard, dailyStatus, startDaily } from "@/lib/duel/asyncApi";
import type { AsyncAttemptView } from "@/lib/duel/asyncRoom";
import { serverNow } from "@/lib/duel/clock";
import {
  DAILY_KINDS,
  DAILY_ROUNDS,
  DAILY_TITLE,
  isDailyKind,
  rankLine,
  type DailyBoardView,
  type DailyKind,
  type DailyState,
  type DailyStatus,
} from "@/lib/duel/daily";
import { noteDailyFinished, noteDailyPlayed } from "@/lib/duel/dailyRecord";
import { ordinal } from "@/lib/duel/ordinal";
import { rememberedLook, type PlayerLook } from "@/lib/duel/playerLook";
import { getStoredName, setStoredName } from "@/lib/duel/session";
import { buzz } from "@/lib/motion";
import { unlockAudio } from "@/lib/sound";
import { APP_NAME } from "@/lib/brand";

export const Route = createFileRoute("/daily")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { kind?: DailyKind } =>
    isDailyKind(search["kind"]) ? { kind: search["kind"] } : {},
  head: () => ({
    meta: [
      { title: `${APP_NAME} daily challenge` },
      {
        name: "description",
        content: `Today's ${APP_NAME} Daily Puzzle and Daily Arcade: the same games for everyone, one go each, and the leaderboards.`,
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DailyScreen,
});

type Day = "today" | "yesterday";
type Mode =
  | { kind: "board" }
  | { kind: "run"; roomId: string }
  | { kind: "results"; roomId: string; view: AsyncAttemptView };

/** "Closes in 5h 12m" (UK midnight). */
function closesIn(ms: number): string {
  const minutes = Math.max(0, Math.ceil(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `Closes in ${hours}h ${minutes % 60}m` : `Closes in ${minutes}m`;
}

function stateLine(kind: DailyKind, state: DailyState, count: number | null): string {
  if (state.state === "play") return `${DAILY_ROUNDS[kind]} rounds · one go`;
  if (state.state === "continue")
    return `${state.roundsDone} of ${DAILY_ROUNDS[kind]} rounds played`;
  return `${state.total} points · ${rankLine(state.rank, count, ordinal)}`;
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid grid-flow-col gap-1.5"
      style={{ gridAutoColumns: "minmax(0, 1fr)" }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          data-daily-tab={option.value}
          onClick={() => onChange(option.value)}
          className={`th-chip th-hit press tap-target inline-flex items-center justify-center whitespace-nowrap rounded-full border px-3 font-display text-xs font-bold uppercase tracking-wide ${
            value === option.value ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function DailyScreen() {
  const router = useRouter();
  const search = Route.useSearch() as { kind?: DailyKind };
  const [kind, setKind] = useState<DailyKind>(search.kind ?? "puzzle");
  const [day, setDay] = useState<Day>("today");
  const [status, setStatus] = useState<DailyStatus | null>(null);
  const [board, setBoard] = useState<DailyBoardView | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: "board" });
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [look, setLook] = useState<PlayerLook>({ colour: 0, icon: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => serverNow());

  useEffect(() => {
    const stored = getStoredName();
    setName(stored);
    setEditingName(stored.trim() === "");
    const remembered = rememberedLook();
    setLook({ colour: remembered.colour ?? 0, icon: remembered.icon ?? null });
    const id = window.setInterval(() => setNow(serverNow()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setStatus(await dailyStatus());
    } catch {
      setStatus((current) => current ?? null);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!status?.available || mode.kind !== "board") return;
    let live = true;
    setBoard(null);
    void dailyBoard(kind, day).then(
      (next) => live && setBoard(next),
      () => live && setBoard(null),
    );
    return () => {
      live = false;
    };
  }, [kind, day, status, mode.kind]);

  const back = () => {
    const state = (router.history?.location?.state ?? {}) as { fromPlayTab?: boolean };
    if (state.fromPlayTab) router.history.back();
    else void router.navigate({ to: "/", replace: true });
  };
  const backButton = (
    <button
      type="button"
      onClick={() => setMode({ kind: "board" })}
      className="press tap-target -ml-2 flex items-center gap-1 px-2 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground"
    >
      <ChevronLeft aria-hidden="true" className="h-4 w-4" /> Daily
    </button>
  );

  const play = async () => {
    unlockAudio();
    const trimmed = name.trim();
    if (!trimmed) {
      setEditingName(true);
      setError("Enter a display name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const started = await startDaily(kind, trimmed, look);
      if (!started.ok) {
        setError(started.message);
        if (started.nameRefused) setEditingName(true);
        buzz([10, 50, 10]);
        return;
      }
      setStoredName(trimmed);
      if (status) noteDailyPlayed(status.day);
      setMode({ kind: "run", roomId: started.roomId });
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const openResults = async () => {
    setBusy(true);
    try {
      const started = await startDaily(kind, name.trim() || "Player", look);
      if (!started.ok) return setError(started.message);
      const view = await asyncAttempt(started.roomId);
      if (view) setMode({ kind: "results", roomId: started.roomId, view });
    } finally {
      setBusy(false);
    }
  };

  const finished = useCallback(
    (view: AsyncAttemptView) => {
      if (status && view.finished) noteDailyFinished(status.day, kind, view.total);
      setMode((current) =>
        current.kind === "run" ? { kind: "results", roomId: current.roomId, view } : current,
      );
      void refresh();
      // The results' place line comes from today's board, now open.
      void dailyBoard(kind, "today").then(setBoard, () => undefined);
    },
    [status, kind, refresh],
  );

  if (mode.kind === "run") {
    return (
      <AsyncRun
        roomId={mode.roomId}
        title={DAILY_TITLE[kind]}
        onDone={finished}
        leave={backButton}
      />
    );
  }
  if (mode.kind === "results") {
    const me = board?.day === status?.day ? board?.me : null;
    return (
      <AsyncResults
        roomId={mode.roomId}
        view={mode.view}
        title={DAILY_TITLE[kind]}
        placeLine={
          me && board ? (me.rank === null ? null : rankLine(me.rank, board.count, ordinal)) : null
        }
        onBoard={() => {
          setDay("today");
          setMode({ kind: "board" });
        }}
      />
    );
  }

  if (!status) {
    return (
      <PhoneShell skin="play">
        <div className="flex flex-1 items-center justify-center">
          <WaitingLine label="Loading the daily" />
        </div>
      </PhoneShell>
    );
  }

  const header = (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={back}
        className="press tap-target -ml-2 flex items-center gap-1 px-2 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground"
      >
        <ChevronLeft aria-hidden="true" className="h-4 w-4" /> Play
      </button>
      {status.available ? (
        <span data-tone="gold" className="th-pill shrink-0 whitespace-nowrap">
          {closesIn(status.closesAt - now)}
        </span>
      ) : null}
    </div>
  );

  if (!status.available) {
    return (
      <PhoneShell skin="play">
        <div className="flex flex-1 flex-col gap-5">
          {header}
          <h1 className="font-display text-2xl font-bold uppercase">Daily challenge</h1>
          <p className="th-empty rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            The daily challenge is coming soon.
          </p>
        </div>
      </PhoneShell>
    );
  }

  const state = status[kind];
  const lockedNote = `Finish today's ${DAILY_ROUNDS[kind]} rounds to see the board.`;
  return (
    <PhoneShell skin="play">
      <div data-daily-screen className="flex flex-1 flex-col gap-4">
        {header}
        <div>
          <h1 className="whitespace-nowrap font-display text-2xl font-bold uppercase">
            Daily challenge
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Same games for everyone. One go each. New at midnight UK time.
          </p>
        </div>

        <Segmented
          label="Daily"
          value={kind}
          options={DAILY_KINDS.map((k) => ({ value: k, label: DAILY_TITLE[k] }))}
          onChange={(next) => {
            setKind(next);
            setError(null);
          }}
        />

        {day === "today" ? (
          <section
            aria-label={`Today's ${DAILY_TITLE[kind]}`}
            data-tint="gold"
            data-daily-state={state.state}
            className="th-card flex flex-col gap-3 rounded-2xl border border-border bg-card/80 p-4"
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="th-kicker text-primary">Today · {DAILY_TITLE[kind]}</p>
              <p className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                {stateLine(kind, state, state.state === "done" ? state.count : null)}
              </p>
            </div>
            {state.state === "play" && editingName ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="daily-name" className="th-kicker text-muted-foreground">
                  Name on the leaderboard
                </label>
                <input
                  id="daily-name"
                  value={name}
                  maxLength={14}
                  placeholder="Your name"
                  autoComplete="nickname"
                  onChange={(e) => {
                    setError(null);
                    setName(e.target.value);
                  }}
                  className="th-input tap-target w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>
            ) : state.state === "play" ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="min-w-0 truncate">
                  Playing as <span className="th-name text-foreground">{name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  className="press tap-target shrink-0 px-2 font-display text-xs font-semibold uppercase tracking-widest text-primary"
                >
                  Change name
                </button>
              </p>
            ) : null}
            {state.state === "done" ? (
              <button
                type="button"
                data-daily-results
                disabled={busy}
                onClick={() => void openResults()}
                className="th-btn-outline-gold press tap-target w-full whitespace-nowrap rounded-xl border border-primary/70 bg-primary/10 font-display text-sm font-bold uppercase tracking-wide text-primary"
              >
                {busy ? <Dots className="bg-primary" /> : "Your results"}
              </button>
            ) : (
              <button
                type="button"
                data-daily-play
                disabled={busy}
                onClick={() => void play()}
                className="th-btn-gold press tap-target flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary py-4 font-display text-lg font-extrabold uppercase tracking-wide text-primary-foreground"
              >
                {busy ? (
                  <Dots className="bg-primary-foreground" />
                ) : state.state === "continue" ? (
                  "Continue"
                ) : (
                  "Play"
                )}
              </button>
            )}
            {error ? (
              <p role="alert" className="text-sm text-warn">
                {error}
              </p>
            ) : null}
          </section>
        ) : null}

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="whitespace-nowrap font-display text-lg font-bold uppercase">
              Leaderboard
            </h2>
          </div>
          <Segmented
            label="Day"
            value={day}
            options={[
              { value: "today", label: "Today" },
              { value: "yesterday", label: "Yesterday" },
            ]}
            onChange={setDay}
          />
          {board ? (
            <DailyBoard board={board} lockedNote={lockedNote} look={look} />
          ) : (
            <div className="flex justify-center py-6">
              <WaitingLine label="Loading the board" />
            </div>
          )}
        </div>
      </div>
    </PhoneShell>
  );
}
