import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { GameIcon } from "@/components/app/GameIcon";
import { LevelIntro } from "@/components/levels/LevelIntro";
import { LevelSwitch } from "@/components/levels/LevelSwitch";
import { Button, GameTile, Icon, Input, Segmented, Stars } from "@/design/components";
import { practiceSideCounts, practiceSideOf, type PracticeSide } from "@/lib/duel/practiceSide";
import { offersLevel } from "@/lib/levels/gameLevels";
import { LEVEL_LABEL, storedLevelKey, type Level } from "@/lib/levels/levels";
import { PUZZLE_REGISTRY } from "@/lib/duel/catalogue";
import { gameOfTheDayAt } from "@/lib/duel/gameOfTheDay";
import type { PuzzleType } from "@/lib/duel/types";
import { bestOf, levelStarsOf, starCountOf, type PracticeProgressView } from "@/lib/practice/progress";

import { catalogueGames, catalogueShelves, gameTag, onShelf, shelfSide } from "./gameMeta";

/**
 * The Games catalogue (phase 2 step 3, 14 Nov 2026; mockups docs/design/style-guide/phone/catalogue.png and
 * desktop/catalogue.png), the Games tab. Its top (the difficulty framework, 15 Nov 2026, Joe's order): the Puzzles |
 * Arcade switch (restored; remembered on the device, practiceSide.ts), then the switch's categories as colour tiles in
 * one sideways-scrolling row (the puzzle categories, or the arcade groups; a tap shows that category, a second tap the
 * whole side again), then the difficulty switch (Easy · Normal · Hard · Expert) that sets the level for the whole
 * catalogue: tiles show that level's best and mark that level's star, and a game without the level is marked
 * "Normal". Then the hero (the game of the day among the side's games, gameOfTheDay.ts) and the grid of game tiles
 * (today's tile art, the name, the three mastery stars), two columns on a phone and more on wider screens.
 * A tile or the hero opens the game's page. The star total and the search button sit in the page header
 * (CatalogueHeaderTools); a search filters by the game's name. No challenges here: they are on each game's page and
 * under More → Challenges (Joe: Practice stays uncluttered). Retired games appear nowhere (catalogueGames).
 */

/** "all": the whole side (no category tile chosen); else a shelf id. */
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
  side,
  onSide,
  level,
  onLevel,
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
  /** The Puzzles | Arcade switch. */
  side: PracticeSide;
  onSide: (side: PracticeSide) => void;
  /** The catalogue's level (the difficulty switch). */
  level: Level;
  onLevel: (level: Level) => void;
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
  // Only the switch's side's categories (the puzzle categories, or the arcade groups).
  const shelves = useMemo(
    () =>
      catalogueShelves().filter(
        (shelf) => shelfSide(shelf.id) === side && shelf.games.some((t) => !hidden.includes(t)),
      ),
    [hidden, side],
  );
  const all = useMemo(() => catalogueGames(), []);
  const counts = useMemo(() => practiceSideCounts(), []);
  const nameOf = (type: PuzzleType) => gameName(type);
  const q = query.trim().toLowerCase();
  // A chosen tile from the other side (the switch just flipped) reads as the whole side.
  const shelf = filter !== "all" && shelves.some((x) => x.id === filter) ? filter : "all";
  // A search finds games by name on both sides (the switch and the tiles choose what shows without one).
  const visible = all.filter(
    (type) =>
      !hidden.includes(type) &&
      (q !== ""
        ? nameOf(type).toLowerCase().includes(q)
        : shelf === "all"
          ? practiceSideOf(type) === side
          : onShelf(type, shelf)),
  );
  // The hero: today's game of the day among the side's games, with no category chosen and no search.
  const [today] = useState(() => Date.now());
  const hero =
    shelf === "all" && q === ""
      ? gameOfTheDayAt(
          today,
          all.filter((t) => !hidden.includes(t) && practiceSideOf(t) === side),
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
      <Segmented
        label="Puzzles or arcade"
        value={side}
        onChange={(next) => {
          onSide(next);
          onFilter("all");
        }}
        tone="gold"
        className="gm-side"
        data={{ "data-practice-switch": "" }}
        options={(["puzzles", "arcade"] as const).map((id) => ({
          value: id,
          label: id === "puzzles" ? "Puzzles" : "Arcade",
          count: counts[id],
          data: { "data-practice-side": id },
        }))}
      />
      <div
        role="group"
        aria-label={side === "puzzles" ? "Puzzle categories" : "Arcade groups"}
        className="gm-cat-tiles"
        data-games-chips
        data-games-category-tiles={side}
        data-scroll-x=""
      >
        {shelves.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={shelf === x.id}
            data-cat={x.id}
            data-practice-filter={x.id}
            onClick={() => onFilter(shelf === x.id ? "all" : x.id)}
            className="gm-cat-tile press"
          >
            <span className="gm-cat-tile-name" data-wrap-ok="">
              {x.label}
            </span>
            <span className="gm-cat-tile-count">{x.games.filter((t) => !hidden.includes(t)).length}</span>
          </button>
        ))}
      </div>
      <LevelSwitch value={level} onChange={onLevel} label="Difficulty for every game" className="gm-levels" data={{ "data-catalogue-level": level }} />
      <LevelIntro />
      <div className="gm-grid" data-games-grid>
        {hero ? (
          <HeroTile type={hero} name={nameOf(hero)} progress={progress} level={level} onOpen={onOpen} />
        ) : null}
        {visible.map((type) => (
          <div
            key={type}
            data-practice-game={type}
            data-stars={starCountOf(progress, type)}
            data-level={offersLevel(type, level) ? level : "normal"}
            data-level-best={levelBest(progress, type, level) ?? undefined}
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
              starLevel={storedLevelKey(offersLevel(type, level) ? level : "normal")}
              tileStyle={tileStyle}
              onClick={() => onOpen(type)}
              aria-label={nameOf(type)}
              aria-describedby={tileDescriptionId(type)}
              className="gm-tile"
            />
            <TileLevel type={type} level={level} progress={progress} />
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

/** A game's best at the catalogue's level (Normal's for a game without that level), or null. */
function levelBest(progress: PracticeProgressView | null, type: PuzzleType, level: Level): number | null {
  return bestOf(progress, type, storedLevelKey(offersLevel(type, level) ? level : "normal"));
}

/**
 * Under a tile: the level it plays at and that level's best. A game without the catalogue's level says "Normal" (it
 * plays Normal); at Normal with a game that has no other level, nothing more than the best is shown.
 */
function TileLevel({ type, level, progress }: { type: PuzzleType; level: Level; progress: PracticeProgressView | null }) {
  const plays: Level = offersLevel(type, level) ? level : "normal";
  const best = levelBest(progress, type, level);
  const fallback = plays !== level;
  return (
    <span data-tile-level={plays} data-level-fallback={fallback || undefined} className="gm-tile-level">
      {fallback || plays !== "normal" ? <span className="gm-tile-level-name">{LEVEL_LABEL[plays]}</span> : null}
      <span className="gm-tile-level-best">Best {best ?? "–"}</span>
    </span>
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
  level,
  onOpen,
}: {
  type: PuzzleType;
  name: string;
  progress: PracticeProgressView | null;
  level: Level;
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
        <Stars
          levels={levelStarsOf(progress, type)}
          current={storedLevelKey(offersLevel(type, level) ? level : "normal")}
          size="m"
          label={false}
        />
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
