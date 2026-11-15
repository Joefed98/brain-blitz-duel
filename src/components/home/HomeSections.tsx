/**
 * Home's sections (phase 2 step 3, 14 Nov 2026; mockups docs/design/style-guide/phone/home.png, home-scrolled.png,
 * desktop/home.png). Each section shows only what exists for this player today and draws nothing otherwise, so a
 * switched-off feature leaves no gap: the Daily hero (the dailies' availability), Your next match (rated play, else
 * the account's most recently active friend, else a Practice suggestion), Ratings (rated play only), Recently played
 * (this device's practice), This week (the season pass's weekly challenges, where the pass is on) and Friends (an
 * account with friends).
 */
import { useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { GameIcon } from "@/components/app/GameIcon";
import { JoulesBolt } from "@/components/pass/JoulesBolt";
import { PlayerBadge } from "@/components/duel/PlayerBadge";
import { Button, Icon, Progress, SectionHeader, StatTile } from "@/design/components";
import { MiniCard, type CardLook } from "@/design/identity";
import type { OverviewFriend } from "@/lib/data/friends.server";
import { PUZZLE_REGISTRY } from "@/lib/duel/catalogue";
import type { DailyKind, DailyState, DailyStatus } from "@/lib/duel/daily";
import type { PuzzleType } from "@/lib/duel/types";
import { statusText } from "@/lib/friends/friends";
import { gamePageHref } from "@/lib/nav/gamePage";
import { usePass } from "@/lib/pass/passApi";
import type { RatedPick, RatedStatus } from "@/lib/rated/backend";
import { pickLabel } from "@/lib/rated/rules";
import { pickProp, recordRatedEvent } from "@/lib/rated/ratedEvents";
import { PLACEMENT_MATCHES, ratingText } from "@/lib/rated/tierDisplay";
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

/* ------------------------------------------------------------------ the Daily hero */

const nf = new Intl.NumberFormat("en-GB");

function dailyLine(state: DailyState, count: number | null): string {
  if (state.state === "done") return `Done · ${nf.format(state.total)}`;
  if (state.state === "continue") return `${state.roundsDone} ${state.roundsDone === 1 ? "round" : "rounds"} played`;
  return count !== null ? `${nf.format(count)} played today` : "New today";
}
function dailyAction(state: DailyState): string {
  return state.state === "done" ? "Results" : state.state === "continue" ? "Continue" : "Play";
}

/**
 * The hero carousel: the Daily Puzzle card (Joulz navy, the cut corners, its title, how many have played today and
 * Play bottom left), then Daily Arcade as the second card, peeking on a phone and beside it on a wider screen.
 */
export function DailyHero({ status, counts, onOpen }: { status: DailyStatus; counts: { puzzle: number | null; arcade: number | null } | null; onOpen: (kind: DailyKind) => void }) {
  const card = (kind: DailyKind, title: string, art: HomeArtName) => {
    const state = status[kind];
    const line = dailyLine(state, counts?.[kind] ?? null);
    return (
      <article className="hp-daily jz-cut-lg" data-hp-daily={kind} data-daily-state={state.state}>
        <HomeArt name={art} className="hp-daily-art" />
        <div className="hp-daily-text">
          <h2 data-ellipsis className="hp-daily-title">
            {title}
          </h2>
          <p data-ellipsis className="hp-daily-line">
            {line}
          </p>
        </div>
        {kind === "puzzle" ? (
          <Button variant="gold" size={48} onClick={() => onOpen(kind)} data-daily-open={kind} aria-label={`${dailyAction(state)}: ${title}`} className="hp-daily-play">
            {dailyAction(state)}
          </Button>
        ) : (
          <button type="button" onClick={() => onOpen(kind)} data-daily-open={kind} aria-label={`${dailyAction(state)}: ${title}`} className="hp-daily-cover press" />
        )}
      </article>
    );
  };
  return (
    <section aria-label="Daily challenge" data-daily-card className="hp-hero">
      <div className="hp-hero-track" data-scroll-x>
        {card("puzzle", "Daily Puzzle", "dailyPuzzle")}
        {card("arcade", "Daily Arcade", "dailyArcade")}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ your next match */

function NextCard({ art, title, sub, tag, action, data }: { art: ReactNode; title: string; sub: string; tag?: string; action: ReactNode; data: Record<string, string> }) {
  return (
    <div className="hp-next jz-panel" {...data}>
      <span className="hp-next-art">{art}</span>
      <span className="hp-next-text">
        <span data-ellipsis className="hp-next-title">
          {title}
        </span>
        <span data-ellipsis className="hp-next-sub">
          {sub}
        </span>
        {tag ? <span className="hp-tag">{tag}</span> : null}
      </span>
      {action}
    </div>
  );
}

/** A rated quick match with this device's last choice (the Play page's format, kept on the device; best of 3 else). */
function quickMatch(router: Router, status: RatedStatus, pick: RatedPick): void {
  unlockAudio();
  let stored: string | null = null;
  try {
    stored = localStorage.getItem("duelz-play-format:v1");
  } catch {
    /* storage blocked */
  }
  const formats = status.options.formats as readonly string[];
  const format = stored && formats.includes(stored) ? stored : formats.includes("bo3") ? "bo3" : formats[0];
  if (!format) return openFromHome(router, "/play");
  recordRatedEvent({ event: "play_card_tapped", pick: pickProp(pick), placement: status.standing.state === "placement" });
  void router.navigate({ to: "/rated" as never, search: { pick, format } as never, state: { fromPlayTab: true } as never });
}

const LOOK_OF = (look: NonNullable<OverviewFriend["look"]>): CardLook => ({ cardArt: look.cardArt, frame: look.frame, nameColour: look.nameColour, avatar: look.avatar });

function FriendFace({ friend, size }: { friend: OverviewFriend; size: number }) {
  if (friend.look) return <MiniCard look={LOOK_OF(friend.look)} size={size} />;
  return <PlayerBadge look={{ colour: friend.colour, icon: null }} name={friend.username} size={size} />;
}

/** One card: a rated quick match (rated play), else the most recently active friend, else a Practice game. */
export function NextMatch({
  rated,
  pick,
  friend,
  practice,
  practiceBest,
  nowMs,
}: {
  rated: RatedStatus | null;
  pick: RatedPick | null;
  friend: OverviewFriend | null;
  practice: PuzzleType | null;
  practiceBest: number | null;
  nowMs: number;
}) {
  const router = useRouter();
  let card: ReactNode = null;
  if (rated && pick) {
    const placing = rated.standing.state === "placement";
    const sub = placing
      ? `Placement ${rated.standing.state === "placement" ? rated.standing.results.length + 1 : 1} of ${PLACEMENT_MATCHES}`
      : `Joulz Rating ${rated.standing.state === "placed" ? ratingText(rated.standing.rank.rating) : ""}`;
    card = (
      <NextCard
        data={{ "data-next-match": "rated" }}
        art={<HomeArt name="rated" width={44} />}
        title={`Rated · ${pickLabel(pick)}`}
        sub={sub}
        action={
          <Button variant="gold" size={44} data-small="" onClick={() => quickMatch(router, rated, pick)} aria-label="Find a rated match">
            Play
          </Button>
        }
      />
    );
  } else if (friend) {
    card = (
      <NextCard
        data={{ "data-next-match": "friend" }}
        art={<FriendFace friend={friend} size={56} />}
        title={friend.username}
        sub={statusText(friend.status, nowMs) || "Friend"}
        tag="Friend"
        action={
          <Button variant="secondary" size={48} onClick={() => openFromHome(router, "/friends", { player: friend.id })} aria-label={`Open ${friend.username}`}>
            <Icon name="challenge" size={22} />
          </Button>
        }
      />
    );
  } else if (practice) {
    const name = PUZZLE_REGISTRY[practice].name;
    card = (
      <NextCard
        data={{ "data-next-match": "practice", "data-next-game": practice }}
        art={<GameIcon type={practice} size={56} />}
        title={name}
        sub={practiceBest === null ? "Practice · Not played yet" : `Practice · Best ${practiceBest}`}
        action={
          <Button variant="secondary" size={48} onClick={() => openGame(router, practice)} aria-label={`Practise ${name}`}>
            <Icon name="play" size={22} />
          </Button>
        }
      />
    );
  }
  if (!card) return null;
  return (
    <section aria-label="Your next match" className="ap-section" data-hp-next>
      <SectionHeader title="Your next match" />
      {card}
    </section>
  );
}

/* ------------------------------------------------------------------ ratings */

export function RatingTiles({ status }: { status: RatedStatus }) {
  const router = useRouter();
  const s = status.standing;
  const value = (n: number | null | undefined) => (s.state === "placed" && typeof n === "number" ? ratingText(n) : "–");
  const tiles: { art: HomeArtName; label: string; value: string; key: string }[] = [
    { key: "joulz", art: "joulz", label: "Joulz Rating", value: value(s.state === "placed" ? s.rank.rating : null) },
    { key: "puzzles", art: "puzzles", label: "Puzzles", value: value(s.puzzles.rating) },
    { key: "arcade", art: "arcade", label: "Arcade", value: value(s.arcade.rating) },
  ];
  return (
    <section aria-label="Ratings" className="ap-section" data-hp-ratings={s.state}>
      <SectionHeader
        title="Ratings"
        right={
          s.state === "placement" ? (
            <span className="ap-meta">
              Placement {s.results.length} of {PLACEMENT_MATCHES}
            </span>
          ) : (
            <button type="button" onClick={() => openFromHome(router, "/tiers")} className="ap-link press -my-2.5 -mr-1 h-11 px-1">
              All ratings
            </button>
          )
        }
      />
      <div className="hp-tiles">
        {tiles.map((t) => (
          <StatTile key={t.key} data-rating-tile={t.key} art={<HomeArt name={t.art} />} value={t.value} label={t.label} className="hp-tile" />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ recently played */

export function RecentlyPlayed({ types }: { types: readonly PuzzleType[] }) {
  const router = useRouter();
  if (!types.length) return null;
  return (
    <section aria-label="Recently played" className="ap-section" data-hp-recent>
      <SectionHeader
        title="Recently played"
        right={
          <button type="button" onClick={() => openFromHome(router, "/practice")} className="ap-link press -my-2.5 -mr-1 h-11 px-1">
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
              <span className="hp-recent-icon">
                <GameIcon type={type} size={76} />
              </span>
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
        <Icon name="chevron-right" size={20} className="ap-chevron" />
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

export function FriendsRow({ friends }: { friends: readonly OverviewFriend[] }) {
  const router = useRouter();
  const now = useClock([]);
  if (!friends.length) return null;
  return (
    <section aria-label="Friends" className="ap-section" data-hp-friends>
      <SectionHeader
        title="Friends"
        right={
          <button type="button" onClick={() => openFromHome(router, "/friends")} className="ap-link press -my-2.5 -mr-1 h-11 px-1">
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
