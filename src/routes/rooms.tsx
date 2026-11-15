import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { TermsScreen } from "@/components/beta/TermsScreen";
import { Dots } from "@/components/duel/Dots";
import { Button, CodeInput, Icon, Input, Panel, SectionHeader } from "@/design/components";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { PublicGameCard } from "@/components/app/PublicGameCard";
import { ChallengeCard } from "@/components/challenge/ChallengeCard";
import { useDailyStatus } from "@/components/daily/DailyCard";
import { PlaySlot } from "@/components/app/PlaySlot";
import { MyMiniCard } from "@/components/identity/MyMiniCard";
import { SubPageHeader } from "@/components/home/SubPageHeader";
import { useClock } from "@/components/app/useClock";
import { OnlineOnly } from "@/components/offline/OnlineOnly";
import { NameSuggestions } from "@/components/account/AccountParts";
import { PUBLIC_GAMES } from "@/config/publicGames";
import { readPlayCards, writePlayCards } from "@/lib/playCards";
import { fetchDuelByCode, fetchPlayers } from "@/lib/duel/api";
import { isSeat, myKeyAmong, myPublicId } from "@/lib/duel/seatKey";
import { MAX_PLAYERS } from "@/lib/duel/types";
import { currentUserId, getStoredName } from "@/lib/duel/session";
import { ROOM_CODE_LENGTH, codeFromInput } from "@/lib/duel/roomLink";
import { readLastRoom } from "@/lib/duel/deviceHistory";
import { rememberedLook, type PlayerLook } from "@/lib/duel/playerLook";
import { scheduledGames, upcomingGames, type PublicGame } from "@/lib/publicSchedule";
import { screenMusic, unlockAudio } from "@/lib/sound";
import { celebrationSound, celebrationsOn } from "@/lib/fx/celebrations";
import { APP_NAME } from "@/lib/brand";
import { useHomeBed } from "@/lib/useScreenMusic";
import { GUEST_NAME_MAX } from "@/lib/names/username";
import { useAccountName } from "@/lib/account/accountApi";
import { useRoomStart } from "@/lib/home/useRoomStart";

/**
 * Rooms (phase 2 step 3, 14 Nov 2026; Joe: reached from Play → Rooms): everything for playing with friends in a room,
 * moved here from Home unchanged in behaviour: Create a room (with the guest name field for guests), Join with a
 * code, Rejoin your last room while it is open, the next public game with Add to calendar, and Challenge a friend.
 * The late cards keep their PlaySlots (playCards.ts), reserved before the first paint, so nothing jumps.
 */
export const Route = createFileRoute("/rooms")({
  head: () => ({ meta: [{ title: `Rooms · ${APP_NAME}` }] }),
  component: OfflineRooms,
});

function OfflineRooms() {
  return (
    <OnlineOnly live body="Rooms need a connection. Practice games are saved on this phone, so they still work.">
      <Rooms />
    </OnlineOnly>
  );
}

/** The device's last room, when it is still open and this device is still in it. */
interface OpenRoom {
  code: string;
  players: number;
  lobby: boolean;
}

const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * The device's last room while it is still open with this device in it: `shown` is what the card draws now (the last
 * known state from playCards.ts until the server answers), `settled` once it has.
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
        // This device's seat by its public id (Security C1b: phones read no account ids).
        const carries = players.some((p) => !!p.public_id);
        const key = uid ? myKeyAmong(players, { publicId: carries ? await myPublicId(uid) : null, userId: uid }) : null;
        const mine = players.find((p) => isSeat(p, key));
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

const slotState = (settled: boolean, show: boolean) => (!settled ? "pending" : show ? "show" : "hide");

