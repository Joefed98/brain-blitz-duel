/**
 * Home's player banner (P1, 21 Nov 2026; plan sections 2.1 and 3.3, mockups docs/polish-plan-final/direction/pages/
 * home-mixed-phone, home-mixed-unplaced-phone, home-mixed-open-phone and home-mixed-desktop): Home's one hero and its
 * one gold button, in three states of one height.
 *
 * - **Placed** (rated play open to the player, placement done): the tier, the Joulz Rating large, the bar to the next
 *   division, "+22 this week" and gold Find a match, which starts the search. No streak or coins (the top line has
 *   them). The other two ratings (Puzzles, Arcade) are two small chips under the banner, each opening Compete.
 * - **Placement** (rated play open, not yet placed): "Play 5 placement matches to get your rating", five pips, Find a
 *   match.
 * - **Off** (rated play not on for the player: everyone but the testers today): "Play now" over the game of the day,
 *   gold Play straight to that game's round.
 *
 * The rail's gold Play (AppRail) starts what the banner starts (useHeroPlay). The banner draws its last state from the
 * play-cards record (src/lib/playCards.ts `hero`) from the first frame and updates in place, so nothing moves; the
 * chips' slot is reserved before the first paint from the same record ("chips").
 *
 * Nothing here decides a rating or a tier: the numbers and words are W3b's status and W3a's TierView as
 * tierDisplay.ts draws them. "+N this week" is the change since the first rating this device saw in the current UK
 * week (Monday), shown only when there is one: the rated server keeps no weekly figure yet.
 */
import { useRouter } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";

import { GameIcon } from "@/components/app/GameIcon";
import { Emblem } from "@/design/art/Art";
import { Button, Skeleton } from "@/design/components";
import { puzzleName } from "@/lib/duel/catalogue";
import { ukDayKey } from "@/lib/duel/daily";
import { gameOfTheDayAt } from "@/lib/duel/gameOfTheDay";
import type { PuzzleType } from "@/lib/duel/types";
import { readPlayCards, writePlayCards, type CachedHero } from "@/lib/playCards";
import type { RatedPick, RatedStatus } from "@/lib/rated/backend";
import { useRatedStatus } from "@/lib/rated/ratedApi";
import { pickProp, recordRatedEvent } from "@/lib/rated/ratedEvents";
import { defaultPick } from "@/lib/rated/rules";
import { PLACEMENT_MATCHES, divisionBar, emblemDivision, emblemTier, ratingText } from "@/lib/rated/tierDisplay";
import type { TierId } from "@/lib/data/ratings";
import { unlockAudio } from "@/lib/sound";

import { HomeArt } from "./HomeArt";

type Router = ReturnType<typeof useRouter>;

const PICK_KEY = "duelz-rated-pick:v1";
const FORMAT_KEY = "duelz-play-format:v1";

function readKey(key: string): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The banner's state as drawn, from rated play's status. */
export function heroOf(status: RatedStatus | null): CachedHero {
  if (!status) return { state: "off" };
  const s = status.standing;
  if (s.state === "placement") return { state: "placement", played: s.results.length };
  const bar = divisionBar(s.rank);
  return {
    state: "placed",
    rating: s.rank.rating,
    tier: s.rank.tier,
    division: s.rank.division,
    rank: s.rank.rank,
    label: s.rank.label,
    fraction: bar.fraction,
    next: bar.next,
    puzzles: s.puzzles.rating,
    arcade: s.arcade.rating,
  };
}

/** How long a null status is taken as "not known yet" before the banner settles on Play now (and remembers it). */
const OFF_AFTER_MS = 6000;

const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * The banner's state: the last drawn (the play-cards record) until rated play's status answers, then the live one,
 * remembered for the next visit. `status` is the live status (null: not open to this player, or not known yet).
 * `hero` is null only on the server's page and the first client render (the banner draws its skeleton, the same
 * height), so a device never shows a state it isn't in; the record is read before the first paint after that.
 */
