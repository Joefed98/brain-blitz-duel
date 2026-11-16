import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/design/components";
import { puzzleDef } from "@/lib/duel/catalogue";
import { PUZZLE_INSTRUCTIONS } from "@/lib/duel/instructions";
import { removedDefinition } from "@/lib/duel/registerDefinition";
import { GameIntroExample } from "@/components/duel/GameParts";
import { INTRO_SCORE } from "@/lib/duel/introScore";
import { scoreSentences } from "@/lib/duel/scoreList";
import { soundCue } from "@/lib/fx/soundCues";
import type { PuzzleData, PuzzleType } from "@/lib/duel/types";
import { levelAbout, levelAbouts } from "@/lib/levels/levelAbout";
import { speedLevelInstructions } from "@/lib/levels/speedLevels";
import { CARD_LEVEL_TEXT } from "@/lib/levels/cardLevelText.data";
import { LEVEL_LABEL, NORMAL, puzzleLevel, type Level } from "@/lib/levels/levels";
import { levelNote } from "@/lib/levels/levelNotes";

const LEVEL_NAME = { easy: "Easy", hard: "Hard", expert: "Expert" } as const;

interface PuzzleInstructionsProps {
  type: PuzzleType;
  /** The round's puzzle: a Speed level's own goal and lines (the Speed overhaul's levels; absent or Normal: the game's). */
  puzzle?: PuzzleData | null;
  /**
   * The round's dealt level. The Cards & Board levels: its own goal, lines and score in place of Normal's. A Sports
   * game: a level other than Normal adds its line (levelNotes.ts) to HOW. The Word games: the intro states the level's
   * one line (levelAbout.ts). Absent, null or Normal: Normal's text.
   */
  level?: Level | null;
  overlay?: boolean;
  /** Shown between HOW and SCORE (the intro's demo box, IntroStage, which takes the spare height). */
  beforeScore?: ReactNode;
}

