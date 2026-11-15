/**
 * Crazy Golf's reveal (the Crazy Golf overhaul, 15 Nov 2026; display only), inside the shared reveal layout: the
 * scorecard (five cells, each hole's strokes coloured against par, filling in hole by hole) is also the switcher, and
 * the chosen hole is drawn large with every stroke on it (putts white, chips' flights dotted blue, each resting spot
 * numbered, water marked red, the drop ringed gold). Under it, the hole in one plain line and the key numbers behind
 * the score: strokes against par, holes holed, chips, water. Every revision (golfRev 1–3) draws this way.
 */
import { useEffect, useMemo, useRef, useState } from "react";

import { drawMinigolfRevealHole } from "@/lib/arcade/minigolf.renderer";
import { MINIGOLF_HOLES } from "@/lib/arcade/minigolf";
import { minigolfShotTrace } from "@/lib/duel/minigolf";
import type { MinigolfPuzzleData } from "@/lib/duel/types";

/** A hole's result in plain words. */
export function holeWord(strokes: number, par: number, holed: boolean): string {
  if (!holed) return strokes > 0 ? "Not holed" : "Not played";
  if (strokes === 1) return "Hole in one";
  const d = strokes - par;
  if (d <= -2) return "Eagle";
  if (d === -1) return "Birdie";
  if (d === 0) return "Par";
  if (d === 1) return "Bogey";
  if (d === 2) return "Double bogey";
  return `${d} over par`;
}

export function MinigolfReveal({ puzzle, answer }: { puzzle: MinigolfPuzzleData; answer: string }) {
  const trace = useMemo(() => minigolfShotTrace(puzzle, answer), [puzzle, answer]);
  const s = trace.state;
  // Open on the hole that cost the most against par (the one worth seeing first), else the first.
  const first = useMemo(() => {
    let best = 0;
    let worst = -99;
    for (let i = 0; i < MINIGOLF_HOLES; i++) {
      const played = trace.holes[i]!.strokes.length > 0;
      if (!played) continue;
      const over = s.holed[i] ? s.taken[i]! - s.pars[i]! : 9;
      if (over > worst) {
        worst = over;
        best = i;
      }
    }
    return best;
  }, [trace, s]);
  const [sel, setSel] = useState(first);
  useEffect(() => setSel(first), [first]);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const hole = s.course[sel]!;
  const aspect = (hole.box.w + 12) / (hole.box.h + 12);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const draw = () => {
      const w = Math.max(120, c.clientWidth || 300);
      const h = Math.round(w / aspect);
      const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawMinigolfRevealHole(ctx, hole, trace.holes[sel]!.strokes, w, h, s.seed);
    };
    draw();
    // Course art arriving late (the rendered turf, sand and stone) redraws once.
    const late = window.setTimeout(draw, 600);
    return () => window.clearTimeout(late);
  }, [hole, trace, sel, aspect, s.seed]);

  const strokesTotal = s.taken.reduce((a, v) => a + v, 0) + (s.over ? 0 : 0);
  const parTotal = s.pars.reduce((a, v) => a + v, 0);
  const holedN = s.holed.filter((v) => v === 1).length;
  const allHoled = holedN === MINIGOLF_HOLES;
  const diff = strokesTotal - parTotal;
  const chips = trace.holes.reduce((a, h) => a + h.strokes.filter((x) => x.kind === "chip").length, 0);
  const waters = trace.holes.reduce((a, h) => a + h.strokes.filter((x) => x.water).length, 0);
  const selStrokes = trace.holes[sel]!.strokes.length;
  const selWord = holeWord(s.taken[sel]!, s.pars[sel]!, s.holed[sel] === 1);

  return (
    <div data-minigolf-reveal="">
      <ol data-scorecard="" aria-label="Scorecard">
        {Array.from({ length: MINIGOLF_HOLES }, (_, i) => {
          const holed = s.holed[i] === 1;
          const taken = s.taken[i] ?? 0;
          const par = s.pars[i] ?? 3;
          const result = !holed ? "none" : taken < par ? "under" : taken === par ? "par" : "over";
          return (
            <li key={i}>
              <button
                type="button"
                aria-pressed={sel === i}
                aria-label={`Hole ${i + 1}, par ${par}: ${holeWord(taken, par, holed)}`}
                data-result={result}
                style={{ "--i": i } as React.CSSProperties}
                onClick={() => setSel(i)}
              >
                <span data-cell-hole="">Hole {i + 1}</span>
                <span data-cell-strokes="">{holed ? taken : "–"}</span>
                <span data-cell-par="">Par {par}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <canvas ref={canvas} data-hole-map="" aria-label={`Hole ${sel + 1}: ${selStrokes} strokes drawn`} style={{ aspectRatio: `${aspect}` }} />
      <p data-hole-line="">
        Hole {sel + 1} · {selWord}
        {selStrokes > 0 ? ` in ${selStrokes}` : ""}
      </p>
      <p data-map-key="">White: putts. Blue dots: chips in the air. Red: into water.</p>
      <dl data-key-numbers="">
        <div>
          <dt>Strokes</dt>
          <dd>{strokesTotal}</dd>
        </div>
        <div>
          <dt>{allHoled ? "Against par" : "Holed"}</dt>
          <dd>{allHoled ? (diff === 0 ? "Level" : diff < 0 ? `${-diff} under` : `${diff} over`) : `${holedN} of ${MINIGOLF_HOLES}`}</dd>
        </div>
        {chips > 0 ? (
          <div>
            <dt>Chips</dt>
            <dd>{chips}</dd>
          </div>
        ) : null}
        {waters > 0 ? (
          <div>
            <dt>Water</dt>
            <dd>{waters}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
