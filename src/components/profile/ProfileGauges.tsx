/**
 * You's three ring gauges (P3, 22 Nov 2026; Joe's mix of Y2 and Y3, plan section 2.1, mockup you-mixed-phone), in place
 * of stat tiles: wins, stars and the Daily streak. Each is a ring drawn as one SVG arc over its track, the figure in
 * the middle and two quiet lines under it. Presentation only: every figure is passed in from what Profile already
 * reads (the server's rated win count, the account's star total, the Daily record).
 */
import type { ReactNode } from "react";

/** One ring: `share` 0–1 of the ring filled, in `tone` (a CSS colour from the tokens). */
export function Gauge({
  share,
  tone,
  figure,
  label,
  sub,
  data,
  onClick,
  ariaLabel,
}: {
  share: number;
  tone: string;
  figure: string;
  label: string;
  sub: string;
  data?: Record<string, string | number | undefined>;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, Number.isFinite(share) ? share : 0));
  const ring: ReactNode = (
    <svg viewBox="0 0 76 76" width="76" height="76" aria-hidden="true" className="pf-gauge-ring">
      <circle cx="38" cy="38" r={r} className="pf-gauge-track" />
      {filled > 0 ? (
      <circle
        cx="38"
        cy="38"
        r={r}
        className="pf-gauge-arc"
        style={{ stroke: tone, strokeDasharray: `${(c * filled).toFixed(2)} ${c.toFixed(2)}` }}
        transform="rotate(-90 38 38)"
      />
      ) : null}
    </svg>
  );
  const body = (
    <>
      <span className="pf-gauge-dial">
        {ring}
        <span className="pf-gauge-figure" data-one-line>
          {figure}
        </span>
      </span>
      <span className="pf-gauge-label" data-one-line>
        {label}
      </span>
      <span className="pf-gauge-sub" data-one-line>
        {sub}
      </span>
    </>
  );
  return onClick ? (
    <button type="button" className="pf-gauge press" onClick={onClick} aria-label={ariaLabel} {...data}>
      {body}
    </button>
  ) : (
    <div className="pf-gauge" role="group" aria-label={ariaLabel} {...data}>
      {body}
    </div>
  );
}

/** The longest run of consecutive UK days in a list of day keys ("2026-11-20"), for the streak gauge's "best". */
export function bestStreak(days: readonly string[]): number {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let last: number | null = null;
  for (const key of sorted) {
    const at = Date.parse(`${key}T12:00:00Z`);
    if (!Number.isFinite(at)) continue;
    run = last !== null && Math.round((at - last) / 86_400_000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    last = at;
  }
  return best;
}
