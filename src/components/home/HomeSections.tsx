/**
 * Home's sections (phase 2 step 3, 14 Nov 2026; P1, 21 Nov 2026: Joe's mix of H1 and H2, plan section 3.3, mockups
 * docs/polish-plan-final/direction/pages/home-mixed-*). Under the player banner (PlayerBanner.tsx): Daily Puzzle and
 * Daily Arcade side by side, each with a visible Play or its score once played; Play friends with Create and Join;
 * Jump back in (this device's last four games). This week (the season pass's weekly challenges) and Friends are the
 * computer's side column only. Each section shows only what exists for this player today and draws nothing
 * otherwise, so a switched-off feature leaves no gap.
 */
import { useRouter } from "@tanstack/react-router";

import { GameIcon } from "@/components/app/GameIcon";
import { JoulesBolt } from "@/components/pass/JoulesBolt";
import { PlayerBadge } from "@/components/duel/PlayerBadge";
import { Button, Icon, Progress, SectionHeader } from "@/design/components";
import { MiniCard, type CardLook } from "@/design/identity";
import type { OverviewFriend } from "@/lib/data/friends.server";
import { PUZZLE_REGISTRY } from "@/lib/duel/catalogue";
import { DAILY_ROUNDS, type DailyKind, type DailyState, type DailyStatus } from "@/lib/duel/daily";
import type { PuzzleType } from "@/lib/duel/types";
import { statusText } from "@/lib/friends/friends";
import { gamePageHref } from "@/lib/nav/gamePage";
import { usePass } from "@/lib/pass/passApi";
import { unlockAudio } from "@/lib/sound";
import { useClock } from "@/components/app/useClock";

import { HomeArt } from "./HomeArt";
import type { HomeArtName } from "./homeArt.data";

type Router = ReturnType<typeof useRouter>;

/** Pushed from Home, so Back returns to Home. */
export function openFromHome(router: Router, to: string, search?: Record<string, string>): void {
  unlockAudio();
  void router.navigate({ to: to as never, ...(search ? { search: search as never } : {}), state: { fromPlayTab: true } as never });
}

/** A game's page (gamePageHref, the Games session's), pushed from Home. */
export function openGame(router: Router, type: string): void {
  unlockAudio();
  void router.navigate({ href: gamePageHref(type), state: { fromPlayTab: true } as never } as never);
}

/* ------------------------------------------------------------------ the dailies */

const nf = new Intl.NumberFormat("en-GB");

function dailyLine(kind: DailyKind, state: DailyState): string {
  const rounds = DAILY_ROUNDS[kind];
  if (state.state === "continue") return `${state.roundsDone} of ${rounds} played`;
  return `${rounds} rounds`;
}
function dailyAction(state: DailyState): string {
  return state.state === "continue" ? "Continue" : "Play";
}

/**
 * Daily Puzzle and Daily Arcade side by side (H1's middle): each card its title, its rounds and a visible Play
 * (Continue mid-way), or once played a tick and its score (a tap opens its results). The Puzzle card first.
 */
export function DailyHero({ status, onOpen }: { status: DailyStatus; counts?: unknown; onOpen: (kind: DailyKind) => void }) {
  const card = (kind: DailyKind, title: string, art: HomeArtName) => {
    const state = status[kind];
    return (
      <article className="hp-daily jz-panel" data-hp-daily={kind} data-daily-state={state.state}>
        <div className="hp-daily-text">
          <h2 data-ellipsis className="hp-daily-title">
            {title}
          </h2>
          <p data-ellipsis className="hp-daily-line">
            {dailyLine(kind, state)}
          </p>
        </div>
        <div className="hp-daily-foot">
          {state.state === "done" ? (
            <button type="button" onClick={() => onOpen(kind)} data-daily-open={kind} aria-label={`Results: ${title}`} className="hp-daily-done press">
              <Icon name="check" size={18} />
              <span className="sr-only">Done</span>
              <span>{nf.format(state.total)}</span>
            </button>
          ) : (
            <Button variant="secondary" size={48} onClick={() => onOpen(kind)} data-daily-open={kind} aria-label={`${dailyAction(state)}: ${title}`} className="hp-daily-play">
              {dailyAction(state)}
            </Button>
          )}
          <HomeArt name={art} width={kind === "puzzle" ? 84 : 64} className="hp-daily-art" />
        </div>
      </article>
    );
  };
  return (
    <section aria-label="Daily challenge" data-daily-card className="hp-dailies">
      {card("puzzle", "Daily Puzzle", "dailyPuzzle")}
      {card("arcade", "Daily Arcade", "dailyArcade")}
    </section>
  );
}

/* ------------------------------------------------------------------ play friends */

