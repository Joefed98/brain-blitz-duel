import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { ChevronRight, DoorOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Dots } from "@/components/duel/Dots";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { Wordmark } from "@/components/duel/Wordmark";
import { MuteToggle } from "@/components/duel/MuteToggle";
import { Onboarding } from "@/components/duel/Onboarding";
import { goToTab } from "@/components/app/AppTabBar";
import { GameIcon } from "@/components/app/GameIcon";
import { PublicGameCard } from "@/components/app/PublicGameCard";
import { ShareWelcomeCard } from "@/components/share/ShareWelcomeCard";
import { useClock } from "@/components/app/useClock";
import { markOnboardingSeen, onboardingSeen } from "@/lib/onboarding";
import { isShareRef } from "@/lib/share/shareRef";
import { createRoom, fetchDuelByCode, fetchPlayers, joinRoomByCode } from "@/lib/duel/api";
import { currentUserId, getStoredName, setStoredName } from "@/lib/duel/session";
import { ROOM_CODE_LENGTH, codeFromInput } from "@/lib/duel/roomLink";
import { readLastRoom } from "@/lib/duel/deviceHistory";
import { recentPracticeTypes, warmUpTypes } from "@/lib/duel/practiceRecent";
import { readPracticeBest } from "@/lib/duel/practiceBest";
import { currentPracticeStamp } from "@/lib/duel/practiceStamps";
import { scheduledGames, upcomingGames, type PublicGame } from "@/lib/publicSchedule";
import { unlockAudio } from "@/lib/sound";
import { buzz } from "@/lib/motion";
import { PUZZLE_REGISTRY, gameCounts } from "@/lib/duel/registry";
import type { PuzzleType } from "@/lib/duel/types";
import { APP_DESCRIPTION, APP_TITLE } from "@/lib/brand";
import { useScreenMusic } from "@/lib/useScreenMusic";

const GAME_COUNTS = gameCounts();

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: APP_TITLE },
      {
        name: "description",
        content: APP_DESCRIPTION,
      },
      { property: "og:title", content: APP_TITLE },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: APP_DESCRIPTION,
      },
      { name: "twitter:description", content: APP_DESCRIPTION },
    ],
  }),
  component: Home,
});

const CODE_LENGTH = ROOM_CODE_LENGTH;

/** The device's last room, when it is still open and this device is still in it. */
interface OpenRoom {
  code: string;
  players: number;
  lobby: boolean;
}

