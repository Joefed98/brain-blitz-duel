import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { GameIcon } from "@/components/app/GameIcon";
import { Button, Chip, GameTile, Icon, Input, Stars } from "@/design/components";
import { PUZZLE_REGISTRY } from "@/lib/duel/catalogue";
import { gameOfTheDayAt } from "@/lib/duel/gameOfTheDay";
import type { PuzzleType } from "@/lib/duel/types";
import { levelStarsOf, starCountOf, type PracticeProgressView } from "@/lib/practice/progress";

import { catalogueGames, catalogueShelves, gameTag, onShelf } from "./gameMeta";

/**
 * The Games catalogue (phase 2 step 3, 14 Nov 2026; mockups docs/design/style-guide/phone/catalogue.png and
 * desktop/catalogue.png), the Games tab: chips (All, then each live puzzle category and arcade group with today's names
 * and colours) in place of the old Puzzles | Arcade switch, the hero (the game of the day, gameOfTheDay.ts) and a grid
 * of game tiles (today's tile art, the name, the three mastery stars), two columns on a phone and more on wider screens.
 * A tile or the hero opens the game's page. The star total and the search button sit in the page header
 * (CatalogueHeaderTools); a search filters by the game's name. No challenges here: they are on each game's page and
 * under More → Challenges (Joe: Practice stays uncluttered). Retired games appear nowhere (catalogueGames).
 */

export type CatalogueFilter = "all" | string;

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
  filter,
  onFilter,
  hidden,
  tileStyle,
  onOpen,
  before,
  after,
  tileExtra,
}: {
  progress: PracticeProgressView | null;
  query: string;
  onQuery: (q: string) => void;
  searchOpen: boolean;
  filter: CatalogueFilter;
  onFilter: (f: CatalogueFilter) => void;
  /** Games held back for this player (Joulz Plus early access). */
  hidden: readonly string[];
  tileStyle: string | null;
  onOpen: (type: PuzzleType) => void;
  /** Notes drawn above the chips (the refresh note, offline install, a notice). */
  before?: ReactNode;
  /** Sections after the grid (offline runs, the footer). */
  after?: ReactNode;
  /**
   * Drawn inside each tile's wrapper after the tile: the offline mark or pending clock (a small badge) and the best,
   * read as the tile's description (its element's id is tileDescriptionId).
   */
  tileExtra?: (type: PuzzleType) => ReactNode;
}) {
  // A chip only for a shelf with a game this player can play: held-back games (Plus early access) are left out of the
  // grid, every chip, the search and the hero alike.
  const shelves = useMemo(
    () => catalogueShelves().filter((shelf) => shelf.games.some((t) => !hidden.includes(t))),
    [hidden],
  );
  const all = useMemo(() => catalogueGames(), []);
  const nameOf = (type: PuzzleType) => gameName(type);
  const q = query.trim().toLowerCase();
  const visible = all.filter(
    (type) =>
      !hidden.includes(type) &&
      (filter === "all" || onShelf(type, filter)) &&
      (q === "" || nameOf(type).toLowerCase().includes(q)),
  );
  // The hero: today's game of the day, on All with no search.
  const [today] = useState(() => Date.now());
  const hero =
    filter === "all" && q === ""
      ? gameOfTheDayAt(
          today,
          all.filter((t) => !hidden.includes(t)),
        )
      : null;
  const searchRef = useRef<HTMLInputElement>(null);
  // Marked once the page answers taps (hydrated): browser checks wait for it before pressing a tile.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return (
    <div className="gm-catalogue" data-games-catalogue data-hydrated={hydrated ? "" : undefined}>
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
      <div
        role="group"
        aria-label="Game categories"
        className="gm-chips"
        data-games-chips
        data-scroll-x=""
      >
        <Chip
          selected={filter === "all"}
          data-practice-filter="all"
          onClick={() => onFilter("all")}
        >
          All
        </Chip>
        {shelves.map((shelf) => (
          <Chip
            key={shelf.id}
            selected={filter === shelf.id}
            cat={shelf.id}
            data-practice-filter={shelf.id}
            onClick={() => onFilter(shelf.id)}
          >
            {shelf.label}
          </Chip>
        ))}
      </div>
      <div className="gm-grid" data-games-grid>
        {hero ? (
          <HeroTile type={hero} name={nameOf(hero)} progress={progress} onOpen={onOpen} />
        ) : null}
        {visible.map((type) => (
          <div
            key={type}
            data-practice-game={type}
            data-stars={starCountOf(progress, type)}
            className="gm-tile-wrap"
          >
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
        ))}
      </div>
      {visible.length === 0 ? (
        <p data-games-empty className="gm-empty">
          No games match “{query.trim()}”
        </p>
      ) : null}
      {after}
    </div>
  );
}

/** The id of the element each tile is described by (its best and stars). */
export function tileDescriptionId(type: string): string {
  return `practice-best-${type}`;
}

/** The hero card: the game of the day, its art on its own colour, the name, tag and stars; opens its page. */
function HeroTile({
  type,
  name,
  progress,
  onOpen,
}: {
  type: PuzzleType;
  name: string;
  progress: PracticeProgressView | null;
  onOpen: (type: PuzzleType) => void;
}) {
  const tag = gameTag(type);
  return (
    <button
      type="button"
      data-games-hero={type}
      data-cat={tag.id}
      onClick={() => onOpen(type)}
      aria-label={`${name}, game of the day`}
      className="gm-hero press"
    >
      <span className="gm-hero-text">
        <span className="gm-hero-kicker">Game of the day</span>
        <span className="gm-hero-name" data-wrap-ok="">
          {name}
        </span>
        <span className="gm-hero-tag">
          <span aria-hidden="true" data-cat={tag.id} className="gm-dot" />
          {tag.label}
        </span>
        <Stars levels={levelStarsOf(progress, type)} size="m" label={false} />
      </span>
      <span aria-hidden="true" className="gm-hero-art">
        <GameIcon type={type} size={168} />
      </span>
    </button>
  );
}

/** A game's display name (gameNames through the registry's name). */
function gameName(type: PuzzleType): string {
  return PUZZLE_REGISTRY[type].name;
}