/** Play friends (H1's): a room with friends, Create (one tap) and Join (the code, one tap). */
export function PlayFriends({ onCreate, onJoin, busy, error }: { onCreate: () => void; onJoin: () => void; busy: boolean; error: string | null }) {
  return (
    <section aria-label="Play friends" className="hp-friends-play jz-panel" data-hp-play-friends>
      <HomeArt name="rooms" width={32} className="hp-friends-play-art" />
      <h2 data-ellipsis className="hp-friends-play-title">
        Play friends
      </h2>
      <div className="hp-friends-play-actions">
        <Button variant="secondary" size={48} onClick={onCreate} loading={busy} data-hp-create>
          Create
        </Button>
        <Button variant="secondary" size={48} onClick={onJoin} data-hp-join>
          Join
        </Button>
      </div>
      {error ? (
        <p role="alert" className="hp-friends-play-error" data-wrap-ok>
          {error}
        </p>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ jump back in */

/** Jump back in (H2's bottom): the last four games this device played, each opening its page. */
export function RecentlyPlayed({ types }: { types: readonly PuzzleType[] }) {
  const router = useRouter();
  if (!types.length) return null;
  return (
    <section aria-label="Jump back in" className="jz-page-section" data-hp-recent>
      <SectionHeader
        title="Jump back in"
        right={
          <button type="button" onClick={() => openFromHome(router, "/practice")} className="jz-link press -my-2.5 -mr-1 h-11 px-1">
            All games
          </button>
        }
      />
      <ul className="hp-recent" data-scroll-x>
        {types.map((type) => (
          <li key={type}>
            <a
              href={gamePageHref(type)}
              data-recent-game={type}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                openGame(router, type);
              }}
              className="hp-recent-game press"
            >
              <GameIcon type={type} size={112} />
              <span data-ellipsis className="hp-recent-name">
                {PUZZLE_REGISTRY[type].name}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ this week */

/** The season pass's weekly challenges (D2), where the pass is on for this account; a tap opens the Pass. */
export function WeeklyCard({ eligible }: { eligible: boolean }) {
  const router = useRouter();
  const pass = usePass(eligible);
  if (!eligible || pass.state !== "open" || !pass.view.weekly?.challenges.length) return null;
  const challenges = pass.view.weekly.challenges;
  return (
    <section aria-label="This week" className="hp-week jz-panel" data-hp-week>
      <button type="button" className="hp-week-head press" onClick={() => openFromHome(router, "/shop", { part: "pass" })}>
        <HomeArt name="week" />
        <span className="hp-week-titles">
          <span className="hp-week-title">This week</span>
          <span className="hp-week-sub">Resets on Monday</span>
        </span>
        <Icon name="chevron-right" size={20} className="jz-chevron" />
      </button>
      <ul className="hp-week-list">
        {challenges.map((c) => (
          <li key={c.id} className="hp-week-row" data-week-challenge={c.id} data-done={c.completed ? "" : undefined}>
            <span className="hp-week-goal" data-wrap-ok>
              {c.text}
            </span>
            <span className="hp-week-joules">
              <JoulesBolt size={14} />
              {nf.format(c.joules)}
            </span>
            <Progress value={c.need > 0 ? c.done / c.need : 0} done={c.completed} className="hp-week-bar" />
            <span className="hp-week-count">
              {Math.min(c.done, c.need)}/{c.need}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ friends */

const LOOK_OF = (look: NonNullable<OverviewFriend["look"]>): CardLook => ({ cardArt: look.cardArt, frame: look.frame, nameColour: look.nameColour, avatar: look.avatar });

function FriendFace({ friend, size }: { friend: OverviewFriend; size: number }) {
  if (friend.look) return <MiniCard look={LOOK_OF(friend.look)} size={size} />;
  return <PlayerBadge look={{ colour: friend.colour, icon: null }} name={friend.username} size={size} />;
}

export function FriendsRow({ friends }: { friends: readonly OverviewFriend[] }) {
  const router = useRouter();
  const now = useClock([]);
  if (!friends.length) return null;
  return (
    <section aria-label="Friends" className="jz-page-section" data-hp-friends>
      <SectionHeader
        title="Friends"
        right={
          <button type="button" onClick={() => openFromHome(router, "/friends")} className="jz-link press -my-2.5 -mr-1 h-11 px-1">
            All friends
          </button>
        }
      />
      <ul className="hp-friends" data-scroll-x>
        {friends.slice(0, 8).map((f) => (
          <li key={f.id}>
            <button type="button" onClick={() => openFromHome(router, "/friends", { player: f.id })} className="hp-friend jz-panel press" data-friend={f.id}>
              <FriendFace friend={f} size={56} />
              <span data-ellipsis className="hp-friend-name">
                {f.username}
              </span>
              <span data-ellipsis className="hp-friend-status">
                {statusText(f.status, now) || "Friend"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
