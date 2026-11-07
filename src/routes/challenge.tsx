import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Swords } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ErrorState } from "@/components/app/ErrorState";
import { TermsGate } from "@/components/beta/TermsGate";
import { AsyncResults } from "@/components/async/AsyncResults";
import { AsyncRun } from "@/components/async/AsyncRun";
import { rivalLooks, rivalRows, type AsyncRivals } from "@/components/async/rivals";
import { ChallengeCreate } from "@/components/challenge/ChallengeCreate";
import { ChallengeShareButton } from "@/components/challenge/ChallengeShare";
import { Dots, WaitingLine } from "@/components/duel/Dots";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { Podium } from "@/components/duel/Podium";
import { APP_NAME } from "@/lib/brand";
import { STANDARD_CATEGORIES } from "@/lib/duel/categories";
import { asyncAttempt } from "@/lib/duel/asyncApi";
import type { AsyncAttemptView } from "@/lib/duel/asyncRoom";
import {
  CHALLENGE_REF,
  challengeCodeFrom,
  challengeEndsIn,
  challengeRoundChoices,
  type ChallengeFinalBoard,
  type ChallengeInfo,
} from "@/lib/duel/challenge";
import {
  challengeFinal,
  challengeInfo,
  challengePings,
  challengeRoster,
  challengeRoundBoard,
  createChallenge,
  startChallenge,
} from "@/lib/duel/challengeApi";
import {
  noteChallengeFriendFinish,
  noteChallengeOpened,
  noteMyChallenge,
} from "@/lib/duel/challengeRecord";
import { rememberedLook, type PlayerLook } from "@/lib/duel/playerLook";
import { podiumAwards } from "@/lib/duel/podiumAwards";
import { standings } from "@/lib/duel/scoring";
import { getStoredName, setStoredName } from "@/lib/duel/session";
import { serverNow } from "@/lib/duel/clock";
import type { PuzzleCategory } from "@/lib/duel/types";
import { noteLinkArrival } from "@/lib/share/shareRef";
import { unlockAudio } from "@/lib/sound";
import { OnlineOnly } from "@/components/offline/OnlineOnly";
import { Button, Icon, Input, SkeletonPage } from "@/design/components";