function useLastOpenRoom(): OpenRoom | null {
  const [room, setRoom] = useState<OpenRoom | null>(null);
  useEffect(() => {
    const last = readLastRoom();
    if (!last) return;
    let live = true;
    void (async () => {
      try {
        const duel = await fetchDuelByCode(last.code);
        if (!duel || duel.disbanded_at || duel.status === "finished") return;
        const [players, uid] = await Promise.all([fetchPlayers(duel.id), currentUserId()]);
        const mine = players.find((p) => p.user_id === uid);
        if (!mine || mine.status === "left") return;
        if (live)
          setRoom({
            code: duel.room_code,
            players: players.filter((p) => p.status !== "left").length,
            lobby: duel.status === "waiting",
          });
      } catch {
        /* no row: nothing to rejoin */
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  return room;
}

function Home() {
  const navigate = useNavigate();
  const router = useRouter();
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  // The first-time intro (lib/onboarding): once per device on a plain visit, or from "How it works".
  const [intro, setIntro] = useState(false);
  // Device-only values (practice history, bests, the schedule against this device's clock) are read after
  // mount, so the server-rendered page and the first client render agree.
  const [recent, setRecent] = useState<PuzzleType[] | null>(null);
  const [bests, setBests] = useState<Record<string, number | null>>({});
  const [games, setGames] = useState<PublicGame[]>([]);

  useEffect(() => {
    const stored = getStoredName();
    setName(stored);
    setEditingName(stored.trim() === "");
    const types = warmUpTypes(recentPracticeTypes());
    setRecent(types);
    setBests(
      Object.fromEntries(
        types.map((type) => [type, readPracticeBest(type, currentPracticeStamp(type))]),
      ),
    );
    setGames(scheduledGames());
  }, []);
  useEffect(() => {
    // A shared link's arrival is welcomed by the card below instead (as a room link marks it seen).
    if (isShareRef(window.location.search)) markOnboardingSeen();
    else if (!onboardingSeen()) setIntro(true);
  }, []);
  // Silent until the slot gets a file (docs/sound-cues/music.md).
  useScreenMusic("music_home");

  const lastRoom = useLastOpenRoom();
  const now = useClock(games.flatMap((g) => [g.lobbyAt, g.startsAt]));
  const nextGame = upcomingGames(now, games)[0] ?? null;
  const warmUp = recent ?? warmUpTypes([]);

  const fail = (message: string) => {
    setError(message);
    setShake((n) => n + 1);
    buzz([10, 50, 10]);
  };

  const start = async (mode: "create" | "join") => {
    unlockAudio();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setEditingName(true);
      fail("Enter a display name.");
      requestAnimationFrame(() => nameRef.current?.focus());
      return;
    }
    if (mode === "join" && code.trim().length !== CODE_LENGTH) {
      fail("Room codes are 4 letters.");
      return;
    }

    setBusy(mode);
    setError(null);
    try {
      setStoredName(trimmed);
      const duel =
        mode === "create"
          ? await createRoom(trimmed)
          : await joinRoomByCode(code.trim().toUpperCase(), trimmed, "code");
      await navigate({ to: "/duel/$code", params: { code: duel.roomCode } });
    } catch (err) {
      setBusy(null);
      fail(err instanceof Error ? err.message : "Something went wrong. Try again.");
    }
  };

  if (intro) return <Onboarding onDone={() => setIntro(false)} />;

  return (
    <PhoneShell bare tabs="play">
      <div className="flex items-center justify-between gap-2">
        <Wordmark />
        <MuteToggle />
      </div>

      <div className="mt-5 flex flex-col gap-5">
        <ShareWelcomeCard
          nextGame={nextGame}
          now={now}
          onPractice={() => {
            unlockAudio();
            const first = warmUp[0];
            goToTab(router, "play", "practice", first ? { game: first } : undefined);
          }}
          onPublic={() => goToTab(router, "play", "tournaments")}
        />

        <div>
          <h1 className="whitespace-nowrap font-display text-[25px] font-bold leading-tight tracking-[0.02em]">
            Play live with friends
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Up to 10 players. Same games, same moment. Highest score wins.
          </p>
        </div>

        {/* Quick play: create a room, or join one with its code. */}
        <section
          aria-label="Quick play"
          data-tint="gold"
          className="th-card flex flex-col gap-3 rounded-2xl border border-border bg-card/80 p-4"
        >
          <p className="th-kicker text-primary">Quick play</p>
          {editingName ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="th-kicker text-muted-foreground">
                Display name
              </label>
              <input
                id="name"
                ref={nameRef}
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
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="min-w-0 truncate">
                Playing as <span className="th-name text-foreground">{name}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingName(true);
                  requestAnimationFrame(() => nameRef.current?.focus());
                }}
                className="press tap-target shrink-0 px-2 font-display text-xs font-semibold uppercase tracking-widest text-primary"
              >
                Change name
              </button>
            </p>
          )}
          <button
            type="button"
            onClick={() => void start("create")}
            disabled={busy !== null}
            className="th-btn-gold press tap-target relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary py-4 font-display text-lg font-extrabold uppercase tracking-wide text-primary-foreground"
          >
            {busy === "create" ? (
              <>
                <span>Please wait</span>
                <Dots className="bg-primary-foreground" />
              </>
            ) : (
              <span className="relative z-10">Create a room</span>
            )}
            <span
              aria-hidden="true"
              className="animate-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-primary-foreground/20"
            />
          </button>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="code" className="th-kicker text-muted-foreground">
              Or join with a code
            </label>
            <div key={shake} className={`flex gap-2 ${error ? "animate-shake" : ""}`}>
              <input
                id="code"
                value={code}
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                placeholder="ABCD"
                aria-label="Room code"
                onChange={(e) => {
                  setError(null);
                  setCode(codeFromInput(e.target.value));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void start("join");
                }}
                className="th-input tap-target min-w-0 flex-1 rounded-xl border border-border bg-background px-4 text-center font-mono text-2xl font-bold uppercase tracking-[0.4em] text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void start("join")}
                disabled={busy !== null}
                className="th-btn-outline-gold press tap-target w-24 shrink-0 rounded-xl border border-primary/70 bg-primary/10 font-display text-base font-bold uppercase tracking-wide text-primary"
              >
                {busy === "join" ? <Dots className="bg-primary" /> : "Join"}
              </button>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-warn">
              {error}
            </p>
          )}
        </section>

        {lastRoom ? (
          <button
            type="button"
            data-rejoin-room={lastRoom.code}
            onClick={() => void navigate({ to: "/duel/$code", params: { code: lastRoom.code } })}
            data-tint="gold"
            className="th-card press flex min-h-14 w-full items-center gap-3 rounded-2xl border border-primary/50 bg-primary/10 px-4 py-3 text-left"
          >
            <DoorOpen aria-hidden="true" className="h-6 w-6 shrink-0 text-primary" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-display text-sm font-bold uppercase text-foreground">
                Rejoin your last room
              </span>
              <span className="truncate text-xs text-muted-foreground">
                <span className="font-mono tracking-widest text-foreground">{lastRoom.code}</span> ·{" "}
                {lastRoom.lobby
                  ? `${lastRoom.players} ${lastRoom.players === 1 ? "player" : "players"} in the lobby`
                  : "Game in progress"}
              </span>
            </span>
            <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground" />
          </button>
        ) : null}

        {nextGame ? (
          <PublicGameCard
            game={nextGame}
            now={now}
            heading="Next public game"
            onJoin={(room) => void navigate({ to: "/duel/$code", params: { code: room } })}
            footer={
              <button
                type="button"
                onClick={() => goToTab(router, "play", "tournaments")}
                className="press tap-target -mb-1 self-center px-3 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground"
              >
                All public games
              </button>
            }
          />
        ) : null}

        <section aria-label="Warm up" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-bold">Warm up</h2>
            <button
              type="button"
              onClick={() => goToTab(router, "play", "practice")}
              className="press tap-target -mr-2 px-2 font-display text-xs font-semibold uppercase tracking-widest text-primary"
            >
              All games
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {warmUp.map((type) => {
              const best = bests[type] ?? null;
              return (
                <button
                  key={type}
                  type="button"
                  data-warm-up={type}
                  onClick={() => {
                    unlockAudio();
                    goToTab(router, "play", "practice", { game: type });
                  }}
                  className="th-card press flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-border bg-card/80 px-2 py-3"
                >
                  <GameIcon type={type} size={52} />
                  <span className="w-full truncate text-center font-display text-sm font-semibold text-foreground">
                    {PUZZLE_REGISTRY[type].name}
                  </span>
                  <span
                    aria-hidden="true"
                    className="font-mono text-[11px] tabular-nums text-muted-foreground"
                  >
                    {best === null ? "New" : `Best ${best}`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="flex flex-col items-center gap-1 pb-1">
          <p className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {GAME_COUNTS.puzzle} puzzle games · {GAME_COUNTS.arcade} arcade games
          </p>
          <button
            type="button"
            data-how-it-works
            onClick={() => {
              unlockAudio();
              setIntro(true);
            }}
            className="press tap-target px-3 font-display text-sm uppercase tracking-widest text-muted-foreground"
          >
            How it works
          </button>
        </div>
      </div>
    </PhoneShell>
  );
}
