import { useEffect, type ReactNode } from "react";

import { GameIcon } from "@/components/app/GameIcon";
import { Button, Icon, Stars } from "@/design/components";
import type { ServerChallenges } from "@/lib/challenges/challengesClient";
import { preloadGame } from "@/lib/duel/gameLoader";
import type { PuzzleType } from "@/lib/duel/types";
import {
  bestOf,
  levelStarsOf,
  starCountOf,
  type PracticeProgressView,
} from "@/lib/practice/progress";

import { LevelIntro } from "@/components/levels/LevelIntro";
import { LevelSwitch } from "@/components/levels/LevelSwitch";
import { levelsOf, resolveLevel } from "@/lib/levels/gameLevels";
import { levelAbout } from "@/lib/levels/levelAbout";
import { LEVEL_LABEL, NORMAL, storedLevelKey, type Level } from "@/lib/levels/levels";

import { ChallengeRows, useChallengeJoules, useChallengeStates } from "./ChallengeRows";
import { gameGuide, gameSeconds, gameTag } from "./gameMeta";

/**
 * A game's page (phase 2 step 3, 14 Nov 2026; mockups docs/design/style-guide/phone/intro.png and desktop/intro.png),
 * opened from a catalogue tile, the hero, Home's Recently played or the Challenges page (gamePageHref). Its art, name,
 * tag, time limit, best and stars; the goal and how to play; this game's challenges with progress (each one's Joules
 * only where the pass is on); and the gold Play, which starts the game as Practice always has, straight into the round
 * intro's 3-2-1 (Joe, 14 Nov 2026: the page is the game's information, so the intro's own Goal / How / Ready isn't
 * shown a second time). While the page is open the game's code is fetched (the intro fetches its sounds as it always has).
 *
 * The level selector (the difficulty framework, 15 Nov 2026) sits above Play: Easy · Normal · Hard · Expert, only the
 * levels this game has, showing the player's choice (the catalogue's level unless this game has its own). A game with
 * Normal only draws no selector; when the catalogue's level is one it lacks, a line says it plays Normal. The best and
 * stars shown are the played level's.
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
  // The account's best (Normal's: the page shows Normal's best until the bests checks follow levels, see "For Joe").
  const best = bestOf(progress, type);
  const stars = levelStarsOf(progress, type);
  const guide = gameGuide(type);
  const challenges = useChallengeStates(server, type);
  const joules = useChallengeJoules();
  const done = challenges.filter((c) => c.status === "done").length;
  const headingId = `game-page-${type}`;
  return (
    <article aria-labelledby={headingId} data-game-page={type} className="gm-page">
      <div className="gm-page-main">
        <div data-cat={tag.id} className="gm-page-art">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to Games"
            data-game-page-back
            className="gm-page-back press"
          >
            <Icon name="back" size={24} />
          </button>
          <GameIcon type={type} size={208} />
        </div>
        <div className="gm-page-head">
          <h1 id={headingId} className="gm-page-name" data-wrap-ok="">
            {name}
          </h1>
          <Stars levels={stars} current={storedLevelKey(level)} size="m" className="gm-page-stars" />
        </div>
        <ul aria-label="About this game" className="gm-page-tags">
          <li data-cat={tag.id} data-game-tag={tag.id} className="gm-tag gm-tag-cat">
            {tag.label}
          </li>
          <li data-game-seconds={gameSeconds(type)} className="gm-tag">
            {gameSeconds(type)} s
          </li>
          {/* The account's best; none yet shows a quiet "–". */}
          <li data-game-best={best ?? undefined} data-none={best === null || undefined} className="gm-tag">
            Best {best ?? "–"}
          </li>
          {mark ? <li className="gm-tag gm-tag-mark">{mark}</li> : null}
          <li className="sr-only">{`${starCountOf(progress, type)} of 3 stars`}</li>
        </ul>
        <section aria-label="How to play" className="gm-page-guide">
          <p className="gm-page-goal">{guide.goal}</p>
          {guide.how.length > 0 ? <p className="gm-page-how">{guide.how.join(" ")}</p> : null}
        </section>
        {notice ? (
          <p role="status" data-practice-notice className="gm-page-notice">
            {notice}
          </p>
        ) : null}
      </div>
      <div className="gm-page-side">
        {challenges.length > 0 ? (
          <section
            aria-labelledby={`${headingId}-challenges`}
            data-game-page-challenges
            className="gm-page-section"
          >
            <div className="gm-section-head">
              <h2 id={`${headingId}-challenges`} className="gm-section-title">
                Challenges
              </h2>
              <span data-challenges-done={done} className="gm-section-meta">
                {done} of {challenges.length} done
              </span>
            </div>
            <ChallengeRows
              states={challenges}
              joules={joules}
              account={account}
              label={`${name} challenges`}
            />
          </section>
        ) : null}
        <div className="gm-page-level" data-game-page-level={level}>
          {levels.length > 1 && onLevel ? (
            <>
              <LevelSwitch value={level} onChange={onLevel} levels={levels} label={`${name} difficulty`} />
              {levelAbout(type, level) ? (
                <p data-game-page-level-about={level} className="gm-page-level-note">
                  {levelAbout(type, level)}
                </p>
              ) : null}
              <LevelIntro />
            </>
          ) : null}
          {level !== chosen ? (
            <p data-game-page-level-note className="gm-page-level-note">
              {name} has no {LEVEL_LABEL[chosen]} level yet, so it plays Normal.
            </p>
          ) : null}
        </div>
        <div className="gm-page-play">
          <Button variant="gold" size={60} block onClick={onPlay} data-game-page-play={type}>
            Play
          </Button>
        </div>
      </div>
    </article>
  );
}
