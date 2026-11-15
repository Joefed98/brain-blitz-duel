import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

import { countUpText, gameFx, type GameFxKind, type GameFxOptions } from "@/lib/fx/kit";

/**
 * The effects kit's React pieces (phase 2 step 4, 15 Nov 2026; presentation only; docs/design/game-fx/README.md).
 * Every piece renders its final state in the markup (a server render, reduced motion and a screenshot all read the
 * end state) and plays its effect once, after mount.
 */

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Plays one kit effect on a ref'd element once, after mount, when `when` is true. */
export function useGameFxOnce(kind: GameFxKind, ref: { current: Element | null }, when = true, options: GameFxOptions = {}): void {
  const played = useRef(false);
  useEffect(() => {
    if (!when || played.current) return;
    played.current = true;
    gameFx(kind, ref.current, { inGame: false, ...options });
  }, [when]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * A number that counts up to `value` (the kit's count-up: textContent only, ticking, a pop when it lands). The markup
 * holds the final number; the count starts before the first paint, so the starting number is the first one drawn.
 */
export function FxCountUp({ value, from = 0, className, silent = false, ...rest }: { value: number; from?: number; className?: string; silent?: boolean } & Record<`data-${string}`, unknown>) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const start = shown.current ?? from;
    shown.current = value;
    return countUpText(el, start, value, { silent });
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span ref={ref} className={className} {...rest}>
      {value}
    </span>
  );
}

const STAR_PATH = "M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.2l-5.8 3.2 1.2-6.5L2.6 9.4l6.5-.8z";

/** Stars landing one by one (the kit's "stars"): `earned` of `total`, each earned one dropping in turn. */
export function FxStars({ earned, total = 3, stepMs = 160, label }: { earned: number; total?: number | undefined; stepMs?: number; label?: string }) {
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  const played = useRef(false);
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    for (let i = 0; i < Math.min(earned, total); i++) gameFx("stars", refs.current[i] ?? null, { count: i + 1, delayMs: i * stepMs, inGame: false });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span data-fx-stars={earned} className="fx-stars" role="img" aria-label={label ?? `${earned} of ${total} stars`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} ref={(el) => void (refs.current[i] = el)} className="fx-star" data-earned={i < earned ? "" : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={STAR_PATH} fill="currentColor" />
          </svg>
        </span>
      ))}
    </span>
  );
}

/** The new-best badge, landing with the kit's "newBest". */
export function FxNewBest({ children = "New best" }: { children?: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useGameFxOnce("newBest", ref);
  return (
    <span ref={ref} data-fx-new-best className="fx-newbest">
      {children}
    </span>
  );
}

/**
 * The round-end payoff in one block: the score counting up, the stars landing and the new-best badge, then the
 * `win` moment on the block when `won`. Each part is optional.
 */
export function ResultPayoff({ score, from = 0, label, stars, newBest = false, won = false, scoreProps }: {
  score: number | null;
  from?: number;
  label?: ReactNode;
  stars?: { earned: number; total?: number } | null;
  newBest?: boolean;
  won?: boolean;
  scoreProps?: Record<`data-${string}`, unknown>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useGameFxOnce("win", ref, won, { silent: true });
  return (
    <div ref={ref} data-fx-payoff className="fx-payoff">
      {score !== null ? <FxCountUp value={score} from={from} className="fx-payoff-score" {...(scoreProps ?? {})} /> : null}
      {label ? <span className="fx-payoff-label">{label}</span> : null}
      {stars ? <FxStars earned={stars.earned} total={stars.total} /> : null}
      {newBest ? <FxNewBest /> : null}
    </div>
  );
}