export const Route = createFileRoute("/challenge")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { code?: string; ref?: string } => {
    const code = challengeCodeFrom(search["code"]);
    return {
      ...(code ? { code } : {}),
      ...(typeof search["ref"] === "string" ? { ref: search["ref"] } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: `${APP_NAME} challenge` },
      {
        name: "description",
        content: `A ${APP_NAME} challenge: the same rounds your friend played, against their scores.`,
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OfflineChallenge,
});

/** Offline practice (31 Oct 2026): with no connection, the offline state and a way to Practice. */
function OfflineChallenge() {
  return (
    <OnlineOnly body="Challenges need a connection. Practice games are saved on this phone, so they still work.">
      <GatedChallengeScreen />
    </OnlineOnly>
  );
}

/** The beta terms come first: shown once on this device before its first room, daily or challenge. */
function GatedChallengeScreen() {
  return (
    <TermsGate>
      <ChallengeScreen />
    </TermsGate>
  );
}

type Mode =
  | { kind: "loading" }
  | { kind: "create" }
  | { kind: "landing"; info: ChallengeInfo }
  | { kind: "run"; code: string; roomId: string; rivals: AsyncRivals | undefined }
  | {
      kind: "done";
      code: string;
      roomId: string;
      view: AsyncAttemptView | null;
      board: ChallengeFinalBoard | null;
    };

function Header({
  label,
  onBack,
  right,
}: {
  label: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={onBack}
        className="press tap-target -ml-2 flex items-center gap-1 px-2 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground"
      >
        <Icon name="back" size={18} className="-m-px" /> {label}
      </button>
      {right}
    </div>
  );
}

function ChallengeScreen() {
  const router = useRouter();
  const search = Route.useSearch() as { code?: string; ref?: string };
  const [code, setCode] = useState<string | null>(search.code ?? null);
  const [mode, setMode] = useState<Mode>({ kind: "loading" });
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [look, setLook] = useState<PlayerLook>({ colour: 0, icon: null });
  const [categories, setCategories] = useState<PuzzleCategory[]>([...STANDARD_CATEGORIES]);
  const [rounds, setRounds] = useState(6);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredName();
    setName(stored);
    setEditingName(stored.trim() === "");
    const remembered = rememberedLook();
    setLook({ colour: remembered.colour ?? 0, icon: remembered.icon ?? null });
  }, []);

  const home = () => {
    const state = (router.history?.location?.state ?? {}) as { fromPlayTab?: boolean };
    if (state.fromPlayTab) router.history.back();
    else void router.navigate({ to: "/", replace: true });
  };

  /** The finished run's screen: the podium when anyone else has played, else the creator's own results. */
  const finish = useCallback(
    async (forCode: string, roomId: string, view: AsyncAttemptView | null) => {
      setMode({ kind: "done", code: forCode, roomId, view, board: null });
      const [board, fresh] = await Promise.all([
        challengeFinal(roomId).catch(() => null),
        view ? Promise.resolve(view) : asyncAttempt(roomId).catch(() => null),
      ]);
      if (board && !board.isCreator) noteChallengeFriendFinish(forCode);
      setMode({ kind: "done", code: forCode, roomId, view: fresh, board });
    },
    [],
  );

  /** Into the run: the earlier players (fixed at this attempt's start), then the rounds. */
  const run = useCallback(async (forCode: string, roomId: string) => {
    const roster = await challengeRoster(roomId).catch(() => null);
    const rivals: AsyncRivals | undefined = roster
      ? {
          roster,
          pings: (round) => challengePings(roomId, round),
          board: (round) => challengeRoundBoard(roomId, round),
        }
      : undefined;
    setMode({ kind: "run", code: forCode, roomId, rivals });
  }, []);

  const load = useCallback(
    async (forCode: string) => {
      setMode({ kind: "loading" });
      try {
        const info = await challengeInfo(forCode, noteChallengeOpened(forCode));
        if (info.found && info.state === "done") return void finish(info.code, info.roomId, null);
        setMode({ kind: "landing", info });
      } catch {
        setMode({ kind: "landing", info: { found: false } });
      }
    },
    [finish],
  );

  // Beta: a device's first arrival from a shared challenge link (?ref=challenge), with its source.
  useEffect(() => {
    if (search.code && search.ref === CHALLENGE_REF) noteLinkArrival({ source: "challenge", challengeCode: search.code });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (code) void load(code);
    else setMode({ kind: "create" });
  }, [code, load]);

  // The rounds offered follow the categories (never more than they hold).
  useEffect(() => {
    const choices = challengeRoundChoices(categories);
    if (!choices.includes(rounds))
      setRounds(choices.includes(6) ? 6 : choices[choices.length - 1]!);
  }, [categories, rounds]);

  const checkedName = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setEditingName(true);
      setError("Enter a display name.");
      return null;
    }
    return trimmed;
  };

  const create = async () => {
    unlockAudio();
    const trimmed = checkedName();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const made = await createChallenge({ categories, rounds, displayName: trimmed, ...look });
      if (!made.ok) {
        setError(made.message);
        if (made.nameRefused) setEditingName(true);
        return;
      }
      setStoredName(trimmed);
      noteMyChallenge(made.code);
      // The URL now names the challenge (a reload continues it); the run starts here, not via a load.
      void router.navigate({
        to: "/challenge",
        search: { code: made.code },
        replace: true,
      } as never);
      await run(made.code, made.roomId);
    } catch {
      setError("Can’t reach us. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const play = async (info: Extract<ChallengeInfo, { found: true }>) => {
    unlockAudio();
    const trimmed = info.state === "continue" ? name.trim() || "Player" : checkedName();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const started = await startChallenge(info.code, trimmed, look);
      if (!started.ok) {
        setError(started.message);
        if (started.nameRefused) setEditingName(true);
        return;
      }
      setStoredName(trimmed);
      await run(info.code, started.roomId);
    } catch {
      setError("Can’t reach us. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (mode.kind === "run") {
    return (
      <AsyncRun
        roomId={mode.roomId}
        title="Challenge"
        rivals={mode.rivals}
        onDone={(view) => void finish(mode.code, mode.roomId, view)}
        leave={
          <button
            type="button"
            onClick={home}
            className="press tap-target -ml-2 flex items-center gap-1 px-2 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground"
          >
            <Icon name="back" size={18} className="-m-px" /> Play
          </button>
        }
      />
    );
  }

  if (mode.kind === "done")
    return (
      <ChallengeDone
        mode={mode}
        onHome={home}
        onNew={() => {
          setCode(null);
          void router.navigate({ to: "/challenge", search: {}, replace: true } as never);
          setMode({ kind: "create" });
        }}
      />
    );

  if (mode.kind === "loading") {
    return (
      <PhoneShell skin="play">
        <SkeletonPage label="Loading the challenge" rows={3} card />
      </PhoneShell>
    );
  }

  if (mode.kind === "create") {
    return (
      <PhoneShell skin="play">
        <div data-challenge-screen="create" className="flex flex-1 flex-col gap-4">
          <Header label="Play" onBack={home} />
          <div>
            <h1 className="whitespace-nowrap font-display text-2xl font-bold uppercase">
              Challenge a friend
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Play a set of rounds, then send the link. Friends play the same rounds against your
              score.
            </p>
          </div>
          <ChallengeCreate
            name={name}
            editingName={editingName}
            onName={(next) => {
              setError(null);
              setName(next);
            }}
            onEditName={() => setEditingName(true)}
            categories={categories}
            onCategories={setCategories}
            rounds={rounds}
            onRounds={setRounds}
            busy={busy}
            error={error}
            onCreate={() => void create()}
          />
        </div>
      </PhoneShell>
    );
  }

  const info = mode.info;
  if (!info.found) {
    // The shared error layout (Polish batch R): Back to Play, or Make your own challenge.
    return (
      <PhoneShell skin="play">
        <div data-challenge-screen="landing" className="flex flex-1 flex-col">
          <ErrorState
            title="Challenge not found"
            body="This challenge link doesn’t work. Check it with whoever sent it, or make your own."
            action={{ label: "Make your own challenge", onClick: () => setCode(null) }}
          />
        </div>
      </PhoneShell>
    );
  }
  return (
    <PhoneShell skin="play">
      <div data-challenge-screen="landing" className="flex flex-1 flex-col gap-4">
        <Header
          label="Play"
          onBack={home}
          right={
            info.found ? (
              <span data-tone="gold" className="th-pill shrink-0 whitespace-nowrap">
                {challengeEndsIn(info.expiresAt, serverNow())}
              </span>
            ) : null
          }
        />
        {!info.found ? (
          <>
            <h1 className="whitespace-nowrap font-display text-2xl font-bold uppercase">
              Challenge
            </h1>
            <p className="th-empty rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              This challenge link doesn’t work. Check it with whoever sent it.
            </p>
            <NewChallengeButton onClick={() => setCode(null)} />
          </>
        ) : (
          <>
            <div>
              <p className="th-kicker flex items-center gap-1.5 text-primary">
                <Swords aria-hidden="true" className="h-4 w-4" /> Challenge {info.code}
              </p>
              <h1 className="mt-1 truncate font-display text-2xl font-bold uppercase" data-ellipsis>
                {info.isCreator
                  ? "Your challenge"
                  : `${info.creatorName ?? "A friend"} challenged you`}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Same rounds, same puzzles. One go. You see how everyone before you did after each
                round.
              </p>
            </div>
            <section
              data-tint="gold"
              data-challenge-state={info.state}
              className="th-card flex flex-col gap-3 rounded-2xl border border-border bg-card/80 p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="th-kicker text-primary">{info.roundCount} rounds</p>
                <p className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                  {info.players} of {info.maxPlayers} played
                </p>
              </div>
              {info.state === "closed" || info.state === "full" ? (
                <p className="text-sm text-muted-foreground">
                  {info.state === "closed"
                    ? "This challenge has ended."
                    : `This challenge is full (${info.maxPlayers} players).`}
                </p>
              ) : (
                <>
                  {info.state === "play" && editingName ? (
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="challenge-play-name"
                        className="th-kicker text-muted-foreground"
                      >
                        Your name on the board
                      </label>
                      <Input
                        id="challenge-play-name"
                        value={name}
                        maxLength={14}
                        placeholder="Your name"
                        autoComplete="nickname"
                        onChange={(e) => {
                          setError(null);
                          setName(e.target.value);
                        }}
                      />
                    </div>
                  ) : info.state === "play" ? (
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
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {info.roundsDone} of {info.roundCount} rounds played
                    </p>
                  )}
                  <Button
                    variant="gold"
                    size={58}
                    block
                    data-challenge-play
                    disabled={busy}
                    onClick={() => void play(info)}
                  >
                    {busy ? (
                      <Dots className="bg-primary-foreground" />
                    ) : info.state === "continue" ? (
                      "Continue"
                    ) : (
                      "Play"
                    )}
                  </Button>
                </>
              )}
              {error ? (
                <p role="alert" className="text-sm text-warn">
                  {error}
                </p>
              ) : null}
            </section>
            {info.state === "closed" || info.state === "full" ? (
              <NewChallengeButton onClick={() => setCode(null)} />
            ) : null}
          </>
        )}
      </div>
    </PhoneShell>
  );
}

function NewChallengeButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="secondary"
      block
      onClick={onClick}
    >
      Make your own challenge
    </Button>
  );
}

