import { useEffect, useState, type ReactNode } from "react";

import { GameIcon } from "@/components/app/GameIcon";
import { PuzzleHelp } from "@/components/duel/PuzzleInstructions";
import { LevelIntro } from "@/components/levels/LevelIntro";
import { Button, Icon, LevelCrown, LevelMark } from "@/design/components";
import type { ServerChallenges } from "@/lib/challenges/challengesClient";
import { preloadGame } from "@/lib/duel/gameLoader";
import type { PuzzleType } from "@/lib/duel/types";
import { levelsOf, resolveLevel } from "@/lib/levels/gameLevels";
import { levelAbout } from "@/lib/levels/levelAbout";
import { LEVEL_LABEL, NORMAL, storedLevelKey, type Level } from "@/lib/levels/levels";
import { LeverPicture, leverWords } from "@/lib/levels/leverPicture";
import { speedLevelLine } from "@/lib/levels/speedLevels";
import { STAR_SCORE } from "@/lib/practice/progressRules";
import { bestOf, starCountOf, type PracticeProgressView } from "@/lib/practice/progress";

import { ChallengeRows, useChallengeJoules, useChallengeStates } from "./ChallengeRows";
import { gameGuide, gameSeconds, gameTag } from "./gameMeta";

/**
 * A game's page (P2, 22 Nov 2026; Joe, 20 Nov: the level picker's L1 and L2 combined, mockups
 * docs/polish-plan-final/direction/pages/gamepage-mixed-phone.webp and levels-e-desktop.webp), opened from a catalogue
 * tile, the hero, Home's Jump back in or the Challenges page (gamePageHref). At most 40 words:
 *
 * - the header: Back, the game's tile, its name, family and seconds, and "?" (the help sheet);
 * - the goal in one line;
 * - the player's current level shown large: its picture from the lever-picture slot (src/lib/levels/leverPicture.tsx),
 *   the level mark, the lever in a few words, "The ranked game" on Normal, and the best and star (a crown on Expert);
 * - the game's levels as a compact row to tap, each with its small picture, the level mark, the best and the star;
 *   tapping one makes it the large one and remembers it for this game (the device's per-game choice, levelChoice.ts;
 *   a new player starts on Normal, or the catalogue's older stored level);
 * - one gold Play of 60 px ("Play Normal"), which starts the round straight into its intro's 3-2-1;
 * - "How to play" (the help sheet) and "Challenges n / m" (this game's challenges, opened in place) as two small buttons.
 *
 * While the page is open the game's code is fetched.
 */