export function PuzzleInstructions({ type, overlay = false, beforeScore, level = null, puzzle = null }: PuzzleInstructionsProps) {
  const base = PUZZLE_INSTRUCTIONS[type] ?? removedDefinition(type).instructions;
  // A Speed level's own goal and lines (the Speed overhaul), from the round's puzzle.
  const instructions = puzzle ? speedLevelInstructions(type, puzzleLevel(puzzle), base) : base;
  const cardLevel: Exclude<Level, "normal"> | null = level && level !== "normal" ? level : null;
  const levelText = cardLevel ? (CARD_LEVEL_TEXT[type]?.[cardLevel] ?? null) : null;
  // A level's own lines first (marked), then Normal's lines that hold at every level; the intro keeps at most four.
  const how = [
    ...(levelText ? levelText.how.map((detail, i) => ({ action: i === 0 ? `${LEVEL_NAME[cardLevel!]}:` : "", detail, level: true })) : []),
    ...instructions.how.filter((line) => (overlay || !line.helpOnly) && !(levelText && line.normalOnly)),
  ].slice(0, overlay ? undefined : 4);
  const note = levelNote(type, level ?? NORMAL);
  // Levels (stage 3): the intro states this round's level; the help lists every level the game has.
  const shownLevel: Level = level ?? NORMAL;
  const about = overlay ? "" : levelAbout(type, shownLevel);
  const abouts = overlay ? levelAbouts(type) : [];

  return (
    <section
      className={
        overlay
          ? "flex w-full flex-col gap-4"
          : `round-instructions flex w-full flex-col gap-2 ${beforeScore ? "min-h-0 flex-1" : "shrink-0"}`
      }
      aria-label={`${puzzleDef(type).name} instructions`}
    >
      <div className="intro-goal shrink-0">
        <p className="intro-label">Goal</p>
        <p
          className={`intro-goal-text${overlay ? " intro-goal-text-help" : ""}`}
        >
          {levelText ? levelText.goal : instructions.goal}
        </p>
      </div>
      {/* The intro (3 Nov 2026, Joe's audit): GOAL, then the demo box (about 40 % of the height), then HOW and
          SCORE under it; the "?" help keeps GOAL, HOW, SCORE. */}
      {beforeScore}
      <div className="intro-how shrink-0">
        <p className="intro-label">How</p>
        <div
          className={`flex flex-col gap-0.5 leading-snug ${overlay ? "text-sm text-muted-foreground" : "intro-how-text"}`}
        >
          {how.map((line) => (
            <p key={`${line.action}-${line.detail}`} {...("level" in line ? { "data-level-line": "" } : {})}>
              {line.action ? <><strong className="intro-how-action">{line.action}</strong> {line.detail}</> : line.detail}
            </p>
          ))}
          {note && overlay ? <p data-help-level-note="">{note}</p> : null}
        </div>
      </div>
      {about ? (
        <p data-intro-level={shownLevel} className="intro-how-text shrink-0 leading-snug">
          <strong className="intro-how-action">{LEVEL_LABEL[shownLevel]}:</strong> {about}
        </p>
      ) : null}
      {abouts.length > 0 ? (
        <div data-help-levels="" className="intro-how shrink-0">
          <p className="intro-label">Levels</p>
          <div className="flex flex-col gap-0.5 text-sm leading-snug text-muted-foreground">
            <p><strong className="intro-how-action">Normal:</strong> the game as above.</p>
            {abouts.map((row) => (
              <p key={row.level}>
                <strong className="intro-how-action">{row.label}:</strong> {row.about}
              </p>
            ))}
          </div>
        </div>
      ) : null}
      <div className="intro-score shrink-0">
        <p className="intro-label">Score</p>
        {overlay ? (
          // The help's SCORE is a list too (text pass, 4 Nov 2026): one row a part, then penalties, then the total.
          <ul data-help-score-parts="" className="flex flex-col gap-0.5 text-sm leading-snug text-muted-foreground">
            {scoreParts(levelText ? levelText.score : instructions.score).map((part) => (
              <li key={part}>{part}</li>
            ))}
          </ul>
        ) : (
          <ul data-intro-score-parts="" className="intro-score-text flex flex-col gap-0.5 leading-snug">
            {scoreParts(levelText ? levelText.intro : INTRO_SCORE[type]).map((part) => (
              <li key={part} className="intro-score-part">{part}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/**
 * The intro's SCORE as a short list (3 Nov 2026): the same text, one sentence a row. Splits after a full stop
 * followed by a space and a capital or digit, so decimals ("2.5 s") and abbreviations stay whole.
 */
export function scoreParts(text: string | undefined): string[] {
  // A deleted game (removedGames.ts) has no INTRO_SCORE entry: no Score lines, as main drew none.
  return scoreSentences(text);
}

/** Puzzles whose "?" card repeats the intro's worked example. */
function HelpExample({ type }: { type: PuzzleType }) {
  return (
    <div className="mt-3 flex justify-center">
      <GameIntroExample type={type} />
    </div>
  );
}

interface PuzzleHelpProps {
  type: PuzzleType;
  /** The round's dealt level (the Cards & Board levels' own text; any other game's line in HOW when it isn't Normal). */
  level?: Level | null;
  open: boolean;
  onClose: () => void;
}

export function PuzzleHelp({ type, open, onClose, level = null }: PuzzleHelpProps) {
  useEffect(() => {
    if (!open) return;
    soundCue("shared.help.open");
    return () => soundCue("shared.help.close");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;

  // The sheet sits over the game region. Its body is its own scroll container
  // (help-sheet-scroll: pan-y, contained overscroll, data-scrollable for the
  // game screen's touch blockers), so an arena's touch-action none or a board's
  // touchmove guard never stops it scrolling, and the page and game behind never
  // move. The close button sits outside the scroller and is always on screen.
  return (
    <div
      role="presentation"
      data-help-sheet
      className="absolute inset-0 z-40 flex cursor-pointer flex-col items-stretch justify-start bg-background/90 px-3 pb-2 pt-2 backdrop-blur-sm"
      onClick={onClose}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${puzzleDef(type).name} help`}
        className="th-sheet flex max-h-full min-h-0 w-full cursor-default flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div data-help-header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
          <p className="min-w-0 flex-1 text-sm font-bold text-foreground">The clock keeps running while this is open.</p>
          <button
            type="button"
            data-help-close
            aria-label="Close help"
            onClick={onClose}
            className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-background font-display text-xl font-bold leading-none text-foreground"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <div data-help-scroll data-scrollable className="help-sheet-scroll min-h-0 flex-1 px-4 pb-4 pt-3">
          <PuzzleInstructions type={type} overlay level={level} />
          {type === "lightup" && <HelpExample type={type} />}
          <p className="mt-4 text-center font-mono text-xs uppercase text-muted-foreground">
            Tap outside or × to close
          </p>
        </div>
      </div>
    </div>
  );
}

interface PuzzleHelpButtonProps {
  onClick: () => void;
}

/**
 * The 28px circle is all that is drawn; an invisible ::before makes the hit area 44 x 44
 * (Batch 4 fix-up, 17 Oct 2026): 8px above and below the circle and 16px to its left (the
 * insets count from inside its 1px border), over the title or the empty side of the arcade
 * header, never the control after it. z-10 keeps the puzzle timer row under it from taking
 * its lower 8px. The button's box and the header's layout are unchanged.
 */
export function PuzzleHelpButton({ onClick }: PuzzleHelpButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Show puzzle instructions"
      title="Show puzzle instructions"
      onClick={onClick}
      className="relative z-10 h-7 w-7 shrink-0 rounded-full border-border bg-card p-0 font-display text-base font-bold text-foreground shadow-none before:absolute before:-inset-y-[9px] before:-left-[17px] before:-right-px before:content-['']"
    >
      ?
    </Button>
  );
}