/** The end of a run, or a finished challenge reopened: the podium with awards, or the creator's own results. */
function ChallengeDone({
  mode,
  onHome,
  onNew,
}: {
  mode: Extract<Mode, { kind: "done" }>;
  onHome: () => void;
  onNew: () => void;
}) {
  const { board, view } = mode;
  const rows = useMemo(
    () =>
      board
        ? standings(
            rivalRows(board.players),
            board.results,
            board.roundOrder.length,
            undefined,
            board.tie,
          )
        : [],
    [board],
  );
  const looks = useMemo(() => (board ? rivalLooks(board.players) : new Map()), [board]);
  const awards = useMemo(
    () =>
      board
        ? podiumAwards(rivalRows(board.players), board.results, board.awardRounds, board.tie)
        : [],
    [board],
  );
  if (!board && !view) {
    return (
      <PhoneShell skin="play">
        <SkeletonPage label="Loading the results" rows={5} />
      </PhoneShell>
    );
  }
  const total = view?.total ?? rows.find((r) => r.slot === board?.mySlot)?.total ?? 0;
  const roundCount = view?.roundCount ?? board?.roundOrder.length ?? 0;
  const done = (
    <Button
      variant="secondary"
      block
      onClick={onHome}
    >
      Done
    </Button>
  );

  // Nobody else yet: the creator's own results, and the link to send.
  if (!board || board.players.length < 2) {
    if (!view) return null;
    return (
      <AsyncResults
        roomId={mode.roomId}
        view={view}
        title="Your challenge"
        placeLine="Now send it to a friend"
        onBoard={onHome}
        actions={
          <div data-challenge-actions className="mt-auto flex flex-col gap-2">
            <div className="flex">
              <ChallengeShareButton
                code={mode.code}
                kind="invite"
                total={total}
                rounds={roundCount}
                label="Send the challenge"
              />
            </div>
            {done}
          </div>
        }
      />
    );
  }

  const mine = rows.find((r) => r.slot === board.mySlot);
  const top = rows
    .filter((r) => r.position <= 3)
    .slice(0, 3)
    .map((r) => ({ place: r.position, name: r.name, total: r.total }));
  return (
    <PhoneShell skin="room">
      <div data-challenge-screen="podium" className="contents">
        <Podium
          rows={rows}
          looks={looks}
          awards={awards}
          mySlot={board.mySlot}
          results={board.results}
          roundOrder={board.roundOrder}
          isHost={false}
          busy={false}
          onPlayAgain={() => undefined}
          onLeave={onHome}
          actions={
            <div data-challenge-actions className="flex flex-col gap-2">
              <div className="flex">
                <ChallengeShareButton
                  code={board.code}
                  kind="result"
                  total={mine?.total ?? total}
                  rounds={roundCount}
                  place={mine?.position ?? null}
                  players={rows.length}
                  top={top}
                  games={board.roundOrder}
                />
              </div>
              <div className="flex">
                <ChallengeShareButton
                  code={board.code}
                  kind="invite"
                  total={mine?.total ?? total}
                  rounds={roundCount}
                  label="Challenge someone else"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  onClick={onNew}
                >
                  New challenge
                </Button>
                <Button
                  variant="secondary"
                  onClick={onHome}
                >
                  Done
                </Button>
              </div>
            </div>
          }
        />
      </div>
    </PhoneShell>
  );
}
