import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { TermsScreen } from "@/components/beta/TermsScreen";
import { Dots } from "@/components/duel/Dots";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { OnlineOnly } from "@/components/offline/OnlineOnly";
import { HomeArt } from "@/components/home/HomeArt";
import { MatchSheet, choiceLine } from "@/components/home/MatchSheet";
import { SubPageHeader, pushFrom } from "@/components/home/SubPageHeader";
import { useTournamentsAccess } from "@/components/nav/navigation";
import { Button, Icon, ModeButton } from "@/design/components";
import { APP_NAME } from "@/lib/brand";
import { gameCounts } from "@/lib/duel/catalogue";
import { getStoredName } from "@/lib/duel/session";
import { useAccountName } from "@/lib/account/accountApi";
import { useRoomStart } from "@/lib/home/useRoomStart";
import type { RatedPick, RatedStatus } from "@/lib/rated/backend";
import type { RatedFormat } from "@/lib/rated/matchmaking";
import { useRatedStatus } from "@/lib/rated/ratedApi";
import { pickProp, recordRatedEvent } from "@/lib/rated/ratedEvents";
import { defaultPick } from "@/lib/rated/rules";
import { PLACEMENT_MATCHES } from "@/lib/rated/tierDisplay";
import { useCooldownLine } from "@/components/rated/RatedHome";
import { scheduleBetween } from "@/lib/tournaments/rules";
import { celebrationSound, celebrationsOn } from "@/lib/fx/celebrations";
import { screenMusic, unlockAudio } from "@/lib/sound";
import { useHomeBed } from "@/lib/useScreenMusic";

/**
 * Play (phase 2 step 3, 14 Nov 2026; mockups phone/play.png, phone/sheet.png, desktop/play.png): the page the gold
 * Play bar and the rail's Play open. The art-kit hero, then for players with rated play (W3b's status: testers until
 * RATED_PLAY_FOR_EVERYONE) the format selector (a sheet of the formats switched on today) and Find a match (its
 * Win +N · Lose −N line waits for the rated session's server function: Joe, 14 Nov 2026, never a number made on the
 * phone); for everyone else the one gold button is Create a room (today's quick play). Then the modes: Arena (the
 * Tournaments tab), Rooms, Practice (Games) and Daily.
 */
export const Route = createFileRoute("/play")({
  head: () => ({ meta: [{ title: `Play · ${APP_NAME}` }] }),
  component: OfflinePlay,
});

function OfflinePlay() {
  return (
    <OnlineOnly live body="Matches and rooms need a connection. Practice games are saved on this phone, so they still work.">
      <PlayPage />
    </OnlineOnly>
  );
}

const COUNTS = gameCounts();
const ACTIVE_GAMES = COUNTS.puzzle + COUNTS.arcade;
const PICK_KEY = "duelz-rated-pick:v1";
const FORMAT_KEY = "duelz-play-format:v1";

function readKey(key: string): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeKey(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage blocked: the choice lasts this visit */
  }
}