function Rooms() {
  const navigate = useNavigate();
  const router = useRouter();
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [code, setCode] = useState("");
  const accountName = useAccountName();
  const room = useRoomStart();
  const nameRef = useRef<HTMLInputElement | null>(null);
  const [look, setLook] = useState<PlayerLook>({ colour: 0, icon: null });
  const [games, setGames] = useState<PublicGame[]>([]);
  // Set after mount: until then the name row keeps the height reserved before the first paint.
  const [mounted, setMounted] = useState(false);
  const publicSlot = useRef<HTMLDivElement | null>(null);

  useBeforePaint(() => {
    const stored = getStoredName();
    setName(stored);
    setEditingName(stored.trim() === "");
    const remembered = rememberedLook();
    setLook({ colour: remembered.colour ?? 0, icon: remembered.icon ?? null });
    setGames(scheduledGames());
    setMounted(true);
  }, []);
  // The app-wide home bed carries on here (the lobby gives way to its own).
  useHomeBed(true, screenMusic("music_home"));

  const lastRoom = useLastOpenRoom();
  // Friend challenges (hidden until their tables exist: ChallengeCard): the daily status call answers for them.
  const daily = useDailyStatus();
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

  const focusName = () => {
    setEditingName(true);
    requestAnimationFrame(() => nameRef.current?.focus());
  };
  const start = (mode: "create" | "join") => void room.start(mode, accountName ?? name, code, focusName);

  if (room.termsFor) return <TermsScreen onAgree={room.agree} />;

  return (
    <PhoneShell skin="play">
      <div className="ap-stack hp-page" data-rooms-page>
        <SubPageHeader title="Rooms" />
        <p className="hp-lead" data-wrap-ok>
          Up to {MAX_PLAYERS} players. Same games, same moment.
        </p>

        {/* Quick play: create a room, or join one with its code. */}
        <Panel as="section" pad aria-label="Quick play" className="flex flex-col gap-3">
          {/* Its height is set before the first paint from whether a name is stored (app-shell.css). */}
          <div data-name-row data-editing={mounted ? String(editingName && !accountName) : undefined}>
            {editingName && !accountName ? (
              <Input
                id="name"
                aria-label="Display name"
                ref={nameRef}
                value={name}
                maxLength={GUEST_NAME_MAX}
                placeholder="Your name"
                autoComplete="nickname"
                onChange={(e) => {
                  room.clearError();
                  setName(e.target.value);
                }}
              />
            ) : (
              <p className="flex h-11 items-center justify-between gap-2.5 text-muted-foreground jz-body">
                <MyMiniCard guestLook={look} guestName={accountName ?? name} size={28} />
                <span className="min-w-0 flex-1 truncate">
                  Playing as <span className="th-name font-semibold jz-em-name">{accountName ?? name}</span>
                </span>
                {accountName ? null : (
                  <button type="button" onClick={focusName} className="ap-link press h-11 shrink-0 px-1">
                    Change
                  </button>
                )}
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
              start("create");
            }}
            disabled={room.busy !== null}
          >
            {room.busy === "create" ? (
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
            <div key={room.shake} className={`flex gap-2 ${room.error ? "animate-shake" : ""}`}>
              <CodeInput
                id="code"
                value={code}
                length={ROOM_CODE_LENGTH}
                inputMode="text"
                autoCapitalize="characters"
                aria-label="Room code"
                onChange={(e) => {
                  room.clearError();
                  setCode(codeFromInput(e.target.value));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") start("join");
                }}
                className="flex-1"
              />
              <Button variant="secondary" size={50} onClick={() => start("join")} disabled={room.busy !== null} className="w-22 shrink-0">
                {room.busy === "join" ? <Dots className="bg-foreground" /> : "Join"}
              </Button>
            </div>
          </div>
          {room.error && (
            <p role="alert" className="text-sm text-warn">
              {room.error}
            </p>
          )}
          <NameSuggestions
            names={room.suggestions}
            onPick={(picked) => {
              setName(picked);
              room.clearError();
              room.clearSuggestions();
            }}
          />
        </Panel>

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
                  <Icon name="rejoin" size={20} style={{ width: 21, height: 21 }} />
                </span>
                <span className="jz-row-text">
                  <span className="jz-row-title">Rejoin your last room</span>
                  <span data-ellipsis className="jz-row-sub">
                    <span className="hp-code">{shown.code}</span>,{" "}
                    {shown.players === 0
                      ? "Checking the room"
                      : shown.lobby
                        ? `${shown.players} ${shown.players === 1 ? "player" : "players"} in the lobby`
                        : "Game in progress"}
                  </span>
                </span>
                <Icon name="chevron-right" size={20} className="ap-chevron" />
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
            <PublicGameCard
              game={nextGame}
              now={now}
              heading="Next public game"
              onJoin={(code) => void navigate({ to: "/duel/$code", params: { code } })}
              link={
                <button
                  type="button"
                  onClick={() => void router.navigate({ to: "/tournaments", state: { fromPlayTab: true } as never })}
                  className="ap-link press -my-2.5 -mr-1 h-11 px-1"
                >
                  All public games
                </button>
              }
            />
          ) : null}
        </div>

        <PlaySlot id="challenge" state={slotState(challenges !== null, challenges === true)}>
          <section aria-label="With a friend" className="ap-section">
            <SectionHeader title="Play at your own time" />
            <ChallengeCard
              available
              onOpen={() => {
                unlockAudio();
                void router.navigate({ to: "/challenge", search: {}, state: { fromPlayTab: true } as never } as never);
              }}
            />
          </section>
        </PlaySlot>
      </div>
    </PhoneShell>
  );
}
