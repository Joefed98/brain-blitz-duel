/**
 * The one reveal template (the polish plan's G1, Fable, 20 Nov 2026; docs/polish-plan-final/reveals-research.md §5).
 *
 * Five fixed slots in a column that never scrolls: the header (the game, its round or Practice, the speaker), the
 * score card (the big number, the verdict and heading, the parts line, practice's stars and best, the hero's strip at
 * its top edge), the stage (the board or the run's picture in a box at a fixed share of the height, `container-type:
 * size`, a shared Segmented above it for its views: Solution / Yours, the boards' tabs, a room's chart), the facts
 * strip (two rows of key numbers at most) and the footer (a room's finished count and countdown; practice's Back and
 * Play again), with the full breakdown behind "See breakdown".
 *
 * The template owns the height. A game's picture component gets the stage box and fills it (`useStageSize` or `cq`
 * units); nothing here scales a board with a transform. AnswerReveal and ArcadeReveal put their existing pieces into
 * these slots (every `data-*` attribute the checks read stays on the piece that carries it); the family sessions
 * (S3–S5) move each game's board onto the box's size and its own views onto the `views` prop.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Segmented } from "@/design/components";

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
export function RevealViews({ views, value, onChange, label = "What to show" }: { views: RevealView[]; value: string; onChange: (id: string) => void; label?: string }) {
  if (views.length < 2) return null;
  return (
    <div data-reveal-views="" className="reveal-views">
      <Segmented options={views.map((v) => ({ value: v.id, label: v.label }))} value={value} onChange={onChange} label={label} radio />
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
 * The template's slots. `stage` draws inside the fixed-share box; `views` (two or more) draw the control above it and
 * the chosen view's node in the box (the caller may also hand a single `stage` and no views). `kind` names the family
 * for the CSS (`puzzle` keeps the card and tray the fit still reads; `arcade` the picture).
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
  /** The breakdown and anything else that belongs behind "See breakdown" (drawn under the facts, hidden by its owner). */
  breakdown?: ReactNode;
  root?: React.Ref<HTMLDivElement> | undefined;
} & Record<`data-${string}`, string | undefined>) {
  const [own, setOwn] = useState(views?.[0]?.id ?? "");
  const current = view ?? own;
  const change = onView ?? setOwn;
  const shown = views?.find((v) => v.id === current) ?? views?.[0];
  return (
    <div ref={root} data-reveal-screen-template={kind} className="reveal-screen" {...rest}>
      <div data-reveal-slot="header" className="reveal-slot-header">
        {header}
      </div>
      <div data-reveal-slot="score" className="reveal-slot-score">
        {score}
      </div>
      {views && views.length > 1 ? <RevealViews views={views} value={current} onChange={change} /> : null}
      <div data-reveal-slot="stage" data-reveal-stage="" className="reveal-slot-stage">
        {views && views.length > 1
          ? views.map((v) => (
              <div key={v.id} data-reveal-view={v.id} hidden={v.id !== (shown?.id ?? v.id)} className="reveal-view">
                {v.node}
              </div>
            ))
          : stage}
      </div>
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
  );
}
