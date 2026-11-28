/**
 * The one reveal template (the polish plan's G1; built by P2, 21 Nov 2026, from the first version of 20 Nov).
 *
 * Six slots: the header (the game, its round or Practice, the speaker) stays put at the top; under it a body column
 * holds the score card (the big number, the verdict and heading, the parts line, practice's stars and best, the
 * hero's strip), the stage (the board or the run's picture; in a room a shared Segmented above it switches to the
 * room's chart), the facts strip, the breakdown behind "See breakdown" and the footer (a room's players).
 *
 * Nothing is ever cut off (fix (a) of the plan's section 2.1). An arcade stage grows with its picture and the body
 * column scrolls, as main's reveal did, so the bottom of a tall run picture can always be reached; a puzzle stage is
 * the space left under the score card and its board card scrolls inside it (useRevealFit fits the board first). The
 * stage has `container-type: inline-size`, so a family's picture can draw at the stage's width (`cqw` or
 * `useStageSize`); its height is the picture's own.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Button, LevelMark, Segmented } from "@/design/components";
import { levelsOf } from "@/lib/levels/gameLevels";
import { LEVEL_LABEL, LEVELS, type Level } from "@/lib/levels/levels";
import { LeverPicture, leverWords } from "@/lib/levels/leverPicture";

// A game's own views and the stage's size for a game's Reveal live in revealContext.ts (React only), so a game's Reveal
// reads them without importing the template (A2, 27 Nov 2026: the puzzles' import graph stays clear of the design and
// identity modules the template draws with).
export { RevealGameViewsProvider, useGameViewsHost, useRevealStageSize, useRevealViews, type RevealViewGroup, type RevealViewLabel } from "./revealContext";
import { MAIN_VIEW_GROUP, StageSizeContext, type RevealViewGroup } from "./revealContext";

/** One view of the stage: a board, a picture, the room's chart. */
export interface RevealView {
  id: string;
  label: string;
  node: ReactNode;
}

/** The stage box's size in CSS px, measured once per layout and on every resize (never on a frame). */
export function useStageSize(): { ref: (el: HTMLElement | null) => void; w: number; h: number } {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const node = useRef<HTMLElement | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = (el: HTMLElement | null) => {
    if (node.current === el) return;
    observer.current?.disconnect();
    node.current = el;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((s) => (s.w === Math.round(r.width) && s.h === Math.round(r.height) ? s : { w: Math.round(r.width), h: Math.round(r.height) }));
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      observer.current = new ResizeObserver(measure);
      observer.current.observe(el);
    }
  };
  useEffect(() => () => observer.current?.disconnect(), []);
  return { ref, w: size.w, h: size.h };
}



