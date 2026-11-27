import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { GameIcon } from "@/components/app/GameIcon";
import { Button, GameTile, Icon, Input, Segmented, Stars } from "@/design/components";
import { PUZZLE_REGISTRY } from "@/lib/duel/catalogue";
import { gameOfTheDayAt } from "@/lib/duel/gameOfTheDay";
import { PUZZLE_INSTRUCTIONS } from "@/lib/duel/instructions";
import type { PuzzleType } from "@/lib/duel/types";
import { levelStarsOf, starCountOf, type PracticeProgressView } from "@/lib/practice/progress";

import { catalogueGames, gameTag, homeShelves, type Shelf } from "./gameMeta";
import type { GamesView } from "./gamesView";

/**
 * The Games catalogue, the Games tab (P2, 22 Nov 2026; Joe, 20 Nov: "G1 shelves by default, plus one switch to All";
 * mockups docs/polish-plan-final/direction/pages/games-mixed-phone.webp and games-mixed-all-phone.webp). One switch,
 * Shelves · All, remembered on the device (gamesView.ts). Shelves: the game of the day as the hero, then one shelf per
 * family (each live puzzle category, then each live arcade group) as a sideways-scrolling row of 132 × 164 tiles with
 * "All n" (which opens All at that family); on a computer each shelf wraps to at most five across. All: every game in
 * the three-across grid (five on a computer), grouped by family under the family's name. Each game is listed once a
 * page, on its home shelf. The level switch and the "Difficulty levels" panel left the catalogue: a game's level is
 * chosen on its page. The star total and the search button sit in the page header (CatalogueHeaderTools); a search
 * filters by the game's name. Retired games appear nowhere (catalogueGames).
 */

export function CatalogueHeaderTools({
  stars,
  total,
  searchOpen,
  onSearch,
}: {
  stars: number;
  total: number;
  searchOpen: boolean;
  onSearch: () => void;
}) {
  return (
    <span className="gm-head-tools">
      <span data-practice-stars={stars} className="gm-star-total">
        <Icon name="star" size={18} className="gm-star-icon" />
        <span>
          <span className="gm-star-earned">{stars}</span> / {total}
          <span className="sr-only"> stars</span>
        </span>
      </span>
      <Button
        variant="icon"
        onClick={onSearch}
        aria-label="Search games"
        aria-expanded={searchOpen}
        aria-controls="games-search"
        data-games-search-toggle=""
      >
        <Icon name="search" size={22} />
      </Button>
    </span>
  );
}