export function useHero(): { hero: CachedHero | null; status: RatedStatus | null } {
  const status = useRatedStatus();
  const [cached, setCached] = useState<CachedHero | null>(null);
  const [mounted, setMounted] = useState(false);
  const [settledOff, setSettledOff] = useState(false);
  useBeforePaint(() => {
    setCached(readPlayCards().hero ?? null);
    setMounted(true);
  }, []);
  useEffect(() => {
    if (status) return;
    const timer = window.setTimeout(() => setSettledOff(true), OFF_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [status]);
  const live = status ? heroOf(status) : settledOff ? ({ state: "off" } as CachedHero) : null;
  useEffect(() => {
    if (live) writePlayCards({ hero: live });
    // The record is written whenever the live state's shape changes.
  }, [JSON.stringify(live)]); // eslint-disable-line react-hooks/exhaustive-deps
  return { hero: mounted ? (live ?? cached ?? { state: "off" }) : null, status };
}

/** Monday's UK day key of the week holding `nowMs`. */
function weekKey(nowMs: number): string {
  const day = ukDayKey(nowMs);
  const date = new Date(`${day}T12:00:00Z`);
  const back = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - back);
  return date.toISOString().slice(0, 10);
}

/** "+22 this week" (or −): the change since the week's first rating on this device; null for none. */
function useWeekChange(rating: number | null): number | null {
  const [change, setChange] = useState<number | null>(null);
  useEffect(() => {
    if (rating === null) return setChange(null);
    const week = weekKey(Date.now());
    const stored = readPlayCards().week;
    if (!stored || stored.week !== week) {
      writePlayCards({ week: { week, rating } });
      return setChange(null);
    }
    const delta = Math.round(rating - stored.rating);
    setChange(delta === 0 ? null : delta);
  }, [rating]);
  return change;
}

/** A rated match with this device's last choice of format and pick (the Play page's; best of 3 else). */
function findMatch(router: Router, status: RatedStatus): void {
  unlockAudio();
  const formats = status.options.formats as readonly string[];
  const stored = readKey(FORMAT_KEY);
  const format = stored && formats.includes(stored) ? stored : formats.includes("bo3") ? "bo3" : formats[0];
  const pick: RatedPick | null = defaultPick(status.options, readKey(PICK_KEY) as RatedPick | null);
  if (!format || !pick) return;
  recordRatedEvent({ event: "play_card_tapped", pick: pickProp(pick), placement: status.standing.state === "placement" });
  void router.navigate({ to: "/rated" as never, search: { pick, format } as never, state: { fromPlayTab: true } as never });
}

/**
 * The game of the day's round: straight in, pushed so Back returns here. `quick` asks Games to open the round in its
 * 3-2-1 (the game page's Play; the Games session, P2, reads it: until then the round's intro shows with Ready).
 */
function playGame(router: Router, type: PuzzleType): void {
  unlockAudio();
  void router.navigate({ to: "/practice" as never, search: { game: type, quick: "1" } as never, state: { fromPlayTab: true } as never });
}

/** Today's game of the day, read once on the phone (the server's page: none, so the first render matches). */
function useGameOfTheDay(): PuzzleType | null {
  const [type, setType] = useState<PuzzleType | null>(null);
  useEffect(() => setType(gameOfTheDayAt(Date.now())), []);
  return type;
}

/** What Home's hero starts, for the rail's gold Play: Find a match where rated play is open, else the game of the day. */
export function useHeroPlay(): () => void {
  const router = useRouter();
  const status = useRatedStatus();
  const game = useGameOfTheDay();
  return () => {
    if (status) return findMatch(router, status);
    const type = game ?? gameOfTheDayAt(Date.now());
    if (type) playGame(router, type);
  };
}

/** The banner's gold button, with its one slow sheen (plan section 1.3; none under Reduce motion). */
function HeroButton({ label, onClick, data }: { label: string; onClick: () => void; data: Record<string, string> }) {
  return (
    <Button variant="gold" size={60} block onClick={onClick} className="hp-banner-play" {...data}>
      <span className="hp-sheen" aria-hidden="true" />
      {label}
    </Button>
  );
}

export function PlayerBanner({ hero, status }: { hero: CachedHero | null; status: RatedStatus | null }) {
  const router = useRouter();
  const game = useGameOfTheDay();
  const week = useWeekChange(hero?.state === "placed" ? hero.rating : null);
  const start = () => (status ? findMatch(router, status) : undefined);

  if (!hero)
    return (
      <section aria-label="Loading" aria-busy="true" className="hp-banner jz-cut-lg" data-hp-banner="pending">
        <div className="hp-banner-top">
          <div className="hp-banner-text">
            <Skeleton width={120} height={20} />
            <Skeleton width="70%" height={44} />
          </div>
        </div>
        <Skeleton height={60} className="hp-banner-skel" />
      </section>
    );

  if (hero.state === "placed") {
    const tier = emblemTier(hero.tier as TierId);
    return (
      <section aria-label="Your rating" className="hp-banner jz-cut-lg" data-hp-banner="placed">
        <div className="hp-banner-top">
          <div className="hp-banner-text">
            <p data-ellipsis className="hp-banner-eyebrow">
              {hero.label}
            </p>
            <p className="hp-banner-rating" data-hp-rating>
              <span className="sr-only">Joulz Rating </span>
              {ratingText(hero.rating)}
            </p>
          </div>
          <Emblem
            tier={tier}
            division={tier === "lightning" ? undefined : emblemDivision({ division: hero.division })}
            rank={hero.rank ?? undefined}
            size={76}
            marker={false}
            label={hero.label}
            className="hp-banner-emblem"
          />
        </div>
        <div className="hp-banner-bar" role="progressbar" aria-label={hero.next} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hero.fraction * 100)}>
          <span style={{ transform: `scaleX(${hero.fraction})` }} />
        </div>
        <div className="hp-banner-line">
          <span data-ellipsis>{hero.next}</span>
          {week !== null ? (
            <span className={week > 0 ? "hp-banner-up" : "hp-banner-down"} data-hp-week-change={week}>
              {week > 0 ? "▲" : "▼"} {Math.abs(week)} this week
            </span>
          ) : null}
        </div>
        <HeroButton label="Find a match" onClick={start} data={{ "data-hp-hero": "match" }} />
      </section>
    );
  }

  if (hero.state === "placement") {
    const played = Math.min(hero.played, PLACEMENT_MATCHES);
    return (
      <section aria-label="Ranked play" className="hp-banner jz-cut-lg" data-hp-banner="placement">
        <div className="hp-banner-top">
          <div className="hp-banner-text">
            <p className="hp-banner-eyebrow">Ranked play</p>
            <h2 className="hp-banner-title" data-wrap-ok>
              Play {PLACEMENT_MATCHES} placement matches to get your rating
            </h2>
          </div>
          <HomeArt name="rated" width={64} className="hp-banner-art" />
        </div>
        <div className="hp-banner-pips" role="img" aria-label={`${played} of ${PLACEMENT_MATCHES} played`}>
          {Array.from({ length: PLACEMENT_MATCHES }, (_, i) => (
            <span key={i} data-on={i < played ? "" : undefined} />
          ))}
          <span className="hp-banner-pips-text">
            {played} of {PLACEMENT_MATCHES} played
          </span>
        </div>
        <HeroButton label="Find a match" onClick={start} data={{ "data-hp-hero": "placement" }} />
      </section>
    );
  }

  return (
    <section aria-label="Play now" className="hp-banner jz-cut-lg" data-hp-banner="off" data-hp-game={game ?? undefined}>
      <div className="hp-banner-top">
        <div className="hp-banner-text">
          <p className="hp-banner-eyebrow">Game of the day</p>
          <h2 className="hp-banner-title">Play now</h2>
          <p data-ellipsis className="hp-banner-sub">
            {game ? puzzleName(game) : " "}
          </p>
        </div>
        <span className="hp-banner-tile">{game ? <GameIcon type={game} size={96} /> : null}</span>
      </div>
      <HeroButton label="Play" onClick={() => (game ? playGame(router, game) : undefined)} data={{ "data-hp-hero": "play" }} />
    </section>
  );
}

/** Puzzles and Arcade, placed players only: two small chips under the banner, each opening Compete. */
export function RatingChips({ hero }: { hero: CachedHero | null }) {
  const router = useRouter();
  const chips = useMemo(
    () =>
      hero?.state === "placed"
        ? [
            { key: "puzzles", art: "puzzles" as const, label: "Puzzles", value: hero.puzzles },
            { key: "arcade", art: "arcade" as const, label: "Arcade", value: hero.arcade },
          ]
        : [],
    [hero],
  );
  if (!chips.length) return null;
  return (
    <div className="hp-chips" data-hp-chips>
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          className="hp-chip jz-panel press"
          data-rating-chip={c.key}
          onClick={() => {
            unlockAudio();
            void router.navigate({ to: "/tournaments", state: { fromPlayTab: true } as never });
          }}
          aria-label={`${c.label} rating ${c.value === null ? "not played" : ratingText(c.value)}: open Compete`}
        >
          <HomeArt name={c.art} width={24} />
          <span className="hp-chip-label">{c.label}</span>
          <span className="hp-chip-value">{c.value === null ? "–" : ratingText(c.value)}</span>
        </button>
      ))}
    </div>
  );
}
