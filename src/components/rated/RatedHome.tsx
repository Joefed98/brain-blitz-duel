/**
 * The rated ladder (wave 3, session W3c; mockups 01, 02 and 11 in docs/mockups/wave-3/; since P3, 22 Nov 2026, Compete's
 * hero, plan section 2.1 and mockup compete-mixed-phone): the rank (your tier, the Joulz Rating large, the bar to the
 * next division and the week's change once placed; "Placement 2 of 5" during it) and the Play card (the pick and gold
 * Find a match), with the picker sheet, as one hero.
 *
 * Testers only while rated play is testers only: drawn only when the server says rated play is open to this player
 * (useRatedStatus); everyone else gets nothing here, so their Home is today's, markup for markup.
 *
 * The picker shows only what is switched on (W3b's switches): at launch Mixed (the default), All puzzles and All
 * arcade, best of 3, 1v1. A switch with one option on draws no control at all (no Best of 3 row for one choice); a
 * switched-off option never appears. 1v1 only: the 4- and 8-player screens (mockups 08–10) are a later session's, so
 * this card offers no player-count row and draws nothing if 1v1 itself is switched off.
 */
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button, Icon, Segmented, Sheet } from "@/design/components";
import { formatOf, type BestOf, type RatedPick, type RatedStatus } from "@/lib/rated/backend";
import { useRatedStatus } from "@/lib/rated/ratedApi";
import { cooldownLine } from "@/lib/rated/rules";
import { serverNow } from "@/lib/duel/clock";
import { pickProp, recordRatedEvent } from "@/lib/rated/ratedEvents";
import {
  bestOfLabel,
  defaultPick,
  pickLabel,
  pickMoves,
  pickNote,
  placementHomeLine,
  shownBestOf,
  shownPicks,
  shownSizes,
  wonLostText,
} from "@/lib/rated/rules";
import { PLACEMENT_MATCHES, ratingText } from "@/lib/rated/tierDisplay";
import { usePass } from "@/lib/pass/passApi";

import { DivisionBarView, PickMark, PlacementBoxes, RankEmblem, SideTile, UnplacedEmblem } from "./RatedParts";

const LAST_PICK_KEY = "duelz-rated-pick:v1";
/** The pick this device last played (a convenience; the picker still offers only what is switched on). */
function lastPick(): RatedPick | null {
  try {
    return (typeof localStorage === "undefined" ? null : (localStorage.getItem(LAST_PICK_KEY) as RatedPick | null)) ?? null;
  } catch {
    return null;
  }
}
function rememberPick(pick: RatedPick): void {
  try {
    localStorage.setItem(LAST_PICK_KEY, pick);
  } catch {
    /* storage blocked */
  }
}

/** Home's rated block, or nothing for anyone rated play isn't open to. */
export function RatedHome() {
  const status = useRatedStatus();
  if (!status) return null;
  return <RatedHomeView status={status} />;
}

export function RatedHomeView({ status }: { status: RatedStatus }) {
  // Compete's ladder hero (P3, 22 Nov 2026; plan section 2.1, mockup compete-mixed-phone): the rank and the Play card
  // drawn as one obsidian hero with the cut corner, Find a match its one gold button.
  return (
    <div className="rt-home rt-ladder jz-cut-lg" data-rated-home={status.standing.state}>
      <RankPanel status={status} />
      <PlayCard status={status} />
    </div>
  );
}

/* ------------------------------------------------------------------ the rank panel */

/**
 * "+22 this week" (or −): the Joulz Rating change over this week's rated matches, from the server's match history
 * (ratedWeekChangeFn, Monday 00:00 UK on), the same call Home's banner makes; null for none or no answer. Checks set
 * `window.__DUELZ_RATED_WEEK__` (a number) in place of the call; never read in a production build.
 */
function useWeekChange(placed: boolean): number | null {
  const [change, setChange] = useState<number | null>(null);
  useEffect(() => {
    if (!placed) return setChange(null);
    let live = true;
    if (!import.meta.env.PROD) {
      const stand = (window as unknown as Record<string, unknown>)["__DUELZ_RATED_WEEK__"];
      if (typeof stand === "number") {
        setChange(stand === 0 ? null : stand);
        return;
      }
      // Under automation with no stand-in: no call (no existing check gains a server call).
      if (typeof navigator !== "undefined" && navigator.webdriver) return;
    }
    void (async () => {
      try {
        const { ratedWeekChangeFn } = await import("@/lib/home/weekChange.functions");
        const answer = await ratedWeekChangeFn();
        if (live) setChange(answer && answer.change !== 0 ? answer.change : null);
      } catch {
        if (live) setChange(null);
      }
    })();
    return () => {
      live = false;
    };
  }, [placed]);
  return change;
}