export function GamesCatalogue({
  progress,
  query,
  onQuery,
  searchOpen,
  view,
  onView,
  hidden,
  tileStyle,
  onOpen,
  onPlay,
  before,
  after,
  tileExtra,
}: {
  progress: PracticeProgressView | null;
  query: string;
  onQuery: (q: string) => void;
  searchOpen: boolean;
  /** Shelves or All (remembered on the device by the page). */
  view: GamesView;
  onView: (view: GamesView) => void;
  /** Games held back for this player (Joulz Plus early access). */
  hidden: readonly string[];
  tileStyle: string | null;
  onOpen: (type: PuzzleType) => void;
  /** The hero's Play: the game of the day's round, straight in. Left out, the hero's Play opens its page. */
  onPlay?: (type: PuzzleType) => void;
  /** Notes drawn above the switch (the refresh note, offline install, a notice). */
  before?: ReactNode;
  /** Sections after the games (offline runs, the footer). */
  after?: ReactNode;
  /**
   * Drawn inside each tile's wrapper after the tile: the offline mark or pending clock (a small badge) and the best,
   * read as the tile's description (its element's id is tileDescriptionId).
   */
  tileExtra?: (type: PuzzleType) => ReactNode;
}) {
  // A shelf only with a game this player can play: held-back games (Plus early access) are left out of every shelf,
  // the grid, the search and the hero alike.
  const shelves = useMemo(
    () =>
      homeShelves()
        .map((shelf) => ({ ...shelf, games: shelf.games.filter((t) => !hidden.includes(t)) }))
        .filter((shelf) => shelf.games.length > 0),
    [hidden],
  );
  const all = useMemo(() => catalogueGames().filter((t) => !hidden.includes(t)), [hidden]);
  const q = query.trim().toLowerCase();
  const found = q === "" ? [] : all.filter((type) => gameName(type).toLowerCase().includes(q));
  // The hero: today's game of the day among every playable game (Shelves only, no search).
  const [today] = useState(() => Date.now());
  const hero = view === "shelves" && q === "" ? gameOfTheDayAt(today, all) : null;
  const searchRef = useRef<HTMLInputElement>(null);
  // "All n" opens All scrolled to that family's group.
  const [jumpTo, setJumpTo] = useState<string | null>(null);
  useEffect(() => {
    if (view !== "all" || !jumpTo) return;
    document.querySelector(`[data-games-group="${jumpTo}"]`)?.scrollIntoView({ block: "start" });
    setJumpTo(null);
  }, [view, jumpTo]);
  // Marked once the page answers taps (hydrated): browser checks wait for it before pressing a tile.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const tile = (type: PuzzleType) => (
    <CatalogueTile key={type} type={type} progress={progress} tileStyle={tileStyle} onOpen={onOpen} tileExtra={tileExtra} />
  );
  return (
    <div className="gm-catalogue" data-games-catalogue data-games-view={view} data-hydrated={hydrated ? "" : undefined}>
      {before}
      {searchOpen ? (
        <div className="gm-search">
          <Input
            ref={searchRef}
            id="games-search"
            search
            size={44}
            autoFocus
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search games"
            aria-label="Search games"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      ) : null}
      <div className="gm-view-row" data-games-chips="">
        <Segmented
          label="Show games as"
          value={view}
          onChange={onView}
          className="gm-view"
          data={{ "data-games-view-switch": "" }}
          options={(["shelves", "all"] as const).map((id) => ({
            value: id,
            label: id === "shelves" ? "Shelves" : "All",
            data: { "data-games-view-option": id },
          }))}
        />
        <span className="gm-view-count" data-games-count={view === "shelves" ? shelves.length : all.length}>
          {view === "shelves" ? `${shelves.length} families` : `${all.length} games`}
        </span>
      </div>
      {q !== "" ? (
        <section aria-label="Search results" className="gm-group">
          <div className="gm-grid gm-grid-all" data-games-grid="search">
            {found.map(tile)}
          </div>
          {found.length === 0 ? (
            <p data-games-empty className="gm-empty">
              No games match “{query.trim()}”
            </p>
          ) : null}
        </section>
      ) : view === "shelves" ? (
        <>
          {hero ? <HeroCard type={hero} progress={progress} onOpen={onOpen} onPlay={onPlay} /> : null}
          {shelves.map((shelf) => (
            <ShelfRow
              key={shelf.id}
              shelf={shelf}
              onAll={() => {
                setJumpTo(shelf.id);
                onView("all");
              }}
            >
              {shelf.games.map(tile)}
            </ShelfRow>
          ))}
        </>
      ) : (
        shelves.map((shelf) => (
          <section key={shelf.id} aria-labelledby={`games-group-${shelf.id}`} data-games-group={shelf.id} className="gm-group">
            <div className="gm-shelf-head">
              <h2 id={`games-group-${shelf.id}`} className="gm-shelf-title">
                <span aria-hidden="true" data-cat={shelf.id} className="gm-dot" />
                {shelf.label}
              </h2>
              <span className="gm-shelf-count">{shelf.games.length}</span>
            </div>
            <div className="gm-grid gm-grid-all" data-games-grid={shelf.id}>
              {shelf.games.map(tile)}
            </div>
          </section>
        ))
      )}
      {after}
    </div>
  );
}