/** The views control above the stage: the shared Segmented, driven by the `views` list (no text scraping). */
export function RevealViews({
  views,
  value,
  onChange,
  label = "What to show",
  group,
}: {
  views: (Pick<RevealView, "id" | "label"> & { tone?: "good" | "bad" | undefined })[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  /** A game's control's group (A2, 27 Nov 2026: Double Take's two rows), on the row as `data-reveal-views`. */
  group?: string | undefined;
}) {
  if (views.length < 2) return null;
  return (
    <div data-reveal-views={group ?? ""} className="reveal-views">
      <Segmented
        options={views.map((v) => ({ value: v.id, label: v.label, ...(v.tone ? { data: { "data-view-tone": v.tone } } : {}) }))}
        value={value}
        onChange={onChange}
        label={label}
        radio
      />
    </div>
  );
}

/** The facts strip: the three or four numbers that explain the score. */
export function FactTiles({ facts }: { facts: readonly { label: string; value: ReactNode }[] }) {
  if (!facts.length) return null;
  return (
    <div data-reveal-facts="" className="reveal-facts" style={{ ["--reveal-facts-n" as string]: Math.min(4, facts.length) }}>
      {facts.map((f) => (
        <div key={f.label} className="reveal-fact">
          <b className="reveal-fact-value">{f.value}</b>
          <span className="reveal-fact-label">{f.label}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * The template's slots. `stage` draws in the stage; `views` (two or more) draw the control above it and every view in
 * the markup, the chosen one shown. `kind` names the family for the CSS (`puzzle`: the board card scrolls inside a
 * stage that takes the space left; `arcade`: the stage grows with its picture and the body column scrolls).
 * `className` and the `data-*` attributes go on the body column (ArcadeReveal's `data-reveal-column`).
 */
export function RevealScreen({
  kind,
  header,
  score,
  views,
  view,
  onView,
  stage,
  facts,
  footer,
  breakdown,
  root,
  className,
  viewControl,
  ...rest
}: {
  kind: "puzzle" | "arcade";
  header: ReactNode;
  score: ReactNode;
  views?: RevealView[] | undefined;
  view?: string | undefined;
  onView?: ((id: string) => void) | undefined;
  stage?: ReactNode;
  facts?: ReactNode;
  footer?: ReactNode;
  /** The breakdown and anything else that belongs behind "See breakdown" (drawn under the stage, folded by its owner). */
  breakdown?: ReactNode;
  root?: React.Ref<HTMLDivElement> | undefined;
  className?: string | undefined;
  /** A game's own views (useRevealViews): one control a group above the one stage, which the game draws itself. */
  viewControl?: { groups: RevealViewGroup[]; onChange: (group: string, id: string) => void } | null | undefined;
} & Record<`data-${string}`, string | boolean | undefined>) {
  const [own, setOwn] = useState(views?.[0]?.id ?? "");
  const current = view ?? own;
  const change = onView ?? setOwn;
  const shown = views?.find((v) => v.id === current) ?? views?.[0];
  const stageSize = useStageSize();
  const size = useMemo(() => ({ w: stageSize.w, h: stageSize.h }), [stageSize.w, stageSize.h]);
  return (
    <div ref={root} data-reveal-screen-template={kind} className="reveal-screen">
      {header ? (
        <div data-reveal-slot="header" className="reveal-slot-header">
          {header}
        </div>
      ) : null}
      <div data-reveal-slot="body" className={`reveal-slot-body${className ? ` ${className}` : ""}`} {...rest}>
        <div data-reveal-slot="score" className="reveal-slot-score">
          {score}
        </div>
        {views && views.length > 1 ? <RevealViews views={views} value={current} onChange={change} /> : null}
        {!views && viewControl
          ? viewControl.groups.map((g) => (
              <RevealViews
                key={g.group}
                group={g.group === MAIN_VIEW_GROUP ? undefined : g.group}
                views={g.views}
                value={g.current}
                label={g.label}
                onChange={(id) => viewControl.onChange(g.group, id)}
              />
            ))
          : null}
        <StageSizeContext.Provider value={size}>
        <div ref={stageSize.ref} data-reveal-slot="stage" data-reveal-stage="" className="reveal-slot-stage">
          {views && views.length > 1
            ? views.map((v) => (
                <div key={v.id} data-reveal-view={v.id} hidden={v.id !== (shown?.id ?? v.id)} className="reveal-view">
                  {v.node}
                </div>
              ))
            : stage}
        </div>
        </StageSizeContext.Provider>
        {facts ? (
          <div data-reveal-slot="facts" className="reveal-slot-facts">
            {facts}
          </div>
        ) : null}
        {breakdown ? (
          <div data-reveal-slot="breakdown" className="reveal-slot-breakdown">
            {breakdown}
          </div>
        ) : null}
        {footer ? (
          <div data-reveal-slot="footer" className="reveal-slot-footer">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The step-up card (the polish plan's section 6.1, L3; mockup levels3-e-phone.webp): after a star on a level with a level
 * above it, this level's picture beside the next one's (the lever-picture slot), one line saying what is new and the
 * next level's Play in gold, with Play again and Back beside it as secondary. Practice only: never in rooms, rated play
 * or the Daily (AnswerReveal draws it only on practice's reveal).
 */
export function StepUpCard({
  type,
  level,
  next,
  onNext,
  onPlayAgain,
  onBack,
}: {
  type: string;
  level: Level;
  next: Level;
  onNext: () => void;
  onPlayAgain?: (() => void) | undefined;
  onBack?: (() => void) | undefined;
}) {
  const words = leverWords(type, next);
  return (
    <section data-step-up={next} aria-label={`Step up to ${LEVEL_LABEL[next]}`} className="reveal-step-up">
      <div className="reveal-step-up-pictures">
        <span className="reveal-step-up-level">
          <LeverPicture type={type} level={level} size="s" />
          <LevelMark level={level} label />
        </span>
        <span aria-hidden="true" className="reveal-step-up-arrow">→</span>
        <span className="reveal-step-up-level">
          <LeverPicture type={type} level={next} size="s" />
          <LevelMark level={next} label />
        </span>
      </div>
      <p className="reveal-step-up-line">{words ? `New on ${LEVEL_LABEL[next]}: ${words.charAt(0).toLowerCase()}${words.slice(1)}.` : `${LEVEL_LABEL[next]} is the next step up.`}</p>
      <Button variant="gold" size={52} block onClick={onNext} data-step-up-play={next}>
        Play {LEVEL_LABEL[next]}
      </Button>
      <div data-practice-reveal-actions className="reveal-step-up-more">
        {onBack ? (
          <Button variant="secondary" size={44} onClick={onBack} className="flex-1">
            Back
          </Button>
        ) : null}
        {onPlayAgain ? (
          <Button variant="secondary" size={44} onClick={onPlayAgain} className="flex-1">
            Play again
          </Button>
        ) : null}
      </div>
    </section>
  );
}

/** The level above a level a game offers (Easy → Normal → Hard → Expert), or null at the top. */
export function levelAbove(type: string, level: Level): Level | null {
  const offered = levelsOf(type);
  const i = LEVELS.indexOf(level);
  return LEVELS.slice(i + 1).find((l) => offered.includes(l)) ?? null;
}