function RankPanel({ status }: { status: RatedStatus }) {
  const navigate = useNavigate();
  const name = status.me.username;
  const s = status.standing;
  const week = useWeekChange(s.state === "placed");
  // The season line from D2's pass (accounts with a pass; nothing otherwise).
  const pass = usePass();
  const season = pass.state === "open" && pass.view.season.daysLeft !== null && !pass.view.season.ended ? pass.view.season : null;
  const guestTag = status.guest ? (
    <span className="rt-guest-tag" data-guest-tag>
      Guest
    </span>
  ) : null;

  if (s.state === "placement") {
    const won = s.results.filter((r) => r === "won").length;
    const lost = s.results.filter((r) => r === "lost").length;
    const known = s.results.every((r) => r !== null);
    return (
      <section aria-label="Placement" className="rt-rank" data-rank-panel="placement">
        <div className="rt-rank-head">
          <span className="rt-rank-who">
            <span className="rt-rank-name">
              {name}
              {guestTag}
            </span>
            <span className="rt-ladder-eyebrow">Placement matches</span>
          </span>
          <UnplacedEmblem />
        </div>
        <div className="rt-rank-count">
          <span className="rt-rank-of" data-placement-of>
            {s.results.length} of {PLACEMENT_MATCHES}
          </span>
          {s.results.length > 0 && known ? <span className="rt-rank-wl">{wonLostText(won, lost)}</span> : null}
        </div>
        <PlacementBoxes results={s.results} />
        <p className="rt-rank-line">{placementHomeLine(s.results.length)}</p>
        <div className="rt-sides">
          <SideTile side="puzzles" rating={s.puzzles} hidden sub={s.puzzles.matches > 0 ? `${s.puzzles.matches} played` : undefined} />
          <SideTile side="arcade" rating={s.arcade} hidden sub={s.arcade.matches > 0 ? `${s.arcade.matches} played` : undefined} />
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Your rank" className="rt-rank" data-rank-panel="placed">
      <div className="rt-rank-head">
        <span className="rt-rank-who">
          <span className="rt-ladder-eyebrow" data-ellipsis>
            {s.rank.label}
            {guestTag}
          </span>
          <span className="rt-ladder-rating" data-joulz-rating>
            {ratingText(s.rank.rating)}
          </span>
          {season ? (
            <span className="rt-rank-sub" data-season-line>
              {season.name}, {season.daysLeft} {season.daysLeft === 1 ? "day" : "days"} left
            </span>
          ) : null}
        </span>
        <button
          type="button"
          className="rt-rank-rating rt-ladder-emblem press"
          aria-label={`Joulz Rating ${ratingText(s.rank.rating)}, ${s.rank.label}. See the tiers`}
          onClick={() => {
            recordRatedEvent({ event: "tier_ladder_viewed", from: "home" });
            void navigate({ to: "/tiers" as never });
          }}
          data-open-tiers
        >
          <RankEmblem rank={s.rank} size={76} />
        </button>
      </div>
      <DivisionBarView rank={s.rank} />
      {week !== null ? (
        <p className={week > 0 ? "rt-ladder-week rt-ladder-up" : "rt-ladder-week rt-ladder-down"} data-rated-week-change={week}>
          {week > 0 ? "▲" : "▼"} {Math.abs(week)} this week
        </p>
      ) : null}
      <div className="rt-sides">
        <SideTile side="puzzles" rating={s.puzzles} />
        <SideTile side="arcade" rating={s.arcade} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ the Play card */

/**
 * The wait after set-up leaves (13 Nov 2026): its line while it runs, counted down on the server's clock (a step every
 * 15 s is plenty for whole minutes), or null.
 */
export function useCooldownLine(status: RatedStatus): string | null {
  const cooldown = status.cooldown ?? null;
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    if (!cooldown) return;
    setNow(serverNow());
    const id = window.setInterval(() => setNow(serverNow()), 15_000);
    return () => window.clearInterval(id);
  }, [cooldown?.untilMs]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!cooldown || now >= cooldown.untilMs) return null;
  return cooldownLine(cooldown.aborts, cooldown.untilMs, now);
}

/** The cooldown line, where Play is. */
function CooldownNote({ line }: { line: string | null }) {
  if (!line) return null;
  return (
    <p className="rt-cooldown" role="status" data-rated-cooldown data-wrap-ok>
      {line}
    </p>
  );
}

function PlayCard({ status }: { status: RatedStatus }) {
  const navigate = useNavigate();
  const picks = shownPicks(status.options);
  const bests = shownBestOf(status.options);
  const [pick, setPick] = useState<RatedPick | null>(() => defaultPick(status.options, lastPick()));
  const [bestOf, setBestOf] = useState<BestOf | null>(bests.includes(3) ? 3 : (bests[0] ?? null));
  const [picker, setPicker] = useState(false);
  const placing = status.standing.state === "placement";
  const nextPlacement = status.standing.state === "placement" ? status.standing.results.length + 1 : null;
  const cooldown = useCooldownLine(status);
  if (!pick || !bestOf || !shownSizes(status.options).includes(2)) return null;

  const play = () => {
    recordRatedEvent({ event: "play_card_tapped", pick: pickProp(pick), placement: placing });
    rememberPick(pick);
    void navigate({ to: "/rated" as never, search: { pick, format: formatOf(bestOf) } as never });
  };

  return (
    <section aria-label="Find a match" className="rt-play" data-rated-play>
      {!placing && bests.length > 1 ? (
        <Segmented
          label="Match length"
          radio
          value={bestOf}
          onChange={setBestOf}
          options={bests.map((n) => ({ value: n, label: bestOfLabel(n), data: { "data-best-of-option": n } }))}
        />
      ) : null}
      <button
        type="button"
        className="rt-pick press"
        data-open-picker
        aria-haspopup="dialog"
        disabled={picks.length < 2}
        onClick={() => setPicker(true)}
      >
        <PickMark pick={pick} />
        <span className="rt-pick-text">
          <span className="rt-pick-name" data-current-pick={pick}>
            {pickLabel(pick)}
          </span>
          <span className="rt-pick-note" data-wrap-ok>
            {pickNote(pick)}
          </span>
        </span>
        {picks.length > 1 ? <Icon name="chevron-down" size={20} tone="text-3" /> : null}
      </button>
      <CooldownNote line={cooldown} />
      <Button variant="gold" size={60} block onClick={play} disabled={cooldown !== null} data-rated-play-button>
        {placing ? `Play placement ${nextPlacement}` : "Find a match"}
      </Button>
      {picker ? (
        <RatedPicker
          status={status}
          value={pick}
          onClose={() => setPicker(false)}
          onPick={(p) => {
            setPick(p);
            setPicker(false);
          }}
        />
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ the picker (mockup 02) */

export function RatedPicker({
  status,
  value,
  onPick,
  onClose,
}: {
  status: RatedStatus;
  value: RatedPick;
  onPick: (p: RatedPick) => void;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState<RatedPick>(value);
  const cooldown = useCooldownLine(status);
  const picks = shownPicks(status.options);
  const placed = status.standing.state === "placed" ? status.standing : null;
  const ratingOf = (p: RatedPick): number | null => {
    if (!placed) return null;
    if (p === "puzzles") return placed.puzzles.rating;
    if (p === "arcade") return placed.arcade.rating;
    return placed.categories.find((c) => c.pick === p)?.rating ?? null;
    return null;
  };
  const wide = picks.filter((p) => p === "mixed");
  const sides = picks.filter((p) => p === "puzzles" || p === "arcade");
  const cats = picks.filter((p) => p !== "mixed" && p !== "puzzles" && p !== "arcade");
  const option = (p: RatedPick, big = false) => {
    const r = ratingOf(p);
    return (
      <button
        key={p}
        type="button"
        role="radio"
        aria-checked={chosen === p}
        className={`rt-option press${big ? " rt-option-big" : ""}`}
        data-pick-option={p}
        onClick={() => setChosen(p)}
      >
        <PickMark pick={p} />
        <span className="rt-option-text">
          <span className="rt-option-name">{pickLabel(p)}</span>
          {big ? (
            <span className="rt-option-note" data-wrap-ok>
              {pickNote(p)}
            </span>
          ) : null}
        </span>
        {big ? <span className="rt-option-moves">{pickMoves(p)}</span> : r !== null ? <span className="rt-option-rating">{ratingText(r)}</span> : null}
      </button>
    );
  };
  return (
    <Sheet
      title="Choose what to play"
      closeLabel="Close"
      onClose={onClose}
      data={{ "data-rated-picker": "" }}
      footer={
        <>
          <CooldownNote line={cooldown} />
          <Button variant="gold" size={58} block onClick={() => onPick(chosen)} disabled={cooldown !== null} data-picker-play>
            Play {pickLabel(chosen)}
          </Button>
        </>
      }
    >
      <div className="rt-picker" role="radiogroup" aria-label="What to play">
        <p className="rt-picker-intro">Your pick moves that rating. Every match also moves your overall rating.</p>
        {wide.map((p) => option(p, true))}
        {sides.length ? <div className="rt-option-grid">{sides.map((p) => option(p))}</div> : null}
        {cats.length ? <div className="rt-option-grid">{cats.map((p) => option(p))}</div> : null}
      </div>
    </Sheet>
  );
}