/** "Next at 20:00", "On now", or null (no Arena scheduled in the next two days). */
function arenaDetail(nowMs: number): string | null {
  const events = scheduleBetween(nowMs - 86_400_000, nowMs + 2 * 86_400_000).filter((e) => e.kind === "arena" && e.endsAt > nowMs);
  const next = events[0];
  if (!next) return null;
  if (next.startsAt <= nowMs) return "On now";
  const time = new Date(next.startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
  return `Next at ${time}`;
}

function PlayPage() {
  const router = useRouter();
  const status = useRatedStatus();
  const access = useTournamentsAccess();
  const accountName = useAccountName();
  const room = useRoomStart();
  const [arena, setArena] = useState<string | null>(null);
  useEffect(() => setArena(access.open ? arenaDetail(Date.now()) : null), [access.open]);
  useHomeBed(true, screenMusic("music_home"));

  const quickPlay = () => {
    if (celebrationsOn()) {
      unlockAudio();
      celebrationSound("zap");
    }
    const name = (accountName ?? getStoredName()).trim();
    // No name yet: the Rooms page, where the name is asked for beside Create a room.
    if (!name) return pushFrom(router, "/rooms");
    void room.start("create", name, "", () => pushFrom(router, "/rooms"));
  };

  if (room.termsFor) return <TermsScreen onAgree={room.agree} />;

  return (
    <PhoneShell skin="play">
      <div className="hp-page hp-play" data-play-page>
        <SubPageHeader title="Play" />
        <div className="hp-play-grid">
          <div className="hp-play-art" aria-hidden="true">
            <HomeArt name="playHero" width={300} className="hp-play-hero" />
          </div>
          <div className="hp-play-actions">
            {status ? (
              <RatedPlay status={status} />
            ) : (
              <section aria-label="Quick play" className="hp-primary" data-play-primary="room">
                <Button variant="gold" size={60} block onClick={quickPlay} disabled={room.busy !== null} data-play-quick>
                  {room.busy === "create" ? (
                    <>
                      <span>Making your room</span>
                      <Dots className="bg-primary-foreground" />
                    </>
                  ) : (
                    "Create a room"
                  )}
                </Button>
                {room.error ? (
                  <p role="alert" className="hp-stakes hp-error" data-wrap-ok>
                    {room.error}
                  </p>
                ) : (
                  <p className="hp-stakes">Invite friends with a code</p>
                )}
              </section>
            )}
            <nav aria-label="Ways to play" className="hp-modes">
              <ModeButton
                art={<HomeArt name="arena" />}
                label="Arena"
                detail={arena ?? (access.open ? "Tournaments" : "Coming soon")}
                data-play-mode="arena"
                onClick={() => pushFrom(router, "/tournaments")}
              />
              <ModeButton art={<HomeArt name="rooms" />} label="Rooms" detail="With friends" data-play-mode="rooms" onClick={() => pushFrom(router, "/rooms")} />
              <ModeButton
                art={<HomeArt name="practice" />}
                label="Practice"
                detail={`${ACTIVE_GAMES} games`}
                data-play-mode="practice"
                onClick={() => pushFrom(router, "/practice")}
              />
              <ModeButton art={<HomeArt name="daily" />} label="Daily" detail="Puzzle and Arcade" data-play-mode="daily" onClick={() => pushFrom(router, "/daily")} />
            </nav>
          </div>
        </div>
      </div>
    </PhoneShell>
  );
}

function RatedPlay({ status }: { status: RatedStatus }) {
  const router = useRouter();
  const formats = status.options.formats;
  const [format, setFormat] = useState<RatedFormat | null>(null);
  const [pick, setPick] = useState<RatedPick | null>(null);
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    const stored = readKey(FORMAT_KEY) as RatedFormat | null;
    setFormat(stored && formats.includes(stored) ? stored : formats.includes("bo3") ? "bo3" : (formats[0] ?? null));
    setPick(defaultPick(status.options, readKey(PICK_KEY) as RatedPick | null));
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  const placing = status.standing.state === "placement";
  const cooldown = useCooldownLine(status);
  if (!format || !pick) return null;
  const played = status.standing.state === "placement" ? status.standing.results.length : 0;
  const play = () => {
    recordRatedEvent({ event: "play_card_tapped", pick: pickProp(pick), placement: placing });
    writeKey(PICK_KEY, pick);
    writeKey(FORMAT_KEY, format);
    void router.navigate({ to: "/rated" as never, search: { pick, format } as never, state: { fromPlayTab: true } as never });
  };
  const choosable = formats.length > 1 || status.options.picks.length > 1;
  return (
    <section aria-label="Find a match" className="hp-primary" data-play-primary="rated">
      <button
        type="button"
        className="hp-select press"
        aria-haspopup="dialog"
        disabled={!choosable}
        onClick={() => setSheet(true)}
        data-play-format={format}
        data-play-pick={pick}
      >
        <HomeArt name="rated" width={28} />
        <span data-ellipsis className="hp-select-text">
          {choiceLine(format, pick)}
        </span>
        {choosable ? <Icon name="chevron-down" size={20} tone="text-3" /> : null}
      </button>
      <Button variant="gold" size={60} block onClick={play} disabled={cooldown !== null} data-rated-play-button>
        {placing ? `Placement ${played + 1} of ${PLACEMENT_MATCHES}` : "Find a match"}
      </Button>
      {cooldown ? (
        <p className="hp-stakes" role="status" data-rated-cooldown data-wrap-ok>
          {cooldown}
        </p>
      ) : placing ? (
        <p className="hp-stakes">Your rating shows after {PLACEMENT_MATCHES} matches</p>
      ) : null}
      {sheet ? (
        <MatchSheet
          status={status}
          format={format}
          pick={pick}
          onClose={() => setSheet(false)}
          onChoose={(f, p) => {
            setFormat(f);
            setPick(p);
            writeKey(FORMAT_KEY, f);
            writeKey(PICK_KEY, p);
            setSheet(false);
          }}
        />
      ) : null}
    </section>
  );
}
