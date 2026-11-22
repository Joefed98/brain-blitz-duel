/**
 * A Retro game's run summary on its answer reveal (the Retro overhaul, stage 2, 15 Nov 2026; display only): the key
 * numbers that explain the score in plain words, a timeline of the run's moments along the clock (Tempo's notes coloured
 * by their judgement), and for Breaker, Meteor and Blockzone the board as the run left it.
 *
 * Worked out on the phone from the stored run (retroSummary.ts replays it exactly as the server does), loaded and run
 * after the reveal's first paint, in a box whose height is reserved from the start, so nothing moves when it arrives.
 * The score shown above stays the stored one.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { PuzzleData } from "@/lib/duel/types";
import type { RetroSummary } from "@/lib/replay/retroSummary";
import { hasRetroSummary, retroSummaryHasPicture } from "@/lib/replay/retroSummaryTypes";
import { canvasRatio } from "@/lib/battery";

/**
 * The board picture's height (the polish plan's G7, 21 Nov 2026: drawn large in the reveal template's stage, was a
 * 58 × 104 thumbnail); its width follows the world's own shape. Fixed, so the box holds its space before it loads.
 */
const PICTURE_H = 220;

function SummaryPicture({ puzzle, state }: { puzzle: PuzzleData; state: unknown }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    let live = true;
    void import("@/lib/replay/playback.renderer").then(({ makePlaybackDrawer }) => {
      const drawer = makePlaybackDrawer(puzzle);
      const canvas = ref.current;
      if (!live || !drawer || !canvas) return;
      const w = Math.round((PICTURE_H * drawer.worldW) / drawer.worldH);
      const ratio = canvasRatio();
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(PICTURE_H * ratio);
      setWidth(w);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform((ratio * w) / drawer.worldW, 0, 0, (ratio * PICTURE_H) / drawer.worldH, 0, 0);
      try {
        drawer.draw(ctx, state, true);
      } catch {
        /* a picture that can't be drawn is left blank */
      }
    });
    return () => {
      live = false;
    };
  }, [puzzle, state]);
  return (
    <canvas
      ref={ref}
      data-retro-summary-picture=""
      aria-hidden="true"
      className="retro-summary-picture"
      style={{ width: width || Math.round(PICTURE_H * 0.55), height: PICTURE_H, maxWidth: "62%" }}
    />
  );
}

const KIND_WORD = { good: "good", gold: "gold", miss: "miss" } as const;

function Timeline({ summary }: { summary: RetroSummary }) {
  const label = useMemo(() => {
    const parts = (Object.keys(summary.legend) as (keyof typeof KIND_WORD)[]).map(
      (k) => `${summary.marks.filter((m) => m.kind === k).length} ${summary.legend[k]}`,
    );
    return `The run along the clock: ${parts.join(", ")}`;
  }, [summary]);
  return (
    <div className="retro-summary-timeline-wrap">
      <div data-retro-summary-timeline="" role="img" aria-label={label} className="retro-summary-timeline">
        {summary.endedAt < 0.999 ? (
          <span className="retro-summary-unplayed" style={{ left: `${summary.endedAt * 100}%` }} />
        ) : null}
        {summary.notes?.map((n, i) => (
          <span key={`n${i}`} data-note={n.kind} className="retro-summary-note" style={{ left: `${n.at * 100}%` }} />
        ))}
        {summary.marks.map((m, i) => (
          <span key={i} data-mark={m.kind} className="retro-summary-mark" style={{ left: `${m.at * 100}%` }} />
        ))}
      </div>
      <div className="retro-summary-legend" aria-hidden="true">
        {summary.notes ? (
          <>
            <span><i data-note="perfect" />Perfect</span>
            <span><i data-note="good" />Good</span>
            <span><i data-note="miss" />Missed</span>
          </>
        ) : null}
        {(Object.keys(summary.legend) as (keyof typeof KIND_WORD)[]).map((k) => (
          <span key={k}>
            <i data-mark={k} />
            {summary.legend[k]}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RetroRunSummary({ puzzle, answer }: { puzzle: PuzzleData; answer: string | null }) {
  const [summary, setSummary] = useState<RetroSummary | null | undefined>(undefined);
  const eligible = hasRetroSummary(puzzle.type) && !!answer;
  useEffect(() => {
    if (!eligible) return;
    let live = true;
    // After the reveal's first paint: a long run (Spacewalk's) takes a few hundred milliseconds to replay.
    const id = window.setTimeout(() => {
      void import("@/lib/replay/retroSummary").then(({ retroRunSummary }) => {
        if (live) setSummary(retroRunSummary(puzzle, answer));
      });
    }, 120);
    return () => {
      live = false;
      window.clearTimeout(id);
    };
  }, [eligible, puzzle, answer]);
  if (!eligible || summary === null) return null;
  const picture = retroSummaryHasPicture(puzzle.type);
  return (
    <section
      data-retro-summary={summary ? puzzle.type : "pending"}
      aria-label="Your run"
      className={`retro-summary${picture ? " retro-summary-with-picture" : ""}`}
    >
      <div className="retro-summary-top">
        {picture && summary ? <SummaryPicture puzzle={puzzle} state={summary.finalState} /> : picture ? <span className="retro-summary-picture" /> : null}
        <dl className="retro-summary-stats">
          {(summary?.stats ?? [{ label: "", value: "" }, { label: "", value: "" }, { label: "", value: "" }]).map((s, i) => (
            <div key={i} className="retro-summary-stat">
              <dt>{s.label}</dt>
              <dd className="tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {summary ? <Timeline summary={summary} /> : <div className="retro-summary-timeline-wrap" />}
    </section>
  );
}
