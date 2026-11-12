/**
 * Home's rated part (wave 3, session W3c; mockups 01, 02 and 11 in docs/mockups/wave-3/): the rank panel (your tier,
 * division and Joulz Rating once placed, "Placement 2 of 5" during it) and the Play card ("Find a match", the pick,
 * Play), with the picker sheet.
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
import { useState } from "react";

import { Button, Icon, Panel, Segmented, Sheet } from "@/design/components";
import { Avatar, DEFAULT_AVATAR } from "@/design/identity";
import { formatOf, type BestOf, type RatedPick, type RatedStatus } from "@/lib/rated/backend";
import { useRatedStatus } from "@/lib/rated/ratedApi";
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
  return (
    <div className="rt-home" data-rated-home={status.standing.state}>
      <RankPanel status={status} />
      <PlayCard status={status} />
    </div>
  );
}

/* ------------------------------------------------------------------ the rank panel */

function RankPanel({ status }: { status: RatedStatus }) {
  const navigate = useNavigate();
  const name = status.me.username;
  const s = status.standing;
  const avatar = <Avatar look={status.me.look.avatar ?? DEFAULT_AVATAR} size={52} />;
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
      <Panel as="section" pad aria-label="Placement" className="rt-rank" data-rank-panel="placement">
        <div className="rt-rank-head">
          {avatar}
          <span className="rt-rank-who">
            <span className="rt-rank-name">
              {name}
              {guestTag}
            </span>
            <span className="rt-rank-sub">Placement matches</span>
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
      </Panel>
    );
  }

  return (
    <Panel as="section" pad aria-label="Your rank" className="rt-rank" data-rank-panel="placed">
      <div className="rt-rank-head">
        {avatar}
        <span className="rt-rank-who">
          <span className="rt-rank-name">
            {name}
            {guestTag}
          </span>
          {season ? (
            <span className="rt-rank-sub" data-season-line>
              {season.name}, {season.daysLeft} {season.daysLeft === 1 ? "day" : "days"} left
            </span>
          ) : null}
        </span>
        <button
          type="button"
          className="rt-rank-rating press"
          aria-label={`Joulz Rating ${ratingText(s.rank.rating)}. See the tiers`}
          onClick={() => {
            recordRatedEvent({ event: "tier_ladder_viewed", from: "home" });
            void navigate({ to: "/tiers" as never });
          }}
          data-open-tiers
        >
          <RankEmblem rank={s.rank} size={36} />
          <span className="rt-rank-rating-text">
            <span className="rt-rank-label">Joulz Rating</span>
            <span className="rt-rank-value" data-joulz-rating>
              {ratingText(s.rank.rating)}
            </span>
          </span>
        </button>
      </div>
      <div className="rt-sides">
        <SideTile side="puzzles" rating={s.puzzles} />
        <SideTile side="arcade" rating={s.arcade} />
      </div>
      <DivisionBarView rank={s.rank} />
    </Panel>
  );
}

/* ------------------------------------------------------------------ the Play card */

function PlayCard({ status }: { status: RatedStatus }) {
  const navigate = useNavigate();
  const picks = shownPicks(status.options);
  const bests = shownBestOf(status.options);
  const [pick, setPick] = useState<RatedPick | null>(() => defaultPick(status.options, lastPick()));
  const [bestOf, setBestOf] = useState<BestOf | null>(bests.includes(3) ? 3 : (bests[0] ?? null));
  const [picker, setPicker] = useState(false);
  const placing = status.standing.state === "placement";
  const nextPlacement = status.standing.state === "placement" ? status.standing.results.length + 1 : null;
  if (!pick || !bestOf || !shownSizes(status.options).includes(2)) return null;

  const play = () => {
    recordRatedEvent({ event: "play_card_tapped", pick: pickProp(pick), placement: placing });
    rememberPick(pick);
    void navigate({ to: "/rated" as never, search: { pick, format: formatOf(bestOf) } as never });
  };

  return (
    <section aria-label="Find a match" className="rt-play jz-stripes jz-cut-lg" data-rated-play>
      <h2 className="rt-play-title">Find a match</h2>
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
      <Button variant="gold" size={58} block onClick={play} data-rated-play-button>
        {placing ? `Play placement ${nextPlacement}` : "Play"}
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
        <Button variant="gold" size={58} block onClick={() => onPick(chosen)} data-picker-play>
          Play {pickLabel(chosen)}
        </Button>
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
