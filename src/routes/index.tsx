import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { ChevronRight, DoorOpen } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { HomeScreenHint } from "@/components/beta/HomeScreenHint";
import { TermsScreen } from "@/components/beta/TermsScreen";
import { Dots } from "@/components/duel/Dots";
import { Button, CodeInput, GameTile, Input, Panel, SectionHeader } from "@/design/components";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { PageAside } from "@/components/app/PageAside";
import { Onboarding } from "@/components/duel/Onboarding";
import { goToTab } from "@/components/app/AppTabBar";
import { PublicGameCard } from "@/components/app/PublicGameCard";
import { DailyCard, shownDailyStatus, useDailyStatus } from "@/components/daily/DailyCard";
import { ChallengeCard } from "@/components/challenge/ChallengeCard";
import { PlaySlot } from "@/components/app/PlaySlot";
import { IntroCard } from "@/components/app/IntroCard";
import { PlayerBadge } from "@/components/duel/PlayerBadge";
import { PUBLIC_GAMES } from "@/config/publicGames";
import { termsAgreed } from "@/lib/beta/terms";
import { readPlayCards, releaseSlot, writePlayCards } from "@/lib/playCards";
import { ShareWelcomeCard } from "@/components/share/ShareWelcomeCard";
import { useClock } from "@/components/app/useClock";
import { markOnboardingSeen, onboardingSeen } from "@/lib/onboarding";
import { isShareRef } from "@/lib/share/shareRef";
import { createRoom, fetchDuelByCode, fetchPlayers, joinRoomByCode } from "@/lib/duel/api";
import { MAX_PLAYERS } from "@/lib/duel/types";
import { currentUserId, getStoredName, setStoredName } from "@/lib/duel/session";
import { ROOM_CODE_LENGTH, codeFromInput } from "@/lib/duel/roomLink";
import { readLastRoom } from "@/lib/duel/deviceHistory";
import { recentPracticeTypes, warmUpTypes } from "@/lib/duel/practiceRecent";
import { readPracticeBest } from "@/lib/duel/practiceBest";
import { currentPracticeStamp } from "@/lib/duel/practiceStamps";
import { dailyStreak, readDailyRecord } from "@/lib/duel/dailyRecord";
import { ukDayKey } from "@/lib/duel/daily";
import { rememberedLook, type PlayerLook } from "@/lib/duel/playerLook";
import { scheduledGames, upcomingGames, type PublicGame } from "@/lib/publicSchedule";
import { screenMusic, unlockAudio } from "@/lib/sound";
import { celebrationSound, celebrationsOn } from "@/lib/fx/celebrations";
import { PUZZLE_REGISTRY, gameCounts } from "@/lib/duel/registry";
import type { PuzzleType } from "@/lib/duel/types";
import { APP_DESCRIPTION, APP_TITLE } from "@/lib/brand";
import { useHomeBed } from "@/lib/useScreenMusic";
import { OnlineOnly } from "@/components/offline/OnlineOnly";

const GAME_COUNTS = gameCounts();
/** Every game rooms deal (the Warm up's "All 72 games"). */
const ACTIVE_GAMES = GAME_COUNTS.puzzle + GAME_COUNTS.arcade;

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
  component: OfflineHome,
});

/** Offline practice (31 Oct 2026): with no connection, the offline state and a way to Practice. */
function OfflineHome() {
  return (
    <OnlineOnly tabs="play" live body="Rooms and the daily need a connection. Practice games are saved on this phone, so they still work.">
      <Home />
    </OnlineOnly>
  );
}

const CODE_LENGTH = ROOM_CODE_LENGTH;

/** The device's last room, when it is still open and this device is still in it. */
interface OpenRoom {
  code: string;
  players: number;
  lobby: boolean;
}

/**
 * The device's last room while it is still open with this device in it: `shown` is what the card
 * draws now (the last known state from playCards.ts until the server answers), `settled` once it has.
 */