/** One family's shelf: its name and "All n" over a sideways-scrolling row (five across, wrapping, on a computer). */
function ShelfRow({ shelf, onAll, children }: { shelf: Shelf; onAll: () => void; children: ReactNode }) {
  return (
    <section aria-labelledby={`games-shelf-${shelf.id}`} data-games-shelf={shelf.id} className="gm-shelf">
      <div className="gm-shelf-head">
        <h2 id={`games-shelf-${shelf.id}`} className="gm-shelf-title">
          <span aria-hidden="true" data-cat={shelf.id} className="gm-dot" />
          {shelf.label}
        </h2>
        <button type="button" onClick={onAll} data-games-shelf-all={shelf.id} className="gm-shelf-all press">
          All {shelf.games.length}
          <Icon name="chevron-right" size={18} className="gm-shelf-all-icon" />
          <span className="sr-only"> {shelf.label} games</span>
        </button>
      </div>
      <div className="gm-grid gm-shelf-row" data-games-grid={shelf.id} data-scroll-x="">
        {children}
      </div>
    </section>
  );
}

/** A game's tile: one button named exactly the game, its stars, the offline mark and best as its description. */
function CatalogueTile({
  type,
  progress,
  tileStyle,
  onOpen,
  tileExtra,
}: {
  type: PuzzleType;
  progress: PracticeProgressView | null;
  tileStyle: string | null;
  onOpen: (type: PuzzleType) => void;
  tileExtra?: ((type: PuzzleType) => ReactNode) | undefined;
}) {
  const nameOf = gameName;
  return (
    <div data-practice-game={type} data-stars={starCountOf(progress, type)} className="gm-tile-wrap">
      <GameTile
        type={type}
        size="card"
        name={
          <span aria-hidden="true" data-wrap-ok="">
            {nameOf(type)}
          </span>
        }
        stars={levelStarsOf(progress, type)}
        tileStyle={tileStyle}
        onClick={() => onOpen(type)}
        aria-label={nameOf(type)}
        aria-describedby={tileDescriptionId(type)}
        className="gm-tile"
      />
      {tileExtra ? tileExtra(type) : null}
    </div>
  );
}

/** The id of the element each tile is described by (its best and stars). */
export function tileDescriptionId(type: string): string {
  return `practice-best-${type}`;
}

/**
 * The hero: the game of the day, its art on its family's colour, the name and goal, and a gold Play (its round,
 * straight in). The card itself opens the game's page.
 */
function HeroCard({
  type,
  progress,
  onOpen,
  onPlay,
}: {
  type: PuzzleType;
  progress: PracticeProgressView | null;
  onOpen: (type: PuzzleType) => void;
  onPlay?: ((type: PuzzleType) => void) | undefined;
}) {
  const tag = gameTag(type);
  const name = gameName(type);
  return (
    <div data-games-hero={type} data-cat={tag.id} className="gm-hero">
      <button type="button" onClick={() => onOpen(type)} aria-label={`${name}, game of the day`} className="gm-hero-open press">
        <span aria-hidden="true" className="gm-hero-art">
          <GameIcon type={type} size={112} />
        </span>
        <span className="gm-hero-text">
          <span className="gm-hero-kicker">Game of the day</span>
          <span className="gm-hero-name" data-wrap-ok="">
            {name}
          </span>
          <span className="gm-hero-goal" data-wrap-ok="">
            {PUZZLE_INSTRUCTIONS[type]?.goal ?? tag.label}
          </span>
          <Stars levels={levelStarsOf(progress, type)} size="m" label={false} />
        </span>
      </button>
      <Button variant="gold" size={48} onClick={() => (onPlay ? onPlay(type) : onOpen(type))} data-games-hero-play={type} className="gm-hero-play">
        Play
      </Button>
    </div>
  );
}

/** A game's display name (gameNames through the registry's name). */
function gameName(type: PuzzleType): string {
  return PUZZLE_REGISTRY[type].name;
}