export function GamePage({
  type,
  name,
  progress,
  server,
  account,
  notice,
  mark,
  level: chosen = NORMAL,
  onLevel,
  onPlay,
  onBack,
}: {
  type: PuzzleType;
  name: string;
  progress: PracticeProgressView | null;
  server: ServerChallenges | null;
  account: boolean;
  /** A line about this game now (offline: "No Tilt games are saved…"). */
  notice: string | null;
  /** Offline marks on the tags (Online only, None saved). */
  mark: ReactNode;
  /** The player's level choice for this game (before the game's own offer). */
  level?: Level;
  onLevel?: (level: Level) => void;
  onPlay: () => void;
  onBack: () => void;
}) {
  useEffect(() => {
    preloadGame(type);
  }, [type]);
  const tag = gameTag(type);
  const levels = levelsOf(type);
  const level = resolveLevel(type, chosen);
  const best = bestOf(progress, type, storedLevelKey(level));
  const guide = gameGuide(type, level);
  const challenges = useChallengeStates(server, type);
  const joules = useChallengeJoules();
  const done = challenges.filter((c) => c.status === "done").length;
  const [helpOpen, setHelpOpen] = useState(false);
  const [challengesOpen, setChallengesOpen] = useState(false);
  const headingId = `game-page-${type}`;
  const words = leverWords(type, level);
  const line = levelAbout(type, level) ? "about" : speedLevelLine(type, level) ? "line" : null;
  return (
    <article aria-labelledby={headingId} data-game-page={type} data-cat={tag.id} className="gm-page">
      <header className="gm-page-top">
        <button type="button" onClick={onBack} aria-label="Back to Games" data-game-page-back className="gm-page-back press">
          <Icon name="back" size={24} />
        </button>
        <span aria-hidden="true" className="gm-page-icon">
          <GameIcon type={type} size={64} />
        </span>
        <span className="gm-page-titles">
          <h1 id={headingId} className="gm-page-name" data-wrap-ok="">
            {name}
          </h1>
          <span className="gm-page-sub">
            <span data-game-tag={tag.id}>{tag.label}</span>
            {" · "}
            <span data-game-seconds={gameSeconds(type, level)}>{gameSeconds(type, level)} seconds</span>
            {mark ? <span className="gm-tag-mark">{mark}</span> : null}
          </span>
        </span>
        <button type="button" onClick={() => setHelpOpen(true)} aria-label={`How to play ${name}`} data-game-page-help className="gm-page-q press">
          ?
        </button>
      </header>
      {guide.goal ? <p className="gm-page-goal">{guide.goal}</p> : null}
      {notice ? (
        <p role="status" data-practice-notice className="gm-page-notice">
          {notice}
        </p>
      ) : null}
      <section aria-label={`${LEVEL_LABEL[level]} level`} data-game-page-level={level} className="gm-page-now">
        <div className="gm-page-now-picture">
          <LeverPicture type={type} level={level} size="l" />
          <span className="gm-page-now-mark">
            <LevelMark level={level} label />
            {level === chosen && levels.length > 1 ? <span className="gm-page-now-yours">· Your level</span> : null}
          </span>
        </div>
        {words ? (
          <p
            className="gm-page-lever"
            data-game-page-level-about={line === "about" ? level : undefined}
            data-game-page-level-line={line === "line" ? level : undefined}
            data-wrap-ok=""
          >
            {words}
          </p>
        ) : null}
        <ul className="gm-page-level-facts">
          {level === NORMAL ? <li>The ranked game.</li> : null}
          <li data-game-best={best ?? undefined} data-none={best === null || undefined} className="gm-tag">
            Best {best ?? "–"}
          </li>
          <li aria-hidden="true">
            <LevelResult level={level} best={best} />
          </li>
          <li className="sr-only">{`${starCountOf(progress, type)} of 3 stars`}</li>
        </ul>
        {level !== chosen ? (
          <p data-game-page-level-note className="gm-page-level-note">
            {name} has no {LEVEL_LABEL[chosen]} level yet, so it plays Normal.
          </p>
        ) : null}
      </section>
      {levels.length > 1 && onLevel ? (
        <>
          <div role="radiogroup" aria-label={`${name} difficulty`} data-game-page-levels="" className="gm-page-levels">
            {levels.map((l) => {
              const b = bestOf(progress, type, storedLevelKey(l));
              return (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={l === level}
                  aria-label={`${LEVEL_LABEL[l]}${b !== null ? `, best ${b}` : ""}`}
                  data-level-option={l}
                  onClick={() => onLevel(l)}
                  className="gm-page-level press"
                >
                  <LeverPicture type={type} level={l} size="s" />
                  <LevelMark level={l} label />
                  <span className="gm-page-level-best">
                    <LevelResult level={l} best={b} />
                    <span>{b ?? "–"}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <LevelIntro />
        </>
      ) : null}
      <div className="gm-page-play">
        <Button variant="gold" size={60} block onClick={onPlay} data-game-page-play={type}>
          {levels.length > 1 ? `Play ${LEVEL_LABEL[level]}` : "Play"}
        </Button>
        <div className="gm-page-more">
          <Button variant="secondary" size={48} onClick={() => setHelpOpen(true)} data-game-page-how="">
            How to play
          </Button>
          <Button
            variant="secondary"
            size={48}
            onClick={() => setChallengesOpen((open) => !open)}
            aria-expanded={challengesOpen}
            disabled={challenges.length === 0}
            data-game-page-challenges-toggle=""
          >
            Challenges {done} / {challenges.length}
          </Button>
        </div>
      </div>
      {challengesOpen && challenges.length > 0 ? (
        <section aria-labelledby={`${headingId}-challenges`} data-game-page-challenges className="gm-page-section">
          <div className="gm-section-head">
            <h2 id={`${headingId}-challenges`} className="gm-section-title">
              Challenges
            </h2>
            <span data-challenges-done={done} className="gm-section-meta">
              {done} of {challenges.length} done
            </span>
          </div>
          <ChallengeRows states={challenges} joules={joules} account={account} label={`${name} challenges`} />
        </section>
      ) : null}
      {helpOpen ? (
        <div className="gm-page-help">
          <PuzzleHelp type={type} open onClose={() => setHelpOpen(false)} level={level === NORMAL ? null : level} />
        </div>
      ) : null}
    </article>
  );
}

/** A level's star (175 or more on Easy, Normal or Hard) or, on Expert, its crown. */
function LevelResult({ level, best }: { level: Level; best: number | null }) {
  const on = best !== null && best >= STAR_SCORE;
  if (level === "expert") return <LevelCrown on={on} size={16} />;
  return <span data-level-star={on ? "on" : "off"} className="gm-level-star" />;
}