function useLastOpenRoom(): { shown: OpenRoom | null; settled: boolean; open: boolean } {
  const [state, setState] = useState<{ shown: OpenRoom | null; settled: boolean; open: boolean }>({
    shown: null,
    settled: false,
    open: false,
  });
  useBeforePaint(() => {
    const last = readLastRoom();
    if (!last) return setState({ shown: null, settled: true, open: false });
    const cached = readPlayCards().rejoin;
    const known = cached?.code === last.code ? cached.open : null;
    setState({ shown: known ?? { code: last.code, players: 0, lobby: false }, settled: false, open: false });
    let live = true;
    const done = (room: OpenRoom | null) => {
      writePlayCards({ rejoin: { code: last.code, open: room } });
      if (live) setState((current) => ({ shown: room ?? current.shown, settled: true, open: !!room }));
    };
    void (async () => {
      try {
        const duel = await fetchDuelByCode(last.code);
        if (!duel || duel.disbanded_at || duel.status === "finished") return done(null);
        const [players, uid] = await Promise.all([fetchPlayers(duel.id), currentUserId()]);
        const mine = players.find((p) => p.user_id === uid);
        if (!mine || mine.status === "left") return done(null);
        done({
          code: duel.room_code,
          players: players.filter((p) => p.status !== "left").length,
          lobby: duel.status === "waiting",
        });
      } catch {
        /* no row: nothing to rejoin */
        done(null);
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  return state;
}

const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

const slotState = (settled: boolean, show: boolean) => (!settled ? "pending" : show ? "show" : "hide");

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
  // The first-time intro's three panels (Onboarding), from "How it works".
  const [intro, setIntro] = useState(false);
  // The first-time intro card (lib/onboarding: once per device on a plain visit; reserved before the
  // first paint, playCards.ts): "pending" until the page is up, then shown or collapsed.
  const [introCard, setIntroCard] = useState<"pending" | "show" | "hide">("pending");
  // This device's look (the name row's badge), Warm up's bests and the daily streak: device storage.
  const [look, setLook] = useState<PlayerLook>({ colour: 0, icon: null });
  const [bests, setBests] = useState<Partial<Record<PuzzleType, number>>>({});
  const [streak, setStreak] = useState(0);
  // The beta terms come before the first room (lib/beta/terms.ts): Create or Join waits for I AGREE.
  const [termsFor, setTermsFor] = useState<"create" | "join" | null>(null);
  // The Add to Home Screen hint (iPhone Safari, first visit; reserved before the first paint, playCards.ts).
  const [homeHint, setHomeHint] = useState<"show" | "hide">("show");
  // Device-only values (practice history, the schedule against this device's clock) are read after
  // mount, so the server-rendered page and the first client render agree.
  const [recent, setRecent] = useState<PuzzleType[] | null>(null);
  // Read before the first client paint; its card's height is reserved from the last visit, or from the
  // schedule on a first visit (playCards.ts). Until then a quiet card of the same kind stands in.
  const [games, setGames] = useState<PublicGame[]>([]);
  const [welcome, setWelcome] = useState<boolean | null>(null);
  // Set after mount: until then the name row keeps the height reserved before the first paint.
  const [mounted, setMounted] = useState(false);
  const publicSlot = useRef<HTMLDivElement | null>(null);

  // Before the first client paint (the page's layout is already reserved from device storage).
  useBeforePaint(() => {
    const stored = getStoredName();
    setName(stored);
    setEditingName(stored.trim() === "");
    const types = warmUpTypes(recentPracticeTypes());
    setRecent(types);
    const remembered = rememberedLook();
    setLook({ colour: remembered.colour ?? 0, icon: remembered.icon ?? null });
    setBests(
      Object.fromEntries(
        types.flatMap((type) => {
          const best = readPracticeBest(type, currentPracticeStamp(type));
          return best === null ? [] : [[type, best]];
        }),
      ),
    );
    const record = readDailyRecord();
    setStreak(dailyStreak(record.days, ukDayKey(Date.now())));
    setGames(scheduledGames());
    setMounted(true);
  }, []);
  useEffect(() => {
    // Shown once on a plain visit: seen as soon as it is up, so leaving without closing it still counts.
    const fresh = !isShareRef(window.location.search) && !onboardingSeen();
    // A shared link's arrival is welcomed by the share card instead (as a room link marks it seen).
    if (isShareRef(window.location.search)) markOnboardingSeen();
    else if (fresh) markOnboardingSeen();
    setIntroCard(fresh ? "show" : "hide");
    // Seen now: the next visit to the tab (this page load's reservation stays on <html>) never reserves it.
    return () => releaseSlot("intro");
  }, []);
  // The app-wide home bed (docs/sound-cues/music.md): held here, carried on unbroken to the other tabs and the lobby.
  useHomeBed(true, screenMusic("music_home"));

  const lastRoom = useLastOpenRoom();
  // Today's dailies (hidden until the daily tables exist: DailyCard).
  const daily = useDailyStatus();
  // The last known status is device storage: read only once mounted (before its first paint), so the
  // server-rendered page and the first client render agree.
  const dailyShown = useMemo(() => (mounted ? shownDailyStatus(daily) : shownDailyStatus({ status: daily.status }, Date.now(), false)), [daily, mounted]);
  // Friend challenges (hidden until their tables exist: ChallengeCard): the daily status call answers
  // for both; null until it has.
  const challenges = daily.settled ? daily.status?.challenges === true : null;
  useEffect(() => {
    if (challenges !== null) writePlayCards({ challenges });
  }, [challenges]);
  const now = useClock(games.flatMap((g) => [g.lobbyAt, g.startsAt]));
  const nextGame = upcomingGames(now, games)[0] ?? null;
  // The public game card's height, for the next visit's first paint (0: none).
  useEffect(() => {
    if (!mounted) return;
    writePlayCards({ publicH: nextGame ? Math.round(publicSlot.current?.getBoundingClientRect().height ?? 0) : 0 });
  }, [mounted, nextGame]);
  const warmUp = recent ?? warmUpTypes([]);

  const fail = (message: string) => {
    setError(message);
    setShake((n) => n + 1);
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
      fail("Room codes are 4 characters.");
      return;
    }

    if (!termsAgreed()) {
      setTermsFor(mode);
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
      fail(err instanceof Error ? err.message : "That didn’t work. Try again.");
    }
  };

  if (intro) return <Onboarding onDone={() => setIntro(false)} />;
  if (termsFor)
    return (
      <TermsScreen
        onAgree={() => {
          setTermsFor(null);
          void start(termsFor);
        }}
      />
    );

  return (
    <PhoneShell tabs="play" aside={<PageAside panels={["public", "week"]} />}>
      <div className="ap-stack">
        <PlaySlot id="intro" state={introCard}>
          <IntroCard
            onClose={() => setIntroCard("hide")}
            onPractice={() => {
              unlockAudio();
              const first = warmUp[0];
              goToTab(router, "play", "practice", first ? { game: first } : undefined);
            }}
            onHowItWorks={() => {
              unlockAudio();
              setIntro(true);
            }}
          />
        </PlaySlot>
        <PlaySlot id="welcome" state={slotState(welcome !== null, welcome === true)}>
        <ShareWelcomeCard
          assumeDue
          onDue={setWelcome}
          nextGame={nextGame}
          now={now}
          onPractice={() => {
            unlockAudio();
            const first = warmUp[0];
            goToTab(router, "play", "practice", first ? { game: first } : undefined);
          }}
          onPublic={() => goToTab(router, "play", "tournaments")}
        />
        </PlaySlot>

        <div data-play-hero>
          <h1 className="ap-title" aria-label="Play live with friends">
            <span>Play live</span> <span>with friends</span>
          </h1>
          <p className="ap-sub">Up to {MAX_PLAYERS} players. Same games, same moment.</p>
        </div>

        {/* Quick play: create a room, or join one with its code. */}
        <Panel as="section" pad aria-label="Quick play" className="flex flex-col gap-3">
          {/* Its height is set before the first paint from whether a name is stored (app-shell.css), so
              the name loading after mount never moves anything. */}
          <div data-name-row data-editing={mounted ? String(editingName) : undefined}>
          {editingName ? (
            <Input
              id="name"
              aria-label="Display name"
              ref={nameRef}
              value={name}
              maxLength={14}
              placeholder="Your name"
              autoComplete="nickname"
              onChange={(e) => {
                setError(null);
                setName(e.target.value);
              }}
            />
          ) : (
            <p className="flex h-11 items-center justify-between gap-2.5 text-muted-foreground jz-body">
              <PlayerBadge look={look} name={name} size={28} />
              <span className="min-w-0 flex-1 truncate">
                Playing as <span className="th-name font-semibold jz-em-name">{name}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingName(true);
                  requestAnimationFrame(() => nameRef.current?.focus());
                }}
                className="ap-link press h-11 shrink-0 px-1"
              >
                Change
              </button>
            </p>
          )}
          </div>
          <Button
            variant="gold"
            size={58}
            block
            onClick={() => {
              // Celebrations: the signature zap (lib/fx/celebrations.ts; silent while they're off or muted).
              if (celebrationsOn()) {
                unlockAudio();
                celebrationSound("zap");
              }
              void start("create");
            }}
            disabled={busy !== null}
          >
            {busy === "create" ? (
              <>
                <span>Making your room</span>
                <Dots className="bg-primary-foreground" />
              </>
            ) : (
              <span>Create a room</span>
            )}
          </Button>
          <div className="flex flex-col gap-1.5">
          <label htmlFor="code" className="jz-label text-muted-foreground">
            Room code
          </label>
          <div key={shake} className={`flex gap-2 ${error ? "animate-shake" : ""}`}>
            <CodeInput
              id="code"
              value={code}
              length={ROOM_CODE_LENGTH}
              inputMode="text"
              autoCapitalize="characters"
              aria-label="Room code"
              onChange={(e) => {
                setError(null);
                setCode(codeFromInput(e.target.value));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void start("join");
              }}
              className="flex-1"
            />
            <Button variant="secondary" size={50} onClick={() => void start("join")} disabled={busy !== null} className="w-22 shrink-0">
              {busy === "join" ? <Dots className="bg-foreground" /> : "Join"}
            </Button>
          </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-warn">
              {error}
            </p>
          )}
        </Panel>

        <PlaySlot id="homescreen" state={homeHint}>
          <HomeScreenHint onDismiss={() => setHomeHint("hide")} />
        </PlaySlot>

        <PlaySlot id="rejoin" state={slotState(lastRoom.settled, lastRoom.open)}>
        {(() => {
          // Until the device's last room is read (the server-rendered page): a quiet row of the same size.
          const shown = lastRoom.shown ?? { code: "····", players: 0, lobby: false };
          return (
          <button
            type="button"
            data-rejoin-room={shown.code}
            onClick={() => lastRoom.shown && void navigate({ to: "/duel/$code", params: { code: lastRoom.shown.code } })}
            data-icon="sq"
            className="jz-panel jz-row press"
          >
            <span className="ap-icon-sq">
              <DoorOpen aria-hidden="true" />
            </span>
            <span className="jz-row-text">
              <span className="jz-row-title">Rejoin your last room</span>
              <span data-ellipsis className="jz-row-sub">
                <span className="tracking-[0.12em] text-foreground">{shown.code}</span>,{" "}{/* design-lint-ignore: the room code’s existing tracking; only its separator changed */}
                {shown.players === 0
                  ? "Checking the room"
                  : shown.lobby
                    ? `${shown.players} ${shown.players === 1 ? "player" : "players"} in the lobby`
                    : "Game in progress"}
              </span>
            </span>
            <ChevronRight aria-hidden="true" className="ap-chevron" />
          </button>
          );
        })()}
        </PlaySlot>

        {/* Its last height is reserved before the first paint (playCards.ts): the schedule is read on the phone. */}
        <div
          ref={publicSlot}
          data-public-slot
          data-ready={mounted || undefined}
          data-empty={(mounted && !nextGame) || undefined}
          className="play-public-slot"
        >
        {nextGame || (!mounted && PUBLIC_GAMES.length > 0) ? (
          // Before the page is up (the server-rendered page and the first client render, which can't know the
          // phone's clock): a quiet stand-in with no day or time, inside the height reserved for the card.
          <PublicGameCard
            game={nextGame}
            now={now}
            heading="Next public game"
            onJoin={(room) => void navigate({ to: "/duel/$code", params: { code: room } })}
            link={
              <button
                type="button"
                onClick={() => goToTab(router, "play", "tournaments")}
                className="ap-link press -my-2.5 -mr-1 h-11 px-1"
              >
                All public games
              </button>
            }
          />
        ) : null}
        </div>

        {/* Today: the dailies, with Challenge a friend joining their panel (app-pages.css). */}
        <PlaySlot id="daily" state={slotState(daily.settled, !!daily.status?.available)}>
        <DailyCard
          status={dailyShown}
          streak={streak}
          onOpen={(kind) => {
            unlockAudio();
            void router.navigate({
              to: "/daily",
              search: { kind },
              state: { fromPlayTab: true } as never,
            });
          }}
        />
        </PlaySlot>

        <PlaySlot id="challenge" state={slotState(challenges !== null, challenges === true)}>
        <ChallengeCard
          available
          onOpen={() => {
            unlockAudio();
            void router.navigate({ to: "/challenge", search: {}, state: { fromPlayTab: true } as never } as never);
          }}
        />
        </PlaySlot>

        <section aria-label="Warm up" className="ap-section">
          <SectionHeader
            title="Warm up"
            right={
              <button
                type="button"
                onClick={() => goToTab(router, "play", "practice")}
                className="ap-link press -my-2.5 -mr-1 h-11 px-1"
              >
                All {ACTIVE_GAMES} games
              </button>
            }
          />
          {/* Three games in one panel, each with this device's best (or "Not played"). */}
          <div data-warm-panel data-warm="" data-divided="" className="jz-panel ap-game-strip" style={{ ["--ap-strip" as string]: 3 }}>
            {warmUp.map((type) => (
              <button
                key={type}
                type="button"
                data-warm-up={type}
                aria-label={PUZZLE_REGISTRY[type].name}
                onClick={() => {
                  unlockAudio();
                  goToTab(router, "play", "practice", { game: type });
                }}
                className="press"
              >
                <GameTile type={type} iconSize={60} />
                <span aria-hidden="true" className="ap-strip-name">
                  {PUZZLE_REGISTRY[type].name}
                </span>
                <span aria-hidden="true" data-warm-best={bests[type] ?? ""} data-none={bests[type] === undefined || undefined} className="ap-strip-best">
                  {bests[type] === undefined ? (
                    "Not played"
                  ) : (
                    <>
                      Best <b>{bests[type]}</b>
                    </>
                  )}
                </span>
              </button>
            ))}
          </div>
        </section>

        <div className="flex justify-center pb-1">
          <button
            type="button"
            data-how-it-works
            onClick={() => {
              unlockAudio();
              setIntro(true);
            }}
            className="ap-link-quiet press tap-target px-3"
          >
            How it works
          </button>
        </div>
      </div>
    </PhoneShell>
  );
}
